import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * Animal-focused trending topics — searches for viral animal moments,
 * cute pets, wildlife news, and animal memes going viral
 */
export async function getTrendingTopics() {

  // Source 1: Apify Twitter — search for trending animal content
  if (process.env.APIFY_API_KEY) {
    try {
      console.log(`   Searching Twitter for trending animal content...`);
      const runRes = await axios.post(
        `https://api.apify.com/v2/acts/apidojo~twitter-scraper-lite/run-sync-get-dataset-items?token=${process.env.APIFY_API_KEY}&timeout=60`,
        {
          searchTerms: ["viral animal", "cute animal meme", "animal of the day"],
          maxTweets: 20,
          scrapeTrends: false,
        },
        { timeout: 90000 }
      );
      const items = runRes.data;
      if (Array.isArray(items) && items.length > 0) {
        const topics = items.map((i) => i.text || i.title).filter(Boolean).slice(0, 10);
        if (topics.length > 0) {
          console.log(`✅ Apify animal trends found`);
          return topics;
        }
      }
    } catch (err) {
      console.log(`⚠️  Apify failed: ${err.message}`);
    }
  }

  // Source 2: GNews — filter for animal stories
  if (process.env.GNEWS_API_KEY) {
    try {
      const res = await axios.get("https://gnews.io/api/v4/search", {
        params: {
          token: process.env.GNEWS_API_KEY,
          q: "viral animal OR cute pet OR animal rescue OR wildlife",
          lang: "en",
          max: 10,
        },
        timeout: 10000,
      });
      const topics = (res.data?.articles || []).map((a) => a.title).filter(Boolean);
      if (topics.length > 0) {
        console.log(`✅ GNews animal stories: ${topics[0]?.slice(0, 60)}`);
        return topics;
      }
    } catch (err) {
      console.log(`⚠️  GNews failed: ${err.message}`);
    }
  }

  // Source 3: Claude web search for viral animal content
  try {
    console.log(`   Asking Claude to find viral animal content...`);
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Search for viral animal memes, cute pets going viral, funny animal videos, or interesting wildlife news trending on social media on ${today}. 
        
Return ONLY a JSON array of 8 short animal-related topic strings (under 60 chars each). Focus on specific animals, breeds, or viral moments. No explanation, no markdown.
Example: ["Golden retriever saves drowning cat", "Baby capybara goes viral", "Penguin steals fish"]`
      }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (textBlock) {
      const match = textBlock.text.match(/\[.*?\]/s);
      if (match) {
        const topics = JSON.parse(match[0]);
        if (Array.isArray(topics) && topics.length > 0) {
          console.log(`✅ Claude found viral animal content: ${topics[0]?.slice(0, 60)}`);
          return topics;
        }
      }
    }
  } catch (err) {
    console.log(`⚠️  Claude web search failed: ${err.message}`);
  }

  // Final fallback — rotating animal themes with strong meme potential
  console.log(`⚠️  Using animal fallback topics`);
  const animalFallbacks = [
    "Capybara takeover",
    "Golden Retriever chaos",
    "Cat vs Dog internet war",
    "Baby elephant goes viral",
    "Penguin steals spotlight",
    "Shiba Inu meme revival",
    "Raccoon breaks the internet",
    "Otter holding hands",
    "Corgi army rising",
    "Axolotl appreciation day",
    "Goat screaming contest",
    "Duck army marching",
    "Hamster wheel record",
    "Panda being dramatic",
  ];
  const seed = new Date().getDay() + new Date().getDate();
  return [...animalFallbacks.slice(seed % animalFallbacks.length), ...animalFallbacks.slice(0, seed % animalFallbacks.length)];
}

export function pickBestTopic(topics) {
  const skipWords = [
    "death", "died", "killed", "attack", "crash", "disaster",
    "tragedy", "injured", "victims", "abuse", "poaching",
  ];
  const filtered = topics.filter(
    (t) => !skipWords.some((bad) => t.toLowerCase().includes(bad))
  );
  const best = filtered[0] || topics[0] || "Capybara Season";
  console.log(`   🎯 Selected trend: "${best.slice(0, 80)}"`);
  return best;
}
