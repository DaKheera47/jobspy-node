import type { NormalizedScrapeJobsInput, Site } from "../types";
import { SITE_VALUES } from "../types";

export const DEFAULT_SITES = [...SITE_VALUES] satisfies Site[];

export const DEFAULTS = {
  distance: 50,
  isRemote: false,
  resultsWanted: 15,
  countryIndeed: "USA",
  descriptionFormat: "markdown",
  linkedinFetchDescription: false,
  offset: 0,
  enforceAnnualSalary: false,
  verbose: 0,
  strict: false,
  timeoutMs: 30_000,
  maxConcurrencyCap: 4,
} as const satisfies Partial<NormalizedScrapeJobsInput> & {
  maxConcurrencyCap: number;
};

