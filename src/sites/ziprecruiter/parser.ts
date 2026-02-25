import { load } from "cheerio";

import { htmlToMarkdown } from "../../core/html";
import { extractEmails, nullIfEmpty } from "../../core/text";
import type { JobPost, JobType } from "../../types";
import { ZIPRECRUITER_BASE_URL } from "./constants";

export interface ZipRecruiterApiJob {
  listing_key: string;
  name?: string | null;
  buyer_type?: string | null;
  job_description?: string | null;
  hiring_company?: { name?: string | null } | null;
  job_country?: string | null;
  job_city?: string | null;
  job_state?: string | null;
  employment_type?: string | null;
  posted_time?: string | null;
  compensation_interval?: string | null;
  compensation_min?: number | string | null;
  compensation_max?: number | string | null;
  compensation_currency?: string | null;
}

export function parseZipRecruiterJob(
  job: ZipRecruiterApiJob,
  descriptionFormat: "markdown" | "html",
): JobPost {
  const rawDescription = nullIfEmpty(job.job_description ?? null);
  const shortDescription = rawDescription
    ? descriptionFormat === "markdown"
      ? htmlToMarkdown(rawDescription)
      : rawDescription
    : null;

  const interval = normalizeZipRecruiterInterval(job.compensation_interval);
  const minAmount = parseOptionalNumber(job.compensation_min);
  const maxAmount = parseOptionalNumber(job.compensation_max);
  const compensation =
    interval || minAmount != null || maxAmount != null || job.compensation_currency
      ? {
          interval,
          minAmount,
          maxAmount,
          currency: job.compensation_currency ?? "USD",
          salarySource: "direct_data" as const,
        }
      : null;

  const postedTime = job.posted_time?.replace(/Z$/, "+00:00");
  const datePosted =
    postedTime && Number.isFinite(Date.parse(postedTime))
      ? new Date(postedTime).toISOString()
      : null;

  const jobType = mapZipRecruiterJobType(job.employment_type);
  const jobUrl = `${ZIPRECRUITER_BASE_URL}/jobs//j?lvk=${job.listing_key}`;

  return {
    id: `zr-${job.listing_key}`,
    site: "zip_recruiter",
    title: job.name ?? "Untitled role",
    company: job.hiring_company?.name ?? null,
    location: {
      city: job.job_city ?? null,
      state: job.job_state ?? null,
      country: normalizeCountry(job.job_country),
      display: [job.job_city, job.job_state, normalizeCountry(job.job_country)]
        .filter(Boolean)
        .join(", ") || null,
    },
    jobType,
    compensation,
    datePosted,
    jobUrl,
    description: shortDescription,
    emails: shortDescription ? extractEmails(shortDescription) : null,
    listingType: job.buyer_type ?? null,
    metadata: {},
  };
}

export function parseZipRecruiterDetailPage(
  html: string,
  descriptionFormat: "markdown" | "html",
): { description: string | null; directUrl: string | null } {
  const $ = load(html);
  const jobDescriptionHtml = $("div.job_description").first().toString();
  const companyDescriptionHtml = $("section.company_description").first().toString();

  const combinedHtml = `${jobDescriptionHtml}${companyDescriptionHtml}`.trim();
  const description =
    combinedHtml.length === 0
      ? null
      : descriptionFormat === "markdown"
        ? htmlToMarkdown(combinedHtml)
        : combinedHtml;

  let directUrl: string | null = null;
  try {
    $("script[type='application/json']").each((_, element) => {
      if (directUrl) {
        return;
      }
      const raw = $(element).text();
      if (!raw) {
        return;
      }
      const parsed = JSON.parse(raw) as { model?: { saveJobURL?: string } };
      const saveJobUrl = parsed.model?.saveJobURL ?? "";
      const match = saveJobUrl.match(/[?&]job_url=([^&]+)/);
      if (match?.[1]) {
        directUrl = decodeURIComponent(match[1]);
      }
    });
  } catch {
    directUrl = null;
  }

  return {
    description,
    directUrl,
  };
}

function normalizeZipRecruiterInterval(
  value: string | null | undefined,
): "yearly" | "monthly" | "weekly" | "daily" | "hourly" | null {
  if (!value) {
    return null;
  }
  if (value === "annual") {
    return "yearly" as const;
  }
  if (
    value === "hourly" ||
    value === "daily" ||
    value === "weekly" ||
    value === "monthly" ||
    value === "yearly"
  ) {
    return value;
  }
  return null;
}

function parseOptionalNumber(value: number | string | null | undefined): number | null {
  if (value == null) {
    return null;
  }
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

function mapZipRecruiterJobType(value: string | null | undefined): JobType[] | null {
  const normalized = (value ?? "").replaceAll("_", "").toLowerCase();
  const mapping: Record<string, JobType> = {
    fulltime: "fulltime",
    parttime: "parttime",
    internship: "internship",
    contract: "contract",
  };
  const mapped = mapping[normalized];
  return mapped ? [mapped] : null;
}

function normalizeCountry(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  if (value === "US") {
    return "USA";
  }
  if (value === "CA") {
    return "CANADA";
  }
  return value;
}
