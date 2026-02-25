export type Site =
  | "linkedin"
  | "indeed"
  | "zip_recruiter"
  | "glassdoor"
  | "google"
  | "bayt"
  | "naukri"
  | "bdjobs";

export interface ScrapeJobsInput {
  siteName?: Site | Site[];
  searchTerm?: string;
}

export interface ScrapeJobsResult {
  jobs: unknown[];
  errors: unknown[];
  meta: {
    partial: boolean;
  };
}
