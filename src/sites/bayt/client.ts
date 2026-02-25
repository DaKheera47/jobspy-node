import type { HttpClient } from "../../core/httpClient";
import type { NormalizedScrapeJobsInput } from "../../types";
import { BAYT_BASE_URL, BAYT_HEADERS } from "./constants";

export async function fetchBaytSearchPage(
  http: HttpClient,
  input: Pick<
    NormalizedScrapeJobsInput,
    "searchTerm" | "timeoutMs" | "caCert"
  >,
  page: number,
  proxyUrl?: string,
): Promise<string> {
  const response = await http.text(buildBaytSearchUrl(input.searchTerm, page), {
    headers: BAYT_HEADERS,
    timeoutMs: input.timeoutMs,
    caCert: input.caCert,
    proxyUrl,
  });

  return response.data;
}

export function buildBaytSearchUrl(
  searchTerm: string | undefined,
  page: number,
): string {
  const normalizedPage = Number.isFinite(page) ? Math.max(1, Math.floor(page)) : 1;
  const slug = slugifyBaytSearchTerm(searchTerm);
  const path = slug
    ? `/en/international/jobs/${slug}-jobs/`
    : "/en/international/jobs/";
  const url = new URL(path, BAYT_BASE_URL);
  url.searchParams.set("page", String(normalizedPage));
  return url.toString();
}

export function slugifyBaytSearchTerm(searchTerm: string | undefined): string {
  const value = (searchTerm ?? "").trim().toLowerCase();
  if (!value) {
    return "";
  }

  return value
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

