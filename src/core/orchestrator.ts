import pLimit from "p-limit";

import { ScrapeJobsError } from "../errors";
import type {
  JobPost,
  ScrapeJobsResult,
  Site,
  SiteScrapeError,
  SiteScrapeMeta,
} from "../types";
import { ScrapeJobsResultSchema, type ScrapeJobsInput } from "../types";
import { HttpClient, HttpStatusError } from "./httpClient";
import { normalizeInput, normalizeJobPost, sortJobs } from "./normalize";
import { ProxyPool } from "./proxyPool";
import { SiteRegistry } from "./siteRegistry";
import type { SiteScraper } from "./types";
import {
  validateGlobalInput,
  validateIndeedConstraints,
  validateLinkedInConstraints,
} from "./validation";

export interface RunScrapeJobsOptions {
  registry?: SiteRegistry;
  httpClient?: HttpClient;
  now?: () => Date;
}

interface PerSiteRunResult {
  site: Site;
  jobs: JobPost[];
  warnings: string[];
  meta: SiteScrapeMeta;
  error?: SiteScrapeError;
}

export async function runScrapeJobs(
  rawInput: ScrapeJobsInput = {},
  options: RunScrapeJobsOptions = {},
): Promise<ScrapeJobsResult> {
  const input = normalizeInput(rawInput);
  const started = (options.now ?? (() => new Date()))();
  const registry = options.registry ?? new SiteRegistry();
  const httpClient = options.httpClient ?? new HttpClient({
    userAgent: input.userAgent,
    timeoutMs: input.timeoutMs,
  });
  const proxyPool = new ProxyPool(input.proxies);

  const preflightErrors = validateGlobalInput(input);
  if (preflightErrors.length > 0) {
    const errorList = preflightErrors.map<SiteScrapeError>((message) => ({
      site: input.siteName[0] ?? "indeed",
      code: "INVALID_INPUT",
      message,
      retriable: false,
    }));

    const partial = buildResult({
      jobs: [],
      errors: errorList,
      perSite: [],
      started,
      ended: (options.now ?? (() => new Date()))(),
      sitesRequested: input.siteName,
    });

    if (input.strict) {
      throw new ScrapeJobsError("Invalid scrapeJobs input", errorList, partial);
    }

    return partial;
  }

  const limit = pLimit(input.maxConcurrency);
  const siteRuns = await Promise.all(
    input.siteName.map((site) =>
      limit(() =>
        runSingleSite(site, input, {
          registry,
          httpClient,
          proxyPool,
          now: options.now ?? (() => new Date()),
        }),
      ),
    ),
  );

  const jobs = sortJobs(
    siteRuns.flatMap((run) =>
      run.jobs.map((job) => normalizeJobPost(job, input)),
    ),
  );
  const errors = siteRuns.flatMap((run) => (run.error ? [run.error] : []));
  const perSite = siteRuns.map((run) => run.meta);

  const result = buildResult({
    jobs,
    errors,
    perSite,
    started,
    ended: (options.now ?? (() => new Date()))(),
    sitesRequested: input.siteName,
    warnings: siteRuns.flatMap((run) => run.warnings),
  });

  if (input.strict && errors.length > 0) {
    throw new ScrapeJobsError("One or more sites failed", errors, result);
  }

  return result;
}

