import { load } from "cheerio";

import { htmlToMarkdown, htmlToText } from "../../core/html";
import { extractEmails, nullIfEmpty } from "../../core/text";
import type { JobPost, JobType } from "../../types";
import { NAUKRI_BASE_URL } from "./constants";

export interface NaukriPlaceholder {
  type?: string | null;
  label?: string | null;
}

export interface NaukriAmbitionBoxData {
  AggregateRating?: number | string | null;
  ReviewsCount?: number | string | null;
  [key: string]: unknown;
}

export interface NaukriApiJob {
  jobId?: string | number | null;
  title?: string | null;
  companyName?: string | null;
  staticUrl?: string | null;
  placeholders?: NaukriPlaceholder[] | null;
  footerPlaceholderLabel?: string | null;
  createdDate?: number | string | null;
  jdURL?: string | null;
  jobDescription?: string | null;
  logoPathV3?: string | null;
  logoPath?: string | null;
  tagsAndSkills?: string | string[] | null;
  experienceText?: string | null;
  ambitionBoxData?: NaukriAmbitionBoxData | null;
  vacancy?: number | string | null;
  [key: string]: unknown;
}

export interface ParseNaukriJobOptions {
  descriptionFormat: "markdown" | "html";
  now?: Date;
}

const NAUKRI_JOB_TYPE_MAP: Record<string, JobType> = {
  fulltime: "fulltime",
  parttime: "parttime",
  internship: "internship",
  contract: "contract",
};

export function parseNaukriJob(
  job: NaukriApiJob,
  options: ParseNaukriJobOptions,
): JobPost {
  const jobId = normalizeJobId(job.jobId);
  const placeholders = Array.isArray(job.placeholders) ? job.placeholders : [];
  const rawDescription = nullIfEmpty(job.jobDescription ?? null);
  const descriptionText = rawDescription ? htmlToText(rawDescription) : null;

  const description =
    rawDescription == null
      ? null
      : options.descriptionFormat === "html"
        ? rawDescription
        : htmlToMarkdown(rawDescription);

  const location = parseNaukriLocation(placeholders);
  const compensation = parseNaukriCompensation(placeholders);
  const title = nullIfEmpty(job.title) ?? "Untitled role";
  const company = nullIfEmpty(job.companyName);
  const companyUrl = normalizeCompanyUrl(job.staticUrl);
  const jobUrl = normalizeNaukriJobUrl(job.jdURL, jobId);
  const jobType = rawDescription ? parseNaukriJobTypes(rawDescription) : null;
  const companyIndustry = rawDescription
    ? parseNaukriCompanyIndustry(rawDescription)
    : null;
  const workFromHomeType = inferNaukriWorkFromHomeType(
    placeholders,
    title,
    descriptionText,
  );

  const parsed: JobPost = {
    id: jobId ? `nk-${jobId}` : null,
    site: "naukri",
    title,
    company,
    companyUrl,
    companyLogo: normalizeUrl(job.logoPathV3 ?? job.logoPath ?? null),
    companyIndustry,
    companyRating: parseOptionalNumber(job.ambitionBoxData?.AggregateRating),
    companyReviewsCount: parseOptionalInteger(job.ambitionBoxData?.ReviewsCount),
    vacancyCount: parseOptionalInteger(job.vacancy),
    jobUrl,
    location,
    isRemote: inferNaukriRemote(title, descriptionText, location?.display ?? null),
    workFromHomeType,
    description,
    jobType,
    skills: parseNaukriSkills(job.tagsAndSkills),
    experienceRange: nullIfEmpty(job.experienceText),
    compensation,
    datePosted: parseNaukriDatePosted(
      job.footerPlaceholderLabel,
      job.createdDate,
      options.now,
    ),
    emails: extractEmails(descriptionText),
    metadata: {
      placeholders,
      footerPlaceholderLabel: job.footerPlaceholderLabel ?? null,
      ambitionBoxData: job.ambitionBoxData ?? null,
      rawCompanyName: job.companyName ?? null,
    },
  };

  return parsed;
}

export function parseNaukriLocation(
  placeholders: NaukriPlaceholder[],
): JobPost["location"] {
  const label = getPlaceholderLabel(placeholders, "location");
  if (!label) {
    return {
      city: null,
      state: null,
      country: "INDIA",
      display: null,
    };
  }

  const parts = label.split(",").map((part) => part.trim()).filter(Boolean);
  const city = parts[0] ? parts[0].split("/")[0]?.trim() ?? null : null;
  const state = parts[1] ?? null;

  return {
    city: city || null,
    state,
    country: "INDIA",
    display: label,
  };
}

