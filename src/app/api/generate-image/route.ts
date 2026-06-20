import { createGateway } from "@ai-sdk/gateway";
import { experimental_generateImage as generateImage } from "ai";

export const maxDuration = 60;

// Re-use the same AI Gateway as the chat route
const gateway = createGateway({
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

    // Default to DALL-E 3 via the gateway; callers can override with a gateway model id
    const imageModel = modelOverride ?? "openai/dall-e-3";

    const result = await generateImage({
      model: gateway.imageModel(imageModel),
      prompt: prompt.trim(),
      n: 1,
      size: "1024x1024",
    });

    const image = result.images?.[0];
    if (!image) throw new Error("No image data returned from gateway");

    // The SDK returns base64 — convert to a data URL the browser can render directly
    const base64 = image.base64;
    const url = `data:image/png;base64,${base64}`;

    return Response.json({ url, model: imageModel });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[generate-image] Gateway error:", message);
    return Response.json(
      { error: `Image generation failed: ${message}` },
      { status: 500 }
    );
  }
}
