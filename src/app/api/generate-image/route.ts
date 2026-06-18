import OpenAI from "openai";

export const maxDuration = 60;

// Use the Vercel AI Gateway as an OpenAI-compatible proxy
const openai = new OpenAI({
  baseURL: "https://ai-gateway.vercel.sh/v1",
  apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return Response.json({ error: "Missing or invalid prompt" }, { status: 400 });
    }

    if (prompt.length > 1000) {
      return Response.json({ error: "Prompt too long (max 1000 characters)" }, { status: 400 });
    }

    const response = await openai.images.generate({
      model: "dall-e-2",
      prompt: prompt.trim(),
      n: 1,
      size: "512x512",
      response_format: "b64_json",
    });

    const b64 = response.data[0]?.b64_json;
    if (!b64) throw new Error("No image data returned");

    const url = `data:image/png;base64,${b64}`;
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
