import type { HttpClient } from "../../core/httpClient";
import type { NormalizedScrapeJobsInput } from "../../types";
import {
  GLASSDOOR_BASE_URL,
  GLASSDOOR_CSRF_BOOTSTRAP_PATH,
  GLASSDOOR_DETAIL_QUERY,
  GLASSDOOR_GRAPHQL_HEADERS,
  GLASSDOOR_GRAPHQL_URL,
  GLASSDOOR_JOBS_PER_PAGE,
  GLASSDOOR_LOCATION_LOOKUP_PATH,
  GLASSDOOR_PAGE_HEADERS,
  GLASSDOOR_REMOTE_LOCATION,
  GLASSDOOR_SEARCH_QUERY,
} from "./constants";
import type { GlassdoorTlsSession } from "./tlsSession";
import {
  getGlassdoorCursorForPage,
  mapGlassdoorLocationType,
  parseGlassdoorDetailDescriptionFromEnvelope,
  type GlassdoorGraphqlEnvelope,
  type GlassdoorPaginationCursor,
  type GlassdoorSearchJobPayload,
  type GlassdoorDetailGraphqlData,
} from "./parser";

export interface GlassdoorResolvedLocation {
  locationId: number;
  locationType: "CITY" | "STATE" | "COUNTRY";
}

interface GlassdoorLocationLookupItem {
  locationId?: number | string | null;
  locationType?: string | null;
}

interface GlassdoorSearchGraphqlData {
  jobListings?: {
    jobListings?: GlassdoorSearchJobPayload[] | null;
    paginationCursors?: GlassdoorPaginationCursor[] | null;
    totalJobsCount?: number | null;
    jobSearchTrackingKey?: string | null;
  } | null;
}

interface FetchGlassdoorCommonOptions {
  http: HttpClient;
  tlsSession?: GlassdoorTlsSession;
  proxyUrl?: string;
  timeoutMs?: number;
  caCert?: string;
}

export interface FetchGlassdoorJobsPageOptions extends FetchGlassdoorCommonOptions {
  input: Pick<
    NormalizedScrapeJobsInput,
    "searchTerm" | "hoursOld" | "easyApply" | "jobType"
  >;
  location: GlassdoorResolvedLocation;
  pageNumber: number;
  cursor?: string;
  csrfToken: string;
}

export interface GlassdoorJobsPageResult {
  jobs: GlassdoorSearchJobPayload[];
  nextCursor?: string;
  totalJobsCount?: number | null;
  searchTrackingKey?: string | null;
}

export async function fetchGlassdoorCsrfToken(
  options: FetchGlassdoorCommonOptions,
): Promise<string | null> {
  const url = new URL(GLASSDOOR_CSRF_BOOTSTRAP_PATH, GLASSDOOR_BASE_URL).toString();
  const response = await getGlassdoorHttp(options).text(url, {
    headers: GLASSDOOR_PAGE_HEADERS,
    proxyUrl: options.proxyUrl,
    timeoutMs: options.timeoutMs,
    caCert: options.caCert,
    retry: {
      retries: 1,
    },
  });
  return extractGlassdoorCsrfToken(response.data);
}

export async function resolveGlassdoorLocation(
  options: FetchGlassdoorCommonOptions & {
    location: string | undefined;
    isRemote: boolean;
    csrfToken: string;
  },
): Promise<GlassdoorResolvedLocation> {
  if (options.isRemote || !options.location?.trim()) {
    return { ...GLASSDOOR_REMOTE_LOCATION };
  }

  const url = new URL(GLASSDOOR_LOCATION_LOOKUP_PATH, GLASSDOOR_BASE_URL);
  url.searchParams.set("maxLocationsToReturn", "10");
  url.searchParams.set("term", options.location.trim());

  const response = await getGlassdoorHttp(options).json<GlassdoorLocationLookupItem[]>(url.toString(), {
    headers: createGlassdoorGraphqlHeaders(options.csrfToken),
    proxyUrl: options.proxyUrl,
    timeoutMs: options.timeoutMs,
    caCert: options.caCert,
  });

  const first = response.data[0];
  if (!first) {
    throw new Error(`Location '${options.location}' not found on Glassdoor`);
  }

  const locationType = mapGlassdoorLocationType(first.locationType);
  if (!locationType) {
    throw new Error(`Unsupported Glassdoor location type: ${String(first.locationType)}`);
  }

  const locationId = Number(first.locationId);
  if (!Number.isFinite(locationId)) {
    throw new Error(`Invalid Glassdoor location id: ${String(first.locationId)}`);
  }

  return {
    locationId,
    locationType,
  };
}

