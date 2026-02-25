import type { HttpClient } from "../../core/httpClient";
import type { NormalizedScrapeJobsInput } from "../../types";
import {
  LINKEDIN_BASE_URL,
  LINKEDIN_HEADERS,
  LINKEDIN_SEARCH_PATH,
} from "./constants";

export async function fetchLinkedInSearchPage(
  http: HttpClient,
  input: NormalizedScrapeJobsInput,
  start: number,
  proxyUrl?: string,
): Promise<string> {
  const url = new URL(LINKEDIN_SEARCH_PATH, LINKEDIN_BASE_URL);

  const params: Record<string, string> = {};
  if (input.searchTerm) params.keywords = input.searchTerm;
  if (input.location) params.location = input.location;
  params.distance = String(input.distance);
  params.pageNum = "0";
  params.start = String(start);
  if (input.isRemote) params.f_WT = "2";
  if (input.jobType) params.f_JT = mapLinkedInJobTypeCode(input.jobType);
  if (input.easyApply) params.f_AL = "true";
  if (input.linkedinCompanyIds?.length) {
    params.f_C = input.linkedinCompanyIds.join(",");
  }
  if (input.hoursOld) {
    params.f_TPR = `r${input.hoursOld * 3600}`;
  }

  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));

  const response = await http.text(url.toString(), {
    headers: LINKEDIN_HEADERS,
    proxyUrl,
    timeoutMs: input.timeoutMs,
    caCert: input.caCert,
  });

  return response.data;
}

export async function fetchLinkedInJobDetailPage(
  http: HttpClient,
  jobId: string,
  input: Pick<NormalizedScrapeJobsInput, "timeoutMs" | "caCert">,
  proxyUrl?: string,
): Promise<{ html: string; finalUrl: string }> {
  const url = `${LINKEDIN_BASE_URL}/jobs/view/${jobId}`;
  const response = await http.text(url, {
    headers: LINKEDIN_HEADERS,
    proxyUrl,
    timeoutMs: input.timeoutMs,
    caCert: input.caCert,
    retry: {
      retries: 1,
    },
  });
  return { html: response.data, finalUrl: response.url };
}

function mapLinkedInJobTypeCode(
  jobType: NonNullable<NormalizedScrapeJobsInput["jobType"]>,
): string {
  const mapping: Record<NonNullable<NormalizedScrapeJobsInput["jobType"]>, string> = {
    fulltime: "F",
    parttime: "P",
    internship: "I",
    contract: "C",
  };
  return mapping[jobType];
}

