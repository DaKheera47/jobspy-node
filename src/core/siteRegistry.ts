import type { SiteScraper } from "./types";
import type { Site } from "../types";
import { siteScrapers } from "../sites";

export class SiteRegistry {
  private readonly scrapers: Map<Site, SiteScraper>;

  public constructor(initialScrapers?: Iterable<SiteScraper>) {
    this.scrapers = new Map();

    const defaults = initialScrapers ?? Object.values(siteScrapers);
    for (const scraper of defaults) {
      this.scrapers.set(scraper.site, scraper);
    }
  }

  public get(site: Site): SiteScraper | undefined {
    return this.scrapers.get(site);
  }

  public set(scraper: SiteScraper): void {
    this.scrapers.set(scraper.site, scraper);
  }
}

