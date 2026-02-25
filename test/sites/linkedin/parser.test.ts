import { describe, expect, it } from "vitest";

import {
  parseLinkedInDetailPage,
  parseLinkedInSearchCards,
} from "../../../src/sites/linkedin/parser";

describe("LinkedIn parser", () => {
  it("parses search cards", () => {
    const html = `
      <div class="base-search-card">
        <a class="base-card__full-link" href="https://www.linkedin.com/jobs/view/swe-role-1234567890?trackingId=abc"></a>
        <span class="sr-only">Software Engineer</span>
        <h4 class="base-search-card__subtitle"><a href="https://www.linkedin.com/company/acme?trk=x">Acme</a></h4>
        <div class="base-search-card__metadata">
          <span class="job-search-card__location">San Francisco, CA</span>
          <time class="job-search-card__listdate" datetime="2026-02-24"></time>
        </div>
        <span class="job-search-card__salary-info">$120K-$150K/year</span>
      </div>
    `;

    const cards = parseLinkedInSearchCards(html);
    expect(cards).toHaveLength(1);
    expect(cards[0]?.jobId).toBe("1234567890");
    expect(cards[0]?.title).toBe("Software Engineer");
    expect(cards[0]?.company).toBe("Acme");
    expect(cards[0]?.compensation?.interval).toBe("yearly");
  });

  it("parses detail page", () => {
    const html = `
      <div class="show-more-less-html__markup">Remote friendly role</div>
      <h3 class="description__job-criteria-subheader">Employment type</h3>
      <span class="description__job-criteria-text description__job-criteria-text--criteria">Full-time</span>
      <h3 class="description__job-criteria-subheader">Seniority level</h3>
      <span class="description__job-criteria-text description__job-criteria-text--criteria">Mid-Senior level</span>
      <h3 class="description__job-criteria-subheader">Industries</h3>
      <span class="description__job-criteria-text description__job-criteria-text--criteria">Software Development</span>
      <h3>Job function</h3>
      <span class="description__job-criteria-text">Engineering</span>
      <img class="artdeco-entity-image" data-delayed-url="https://example.com/logo.png" />
      <code id="applyUrl">https://www.linkedin.com/redir?url=https%3A%2F%2Fapply.example%2Fjob</code>
    `;

    const details = parseLinkedInDetailPage(html, "markdown");
    expect(details.jobType).toEqual(["fulltime"]);
    expect(details.jobLevel).toBe("Mid-Senior level");
    expect(details.companyIndustry).toBe("Software Development");
    expect(details.jobFunction).toBe("Engineering");
    expect(details.jobUrlDirect).toBe("https://apply.example/job");
    expect(details.companyLogo).toBe("https://example.com/logo.png");
  });
});

