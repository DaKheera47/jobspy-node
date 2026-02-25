import type { SiteScraper } from "../core/types";
import type { NormalizedScrapeJobsInput, Site } from "../types";
import { indeedScraper } from "./indeed";
import { linkedinScraper } from "./linkedin";
import { zipRecruiterScraper } from "./ziprecruiter";

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
  linkedin: linkedinScraper,
  indeed: indeedScraper,
  zip_recruiter: zipRecruiterScraper,
  glassdoor: createNotImplementedScraper("glassdoor"),
  google: createNotImplementedScraper("google"),
  bayt: createNotImplementedScraper("bayt"),
  naukri: createNotImplementedScraper("naukri"),
  bdjobs: createNotImplementedScraper("bdjobs"),
};
