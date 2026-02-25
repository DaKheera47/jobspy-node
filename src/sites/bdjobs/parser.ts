import { load, type Cheerio, type CheerioAPI } from "cheerio";
import type { AnyNode, Element } from "domhandler";

import { htmlToMarkdown, htmlToText } from "../../core/html";
import { compactWhitespace, extractEmails, nullIfEmpty } from "../../core/text";
import type { JobPost, JobType } from "../../types";
import {
  BDJOBS_BASE_URL,
  BDJOBS_SEARCH_CARD_SELECTORS,
} from "./constants";

export interface BDJobsSearchCandidate {
  id: string;
  title: string;
  company: string | null;
  jobUrl: string;
  location: JobPost["location"];
  datePosted: string | null;
  isRemote: boolean;
}

export interface BDJobsDetailData {
  description: string | null;
  jobType: JobType[] | null;
  companyIndustry: string | null;
  emails: string[] | null;
}

export function parseBDJobsSearchPage(html: string): BDJobsSearchCandidate[] {
  const $ = load(html);
  const parsed: BDJobsSearchCandidate[] = [];
  const seenUrls = new Set<string>();

  for (const selector of BDJOBS_SEARCH_CARD_SELECTORS) {
    $(selector).each((_, element) => {
      const candidate = parseBDJobsSearchCard($, element);
      if (!candidate || seenUrls.has(candidate.jobUrl)) {
        return;
      }
      seenUrls.add(candidate.jobUrl);
      parsed.push(candidate);
    });
  }

  if (parsed.length === 0) {
    $("a[href]").each((_, anchor) => {
      const href = $(anchor).attr("href");
      if (!href || !/jobdetail/i.test(href)) {
        return;
      }
      const container = $(anchor).closest("div, article, li");
      const candidate = parseBDJobsSearchCard(
        $,
        container.length > 0 ? (container.get(0) ?? anchor) : anchor,
      );
      if (!candidate || seenUrls.has(candidate.jobUrl)) {
        return;
      }
      seenUrls.add(candidate.jobUrl);
      parsed.push(candidate);
    });
  }

  if (parsed.length === 0) {
    for (const candidate of parseBDJobsJsonLdJobs($)) {
      if (seenUrls.has(candidate.jobUrl)) {
        continue;
      }
      seenUrls.add(candidate.jobUrl);
      parsed.push(candidate);
    }
  }

  return parsed;
}

export function parseBDJobsSearchCard(
  $: CheerioAPI,
  element: AnyNode,
): BDJobsSearchCandidate | null {
  const card = $(element);
  const jobLink = findBDJobsJobLink(card);
  if (jobLink.length === 0) {
    return null;
  }

  const jobUrl = toAbsoluteUrl(jobLink.attr("href"));
  if (!jobUrl) {
    return null;
  }

  const title = nullIfEmpty(
    compactWhitespace(
      jobLink.text() ||
        card.find("[class*='job-title-text']").first().text() ||
        card.find("h2, h3, h4, strong").first().text(),
    ),
  );
  if (!title) {
    return null;
  }

  const company =
    findByClassKeywords(card, ["comp-name-text", "comp-name", "company", "org"])
      ?.text()
      ?.trim() ?? null;

  const locationText =
    nullIfEmpty(
      findByClassKeywords(card, ["locon-text-d", "location", "area", "locon"])
        ?.text()
        ?.trim() ??
        findLabelInlineValue(card, ["location"]),
    ) ?? "Dhaka, Bangladesh";
  const location = parseBDJobsLocation(locationText);

  const dateSource =
    findByClassKeywords(card, ["deadline", "published", "date"])?.text().trim() ??
    card.find("time").first().attr("datetime") ??
    null;
  const datePosted = parseBDJobsDate(dateSource);

  return {
    id: extractBDJobsId(jobUrl),
    title,
    company: nullIfEmpty(company),
    jobUrl,
    location,
    datePosted,
    isRemote: inferBDJobsRemote(title, location?.display ?? null),
  };
}

