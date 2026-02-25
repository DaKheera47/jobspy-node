import { describe, expect, it } from "vitest";

import { SiteRegistry } from "../../src/core/siteRegistry";
import type { SiteScraper } from "../../src/core/types";
import { ScrapeJobsError } from "../../src/errors";
import { scrapeJobs } from "../../src/scrapeJobs";

function fixedClock(start = new Date("2026-02-25T00:00:00.000Z")) {
  let current = start.getTime();
  return () => {
    current += 25;
    return new Date(current);
  };
}

describe("orchestrator", () => {
  it("returns partial success with per-site errors", async () => {
    const okScraper: SiteScraper = {
      site: "indeed",
      async scrape() {
        return {
          jobs: [
            {
              site: "indeed",
              title: "Software Engineer",
              company: "Acme",
              jobUrl: "https://example.com/1",
              description: "Pay range $100,000 - $130,000 annually",
            },
          ],
        };
      },
    };
    const failingScraper: SiteScraper = {
      site: "linkedin",
      async scrape() {
        throw new Error("linkedin parser changed");
      },
    };

    const registry = new SiteRegistry([okScraper, failingScraper]);
    const result = await import("../../src/core/orchestrator").then(({ runScrapeJobs }) =>
      runScrapeJobs(
        {
          siteName: ["indeed", "linkedin"],
          searchTerm: "software engineer",
          resultsWanted: 10,
        },
        { registry, now: fixedClock() },
      ),
    );

    expect(result.jobs).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.site).toBe("linkedin");
    expect(result.meta.partial).toBe(true);
    expect(result.jobs[0]?.compensation?.salarySource).toBe("description");
  });

  it("throws in strict mode with partial result attached", async () => {
    const failingScraper: SiteScraper = {
      site: "indeed",
      async scrape() {
        throw new Error("boom");
      },
    };

    const registry = new SiteRegistry([failingScraper]);
    await expect(
      import("../../src/core/orchestrator").then(({ runScrapeJobs }) =>
        runScrapeJobs(
          {
            siteName: ["indeed"],
            searchTerm: "software engineer",
            strict: true,
          },
          { registry, now: fixedClock() },
        ),
      ),
    ).rejects.toBeInstanceOf(ScrapeJobsError);
  });

  it("public scrapeJobs returns structured errors for default unimplemented sites", async () => {
    const result = await scrapeJobs({ searchTerm: "software engineer", siteName: ["indeed"] });
    expect(result.meta.partial).toBe(true);
    expect(result.errors[0]?.site).toBe("indeed");
  });
});

