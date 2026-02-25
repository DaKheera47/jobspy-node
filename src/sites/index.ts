import type { SiteScraper } from "../core/types";
import type { NormalizedScrapeJobsInput, Site } from "../types";

function createNotImplementedScraper(site: Site): SiteScraper {
  return {
    site,
    validateInput: (_input: NormalizedScrapeJobsInput) => {
      void _input;
      return [];
    },
    async scrape() {
      throw new Error(`${site} scraper is not implemented yet`);
    },
  };
}

export const siteScrapers: Record<Site, SiteScraper> = {
  linkedin: createNotImplementedScraper("linkedin"),
  indeed: createNotImplementedScraper("indeed"),
  zip_recruiter: createNotImplementedScraper("zip_recruiter"),
  glassdoor: createNotImplementedScraper("glassdoor"),
  google: createNotImplementedScraper("google"),
  bayt: createNotImplementedScraper("bayt"),
  naukri: createNotImplementedScraper("naukri"),
  bdjobs: createNotImplementedScraper("bdjobs"),
};

