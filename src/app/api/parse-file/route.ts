import { NextResponse } from "next/server";
// Polyfill for pdf.js running in Node environment
if (typeof global !== "undefined") {
  if (!global.DOMMatrix) {
    (global as any).DOMMatrix = class DOMMatrix {};
  }
  if (!global.ImageData) {
    (global as any).ImageData = class ImageData {};
  }
  if (!global.Path2D) {
    (global as any).Path2D = class Path2D {};
  }
}

const pdf = require("pdf-parse");
import mammoth from "mammoth";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    let text = "";

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfParser = pdf.default || pdf;
      const data = await pdfParser(buffer);
      text = data.text;
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || 
      file.name.toLowerCase().endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      // Fallback: read as text (for raw code, csv, md, etc.)
      text = await file.text();
    }

    return NextResponse.json({ text });
  } catch (error: any) {
    console.error("Parse file error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to parse file" },
      { status: 500 }
    );
  }
}
