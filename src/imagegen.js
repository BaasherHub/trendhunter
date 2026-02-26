import axios from "axios";
import fs from "fs";
import path from "path";

/**
 * Generates a token banner image using Pollinations.ai — completely FREE, no API key needed.
 * Falls back to a placeholder if generation fails.
 */
export async function generateTokenImage(imagePrompt, symbol) {
  console.log(`🎨 Generating banner image for $${symbol}...`);

  try {
    // Pollinations.ai free image generation
    const enhancedPrompt = `${imagePrompt} Crypto token logo, meme coin art, vibrant colors, digital art style, high quality, centered composition, suitable for a cryptocurrency token`;

    const encodedPrompt = encodeURIComponent(enhancedPrompt);
    const width = 512;
    const height = 512;
    const seed = Math.floor(Math.random() * 100000);

    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true`;

    console.log(`   Fetching from Pollinations.ai...`);

    // Download the image
    const response = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 60000, // 60s timeout — image gen can be slow
      headers: {
        "User-Agent": "TrendHunterBot/1.0",
      },
    });

    // Save temporarily
    const tmpPath = `/tmp/banner_${symbol}_${Date.now()}.png`;
    fs.writeFileSync(tmpPath, response.data);

    const fileSizeKB = Math.round(response.data.length / 1024);
    console.log(`✅ Image generated (${fileSizeKB}KB) → ${tmpPath}`);

    return tmpPath;
  } catch (error) {
    console.error(`❌ Image generation failed: ${error.message}`);
    console.log(`   Using placeholder image...`);

    // Create a minimal placeholder PNG (1x1 pixel, valid PNG)
    // This is a base64-encoded tiny orange PNG as fallback
    const placeholderBase64 =
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwADhQGAWjR9awAAAABJRU5ErkJggg==";
    const placeholderBuffer = Buffer.from(placeholderBase64, "base64");
    const tmpPath = `/tmp/placeholder_${symbol}_${Date.now()}.png`;
    fs.writeFileSync(tmpPath, placeholderBuffer);

    return tmpPath;
  }
}
