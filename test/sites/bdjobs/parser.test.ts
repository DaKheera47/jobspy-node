import { describe, expect, it } from "vitest";

import {
  inferBDJobsRemote,
  parseBDJobsDate,
  parseBDJobsDetailPage,
  parseBDJobsSearchPage,
} from "../../../src/sites/bdjobs/parser";

describe("BDJobs parser", () => {
  it("parses search cards", () => {
    const html = `
      <div class="job-item">
        <h3 class="job-title-text">
          <a href="/jobdetails.asp?id=987654&foo=bar">Senior Backend Engineer (Remote)</a>
        </h3>
        <div class="comp-name-text">Acme Bangladesh Ltd.</div>
        <div class="locon-text-d">Dhaka, Bangladesh</div>
        <div class="deadline">Deadline: 24 Feb 2026</div>
      </div>
    `;

    const jobs = parseBDJobsSearchPage(html);
    expect(jobs).toHaveLength(1);

    const job = jobs[0];
    expect(job?.id).toBe("bdjobs-987654");
    expect(job?.title).toBe("Senior Backend Engineer (Remote)");
    expect(job?.company).toBe("Acme Bangladesh Ltd.");
    expect(job?.jobUrl).toBe(
      "https://jobs.bdjobs.com/jobdetails.asp?id=987654&foo=bar",
    );
    expect(job?.location).toEqual({
      city: "Dhaka",
      state: "Bangladesh",
      country: "Bangladesh",
      display: "Dhaka, Bangladesh",
    });
    expect(job?.datePosted).toBe("2026-02-24T00:00:00.000Z");
    expect(job?.isRemote).toBe(true);
  });

  it("parses detail page description and metadata", () => {
    const details = parseBDJobsDetailPage(
      `
      <div class="jobcontent">
        <h4 id="job_resp">Responsibilities & Context</h4>
        <p>Build APIs and support hiring@acme.com</p>
        <ul><li>Lead backend services</li><li>Mentor engineers</li></ul>
        <h4>Employment Status</h4>
        <div>Full Time</div>
        <h4>Company Business</h4>
        <div>Software Product Company</div>
      </div>
      `,
      "markdown",
    );

    expect(details.description).toContain("Build APIs and support hiring@acme.com");
    expect(details.description).toContain("Lead backend services");
    expect(details.jobType).toEqual(["fulltime"]);
    expect(details.companyIndustry).toBe("Software Product Company");
    expect(details.emails).toContain("hiring@acme.com");
  });

  it("parses dates and remote hints", () => {
    expect(parseBDJobsDate("Published: February 24, 2026")).toBe(
      "2026-02-24T00:00:00.000Z",
    );
    expect(inferBDJobsRemote("Software Engineer", "Work From Home, Dhaka")).toBe(
      true,
    );
  });
});
