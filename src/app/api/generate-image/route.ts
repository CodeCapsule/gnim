import { ImageRouter } from "@/lib/agents/ImageRouter";
import { NextResponse } from "next/server";

/**
 * Pollinations.ai model options:
 * - "flux"          → Best for accuracy and text rendering (FLUX.1-schnell)
 * - "flux-realism"  → Best for photorealistic images
 * - "turbo"         → Fast SDXL (creative, but poor at text)
 * - "gptimage"      → Experimental GPT-based model
 *
 * For text-heavy prompts (business cards, certificates, posters),
 * we use "flux" with enhance=false and a portrait/card aspect ratio.
 * For creative imagery, we use "flux-realism" with enhance=true.
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
        url: null,
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

    // --- Select model and dimensions based on prompt type ---
    let model: string;
    let width: number;
    let height: number;
    let enhance: boolean;

    if (isTextHeavy) {
      // Business cards, certificates, posters, product labels, etc.
      // Use FLUX with enhance=false (enhancement distorts text)
      const isBusinessCard = /business card|id card|card/i.test(prompt);
      model = "flux";
      width = isBusinessCard ? 1050 : 1024;
      height = isBusinessCard ? 600 : 768;
      enhance = false;
    } else {
      // Creative/artistic images — use flux-realism for photorealistic quality
      model = "flux-realism";
      width = isPerson ? 768 : 1024;   // Portrait ratio for people
      height = isPerson ? 1024 : 576;  // Taller for portraits
      enhance = true;
    }

    // --- Dispatch to Pollinations.ai ---
    const { TextToImageAgent } = await import("@/lib/agents/TextToImageAgent");
    const negativePrompt = TextToImageAgent.buildNegativePrompt(isTextHeavy, isPerson);
    const encodedPrompt = encodeURIComponent(finalPrompt);
    const encodedNeg = encodeURIComponent(negativePrompt);
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&model=${model}&enhance=${enhance}&nologo=true&negative=${encodedNeg}&seed=${Math.floor(Math.random() * 1000000)}`;

    // Record frame in storyboard for future scene continuity
    ImageRouter.recordGeneration(conversationId ?? "default", finalPrompt, url);

    return NextResponse.json({
      url,
      optimizedPrompt: finalPrompt,
      isTextHeavy,
      model,
      warnings: routerResult.warnings,
    });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[generate-image] Error:", message);
    return NextResponse.json({ error: `Image generation failed: ${message}` }, { status: 500 });
  }
}
