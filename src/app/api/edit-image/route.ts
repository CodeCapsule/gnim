import { NextResponse } from 'next/server';
import { Jimp } from 'jimp';
import { ImageRouter } from '@/lib/agents/ImageRouter';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const message = formData.get('message') as string | null;
    const conversationId = (formData.get('conversationId') as string | null) ?? 'default';

    if (!imageFile || !message) {
      return NextResponse.json({ success: false, message: 'Missing image or message' }, { status: 400 });
    }

    // --- Route through the multi-agent ImageRouter ---
    const routerResult = await ImageRouter.route(message, conversationId, true);

    if (!routerResult.editPlan) {
      return NextResponse.json({ success: false, message: 'Could not determine edit intent.' }, { status: 400 });
    }

    const { editPlan } = routerResult;

    // --- AI edits: Stub (Replicate/ClipDrop integration point) ---
    if (editPlan.type === 'ai_inpaint' || editPlan.type === 'ai_restyle') {
      return NextResponse.json({
        success: false,
        message: `⚠️ Advanced AI edit detected: "${editPlan.aiPrompt}". This requires a Replicate or ClipDrop API key. Try a simple filter like "pixelate" or "blur" instead.`,
      });
    }

    if (editPlan.type === 'unknown') {
      return NextResponse.json({ success: false, message: 'No recognized edit command found.' });
    }

    // --- Simple edits: handled by Jimp v1 ---
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const img = await Jimp.read(buffer);

    const op = editPlan.operation;
    const params = editPlan.params as Record<string, number>;

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
      // Jimp v1 API: object argument
      img.flip({ horizontal: true, vertical: false });
    } else if (op === 'resize') {
      const newW = Math.floor(img.width * (params.scale ?? 0.5));
      const newH = Math.floor(img.height * (params.scale ?? 0.5));
      img.resize({ w: newW, h: newH });
    } else if (op === 'crop') {
      const cropW = Math.floor(img.width * 0.8);
      const cropH = Math.floor(img.height * 0.8);
      const dx = Math.floor((img.width - cropW) / 2);
      const dy = Math.floor((img.height - cropH) / 2);
      img.crop({ x: dx, y: dy, w: cropW, h: cropH });
    } else if (op === 'sharpen') {
      img.contrast(0.5);
    }

    // Jimp v1: output as buffer then base64
    const outputBuffer = await img.getBuffer('image/jpeg');
    const base64 = outputBuffer.toString('base64');
    const dataUrl = `data:image/jpeg;base64,${base64}`;

    return NextResponse.json({
      success: true,
      image: dataUrl,
      message: `*Image processed: applied ${op} filter.*`,
      warnings: routerResult.warnings,
    });

  } catch (error: any) {
    console.error('Image processing error:', error);
    return NextResponse.json({ success: false, message: error.message || 'Image processing failed' }, { status: 500 });
  }
}
