const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?![a-zA-Z])/g;

export function extractEmails(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }

  return [...new Set(text.match(EMAIL_REGEX) ?? [])];
}

export function compactWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export function nullIfEmpty(value: string | null | undefined): string | null {
  if (value == null) {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

