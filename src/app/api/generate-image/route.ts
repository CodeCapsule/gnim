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

    const encodedPrompt = encodeURIComponent(prompt.trim());
    
    // Pollinations.ai — free, no API key required
    // Fetch as binary so we can return a base64 data URL (avoids CORS issues in browser)
    const imageRes = await fetch(
      `https://image.pollinations.ai/prompt/${encodedPrompt}?width=768&height=768&model=flux&nologo=true&enhance=true`,
      { headers: { "User-Agent": "Gnim-AI/1.0" } }
    );

    if (!imageRes.ok) {
      throw new Error(`Pollinations returned ${imageRes.status}`);
    }

    const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
    const arrayBuffer = await imageRes.arrayBuffer();
    const b64 = Buffer.from(arrayBuffer).toString("base64");
    const url = `data:${contentType};base64,${b64}`;

    return Response.json({ url });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[generate-image] Error:", message);
    return Response.json(
      { error: `Image generation failed: ${message}` },
      { status: 500 }
    );
  }
}
