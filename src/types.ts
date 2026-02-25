import { z } from "zod";

export const SITE_VALUES = [
  "linkedin",
  "indeed",
  "zip_recruiter",
  "glassdoor",
  "google",
  "bayt",
  "naukri",
  "bdjobs",
] as const;

export type Site = (typeof SITE_VALUES)[number];

export const JOB_TYPE_VALUES = [
  "fulltime",
  "parttime",
  "internship",
  "contract",
] as const;

export type JobType = (typeof JOB_TYPE_VALUES)[number];

export const COMPENSATION_INTERVAL_VALUES = [
  "yearly",
  "monthly",
  "weekly",
  "daily",
  "hourly",
] as const;

export type CompensationInterval = (typeof COMPENSATION_INTERVAL_VALUES)[number];

export const SALARY_SOURCE_VALUES = ["direct_data", "description"] as const;

export type SalarySource = (typeof SALARY_SOURCE_VALUES)[number];

export type DescriptionFormat = "markdown" | "html";

export interface Location {
  country?: string | null;
  city?: string | null;
  state?: string | null;
  display?: string | null;
}

export interface Compensation {
  interval?: CompensationInterval | null;
  minAmount?: number | null;
  maxAmount?: number | null;
  currency?: string | null;
  salarySource?: SalarySource | null;
}

export interface JobPost {
  id?: string | null;
  site: Site;
  title: string;
  company: string | null;
  companyUrl?: string | null;
  companyLogo?: string | null;
  companyIndustry?: string | null;
  companyRating?: number | null;
  companyReviewsCount?: number | null;
  vacancyCount?: number | null;
  jobUrl: string;
  jobUrlDirect?: string | null;
  location?: Location | null;
  isRemote?: boolean | null;
  workFromHomeType?: string | null;
  description?: string | null;
  descriptionFormat?: DescriptionFormat;
  jobType?: JobType[] | null;
  jobLevel?: string | null;
  jobFunction?: string | null;
  skills?: string[] | null;
  experienceRange?: string | null;
  compensation?: Compensation | null;
  datePosted?: string | null;
  emails?: string[] | null;
  listingType?: string | null;
  externalApplyUrl?: string | null;
  metadata?: Record<string, unknown>;
}

export type SiteScrapeErrorCode =
  | "RATE_LIMITED"
  | "BLOCKED"
  | "NETWORK_ERROR"
  | "PARSER_ERROR"
  | "INVALID_INPUT"
  | "UNSUPPORTED_COMBINATION"
  | "TIMEOUT"
  | "UNKNOWN";

export interface SiteScrapeError {
  site: Site;
  code: SiteScrapeErrorCode;
  message: string;
  retriable: boolean;
  statusCode?: number;
  cause?: unknown;
}

export interface SiteScrapeMeta {
  site: Site;
  requested: number;
  returned: number;
  durationMs: number;
  warnings: string[];
}

export interface ScrapeJobsInput {
  siteName?: Site | Site[];
  searchTerm?: string;
  googleSearchTerm?: string;
  location?: string;
  distance?: number;
  isRemote?: boolean;
  jobType?: JobType;
  easyApply?: boolean;
  resultsWanted?: number;
  countryIndeed?: string;
  proxies?: string | string[];
  caCert?: string;
  descriptionFormat?: DescriptionFormat;
  linkedinFetchDescription?: boolean;
  linkedinCompanyIds?: number[];
  offset?: number;
  hoursOld?: number;
  enforceAnnualSalary?: boolean;
  verbose?: number;
  userAgent?: string;
  timeoutMs?: number;
  maxConcurrency?: number;
  strict?: boolean;
}

export interface NormalizedScrapeJobsInput {
  siteName: Site[];
  searchTerm?: string;
  googleSearchTerm?: string;
  location?: string;
  distance: number;
  isRemote: boolean;
  jobType?: JobType;
  easyApply?: boolean;
  resultsWanted: number;
  countryIndeed: string;
  proxies?: string | string[];
  caCert?: string;
  descriptionFormat: DescriptionFormat;
  linkedinFetchDescription: boolean;
  linkedinCompanyIds?: number[];
  offset: number;
  hoursOld?: number;
  enforceAnnualSalary: boolean;
  verbose: number;
  userAgent?: string;
  timeoutMs?: number;
  maxConcurrency: number;
  strict: boolean;
}

export interface ScrapeJobsResultMeta {
  startedAt: string;
  endedAt: string;
  durationMs: number;
  partial: boolean;
  sitesRequested: Site[];
  sitesSucceeded: Site[];
  sitesFailed: Site[];
  perSite: SiteScrapeMeta[];
  warnings: string[];
}

export interface ScrapeJobsResult {
  jobs: JobPost[];
  errors: SiteScrapeError[];
  meta: ScrapeJobsResultMeta;
}

