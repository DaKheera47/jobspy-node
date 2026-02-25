import { sleep } from "../../core/retry";
import type { SiteScraper } from "../../core/types";
import type { JobPost } from "../../types";
import {
  NAUKRI_DELAY_BAND_MS,
  NAUKRI_DELAY_MS,
  NAUKRI_MAX_PAGES,
  NAUKRI_PAGE_SIZE,
} from "./constants";
import { fetchNaukriJobsPage } from "./client";
import { parseNaukriJob } from "./parser";

export const naukriScraper: SiteScraper = {
  site: "naukri",
  async scrape(input, ctx) {
    const jobs: JobPost[] = [];
    const warnings: string[] = [];
    const seen = new Set<string>();
    const now = ctx.now();

    let pageNo = Math.max(1, Math.floor(input.offset / NAUKRI_PAGE_SIZE) + 1);
    let skipRemaining = Math.max(0, input.offset % NAUKRI_PAGE_SIZE);
    let requests = 0;

    while (jobs.length < input.resultsWanted && pageNo <= NAUKRI_MAX_PAGES) {
      requests += 1;
      const proxySelection = ctx.proxyPool.next();

      let page;
      try {
        page = await fetchNaukriJobsPage({
          input,
          pageNo,
          http: ctx.http,
          proxyUrl: proxySelection.proxyUrl,
          caCert: input.caCert,
        });
      } catch (error) {
        warnings.push(
          `Naukri page ${requests} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }

      if (page.jobs.length === 0) {
        break;
      }

      for (const rawJob of page.jobs) {
        if (skipRemaining > 0) {
          skipRemaining -= 1;
          continue;
        }

        try {
          const parsed = parseNaukriJob(rawJob, {
            descriptionFormat: input.descriptionFormat,
            now,
          });
          const dedupeKey = parsed.id ?? parsed.jobUrl;
          if (seen.has(dedupeKey)) {
            continue;
          }
          seen.add(dedupeKey);
          jobs.push(parsed);
        } catch (error) {
          const jobId =
            rawJob?.jobId == null ? "unknown" : String(rawJob.jobId);
          warnings.push(
            `Naukri parse failed for ${jobId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        if (jobs.length >= input.resultsWanted) {
          break;
        }
      }

      if (jobs.length >= input.resultsWanted) {
        break;
      }
      if (page.jobs.length < NAUKRI_PAGE_SIZE) {
        break;
      }

      pageNo += 1;
      await sleep(NAUKRI_DELAY_MS + Math.random() * NAUKRI_DELAY_BAND_MS);
    }

    return {
      jobs,
      warnings,
    };
  },
};
