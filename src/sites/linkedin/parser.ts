import { load, type CheerioAPI } from "cheerio";
import type { Element } from "domhandler";

import { htmlToMarkdown } from "../../core/html";
import { compactWhitespace, nullIfEmpty } from "../../core/text";
import type { JobPost, JobType } from "../../types";
import { LINKEDIN_BASE_URL } from "./constants";

export interface LinkedInSearchCardCandidate {
  jobId: string;
  jobUrl: string;
  title: string;
  company: string | null;
  companyUrl: string | null;
  location: JobPost["location"];
  datePosted: string | null;
  compensation: JobPost["compensation"];
}

export interface LinkedInDetailData {
  description?: string | null;
  jobLevel?: string | null;
  companyIndustry?: string | null;
  jobType?: JobType[] | null;
  jobUrlDirect?: string | null;
  companyLogo?: string | null;
  jobFunction?: string | null;
}

export function parseLinkedInSearchCards(html: string): LinkedInSearchCardCandidate[] {
  const $ = load(html);
  const cards: LinkedInSearchCardCandidate[] = [];

  $("div.base-search-card").each((_, element) => {
    const parsed = parseLinkedInSearchCard($, element);
    if (parsed) {
      cards.push(parsed);
    }
  });

  return cards;
}

export function parseLinkedInSearchCard(
  $: CheerioAPI,
  element: Element,
): LinkedInSearchCardCandidate | null {
  const card = $(element);
  const hrefRaw = card.find("a.base-card__full-link").attr("href");
  if (!hrefRaw) {
    return null;
  }

  const href = stripUrlQuery(hrefRaw);
  const jobIdMatch = href.match(/-(\d+)(?:\/)?$/);
  const jobId = jobIdMatch?.[1] ?? href.split("/").pop() ?? "";
  if (!jobId) {
    return null;
  }

  const title =
    card.find("span.sr-only").first().text().trim() ||
    card.find("h3.base-search-card__title").first().text().trim();
  if (!title) {
    return null;
  }

  const companyLink = card.find("h4.base-search-card__subtitle a").first();
  const company = nullIfEmpty(companyLink.text());
  const companyUrl = stripUrlQueryOrNull(companyLink.attr("href"));

  const locationText = compactWhitespace(
    card.find(".base-search-card__location").first().text(),
  );
  const location = parseLinkedInLocation(locationText);

  const datetimeRaw =
    card.find("time.job-search-card__listdate").attr("datetime") ??
    card.find("time.job-search-card__listdate--new").attr("datetime") ??
    null;
  const datePosted =
    datetimeRaw && Number.isFinite(Date.parse(datetimeRaw))
      ? new Date(datetimeRaw).toISOString()
      : null;

  const salaryText = compactWhitespace(
    card.find("span.job-search-card__salary-info").first().text(),
  );
  const compensation = parseLinkedInSalaryText(salaryText);

  return {
    jobId,
    jobUrl: `${LINKEDIN_BASE_URL}/jobs/view/${jobId}`,
    title,
    company,
    companyUrl,
    location,
    datePosted,
    compensation,
  };
}

export function parseLinkedInDetailPage(
  html: string,
  descriptionFormat: "markdown" | "html",
): LinkedInDetailData {
  const $ = load(html);

  const descriptionRoot = $("div[class*='show-more-less-html__markup']").first();
  const descriptionHtml = descriptionRoot.length > 0 ? descriptionRoot.html() : null;
  const description = descriptionHtml
    ? descriptionFormat === "html"
      ? descriptionRoot.toString()
      : htmlToMarkdown(descriptionRoot.toString())
    : null;

  const jobFunction = findCriteriaValueByLabel($, "Job function");
  const jobLevel = findCriteriaValueByLabel($, "Seniority level");
  const companyIndustry = findCriteriaValueByLabel($, "Industries");
  const jobTypeRaw = findCriteriaValueByLabel($, "Employment type");
  const jobType = mapLinkedInEmploymentType(jobTypeRaw);
  const companyLogo =
    $("img.artdeco-entity-image").first().attr("data-delayed-url") ??
    $("img.artdeco-entity-image").first().attr("src") ??
    null;

  const jobUrlDirect = parseApplyUrlCode($("code#applyUrl").first().html() ?? "");

  return {
    description,
    jobLevel: nullIfEmpty(jobLevel),
    companyIndustry: nullIfEmpty(companyIndustry),
    jobType,
    jobUrlDirect,
    companyLogo: nullIfEmpty(companyLogo),
    jobFunction: nullIfEmpty(jobFunction),
  };
}

