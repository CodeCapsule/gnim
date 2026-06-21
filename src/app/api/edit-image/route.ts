import { NextResponse } from 'next/server';
import Jimp from 'jimp';

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get('image') as File | null;
    const message = formData.get('message') as string | null;

    if (!imageFile || !message) {
      return NextResponse.json({ success: false, message: 'Missing image or message' }, { status: 400 });
    }

    const lowerMsg = message.toLowerCase();
    
    // AI INTENT DETECTION (Stubbed for future integration)
    const isAiEdit = ['make it look like', 'change the style', 'add', 'remove', 'background'].some(kw => lowerMsg.includes(kw));
    
    if (isAiEdit) {
      return NextResponse.json({ 
        success: false, 
        message: '⚠️ AI-based edits (like adding objects or changing backgrounds) require Replicate or ClipDrop API keys which are not currently configured.' 
      });
    }

    // SIMPLE FILTERS INTENT DETECTION
    const isBasicFilter = ["pixelate", "blur", "crop", "resize", "shrink", "smaller", "grayscale", "black and white", "rotate", "invert", "sharpen", "brighten", "darken", "flip", "sepia"].some(f => lowerMsg.includes(f));

    if (!isBasicFilter) {
      return NextResponse.json({ success: false, message: "No recognized edit command found." });
    }

    // PROCESS WITH JIMP
    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const img = await Jimp.read(buffer);

    if (lowerMsg.includes('pixelate')) {
      img.pixelate(15);
    } else if (lowerMsg.includes('blur')) {
      img.blur(10);
    } else if (lowerMsg.includes('grayscale') || lowerMsg.includes('black and white')) {
      img.greyscale();
    } else if (lowerMsg.includes('sepia')) {
      img.sepia();
    } else if (lowerMsg.includes('invert')) {
      img.invert();
    } else if (lowerMsg.includes('brighten') || lowerMsg.includes('brighter')) {
      img.brightness(0.5); 
    } else if (lowerMsg.includes('darken') || lowerMsg.includes('darker')) {
      img.brightness(-0.5);
    } else if (lowerMsg.includes('rotate')) {
      img.rotate(90);
    } else if (lowerMsg.includes('flip')) {
      img.flip(true, false);
    } else if (lowerMsg.includes('resize') || lowerMsg.includes('shrink') || lowerMsg.includes('smaller')) {
      img.scale(0.5);
    } else if (lowerMsg.includes('crop')) {
      const cropW = Math.floor(img.bitmap.width * 0.8);
      const cropH = Math.floor(img.bitmap.height * 0.8);
      const dx = (img.bitmap.width - cropW) / 2;
      const dy = (img.bitmap.height - cropH) / 2;
      img.crop(dx, dy, cropW, cropH);
    } else if (lowerMsg.includes('sharpen')) {
      img.contrast(0.5);
    }

    const mime = img.getMIME();
    const processedBuffer = await img.getBufferAsync(mime);
    const base64 = processedBuffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    return NextResponse.json({ 
      success: true, 
      image: dataUrl, 
      message: `*Backend processed image using filter: ${message}*` 
    });

  } catch (error: any) {
    console.error("Image processing error:", error);
    return NextResponse.json({ success: false, message: error.message || 'Image processing failed' }, { status: 500 });
  }
}
