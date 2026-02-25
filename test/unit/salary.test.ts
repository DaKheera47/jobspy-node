import { describe, expect, it } from "vitest";

import {
  annualizeCompensation,
  extractUsdSalaryFromDescription,
} from "../../src/core/salary";

describe("salary utilities", () => {
  it("annualizes hourly compensation", () => {
    expect(
      annualizeCompensation({
        interval: "hourly",
        minAmount: 50,
        maxAmount: 60,
        currency: "USD",
      }),
    ).toMatchObject({
      interval: "yearly",
      minAmount: 104000,
      maxAmount: 124800,
    });
  });

  it("extracts yearly salary range", () => {
    const result = extractUsdSalaryFromDescription(
      "Compensation: $120,000 - $150,000 per year",
    );
    expect(result).toMatchObject({
      interval: "yearly",
      minAmount: 120000,
      maxAmount: 150000,
      salarySource: "description",
    });
  });

  it("extracts and annualizes hourly salary", () => {
    const result = extractUsdSalaryFromDescription(
      "Pay: $45 to $55 per hour",
      { enforceAnnualSalary: true },
    );
    expect(result).toMatchObject({
      interval: "yearly",
      minAmount: 93600,
      maxAmount: 114400,
    });
  });
});

