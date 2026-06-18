import { NextRequest } from "next/server";

export const maxDuration = 30;

// Simple HTML-to-text: strips tags, scripts, styles, decodes entities
function htmlToText(html: string): string {
  // Remove scripts, styles, noscript, head
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "");

  // Convert block elements to newlines
  text = text.replace(/<(br|p|div|h[1-6]|li|tr|blockquote|pre)[^>]*>/gi, "\n");

  // Strip remaining tags
  text = text.replace(/<[^>]+>/g, " ");

  // Decode common HTML entities
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/");

  // Collapse whitespace, trim
  text = text.replace(/[ \t]+/g, " ");
  text = text.replace(/\n{3,}/g, "\n\n");
  text = text.trim();

  return text;
}

// Detect if URL is a known JSON API (GitHub, etc.)
function getAcceptHeader(parsedUrl: URL): string {
  const hostname = parsedUrl.hostname;
  if (hostname === "api.github.com") {
    return "application/vnd.github.v3+json";
  }
  if (
    hostname.endsWith("api.github.com") ||
    parsedUrl.pathname.includes("/api/") ||
    parsedUrl.pathname.endsWith(".json")
  ) {
    return "application/json, text/plain, */*";
  }
  return "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Basic URL validation
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return Response.json({ error: "Only http/https URLs are supported" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  const acceptHeader = getAcceptHeader(parsedUrl);

  try {
    const response = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: acceptHeader,
        "Accept-Language": "en-US,en;q=0.9",
        // GitHub API extras
        ...(parsedUrl.hostname === "api.github.com"
          ? { "X-GitHub-Api-Version": "2022-11-28" }
          : {}),
      },
      // 15 second timeout
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return Response.json(
        { error: `Site returned HTTP ${response.status}` },
        { status: 502 }
      );
    }

    const contentType = response.headers.get("content-type") ?? "";
    let text = "";

    if (contentType.includes("application/json")) {
      // Pretty-print JSON so the AI can read it nicely
      const json = await response.json();
      text = JSON.stringify(json, null, 2);
    } else if (contentType.includes("text/plain")) {
      text = await response.text();
    } else {
      const html = await response.text();
      // If response looks like JSON despite wrong content-type header, try parsing
      const trimmed = html.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try {
          const json = JSON.parse(trimmed);
          text = JSON.stringify(json, null, 2);
        } catch {
          text = htmlToText(html);
        }
      } else {
        text = htmlToText(html);
      }
    }

    // Trim to 15,000 chars to avoid huge context windows
    const MAX_LEN = 15000;
    const truncated = text.length > MAX_LEN;
    text = text.slice(0, MAX_LEN);

    return Response.json({
      url: parsedUrl.toString(),
      title: parsedUrl.hostname,
      text,
      truncated,
      length: text.length,
    });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    return Response.json(
      { error: `Failed to fetch: ${msg}` },
      { status: 502 }
    );
  }
}
