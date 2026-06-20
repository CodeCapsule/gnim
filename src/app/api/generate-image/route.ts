import OpenAI from "openai";

export const runtime = "edge";

const client = new OpenAI({
  apiKey: process.env.AI_GATEWAY_API_KEY,
  baseURL: "https://ai-gateway.vercel.sh/v1",
});

export async function POST(req: Request) {
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      { error: "AI_GATEWAY_API_KEY is not configured." },
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

    // Use Pollinations.ai for instant image generation, bypassing slow Vercel API Gateway timeouts
    const encodedPrompt = encodeURIComponent(prompt.trim());
    const width = 1024;
    const height = 576; // 16:9 aspect ratio as requested by user often
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true`;

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
