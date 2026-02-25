import type { JobPost } from "../types";

export function toJsonl(rows: JobPost[]): string {
  return rows.map((row) => JSON.stringify(row)).join("\n");
}

