import { experimental_generateImage as generateImage } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { ImageRouter } from '@/lib/agents/ImageRouter';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
});

/**
 * /api/generate-image
 *
 * Generates images using OpenAI GPT-Image-1 via the Vercel AI Gateway.
 * - Uses quality 'low' for fastest generation (~8-12 seconds)
 * - No separate OPENAI_API_KEY needed — routes through AI Gateway
 *
 * Returns: { image: "data:image/png;base64,...", optimizedPrompt, warnings }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { prompt, conversationId } = body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return NextResponse.json({ error: 'Missing or invalid prompt' }, { status: 400 });
    }

    // --- Run through the multi-agent Image Router (Gemini Flash prompt enhancement) ---
    const routerResult = await ImageRouter.route(prompt, conversationId ?? 'default', false);

    // Handle character definition commands
    if (routerResult.intent === 'character_define') {
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

    // --- Generate via GPT-Image-1 via AI Gateway ---
    // Using quality 'low' for fastest generation (~8-12s vs 25-30s for 'high')
    const result = await generateImage({
      model: gateway.imageModel('openai/gpt-image-1'),
      prompt: finalPrompt,
      size: '1024x1024',
      providerOptions: {
        openai: {
          quality: 'low',
        },
      },
    });

    const base64 = result.image.base64;
    if (!base64) {
      return NextResponse.json({ error: 'No image returned from GPT-Image-1' }, { status: 500 });
    }

    const dataUrl = `data:image/png;base64,${base64}`;

    // Record frame in storyboard for scene continuity
    ImageRouter.recordGeneration(conversationId ?? 'default', finalPrompt, dataUrl);

    return NextResponse.json({
      image: dataUrl,
      optimizedPrompt: finalPrompt,
      isTextHeavy,
      warnings: routerResult.warnings,
    });
  } catch (err: any) {
    const message = err?.message ?? 'Unknown error';
    console.error('[generate-image] Error:', message);
    return NextResponse.json({ error: `Image generation failed: ${message}` }, { status: 500 });
  }
}
