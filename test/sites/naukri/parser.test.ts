import { describe, expect, it } from "vitest";

import {
  inferNaukriRemote,
  inferNaukriWorkFromHomeType,
  parseNaukriCompensation,
  parseNaukriDatePosted,
  parseNaukriJob,
  parseNaukriLocation,
} from "../../../src/sites/naukri/parser";

describe("Naukri parser", () => {
  it("parses salary placeholders in Indian lakh format", () => {
    const compensation = parseNaukriCompensation([
      { type: "salary", label: "12-16 Lacs P.A." },
    ]);

    expect(compensation?.currency).toBe("INR");
    expect(compensation?.interval).toBe("yearly");
    expect(compensation?.minAmount).toBe(1_200_000);
    expect(compensation?.maxAmount).toBe(1_600_000);
  });

  it("parses relative and fallback timestamp dates", () => {
    const now = new Date("2026-02-25T12:00:00.000Z");

    expect(parseNaukriDatePosted("2 days ago", null, now)).toBe(
      "2026-02-23T12:00:00.000Z",
    );
    expect(
      parseNaukriDatePosted(null, 1_771_940_800_000, now)?.startsWith("2026-02-"),
    ).toBe(true);
  });

  it("parses location and defaults country to INDIA", () => {
    const withLocation = parseNaukriLocation([
      { type: "location", label: "Bengaluru, Karnataka" },
    ]);
    const withoutLocation = parseNaukriLocation([]);

    expect(withLocation).toEqual({
      city: "Bengaluru",
      state: "Karnataka",
      country: "INDIA",
      display: "Bengaluru, Karnataka",
    });
    expect(withoutLocation?.country).toBe("INDIA");
    expect(withoutLocation?.display).toBeNull();
  });

  it("parses a Naukri job payload into JobPost fields", () => {
    const parsed = parseNaukriJob(
      {
        jobId: "12345",
        title: "Senior Backend Engineer (Hybrid)",
        companyName: "Acme Labs",
        staticUrl: "acme-labs-jobs-careers-1234",
        placeholders: [
          { type: "location", label: "Bengaluru, Karnataka" },
          { type: "salary", label: "18-24 Lacs P.A." },
        ],
        footerPlaceholderLabel: "Today",
        createdDate: 1_771_940_800_000,
        jdURL: "/job-listings-senior-backend-engineer-acme-labs-12345",
        jobDescription: `
          <div>
            <span class="job-type">Full-time</span>
            <span class="industry">Software Development</span>
            Work from home for 2 days a week. Contact hiring@acme.example
          </div>
        `,
        logoPathV3: "https://img.naukimg.com/logo.png",
        tagsAndSkills: "Node.js, TypeScript, APIs",
        experienceText: "5-9 Yrs",
        ambitionBoxData: {
          AggregateRating: "4.2",
          ReviewsCount: "213",
        },
        vacancy: "3",
      },
      {
        descriptionFormat: "markdown",
        now: new Date("2026-02-25T12:00:00.000Z"),
      },
    );

    expect(parsed.site).toBe("naukri");
    expect(parsed.id).toBe("nk-12345");
    expect(parsed.companyUrl).toBe(
      "https://www.naukri.com/acme-labs-jobs-careers-1234",
    );
    expect(parsed.jobUrl).toContain("/job-listings-senior-backend-engineer-acme-labs-12345");
    expect(parsed.location?.country).toBe("INDIA");
    expect(parsed.compensation?.minAmount).toBe(1_800_000);
    expect(parsed.compensation?.maxAmount).toBe(2_400_000);
    expect(parsed.jobType).toEqual(["fulltime"]);
    expect(parsed.companyIndustry).toBe("Software Development");
    expect(parsed.skills).toEqual(["Node.js", "TypeScript", "APIs"]);
    expect(parsed.companyRating).toBe(4.2);
    expect(parsed.companyReviewsCount).toBe(213);
    expect(parsed.vacancyCount).toBe(3);
    expect(parsed.isRemote).toBe(true);
    expect(parsed.workFromHomeType).toBe("Hybrid");
    expect(parsed.emails).toContain("hiring@acme.example");
    expect(parsed.description).toContain("Work from home");
  });

  it("preserves html description when requested", () => {
    const parsed = parseNaukriJob(
      {
        jobId: "999",
        title: "Office Administrator",
        companyName: "Desk Co",
        placeholders: [{ type: "location", label: "Pune, Maharashtra" }],
        footerPlaceholderLabel: "3 days ago",
        jobDescription: "<div><p>Work from office role</p></div>",
      },
      { descriptionFormat: "html", now: new Date("2026-02-25T12:00:00.000Z") },
    );

    expect(parsed.description).toBe("<div><p>Work from office role</p></div>");
    expect(parsed.workFromHomeType).toBe("Work from office");
    expect(parsed.isRemote).toBe(false);
  });

  it("infers remote and work from home type from combined text", () => {
    expect(
      inferNaukriRemote(
        "Software Engineer",
        "WFH role with occasional office visits",
        "Bengaluru, Karnataka",
      ),
    ).toBe(true);
    expect(
      inferNaukriWorkFromHomeType(
        [{ type: "location", label: "Hybrid - Bengaluru" }],
        "Software Engineer",
        "Collaborative role",
      ),
    ).toBe("Hybrid");
  });
});
