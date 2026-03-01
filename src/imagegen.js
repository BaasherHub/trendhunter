import axios from "axios";
import fs from "fs";

/**
 * Generates token banner — tries Together.ai first, then Pollinations, then SVG fallback
 */
export async function generateTokenImage(imagePrompt, symbol, tokenName) {
  console.log(`🎨 Generating banner image for $${symbol}...`);

  const enhancedPrompt = `${imagePrompt}, crypto meme coin logo, digital art, vibrant neon colors, fun cartoon style, centered composition, clean background, high quality illustration`;

  // --- Option 1: Together.ai (~$0.002/image, great quality) ---
  if (process.env.TOGETHER_API_KEY) {
    try {
      console.log(`   Trying Together.ai...`);
      const response = await axios.post(
        "https://api.together.xyz/v1/images/generations",
        {
          model: "black-forest-labs/FLUX.1-schnell-Free",
          prompt: enhancedPrompt,
          width: 512,
          height: 512,
          steps: 4,
          n: 1,
          response_format: "b64_json",
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.TOGETHER_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 60000,
        }
      );

      const b64 = response.data?.data?.[0]?.b64_json;
      if (b64) {
        const buffer = Buffer.from(b64, "base64");
        const tmpPath = `/tmp/banner_${symbol}_${Date.now()}.png`;
        fs.writeFileSync(tmpPath, buffer);
        console.log(`✅ Image via Together.ai (${Math.round(buffer.length / 1024)}KB)`);
        return tmpPath;
      }
    } catch (err) {
      console.log(`   ❌ Together.ai failed: ${err.response?.data?.error?.message || err.message}`);
    }
  } else {
    console.log(`   ⚠️  No TOGETHER_API_KEY — skipping Together.ai`);
  }

  // --- Option 2: Pollinations.ai (free, no key) ---
  const seed = Math.floor(Math.random() * 99999);
  const encoded = encodeURIComponent(enhancedPrompt);
  const urls = [
    `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed}&model=turbo&nologo=true`,
    `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed + 1}&model=flux&nologo=true`,
  ];

  for (let i = 0; i < urls.length; i++) {
    try {
      console.log(`   Trying Pollinations attempt ${i + 1}...`);
      if (i > 0) await sleep(5000);
      const response = await axios.get(urls[i], {
        responseType: "arraybuffer",
        timeout: 90000,
        headers: { "User-Agent": "TrendHunterBot/1.0" },
      });
      const contentType = response.headers["content-type"] || "";
      if (response.data.length > 10000 && contentType.includes("image/")) {
        const tmpPath = `/tmp/banner_${symbol}_${Date.now()}.jpg`;
        fs.writeFileSync(tmpPath, response.data);
        console.log(`✅ Image via Pollinations (${Math.round(response.data.length / 1024)}KB)`);
        return tmpPath;
      }
    } catch (err) {
      console.log(`   ❌ Pollinations ${i + 1} failed: ${err.message}`);
    }
  }

  // --- Option 3: Branded SVG fallback (always works) ---
  console.log(`   ⚠️  Using branded SVG fallback...`);
  return generateSVGFallback(symbol, tokenName);
}

function generateSVGFallback(symbol, tokenName) {
  const colorPairs = [
    ["#FF6B6B", "#4ECDC4"], ["#FFD93D", "#6BCB77"],
    ["#4D96FF", "#FF6B6B"], ["#C77DFF", "#E0AAFF"],
    ["#F72585", "#7209B7"], ["#FB8500", "#023047"],
  ];
  const [bg, accent] = colorPairs[Math.floor(Math.random() * colorPairs.length)];
  const name = (tokenName || symbol).slice(0, 18);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:${bg}"/>
      <stop offset="100%" style="stop-color:${accent}"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)" rx="40"/>
  <circle cx="256" cy="190" r="130" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.4)" stroke-width="3"/>
  <text x="256" y="210" font-family="Arial Black,Impact,sans-serif" font-size="68" font-weight="900"
    fill="white" text-anchor="middle" dominant-baseline="middle">$${symbol.slice(0, 6)}</text>
  <text x="256" y="345" font-family="Arial,sans-serif" font-size="28" font-weight="bold"
    fill="rgba(255,255,255,0.95)" text-anchor="middle">${name}</text>
  <text x="256" y="430" font-family="Arial,sans-serif" font-size="22"
    fill="rgba(255,255,255,0.75)" text-anchor="middle">🚀 pump.fun</text>
</svg>`;

  const tmpPath = `/tmp/placeholder_${symbol}_${Date.now()}.svg`;
  fs.writeFileSync(tmpPath, svg);
  console.log(`✅ SVG fallback created for $${symbol}`);
  return tmpPath;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}
