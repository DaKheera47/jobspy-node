import { baytScraper } from "./bayt";
import { bdjobsScraper } from "./bdjobs";
import { glassdoorScraper } from "./glassdoor";
import { googleScraper } from "./google";
import type { SiteScraper } from "../core/types";
import type { Site } from "../types";
import { indeedScraper } from "./indeed";
import { linkedinScraper } from "./linkedin";
import { naukriScraper } from "./naukri";
import { zipRecruiterScraper } from "./ziprecruiter";

export const siteScrapers: Record<Site, SiteScraper> = {
  linkedin: linkedinScraper,
  indeed: indeedScraper,
  zip_recruiter: zipRecruiterScraper,
  glassdoor: glassdoorScraper,
  google: googleScraper,
  bayt: baytScraper,
  naukri: naukriScraper,
  bdjobs: bdjobsScraper,
};
