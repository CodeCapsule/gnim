const { loadFont } = require('@jimp/plugin-print');
const { SANS_32_BLACK } = require('jimp/fonts');

async function test() {
  const font = await loadFont(SANS_32_BLACK);
  console.log("Font loaded successfully:", !!font);
}

test().catch(console.error);
