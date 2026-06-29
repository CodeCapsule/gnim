import OpenAI from 'openai';
import { generateText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { NextRequest, NextResponse } from 'next/server';
import { toFile } from 'openai';

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
});

// OpenAI SDK for image editing (images.edit endpoint)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? process.env.AI_GATEWAY_API_KEY ?? '',
});

/**
 * /api/ai-edit-image
 *
 * AI-powered image editing using OpenAI gpt-image-1 images.edit endpoint.
 * Accepts either:
 *   - FormData with `image` (File) + `prompt` (string)       — uploaded images
 *   - JSON body  with `imageUrl` (string) + `prompt` (string) — previously generated images
 *
 * Returns: { success: true, image: "data:image/png;base64,..." }
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let prompt = '';
    let imageBuffer: Buffer | null = null;
    let imageMimeType = 'image/png';

    // --- Accept both FormData (uploaded file) and JSON (imageUrl) ---
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      prompt = (formData.get('prompt') as string) ?? '';
      const imageFile = formData.get('image') as File | null;
      if (!imageFile) {
        return NextResponse.json({ success: false, message: 'Missing image file.' }, { status: 400 });
      }
      imageMimeType = imageFile.type || 'image/png';
      imageBuffer = Buffer.from(await imageFile.arrayBuffer());
    } else {
      const body = await req.json();
      prompt = body.prompt ?? '';
      const imageUrl = body.imageUrl as string | undefined;
      if (!imageUrl) {
        return NextResponse.json({ success: false, message: 'Missing imageUrl.' }, { status: 400 });
      }
      // Fetch the image — handles both https:// URLs and data: URIs
      if (imageUrl.startsWith('data:')) {
        const [header, b64] = imageUrl.split(',');
        imageMimeType = header.split(':')[1].split(';')[0];
        imageBuffer = Buffer.from(b64, 'base64');
      } else {
        const fetchRes = await fetch(imageUrl);
        if (!fetchRes.ok) {
          return NextResponse.json({ success: false, message: `Failed to fetch image: ${fetchRes.statusText}` }, { status: 502 });
        }
        imageMimeType = fetchRes.headers.get('content-type') ?? 'image/png';
        imageBuffer = Buffer.from(await fetchRes.arrayBuffer());
      }
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
    }

    // --- Call GPT-Image-1 images.edit via OpenAI SDK ---
    // OpenAI images.edit requires PNG format
    const ext = imageMimeType.includes('png') ? 'image.png' : 'image.png';
    const imageFileObj = await toFile(imageBuffer, ext, { type: 'image/png' });

    const response = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFileObj,
      prompt: enhancedPrompt,
      n: 1,
      size: '1024x1024',
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) {
      return NextResponse.json({ success: false, message: 'No image returned from OpenAI.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${b64}`,
      enhancedPrompt,
    });

  } catch (error: any) {
    console.error('[ai-edit-image] Error:', error);
    const message = error?.message ?? 'AI image editing failed.';
    return NextResponse.json(
      { success: false, message },
      { status: 500 }
    );
  }
}