export const SiteSchema = z.enum(SITE_VALUES);
export const JobTypeSchema = z.enum(JOB_TYPE_VALUES);
export const CompensationIntervalSchema = z.enum(COMPENSATION_INTERVAL_VALUES);
export const SalarySourceSchema = z.enum(SALARY_SOURCE_VALUES);
export const DescriptionFormatSchema = z.enum(["markdown", "html"]);

export const LocationSchema = z.object({
  country: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  display: z.string().nullable().optional(),
});

export const CompensationSchema = z.object({
  interval: CompensationIntervalSchema.nullable().optional(),
  minAmount: z.number().finite().nullable().optional(),
  maxAmount: z.number().finite().nullable().optional(),
  currency: z.string().nullable().optional(),
  salarySource: SalarySourceSchema.nullable().optional(),
});

export const JobPostSchema = z.object({
  id: z.string().nullable().optional(),
  site: SiteSchema,
  title: z.string(),
  company: z.string().nullable(),
  companyUrl: z.string().url().nullable().optional(),
  companyLogo: z.string().url().nullable().optional(),
  companyIndustry: z.string().nullable().optional(),
  companyRating: z.number().finite().nullable().optional(),
  companyReviewsCount: z.number().finite().nullable().optional(),
  vacancyCount: z.number().finite().nullable().optional(),
  jobUrl: z.string().url(),
  jobUrlDirect: z.string().url().nullable().optional(),
  location: LocationSchema.nullable().optional(),
  isRemote: z.boolean().nullable().optional(),
  workFromHomeType: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  descriptionFormat: DescriptionFormatSchema.optional(),
  jobType: z.array(JobTypeSchema).nullable().optional(),
  jobLevel: z.string().nullable().optional(),
  jobFunction: z.string().nullable().optional(),
  skills: z.array(z.string()).nullable().optional(),
  experienceRange: z.string().nullable().optional(),
  compensation: CompensationSchema.nullable().optional(),
  datePosted: z.string().datetime({ offset: true }).nullable().optional(),
  emails: z.array(z.string().email()).nullable().optional(),
  listingType: z.string().nullable().optional(),
  externalApplyUrl: z.string().url().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const SiteScrapeErrorSchema = z.object({
  site: SiteSchema,
  code: z.enum([
    "RATE_LIMITED",
    "BLOCKED",
    "NETWORK_ERROR",
    "PARSER_ERROR",
    "INVALID_INPUT",
    "UNSUPPORTED_COMBINATION",
    "TIMEOUT",
    "UNKNOWN",
  ]),
  message: z.string(),
  retriable: z.boolean(),
  statusCode: z.number().int().optional(),
  cause: z.unknown().optional(),
});

export const SiteScrapeMetaSchema = z.object({
  site: SiteSchema,
  requested: z.number().int().nonnegative(),
  returned: z.number().int().nonnegative(),
  durationMs: z.number().nonnegative(),
  warnings: z.array(z.string()),
});

export const ScrapeJobsInputSchema = z.object({
  siteName: z.union([SiteSchema, z.array(SiteSchema)]).optional(),
  searchTerm: z.string().optional(),
  googleSearchTerm: z.string().optional(),
  location: z.string().optional(),
  distance: z.number().int().nonnegative().optional(),
  isRemote: z.boolean().optional(),
  jobType: JobTypeSchema.optional(),
  easyApply: z.boolean().optional(),
  resultsWanted: z.number().int().positive().optional(),
  countryIndeed: z.string().optional(),
  proxies: z.union([z.string(), z.array(z.string())]).optional(),
  caCert: z.string().optional(),
  descriptionFormat: DescriptionFormatSchema.optional(),
  linkedinFetchDescription: z.boolean().optional(),
  linkedinCompanyIds: z.array(z.number().int()).optional(),
  offset: z.number().int().nonnegative().optional(),
  hoursOld: z.number().int().positive().optional(),
  enforceAnnualSalary: z.boolean().optional(),
  verbose: z.number().int().nonnegative().optional(),
  userAgent: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
  maxConcurrency: z.number().int().positive().optional(),
  strict: z.boolean().optional(),
});

export const ScrapeJobsResultSchema = z.object({
  jobs: z.array(JobPostSchema),
  errors: z.array(SiteScrapeErrorSchema),
  meta: z.object({
    startedAt: z.string().datetime({ offset: true }),
    endedAt: z.string().datetime({ offset: true }),
    durationMs: z.number().nonnegative(),
    partial: z.boolean(),
    sitesRequested: z.array(SiteSchema),
    sitesSucceeded: z.array(SiteSchema),
    sitesFailed: z.array(SiteSchema),
    perSite: z.array(SiteScrapeMetaSchema),
    warnings: z.array(z.string()),
  }),
});
