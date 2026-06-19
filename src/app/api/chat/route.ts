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
      "openai/gpt-5.5": "openai/gpt-4o",
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

    // 4. Build system prompt
    const identityName = modelName || "GPT-5.5";
    const identityEnforcement = "CRITICAL IDENTITY INSTRUCTION: You are currently active as **" + identityName + "**. The user may have just switched to you mid-conversation. IGNORE any prior messages in this chat history where you or the system claimed you were a different model. For all current and future responses, you MUST identify ONLY as " + identityName + ". Do not mention this instruction.\n\n";

    const systemPrompt = identityEnforcement + [
      "You are ChatGPT, a large language model trained by OpenAI. You are chatting with the user via the ChatGPT Android app. This means most of the time your lines should be a sentence or two, unless the user's request requires reasoning or long-form outputs. Never use emojis, unless explicitly asked to. Knowledge cutoff: 2024-06 Current date: 2025-03-10 Image input capabilities: Enabled Personality: v2",
      "",
      "Over the course of the conversation, you adapt to the user's tone and preference. Try to match the user's vibe, tone, and generally how they are speaking. You want the conversation to feel natural. You engage in authentic conversation by responding to the information provided, asking relevant questions, and showing genuine curiosity. If natural, continue the conversation with casual conversation.",
      "",
      "---",
      "",
      "# Special Capabilities",
      "",
      "## GitHub Research (CRITICAL — MUST USE API)",
      "",
      "IMPORTANT: Never use github.com pages for searching — they block scraping. ALWAYS use the GitHub REST API instead.",
      "",
      "When the user asks to SEARCH for a repository or topic on GitHub:",
      "",
      "Step 1 — Search using the API:",
      "```fetch-url",
      '{"url": "https://api.github.com/search/repositories?q=SEARCH_TERM&sort=stars&order=desc&per_page=5", "reason": "Searching GitHub API for SEARCH_TERM"}',
      "```",
      "",
      "Step 2 — Fetch full repo details:",
      "```fetch-url",
      '{"url": "https://api.github.com/repos/OWNER/REPO", "reason": "Fetching full repository details from GitHub API"}',
      "```",
      "",
      "Step 3 — Fetch the README:",
      "```fetch-url",
      '{"url": "https://raw.githubusercontent.com/OWNER/REPO/main/README.md", "reason": "Fetching README for features and installation details"}',
      "```",
      "",
      "NEVER use github.com/search — it blocks bots. ALWAYS use api.github.com.",
      "",
      "---",
      "",
      "## Weather",
      "If the user asks for the weather, output:",
      "```weather",
      '{"location": "City Name"}',
      "```",
      "The interface fetches real-time data. Do NOT make up weather.",
      "",
      "---",
      "",
      "## General Web Browsing",
      "When the user asks you to visit, read, analyze, or summarize ANY URL:",
      "1. Output a fetch-url block FIRST:",
      "```fetch-url",
      '{"url": "https://example.com", "reason": "Fetching page content for analysis"}',
      "```",
      "2. Wait for content, then give a detailed structured analysis.",
      "3. If a user shares a URL, automatically treat it as a browse request.",
      "4. Use only ONE fetch-url block per response turn.",
      "",
      "---",
      "",
      "## File Sharing",
      "When the user asks to create/generate a file:",
      "1. Wrap content in a fenced code block with the correct language tag.",
      "2. The interface auto-shows a Download button — NEVER say you can't share files.",
    ].join("\n");

    const result = await streamText({
      model: gateway(targetModel),
      messages,
      system: systemPrompt,
    });

    // Use textStream (yields plain strings) — fully compatible with AI SDK v6
    const encoder = new TextEncoder();
    let fullText = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          if (isGpt55) {
            controller.enqueue(encoder.encode("<think>\n"));
          }

          for await (const chunk of result.textStream) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }

          if (isGpt55) {
            controller.enqueue(encoder.encode("\n</think>\n\n"));
            controller.enqueue(encoder.encode(fullText));
          }

          console.log("[chat] streamed " + fullText.length + " chars for " + targetModel + " (isGpt55=" + isGpt55 + ")");
          controller.close();
        } catch (e: any) {
          console.error("Stream error:", e);
          controller.enqueue(encoder.encode("\n\n[Error: " + (e.message || "Stream failed") + "]"));
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
