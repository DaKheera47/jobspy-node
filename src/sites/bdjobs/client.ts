import type { HttpClient } from "../../core/httpClient";
import type { NormalizedScrapeJobsInput } from "../../types";
import {
  BDJOBS_DEFAULT_SEARCH_PARAMS,
  BDJOBS_HEADERS,
  BDJOBS_SEARCH_URL,
} from "./constants";

export async function fetchBDJobsSearchPage(
  http: HttpClient,
  input: Pick<NormalizedScrapeJobsInput, "searchTerm" | "timeoutMs" | "caCert">,
  page: number,
  proxyUrl?: string,
): Promise<string> {
  const response = await http.text(buildBDJobsSearchUrl(input.searchTerm, page), {
    headers: BDJOBS_HEADERS,
    timeoutMs: input.timeoutMs,
    caCert: input.caCert,
    proxyUrl,
  });
  return response.data;
}

export async function fetchBDJobsDetailPage(
  http: HttpClient,
  jobUrl: string,
  input: Pick<NormalizedScrapeJobsInput, "timeoutMs" | "caCert">,
  proxyUrl?: string,
): Promise<string> {
  const response = await http.text(jobUrl, {
    headers: BDJOBS_HEADERS,
    timeoutMs: input.timeoutMs,
    caCert: input.caCert,
    proxyUrl,
    retry: {
      retries: 1,
    },
  });
  return response.data;
}

export function buildBDJobsSearchUrl(
  searchTerm: string | undefined,
  page: number,
): string {
  const url = new URL(BDJOBS_SEARCH_URL);
  Object.entries(BDJOBS_DEFAULT_SEARCH_PARAMS).forEach(([key, value]) =>
    url.searchParams.set(key, value),
  );

  if (searchTerm?.trim()) {
    url.searchParams.set("txtsearch", searchTerm.trim());
  }

  const normalizedPage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  if (normalizedPage > 1) {
    url.searchParams.set("pg", String(normalizedPage));
  }

  return url.toString();
}