async function runSingleSite(
  site: Site,
  input: ReturnType<typeof normalizeInput>,
  deps: {
    registry: SiteRegistry;
    httpClient: HttpClient;
    proxyPool: ProxyPool;
    now: () => Date;
  },
): Promise<PerSiteRunResult> {
  const started = deps.now();
  const warnings: string[] = [];

  const scraper = deps.registry.get(site);
  if (!scraper) {
    return failedSiteResult(site, started, deps.now(), {
      code: "UNKNOWN",
      message: `No scraper registered for site: ${site}`,
      retriable: false,
    });
  }

  warnings.push(...validateSiteInput(scraper, input));
  if (warnings.length > 0 && input.strict) {
    return failedSiteResult(site, started, deps.now(), {
      code: "UNSUPPORTED_COMBINATION",
      message: warnings.join(" "),
      retriable: false,
    });
  }

  try {
    const result = await scraper.scrape(input, {
      http: deps.httpClient,
      proxyPool: deps.proxyPool,
      now: deps.now,
    });
    const ended = deps.now();
    const siteWarnings = [...warnings, ...(result.warnings ?? [])];
    return {
      site,
      jobs: result.jobs,
      warnings: siteWarnings,
      meta: {
        site,
        requested: input.resultsWanted,
        returned: result.jobs.length,
        durationMs: Math.max(0, ended.getTime() - started.getTime()),
        warnings: siteWarnings,
      },
    };
  } catch (error) {
    const ended = deps.now();
    return failedSiteResult(
      site,
      started,
      ended,
      classifySiteError(site, error),
      warnings,
    );
  }
}

function validateSiteInput(
  scraper: SiteScraper,
  input: ReturnType<typeof normalizeInput>,
): string[] {
  const warnings = scraper.validateInput?.(input) ?? [];
  if (scraper.site === "indeed") {
    warnings.push(...validateIndeedConstraints(input));
  }
  if (scraper.site === "linkedin") {
    warnings.push(...validateLinkedInConstraints(input));
  }
  return warnings;
}

function failedSiteResult(
  site: Site,
  started: Date,
  ended: Date,
  errorLike: Omit<SiteScrapeError, "site">,
  warnings: string[] = [],
): PerSiteRunResult {
  return {
    site,
    jobs: [],
    warnings,
    error: {
      site,
      ...errorLike,
    },
    meta: {
      site,
      requested: 0,
      returned: 0,
      durationMs: Math.max(0, ended.getTime() - started.getTime()),
      warnings,
    },
  };
}

function classifySiteError(site: Site, error: unknown): Omit<SiteScrapeError, "site"> {
  if (error instanceof HttpStatusError) {
    if (error.status === 429) {
      return {
        code: "RATE_LIMITED",
        message: `${site} rate limited request (HTTP 429)`,
        retriable: true,
        statusCode: error.status,
        cause: error,
      };
    }

    return {
      code: "NETWORK_ERROR",
      message: `${site} request failed (HTTP ${error.status})`,
      retriable: error.status >= 500,
      statusCode: error.status,
      cause: error,
    };
  }

  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return {
        code: "TIMEOUT",
        message: `${site} request timed out`,
        retriable: true,
        cause: error,
      };
    }

    const lowered = error.message.toLowerCase();
    if (lowered.includes("not implemented")) {
      return {
        code: "UNKNOWN",
        message: error.message,
        retriable: false,
        cause: error,
      };
    }

    return {
      code: "PARSER_ERROR",
      message: error.message,
      retriable: false,
      cause: error,
    };
  }

  return {
    code: "UNKNOWN",
    message: `Unknown error in ${site} scraper`,
    retriable: false,
    cause: error,
  };
}

function buildResult(params: {
  jobs: JobPost[];
  errors: SiteScrapeError[];
  perSite: SiteScrapeMeta[];
  started: Date;
  ended: Date;
  sitesRequested: Site[];
  warnings?: string[];
}): ScrapeJobsResult {
  const sitesFailed = params.errors.map((error) => error.site);
  const sitesSucceeded = params.sitesRequested.filter(
    (site) => !sitesFailed.includes(site),
  );
  const result: ScrapeJobsResult = {
    jobs: params.jobs,
    errors: params.errors,
    meta: {
      startedAt: params.started.toISOString(),
      endedAt: params.ended.toISOString(),
      durationMs: Math.max(0, params.ended.getTime() - params.started.getTime()),
      partial: params.errors.length > 0,
      sitesRequested: params.sitesRequested,
      sitesSucceeded,
      sitesFailed,
      perSite: params.perSite,
      warnings: params.warnings ?? [],
    },
  };

  return ScrapeJobsResultSchema.parse(result);
}

