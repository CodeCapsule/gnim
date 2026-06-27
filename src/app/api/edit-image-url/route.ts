import { NextResponse } from 'next/server';
import { Jimp } from 'jimp';
import { loadFont } from 'jimp';
import { SANS_32_WHITE, SANS_16_WHITE } from 'jimp/fonts';
import { ImageRouter } from '@/lib/agents/ImageRouter';

/**
 * /api/edit-image-url
 *
 * Accepts a public image URL (e.g., from Pollinations.ai) and a message.
 * - Simple filters (blur, grayscale, etc.) → Jimp
 * - Text overlay → Jimp bitmap font
 * - AI edits (remove, replace, restyle, add object) → forwarded to /api/ai-edit-image (GPT-Image-1)
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { imageUrl, message, conversationId } = body as {
      imageUrl?: string;
      message?: string;
      conversationId?: string;
    };

    if (!imageUrl || !message) {
      return NextResponse.json({ success: false, message: 'Missing imageUrl or message' }, { status: 400 });
    }

    // --- Route through the multi-agent ImageRouter ---
    const routerResult = await ImageRouter.route(message, conversationId ?? 'default', true);

    if (!routerResult.editPlan) {
      return NextResponse.json({ success: false, message: 'Could not determine edit intent.' }, { status: 400 });
    }

    const { editPlan } = routerResult;

    // --- Fetch image from URL first (needed for all paths) ---
    const fetchRes = await fetch(imageUrl);
    if (!fetchRes.ok) {
      return NextResponse.json(
        { success: false, message: `Failed to fetch image from URL: ${fetchRes.statusText}` },
        { status: 502 }
      );
    }
    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // --- AI edits: forward to /api/ai-edit-image (GPT-Image-1) ---
    if (editPlan.type === 'ai_inpaint' || editPlan.type === 'ai_restyle') {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
      const aiRes = await fetch(`${baseUrl}/api/ai-edit-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl,
          prompt: editPlan.aiPrompt ?? message,
        }),
      });
      const aiData = await aiRes.json();
      if (aiData.success) {
        return NextResponse.json({
          success: true,
          image: aiData.image,
          message: `*AI edit applied: "${editPlan.aiPrompt ?? message}"*`,
        });
      }
      return NextResponse.json({ success: false, message: aiData.message ?? 'AI edit failed.' });
    }

    if (editPlan.type === 'unknown') {
      return NextResponse.json({ success: false, message: 'No recognized edit command found.' });
    }

    // --- Simple edits: Jimp v1 ---
    const img = await Jimp.read(buffer);
    const op = editPlan.operation;
    const params = editPlan.params as Record<string, any>;

    if (op === 'pixelate') {
      img.pixelate(params.pixelSize ?? 15);
    } else if (op === 'blur') {
      img.blur(params.radius ?? 10);
    } else if (op === 'grayscale') {
      img.greyscale();
    } else if (op === 'sepia') {
      img.sepia();
    } else if (op === 'invert') {
      img.invert();
    } else if (op === 'brighten') {
      img.brightness(params.amount ?? 0.5);
    } else if (op === 'darken') {
      img.brightness(params.amount ?? -0.5);
    } else if (op === 'rotate') {
      img.rotate(params.degrees ?? 90);
    } else if (op === 'flip') {
      img.flip({ horizontal: true, vertical: false });
    } else if (op === 'resize') {
      const newW = Math.floor(img.width * (params.scale ?? 0.5));
      const newH = Math.floor(img.height * (params.scale ?? 0.5));
      img.resize({ w: newW, h: newH });
    } else if (op === 'crop') {
      const cropW = Math.floor(img.width * 0.8);
      const cropH = Math.floor(img.height * 0.8);
      img.crop({
        x: Math.floor((img.width - cropW) / 2),
        y: Math.floor((img.height - cropH) / 2),
        w: cropW,
        h: cropH,
      });
    } else if (op === 'sharpen') {
      img.contrast(0.5);
    } else if (op === 'text') {
      // Jimp bitmap font text overlay
      const textContent = (params.text as string) || 'Text';
      const font = textContent.length > 20
        ? await loadFont(SANS_16_WHITE)
        : await loadFont(SANS_32_WHITE);
      const x = 10;
      const y = img.height - (textContent.length > 20 ? 40 : 60);
      img.print({ font, x, y, text: textContent, maxWidth: img.width - 20 });
    }

    const outputBuffer = await img.getBuffer('image/jpeg');
    const base64 = outputBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    return NextResponse.json({
      success: true,
      image: dataUrl,
      message: `*Applied ${op} to the previous image.*`,
      warnings: routerResult.warnings,
    });

  } catch (error: any) {
    console.error('[edit-image-url] Error:', error);
    return NextResponse.json(
      { success: false, message: error.message || 'Image processing failed' },
      { status: 500 }
    );
  }
}
