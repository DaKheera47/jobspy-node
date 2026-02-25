import type { SiteScraper } from "../../core/types";
import type { JobPost } from "../../types";
import { GOOGLE_MAX_RESULTS } from "./constants";
import { fetchGoogleInitialJobsPage, fetchGoogleJobsAsyncPage } from "./client";
import { parseGoogleAsyncJobsPage, parseGoogleInitialJobsPage } from "./parser";

export const googleScraper: SiteScraper = {
  site: "google",
  async scrape(input, ctx) {
    const effectiveResultsWanted = Math.min(input.resultsWanted, GOOGLE_MAX_RESULTS);
    const targetCount = effectiveResultsWanted + input.offset;
    const now = ctx.now();
    const jobs: JobPost[] = [];
    const warnings: string[] = [];
    const seenUrls = new Set<string>();

    const pushUniqueJobs = (items: JobPost[]) => {
      for (const job of items) {
        if (seenUrls.has(job.jobUrl)) {
          continue;
        }
        seenUrls.add(job.jobUrl);
        jobs.push(job);
        if (jobs.length >= targetCount) {
          break;
        }
      }
    };

    let forwardCursor: string | undefined;

    try {
      const proxySelection = ctx.proxyPool.next();
      const initialHtml = await fetchGoogleInitialJobsPage(
        ctx.http,
        input,
        proxySelection.proxyUrl,
      );
      if (isGoogleChallengePage(initialHtml)) {
        throw new Error("Google Jobs challenge page served (enablejs)");
      }
      const parsedInitial = parseGoogleInitialJobsPage(initialHtml, { now });
      pushUniqueJobs(parsedInitial.jobs);
      forwardCursor = parsedInitial.nextCursor;
      if (!forwardCursor && jobs.length < targetCount) {
        if (jobs.length === 0) {
          throw new Error(
            "Google Jobs data payload not found on initial page (likely challenge or format change)",
          );
        }
        warnings.push(
          "Google Jobs pagination cursor not found on the initial page; returning available results.",
        );
      }
    } catch (error) {
      warnings.push(
        `Google Jobs initial page failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      throw error;
    }

    let page = 1;
    while (jobs.length < targetCount && forwardCursor) {
      page += 1;

      let pagePayload: string;
      try {
        const proxySelection = ctx.proxyPool.next();
        pagePayload = await fetchGoogleJobsAsyncPage(
          ctx.http,
          forwardCursor,
          input,
          proxySelection.proxyUrl,
        );
      } catch (error) {
        warnings.push(
          `Google Jobs page ${page} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }

      const parsedPage = parseGoogleAsyncJobsPage(pagePayload, { now });
      if (parsedPage.jobs.length === 0) {
        break;
      }

      pushUniqueJobs(parsedPage.jobs);

      if (!parsedPage.nextCursor || parsedPage.nextCursor === forwardCursor) {
        break;
      }
      forwardCursor = parsedPage.nextCursor;
    }

    return {
      jobs: jobs.slice(input.offset, input.offset + effectiveResultsWanted),
      warnings,
    };
  },
};

function isGoogleChallengePage(html: string): boolean {
  const lowered = html.toLowerCase();
  return (
    lowered.includes("/httpservice/retry/enablejs") ||
    lowered.includes("please click here if you are not redirected") ||
    lowered.includes("<noscript>")
  );
}
