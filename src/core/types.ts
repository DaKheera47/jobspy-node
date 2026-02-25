import type { HttpClient } from "./httpClient";
import type { ProxyPool } from "./proxyPool";
import type { JobPost, NormalizedScrapeJobsInput, Site } from "../types";

export interface SiteScraperResult {
  jobs: JobPost[];
  warnings?: string[];
}

export interface ScrapeContext {
  http: HttpClient;
  proxyPool: ProxyPool;
  now: () => Date;
}

export interface SiteScraper {
  site: Site;
  validateInput?: (input: NormalizedScrapeJobsInput) => string[];
  scrape: (
    input: NormalizedScrapeJobsInput,
    context: ScrapeContext,
  ) => Promise<SiteScraperResult>;
}

