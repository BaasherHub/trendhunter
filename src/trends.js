import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

/**
 * TREND SOURCES (priority order):
 * 1. Grok API (xAI) — real-time Twitter + Reddit access
 * 2. Apify Twitter scraper
 * 3. GNews API
 * 4. Claude web search
 * 5. Rotating animal fallbacks
 */
export async function getTrendingTopics() {

  // ─── Source 1: Grok API ────────────────────────────────────────────────────
  // Grok has native access to all X/Twitter data + Reddit trends in real-time
  // Get key from: https://console.x.ai → API Keys
  if (process.env.GROK_API_KEY) {
    try {
      console.log(`   🤖 Asking Grok for trending animal content on Twitter/Reddit...`);
      const today = new Date().toLocaleDateString("en-US", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
      });
      const res = await axios.post(
        "https://api.x.ai/v1/chat/completions",
        {
          model: "grok-3",
          messages: [
            {
              role: "system",
              content: "You have real-time access to X (Twitter) and Reddit. You specialize in identifying viral animal content and meme trends.",
            },
            {
              role: "user",
              content: `Today is ${today}. Search X (Twitter) and Reddit RIGHT NOW for the most viral animal content, trending animal memes, cute pets going viral, funny wildlife videos, or any animal-related topics exploding on social media today.

Return ONLY a JSON array of 8 short animal topic strings (under 60 chars each). Be specific — name the actual animal, breed, or viral moment you found. No explanation, no markdown, no code blocks.

Example format: ["Capybara crashes zoo livestream", "Golden retriever learns piano", "Baby panda escapes enclosure"]`,
            },
          ],
          temperature: 0.7,
          max_tokens: 300,
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.GROK_API_KEY}`,
            "Content-Type": "application/json",
          },
          timeout: 30000,
        }
      );

      const text = res.data?.choices?.[0]?.message?.content || "";
      const match = text.match(/\[.*?\]/s);
      if (match) {
        const topics = JSON.parse(match[0]);
        if (Array.isArray(topics) && topics.length > 0) {
          console.log(`✅ Grok found trending content: "${topics[0]?.slice(0, 60)}"`);
          return topics;
        }
      }
      console.log(`⚠️  Grok returned unexpected format: ${text.slice(0, 100)}`);
    } catch (err) {
      console.log(`⚠️  Grok API failed: ${err.response?.data?.error?.message || err.message}`);
    }
  } else {
    console.log(`   ℹ️  GROK_API_KEY not set — skipping Grok. Get one at console.x.ai`);
  }

  // ─── Source 2: Apify Twitter ───────────────────────────────────────────────
  if (process.env.APIFY_API_KEY) {
    try {
      console.log(`   Searching Twitter for trending animal content via Apify...`);
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

  // ─── Source 3: GNews ──────────────────────────────────────────────────────
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

  // ─── Source 4: Claude web search ─────────────────────────────────────────
  try {
    console.log(`   Asking Claude to find viral animal content...`);
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 600,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Search for viral animal memes, cute pets going viral, funny animal videos, or interesting wildlife news trending on social media on ${today}. 
        
Return ONLY a JSON array of 8 short animal-related topic strings (under 60 chars each). Focus on specific animals, breeds, or viral moments. No explanation, no markdown.
Example: ["Golden retriever saves drowning cat", "Baby capybara goes viral", "Penguin steals fish"]`,
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

  // ─── Source 5: Rotating animal fallbacks ─────────────────────────────────
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
