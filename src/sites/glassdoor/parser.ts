import { htmlToMarkdown, htmlToText } from "../../core/html";
import { extractEmails, nullIfEmpty } from "../../core/text";
import type { JobPost } from "../../types";

export interface GlassdoorPaginationCursor {
  cursor?: string | null;
  pageNumber?: number | null;
}

interface GlassdoorEmployer {
  id?: number | string | null;
  name?: string | null;
}

interface GlassdoorAdjustedPay {
  p10?: number | null;
  p90?: number | null;
}

export interface GlassdoorJobHeaderPayload {
  adOrderSponsorshipLevel?: string | null;
  ageInDays?: number | null;
  easyApply?: boolean | null;
  employer?: GlassdoorEmployer | null;
  employerNameFromSearch?: string | null;
  jobLink?: string | null;
  jobResultTrackingKey?: string | null;
  jobTitleText?: string | null;
  locationName?: string | null;
  locationType?: string | null;
  payCurrency?: string | null;
  payPeriod?: string | null;
  payPeriodAdjustedPay?: GlassdoorAdjustedPay | null;
  rating?: number | null;
  salarySource?: string | null;
}

interface GlassdoorJobNodePayload {
  listingId?: number | string | null;
  jobTitleText?: string | null;
  description?: string | null;
}

interface GlassdoorOverviewPayload {
  shortName?: string | null;
  squareLogoUrl?: string | null;
}

export interface GlassdoorSearchJobPayload {
  jobview?: {
    header?: GlassdoorJobHeaderPayload | null;
    job?: GlassdoorJobNodePayload | null;
    overview?: GlassdoorOverviewPayload | null;
  } | null;
}

export interface GlassdoorDetailGraphqlData {
  jobview?: {
    job?: {
      description?: string | null;
    } | null;
  } | null;
}

export interface GlassdoorGraphqlEnvelope<TData> {
  data?: TData | null;
  errors?: Array<{ message?: string | null }> | null;
}

export interface ParseGlassdoorJobOptions {
  baseUrl: string;
  now: Date;
  descriptionFormat: "markdown" | "html";
  descriptionHtml?: string | null;
}

export function getGlassdoorListingId(job: GlassdoorSearchJobPayload): string | null {
  const listingId = job.jobview?.job?.listingId;
  if (listingId == null) {
    return null;
  }
  const normalized = String(listingId).trim();
  return normalized.length > 0 ? normalized : null;
}

export function parseGlassdoorJob(
  job: GlassdoorSearchJobPayload,
  options: ParseGlassdoorJobOptions,
): JobPost | null {
  const jobId = getGlassdoorListingId(job);
  if (!jobId) {
    return null;
  }

  const header = job.jobview?.header ?? null;
  const jobNode = job.jobview?.job ?? null;
  const overview = job.jobview?.overview ?? null;

  const title = nullIfEmpty(jobNode?.jobTitleText ?? header?.jobTitleText ?? null);
  if (!title) {
    return null;
  }

  const company = nullIfEmpty(
    header?.employerNameFromSearch ?? header?.employer?.name ?? null,
  );
  const companyId = normalizeIdentifier(header?.employer?.id);

  const descriptionHtml =
    options.descriptionHtml ?? nullIfEmpty(jobNode?.description ?? null);
  const description = formatGlassdoorDescription(descriptionHtml, options.descriptionFormat);

  const externalApplyUrl = normalizeExternalApplyUrl(header?.jobLink, options.baseUrl);
  const parsedLocation =
    header?.locationType === "S" ? null : parseGlassdoorLocation(header?.locationName);
  const isRemote = header?.locationType === "S";

  return {
    id: `gd-${jobId}`,
    site: "glassdoor",
    title,
    company,
    companyUrl: companyId ? `${options.baseUrl}/Overview/W-EI_IE${companyId}.htm` : null,
    companyLogo: nullIfEmpty(overview?.squareLogoUrl),
    companyRating: parseOptionalFloat(header?.rating),
    jobUrl: `${options.baseUrl}/job-listing/j?jl=${encodeURIComponent(jobId)}`,
    jobUrlDirect: externalApplyUrl,
    externalApplyUrl,
    location: parsedLocation,
    isRemote,
    description,
    compensation: parseGlassdoorCompensation(header),
    datePosted: parseGlassdoorDatePosted(header?.ageInDays, options.now),
    emails: description
      ? extractEmails(
          options.descriptionFormat === "html" ? htmlToText(description) : description,
        )
      : null,
    listingType: normalizeListingType(header?.adOrderSponsorshipLevel),
    metadata: {
      easyApply:
        typeof header?.easyApply === "boolean" ? header.easyApply : null,
      salarySource: nullIfEmpty(header?.salarySource),
      jobResultTrackingKey: nullIfEmpty(header?.jobResultTrackingKey),
      glassdoorJobLink: nullIfEmpty(header?.jobLink),
      employerShortName: nullIfEmpty(overview?.shortName),
    },
  };
}

