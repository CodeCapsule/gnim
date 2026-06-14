const { google } = require("@ai-sdk/google");
const { generateText } = require("ai");

// Load env variables
const fs = require('fs');
if (fs.existsSync('.env.local')) {
  const content = fs.readFileSync('.env.local', 'utf8');
  content.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
      const key = match[1];
      let value = match[2] || '';
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.substring(1, value.length - 1);
      }
      process.env[key] = value;
    }
  });
}

async function testModel(modelName) {
  console.log(`Testing model: ${modelName}...`);
  try {
    const result = await generateText({
      model: google(modelName),
      prompt: "Hello",
    });
    console.log(`Success with ${modelName}:`, result.text);
    return true;
  } catch (err) {
    console.error(`Error with ${modelName}:`, err.message);
    return false;
  }
}

async function main() {
  const models = [
    "gemini-2.0-flash",
    "gemini-1.5-flash",
    "gemini-1.5-pro",
  ];
  for (const m of models) {
    await testModel(m);
  }
}

main();