export function parseNaukriCompensation(
  placeholders: NaukriPlaceholder[],
): JobPost["compensation"] {
  const salaryText = getPlaceholderLabel(placeholders, "salary");
  if (!salaryText) {
    return null;
  }

  if (/not\s+disclosed/i.test(salaryText)) {
    return null;
  }

  const parsedLakhCr = parseIndianRangeWithUnits(salaryText);
  if (parsedLakhCr) {
    return parsedLakhCr;
  }

  const plainRange = parsePlainCurrencyRange(salaryText);
  if (plainRange) {
    return plainRange;
  }

  return null;
}

export function parseNaukriDatePosted(
  label: string | null | undefined,
  createdDate: number | string | null | undefined,
  nowInput?: Date,
): string | null {
  const now = nowInput ?? new Date();
  const labelNormalized = label?.trim().toLowerCase();

  if (labelNormalized) {
    if (
      labelNormalized.includes("today") ||
      labelNormalized.includes("just now") ||
      labelNormalized.includes("few hours")
    ) {
      return now.toISOString();
    }

    const minutesMatch = labelNormalized.match(/(\d+)\s*(minute|min)\b/);
    if (minutesMatch?.[1]) {
      return new Date(now.getTime() - Number(minutesMatch[1]) * 60_000).toISOString();
    }

    const hoursMatch = labelNormalized.match(/(\d+)\s*(hour|hr)\b/);
    if (hoursMatch?.[1]) {
      return new Date(
        now.getTime() - Number(hoursMatch[1]) * 60 * 60_000,
      ).toISOString();
    }

    const daysMatch = labelNormalized.match(/(\d+)\s*days?\b/);
    if (daysMatch?.[1]) {
      return new Date(
        now.getTime() - Number(daysMatch[1]) * 24 * 60 * 60_000,
      ).toISOString();
    }

    const weeksMatch = labelNormalized.match(/(\d+)\s*weeks?\b/);
    if (weeksMatch?.[1]) {
      return new Date(
        now.getTime() - Number(weeksMatch[1]) * 7 * 24 * 60 * 60_000,
      ).toISOString();
    }

    const monthsMatch = labelNormalized.match(/(\d+)\s*months?\b/);
    if (monthsMatch?.[1]) {
      return new Date(
        now.getTime() - Number(monthsMatch[1]) * 30 * 24 * 60 * 60_000,
      ).toISOString();
    }
  }

  const fallback = parseNaukriTimestamp(createdDate);
  return fallback ? fallback.toISOString() : null;
}

export function parseNaukriJobTypes(
  descriptionHtml: string,
): JobType[] | null {
  const $ = load(descriptionHtml);
  const explicitJobType = $("span.job-type").first().text().trim();
  const inferredText = explicitJobType || $.text();
  const normalized = inferredText
    .toLowerCase()
    .replace(/[_\s-]+/g, "");

  for (const [needle, mapped] of Object.entries(NAUKRI_JOB_TYPE_MAP)) {
    if (normalized.includes(needle)) {
      return [mapped];
    }
  }

  return null;
}

export function parseNaukriCompanyIndustry(
  descriptionHtml: string,
): string | null {
  const $ = load(descriptionHtml);
  return nullIfEmpty($("span.industry").first().text());
}

export function inferNaukriRemote(
  title: string,
  description: string | null | undefined,
  locationDisplay: string | null | undefined,
): boolean {
  const combined = `${title} ${description ?? ""} ${locationDisplay ?? ""}`.toLowerCase();
  return ["remote", "work from home", "wfh"].some((keyword) =>
    combined.includes(keyword),
  );
}

export function inferNaukriWorkFromHomeType(
  placeholders: NaukriPlaceholder[],
  title: string,
  description: string | null | undefined,
): string | null {
  const locationLabel = getPlaceholderLabel(placeholders, "location")?.toLowerCase() ?? "";
  const titleLower = title.toLowerCase();
  const descriptionLower = (description ?? "").toLowerCase();
  const combined = `${locationLabel} ${titleLower} ${descriptionLower}`;

  if (combined.includes("hybrid")) {
    return "Hybrid";
  }
  if (
    combined.includes("remote") ||
    combined.includes("work from home") ||
    combined.includes("wfh")
  ) {
    return "Remote";
  }
  if (!descriptionLower) {
    return null;
  }
  if (descriptionLower.includes("work from office")) {
    return "Work from office";
  }
  return "Work from office";
}

