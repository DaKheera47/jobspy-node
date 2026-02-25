import { load, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

import { compactWhitespace, nullIfEmpty } from "../../core/text";
import type { JobPost } from "../../types";
import { BAYT_BASE_URL } from "./constants";

export function parseBaytSearchPage(html: string): JobPost[] {
  const $ = load(html);
  const jobs: JobPost[] = [];

  $("li[data-js-job], li[data-js-job=''], li[data-job-id]").each((_, element) => {
    const parsed = parseBaytJobCard($, element);
    if (parsed) {
      jobs.push(parsed);
    }
  });

  if (jobs.length > 0) {
    return dedupeByJobUrl(jobs);
  }

  $("li, article, div").each((_, element) => {
    const parsed = parseBaytJobCard($, element);
    if (parsed) {
      jobs.push(parsed);
    }
  });

  return dedupeByJobUrl(jobs);
}

export function parseBaytJobCard(
  $: CheerioAPI,
  element: Element,
): JobPost | null {
  const card = $(element);
  let titleLink = card.find("h2 a[href]").first();
  if (titleLink.length === 0) {
    titleLink = card.find("a[href*='/jobs/']").first();
  }
  if (titleLink.length === 0) {
    titleLink = card.find("a[href]").first();
  }

  if (titleLink.length === 0) {
    return null;
  }

  const hrefRaw = titleLink.attr("href");
  const jobUrl = toAbsoluteUrl(hrefRaw);
  if (!jobUrl || !/\/jobs\//i.test(jobUrl)) {
    return null;
  }

  const title = nullIfEmpty(
    compactWhitespace(
      card.find("h2").first().text() ||
        titleLink.text() ||
        card.find("[data-js-job-title]").first().text(),
    ),
  );
  if (!title) {
    return null;
  }

  const company = nullIfEmpty(
    compactWhitespace(
      card.find("div.t-nowrap.p10l span").first().text() ||
        card.find("[class*='company'] a").first().text() ||
        card.find("[class*='company']").first().text(),
    ),
  );

  const locationText = nullIfEmpty(
    compactWhitespace(
      card.find("div.t-mute.t-small").first().text() ||
        card.find("[class*='location']").first().text() ||
        card.find("[class*='loc']").first().text(),
    ),
  );
  const location = parseBaytLocation(locationText);

  const datetimeRaw = card.find("time[datetime]").first().attr("datetime") ?? null;
  const datePosted =
    datetimeRaw && Number.isFinite(Date.parse(datetimeRaw))
      ? new Date(datetimeRaw).toISOString()
      : null;

  const id = extractBaytJobId(jobUrl);

  return {
    id,
    site: "bayt",
    title,
    company,
    jobUrl,
    location,
    isRemote: inferBaytRemote(title, location?.display ?? null),
    datePosted,
    metadata: {},
  };
}

export function parseBaytLocation(text: string | null | undefined): JobPost["location"] {
  const value = nullIfEmpty(text);
  if (!value) {
    return null;
  }

  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) {
    return null;
  }
  if (parts.length === 1) {
    return {
      city: parts[0] ?? null,
      state: null,
      country: null,
      display: value,
    };
  }
  if (parts.length === 2) {
    return {
      city: parts[0] ?? null,
      state: null,
      country: parts[1] ?? null,
      display: value,
    };
  }

  return {
    city: parts[0] ?? null,
    state: parts[1] ?? null,
    country: parts.slice(2).join(", ") || null,
    display: value,
  };
}

export function inferBaytRemote(
  title: string,
  locationDisplay: string | null | undefined,
): boolean {
  const combined = `${title} ${locationDisplay ?? ""}`.toLowerCase();
  return ["remote", "work from home", "wfh", "hybrid"].some((keyword) =>
    combined.includes(keyword),
  );
}

function extractBaytJobId(jobUrl: string): string {
  const numericMatch = jobUrl.match(/-(\d{4,})(?:[/?#]|$)/);
  if (numericMatch?.[1]) {
    return `bayt-${numericMatch[1]}`;
  }

  return `bayt-${stableHash(jobUrl)}`;
}

function toAbsoluteUrl(href: string | undefined): string | null {
  const value = nullIfEmpty(href);
  if (!value) {
    return null;
  }

  try {
    return new URL(value, BAYT_BASE_URL).toString();
  } catch {
    return null;
  }
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}

function dedupeByJobUrl(jobs: JobPost[]): JobPost[] {
  const seen = new Set<string>();
  const deduped: JobPost[] = [];
  for (const job of jobs) {
    if (seen.has(job.jobUrl)) {
      continue;
    }
    seen.add(job.jobUrl);
    deduped.push(job);
  }
  return deduped;
}
