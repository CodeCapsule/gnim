import OpenAI from "openai";

export const maxDuration = 60;

// xAI Grok image generation — Aurora model
const xai = new OpenAI({
  baseURL: "https://api.x.ai/v1",
  apiKey: process.env.XAI_API_KEY ?? "",
});

export async function POST(req: Request) {
  if (!process.env.XAI_API_KEY) {
    return Response.json(
      { error: "XAI_API_KEY is not configured. Add it to .env.local." },
      { status: 500 }
    );
  }

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return Response.json({ error: "Missing or invalid prompt" }, { status: 400 });
    }

    if (prompt.length > 1000) {
      return Response.json({ error: "Prompt too long (max 1000 characters)" }, { status: 400 });
    }

    const response = await xai.images.generate({
      model: "grok-2-image",
      prompt: prompt.trim(),
      n: 1,
      response_format: "b64_json",
    });

    const b64 = response.data[0]?.b64_json;
    if (!b64) throw new Error("No image data returned from Grok");

    const url = `data:image/jpeg;base64,${b64}`;
    return Response.json({ url });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[generate-image] Grok error:", message);
    return Response.json(
      { error: `Image generation failed: ${message}` },
      { status: 500 }
    );
  }
}
