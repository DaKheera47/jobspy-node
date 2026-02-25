export const GLASSDOOR_BASE_URL = "https://www.glassdoor.com";
export const GLASSDOOR_GRAPHQL_URL = `${GLASSDOOR_BASE_URL}/graph`;
export const GLASSDOOR_LOCATION_LOOKUP_PATH = "/findPopularLocationAjax.htm";
export const GLASSDOOR_CSRF_BOOTSTRAP_PATH = "/Job/computer-science-jobs.htm";

export const GLASSDOOR_JOBS_PER_PAGE = 30;
export const GLASSDOOR_MAX_PAGES = 30;

export const GLASSDOOR_REMOTE_LOCATION = {
  locationId: 11047,
  locationType: "STATE" as const,
};

export const GLASSDOOR_FALLBACK_CSRF_TOKEN =
  "Ft6oHEWlRZrxDww95Cpazw:0pGUrkb2y3TyOpAIqF2vbPmUXoXVkD3oEGDVkvfeCerceQ5-n8mBg3BovySUIjmCPHCaW0H2nQVdqzbtsYqf4Q:wcqRqeegRUa9MVLJGyujVXB7vWFPjdaS1CtrrzJq-ok";

export const GLASSDOOR_GRAPHQL_HEADERS: Record<string, string> = {
  accept: "application/json",
  "accept-language": "en-US,en;q=0.9",
  "content-type": "application/json",
  origin: GLASSDOOR_BASE_URL,
  referer: `${GLASSDOOR_BASE_URL}/`,
  "apollographql-client-name": "job-search-next",
  "apollographql-client-version": "4.65.5",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
  "sec-fetch-dest": "empty",
  "sec-fetch-mode": "cors",
  "sec-fetch-site": "same-origin",
};

export const GLASSDOOR_PAGE_HEADERS: Record<string, string> = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  referer: `${GLASSDOOR_BASE_URL}/`,
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
};

export const GLASSDOOR_SEARCH_QUERY = `
  query JobSearchResultsQuery(
    $excludeJobListingIds: [Long!]
    $keyword: String
    $locationId: Int
    $locationType: LocationTypeEnum
    $numJobsToShow: Int!
    $pageCursor: String
    $pageNumber: Int
    $filterParams: [FilterParams]
    $parameterUrlInput: String
  ) {
    jobListings(
      contextHolder: {
        searchParams: {
          excludeJobListingIds: $excludeJobListingIds
          keyword: $keyword
          locationId: $locationId
          locationType: $locationType
          numPerPage: $numJobsToShow
          pageCursor: $pageCursor
          pageNumber: $pageNumber
          filterParams: $filterParams
          parameterUrlInput: $parameterUrlInput
          searchType: SR
        }
      }
    ) {
      jobSearchTrackingKey
      totalJobsCount
      paginationCursors {
        cursor
        pageNumber
      }
      jobListings {
        jobview {
          header {
            adOrderSponsorshipLevel
            ageInDays
            easyApply
            employer {
              id
              name
            }
            employerNameFromSearch
            jobLink
            jobResultTrackingKey
            jobTitleText
            locationName
            locationType
            payCurrency
            payPeriod
            payPeriodAdjustedPay {
              p10
              p90
            }
            rating
            salarySource
          }
          job {
            listingId
            jobTitleText
            description
          }
          overview {
            shortName
            squareLogoUrl
          }
        }
      }
    }
  }
`.trim();

export const GLASSDOOR_DETAIL_QUERY = `
  query JobDetailQuery($jl: Long!, $queryString: String, $pageTypeEnum: PageTypeEnum) {
    jobview: jobView(
      listingId: $jl
      contextHolder: { queryString: $queryString, pageTypeEnum: $pageTypeEnum }
    ) {
      job {
        description
      }
    }
  }
`.trim();
