# JobSpy Node (Independent TS Port)

Independent Node.js/TypeScript Jobspy ported from the original Python version. Provides a simple API to scrape job listings from various platforms. Available on npm as [jobspy-node](https://www.npmjs.com/package/jobspy-node)

## ⚠️ AI-Built Disclaimer ⚠️

This project was built practically as a one-shot by Codex 5.3 on xhigh (with human review and testing).

- Expect rough edges.
- Please validate outputs before relying on them in production.
- Scraper breakage can happen anytime when sites change.

## Attribution

Special thanks to the [JobSpy](https://github.com/speedyapply/JobSpy) maintainers. This package is a Node.js/TypeScript port of the JobSpy project.

## Install

```bash
npm install jobspy-node
```

## Quick Start

```ts
import { scrapeJobs, toCsv } from "jobspy-node";

const result = await scrapeJobs({
  siteName: ["indeed", "linkedin", "glassdoor"],
  searchTerm: "software engineer",
  location: "San Francisco, CA",
  resultsWanted: 10,
  hoursOld: 72,
});

console.log("jobs:", result.jobs.length);
console.log("errors:", result.errors);
console.log(toCsv(result.jobs));
```

## Output

`scrapeJobs()` returns:

- `jobs`: normalized `JobPost[]`
- `errors`: structured per-site failures (`429`, parser changes, network issues)
- `meta`: timings, per-site status, warnings, and partial-success metadata

## Supported Sites

Currently supported websites (implemented in this package):

- `linkedin.com` (LinkedIn)
- `indeed.com` and regional Indeed domains (Indeed)
- `glassdoor.com` (Glassdoor)
- `naukri.com` (Naukri)

Not currently supported in this package:

- ZipRecruiter
- Google Jobs
- Bayt
- BDJobs

## Notes

- Multi-site scrapes return partial success by default (`strict: false`).
- Sites change frequently; parser regressions can happen without warning.
- Use proxies for better reliability on restrictive providers.
- Run `npm run test:smoke` for an opt-in live smoke test.

## Responsible Use

Use this library responsibly and in compliance with site terms, robots policies, and local laws.
