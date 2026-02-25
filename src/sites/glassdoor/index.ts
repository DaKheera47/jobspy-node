import type { SiteScraper } from "../../core/types";
import type { JobPost } from "../../types";
import {
  fetchGlassdoorCsrfToken,
  fetchGlassdoorJobDescription,
  fetchGlassdoorJobsPage,
  resolveGlassdoorLocation,
} from "./client";
import {
  GLASSDOOR_BASE_URL,
  GLASSDOOR_FALLBACK_CSRF_TOKEN,
  GLASSDOOR_JOBS_PER_PAGE,
  GLASSDOOR_MAX_PAGES,
} from "./constants";
import { getGlassdoorListingId, parseGlassdoorJob } from "./parser";

export const glassdoorScraper: SiteScraper = {
  site: "glassdoor",
  async scrape(input, ctx) {
    const warnings: string[] = [];
    const now = ctx.now();

    const startPage = Math.floor(input.offset / GLASSDOOR_JOBS_PER_PAGE) + 1;
    const offsetWithinPage = input.offset % GLASSDOOR_JOBS_PER_PAGE;
    if (startPage > GLASSDOOR_MAX_PAGES) {
      warnings.push(
        `Glassdoor supports up to ${GLASSDOOR_MAX_PAGES * GLASSDOOR_JOBS_PER_PAGE} results; requested offset ${input.offset} exceeds that window.`,
      );
      return { jobs: [], warnings };
    }

    const maxResultsFromStartPage =
      (GLASSDOOR_MAX_PAGES - startPage + 1) * GLASSDOOR_JOBS_PER_PAGE;
    const targetCount = Math.min(
      input.resultsWanted + offsetWithinPage,
      maxResultsFromStartPage,
    );
    if (targetCount <= 0) {
      return { jobs: [], warnings };
    }

    let csrfToken = GLASSDOOR_FALLBACK_CSRF_TOKEN;
    try {
      const proxySelection = ctx.proxyPool.next();
      const fetchedToken = await fetchGlassdoorCsrfToken({
        http: ctx.http,
        proxyUrl: proxySelection.proxyUrl,
        timeoutMs: input.timeoutMs,
        caCert: input.caCert,
      });
      if (fetchedToken) {
        csrfToken = fetchedToken;
      } else {
        warnings.push("Glassdoor CSRF token not found in bootstrap page; using fallback token.");
      }
    } catch (error) {
      warnings.push(
        `Glassdoor CSRF bootstrap failed; using fallback token: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    let resolvedLocation;
    try {
      const proxySelection = ctx.proxyPool.next();
      resolvedLocation = await resolveGlassdoorLocation({
        http: ctx.http,
        location: input.location,
        isRemote: input.isRemote,
        proxyUrl: proxySelection.proxyUrl,
        timeoutMs: input.timeoutMs,
        caCert: input.caCert,
      });
    } catch (error) {
      warnings.push(
        `Glassdoor location lookup failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return { jobs: [], warnings };
    }

    const collected: JobPost[] = [];
    const seenJobIds = new Set<string>();
    let cursor: string | undefined;

    for (
      let pageNumber = startPage;
      pageNumber <= GLASSDOOR_MAX_PAGES && collected.length < targetCount;
      pageNumber += 1
    ) {
      const pageProxy = ctx.proxyPool.next();

      let page;
      try {
        page = await fetchGlassdoorJobsPage({
          input,
          location: resolvedLocation,
          pageNumber,
          cursor,
          csrfToken,
          http: ctx.http,
          proxyUrl: pageProxy.proxyUrl,
          timeoutMs: input.timeoutMs,
          caCert: input.caCert,
        });
      } catch (error) {
        warnings.push(
          `Glassdoor page ${pageNumber} failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        break;
      }

      if (page.jobs.length === 0) {
        break;
      }

      for (const rawJob of page.jobs) {
        const jobId = getGlassdoorListingId(rawJob);
        if (!jobId || seenJobIds.has(jobId)) {
          continue;
        }
        seenJobIds.add(jobId);

        let detailDescriptionHtml: string | null = null;
        try {
          detailDescriptionHtml = await fetchGlassdoorJobDescription({
            http: ctx.http,
            jobId,
            csrfToken,
            proxyUrl: pageProxy.proxyUrl,
            timeoutMs: input.timeoutMs,
            caCert: input.caCert,
          });
        } catch (error) {
          warnings.push(
            `Glassdoor detail ${jobId} failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }

        const parsed = parseGlassdoorJob(rawJob, {
          baseUrl: GLASSDOOR_BASE_URL,
          now,
          descriptionFormat: input.descriptionFormat,
          descriptionHtml: detailDescriptionHtml,
        });
        if (!parsed) {
          continue;
        }

        collected.push(parsed);
        if (collected.length >= targetCount) {
          break;
        }
      }

      cursor = page.nextCursor;
    }

    return {
      jobs: collected.slice(offsetWithinPage, offsetWithinPage + input.resultsWanted),
      warnings,
    };
  },
};

