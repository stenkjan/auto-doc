/**
 * Web scraper: fetches any public URL and extracts its text content.
 * Returns a Resource-compatible object.
 */

import type { Resource } from "./ai-engine";

const USER_AGENT =
  "Mozilla/5.0 (compatible; AutoDoc/1.0; +https://hoam-house.com/autodoc)";

/** Extract readable text from raw HTML */
function htmlToText(html: string): string {
  // Remove script and style blocks entirely
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<nav[\s\S]*?<\/nav>/gi, "")
    .replace(/<footer[\s\S]*?<\/footer>/gi, "")
    .replace(/<header[\s\S]*?<\/header>/gi, "");

  // Preserve block-level line breaks
  text = text
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n\n")
    .replace(/<\/tr>/gi, "\n")
    .replace(/<\/td>/gi, " | ")
    .replace(/<\/th>/gi, " | ");

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, "");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");

  // Collapse excessive whitespace
  text = text
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return text;
}

/** Extract <title> from HTML */
function extractTitle(html: string): string {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match ? match[1].trim() : "";
}

/** Extract canonical/og:url or just the URL for display */
function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

/**
 * Scrape a public URL and return text content as a Resource.
 */
export async function scrapeUrl(url: string): Promise<Resource> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.8",
      },
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
  } catch (err) {
    throw new Error(
      `URL konnte nicht geladen werden: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (!res.ok) {
    throw new Error(`URL antwortete mit Status ${res.status}: ${url}`);
  }

  const contentType = res.headers.get("content-type") ?? "";

  // PDF: delegate to pdf-parse
  if (contentType.includes("application/pdf")) {
    const buffer = Buffer.from(await res.arrayBuffer());
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pdfParse = (await import("pdf-parse")) as any;
      const data = await (pdfParse.default ?? pdfParse)(buffer);
      return {
        name: domainFromUrl(url) + " (PDF)",
        content: data.text,
        type: "text",
        sourceType: "web",
      };
    } catch {
      return {
        name: domainFromUrl(url) + " (PDF)",
        content: `[PDF von ${url} – Textextraktion nicht verfügbar]`,
        type: "text",
        sourceType: "web",
        warning: "PDF konnte nicht geparst werden",
      };
    }
  }

  // Plain text
  if (contentType.includes("text/plain")) {
    const text = await res.text();
    return {
      name: domainFromUrl(url),
      content: text.slice(0, 80_000),
      type: "text",
      sourceType: "web",
    };
  }

  // HTML (default)
  const html = await res.text();
  const title = extractTitle(html) || domainFromUrl(url);
  const text = htmlToText(html);

  if (!text || text.length < 50) {
    throw new Error(
      `Kein lesbarer Inhalt unter ${url} gefunden (möglicherweise JavaScript-only Seite)`
    );
  }

  return {
    name: title,
    content: text.slice(0, 80_000),
    type: "text",
    sourceType: "web",
  };
}
