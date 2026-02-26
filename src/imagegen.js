import axios from "axios";
import fs from "fs";

/**
 * Generates a token banner using Pollinations.ai with retries
 */
export async function generateTokenImage(imagePrompt, symbol, tokenName) {
  console.log(`🎨 Generating banner image for $${symbol}...`);

  const enhancedPrompt = `${imagePrompt}, crypto meme coin logo, digital art, vibrant neon colors, fun cartoon style, centered composition, clean background, high quality illustration`;
  const encoded = encodeURIComponent(enhancedPrompt);
  const seed = Math.floor(Math.random() * 99999);

  // Try Pollinations up to 4 times with different models
  const attempts = [
    `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed}&model=turbo&nologo=true`,
    `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed + 1}&model=flux&nologo=true`,
    `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed + 2}&model=turbo&nologo=true`,
    `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed + 3}&model=flux-realism&nologo=true`,
  ];

  for (let i = 0; i < attempts.length; i++) {
    try {
      console.log(`   Attempt ${i + 1}/4 via Pollinations...`);

      // Add delay between retries to avoid rate limits
      if (i > 0) await sleep(5000);

      const response = await axios.get(attempts[i], {
        responseType: "arraybuffer",
        timeout: 90000,
        headers: { "User-Agent": "TrendHunterBot/1.0" },
      });

      // Validate it's a real image (not an error page)
      const contentType = response.headers["content-type"] || "";
      const isImage = contentType.includes("image/") || response.data.length > 10000;

      if (!isImage) {
        console.log(`   ⚠️  Response doesn't look like an image, retrying...`);
        continue;
      }

      const tmpPath = `/tmp/banner_${symbol}_${Date.now()}.jpg`;
      fs.writeFileSync(tmpPath, response.data);
      const kb = Math.round(response.data.length / 1024);
      console.log(`✅ Image generated (${kb}KB)`);
      return tmpPath;

    } catch (err) {
      console.log(`   ❌ Attempt ${i + 1} failed: ${err.message}`);
    }
  }

  // Last resort: generate a simple colored PNG with token symbol using canvas-like approach
  console.log(`   ⚠️  All image services failed — generating text-based placeholder`);
  return generateTextPlaceholder(symbol, tokenName);
}

/**
 * Creates a simple but token-specific SVG converted to PNG as last resort
 * At least shows the token symbol and name — better than a random stock photo
 */
function generateTextPlaceholder(symbol, tokenName) {
  const colors = [
    ["#FF6B6B", "#4ECDC4"], ["#A8E6CF", "#FF8B94"],
    ["#FFD93D", "#6BCB77"], ["#4D96FF", "#FF6B6B"],
    ["#C77DFF", "#E0AAFF"], ["#F72585", "#7209B7"],
  ];
  const [bg, accent] = colors[Math.floor(Math.random() * colors.length)];
  const name = (tokenName || symbol).slice(0, 20);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bg}"/>
      <stop offset="100%" style="stop-color:${accent}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)" rx="40"/>
  <circle cx="256" cy="200" r="120" fill="rgba(255,255,255,0.2)"/>
  <text x="256" y="220" font-family="Arial Black, sans-serif" font-size="72" font-weight="900"
    fill="white" text-anchor="middle" dominant-baseline="middle">$${symbol.slice(0, 6)}</text>
  <text x="256" y="340" font-family="Arial, sans-serif" font-size="32" font-weight="bold"
    fill="rgba(255,255,255,0.9)" text-anchor="middle">${name}</text>
  <text x="256" y="420" font-family="Arial, sans-serif" font-size="24"
    fill="rgba(255,255,255,0.7)" text-anchor="middle">🚀 pump.fun</text>
</svg>`;

  const tmpPath = `/tmp/placeholder_${symbol}_${Date.now()}.svg`;
  fs.writeFileSync(tmpPath, svg);
  console.log(`✅ Text placeholder created for $${symbol}`);
  return tmpPath;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
