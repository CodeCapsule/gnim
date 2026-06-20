import { NextResponse } from "next/server";
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
      // Import directly from lib to bypass the test-data loader in pdf-parse's index.js
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const pdfParse = require("pdf-parse/lib/pdf-parse");
      const data = await pdfParse(buffer);
      text = data.text;
    } else if (
      file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      file.name.toLowerCase().endsWith(".docx")
    ) {
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } else {
      // Fallback: read as UTF-8 text (csv, md, json, code files, logs, etc.)
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
