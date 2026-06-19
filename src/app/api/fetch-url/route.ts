import { NextRequest } from "next/server";

export const maxDuration = 30;

// ─── HTML to Text (last-resort fallback) ─────────────────────────────────────
function htmlToText(html: string): string {
  let text = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, "")
    .replace(/<head[\s\S]*?<\/head>/gi, "");

  text = text.replace(/<(br|p|div|h[1-6]|li|tr|blockquote|pre)[^>]*>/gi, "\n");
  text = text.replace(/<[^>]+>/g, " ");
  text = text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, " ")
    .replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/");
  text = text.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return text;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isApiUrl(url: URL): boolean {
  const h = url.hostname;
  return (
    h === "api.github.com" || h.startsWith("api.") ||
    url.pathname.includes("/api/") || url.pathname.endsWith(".json") ||
    url.pathname.endsWith(".xml") || url.pathname.endsWith(".csv")
  );
}

function isRawContent(url: URL): boolean {
  return (
    url.hostname === "raw.githubusercontent.com" ||
    url.pathname.endsWith(".md") || url.pathname.endsWith(".txt")
  );
}

// ─── Strategy 1: Jina Reader ─────────────────────────────────────────────────
async function fetchWithJina(url: string): Promise<{ text: string; title: string }> {
  const jinaUrl = `https://r.jina.ai/${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20000);

  try {
    const res = await fetch(jinaUrl, {
      headers: {
        "Accept": "text/plain",
        "User-Agent": "Mozilla/5.0 (compatible; GnimAI/1.0; +https://gnim.ai)",
        "X-Return-Format": "markdown",
      },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Jina returned ${res.status}`);

    const text = await res.text();
    const titleMatch = text.match(/^#+ (.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : new URL(url).hostname;
    return { text, title };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Strategy 2: Direct Fetch ─────────────────────────────────────────────────
async function fetchDirect(parsedUrl: URL): Promise<{ text: string; title: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const isGitHub = parsedUrl.hostname === "api.github.com";
    const res = await fetch(parsedUrl.toString(), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
        "Accept": isGitHub
          ? "application/vnd.github.v3+json"
          : "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "Accept-Language": "en-US,en;q=0.9",
        ...(isGitHub ? { "X-GitHub-Api-Version": "2022-11-28" } : {}),
      },
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Server returned ${res.status}`);

    const contentType = res.headers.get("content-type") ?? "";
    let text = "";

    if (contentType.includes("application/json")) {
      const json = await res.json();
      text = JSON.stringify(json, null, 2);
    } else {
      const raw = await res.text();
      const trimmed = raw.trim();
      if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
        try { text = JSON.stringify(JSON.parse(trimmed), null, 2); }
        catch { text = htmlToText(raw); }
      } else if (contentType.includes("text/plain")) {
        text = raw;
      } else {
        text = htmlToText(raw);
      }
    }

    // Try to extract page title
    const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : parsedUrl.hostname;

    return { text, title };
  } finally {
    clearTimeout(timeout);
  }
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url) {
    return Response.json({ error: "Missing url parameter" }, { status: 400 });
  }

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

  let text = "";
  let title = parsedUrl.hostname;
  let method = "unknown";
  let lastError = "";

  try {
    if (isApiUrl(parsedUrl) || isRawContent(parsedUrl)) {
      // Structured/raw content — always direct
      method = "direct";
      const result = await fetchDirect(parsedUrl);
      text = result.text;
      title = result.title;
    } else {
      // Web page: try Jina first, fall back to direct, fall back to HTML scrape
      try {
        method = "jina";
        const result = await fetchWithJina(url);
        text = result.text;
        title = result.title;
      } catch (jinaErr: any) {
        lastError = jinaErr?.message ?? "Jina failed";
        console.warn("[fetch-url] Jina failed:", lastError, "— falling back to direct fetch");
        try {
          method = "direct-fallback";
          const result = await fetchDirect(parsedUrl);
          text = result.text;
          title = result.title;
        } catch (directErr: any) {
          lastError = directErr?.message ?? "Direct fetch failed";
          throw new Error(`All fetch strategies failed. Last error: ${lastError}`);
        }
      }
    }
  } catch (err: any) {
    return Response.json(
      { error: `Failed to fetch: ${err?.message ?? "Unknown error"}` },
      { status: 502 }
    );
  }

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
}
