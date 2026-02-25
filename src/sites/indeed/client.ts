import type { HttpClient } from "../../core/httpClient";
import type { NormalizedScrapeJobsInput } from "../../types";
import {
  INDEED_API_HEADERS,
  INDEED_GRAPHQL_URL,
  INDEED_JOB_SEARCH_QUERY_FIELDS,
  resolveIndeedCountryConfig,
} from "./constants";
import type { IndeedJobPayload } from "./parser";

export interface IndeedSearchResponse {
  data?: {
    jobSearch?: {
      pageInfo?: {
        nextCursor?: string | null;
      } | null;
      results?: Array<{
        trackingKey?: string;
        job?: IndeedJobPayload | null;
      }> | null;
    } | null;
  } | null;
}

interface FetchIndeedJobsPageOptions {
  input: NormalizedScrapeJobsInput;
  cursor?: string;
  http: HttpClient;
  proxyUrl?: string;
  caCert?: string;
}

export interface IndeedPageResult {
  jobs: IndeedJobPayload[];
  nextCursor?: string;
  baseUrl: string;
}

export async function fetchIndeedJobsPage(
  options: FetchIndeedJobsPageOptions,
): Promise<IndeedPageResult> {
  const country = resolveIndeedCountryConfig(options.input.countryIndeed);
  const query = buildIndeedSearchQuery(options.input, options.cursor);
  const response = await options.http.json<IndeedSearchResponse>(INDEED_GRAPHQL_URL, {
    method: "POST",
    headers: {
      ...INDEED_API_HEADERS,
      "indeed-co": country.coHeader,
    },
    body: JSON.stringify({ query }),
    timeoutMs: options.input.timeoutMs,
    proxyUrl: options.proxyUrl,
    caCert: options.caCert,
  });

  const root = response.data.data?.jobSearch;
  const jobs = (root?.results ?? [])
    .map((result) => result.job ?? undefined)
    .filter((job): job is IndeedJobPayload => Boolean(job));

  return {
    jobs,
    nextCursor: root?.pageInfo?.nextCursor ?? undefined,
    baseUrl: `https://${country.domainPrefix}.indeed.com`,
  };
}

export function buildIndeedSearchQuery(
  input: Pick<
    NormalizedScrapeJobsInput,
    | "searchTerm"
    | "location"
    | "distance"
    | "hoursOld"
    | "easyApply"
    | "jobType"
    | "isRemote"
  >,
  cursor?: string,
): string {
  const args: string[] = [];

  if (input.searchTerm?.trim()) {
    args.push(`what: ${JSON.stringify(input.searchTerm.trim())}`);
  }

  if (input.location?.trim()) {
    args.push(
      `location: {where: ${JSON.stringify(input.location.trim())}, radius: ${input.distance}, radiusUnit: MILES}`,
    );
  }

  args.push("limit: 100");

  if (cursor) {
    args.push(`cursor: ${JSON.stringify(cursor)}`);
  }

  args.push("sort: RELEVANCE");

  const filters = buildIndeedFilters(input);
  if (filters) {
    args.push(filters);
  }

  return `
    query GetJobData {
      jobSearch(
        ${args.join("\n        ")}
      ) {
        ${INDEED_JOB_SEARCH_QUERY_FIELDS}
      }
    }
  `.trim();
}

function buildIndeedFilters(
  input: Pick<
    NormalizedScrapeJobsInput,
    "hoursOld" | "easyApply" | "jobType" | "isRemote"
  >,
): string {
  if (input.hoursOld) {
    return `
      filters: {
        date: {
          field: "dateOnIndeed",
          start: "${input.hoursOld}h"
        }
      }
    `.trim();
  }

  if (input.easyApply) {
    return `
      filters: {
        keyword: {
          field: "indeedApplyScope",
          keys: ["DESKTOP"]
        }
      }
    `.trim();
  }

  const keys: string[] = [];
  if (input.jobType) {
    const map: Record<NonNullable<NormalizedScrapeJobsInput["jobType"]>, string> = {
      fulltime: "CF3CP",
      parttime: "75GKK",
      contract: "NJXCK",
      internship: "VDTG7",
    };
    keys.push(map[input.jobType]);
  }
  if (input.isRemote) {
    keys.push("DSQF7");
  }

  if (keys.length === 0) {
    return "";
  }

  return `
    filters: {
      composite: {
        filters: [{
          keyword: {
            field: "attributes",
            keys: [${keys.map((key) => JSON.stringify(key)).join(", ")}]
          }
        }]
      }
    }
  `.trim();
}

