import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function generateTokenConcept(trendingTopic) {
  console.log(`🤖 Generating token concept for: "${trendingTopic}"`);

  const prompt = `You are a creative meme coin strategist. Based on the trending topic "${trendingTopic}", create a fun, viral meme coin concept for Solana/pump.fun.

Respond ONLY with a valid JSON object — no markdown, no explanation, just raw JSON:

{
  "name": "Token Name (2-4 words max, catchy)",
  "symbol": "TICKER (3-6 letters, uppercase)",
  "description": "A fun engaging description. STRICT LIMIT: under 400 characters total. Be hype, community-driven, reference the trend. No financial advice.",
  "imagePrompt": "A detailed image generation prompt. Colorful, crypto-themed, meme-worthy, references the trend. 2 sentences max."
}

Rules:
- Name and symbol must be unique and memeable
- Description MUST be under 400 characters — this is critical
- No sensitive topics, no real people by name
- Think Dogecoin, Pepe, Bonk energy`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [{ role: "user", content: prompt }],
  });

  const raw = message.content[0].text.trim();
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const concept = JSON.parse(cleaned);

  // Hard safety trim — ClawPump max is 500 chars
  if (concept.description.length > 490) {
    concept.description = concept.description.slice(0, 487) + "...";
  }

  console.log(`✅ Token concept generated:`);
  console.log(`   Name: ${concept.name}`);
  console.log(`   Symbol: $${concept.symbol}`);
  console.log(`   Description length: ${concept.description.length} chars`);

  return concept;
}
