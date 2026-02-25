import { describe, expect, it } from "vitest";

import {
  formatGlassdoorDescription,
  getGlassdoorCursorForPage,
  mapGlassdoorLocationType,
  parseGlassdoorCompensation,
  parseGlassdoorDetailDescriptionFromEnvelope,
  parseGlassdoorJob,
  parseGlassdoorLocation,
} from "../../../src/sites/glassdoor/parser";

describe("Glassdoor parser", () => {
  it("maps Glassdoor search payload plus detail description into a JobPost", () => {
    const parsed = parseGlassdoorJob(
      {
        jobview: {
          header: {
            employerNameFromSearch: "Acme",
            employer: { id: 42, name: "Acme Corp" },
            jobTitleText: "Senior Backend Engineer",
            locationName: "San Francisco, CA",
            locationType: "C",
            ageInDays: 2,
            adOrderSponsorshipLevel: "SPONSORED",
            payCurrency: "USD",
            payPeriod: "ANNUAL",
            payPeriodAdjustedPay: {
              p10: 145000.8,
              p90: 198999.2,
            },
            rating: 4.3,
            salarySource: "EMPLOYER_PROVIDED",
            jobResultTrackingKey: "trk-123",
            easyApply: true,
          },
          job: {
            listingId: 987654321,
            jobTitleText: "Senior Backend Engineer",
            description: "<div>Fallback description</div>",
          },
          overview: {
            squareLogoUrl: "https://cdn.example.com/logo.png",
            shortName: "acme",
          },
        },
      },
      {
        baseUrl: "https://www.glassdoor.com",
        now: new Date("2026-02-25T12:00:00Z"),
        descriptionFormat: "markdown",
        descriptionHtml:
          "<section><p>Remote-friendly team.</p><p>Email jobs@acme.com</p></section>",
      },
    );

    expect(parsed).not.toBeNull();
    expect(parsed?.site).toBe("glassdoor");
    expect(parsed?.id).toBe("gd-987654321");
    expect(parsed?.jobUrl).toBe("https://www.glassdoor.com/job-listing/j?jl=987654321");
    expect(parsed?.company).toBe("Acme");
    expect(parsed?.companyUrl).toBe("https://www.glassdoor.com/Overview/W-EI_IE42.htm");
    expect(parsed?.companyLogo).toBe("https://cdn.example.com/logo.png");
    expect(parsed?.companyRating).toBe(4.3);
    expect(parsed?.location).toEqual({
      city: "San Francisco",
      state: "CA",
      country: null,
      display: "San Francisco, CA",
    });
    expect(parsed?.isRemote).toBe(false);
    expect(parsed?.compensation).toEqual({
      interval: "yearly",
      minAmount: 145000,
      maxAmount: 198999,
      currency: "USD",
      salarySource: "direct_data",
    });
    expect(parsed?.datePosted).toBe("2026-02-23T12:00:00.000Z");
    expect(parsed?.listingType).toBe("sponsored");
    expect(parsed?.description).toContain("Remote-friendly team.");
    expect(parsed?.emails).toEqual(["jobs@acme.com"]);
  });

  it("treats locationType S as remote and preserves html descriptions when requested", () => {
    const parsed = parseGlassdoorJob(
      {
        jobview: {
          header: {
            employerNameFromSearch: "Globex",
            jobTitleText: "Customer Support Specialist",
            locationName: "Remote",
            locationType: "S",
            ageInDays: 0,
            jobLink: "https://apply.globex.example/jobs/123",
          },
          job: {
            listingId: "123",
          },
        },
      },
      {
        baseUrl: "https://www.glassdoor.com",
        now: new Date("2026-02-25T00:00:00Z"),
        descriptionFormat: "html",
        descriptionHtml: "<div>Write to hiring@globex.example</div>",
      },
    );

    expect(parsed?.isRemote).toBe(true);
    expect(parsed?.location).toBeNull();
    expect(parsed?.description).toBe("<div>Write to hiring@globex.example</div>");
    expect(parsed?.emails).toEqual(["hiring@globex.example"]);
    expect(parsed?.externalApplyUrl).toBe("https://apply.globex.example/jobs/123");
    expect(parsed?.jobUrlDirect).toBe("https://apply.globex.example/jobs/123");
  });

  it("parses helper data for location, compensation, cursors, and detail envelopes", () => {
    expect(parseGlassdoorLocation("Toronto, ON, Canada")).toEqual({
      city: "Toronto",
      state: "ON",
      country: "Canada",
      display: "Toronto, ON, Canada",
    });
    expect(parseGlassdoorLocation("Remote")).toBeNull();

    expect(
      parseGlassdoorCompensation({
        payPeriod: "HOURLY",
        payCurrency: "USD",
        payPeriodAdjustedPay: { p10: 50.9, p90: 75.2 },
      }),
    ).toEqual({
      interval: "hourly",
      minAmount: 50,
      maxAmount: 75,
      currency: "USD",
      salarySource: "direct_data",
    });

    expect(getGlassdoorCursorForPage([{ pageNumber: 2, cursor: "abc" }], 2)).toBe("abc");
    expect(getGlassdoorCursorForPage([{ pageNumber: 2, cursor: "abc" }], 3)).toBeUndefined();

    expect(mapGlassdoorLocationType("C")).toBe("CITY");
    expect(mapGlassdoorLocationType("S")).toBe("STATE");
    expect(mapGlassdoorLocationType("N")).toBe("COUNTRY");
    expect(mapGlassdoorLocationType("X")).toBeNull();

    expect(
      parseGlassdoorDetailDescriptionFromEnvelope({
        data: { jobview: { job: { description: "<p>Hi</p>" } } },
      }),
    ).toBe("<p>Hi</p>");
    expect(parseGlassdoorDetailDescriptionFromEnvelope({ errors: [] })).toBeNull();

    expect(formatGlassdoorDescription("<div>hello</div>", "markdown")).toBe("hello");
    expect(formatGlassdoorDescription("<div>hello</div>", "html")).toBe("<div>hello</div>");
  });
});

