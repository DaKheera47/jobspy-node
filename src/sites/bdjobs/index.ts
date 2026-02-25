import { sleep } from "../../core/retry";
import type { SiteScraper } from "../../core/types";
import type { JobPost } from "../../types";
import { BDJOBS_DELAY_BAND_MS, BDJOBS_DELAY_MS } from "./constants";
import { fetchBDJobsDetailPage, fetchBDJobsSearchPage } from "./client";
import { parseBDJobsDetailPage, parseBDJobsSearchPage } from "./parser";

export const bdjobsScraper: SiteScraper = {
  site: "bdjobs",
  async scrape(input, ctx) {
    const targetCount = input.resultsWanted + input.offset;
    const jobs: JobPost[] = [];
    const warnings: string[] = [];
    const seenIds = new Set<string>();

    let page = 1;
    while (jobs.length < targetCount) {
      if (page > 1) {
        const delayMs = BDJOBS_DELAY_MS + Math.random() * BDJOBS_DELAY_BAND_MS;
        await sleep(delayMs);
      }

      let searchHtml: string;
      try {
        searchHtml = await fetchBDJobsSearchPage(
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
          `BDJobs page ${page} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }

      const candidates = parseBDJobsSearchPage(searchHtml);
      if (candidates.length === 0) {
        break;
      }

      let addedOnPage = 0;
      for (const candidate of candidates) {
        if (seenIds.has(candidate.id)) {
          continue;
        }
        seenIds.add(candidate.id);

        const job: JobPost = {
          id: candidate.id,
          site: "bdjobs",
          title: candidate.title,
          company: candidate.company,
          jobUrl: candidate.jobUrl,
          location: candidate.location,
          datePosted: candidate.datePosted,
          isRemote: candidate.isRemote,
          metadata: {},
        };

        try {
          const detailHtml = await fetchBDJobsDetailPage(
            ctx.http,
            candidate.jobUrl,
            input,
            ctx.proxyPool.next().proxyUrl,
          );
          const detail = parseBDJobsDetailPage(detailHtml, input.descriptionFormat);
          job.description = detail.description;
          job.jobType = detail.jobType;
          job.companyIndustry = detail.companyIndustry;
          job.emails = detail.emails;
        } catch (error) {
          warnings.push(
            `BDJobs detail failed for ${candidate.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

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
