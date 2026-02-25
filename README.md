# JobSpy Node (Independent TS Port)

Independent Node.js/TypeScript job scraping library inspired by JobSpy.

## Attribution

Special thanks to the JobSpy maintainers. This package is an independent Node.js/TypeScript implementation inspired by the JobSpy project and rewritten for a Node-native API (no wrapper).

## Install

```bash
npm install jobspy-node
```

## Quick Start

```ts
import { scrapeJobs, toCsv } from "jobspy-node";

const result = await scrapeJobs({
  siteName: ["indeed", "linkedin", "zip_recruiter"],
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

- LinkedIn
- Indeed
- ZipRecruiter
- Glassdoor
- Google Jobs
- Bayt
- Naukri
- BDJobs

## Notes

- Multi-site scrapes return partial success by default (`strict: false`).
- Sites change frequently; parser regressions can happen without warning.
- Use proxies for better reliability on restrictive providers.
- Run `npm run test:smoke` for an opt-in live smoke test.

## Responsible Use

Use this library responsibly and in compliance with site terms, robots policies, and local laws.

