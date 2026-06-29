import { experimental_generateImage as generateImage, generateText } from 'ai';
import { createGateway } from '@ai-sdk/gateway';
import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 60;

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? '',
});

/**
 * /api/ai-edit-image
 *
 * AI-powered image editing using ONLY the AI Gateway (no separate OPENAI_API_KEY needed).
 *
 * Strategy: Vision-guided regeneration
 *   1. Gemini Flash vision → analyze the image → detailed description
 *   2. Combine description + edit instruction into a rich prompt
 *   3. GPT-Image-1 via gateway → generate new image with the edits applied
 *
 * Accepts either:
 *   - FormData with `image` (File) + `prompt` (string)
 *   - JSON body  with `imageUrl` (data: URI or https://) + `prompt` (string)
 *
 * Returns: { success: true, image: "data:image/png;base64,..." }
 */
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') ?? '';
    let prompt = '';
    let imageBase64 = '';
    let imageMimeType: 'image/png' | 'image/jpeg' | 'image/gif' | 'image/webp' = 'image/png';

    // --- Parse input: FormData (uploaded file) or JSON (imageUrl) ---
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      prompt = (formData.get('prompt') as string) ?? '';
      const imageFile = formData.get('image') as File | null;
      if (!imageFile) {
        return NextResponse.json({ success: false, message: 'Missing image file.' }, { status: 400 });
      }
      const type = imageFile.type;
      imageMimeType = (type === 'image/jpeg' || type === 'image/gif' || type === 'image/webp')
        ? type : 'image/png';
      imageBase64 = Buffer.from(await imageFile.arrayBuffer()).toString('base64');
    } else {
      const body = await req.json();
      prompt = body.prompt ?? '';
      const imageUrl = body.imageUrl as string | undefined;
      if (!imageUrl) {
        return NextResponse.json({ success: false, message: 'Missing imageUrl.' }, { status: 400 });
      }
      if (imageUrl.startsWith('data:')) {
        const [header, b64] = imageUrl.split(',');
        const type = header.split(':')[1].split(';')[0];
        imageMimeType = (type === 'image/jpeg' || type === 'image/gif' || type === 'image/webp')
          ? type : 'image/png';
        imageBase64 = b64;
      } else {
        const fetchRes = await fetch(imageUrl);
        if (!fetchRes.ok) {
          return NextResponse.json({ success: false, message: `Failed to fetch image.` }, { status: 502 });
        }
        const type = fetchRes.headers.get('content-type') ?? 'image/png';
        imageMimeType = (type === 'image/jpeg' || type === 'image/gif' || type === 'image/webp')
          ? type : 'image/png';
        imageBase64 = Buffer.from(await fetchRes.arrayBuffer()).toString('base64');
      }
    }

    if (!prompt) {
      return NextResponse.json({ success: false, message: 'Missing prompt.' }, { status: 400 });
    }

    // --- Step 1: Gemini Vision — analyze the existing image ---
    let imageDescription = '';
    try {
      const { text } = await generateText({
        model: gateway('google/gemini-2.0-flash'),
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image' as const,
                image: imageBase64,
                mediaType: imageMimeType,
              },
              {
                type: 'text',
                text: 'Describe this image in rich detail: subject, pose, clothing, expression, background, lighting, color palette, style, and mood. Be thorough — your description will be used to regenerate this image with modifications.',
              },
            ],
          },
        ],
      });
      imageDescription = text.trim();
    } catch (err) {
      console.warn('[ai-edit-image] Vision step failed, using prompt only:', err);
      imageDescription = '';
    }

    // --- Step 2: Build the combined edit prompt ---
    let finalPrompt: string;

    if (imageDescription) {
      finalPrompt = `Based on this image: ${imageDescription}

Apply this modification: ${prompt}

Important: Keep all other visual elements (subject appearance, style, lighting, background) exactly the same. Only apply the requested change. High quality, photorealistic, detailed.`;
    } else {
      // Fallback: vision failed, use prompt only
      finalPrompt = `${prompt}. High quality, photorealistic, highly detailed, professional photography.`;
    }

    // --- Step 3: Generate new image via GPT-Image-1 ---
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
      return NextResponse.json({ success: false, message: 'No image returned.' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      image: `data:image/png;base64,${base64}`,
      enhancedPrompt: finalPrompt,
    });

  } catch (error: any) {
    console.error('[ai-edit-image] Error:', error);
    return NextResponse.json(
      { success: false, message: error?.message ?? 'AI image editing failed.' },
      { status: 500 }
    );
  }
}
