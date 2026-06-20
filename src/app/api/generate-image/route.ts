import OpenAI from "openai";

export const maxDuration = 60;

const client = new OpenAI({
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

    // Default to bfl/flux-2-pro as requested
    const model = modelOverride ?? "bfl/flux-2-pro";

    const response = await client.images.generate({
      model,
      prompt: prompt.trim(),
    });

    const url = response.data?.[0]?.url || response.data?.[0]?.b64_json;
    if (!url) throw new Error("No image data returned from gateway");

    // The OpenAI response format might return an actual URL or b64 depending on the specific gateway wrapper
    const finalUrl = url.startsWith("http") ? url : `data:image/png;base64,${url}`;

    return Response.json({ url: finalUrl, model });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[generate-image] Gateway error:", message);
    return Response.json(
      { error: `Image generation failed: ${message}` },
      { status: 500 }
    );
  }
}
