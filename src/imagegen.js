import axios from "axios";
import fs from "fs";

/**
 * Generates a token banner using multiple free services with fallbacks
 */
export async function generateTokenImage(imagePrompt, symbol) {
  console.log(`🎨 Generating banner image for $${symbol}...`);

  const enhancedPrompt = `${imagePrompt} crypto token logo meme coin art vibrant colors digital art high quality`;
  const encoded = encodeURIComponent(enhancedPrompt);
  const seed = Math.floor(Math.random() * 99999);

  // Try multiple free image services in order
  const services = [
    {
      name: "Pollinations (turbo)",
      url: `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed}&model=turbo&nologo=true`,
    },
    {
      name: "Pollinations (flux)",
      url: `https://image.pollinations.ai/prompt/${encoded}?width=512&height=512&seed=${seed}&model=flux&nologo=true`,
    },
    {
      name: "Picsum placeholder",
      url: `https://picsum.photos/seed/${symbol}/512/512`,
    },
  ];

  for (const service of services) {
    try {
      console.log(`   Trying ${service.name}...`);
      const response = await axios.get(service.url, {
        responseType: "arraybuffer",
        timeout: 60000,
        headers: { "User-Agent": "TrendHunterBot/1.0" },
      });

      if (response.data.length < 1000) {
        console.log(`   ⚠️  Response too small, trying next...`);
        continue;
      }

      const tmpPath = `/tmp/banner_${symbol}_${Date.now()}.jpg`;
      fs.writeFileSync(tmpPath, response.data);
      const kb = Math.round(response.data.length / 1024);
      console.log(`✅ Image ready (${kb}KB) via ${service.name}`);
      return tmpPath;
    } catch (err) {
      console.log(`   ❌ ${service.name} failed: ${err.message}`);
    }
  }

  // Final fallback: generate a minimal valid PNG in memory
  console.log(`   Using built-in fallback image...`);
  const fallbackPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    "base64"
  );
  const tmpPath = `/tmp/fallback_${symbol}_${Date.now()}.png`;
  fs.writeFileSync(tmpPath, fallbackPng);
  return tmpPath;
}
