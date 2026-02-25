import { load } from "cheerio";

import { compactWhitespace } from "./text";

export function htmlToText(html: string): string {
  const $ = load(html);
  return compactWhitespace($.text());
}

export function htmlToMarkdown(html: string): string {
  // Lightweight fallback: preserve text content without introducing a heavy converter yet.
  return htmlToText(html);
}