export function parseLinkedInLocation(text: string): JobPost["location"] {
  const value = nullIfEmpty(text);
  if (!value) {
    return null;
  }

  const parts = value.split(",").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 1) {
    return {
      city: parts[0],
      state: null,
      country: null,
      display: value,
    };
  }

  if (parts.length === 2) {
    return {
      city: parts[0],
      state: parts[1],
      country: null,
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

export function inferLinkedInRemote(
  title: string,
  description: string | null | undefined,
  locationDisplay: string | null | undefined,
): boolean {
  const combined = `${title} ${description ?? ""} ${locationDisplay ?? ""}`.toLowerCase();
  return ["remote", "work from home", "wfh"].some((keyword) =>
    combined.includes(keyword),
  );
}

export function parseLinkedInSalaryText(
  salaryText: string | null | undefined,
): JobPost["compensation"] {
  const value = nullIfEmpty(salaryText);
  if (!value) {
    return null;
  }

  const parts = value.split("-").map((part) => part.trim()).filter(Boolean);
  if (parts.length < 2) {
    return null;
  }
  const [minPart, maxPart] = parts;
  if (!minPart || !maxPart) {
    return null;
  }

  const minAmount = parseSalaryNumber(minPart);
  const maxAmount = parseSalaryNumber(maxPart);
  if (minAmount == null || maxAmount == null) {
    return null;
  }

  const currency = value.startsWith("$") ? "USD" : value[0] ?? "USD";
  const interval = /hour|hr/i.test(value)
    ? "hourly"
    : /month/i.test(value)
      ? "monthly"
      : /week/i.test(value)
        ? "weekly"
        : /day/i.test(value)
          ? "daily"
          : "yearly";

  return {
    minAmount: Math.round(minAmount),
    maxAmount: Math.round(maxAmount),
    currency,
    interval,
    salarySource: "direct_data",
  };
}

function parseSalaryNumber(value: string): number | null {
  const normalized = value.replace(/,/g, "");
  const match = normalized.match(/(-?\d+(?:\.\d+)?)([kKmM])?/);
  if (!match) {
    return null;
  }

  let amount = Number(match[1]);
  if (!Number.isFinite(amount)) {
    return null;
  }

  const suffix = match[2]?.toLowerCase();
  if (suffix === "k") {
    amount *= 1_000;
  } else if (suffix === "m") {
    amount *= 1_000_000;
  }

  return amount;
}

function findCriteriaValueByLabel($: CheerioAPI, labelText: string): string | null {
  const h3 = $("h3.description__job-criteria-subheader")
    .toArray()
    .map((node) => $(node))
    .find((el) => el.text().trim().includes(labelText));

  if (!h3) {
    const genericH3 = $("h3")
      .toArray()
      .map((node) => $(node))
      .find((el) => el.text().trim().includes(labelText));
    if (!genericH3) {
      return null;
    }

    const span = genericH3
      .nextAll("span.description__job-criteria-text")
      .first();
    return nullIfEmpty(span.text());
  }

  const criteriaSpan = h3.nextAll("span.description__job-criteria-text").first();
  return nullIfEmpty(criteriaSpan.text());
}

function mapLinkedInEmploymentType(value: string | null): JobType[] | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase().replace(/[-\s]/g, "");
  const mapping: Record<string, JobType> = {
    fulltime: "fulltime",
    parttime: "parttime",
    internship: "internship",
    contract: "contract",
    temporary: "contract",
  };
  const mapped = mapping[normalized];
  return mapped ? [mapped] : null;
}

function parseApplyUrlCode(content: string): string | null {
  const match = content.match(/\?url=([^"]+)/);
  if (!match?.[1]) {
    return null;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function stripUrlQuery(value: string): string {
  try {
    const url = new URL(value, LINKEDIN_BASE_URL);
    url.search = "";
    return url.toString();
  } catch {
    return value.split("?")[0] ?? value;
  }
}

function stripUrlQueryOrNull(value: string | undefined): string | null {
  const normalized = value ? stripUrlQuery(value) : null;
  return nullIfEmpty(normalized);
}