function getPlaceholderLabel(
  placeholders: NaukriPlaceholder[],
  type: string,
): string | null {
  const placeholder = placeholders.find(
    (item) => item.type?.toLowerCase() === type.toLowerCase(),
  );
  return nullIfEmpty(placeholder?.label ?? null);
}

function parseIndianRangeWithUnits(
  salaryText: string,
): JobPost["compensation"] {
  const match = salaryText.match(
    /(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)\s*(lacs?|lakhs?|lakh|cr|crore|crores)\b/i,
  );
  if (!match?.[1] || !match[2] || !match[3]) {
    return null;
  }

  const min = Number(match[1]);
  const max = Number(match[2]);
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return null;
  }

  const unit = match[3].toLowerCase();
  const multiplier =
    unit.startsWith("cr") || unit.startsWith("crore") ? 10_000_000 : 100_000;

  return {
    interval: "yearly",
    minAmount: Math.round(min * multiplier),
    maxAmount: Math.round(max * multiplier),
    currency: "INR",
    salarySource: "direct_data",
  };
}

function parsePlainCurrencyRange(
  salaryText: string,
): JobPost["compensation"] {
  const match = salaryText.match(
    /(\d[\d,\s]*)\s*-\s*(\d[\d,\s]*)(?:\s*(per\s+month|month|p\.m\.|per\s+annum|annum|year|p\.a\.))?/i,
  );
  if (!match?.[1] || !match[2]) {
    return null;
  }

  const minAmount = parseIndianNumber(match[1]);
  const maxAmount = parseIndianNumber(match[2]);
  if (minAmount == null || maxAmount == null) {
    return null;
  }

  const intervalToken = (match[3] ?? "").toLowerCase();
  const interval = intervalToken.includes("month")
    ? "monthly"
    : intervalToken
      ? "yearly"
      : null;

  return {
    interval,
    minAmount,
    maxAmount,
    currency: "INR",
    salarySource: "direct_data",
  };
}

function parseIndianNumber(value: string): number | null {
  const digits = value.replace(/[^\d.]/g, "");
  if (!digits) {
    return null;
  }
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function parseNaukriTimestamp(
  value: number | string | null | undefined,
): Date | null {
  if (value == null) {
    return null;
  }

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value)
        : Number.NaN;
  if (!Number.isFinite(numeric)) {
    return null;
  }

  const timestampMs = numeric > 1e12 ? numeric : numeric * 1000;
  const date = new Date(timestampMs);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeJobId(value: NaukriApiJob["jobId"]): string | null {
  if (value == null) {
    return null;
  }
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function normalizeCompanyUrl(value: string | null | undefined): string | null {
  const normalized = nullIfEmpty(value);
  if (!normalized) {
    return null;
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  return `${NAUKRI_BASE_URL}/${normalized.replace(/^\/+/, "")}`;
}

function normalizeNaukriJobUrl(
  jdUrl: string | null | undefined,
  jobId: string | null,
): string {
  const normalized = nullIfEmpty(jdUrl);
  if (normalized) {
    if (/^https?:\/\//i.test(normalized)) {
      return normalized;
    }
    return `${NAUKRI_BASE_URL}${normalized.startsWith("/") ? "" : "/"}${normalized}`;
  }
  if (jobId) {
    return `${NAUKRI_BASE_URL}/job/${jobId}`;
  }
  return `${NAUKRI_BASE_URL}/jobs`;
}

function normalizeUrl(value: string | null | undefined): string | null {
  const normalized = nullIfEmpty(value);
  if (!normalized) {
    return null;
  }
  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }
  if (normalized.startsWith("//")) {
    return `https:${normalized}`;
  }
  if (normalized.startsWith("/")) {
    return `${NAUKRI_BASE_URL}${normalized}`;
  }
  return normalized;
}

function parseOptionalNumber(value: number | string | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function parseOptionalInteger(
  value: number | string | null | undefined,
): number | null {
  const parsed = parseOptionalNumber(value);
  return parsed == null ? null : Math.round(parsed);
}

function parseNaukriSkills(
  value: string | string[] | null | undefined,
): string[] | null {
  const skills = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const normalized = skills.map((skill) => skill.trim()).filter(Boolean);
  return normalized.length > 0 ? [...new Set(normalized)] : null;
}
