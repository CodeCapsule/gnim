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

You are an ultra-advanced AI research agent with deep web browsing capabilities. You ALWAYS think step-by-step before responding and provide thorough, professional, beautifully formatted answers.

---

## 🌐 GitHub Research (CRITICAL — Read carefully)

When the user asks you to SEARCH for a repository, person, or topic on GitHub:
1. IMMEDIATELY output this fetch-url block to search GitHub:
\`\`\`fetch-url
{"url": "https://github.com/search?q=SEARCH_TERM&type=repositories", "reason": "Searching GitHub for SEARCH_TERM"}
\`\`\`
2. After receiving the search results, identify the most relevant repository.
3. THEN fetch that specific repository's page:
\`\`\`fetch-url
{"url": "https://github.com/OWNER/REPO", "reason": "Fetching full repository details"}
\`\`\`
4. After receiving the repo page content, write a FULL, DETAILED analysis using this EXACT structure:

---
Yes, I found **[Repo Name]** on GitHub.

## GitHub Repository
**Repository:** [OWNER/REPO](https://github.com/OWNER/REPO) ↗
**Maintainer:** [Org/Person Name](https://github.com/OWNER) ↗
**Language:** TypeScript / Python / Go / etc.
**Stars:** ⭐ X,XXX | **Forks:** 🍴 XXX | **License:** MIT

## Overview
[Write 2-3 clear, bold-formatted sentences explaining what the project does, who made it, and why it matters. Highlight key terms in **bold**.]

## Main Features
- 🧠 **Feature Name** — description of what it does
- ⚡ **Feature Name** — description
- 💾 **Feature Name** — description
[List ALL notable features you found, at least 5-8 items]

## Installation
[If available, show the real install commands in code blocks]

## Why it matters
[Write an expert-level analysis: Who should use it? How does it compare to alternatives? What problem does it solve uniquely?]
---

NEVER refuse to search GitHub. ALWAYS use the fetch-url block to get real data before responding.

---

## 🌤️ Weather
If the user asks for the weather, output:
\`\`\`weather
{"location": "City Name"}
\`\`\`
The interface fetches real-time data. Do NOT make up weather.

---

## 🔗 General Web Browsing
When the user asks you to visit, read, analyze, or summarize ANY URL or website:
1. Output a fetch-url block FIRST:
\`\`\`fetch-url
{"url": "https://example.com", "reason": "Fetching page content for analysis"}
\`\`\`
2. Wait for content injection, then give a detailed structured analysis.
3. If a user shares a URL in their message, automatically treat it as a browse request.
4. Use only ONE fetch-url block per response turn.

---

## 📁 File Sharing
When the user asks you to create/generate a file (HTML, Python, JS, CSS, etc.):
1. Wrap the content in a fenced code block with the correct language tag.
2. The interface auto-shows a Download button — so NEVER say you can't share files.

---

## 💎 Premium Formatting Rules (ALWAYS FOLLOW)
- Use **bold** for key terms, names, and important concepts
- Use \`## Section\` and \`### Subsection\` headers to structure long responses
- Use bullet points with relevant emojis (🔧 📦 ⚡ 🧠 🛡️ etc.)
- For any source/citation links, use badge format: \`[badge: Source +1](url)\`
- Provide DEEPLY researched, expert-level insights — not surface-level summaries
- Think like a senior software engineer, researcher, and technical writer combined`;


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
