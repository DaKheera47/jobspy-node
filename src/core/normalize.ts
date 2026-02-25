import { DEFAULT_SITES, DEFAULTS } from "../config/defaults";
import type {
  JobPost,
  NormalizedScrapeJobsInput,
  ScrapeJobsInput,
  Site,
} from "../types";
import { DescriptionFormatSchema, ScrapeJobsInputSchema } from "../types";
import { annualizeCompensation, extractUsdSalaryFromDescription } from "./salary";
import { extractEmails, nullIfEmpty } from "./text";

export function normalizeInput(input: ScrapeJobsInput = {}): NormalizedScrapeJobsInput {
  const parsed = ScrapeJobsInputSchema.parse(input);
  const requestedSites = parsed.siteName
    ? Array.isArray(parsed.siteName)
      ? parsed.siteName
      : [parsed.siteName]
    : DEFAULT_SITES;
  const uniqueSites = [...new Set(requestedSites)] as Site[];

  const resultsWanted = parsed.resultsWanted ?? DEFAULTS.resultsWanted;
  const maxConcurrency = Math.max(
    1,
    Math.min(
      parsed.maxConcurrency ?? uniqueSites.length,
      DEFAULTS.maxConcurrencyCap,
      uniqueSites.length || 1,
    ),
  );

  return {
    siteName: uniqueSites,
    searchTerm: parsed.searchTerm,
    location: parsed.location,
    distance: parsed.distance ?? DEFAULTS.distance,
    isRemote: parsed.isRemote ?? DEFAULTS.isRemote,
    jobType: parsed.jobType,
    easyApply: parsed.easyApply,
    resultsWanted,
    countryIndeed: (parsed.countryIndeed ?? DEFAULTS.countryIndeed).toUpperCase(),
    proxies: parsed.proxies,
    caCert: parsed.caCert,
    descriptionFormat:
      parsed.descriptionFormat ??
      DescriptionFormatSchema.parse(DEFAULTS.descriptionFormat),
    linkedinFetchDescription:
      parsed.linkedinFetchDescription ?? DEFAULTS.linkedinFetchDescription,
    linkedinCompanyIds: parsed.linkedinCompanyIds,
    offset: parsed.offset ?? DEFAULTS.offset,
    hoursOld: parsed.hoursOld,
    enforceAnnualSalary:
      parsed.enforceAnnualSalary ?? DEFAULTS.enforceAnnualSalary,
    verbose: parsed.verbose ?? DEFAULTS.verbose,
    userAgent: parsed.userAgent,
    timeoutMs: parsed.timeoutMs ?? DEFAULTS.timeoutMs,
    maxConcurrency,
    strict: parsed.strict ?? DEFAULTS.strict,
  };
}

export function normalizeJobPost(
  job: JobPost,
  input: NormalizedScrapeJobsInput,
): JobPost {
  const normalizedDescription = nullIfEmpty(job.description);
  const compensation =
    job.compensation == null
      ? input.countryIndeed === "USA"
        ? extractUsdSalaryFromDescription(normalizedDescription, {
            enforceAnnualSalary: input.enforceAnnualSalary,
          })
        : undefined
      : input.enforceAnnualSalary
        ? annualizeCompensation(job.compensation)
        : job.compensation;

  const emails = job.emails && job.emails.length > 0
    ? [...new Set(job.emails)]
    : extractEmails(normalizedDescription);

  const salarySource = compensation?.minAmount ? compensation.salarySource : null;

  return {
    ...job,
    title: job.title.trim(),
    company: nullIfEmpty(job.company),
    description: normalizedDescription,
    descriptionFormat: job.description ? input.descriptionFormat : job.descriptionFormat,
    compensation:
      compensation && compensation.minAmount
        ? { ...compensation, salarySource }
        : null,
    emails: emails.length > 0 ? emails : null,
    location: job.location
      ? {
          ...job.location,
          city: nullIfEmpty(job.location.city),
          state: nullIfEmpty(job.location.state),
          country: nullIfEmpty(job.location.country),
          display:
            nullIfEmpty(job.location.display) ??
            (([job.location.city, job.location.state, job.location.country]
              .map((value) => value?.trim())
              .filter(Boolean)
              .join(", ") as string) || null),
        }
      : null,
    metadata: job.metadata ?? {},
  };
}

export function sortJobs(jobs: JobPost[]): JobPost[] {
  return [...jobs].sort((a, b) => {
    if (a.site !== b.site) {
      return a.site.localeCompare(b.site);
    }

    const aDate = a.datePosted ? Date.parse(a.datePosted) : Number.NaN;
    const bDate = b.datePosted ? Date.parse(b.datePosted) : Number.NaN;
    const aValid = Number.isFinite(aDate);
    const bValid = Number.isFinite(bDate);
    if (aValid && bValid && aDate !== bDate) {
      return bDate - aDate;
    }
    if (aValid !== bValid) {
      return aValid ? -1 : 1;
    }

    return a.title.localeCompare(b.title);
  });
}
