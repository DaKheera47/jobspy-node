import type { HttpClient } from "../../core/httpClient";
import type { NormalizedScrapeJobsInput } from "../../types";
import {
  NAUKRI_HEADERS,
  NAUKRI_PAGE_SIZE,
  NAUKRI_SEARCH_API_URL,
} from "./constants";
import type { NaukriApiJob } from "./parser";

export interface NaukriSearchResponse {
  jobDetails?: NaukriApiJob[] | null;
  totalJobs?: number | string | null;
}

export interface FetchNaukriJobsPageOptions {
  input: NormalizedScrapeJobsInput;
  pageNo: number;
  http: HttpClient;
  proxyUrl?: string;
  caCert?: string;
}

export interface NaukriPageResult {
  jobs: NaukriApiJob[];
  totalJobs: number | null;
}

export async function fetchNaukriJobsPage(
  options: FetchNaukriJobsPageOptions,
): Promise<NaukriPageResult> {
  const url = new URL(NAUKRI_SEARCH_API_URL);
  const params = buildNaukriSearchParams(options.input, options.pageNo);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  });

  const response = await options.http.json<NaukriSearchResponse>(url.toString(), {
    headers: NAUKRI_HEADERS,
    timeoutMs: options.input.timeoutMs,
    proxyUrl: options.proxyUrl,
    caCert: options.caCert,
  });

  const totalJobsRaw = response.data.totalJobs;
  const totalJobs =
    typeof totalJobsRaw === "number"
      ? totalJobsRaw
      : typeof totalJobsRaw === "string" && totalJobsRaw.trim()
        ? Number(totalJobsRaw)
        : null;

  return {
    jobs: Array.isArray(response.data.jobDetails) ? response.data.jobDetails : [],
    totalJobs: Number.isFinite(totalJobs) ? Number(totalJobs) : null,
  };
}

export function buildNaukriSearchParams(
  input: Pick<
    NormalizedScrapeJobsInput,
    "searchTerm" | "location" | "isRemote" | "hoursOld"
  >,
  pageNo: number,
): Record<string, string | number | undefined> {
  const keyword = normalizeQueryValue(input.searchTerm);
  const location = normalizeQueryValue(input.location);
  const days =
    typeof input.hoursOld === "number" && input.hoursOld > 0
      ? Math.floor(input.hoursOld / 24)
      : undefined;

  return {
    noOfResults: NAUKRI_PAGE_SIZE,
    urlType: keyword ? "search_by_keyword" : "search_by_location",
    searchType: "adv",
    keyword,
    pageNo: Math.max(1, Math.floor(pageNo)),
    k: keyword,
    seoKey: keyword ? buildNaukriSeoKey(keyword) : undefined,
    src: "jobsearchDesk",
    latLong: "",
    location,
    remote: input.isRemote ? "true" : undefined,
    days,
  };
}

export function buildNaukriSeoKey(searchTerm: string): string {
  const slug = searchTerm
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug ? `${slug}-jobs` : "jobs";
}

function normalizeQueryValue(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
