import { describe, expect, it } from "vitest";

import { scrapeJobs } from "../../src";

describe("package scaffold", () => {
  it("exports scrapeJobs", () => {
    expect(typeof scrapeJobs).toBe("function");
  });
});
