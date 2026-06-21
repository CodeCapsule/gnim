import { ImageRouter } from "@/lib/agents/ImageRouter";
import { NextResponse } from "next/server";

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

    // --- Dispatch to Image Model (Pollinations.ai) ---
    const encodedPrompt = encodeURIComponent(finalPrompt);
    const width = 1024;
    const height = 576;
    const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true`;

    // Record frame in storyboard for future scene continuity
    ImageRouter.recordGeneration(conversationId ?? "default", finalPrompt, url);

    return NextResponse.json({
      url,
      optimizedPrompt: finalPrompt,
      warnings: routerResult.warnings,
    });
  } catch (err: any) {
    const message = err?.message ?? "Unknown error";
    console.error("[generate-image] Error:", message);
    return NextResponse.json({ error: `Image generation failed: ${message}` }, { status: 500 });
  }
}
