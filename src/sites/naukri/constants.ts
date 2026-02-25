export const NAUKRI_BASE_URL = "https://www.naukri.com";
export const NAUKRI_SEARCH_API_URL = `${NAUKRI_BASE_URL}/jobapi/v3/search`;

export const NAUKRI_PAGE_SIZE = 20;
export const NAUKRI_MAX_PAGES = 50;
export const NAUKRI_DELAY_MS = 3000;
export const NAUKRI_DELAY_BAND_MS = 4000;

export const NAUKRI_HEADERS: Record<string, string> = {
  authority: "www.naukri.com",
  accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
  "accept-language": "en-US,en;q=0.9",
  "cache-control": "max-age=0",
  "upgrade-insecure-requests": "1",
  appid: "109",
  systemid: "Naukri",
  Nkparam:
    "Ppy0YK9uSHqPtG3bEejYc04RTpUN2CjJOrqA68tzQt0SKJHXZKzz9M8cZtKLVkoOuQmfe4cTb1r2CwfHaxW5Tg==",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};
