import { experimental_generateImage as generateImage, generateText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { NextRequest, NextResponse } from 'next/server';

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
});

/**
 * /api/ai-edit-image
 *
 * AI-powered image editing using OpenAI gpt-image-1 via the AI Gateway.
 * Accepts either:
 *   - FormData with `image` (File) + `prompt` (string)       — for uploaded images
 *   - JSON body  with `imageUrl` (string) + `prompt` (string) — for previously generated images
 *
 * Returns: { success: true, image: "data:image/png;base64,..." }
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let prompt = '';
    let imageBuffer: Buffer | null = null;

    // --- Accept both FormData (uploaded file) and JSON (imageUrl) ---
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      prompt = (formData.get('prompt') as string) ?? '';
      const imageFile = formData.get('image') as File | null;
      if (!imageFile) {
        return NextResponse.json({ success: false, message: 'Missing image file.' }, { status: 400 });
      }
      imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    } else {
      const body = await req.json();
      prompt = body.prompt ?? '';
      const imageUrl = body.imageUrl as string | undefined;
      if (!imageUrl) {
        return NextResponse.json({ success: false, message: 'Missing imageUrl.' }, { status: 400 });
      }
      // Fetch the image from URL (e.g., from Pollinations)
      const fetchRes = await fetch(imageUrl);
      if (!fetchRes.ok) {
        return NextResponse.json({ success: false, message: `Failed to fetch image: ${fetchRes.statusText}` }, { status: 502 });
      }
      imageBuffer = Buffer.from(await fetchRes.arrayBuffer());
    }

    if (!prompt) {
      return NextResponse.json({ success: false, message: 'Missing prompt.' }, { status: 400 });
    }

    // --- Enhance prompt for accuracy ---
    let enhancedPrompt = prompt;
    try {
      const { text } = await generateText({
        model: gateway('google/gemini-2.0-flash'),
        prompt: `You are an image editing assistant. Convert this edit request into a clear, 
specific instruction for an AI image editor. Preserve the user's intent exactly. 
Only output the improved prompt — no explanations.
Request: "${prompt}"`,
      });
      if (text && text.trim().length > 0) {
        enhancedPrompt = text.trim();
      }
    } catch {
      // If enhancement fails, use original prompt
      enhancedPrompt = prompt;
    }

    // --- Call GPT-Image-1 via AI Gateway ---
    const { image } = await generateImage({
      model: gateway.imageModel('openai/gpt-image-1'),
      prompt: enhancedPrompt,
      providerOptions: {
        openai: {
          image: imageBuffer,
        },
      },
    });

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${image.base64}`,
      enhancedPrompt,
    });

  } catch (error: any) {
    console.error('[ai-edit-image] Error:', error);

    // If GPT-Image-1 not available, return a clear error
    const message = error?.message ?? 'AI image editing failed.';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
