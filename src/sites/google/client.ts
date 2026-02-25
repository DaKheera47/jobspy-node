import { compactWhitespace } from "../../core/text";
import type { HttpClient } from "../../core/httpClient";
import type { NormalizedScrapeJobsInput } from "../../types";
import {
  GOOGLE_ASYNC_HEADERS,
  GOOGLE_ASYNC_JOBS_URL,
  GOOGLE_ASYNC_PARAM,
  GOOGLE_INITIAL_HEADERS,
  GOOGLE_SEARCH_URL,
} from "./constants";

export async function fetchGoogleInitialJobsPage(
  http: HttpClient,
  input: Pick<
    NormalizedScrapeJobsInput,
    | "searchTerm"
    | "googleSearchTerm"
    | "location"
    | "hoursOld"
    | "jobType"
    | "isRemote"
    | "timeoutMs"
    | "caCert"
  >,
  proxyUrl?: string,
): Promise<string> {
  const url = new URL(GOOGLE_SEARCH_URL);
  url.searchParams.set("q", buildGoogleJobsSearchQuery(input));
  url.searchParams.set("udm", "8");

  const response = await http.text(url.toString(), {
    headers: GOOGLE_INITIAL_HEADERS,
    timeoutMs: input.timeoutMs,
    caCert: input.caCert,
    proxyUrl,
  });

  return response.data;
}

export async function fetchGoogleJobsAsyncPage(
  http: HttpClient,
  forwardCursor: string,
  input: Pick<NormalizedScrapeJobsInput, "timeoutMs" | "caCert">,
  proxyUrl?: string,
): Promise<string> {
  const url = new URL(GOOGLE_ASYNC_JOBS_URL);
  url.searchParams.set("fc", forwardCursor);
  url.searchParams.set("fcv", "3");
  url.searchParams.set("async", GOOGLE_ASYNC_PARAM);

  const response = await http.text(url.toString(), {
    headers: GOOGLE_ASYNC_HEADERS,
    timeoutMs: input.timeoutMs,
    caCert: input.caCert,
    proxyUrl,
  });

  return response.data;
}

export function buildGoogleJobsSearchQuery(
  input: Pick<
    NormalizedScrapeJobsInput,
    "searchTerm" | "googleSearchTerm" | "location" | "hoursOld" | "jobType" | "isRemote"
  >,
): string {
  if (input.googleSearchTerm?.trim()) {
    return compactWhitespace(input.googleSearchTerm);
  }

  const parts: string[] = [];
  if (input.searchTerm?.trim()) {
    parts.push(compactWhitespace(input.searchTerm));
  }
  parts.push("jobs");

  if (input.jobType) {
    const jobTypeLabelMap: Record<
      NonNullable<NormalizedScrapeJobsInput["jobType"]>,
      string
    > = {
      fulltime: "Full time",
      parttime: "Part time",
      internship: "Internship",
      contract: "Contract",
    };
    const label = jobTypeLabelMap[input.jobType];
    if (label) {
      parts.push(label);
    }
  }

  if (input.location?.trim()) {
    parts.push("near", compactWhitespace(input.location));
  }

  if (input.hoursOld) {
    parts.push(mapGoogleHoursOldToQueryPhrase(input.hoursOld));
  }

  if (input.isRemote) {
    parts.push("remote");
  }

  return compactWhitespace(parts.join(" "));
}

function mapGoogleHoursOldToQueryPhrase(hoursOld: number): string {
  if (hoursOld <= 24) {
    return "since yesterday";
  }
  if (hoursOld <= 72) {
    return "in the last 3 days";
  }
  if (hoursOld <= 168) {
    return "in the last week";
  }
  return "in the last month";
}

