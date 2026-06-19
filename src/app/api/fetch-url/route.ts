import { NextRequest } from "next/server";

export const maxDuration = 30;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Detect if URL is a structured JSON API that should be fetched directly */
function isApiUrl(parsedUrl: URL): boolean {
  const host = parsedUrl.hostname;
  const path = parsedUrl.pathname;
  return (
    host === "api.github.com" ||
    host.startsWith("api.") ||
    path.includes("/api/") ||
    path.endsWith(".json") ||
    path.endsWith(".xml") ||
    path.endsWith(".csv")
  );
}

/** Detect if URL is a raw content endpoint (GitHub raw, etc.) */
function isRawContent(parsedUrl: URL): boolean {
  const host = parsedUrl.hostname;
  return (
    host === "raw.githubusercontent.com" ||
    host === "pastebin.com" ||
    host.includes("gist.") ||
    parsedUrl.pathname.endsWith(".md") ||
    parsedUrl.pathname.endsWith(".txt")
  );
}

/** Fetch via Jina Reader for clean AI-friendly Markdown output */
async function fetchWithJina(url: string): Promise<{ text: string; title: string }> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const res = await fetch(jinaUrl, {
    headers: {
      "Accept": "text/plain",
      "User-Agent": "Mozilla/5.0 (compatible; GnimAI/1.0)",
      "X-Return-Format": "markdown",
      "X-No-Cache": "true",
    },
    signal: AbortSignal.timeout(20000),
  });

  if (!res.ok) {
    throw new Error(`Jina Reader returned HTTP ${res.status}`);
  }

  const text = await res.text();

  // Extract title from first markdown heading if available
  const titleMatch = text.match(/^#+ (.+)/m);
  const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;

  return { text, title };
}

/** Fetch raw / JSON API directly */
async function fetchDirect(parsedUrl: URL): Promise<{ text: string; title: string }> {
  const res = await fetch(parsedUrl.toString(), {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
      "Accept": parsedUrl.hostname === "api.github.com"
        ? "application/vnd.github.v3+json"
        : "application/json, text/plain, */*",
      "Accept-Language": "en-US,en;q=0.9",
      ...(parsedUrl.hostname === "api.github.com"
        ? { "X-GitHub-Api-Version": "2022-11-28" }
        : {}),
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Site returned HTTP ${res.status}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  let text = "";

  if (contentType.includes("application/json")) {
    const json = await res.json();
    text = JSON.stringify(json, null, 2);
  } else {
    text = await res.text();
    // Try parsing as JSON if content type was misreported
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const json = JSON.parse(trimmed);
        text = JSON.stringify(json, null, 2);
      } catch { /* keep as-is */ }
    }
  }

  return { text, title: parsedUrl.hostname };
}

// ─── Route Handler ────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "Missing url parameter" }, { status: 400 });
  }

  // Validate URL
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return Response.json({ error: "Only http/https URLs are supported" }, { status: 400 });
    }
  } catch {
    return Response.json({ error: "Invalid URL" }, { status: 400 });
  }

  const MAX_LEN = 20000;

  try {
    let text = "";
    let title = parsedUrl.hostname;
    let method = "jina";

    // Strategy selection:
    // 1. API / raw content → fetch directly (structured data, no need for reader)
    // 2. Regular web page → Jina Reader for clean Markdown
    if (isApiUrl(parsedUrl) || isRawContent(parsedUrl)) {
      method = "direct";
      const result = await fetchDirect(parsedUrl);
      text = result.text;
      title = result.title;
    } else {
      try {
        // Primary: Jina Reader
        const result = await fetchWithJina(url);
        text = result.text;
        title = result.title;
        method = "jina";
      } catch (jinaErr) {
        // Fallback: direct fetch if Jina fails
        console.warn("[fetch-url] Jina failed, falling back to direct fetch:", jinaErr);
        const result = await fetchDirect(parsedUrl);
        text = result.text;
        title = result.title;
        method = "direct-fallback";
      }
    }

    // Truncate to avoid massive context windows
    const truncated = text.length > MAX_LEN;
    text = text.slice(0, MAX_LEN);

    return Response.json({
      url: parsedUrl.toString(),
      title,
      text,
      truncated,
      length: text.length,
      method,
    });
  } catch (err: any) {
    const msg = err?.message ?? "Unknown error";
    return Response.json(
      { error: `Failed to fetch: ${msg}` },
      { status: 502 }
    );
  }
}
