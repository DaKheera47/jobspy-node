import { describe, expect, it } from "vitest";

import { scrapeJobs } from "../../src/scrapeJobs";

const liveEnabled = process.env.LIVE_SCRAPE === "1";
const describeLive = liveEnabled ? describe : describe.skip;

describeLive("live smoke", () => {
  it(
    "runs a small indeed scrape without crashing",
    async () => {
      const result = await scrapeJobs({
        siteName: ["indeed"],
        searchTerm: "software engineer",
        location: "San Francisco, CA",
        resultsWanted: 2,
      });

      expect(Array.isArray(result.jobs)).toBe(true);
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.meta.sitesRequested).toEqual(["indeed"]);
    },
    60_000,
  );
});

