import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Uses Claude to generate a meme coin concept based on a trending topic
 */
export async function generateTokenConcept(trendingTopic) {
  console.log(`🤖 Generating token concept for: "${trendingTopic}"`);

  const prompt = `You are a creative meme coin strategist. Based on the trending topic "${trendingTopic}", create a fun, viral meme coin concept for Solana/pump.fun.

Respond ONLY with a valid JSON object — no markdown, no explanation, just raw JSON:

{
  "name": "Token Name (2-4 words max, catchy)",
  "symbol": "TICKER (3-6 letters, uppercase)",
  "description": "A fun, engaging description for the token (50-150 words). Include the trend, why it's relevant, what the community stands for, and a call to action. Keep it hype but not financial advice.",
  "imagePrompt": "A detailed prompt for generating a token banner image. Should be colorful, crypto-themed, meme-worthy, and reference the trend. Describe style, colors, characters, mood. 2-3 sentences."
}

Rules:
- Name and symbol must be unique and memeable
- Description should feel community-driven and exciting
- Image prompt should create a striking, recognizable banner
- No sensitive topics (politics, violence, real people by name)
- Think Dogecoin, Pepe, Bonk energy`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].text.trim();

  // Strip markdown code blocks if present
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

  const concept = JSON.parse(cleaned);

  console.log(`✅ Token concept generated:`);
  console.log(`   Name: ${concept.name}`);
  console.log(`   Symbol: $${concept.symbol}`);

  return concept;
}
