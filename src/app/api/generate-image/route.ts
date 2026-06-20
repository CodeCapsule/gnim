export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return Response.json({ error: "Missing or invalid prompt" }, { status: 400 });
    }

    if (prompt.length > 1000) {
      return Response.json({ error: "Prompt too long (max 1000 characters)" }, { status: 400 });
    }

    const trimmed = prompt.trim();

    // Build direct Pollinations CDN URL — no API key needed, zero server cost
    const seed = Math.floor(Math.random() * 99999);
    const encodedPrompt = encodeURIComponent(trimmed);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux&enhance=true`;

    // Verify the URL is reachable (HEAD request) so the client gets a definitive error immediately instead of a broken img tag
    const check = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(25000) });

    if (!check.ok) {
      return Response.json(
        { error: "Image service unavailable or overloaded." },
        { status: 502 }
      );
    }

    return Response.json({ url });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[generate-image] Error:", message);
    return Response.json(
      { error: "Image service unavailable or overloaded." },
      { status: 500 }
    );
  }
}
