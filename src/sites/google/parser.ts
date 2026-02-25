import { compactWhitespace, extractEmails, nullIfEmpty } from "../../core/text";
import type { JobPost, JobType } from "../../types";

export interface GoogleParseOptions {
  now?: Date;
}

export interface GoogleParsedJobsPage {
  jobs: JobPost[];
  nextCursor?: string;
}

const GOOGLE_INITIAL_JOB_INFO_REGEX =
  /520084652":(\[[\s\S]*?\]\s*])\s*}\s*]\s*]\s*]\s*]\s*]/g;
const GOOGLE_NEXT_CURSOR_REGEX = /data-async-fc="([^"]+)"/;

export function parseGoogleInitialJobsPage(
  html: string,
  options: GoogleParseOptions = {},
): GoogleParsedJobsPage {
  const now = options.now ?? new Date();
  const jobs: JobPost[] = [];

  for (const jobInfoGroup of extractGoogleInitialJobInfoGroups(html)) {
    for (const jobInfo of jobInfoGroup) {
      const parsed = parseGoogleJobInfo(jobInfo, { now });
      if (parsed) {
        jobs.push(parsed);
      }
    }
  }

  return {
    jobs,
    nextCursor: extractGoogleForwardCursor(html) ?? undefined,
  };
}

export function parseGoogleAsyncJobsPage(
  responseText: string,
  options: GoogleParseOptions = {},
): GoogleParsedJobsPage {
  const now = options.now ?? new Date();
  const jobs: JobPost[] = [];
  const fragment = extractGoogleAsyncJsonFragment(responseText);
  const nextCursor = extractGoogleForwardCursor(responseText) ?? undefined;

  if (!fragment) {
    return { jobs, nextCursor };
  }

  let parsedRoot: unknown;
  try {
    parsedRoot = JSON.parse(fragment) as unknown;
  } catch {
    return { jobs, nextCursor };
  }

  const outerList = Array.isArray(parsedRoot) ? parsedRoot[0] : null;
  if (!Array.isArray(outerList)) {
    return { jobs, nextCursor };
  }

  for (const entry of outerList) {
    if (!Array.isArray(entry)) {
      continue;
    }

    const nestedPayload = entry[1];
    if (typeof nestedPayload !== "string" || !nestedPayload.startsWith("[[[")) {
      continue;
    }

    let nestedJson: unknown;
    try {
      nestedJson = JSON.parse(nestedPayload) as unknown;
    } catch {
      continue;
    }

    const jobInfoGroup = findGoogleJobInfo(nestedJson);
    if (!Array.isArray(jobInfoGroup)) {
      continue;
    }

    for (const jobInfo of jobInfoGroup) {
      const parsed = parseGoogleJobInfo(jobInfo, { now });
      if (parsed) {
        jobs.push(parsed);
      }
    }
  }

  return { jobs, nextCursor };
}

export function parseGoogleJobInfo(
  jobInfo: unknown,
  options: Required<GoogleParseOptions>,
): JobPost | null {
  if (!Array.isArray(jobInfo)) {
    return null;
  }

  const title = asNonEmptyString(jobInfo[0]);
  const company = asNonEmptyString(jobInfo[1]);
  const locationDisplay = asNonEmptyString(jobInfo[2]);
  const jobUrl = extractGoogleJobUrl(jobInfo[3]);
  const postedText = asNonEmptyString(jobInfo[12]);
  const description = asNonEmptyString(jobInfo[19]);
  const rawId = asNonEmptyString(jobInfo[28]);

  if (!title || !jobUrl) {
    return null;
  }

  const parsedLocation = parseGoogleLocation(locationDisplay);
  const jobType = inferGoogleJobType(description);
  const emails = description ? extractEmails(description) : [];
  const datePosted = postedText ? parseGoogleRelativeDate(postedText, options.now) : null;

  return {
    id: rawId ? `go-${rawId}` : null,
    site: "google",
    title,
    company,
    jobUrl,
    location: parsedLocation,
    datePosted,
    isRemote: inferGoogleRemote(description),
    description,
    emails: emails.length > 0 ? emails : null,
    jobType,
    metadata: {
      postedText,
    },
  };
}

