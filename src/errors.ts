import type { ScrapeJobsResult, SiteScrapeError } from "./types";

export class ScrapeJobsError extends Error {
  public readonly errors: SiteScrapeError[];
  public readonly partialResult: ScrapeJobsResult | undefined;

  public constructor(
    message: string,
    errors: SiteScrapeError[],
    partialResult?: ScrapeJobsResult,
  ) {
    super(message);
    this.name = "ScrapeJobsError";
    this.errors = errors;
    this.partialResult = partialResult;
  }
}
