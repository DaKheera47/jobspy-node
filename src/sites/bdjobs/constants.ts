export const BDJOBS_BASE_URL = "https://jobs.bdjobs.com";
export const BDJOBS_SEARCH_URL = `${BDJOBS_BASE_URL}/jobsearch.asp`;

export const BDJOBS_HEADERS: Record<string, string> = {
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "max-age=0",
  connection: "keep-alive",
  referer: `${BDJOBS_BASE_URL}/`,
  "upgrade-insecure-requests": "1",
  "user-agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
};

export const BDJOBS_DEFAULT_SEARCH_PARAMS: Record<string, string> = {
  hidJobSearch: "jobsearch",
};

export const BDJOBS_SEARCH_CARD_SELECTORS = [
  "div.job-item",
  "div.sout-jobs-wrapper",
  "div.norm-jobs-wrapper",
  "div.featured-wrap",
  "article.job-item",
] as const;

export const BDJOBS_DELAY_MS = 2000;
export const BDJOBS_DELAY_BAND_MS = 3000;