export function parseGlassdoorCompensation(
  header: Pick<
    GlassdoorJobHeaderPayload,
    "payPeriod" | "payPeriodAdjustedPay" | "payCurrency"
  > | null | undefined,
): JobPost["compensation"] {
  if (!header) {
    return null;
  }

  const interval = normalizeGlassdoorPayInterval(header.payPeriod);
  const range = header.payPeriodAdjustedPay;
  if (!interval || !range) {
    return null;
  }

  const minAmount = parseOptionalNumber(range.p10);
  const maxAmount = parseOptionalNumber(range.p90);
  if (minAmount == null && maxAmount == null) {
    return null;
  }

  return {
    interval,
    minAmount,
    maxAmount,
    currency: nullIfEmpty(header.payCurrency) ?? "USD",
    salarySource: "direct_data",
  };
}

export function parseGlassdoorLocation(
  locationName: string | null | undefined,
): JobPost["location"] {
  const normalized = nullIfEmpty(locationName);
  if (!normalized) {
    return null;
  }

  if (normalized.toLowerCase() === "remote") {
    return null;
  }

  const parts = normalized.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    return {
      city: parts[0],
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

export function mapGlassdoorLocationType(
  value: string | null | undefined,
): "CITY" | "STATE" | "COUNTRY" | null {
  if (!value) {
    return null;
  }

  const normalized = value.trim().toUpperCase();
  if (normalized === "C" || normalized === "CITY") {
    return "CITY";
  }
  if (normalized === "S" || normalized === "STATE") {
    return "STATE";
  }
  if (normalized === "N" || normalized === "COUNTRY") {
    return "COUNTRY";
  }
  return null;
}

export function getGlassdoorCursorForPage(
  cursors: GlassdoorPaginationCursor[] | null | undefined,
  pageNumber: number,
): string | undefined {
  if (!Array.isArray(cursors) || !Number.isFinite(pageNumber)) {
    return undefined;
  }

  const match = cursors.find((cursor) => cursor.pageNumber === pageNumber);
  return match?.cursor ?? undefined;
}

export function parseGlassdoorDetailDescriptionFromEnvelope(
  envelope: GlassdoorGraphqlEnvelope<GlassdoorDetailGraphqlData> | null | undefined,
): string | null {
  return nullIfEmpty(envelope?.data?.jobview?.job?.description ?? null);
}

export function formatGlassdoorDescription(
  descriptionHtml: string | null | undefined,
  descriptionFormat: "markdown" | "html",
): string | null {
  const normalized = nullIfEmpty(descriptionHtml);
  if (!normalized) {
    return null;
  }

  if (descriptionFormat === "html") {
    return normalized;
  }

  return htmlToMarkdown(normalized);
}

function parseGlassdoorDatePosted(
  ageInDays: number | null | undefined,
  now: Date,
): string | null {
  if (typeof ageInDays !== "number" || !Number.isFinite(ageInDays) || ageInDays < 0) {
    return null;
  }

  const baseMs = now.getTime();
  if (!Number.isFinite(baseMs)) {
    return null;
  }

  const posted = new Date(baseMs - Math.round(ageInDays) * 24 * 60 * 60 * 1000);
  return posted.toISOString();
}

function normalizeGlassdoorPayInterval(
  payPeriod: string | null | undefined,
): "yearly" | "monthly" | "weekly" | "daily" | "hourly" | null {
  const normalized = nullIfEmpty(payPeriod)?.toUpperCase();
  if (!normalized) {
    return null;
  }

  const mapping = {
    ANNUAL: "yearly",
    YEARLY: "yearly",
    YEAR: "yearly",
    MONTHLY: "monthly",
    MONTH: "monthly",
    WEEKLY: "weekly",
    WEEK: "weekly",
    DAILY: "daily",
    DAY: "daily",
    HOURLY: "hourly",
    HOUR: "hourly",
  } as const;

  return mapping[normalized as keyof typeof mapping] ?? null;
}

function parseOptionalNumber(value: number | string | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

function parseOptionalFloat(value: number | string | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeListingType(value: string | null | undefined): string | null {
  const normalized = nullIfEmpty(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeIdentifier(value: number | string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeExternalApplyUrl(
  rawUrl: string | null | undefined,
  baseUrl: string,
): string | null {
  const normalized = nullIfEmpty(rawUrl);
  if (!normalized) {
    return null;
  }

  try {
    const resolved = new URL(normalized, baseUrl);
    if (resolved.hostname.includes("glassdoor.")) {
      return null;
    }
    return resolved.toString();
  } catch {
    return null;
  }
}