export function parseBDJobsDetailPage(
  html: string,
  descriptionFormat: "markdown" | "html",
): BDJobsDetailData {
  const $ = load(html);
  const descriptionHtml = extractBDJobsDescriptionHtml($);
  const description =
    descriptionHtml == null
      ? null
      : descriptionFormat === "html"
        ? descriptionHtml
        : htmlToMarkdown(descriptionHtml);

  const jobTypeRaw =
    findLabelValue($, ["employment status", "employment type", "job type"]) ?? null;
  const companyIndustry =
    findLabelValue($, ["industry", "company business", "company industry"]) ?? null;

  const emailText =
    descriptionFormat === "html" && description
      ? htmlToText(description)
      : description;
  const emails = extractEmails(emailText);

  return {
    description,
    jobType: mapBDJobsJobTypes(jobTypeRaw),
    companyIndustry: nullIfEmpty(companyIndustry),
    emails: emails.length > 0 ? emails : null,
  };
}

export function parseBDJobsLocation(text: string | null | undefined): JobPost["location"] {
  const value = nullIfEmpty(text);
  if (!value) {
    return null;
  }

  const parts = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const country =
    parts.find((part) => /bangladesh/i.test(part)) != null
      ? "Bangladesh"
      : parts.length >= 3
        ? (parts[parts.length - 1] ?? null)
        : "Bangladesh";

  if (parts.length === 1) {
    return {
      city: parts[0] ?? null,
      state: null,
      country,
      display: value,
    };
  }

  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const hasCountryAtEnd = last != null && /bangladesh/i.test(last);
    return {
      city: parts[0] ?? null,
      state: parts[1] ?? null,
      country: hasCountryAtEnd ? "Bangladesh" : country,
      display: value,
    };
  }

  return null;
}

export function parseBDJobsDate(value: string | null | undefined): string | null {
  const raw = nullIfEmpty(value);
  if (!raw) {
    return null;
  }

  if (Number.isFinite(Date.parse(raw))) {
    return new Date(raw).toISOString();
  }

  const normalized = raw
    .replace(/^(deadline|published|application deadline)\s*:?\s*/i, "")
    .trim();
  if (!normalized) {
    return null;
  }

  const numeric = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (numeric) {
    const day = Number(numeric[1]);
    const month = Number(numeric[2]) - 1;
    const year = Number(numeric[3]);
    return toIsoDateUtc(year, month, day);
  }

  const monthName = normalized.match(
    /^(\d{1,2})[\s-]+([A-Za-z]{3,9})[\s,/-]+(\d{4})$/,
  );
  if (monthName) {
    const day = Number(monthName[1]);
    const month = parseMonthIndex(monthName[2]);
    const year = Number(monthName[3]);
    if (month != null) {
      return toIsoDateUtc(year, month, day);
    }
  }

  const monthFirst = normalized.match(
    /^([A-Za-z]{3,9})[\s]+(\d{1,2}),[\s]*(\d{4})$/,
  );
  if (monthFirst) {
    const month = parseMonthIndex(monthFirst[1]);
    const day = Number(monthFirst[2]);
    const year = Number(monthFirst[3]);
    if (month != null) {
      return toIsoDateUtc(year, month, day);
    }
  }

  return null;
}

export function inferBDJobsRemote(
  title: string,
  locationDisplay?: string | null,
  description?: string | null,
): boolean {
  const combined = `${title} ${locationDisplay ?? ""} ${description ?? ""}`.toLowerCase();
  return ["remote", "work from home", "wfh", "home based", "hybrid"].some(
    (keyword) => combined.includes(keyword),
  );
}

function findBDJobsJobLink(card: Cheerio<AnyNode>): Cheerio<Element> {
  let jobLink = card
    .find("a[href*='jobdetail'], a[href*='jobDetail'], a[href*='jobdetails']")
    .first();
  if (jobLink.length === 0) {
    jobLink = card.find("a[href]").first();
  }
  return jobLink;
}

