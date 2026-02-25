import { sleep } from "../../core/retry";
import type { SiteScraper } from "../../core/types";
import type { JobPost } from "../../types";
import { LINKEDIN_BASE_URL, LINKEDIN_DELAY_BAND_MS, LINKEDIN_DELAY_MS } from "./constants";
import { fetchLinkedInJobDetailPage, fetchLinkedInSearchPage } from "./client";
import {
  inferLinkedInRemote,
  parseLinkedInDetailPage,
  parseLinkedInSearchCards,
} from "./parser";

export const linkedinScraper: SiteScraper = {
  site: "linkedin",
  async scrape(input, ctx) {
    const targetCount = input.resultsWanted + input.offset;
    const jobs: JobPost[] = [];
    const warnings: string[] = [];
    const seenIds = new Set<string>();

    let start = input.offset > 0 ? Math.floor(input.offset / 10) * 10 : 0;
    let requests = 0;

    while (jobs.length < targetCount && start < 1000) {
      requests += 1;
      const proxySelection = ctx.proxyPool.next();

      let searchHtml: string;
      try {
        searchHtml = await fetchLinkedInSearchPage(
          ctx.http,
          input,
          start,
          proxySelection.proxyUrl,
        );
      } catch (error) {
        warnings.push(
          `LinkedIn page ${requests} failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        break;
      }

      const cards = parseLinkedInSearchCards(searchHtml);
      if (cards.length === 0) {
        break;
      }

      for (const card of cards) {
        if (seenIds.has(card.jobId)) {
          continue;
        }
        seenIds.add(card.jobId);

        let details = {};
        if (input.linkedinFetchDescription) {
          try {
            const detail = await fetchLinkedInJobDetailPage(
              ctx.http,
              card.jobId,
              input,
              proxySelection.proxyUrl,
            );
            if (!detail.finalUrl.includes("/signup")) {
              details = parseLinkedInDetailPage(detail.html, input.descriptionFormat);
            }
          } catch (error) {
            warnings.push(
              `LinkedIn detail ${card.jobId} failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        }

        const detailDescription =
          "description" in details ? (details.description as string | null | undefined) : null;
        const locationDisplay = card.location?.display ?? null;
        const isRemote = inferLinkedInRemote(
          card.title,
          detailDescription,
          locationDisplay,
        );

        jobs.push({
          id: `li-${card.jobId}`,
          site: "linkedin",
          title: card.title,
          company: card.company,
          companyUrl: card.companyUrl,
          jobUrl: card.jobUrl || `${LINKEDIN_BASE_URL}/jobs/view/${card.jobId}`,
          location: card.location,
          isRemote,
          datePosted: card.datePosted,
          compensation: card.compensation,
          jobType:
            "jobType" in details ? (details.jobType as JobPost["jobType"]) : null,
          jobLevel:
            "jobLevel" in details ? (details.jobLevel as string | null | undefined) : null,
          companyIndustry:
            "companyIndustry" in details
              ? (details.companyIndustry as string | null | undefined)
              : null,
          description: detailDescription,
          jobUrlDirect:
            "jobUrlDirect" in details
              ? (details.jobUrlDirect as string | null | undefined)
              : null,
          companyLogo:
            "companyLogo" in details
              ? (details.companyLogo as string | null | undefined)
              : null,
          jobFunction:
            "jobFunction" in details
              ? (details.jobFunction as string | null | undefined)
              : null,
          metadata: {},
        });

        if (jobs.length >= targetCount) {
          break;
        }
      }

      if (jobs.length >= targetCount) {
        break;
      }

      start += cards.length;
      const delay = LINKEDIN_DELAY_MS + Math.random() * LINKEDIN_DELAY_BAND_MS;
      await sleep(delay);
    }

    return {
      jobs: jobs.slice(input.offset, input.offset + input.resultsWanted),
      warnings,
    };
  },
};

