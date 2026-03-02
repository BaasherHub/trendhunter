import axios from "axios";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function getTrendingTopics() {

  // Source 1: Apify Twitter Trends Scraper (pay per run, ~$0.05/day, real Twitter trends)
  if (process.env.APIFY_API_KEY) {
    try {
      console.log(`   Fetching Twitter trends via Apify...`);
      // Run the Twitter Trends actor
      const runRes = await axios.post(
        `https://api.apify.com/v2/acts/apidojo~twitter-scraper-lite/run-sync-get-dataset-items?token=${process.env.APIFY_API_KEY}&timeout=60`,
        {
          twitterHandles: [],
          searchTerms: [],
          maxTweets: 1,
          scrapeTrends: true,
          country: "US",
        },
        { timeout: 90000 }
      );

      const items = runRes.data;
      if (Array.isArray(items) && items.length > 0) {
        // Extract trend names from results
        const topics = items
          .map((item) => item.name || item.trend || item.title || item.text)
          .filter(Boolean)
          .slice(0, 10);

        if (topics.length > 0) {
          console.log(`✅ Apify Twitter trends: ${topics[0]}`);
          return topics;
        }
      }
    } catch (err) {
      console.log(`⚠️  Apify failed: ${err.message}`);
    }
  }

  // Source 2: GNews API (free, 100 req/day)
  if (process.env.GNEWS_API_KEY) {
    try {
      const res = await axios.get("https://gnews.io/api/v4/top-headlines", {
        params: { token: process.env.GNEWS_API_KEY, lang: "en", country: "us", max: 10 },
        timeout: 10000,
      });
      const topics = (res.data?.articles || []).map((a) => a.title).filter(Boolean);
      if (topics.length > 0) {
        console.log(`✅ GNews: ${topics[0]?.slice(0, 60)}`);
        return topics;
      }
    } catch (err) {
      console.log(`⚠️  GNews failed: ${err.message}`);
    }
  }

  // Source 3: NewsData.io (free, 200 req/day)
  if (process.env.NEWSDATA_API_KEY) {
    try {
      const res = await axios.get("https://newsdata.io/api/1/news", {
        params: { apikey: process.env.NEWSDATA_API_KEY, country: "us", language: "english", size: 10 },
        timeout: 10000,
      });
      const topics = (res.data?.results || []).map((a) => a.title).filter(Boolean);
      if (topics.length > 0) {
        console.log(`✅ NewsData: ${topics[0]?.slice(0, 60)}`);
        return topics;
      }
    } catch (err) {
      console.log(`⚠️  NewsData failed: ${err.message}`);
    }
  }

  // Source 4: Claude web search (uses your existing API key)
  try {
    console.log(`   Asking Claude to search for today's trends...`);
    const today = new Date().toLocaleDateString("en-US", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{
        role: "user",
        content: `Search for what is trending on Twitter/X and in the news right now on ${today}. Return ONLY a JSON array of 8 short trending topic strings (under 60 chars each), no explanation, no markdown. Example: ["Topic 1", "Topic 2"]`
      }],
    });
    const textBlock = message.content.find((b) => b.type === "text");
    if (textBlock) {
      const match = textBlock.text.match(/\[.*?\]/s);
      if (match) {
        const topics = JSON.parse(match[0]);
        if (Array.isArray(topics) && topics.length > 0) {
          console.log(`✅ Claude web search: ${topics[0]?.slice(0, 60)}`);
          return topics;
        }
      }
    }
  } catch (err) {
    console.log(`⚠️  Claude web search failed: ${err.message}`);
  }

  // Final fallback — rotate by day so it's never the same
  console.log(`⚠️  All sources failed — using rotating fallback topics`);
  const fallbacks = [
    "AI revolution", "Crypto bull run", "Moon mission", "Diamond hands",
    "Solana surge", "Meme season", "Robot uprising", "Space race",
    "Tech bubble", "Internet culture",
  ];
  const dayIndex = new Date().getDay() + new Date().getDate();
  return [...fallbacks.slice(dayIndex % fallbacks.length), ...fallbacks.slice(0, dayIndex % fallbacks.length)];
}

export function pickBestTopic(topics) {
  const skipWords = [
    "death", "died", "killed", "shooting", "murder", "attack", "crash",
    "disaster", "war", "tragedy", "funeral", "obituary", "earthquake",
    "hurricane", "bombing", "arrest", "injured", "victims", "missing",
  ];
  const filtered = topics.filter(
    (t) => !skipWords.some((bad) => t.toLowerCase().includes(bad))
  );
  const best = filtered[0] || topics[0] || "Crypto Season";
  console.log(`   🎯 Selected trend: "${best.slice(0, 80)}"`);
  return best;
}
