import { experimental_generateImage } from 'ai';
import { google } from '@ai-sdk/google';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function test() {
  try {
    console.log("Testing Google Imagen 3...");
    const result = await experimental_generateImage({
      model: google.image('imagen-3.0-generate-001'),
      prompt: 'A photorealistic cat sipping coffee in a cafe',
      n: 1,
      size: '1024x1024',
    });

    console.log("SUCCESS! Base64 length:", result.image.base64?.length);
  } catch (err: any) {
    console.error("ERROR:", err.message);
  }
}

test();