export function parseGoogleLocation(
  locationText: string | null | undefined,
): JobPost["location"] {
  const normalized = nullIfEmpty(locationText);
  if (!normalized) {
    return null;
  }

  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }

  if (parts.length === 1) {
    return {
      city: parts[0] ?? null,
      state: null,
      country: null,
      display: normalized,
    };
  }

  if (parts.length === 2) {
    return {
      city: parts[0] ?? null,
      state: parts[1] ?? null,
      country: null,
      display: normalized,
    };
  }

  return {
    city: parts[0] ?? null,
    state: parts[1] ?? null,
    country: parts.slice(2).join(", ") || null,
    display: normalized,
  };
}

export function parseGoogleRelativeDate(relativeText: string, now: Date): string | null {
  const normalized = relativeText.toLowerCase();

  let daysAgo: number | null = null;
  if (normalized.includes("today") || /hours?|minutes?|just now/.test(normalized)) {
    daysAgo = 0;
  } else if (normalized.includes("yesterday")) {
    daysAgo = 1;
  } else {
    const match = normalized.match(/(\d+)/);
    if (match?.[1]) {
      const amount = Number.parseInt(match[1], 10);
      if (Number.isFinite(amount)) {
        if (normalized.includes("month")) {
          daysAgo = amount * 30;
        } else if (normalized.includes("week")) {
          daysAgo = amount * 7;
        } else {
          daysAgo = amount;
        }
      }
    }
  }

  if (daysAgo == null) {
    return null;
  }

  return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
}

export function inferGoogleRemote(description: string | null | undefined): boolean {
  const text = (description ?? "").toLowerCase();
  return text.includes("remote") || text.includes("wfh");
}

export function inferGoogleJobType(
  description: string | null | undefined,
): JobType[] | null {
  if (!description) {
    return null;
  }

  const matches: JobType[] = [];
  const patterns: Array<[RegExp, JobType]> = [
    [/full[-\s]?time/i, "fulltime"],
    [/part[-\s]?time/i, "parttime"],
    [/internship/i, "internship"],
    [/contract/i, "contract"],
  ];

  for (const [pattern, jobType] of patterns) {
    if (pattern.test(description)) {
      matches.push(jobType);
    }
  }

  return matches.length > 0 ? [...new Set(matches)] : null;
}

export function findGoogleJobInfo(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findGoogleJobInfo(item);
      if (found) {
        return found;
      }
    }
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  const direct = value["520084652"];
  if (Array.isArray(direct)) {
    return direct;
  }

  for (const child of Object.values(value)) {
    const found = findGoogleJobInfo(child);
    if (found) {
      return found;
    }
  }

  return null;
}

export function extractGoogleForwardCursor(htmlOrPayload: string): string | null {
  const match = htmlOrPayload.match(GOOGLE_NEXT_CURSOR_REGEX);
  return match?.[1] ? match[1] : null;
}

export function extractGoogleAsyncJsonFragment(payload: string): string | null {
  const start = payload.indexOf("[[[");
  const end = payload.lastIndexOf("]]]");
  if (start === -1 || end === -1 || end < start) {
    return null;
  }
  return payload.slice(start, end + 3);
}

export function extractGoogleInitialJobInfoGroups(html: string): unknown[][] {
  const groups: unknown[][] = [];
  let match: RegExpExecArray | null;

  match = GOOGLE_INITIAL_JOB_INFO_REGEX.exec(html);
  while (match) {
    const captured = match[1];
    if (captured) {
      try {
        const parsed = JSON.parse(captured) as unknown;
        if (Array.isArray(parsed)) {
          groups.push(parsed);
        }
      } catch {
        // Ignore malformed chunks and continue searching for more job groups.
      }
    }
    match = GOOGLE_INITIAL_JOB_INFO_REGEX.exec(html);
  }

  GOOGLE_INITIAL_JOB_INFO_REGEX.lastIndex = 0;
  return groups;
}

function extractGoogleJobUrl(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const firstTuple = value[0];
  if (!Array.isArray(firstTuple)) {
    return null;
  }

  const urlCandidate = asNonEmptyString(firstTuple[0]);
  if (!urlCandidate) {
    return null;
  }

  try {
    return new URL(urlCandidate).toString();
  } catch {
    return null;
  }
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = nullIfEmpty(value);
  if (!normalized) {
    return null;
  }
  return compactWhitespace(normalized);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
