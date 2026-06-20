import OpenAI from "openai";

export const maxDuration = 60;

// Use Vercel AI Gateway's OpenAI-compatible endpoint
// This routes all image requests through the gateway (one key, unified billing, observability)
const gateway = new OpenAI({
  baseURL: "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
});

export async function POST(req: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      { error: "AI_GATEWAY_API_KEY is not configured. Add it to .env.local." },
      { status: 500 }
    );
  }

  try {
    const { prompt, model: modelOverride } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return Response.json({ error: "Missing or invalid prompt" }, { status: 400 });
    }

    if (prompt.length > 1000) {
      return Response.json({ error: "Prompt too long (max 1000 characters)" }, { status: 400 });
    }

    // Use dall-e-3 via the gateway's OpenAI-compatible API
    const model = modelOverride ?? "dall-e-3";

    const response = await gateway.images.generate({
      model,
      prompt: prompt.trim(),
      n: 1,
      size: "1024x1024",
      response_format: "b64_json",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image data returned from gateway");

    const url = `data:image/png;base64,${b64}`;
    return Response.json({ url, model });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[generate-image] Gateway error:", message);
    return Response.json(
      { error: `Image generation failed: ${message}` },
      { status: 500 }
    );
  }
}