export async function fetchGlassdoorJobsPage(
  options: FetchGlassdoorJobsPageOptions,
): Promise<GlassdoorJobsPageResult> {
  const body = JSON.stringify([
    buildGlassdoorSearchOperation(
      options.input,
      options.location,
      options.pageNumber,
      options.cursor,
    ),
  ]);

  const response = await getGlassdoorHttp(options).json<GlassdoorGraphqlEnvelope<GlassdoorSearchGraphqlData>[]>(
    GLASSDOOR_GRAPHQL_URL,
    {
      method: "POST",
      headers: createGlassdoorGraphqlHeaders(options.csrfToken),
      body,
      proxyUrl: options.proxyUrl,
      timeoutMs: options.timeoutMs,
      caCert: options.caCert,
    },
  );

  const envelope = response.data[0];
  if (!envelope) {
    throw new Error("Empty Glassdoor GraphQL search response");
  }
  if (envelope.errors?.length) {
    throw new Error(envelope.errors.map((error) => error.message ?? "Unknown GraphQL error").join("; "));
  }

  const root = envelope.data?.jobListings;
  const jobs = (root?.jobListings ?? []).filter(
    (job): job is GlassdoorSearchJobPayload => Boolean(job),
  );

  return {
    jobs,
    nextCursor: getGlassdoorCursorForPage(root?.paginationCursors ?? [], options.pageNumber + 1),
    totalJobsCount: root?.totalJobsCount ?? null,
    searchTrackingKey: root?.jobSearchTrackingKey ?? null,
  };
}

export async function fetchGlassdoorJobDescription(
  options: FetchGlassdoorCommonOptions & {
    jobId: string;
    csrfToken: string;
  },
): Promise<string | null> {
  const listingId = Number(options.jobId);
  if (!Number.isFinite(listingId)) {
    return null;
  }

  const body = JSON.stringify([
    {
      operationName: "JobDetailQuery",
      variables: {
        jl: listingId,
        queryString: "q",
        pageTypeEnum: "SERP",
      },
      query: GLASSDOOR_DETAIL_QUERY,
    },
  ]);

  const response = await getGlassdoorHttp(options).json<GlassdoorGraphqlEnvelope<GlassdoorDetailGraphqlData>[]>(
    GLASSDOOR_GRAPHQL_URL,
    {
      method: "POST",
      headers: createGlassdoorGraphqlHeaders(options.csrfToken),
      body,
      proxyUrl: options.proxyUrl,
      timeoutMs: options.timeoutMs,
      caCert: options.caCert,
      retry: {
        retries: 1,
      },
    },
  );

  const envelope = response.data[0];
  if (!envelope) {
    return null;
  }
  if (envelope.errors?.length) {
    throw new Error(envelope.errors.map((error) => error.message ?? "Unknown GraphQL error").join("; "));
  }

  return parseGlassdoorDetailDescriptionFromEnvelope(envelope);
}

export function extractGlassdoorCsrfToken(html: string): string | null {
  const match = html.match(/"token"\s*:\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

function getGlassdoorHttp(
  options: FetchGlassdoorCommonOptions,
): Pick<HttpClient, "text" | "json"> {
  return options.tlsSession ?? options.http;
}

function createGlassdoorGraphqlHeaders(csrfToken: string): Record<string, string> {
  return {
    ...GLASSDOOR_GRAPHQL_HEADERS,
    "gd-csrf-token": csrfToken,
  };
}

function buildGlassdoorSearchOperation(
  input: Pick<
    NormalizedScrapeJobsInput,
    "searchTerm" | "hoursOld" | "easyApply" | "jobType"
  >,
  location: GlassdoorResolvedLocation,
  pageNumber: number,
  cursor?: string,
): {
  operationName: string;
  variables: Record<string, unknown>;
  query: string;
} {
  const fromage =
    input.hoursOld && Number.isFinite(input.hoursOld)
      ? Math.max(Math.floor(input.hoursOld / 24), 1)
      : null;

  const variables: Record<string, unknown> = {
    excludeJobListingIds: [],
    keyword: input.searchTerm || undefined,
    filterParams: buildGlassdoorFilterParams(input),
    fromage,
    sort: "date",
    numJobsToShow: GLASSDOOR_JOBS_PER_PAGE,
    locationId: location.locationId,
    locationType: location.locationType,
    parameterUrlInput: `IL.0,12_I${location.locationType}${location.locationId}`,
    pageNumber,
    pageCursor: cursor ?? null,
  };

  return {
    operationName: "JobSearchResultsQuery",
    variables,
    query: GLASSDOOR_SEARCH_QUERY,
  };
}

function buildGlassdoorFilterParams(
  input: Pick<NormalizedScrapeJobsInput, "hoursOld" | "easyApply" | "jobType">,
): Array<{ filterKey: string; values: string }> {
  const filters: Array<{ filterKey: string; values: string }> = [];
  const fromage =
    input.hoursOld && Number.isFinite(input.hoursOld)
      ? Math.max(Math.floor(input.hoursOld / 24), 1)
      : null;

  if (input.easyApply) {
    filters.push({ filterKey: "applicationType", values: "1" });
  }

  if (fromage) {
    filters.push({ filterKey: "fromAge", values: String(fromage) });
  }

  if (input.jobType) {
    filters.push({ filterKey: "jobType", values: input.jobType });
  }

  return filters;
}
