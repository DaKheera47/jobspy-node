import { describe, expect, it } from "vitest";

import {
  parseGoogleAsyncJobsPage,
  parseGoogleInitialJobsPage,
} from "../../../src/sites/google/parser";

describe("Google parser", () => {
  it("parses initial Google Jobs page HTML and extracts cursor + jobs", () => {
    const now = new Date("2026-02-25T12:00:00.000Z");
    const jobInfo = createGoogleJobInfoFixture({
      id: "12345",
      title: "Software Engineer",
      company: "Acme",
      location: "Austin, TX, USA",
      jobUrl: "https://jobs.example.com/role/12345",
      postedText: "2 days ago",
      description:
        "Remote full-time role. Contact hiring@acme.com for details.",
    });

    const html = `
      <html>
        <body>
          <div jsname="Yust4d" data-async-fc="cursor-initial-abc"></div>
          <script>
            window.__TEST__ = {"520084652":${JSON.stringify([jobInfo])}}]]]]];
          </script>
        </body>
      </html>
    `;

    const parsed = parseGoogleInitialJobsPage(html, { now });
    expect(parsed.nextCursor).toBe("cursor-initial-abc");
    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.jobs[0]).toMatchObject({
      id: "go-12345",
      site: "google",
      title: "Software Engineer",
      company: "Acme",
      jobUrl: "https://jobs.example.com/role/12345",
      isRemote: true,
      jobType: ["fulltime"],
    });
    expect(parsed.jobs[0]?.location).toEqual({
      city: "Austin",
      state: "TX",
      country: "USA",
      display: "Austin, TX, USA",
    });
    expect(parsed.jobs[0]?.emails).toEqual(["hiring@acme.com"]);
    expect(parsed.jobs[0]?.datePosted?.startsWith("2026-02-23")).toBe(true);
  });

  it("parses Google async jobs payload and finds nested job info recursively", () => {
    const now = new Date("2026-02-25T12:00:00.000Z");
    const jobInfo = createGoogleJobInfoFixture({
      id: "abcxyz",
      title: "Data Analyst",
      company: "Beta Corp",
      location: "Chicago, IL",
      jobUrl: "https://jobs.example.com/role/999",
      postedText: "yesterday",
      description: "Part time contract opportunity. Onsite.",
    });

    const nestedPayload = JSON.stringify([
      [
        [
          {
            someNestedNode: [
              {
                "520084652": [jobInfo],
              },
            ],
          },
        ],
      ],
    ]);

    const asyncFragment = JSON.stringify([
      [
        [0, nestedPayload],
        [1, "ignored"],
      ],
    ]);

    const payload = `
      )]}'
      ${asyncFragment}
      <div data-async-fc="cursor-next-2"></div>
    `;

    const parsed = parseGoogleAsyncJobsPage(payload, { now });
    expect(parsed.nextCursor).toBe("cursor-next-2");
    expect(parsed.jobs).toHaveLength(1);
    expect(parsed.jobs[0]).toMatchObject({
      id: "go-abcxyz",
      title: "Data Analyst",
      company: "Beta Corp",
      isRemote: false,
      jobType: ["parttime", "contract"],
    });
    expect(parsed.jobs[0]?.location?.city).toBe("Chicago");
    expect(parsed.jobs[0]?.location?.state).toBe("IL");
    expect(parsed.jobs[0]?.datePosted?.startsWith("2026-02-24")).toBe(true);
  });
});

interface GoogleJobInfoFixture {
  id: string;
  title: string;
  company: string;
  location: string;
  jobUrl: string;
  postedText: string;
  description: string;
}

function createGoogleJobInfoFixture(fixture: GoogleJobInfoFixture): unknown[] {
  const jobInfo = Array.from<unknown>({ length: 29 }).fill(null);
  jobInfo[0] = fixture.title;
  jobInfo[1] = fixture.company;
  jobInfo[2] = fixture.location;
  jobInfo[3] = [[fixture.jobUrl]];
  jobInfo[12] = fixture.postedText;
  jobInfo[19] = fixture.description;
  jobInfo[28] = fixture.id;
  return jobInfo;
}

