import { sleep } from "../../core/retry";
import type { SiteScraper } from "../../core/types";
import type { JobPost } from "../../types";
import { BAYT_DELAY_BAND_MS, BAYT_DELAY_MS } from "./constants";
import { fetchBaytSearchPage } from "./client";
import { parseBaytSearchPage } from "./parser";

export const baytScraper: SiteScraper = {
  site: "bayt",
  async scrape(input, ctx) {
    const targetCount = input.resultsWanted + input.offset;
    const jobs: JobPost[] = [];
    const warnings: string[] = [];
    const seenUrls = new Set<string>();

    let page = 1;
    while (jobs.length < targetCount) {
      if (page > 1) {
        const delayMs = BAYT_DELAY_MS + Math.random() * BAYT_DELAY_BAND_MS;
        await sleep(delayMs);
      }

      let html: string;
      try {
        html = await fetchBaytSearchPage(
          ctx.http,
          input,
          page,
          ctx.proxyPool.next().proxyUrl,
        );
      } catch (error) {
        if (jobs.length === 0) {
          throw error;
        }
        warnings.push(
          `Bayt page ${page} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }

      const parsedPageJobs = parseBaytSearchPage(html);
      if (parsedPageJobs.length === 0) {
        break;
      }

      let addedOnPage = 0;
      for (const job of parsedPageJobs) {
        if (seenUrls.has(job.jobUrl)) {
          continue;
        }
        seenUrls.add(job.jobUrl);
        jobs.push(job);
        addedOnPage += 1;
        if (jobs.length >= targetCount) {
          break;
        }
      }

      if (addedOnPage === 0) {
        break;
      }

      page += 1;
    }

    return {
      jobs: jobs.slice(input.offset, input.offset + input.resultsWanted),
      warnings,
    };
  },
};