function extractBDJobsDescriptionHtml($: CheerioAPI): string | null {
  const jobContent = $("div.jobcontent").first();
  if (jobContent.length > 0) {
    const responsibilitiesHeading = jobContent
      .find("h3, h4, h5")
      .toArray()
      .find((node) => {
        const nodeRef = $(node);
        const text = compactWhitespace(nodeRef.text()).toLowerCase();
        return nodeRef.attr("id") === "job_resp" || text.includes("responsibilit");
      });

    if (responsibilitiesHeading) {
      const nodes: Element[] = [];
      let sibling = $(responsibilitiesHeading).next();
      while (sibling.length > 0) {
        const tagName = sibling.get(0)?.tagName?.toLowerCase();
        if (tagName === "hr" || /^h[1-6]$/.test(tagName ?? "")) {
          break;
        }
        const el = sibling.get(0);
        if (el) {
          nodes.push(el);
        }
        sibling = sibling.next();
      }

      if (nodes.length > 0) {
        const html = nodes
          .map((node) => $.html(node))
          .join("\n")
          .trim();
        if (html) {
          return html;
        }
      }
    }
  }

  const fallback = $(
    [
      "div.jobcontent",
      "div[class*='job-description']",
      "section[class*='job-description']",
      "div[class*='details']",
      "section[class*='details']",
      "div[class*='requirements']",
    ].join(", "),
  ).first();

  if (fallback.length === 0) {
    return null;
  }

  fallback.find("script, style, noscript").remove();
  const html = fallback.toString().trim();
  return html.length > 0 ? html : null;
}

function findLabelValue($: CheerioAPI, labels: string[]): string | null {
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  const nodes = $("h1,h2,h3,h4,h5,h6,dt,th,span,div,strong,label,p")
    .toArray()
    .slice(0, 800);

  for (const node of nodes) {
    const el = $(node);
    const text = compactWhitespace(el.text());
    if (!text) {
      continue;
    }
    const lower = text.toLowerCase();

    const matchedLabel = normalizedLabels.find((label) => lower.includes(label));
    if (!matchedLabel) {
      continue;
    }

    const inlineValue = extractInlineLabelValue(text, matchedLabel);
    if (inlineValue) {
      return inlineValue;
    }

    const nextSibling = el.nextAll("div,span,p,dd,td,li").first();
    const nextText = nullIfEmpty(compactWhitespace(nextSibling.text()));
    if (nextText && !normalizedLabels.some((label) => nextText.toLowerCase().includes(label))) {
      return nextText;
    }

    const parent = el.parent();
    if (parent.length > 0) {
      const children = parent.children().toArray();
      const index = children.findIndex((child) => child === node);
      if (index >= 0 && index < children.length - 1) {
        const siblingNode = children[index + 1];
        if (siblingNode) {
          const siblingText = nullIfEmpty(
            compactWhitespace($(siblingNode).text()),
          );
          if (
            siblingText &&
            !normalizedLabels.some((label) => siblingText.toLowerCase().includes(label))
          ) {
            return siblingText;
          }
        }
      }
    }
  }

  return null;
}

function extractInlineLabelValue(text: string, label: string): string | null {
  const normalized = text.trim();
  const lower = normalized.toLowerCase();
  const labelIndex = lower.indexOf(label);
  if (labelIndex < 0) {
    return null;
  }
  const tail = normalized.slice(labelIndex + label.length);
  const value = tail.replace(/^[\s:|-]+/, "");
  return nullIfEmpty(value);
}

function findLabelInlineValue(
  card: Cheerio<AnyNode>,
  labels: string[],
): string | null {
  const normalizedLabels = labels.map((label) => label.toLowerCase());
  const text = compactWhitespace(card.text());
  for (const label of normalizedLabels) {
    const value = extractInlineLabelValue(text, label);
    if (value) {
      return value;
    }
  }
  return null;
}

function findByClassKeywords(
  card: Cheerio<AnyNode>,
  keywords: string[],
): Cheerio<Element> | null {
  const found = card
    .find("div, span, p")
    .filter((_, node) => {
      const className = (node.attribs?.class ?? "").toLowerCase();
      return keywords.some((keyword) => className.includes(keyword.toLowerCase()));
    })
    .first();

  return found.length > 0 ? found : null;
}

