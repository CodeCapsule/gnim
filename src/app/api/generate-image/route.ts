import { ImageRouter } from '@/lib/agents/ImageRouter';
import { NextResponse } from 'next/server';

export const maxDuration = 60;

/**
 * /api/generate-image
 *
 * Generates images using xAI Aurora (grok-2-image) via the xAI API.
 * - OpenAI-compatible API format
 * - Uses XAI_API_KEY environment variable
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

    // --- Run through the Image Router (prompt enhancement) ---
    const routerResult = await ImageRouter.route(prompt, conversationId ?? 'default', false);

    if (routerResult.intent === 'character_define') {
      return NextResponse.json({
        image: null,
        message: `✅ Character saved! I'll remember their appearance for future images.`,
        warnings: [],
      });
    }

    if (routerResult.blockedReason) {
      return NextResponse.json({ error: routerResult.blockedReason }, { status: 400 });
    }

    const finalPrompt = routerResult.finalPrompt ?? prompt.trim();
    const isTextHeavy = routerResult.isTextHeavy ?? false;

    // --- Call xAI Aurora image generation API ---
    const xaiKey = process.env.XAI_API_KEY;
    if (!xaiKey) {
      return NextResponse.json({ error: 'XAI_API_KEY is not configured' }, { status: 500 });
    }

    const response = await fetch('https://api.x.ai/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${xaiKey}`,
      },
      body: JSON.stringify({
        model: 'grok-2-image',
        prompt: finalPrompt,
        n: 1,
        response_format: 'b64_json',
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('[generate-image] xAI error:', errText);
      return NextResponse.json(
        { error: `xAI image generation failed: ${response.status} ${errText.slice(0, 200)}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const b64 = data?.data?.[0]?.b64_json;

    if (!b64) {
      return NextResponse.json({ error: 'No image returned from xAI Aurora' }, { status: 500 });
    }

    const dataUrl = `data:image/png;base64,${b64}`;

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
