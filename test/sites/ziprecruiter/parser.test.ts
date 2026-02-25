import { describe, expect, it } from "vitest";

import {
  parseZipRecruiterDetailPage,
  parseZipRecruiterJob,
} from "../../../src/sites/ziprecruiter/parser";

describe("ZipRecruiter parser", () => {
  it("parses API job payload", () => {
    const parsed = parseZipRecruiterJob(
      {
        listing_key: "xyz123",
        name: "Backend Engineer",
        buyer_type: "organic",
        job_description: "<div>Apply via team@acme.com</div>",
        hiring_company: { name: "Acme" },
        job_country: "US",
        job_city: "Austin",
        job_state: "TX",
        employment_type: "full_time",
        posted_time: "2026-02-24T10:30:00Z",
        compensation_interval: "annual",
        compensation_min: 140000,
        compensation_max: 170000,
        compensation_currency: "USD",
      },
      "markdown",
    );

    expect(parsed.site).toBe("zip_recruiter");
    expect(parsed.id).toBe("zr-xyz123");
    expect(parsed.jobType).toEqual(["fulltime"]);
    expect(parsed.compensation?.interval).toBe("yearly");
    expect(parsed.emails).toContain("team@acme.com");
  });

  it("parses detail page description and direct url", () => {
    const details = parseZipRecruiterDetailPage(
      `
      <div class="job_description"><p>Main role desc</p></div>
      <section class="company_description"><p>About company</p></section>
      <script type="application/json">
        {"model":{"saveJobURL":"https://www.ziprecruiter.com/?job_url=https%3A%2F%2Fapply.example%2Fzr"}}
      </script>
      `,
      "markdown",
    );

    expect(details.description).toContain("Main role desc");
    expect(details.description).toContain("About company");
    expect(details.directUrl).toBe("https://apply.example/zr");
  });
});

