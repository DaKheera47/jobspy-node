import { glassdoorScraper } from "./glassdoor";
import type { SiteScraper } from "../core/types";
import type { Site } from "../types";
import { indeedScraper } from "./indeed";
import { linkedinScraper } from "./linkedin";
import { naukriScraper } from "./naukri";

export const siteScrapers: Record<Site, SiteScraper> = {
  linkedin: linkedinScraper,
  indeed: indeedScraper,
  glassdoor: glassdoorScraper,
  naukri: naukriScraper,
};
