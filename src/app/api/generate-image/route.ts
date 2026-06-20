export const maxDuration = 60;

/**
 * Image Generation Route
 *
 * Uses Pollinations.ai — a free, no-auth-required image generation API.
 * No extra API keys needed. Works out of the box.
 *
 * If you want to switch to a paid provider in the future, simply replace
 * the `generateWithPollinations` function below.
 */

async function generateWithPollinations(prompt: string): Promise<string> {
  const encodedPrompt = encodeURIComponent(prompt);
  // Use a unique seed from timestamp to avoid cached results
  const seed = Date.now();
  const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=1024&height=1024&seed=${seed}&nologo=true&model=flux`;

  const res = await fetch(url, {
    headers: { Accept: "image/*" },
  });

  if (!res.ok) {
    throw new Error(`Pollinations returned ${res.status}: ${res.statusText}`);
  }

  const contentType = res.headers.get("content-type") || "image/jpeg";
  const arrayBuffer = await res.arrayBuffer();
  const base64 = Buffer.from(arrayBuffer).toString("base64");
  return `data:${contentType};base64,${base64}`;
}

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return Response.json({ error: "Missing or invalid prompt" }, { status: 400 });
    }

    if (prompt.length > 1000) {
      return Response.json({ error: "Prompt too long (max 1000 characters)" }, { status: 400 });
    }

    const url = await generateWithPollinations(prompt.trim());
    return Response.json({ url, provider: "pollinations" });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[generate-image] Error:", message);
    return Response.json(
      { error: `Image generation failed: ${message}` },
      { status: 500 }
    );
  }
}
