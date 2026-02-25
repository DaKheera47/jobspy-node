import type { JobPost, JobType } from "../../types";
import { htmlToMarkdown, htmlToText } from "../../core/html";
import { extractEmails } from "../../core/text";

interface IndeedAttribute {
  key?: string;
  label?: string;
}

interface IndeedLocation {
  countryCode?: string | null;
  city?: string | null;
  admin1Code?: string | null;
  formatted?: {
    long?: string | null;
    short?: string | null;
  } | null;
}

interface IndeedSalaryRange {
  min?: number | null;
  max?: number | null;
}

interface IndeedBaseSalary {
  unitOfWork?: string | null;
  range?: IndeedSalaryRange | null;
}

interface IndeedCompensationNode {
  estimated?: {
    currencyCode?: string | null;
    baseSalary?: IndeedBaseSalary | null;
  } | null;
  baseSalary?: IndeedBaseSalary | null;
  currencyCode?: string | null;
}

interface IndeedEmployer {
  relativeCompanyPageUrl?: string | null;
  name?: string | null;
  dossier?: {
    employerDetails?: {
      addresses?: string[] | null;
      industry?: string | null;
      employeesLocalizedLabel?: string | null;
      revenueLocalizedLabel?: string | null;
      briefDescription?: string | null;
      ceoName?: string | null;
      ceoPhotoUrl?: string | null;
    } | null;
    images?: {
      headerImageUrl?: string | null;
      squareLogoUrl?: string | null;
    } | null;
    links?: {
      corporateWebsite?: string | null;
    } | null;
  } | null;
}

export interface IndeedJobPayload {
  key: string;
  title: string;
  datePublished?: number | null;
  description?: { html?: string | null } | null;
  location?: IndeedLocation | null;
  compensation?: IndeedCompensationNode | null;
  attributes?: IndeedAttribute[] | null;
  employer?: IndeedEmployer | null;
  recruit?: {
    viewJobUrl?: string | null;
    detailedSalary?: string | null;
    workSchedule?: string | null;
  } | null;
  source?: { name?: string | null } | null;
}

export interface ParseIndeedJobOptions {
  baseUrl: string;
  descriptionFormat: "markdown" | "html";
}

const INDEED_ATTRIBUTE_TO_JOB_TYPE: Record<string, JobType> = {
  fulltime: "fulltime",
  parttime: "parttime",
  internship: "internship",
  contract: "contract",
};

const INDEED_INTERVAL_MAP = {
  DAY: "daily",
  YEAR: "yearly",
  HOUR: "hourly",
  WEEK: "weekly",
  MONTH: "monthly",
} as const;

export function parseIndeedJob(
  job: IndeedJobPayload,
  options: ParseIndeedJobOptions,
): JobPost {
  const descriptionHtml = job.description?.html ?? null;
  const description =
    descriptionHtml == null
      ? null
      : options.descriptionFormat === "html"
        ? descriptionHtml
        : htmlToMarkdown(descriptionHtml);

  const employer = job.employer ?? undefined;
  const dossier = employer?.dossier ?? undefined;
  const employerDetails = dossier?.employerDetails ?? undefined;
  const location = job.location ?? undefined;
  const companyUrl = employer?.relativeCompanyPageUrl
    ? `${options.baseUrl}${employer.relativeCompanyPageUrl}`
    : null;
  const jobUrl = `${options.baseUrl}/viewjob?jk=${job.key}`;
  const datePosted =
    typeof job.datePublished === "number"
      ? new Date(job.datePublished).toISOString()
      : null;

  const parsed: JobPost = {
    id: `in-${job.key}`,
    site: "indeed",
    title: job.title,
    company: employer?.name ?? null,
    companyUrl,
    jobUrl,
    jobUrlDirect: job.recruit?.viewJobUrl ?? null,
    description,
    location: location
      ? {
          city: location.city ?? null,
          state: location.admin1Code ?? null,
          country: location.countryCode ?? null,
          display: location.formatted?.long ?? null,
        }
      : null,
    jobType: parseIndeedJobTypes(job.attributes ?? []),
    compensation: parseIndeedCompensation(job.compensation ?? undefined),
    datePosted,
    emails: description ? extractEmails(options.descriptionFormat === "html" ? htmlToText(description) : description) : null,
    isRemote: isIndeedRemote(job, descriptionHtml, location),
    companyIndustry: normalizeIndustry(employerDetails?.industry),
    companyLogo: dossier?.images?.squareLogoUrl ?? null,
    externalApplyUrl: job.recruit?.viewJobUrl ?? null,
    metadata: {
      sourceName: job.source?.name ?? null,
      recruit: job.recruit ?? null,
      employerDetails: employerDetails ?? null,
      companyWebsite: dossier?.links?.corporateWebsite ?? null,
      headerImageUrl: dossier?.images?.headerImageUrl ?? null,
      companyAddresses: employerDetails?.addresses ?? null,
      companyEmployeesLabel: employerDetails?.employeesLocalizedLabel ?? null,
      companyRevenueLabel: employerDetails?.revenueLocalizedLabel ?? null,
      companyBriefDescription: employerDetails?.briefDescription ?? null,
      companyCeoName: employerDetails?.ceoName ?? null,
      companyCeoPhotoUrl: employerDetails?.ceoPhotoUrl ?? null,
    },
  };

  return parsed;
}

export function parseIndeedJobTypes(attributes: IndeedAttribute[]): JobType[] | null {
  const found = attributes
    .map((attribute) => attribute.label ?? "")
    .map((label) => label.replace(/[-\s]/g, "").toLowerCase())
    .map((label) => INDEED_ATTRIBUTE_TO_JOB_TYPE[label])
    .filter((value): value is JobType => Boolean(value));

  return found.length > 0 ? [...new Set(found)] : null;
}

export function parseIndeedCompensation(
  compensation: IndeedCompensationNode | undefined,
): JobPost["compensation"] {
  if (!compensation) {
    return null;
  }

  const base = compensation.baseSalary ?? compensation.estimated?.baseSalary;
  if (!base?.unitOfWork || !base.range) {
    return null;
  }

  const interval = INDEED_INTERVAL_MAP[base.unitOfWork.toUpperCase() as keyof typeof INDEED_INTERVAL_MAP];
  if (!interval) {
    return null;
  }

  const minAmount =
    typeof base.range.min === "number" ? Math.round(base.range.min) : null;
  const maxAmount =
    typeof base.range.max === "number" ? Math.round(base.range.max) : null;

  return {
    interval,
    minAmount,
    maxAmount,
    currency: compensation.estimated?.currencyCode ?? compensation.currencyCode ?? "USD",
    salarySource: "direct_data",
  };
}

export function isIndeedRemote(
  job: Pick<IndeedJobPayload, "attributes">,
  descriptionHtml: string | null | undefined,
  location: IndeedLocation | undefined,
): boolean {
  const remoteKeywords = ["remote", "work from home", "wfh"];
  const attributeText = (job.attributes ?? [])
    .map((attribute) => attribute.label ?? "")
    .join(" ")
    .toLowerCase();
  const descriptionText = descriptionHtml ? htmlToText(descriptionHtml).toLowerCase() : "";
  const locationText = location?.formatted?.long?.toLowerCase() ?? "";
  return remoteKeywords.some(
    (keyword) =>
      attributeText.includes(keyword) ||
      descriptionText.includes(keyword) ||
      locationText.includes(keyword),
  );
}

function normalizeIndustry(industry: string | null | undefined): string | null {
  if (!industry) {
    return null;
  }

  return industry.replace("Iv1", "").replaceAll("_", " ").trim() || null;
}

