import { experimental_generateImage as generateImage } from "ai";
import { createGateway } from "@ai-sdk/gateway";
import { ImageRouter } from "@/lib/agents/ImageRouter";
import { NextResponse } from "next/server";

export const maxDuration = 60; // GPT-Image-1 can take up to 30s

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
});

/**
 * /api/generate-image
 *
 * Generates images using OpenAI GPT-Image-1 via the AI Gateway.
 * Replaces the previous Pollinations.ai integration.
 *
 * Returns: { image: "data:image/png;base64,...", optimizedPrompt, warnings }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, conversationId } = body;

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return NextResponse.json({ error: "Missing or invalid prompt" }, { status: 400 });
    }

    // --- Run through the multi-agent Image Router ---
    const routerResult = await ImageRouter.route(prompt, conversationId ?? "default", false);

    // Handle character definition commands
    if (routerResult.intent === "character_define") {
      return NextResponse.json({
        image: null,
        message: `✅ Character saved! I'll remember their appearance for future images.`,
        warnings: [],
      });
    }

    // Handle blocked prompts
    if (routerResult.blockedReason) {
      return NextResponse.json({ error: routerResult.blockedReason }, { status: 400 });
    }

    const finalPrompt = routerResult.finalPrompt ?? prompt.trim();
    const isTextHeavy = routerResult.isTextHeavy ?? false;
    const isPerson = /\b(person|man|woman|male|female|human|portrait|filipino|people|guy|girl|model|actor)\b/i.test(finalPrompt);

    // --- Select size based on prompt type ---
    let size: "1024x1024" | "1536x1024" | "1024x1536" = "1024x1024";

    if (isTextHeavy) {
      // Business cards, posters → landscape
      const isBusinessCard = /business card|id card|card/i.test(prompt);
      size = isBusinessCard ? "1536x1024" : "1024x1024";
    } else if (isPerson) {
      // People/portraits → portrait orientation
      size = "1024x1536";
    } else {
      // Landscapes/scenes → landscape
      size = "1536x1024";
    }

    // --- Generate via GPT-Image-1 ---
    const result = await generateImage({
      model: gateway.imageModel("openai/gpt-image-1"),
      prompt: finalPrompt,
      size,
      providerOptions: {
        openai: {
          quality: "high",
        },
      },
    });

    const base64 = result.image.base64;
    const dataUrl = `data:image/png;base64,${base64}`;

    // Record frame in storyboard for future scene continuity
    ImageRouter.recordGeneration(conversationId ?? "default", finalPrompt, dataUrl);

    return NextResponse.json({
      image: dataUrl,
      optimizedPrompt: finalPrompt,
      isTextHeavy,
      warnings: routerResult.warnings,
    });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[generate-image] Error:", message);
    return NextResponse.json({ error: `Image generation failed: ${message}` }, { status: 500 });
  }
}
