import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function generateTokenConcept(trendingTopic, retries = 4) {
  console.log(`🤖 Generating animal coin concept for: "${trendingTopic}"`);

  const prompt = `You are a viral meme coin creator specializing in animal-themed Solana tokens. You understand what makes animal coins succeed: strong community identity, cute/funny narrative, and a mascot people want to root for.

Based on this trending topic: "${trendingTopic}"

Create an animal meme coin concept. Respond ONLY with valid JSON, no markdown, no explanation:

{
  "name": "Coin name (2-3 words, must reference a specific animal, cute/funny)",
  "symbol": "TICKER (3-5 letters uppercase, animal-related abbreviation)",
  "description": "STRICT MAX 400 CHARS. Write like a hype community post: introduce the animal mascot, give it personality, reference the trend, rally the community. Use 1-2 emojis max. No financial advice.",
  "imagePrompt": "Detailed prompt for a meme coin banner. Feature a cute/funny cartoon version of the animal mascot, crypto themed, vibrant colors, pump.fun style art. Include specific pose, expression, accessories, background. 2 sentences.",
  "animalType": "The specific animal featured (e.g. capybara, golden retriever, penguin)"
}

Rules:
- The animal MUST be central to the name and story
- Give the animal a personality (brave, lazy, chaotic, wholesome, etc.)
- Description should feel like a community rallying cry
- Think: Dogecoin, Bonk, Popcat, Cat in a Dogs World energy
- Symbol must be clearly animal-related (CAPY, BONK, DOGE, etc.)
- DESCRIPTION MUST BE UNDER 400 CHARACTERS — this is critical`;

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const message = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        messages: [{ role: "user", content: prompt }],
      });

      const raw = message.content[0].text.trim();
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const concept = JSON.parse(cleaned);

      if (concept.description.length > 490) {
        concept.description = concept.description.slice(0, 487) + "...";
      }

      console.log(`✅ Animal coin concept generated:`);
      console.log(`   Name: ${concept.name}`);
      console.log(`   Symbol: $${concept.symbol}`);
      console.log(`   Animal: ${concept.animalType}`);
      console.log(`   Description (${concept.description.length} chars)`);

      return concept;

    } catch (err) {
      const isOverloaded = err.status === 529 || err.message?.includes("overloaded");
      const isRateLimit = err.status === 429;

      if ((isOverloaded || isRateLimit) && attempt < retries) {
        const waitSecs = attempt * 15; // 15s, 30s, 45s
        console.log(`   ⚠️  Claude overloaded (attempt ${attempt}/${retries}), retrying in ${waitSecs}s...`);
        await sleep(waitSecs * 1000);
        continue;
      }
      throw err;
    }
  }
}
