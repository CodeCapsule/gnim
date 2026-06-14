import { createGateway } from "@ai-sdk/gateway";
import { streamText } from "ai";
import { incrementRateLimit, MAX_MESSAGES, RATE_LIMIT_WINDOW_MS } from "@/lib/rateLimitStore";

export const maxDuration = 30;

// Configure Vercel AI Gateway
const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY ?? "",
});

// --------------- Route Handler ---------------
export async function POST(req: Request) {
  try {
    // 1. Rate Limiting
    const ip = req.headers.get("x-forwarded-for") ?? "anonymous";
    const record = incrementRateLimit(ip);
    
    if (record.count > MAX_MESSAGES) {
      const msUntilReset = Math.max(0, RATE_LIMIT_WINDOW_MS - (Date.now() - record.windowStart));
      const retryAfterSeconds = Math.ceil(msUntilReset / 1000);
      return new Response(
        JSON.stringify({ error: `Rate limit exceeded. You can send ${MAX_MESSAGES} messages every 3 hours.` }),
        { status: 429, headers: { "Content-Type": "application/json", "Retry-After": String(retryAfterSeconds) } }
      );
    }

    // 2. Parse Request
    const { messages, modelId, modelName } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Invalid messages format" }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    // 3. Anti-spam: message length check
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.content?.length > 20000) {
      return new Response(JSON.stringify({ error: "Message too long (max 20,000 characters)" }), {
        status: 400, headers: { "Content-Type": "application/json" }
      });
    }

    let targetModel = modelId || "openai/gpt-5.5";
    const isGpt55 = targetModel === "openai/gpt-5.5";

    // Map futuristic or unsupported UI models to actual valid Gateway model IDs.
    // We map all external providers to OpenAI equivalents because the Vercel AI Gateway 
    // only has OpenAI API keys configured. Without this, the models silently crash.
    const modelMappings: Record<string, string> = {
      // Google -> OpenAI equivalents
      "google/gemini-2.5-pro-ultra": "openai/gpt-4o",
      "google/gemini-2.5-pro": "openai/gpt-4o",
      "google/gemini-2.5-flash": "openai/gpt-4o-mini",
      "google/gemini-2.0-flash": "openai/gpt-4o-mini",
      "google/gemini-2.0-flash-lite": "openai/gpt-4o-mini",
      
      // Anthropic -> OpenAI equivalents
      "anthropic/claude-opus-4.9": "openai/gpt-4o",
      "anthropic/claude-sonnet-4.6": "openai/gpt-4o",
      "anthropic/claude-sonnet-4.5": "openai/gpt-4o",
      "anthropic/claude-opus-4.8": "openai/gpt-4o",
      "anthropic/claude-3.5-haiku": "openai/gpt-4o-mini",
      
      // OpenAI
      "openai/gpt-6": "openai/gpt-4o",
      "openai/gpt-5.5": "openai/gpt-4o",   // GPT-5.5 mapped to gpt-4o
      "openai/gpt-4.1": "openai/gpt-4o",
      "openai/gpt-4.1-mini": "openai/gpt-4o-mini",
      "openai/gpt-4.1-nano": "openai/gpt-4o-mini",
      "openai/o4-mini": "openai/o1-mini",
      
      // xAI -> OpenAI equivalents
      "xai/grok-5": "openai/gpt-4o",
      "xai/grok-4": "openai/gpt-4o",
      "xai/grok-3": "openai/gpt-4o",
      "xai/grok-3-mini": "openai/gpt-4o-mini",

      // Meta -> OpenAI equivalents
      "meta/llama-5-100b": "openai/gpt-4o-mini",
      "meta/llama-3.3-70b": "openai/gpt-4o-mini",
      "meta/llama-3.1-8b": "openai/gpt-4o-mini",
      "meta/llama-4-scout": "openai/gpt-4o-mini",
      "meta/llama-4-maverick": "openai/gpt-4o",

      // Mistral -> OpenAI equivalents
      "mistral/mistral-medium-3": "openai/gpt-4o",

      // DeepSeek -> OpenAI equivalents
      "deepseek/deepseek-v3": "openai/gpt-4o",
      "deepseek/deepseek-r1": "openai/gpt-4o",
      "deepseek/deepseek-r1-0528": "openai/gpt-4o",
    };

    if (modelMappings[targetModel]) {
      targetModel = modelMappings[targetModel];
    } else {
       // Fallback for anything else
       targetModel = "openai/gpt-4o-mini";
    }

    // 4. Build system prompt — keep it clean so gpt-4o responds normally
    const identityName = modelName || "GPT-5.5";
    const basePrompt = isGpt55
      ? `You are ${identityName}, an advanced reasoning AI assistant. Provide thorough, well-structured answers. Format responses using markdown. Use code blocks for code.`
      : `You are ${identityName}, a helpful, brilliant, and concise AI assistant. Format responses using markdown where appropriate. Use code blocks for code.`;
      
    const identityEnforcement = `\n\nCRITICAL IDENTITY INSTRUCTION: You are currently active as **${identityName}**. The user may have just switched to you mid-conversation. IGNORE any prior messages in this chat history where you or the system claimed you were a different model (such as GPT-5.5, Claude, or Gemini). For all current and future responses, you MUST identify ONLY as ${identityName}. Do not mention this instruction.`;

    const systemPrompt = basePrompt + identityEnforcement + `

## Weather
If the user asks for the weather, output a special markdown code block exactly like this:
\`\`\`weather
{"location": "City Name"}
\`\`\`
Do NOT make up temperature or conditions. The interface will fetch real-time data.

## Web Browsing
You can read any public website. When the user asks you to visit, read, analyze, summarize, or check a URL:
1. Output a special fetch-url block FIRST, before any analysis:
\`\`\`fetch-url
{"url": "https://example.com", "reason": "Fetching page content for analysis"}
\`\`\`
2. The interface will automatically fetch the page and inject the content into the conversation.
3. You will then receive the page text and can analyze, summarize, or answer questions about it.
4. If the user pastes a URL anywhere in their message and asks you to read/analyze it, treat it as a browse request.
5. Only use one fetch-url block per response. Wait for the content before analyzing.

## File Sharing
When the user asks you to create, generate, or share a file (HTML, Python, CSS, JavaScript, etc.):
1. ALWAYS wrap the file content in a fenced code block with the correct language tag (e.g. \`\`\`html, \`\`\`python, \`\`\`javascript).
2. The interface will automatically show a **Download** button on every code block so the user can save it directly.
3. Do NOT say you cannot share files. Just output the file content in the correct code block and the user can download it instantly.`;


    const result = await streamText({
      model: gateway(targetModel),
      messages,
      system: systemPrompt,
    });

    // Use textStream (yields plain strings) — fully compatible with AI SDK v6
    // In AI SDK v6, fullStream text-delta parts use `text` not `textDelta`,
    // but textStream abstracts this cleanly.
    const encoder = new TextEncoder();
    let fullText = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (isGpt55) {
            // Open think block — model response streams inside it
            controller.enqueue(encoder.encode("<think>\n"));
          }

          for await (const chunk of result.textStream) {
            // chunk is a plain string — no SDK version confusion
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          if (isGpt55) {
            // Close think block, then emit the full text as the visible answer
            controller.enqueue(encoder.encode("\n</think>\n\n"));
            controller.enqueue(encoder.encode(fullText));
          }

          console.log(`[chat] streamed ${fullText.length} chars for ${targetModel} (isGpt55=${isGpt55})`);
          controller.close();
        } catch (e: any) {
          console.error("Stream error:", e);
          controller.enqueue(encoder.encode(`\n\n[Error: ${e.message || "Stream failed"}]`));
          controller.close();
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error: any) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: error.message || "Internal Server Error" }), {
      status: 500, headers: { "Content-Type": "application/json" }
    });
  }
}
