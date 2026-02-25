import type { HttpClient } from "../../core/httpClient";
import type { NormalizedScrapeJobsInput } from "../../types";
import {
  ZIPRECRUITER_API_BASE_URL,
  ZIPRECRUITER_HEADERS,
  ZIPRECRUITER_SESSION_EVENT_DATA,
} from "./constants";
import type { ZipRecruiterApiJob } from "./parser";

interface ZipRecruiterJobsResponse {
  jobs?: ZipRecruiterApiJob[];
  continue?: string | null;
}

export async function sendZipRecruiterSessionEvent(
  http: HttpClient,
  input: Pick<NormalizedScrapeJobsInput, "timeoutMs" | "caCert">,
  proxyUrl?: string,
): Promise<void> {
  const body = new URLSearchParams(ZIPRECRUITER_SESSION_EVENT_DATA);
  await http.text(`${ZIPRECRUITER_API_BASE_URL}/jobs-app/event`, {
    method: "POST",
    headers: {
      ...ZIPRECRUITER_HEADERS,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    timeoutMs: input.timeoutMs,
    caCert: input.caCert,
    proxyUrl,
    retry: {
      retries: 0,
    },
  });
}

export async function fetchZipRecruiterJobsPage(
  http: HttpClient,
  input: NormalizedScrapeJobsInput,
  continueFrom?: string,
  proxyUrl?: string,
): Promise<{ jobs: ZipRecruiterApiJob[]; continueFrom?: string }> {
  const url = new URL("/jobs-app/jobs", ZIPRECRUITER_API_BASE_URL);
  const params = buildZipRecruiterSearchParams(input);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null) {
      url.searchParams.set(key, String(value));
    }
  });
  if (continueFrom) {
    url.searchParams.set("continue_from", continueFrom);
  }

  const response = await http.json<ZipRecruiterJobsResponse>(url.toString(), {
    headers: ZIPRECRUITER_HEADERS,
    timeoutMs: input.timeoutMs,
    caCert: input.caCert,
    proxyUrl,
  });

  return {
    jobs: response.data.jobs ?? [],
    continueFrom: response.data.continue ?? undefined,
  };
}

export async function fetchZipRecruiterDetailPage(
  http: HttpClient,
  url: string,
  input: Pick<NormalizedScrapeJobsInput, "timeoutMs" | "caCert">,
  proxyUrl?: string,
): Promise<string> {
  const response = await http.text(url, {
    timeoutMs: input.timeoutMs,
    caCert: input.caCert,
    proxyUrl,
  });
  return response.data;
}

function buildZipRecruiterSearchParams(
  input: Pick<
    NormalizedScrapeJobsInput,
    | "searchTerm"
    | "location"
    | "hoursOld"
    | "jobType"
    | "easyApply"
    | "isRemote"
    | "distance"
  >,
): Record<string, string | number | undefined> {
  const params: Record<string, string | number | undefined> = {
    search: input.searchTerm,
    location: input.location,
    radius: input.distance,
  };

  if (input.hoursOld) {
    params.days = Math.max(Math.floor(input.hoursOld / 24), 1);
  }

  if (input.jobType) {
    const mapping: Record<NonNullable<NormalizedScrapeJobsInput["jobType"]>, string> = {
      fulltime: "full_time",
      parttime: "part_time",
      contract: "contract",
      internship: "internship",
    };
    params.employment_type = mapping[input.jobType] ?? input.jobType;
  }

  if (input.easyApply) {
    params.zipapply = 1;
  }
  if (input.isRemote) {
    params.remote = 1;
  }

  return params;
}

