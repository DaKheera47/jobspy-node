import { describe, expect, it } from "vitest";

import { toCsv } from "../../src/utils/toCsv";
import { toJsonl } from "../../src/utils/toJsonl";

describe("utility serializers", () => {
  const rows = [
    {
      site: "indeed" as const,
      title: "Software Engineer",
      company: "Acme",
      jobUrl: "https://example.com/job/1",
      location: { display: "Austin, TX" },
      jobType: ["fulltime"] as const,
      compensation: { interval: "yearly" as const, minAmount: 100000 },
      metadata: { source: "fixture" },
    },
  ];

  it("serializes csv", () => {
    const csv = toCsv(rows as never);
    expect(csv).toContain("site");
    expect(csv).toContain("indeed");
    expect(csv).toContain("Austin, TX");
  });

  it("serializes jsonl", () => {
    const jsonl = toJsonl(rows as never);
    expect(jsonl.split("\n")).toHaveLength(1);
    expect(jsonl).toContain("\"site\":\"indeed\"");
  });
});

