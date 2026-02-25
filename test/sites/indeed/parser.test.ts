import { describe, expect, it } from "vitest";

import { parseIndeedJob } from "../../../src/sites/indeed/parser";

describe("Indeed parser", () => {
  it("maps indeed graphql job payload to JobPost", () => {
    const parsed = parseIndeedJob(
      {
        key: "abc123",
        title: "Software Engineer",
        datePublished: Date.parse("2026-02-24T12:00:00Z"),
        description: {
          html: "<div>Remote role. Contact hiring@acme.com</div>",
        },
        location: {
          city: "San Francisco",
          admin1Code: "CA",
          countryCode: "US",
          formatted: { long: "San Francisco, CA" },
        },
        attributes: [{ label: "Full-time" }, { label: "Remote" }],
        compensation: {
          baseSalary: {
            unitOfWork: "YEAR",
            range: { min: 120000, max: 150000 },
          },
          currencyCode: "USD",
        },
        employer: {
          name: "Acme",
          relativeCompanyPageUrl: "/cmp/Acme",
          dossier: {
            employerDetails: {
              industry: "software_services",
            },
            images: {
              squareLogoUrl: "https://example.com/logo.png",
            },
            links: {
              corporateWebsite: "https://acme.example",
            },
          },
        },
        recruit: {
          viewJobUrl: "https://apply.example/jobs/abc123",
        },
        source: {
          name: "Indeed",
        },
      },
      {
        baseUrl: "https://www.indeed.com",
        descriptionFormat: "markdown",
      },
    );

    expect(parsed.site).toBe("indeed");
    expect(parsed.id).toBe("in-abc123");
    expect(parsed.jobUrl).toContain("/viewjob?jk=abc123");
    expect(parsed.company).toBe("Acme");
    expect(parsed.isRemote).toBe(true);
    expect(parsed.jobType).toEqual(["fulltime"]);
    expect(parsed.compensation?.interval).toBe("yearly");
    expect(parsed.emails).toContain("hiring@acme.com");
  });
});

