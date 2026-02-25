import { describe, expect, it } from "vitest";

import {
  JobPostSchema,
  ScrapeJobsInputSchema,
  ScrapeJobsResultSchema,
  type ScrapeJobsResult,
} from "../../src/types";

describe("runtime schemas", () => {
  it("accepts a valid scrape input", () => {
    const parsed = ScrapeJobsInputSchema.parse({
      siteName: ["indeed", "linkedin"],
      searchTerm: "software engineer",
      resultsWanted: 20,
      strict: false,
    });

    expect(parsed.siteName).toEqual(["indeed", "linkedin"]);
  });

  it("validates a job post", () => {
    const job = JobPostSchema.parse({
      site: "indeed",
      title: "Software Engineer",
      company: "Acme",
      jobUrl: "https://example.com/job/1",
      datePosted: "2026-02-25T00:00:00.000Z",
    });

    expect(job.title).toBe("Software Engineer");
  });

  it("validates a result envelope", () => {
    const result: ScrapeJobsResult = {
      jobs: [],
      errors: [],
      meta: {
        startedAt: "2026-02-25T00:00:00.000Z",
        endedAt: "2026-02-25T00:00:00.500Z",
        durationMs: 500,
        partial: false,
        sitesRequested: ["indeed"],
        sitesSucceeded: ["indeed"],
        sitesFailed: [],
        perSite: [
          {
            site: "indeed",
            requested: 10,
            returned: 0,
            durationMs: 500,
            warnings: [],
          },
        ],
        warnings: [],
      },
    };

    expect(() => ScrapeJobsResultSchema.parse(result)).not.toThrow();
  });
});
