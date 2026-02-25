import { stringify } from "csv-stringify/sync";

import type { JobPost } from "../types";

export function toCsv(rows: JobPost[]): string {
  const normalizedRows = rows.map((row) => ({
    ...row,
    location: row.location?.display ?? null,
    jobType: row.jobType?.join(", ") ?? null,
    emails: row.emails?.join(", ") ?? null,
    skills: row.skills?.join(", ") ?? null,
    compensation: row.compensation
      ? JSON.stringify(row.compensation)
      : null,
    metadata: row.metadata ? JSON.stringify(row.metadata) : null,
  }));

  return stringify(normalizedRows, {
    header: true,
    columns: Object.keys(normalizedRows[0] ?? { site: "", title: "", jobUrl: "" }),
  });
}

