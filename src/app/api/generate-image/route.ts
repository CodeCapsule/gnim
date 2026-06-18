import { createGateway } from "@ai-sdk/gateway";
import { experimental_generateImage as generateImage } from "ai";

export const maxDuration = 60;

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
});

export async function POST(req: Request) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return Response.json({ error: "Missing or invalid prompt" }, { status: 400 });
    }

    if (prompt.length > 4000) {
      return Response.json({ error: "Prompt too long (max 4000 characters)" }, { status: 400 });
    }

    const { image } = await generateImage({
      model: gateway.imageModel("openai/dall-e-2"),
      prompt: prompt.trim(),
      size: "512x512",
    });

    // Return the base64 image as a data URL so it works without auth
    const url = `data:image/png;base64,${image.base64}`;

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
