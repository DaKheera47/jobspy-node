import type { SiteScraper } from "../../core/types";
import type { JobPost } from "../../types";
import { fetchIndeedJobsPage } from "./client";
import { parseIndeedJob } from "./parser";

export const indeedScraper: SiteScraper = {
  site: "indeed",
  async scrape(input, ctx) {
    const targetCount = input.resultsWanted + input.offset;
    const collected: JobPost[] = [];
    const seenUrls = new Set<string>();
    let cursor: string | undefined;

    while (seenUrls.size < targetCount) {
      const proxySelection = ctx.proxyPool.next();
      const page = await fetchIndeedJobsPage({
        input,
        cursor,
        http: ctx.http,
        proxyUrl: proxySelection.proxyUrl,
        caCert: input.caCert,
      });

      if (page.jobs.length === 0) {
        break;
      }

      for (const rawJob of page.jobs) {
        const parsedJob = parseIndeedJob(rawJob, {
          baseUrl: page.baseUrl,
          descriptionFormat: input.descriptionFormat,
        });

        if (seenUrls.has(parsedJob.jobUrl)) {
          continue;
        }
        seenUrls.add(parsedJob.jobUrl);
        collected.push(parsedJob);

        if (seenUrls.size >= targetCount) {
          break;
        }
      }

      cursor = page.nextCursor;
      if (!cursor) {
        break;
      }
    }

    return {
      jobs: collected.slice(input.offset, input.offset + input.resultsWanted),
      warnings: [],
    };
  },
};
