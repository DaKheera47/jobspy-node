export const INDEED_GRAPHQL_URL = "https://apis.indeed.com/graphql";

export const INDEED_API_HEADERS: Record<string, string> = {
  host: "apis.indeed.com",
  "content-type": "application/json",
  "indeed-api-key":
    "161092c2017b5bbab13edb12461a62d5a833871e7cad6d9d475304573de67ac8",
  accept: "application/json",
  "indeed-locale": "en-US",
  "accept-language": "en-US,en;q=0.9",
  "user-agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_6_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Indeed App 193.1",
  "indeed-app-info":
    "appv=193.1; appid=com.indeed.jobsearch; osv=16.6.1; os=ios; dtype=phone",
};

export const INDEED_JOB_SEARCH_QUERY_FIELDS = `
pageInfo {
  nextCursor
}
results {
  trackingKey
  job {
    source { name }
    key
    title
    datePublished
    dateOnIndeed
    description { html }
    location {
      countryName
      countryCode
      admin1Code
      city
      postalCode
      streetAddress
      formatted { short long }
    }
    compensation {
      estimated {
        currencyCode
        baseSalary {
          unitOfWork
          range {
            ... on Range {
              min
              max
            }
          }
        }
      }
      baseSalary {
        unitOfWork
        range {
          ... on Range {
            min
            max
          }
        }
      }
      currencyCode
    }
    attributes { key label }
    employer {
      relativeCompanyPageUrl
      name
      dossier {
        employerDetails {
          addresses
          industry
          employeesLocalizedLabel
          revenueLocalizedLabel
          briefDescription
          ceoName
          ceoPhotoUrl
        }
        images {
          headerImageUrl
          squareLogoUrl
        }
        links {
          corporateWebsite
        }
      }
    }
    recruit {
      viewJobUrl
      detailedSalary
      workSchedule
    }
  }
}
`.trim();

export interface IndeedCountryConfig {
  countryInput: string;
  coHeader: string;
  domainPrefix: string;
}

const COUNTRY_MAP: Record<string, IndeedCountryConfig> = {
  USA: { countryInput: "USA", coHeader: "us", domainPrefix: "www" },
  US: { countryInput: "US", coHeader: "us", domainPrefix: "www" },
  CANADA: { countryInput: "CANADA", coHeader: "ca", domainPrefix: "ca" },
  CA: { countryInput: "CA", coHeader: "ca", domainPrefix: "ca" },
  UK: { countryInput: "UK", coHeader: "gb", domainPrefix: "uk" },
  "UNITED KINGDOM": {
    countryInput: "UNITED KINGDOM",
    coHeader: "gb",
    domainPrefix: "uk",
  },
  INDIA: { countryInput: "INDIA", coHeader: "in", domainPrefix: "in" },
  IN: { countryInput: "IN", coHeader: "in", domainPrefix: "in" },
};

export function resolveIndeedCountryConfig(
  countryInput: string | undefined,
): IndeedCountryConfig {
  const normalized = (countryInput ?? "USA").trim().toUpperCase();
  const mapped = COUNTRY_MAP[normalized];
  if (mapped) {
    return mapped;
  }

  const twoLetter = normalized.replace(/[^A-Z]/g, "").slice(0, 2).toLowerCase();
  return {
    countryInput: normalized,
    coHeader: twoLetter || "us",
    domainPrefix: twoLetter || "www",
  };
}

