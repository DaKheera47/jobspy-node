import type { NormalizedScrapeJobsInput } from "../types";

export function validateGlobalInput(input: NormalizedScrapeJobsInput): string[] {
  const errors: string[] = [];

  if (!input.searchTerm && !input.googleSearchTerm) {
    errors.push("Provide at least one of searchTerm or googleSearchTerm.");
  }

  if (input.resultsWanted <= 0) {
    errors.push("resultsWanted must be greater than 0.");
  }

  return errors;
}

export function validateIndeedConstraints(
  input: NormalizedScrapeJobsInput,
): string[] {
  const errors: string[] = [];
  const usedModes = [
    input.hoursOld != null ? "hoursOld" : null,
    input.jobType || input.isRemote ? "jobType/isRemote" : null,
    input.easyApply ? "easyApply" : null,
  ].filter(Boolean);

  if (usedModes.length > 1) {
    errors.push(
      "Indeed supports only one of: hoursOld, jobType/isRemote, easyApply.",
    );
  }

  return errors;
}

export function validateLinkedInConstraints(
  input: NormalizedScrapeJobsInput,
): string[] {
  const errors: string[] = [];
  const usedModes = [input.hoursOld != null, Boolean(input.easyApply)].filter(Boolean)
    .length;
  if (usedModes > 1) {
    errors.push("LinkedIn supports only one of: hoursOld, easyApply.");
  }

  return errors;
}

