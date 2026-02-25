import { runScrapeJobs } from "./core/orchestrator";
import type { ScrapeJobsInput, ScrapeJobsResult } from "./types";

export async function scrapeJobs(
  input: ScrapeJobsInput = {},
): Promise<ScrapeJobsResult> {
  return runScrapeJobs(input);
}
