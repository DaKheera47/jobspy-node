import type { Compensation, CompensationInterval } from "../types";

const ANNUALIZATION_FACTORS: Record<Exclude<CompensationInterval, "yearly">, number> =
  {
    hourly: 2080,
    daily: 260,
    weekly: 52,
    monthly: 12,
  };

export function annualizeCompensation(
  compensation: Compensation,
): Compensation {
  const interval = compensation.interval;
  if (
    !interval ||
    interval === "yearly" ||
    compensation.minAmount == null ||
    compensation.maxAmount == null
  ) {
    return compensation;
  }

  const factor = ANNUALIZATION_FACTORS[interval];
  if (!factor) {
    return compensation;
  }

  return {
    ...compensation,
    interval: "yearly",
    minAmount: Math.round(compensation.minAmount * factor),
    maxAmount: Math.round(compensation.maxAmount * factor),
  };
}

interface SalaryParseOptions {
  enforceAnnualSalary?: boolean;
}

export function extractUsdSalaryFromDescription(
  description: string | null | undefined,
  options: SalaryParseOptions = {},
): Compensation | undefined {
  if (!description) {
    return undefined;
  }

  const normalized = description.replace(/,/g, "");
  const rangeMatch =
    normalized.match(
      /\$?\s?(\d{1,3}(?:\d{3})+|\d{2,6})(?:\.\d+)?\s*(?:-|to)\s*\$?\s?(\d{1,3}(?:\d{3})+|\d{2,6})(?:\.\d+)?/i,
    ) ?? undefined;
  const singleMatch =
    rangeMatch ||
    normalized.match(/\$?\s?(\d{1,3}(?:\d{3})+|\d{2,6})(?:\.\d+)?/i) ||
    undefined;

  if (!singleMatch) {
    return undefined;
  }

  const minAmount = Number(singleMatch[1]);
  const maxAmount = Number(singleMatch[2] ?? singleMatch[1]);
  if (!Number.isFinite(minAmount) || !Number.isFinite(maxAmount)) {
    return undefined;
  }

  let interval: CompensationInterval = "yearly";
  const nearbyWindow = normalized.slice(
    Math.max(0, singleMatch.index ?? 0),
    Math.min(
      normalized.length,
      (singleMatch.index ?? 0) + (singleMatch[0]?.length ?? 0) + 50,
    ),
  );
  if (/hour|hr\b/i.test(nearbyWindow)) {
    interval = "hourly";
  } else if (/day\b|daily/i.test(nearbyWindow)) {
    interval = "daily";
  } else if (/week|weekly/i.test(nearbyWindow)) {
    interval = "weekly";
  } else if (/month|monthly/i.test(nearbyWindow)) {
    interval = "monthly";
  }

  let compensation: Compensation = {
    interval,
    minAmount,
    maxAmount,
    currency: "USD",
    salarySource: "description",
  };

  if (options.enforceAnnualSalary) {
    compensation = annualizeCompensation(compensation);
  }

  if (compensation.minAmount == null || compensation.minAmount < 1000) {
    return undefined;
  }

  if (compensation.maxAmount == null || compensation.maxAmount > 700_000) {
    return undefined;
  }

  return compensation;
}

