import { sleep } from "../../core/retry";
import type { SiteScraper } from "../../core/types";
import type { JobPost } from "../../types";
import { ZIPRECRUITER_BASE_URL } from "./constants";
import {
  fetchZipRecruiterDetailPage,
  fetchZipRecruiterJobsPage,
  sendZipRecruiterSessionEvent,
} from "./client";
import { parseZipRecruiterDetailPage, parseZipRecruiterJob } from "./parser";

const ZIPRECRUITER_DELAY_MS = 5000;
const ZIPRECRUITER_PAGE_SIZE = 20;

export const zipRecruiterScraper: SiteScraper = {
  site: "zip_recruiter",
  async scrape(input, ctx) {
    const targetCount = input.resultsWanted + input.offset;
    const jobs: JobPost[] = [];
    const warnings: string[] = [];
    const seenUrls = new Set<string>();
    const maxPages = Math.max(1, Math.ceil(targetCount / ZIPRECRUITER_PAGE_SIZE));

    const sessionProxy = ctx.proxyPool.next().proxyUrl;
    try {
      await sendZipRecruiterSessionEvent(ctx.http, input, sessionProxy);
    } catch (error) {
      warnings.push(
        `ZipRecruiter session event failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    let continueFrom: string | undefined;
    for (let page = 1; page <= maxPages && jobs.length < targetCount; page += 1) {
      if (page > 1) {
        await sleep(ZIPRECRUITER_DELAY_MS);
      }

      let pageData: Awaited<ReturnType<typeof fetchZipRecruiterJobsPage>>;
      try {
        pageData = await fetchZipRecruiterJobsPage(
          ctx.http,
          input,
          continueFrom,
          sessionProxy,
        );
      } catch (error) {
        if (jobs.length === 0) {
          throw error;
        }
        warnings.push(
          `ZipRecruiter page ${page} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }

      if (pageData.jobs.length === 0) {
        break;
      }

      for (const rawJob of pageData.jobs) {
        const parsed = parseZipRecruiterJob(rawJob, input.descriptionFormat);
        if (seenUrls.has(parsed.jobUrl)) {
          continue;
        }
        seenUrls.add(parsed.jobUrl);

        try {
          const detailHtml = await fetchZipRecruiterDetailPage(
            ctx.http,
            parsed.jobUrl,
            input,
            sessionProxy,
          );
          const details = parseZipRecruiterDetailPage(
            detailHtml,
            input.descriptionFormat,
          );
          parsed.description = details.description ?? parsed.description;
          parsed.jobUrlDirect = details.directUrl;
        } catch (error) {
          warnings.push(
            `ZipRecruiter detail failed for ${parsed.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }

        parsed.jobUrl ||= `${ZIPRECRUITER_BASE_URL}/jobs//j?lvk=${rawJob.listing_key}`;
        jobs.push(parsed);
        if (jobs.length >= targetCount) {
          break;
        }
      }

      continueFrom = pageData.continueFrom;
      if (!continueFrom) {
        break;
      }
    }

    return {
      jobs: jobs.slice(input.offset, input.offset + input.resultsWanted),
      warnings,
    };
  },
};