function parseBDJobsJsonLdJobs($: CheerioAPI): BDJobsSearchCandidate[] {
  const jobs: BDJobsSearchCandidate[] = [];

  $("script[type='application/ld+json']").each((_, element) => {
    const raw = $(element).text();
    if (!raw.trim()) {
      return;
    }

    const parsed = parseJson(raw);
    if (!parsed) {
      return;
    }

    for (const node of flattenJsonLdNodes(parsed)) {
      const type = typeof node["@type"] === "string" ? node["@type"] : "";
      if (!/JobPosting/i.test(type)) {
        continue;
      }

      const title = nullIfEmpty(String(node.title ?? node.name ?? ""));
      const url = toAbsoluteUrl(
        typeof node.url === "string" ? node.url : undefined,
      );
      if (!title || !url) {
        continue;
      }

      const company =
        typeof node.hiringOrganization === "object" &&
        node.hiringOrganization != null &&
        typeof (node.hiringOrganization as { name?: unknown }).name === "string"
          ? nullIfEmpty(String((node.hiringOrganization as { name?: unknown }).name))
          : null;

      const locationText =
        typeof node.jobLocation === "object" && node.jobLocation != null
          ? stringifyJsonLdLocation(node.jobLocation as Record<string, unknown>)
          : null;
      const location = parseBDJobsLocation(locationText);

      jobs.push({
        id: extractBDJobsId(url),
        title,
        company,
        jobUrl: url,
        location,
        datePosted: parseBDJobsDate(
          typeof node.datePosted === "string" ? node.datePosted : null,
        ),
        isRemote: inferBDJobsRemote(title, location?.display ?? null),
      });
    }
  });

  return jobs;
}

function flattenJsonLdNodes(value: unknown): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((item) => flattenJsonLdNodes(item));
  }

  const record = value as Record<string, unknown>;
  const nodes: Array<Record<string, unknown>> = [record];

  if (record["@graph"]) {
    nodes.push(...flattenJsonLdNodes(record["@graph"]));
  }
  if (record.itemListElement) {
    nodes.push(...flattenJsonLdNodes(record.itemListElement));
  }

  return nodes;
}

function stringifyJsonLdLocation(location: Record<string, unknown>): string | null {
  const address =
    typeof location.address === "object" && location.address != null
      ? (location.address as Record<string, unknown>)
      : location;
  const parts = [
    typeof address.addressLocality === "string" ? address.addressLocality : null,
    typeof address.addressRegion === "string" ? address.addressRegion : null,
    typeof address.addressCountry === "string" ? address.addressCountry : null,
  ].filter((part): part is string => Boolean(part && part.trim()));

  return parts.length > 0 ? parts.join(", ") : null;
}

function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

function mapBDJobsJobTypes(value: string | null | undefined): JobType[] | null {
  const normalized = (value ?? "").toLowerCase();
  if (!normalized) {
    return null;
  }

  const found = new Set<JobType>();
  if (/full[\s-]*time/.test(normalized)) {
    found.add("fulltime");
  }
  if (/part[\s-]*time/.test(normalized)) {
    found.add("parttime");
  }
  if (/intern/.test(normalized)) {
    found.add("internship");
  }
  if (/contract|contractual/.test(normalized)) {
    found.add("contract");
  }

  return found.size > 0 ? [...found] : null;
}

function extractBDJobsId(jobUrl: string): string {
  try {
    const url = new URL(jobUrl);
    const queryId = url.searchParams.get("jobid") ?? url.searchParams.get("id");
    if (queryId) {
      return `bdjobs-${queryId}`;
    }
  } catch {
    // Fall back to regex-based extraction below.
  }

  const match = jobUrl.match(/(?:jobid|id)=([0-9]+)/i) ?? jobUrl.match(/([0-9]{4,})/);
  if (match?.[1]) {
    return `bdjobs-${match[1]}`;
  }
  return `bdjobs-${stableHash(jobUrl)}`;
}

function toAbsoluteUrl(value: string | undefined): string | null {
  const href = nullIfEmpty(value);
  if (!href) {
    return null;
  }
  try {
    return new URL(href, BDJOBS_BASE_URL).toString();
  } catch {
    return null;
  }
}

function toIsoDateUtc(year: number, monthIndex: number, day: number): string | null {
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(monthIndex) ||
    !Number.isFinite(day) ||
    monthIndex < 0 ||
    monthIndex > 11 ||
    day < 1 ||
    day > 31
  ) {
    return null;
  }

  return new Date(Date.UTC(year, monthIndex, day)).toISOString();
}

function parseMonthIndex(value: string | undefined): number | null {
  const month = (value ?? "").trim().toLowerCase();
  const lookup: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    apr: 3,
    april: 3,
    may: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
  };
  const found = lookup[month];
  return found ?? null;
}

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash >>> 0).toString(36);
}
