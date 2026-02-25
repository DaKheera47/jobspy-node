import { describe, expect, it } from "vitest";

import {
  inferBaytRemote,
  parseBaytLocation,
  parseBaytSearchPage,
} from "../../../src/sites/bayt/parser";

describe("Bayt parser", () => {
  it("parses bayt search cards", () => {
    const html = `
      <ul>
        <li data-js-job="">
          <h2><a href="/en/uae/jobs/software-engineer-1234567/">Software Engineer</a></h2>
          <div class="t-nowrap p10l"><span>Acme Gulf</span></div>
          <div class="t-mute t-small">Dubai, United Arab Emirates</div>
          <time datetime="2026-02-24T09:30:00Z"></time>
        </li>
      </ul>
    `;

    const jobs = parseBaytSearchPage(html);
    expect(jobs).toHaveLength(1);

    const job = jobs[0];
    expect(job?.site).toBe("bayt");
    expect(job?.id).toBe("bayt-1234567");
    expect(job?.title).toBe("Software Engineer");
    expect(job?.company).toBe("Acme Gulf");
    expect(job?.jobUrl).toBe(
      "https://www.bayt.com/en/uae/jobs/software-engineer-1234567/",
    );
    expect(job?.location).toEqual({
      city: "Dubai",
      state: null,
      country: "United Arab Emirates",
      display: "Dubai, United Arab Emirates",
    });
    expect(job?.datePosted).toBe("2026-02-24T09:30:00.000Z");
  });

  it("parses locations and remote hints", () => {
    expect(parseBaytLocation("Remote, Worldwide")?.country).toBe("Worldwide");
    expect(inferBaytRemote("Senior Engineer", "Hybrid / Remote, UAE")).toBe(true);
  });
});
