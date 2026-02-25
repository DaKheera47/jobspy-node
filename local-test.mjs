import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { scrapeJobs, toCsv } from "./dist/index.js";

const parseList = (value, fallback) => {
  if (!value) return fallback;
  const list = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return list.length > 0 ? list : fallback;
};

const parseNumber = (value, fallback) => {
  if (value == null || value === "") return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const config = {
  siteName: parseList(process.env.SITES, ["indeed"]),
  searchTerm: process.env.SEARCH_TERM ?? "software engineer",
  location: process.env.LOCATION ?? "San Francisco, CA",
  resultsWanted: parseNumber(process.env.RESULTS_WANTED, 5),
  hoursOld: parseNumber(process.env.HOURS_OLD, 72),
  strict: false,
};

console.log("Running local scrape test with config:");
console.log(config);

const startedAt = Date.now();
const result = await scrapeJobs(config);
const elapsedMs = Date.now() - startedAt;

console.log("\nSummary");
console.log({
  jobs: result.jobs.length,
  errors: result.errors.length,
  partial: result.meta.partial,
  durationMs: result.meta.durationMs,
  elapsedMs,
  sitesRequested: result.meta.sitesRequested,
  sitesSucceeded: result.meta.sitesSucceeded,
  sitesFailed: result.meta.sitesFailed,
});

if (result.errors.length > 0) {
  console.log("\nPer-site errors:");
  for (const error of result.errors) {
    console.log(
      `- [${error.site}] ${error.code}: ${error.message} (retriable=${error.retriable})`,
    );
  }
}

if (result.jobs.length > 0) {
  console.log("\nFirst jobs:");
  console.table(
    result.jobs.slice(0, 5).map((job) => ({
      site: job.site,
      title: job.title,
      company: job.company,
      location: job.location?.display ?? null,
      datePosted: job.datePosted ?? null,
      jobUrl: job.jobUrl,
    })),
  );

  const csvPath = resolve(process.cwd(), "local-test-output.csv");
  await writeFile(csvPath, toCsv(result.jobs), "utf8");
  console.log(`\nWrote CSV to ${csvPath}`);
} else {
  console.log("\nNo jobs returned.");
}

console.log("\nTips:");
console.log("- Run `npm run build` first if `dist/` is missing.");
console.log("- Override defaults with env vars: SITES, SEARCH_TERM, LOCATION, RESULTS_WANTED, HOURS_OLD");
console.log("- Example: SITES=indeed,linkedin RESULTS_WANTED=3 node local-test.mjs");
