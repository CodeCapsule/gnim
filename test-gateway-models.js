import { createGateway } from "@ai-sdk/gateway";
import { generateText } from "ai";
import { config } from "dotenv";
config({ path: ".env.local" });

const gateway = createGateway({
  apiKey: process.env.AI_GATEWAY_API_KEY,
});

async function testModel(modelId) {
  try {
    const { text } = await generateText({
      model: gateway(modelId),
      prompt: "Hello",
    });
    console.log(`✅ ${modelId} SUCCESS:`, text);
  } catch (e) {
    console.log(`❌ ${modelId} FAILED:`, e.message);
  }
}

async function run() {
  await testModel("google/gemini-1.5-flash");
  await testModel("google/gemini-1.5-pro");
  await testModel("google/gemini-2.0-flash");
  await testModel("anthropic/claude-3-5-sonnet-20241022");
  await testModel("anthropic/claude-3-haiku-20240307");
  await testModel("openai/gpt-4o");
}

run();
