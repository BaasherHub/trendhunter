import axios from "axios";

/**
 * Fetches trending topics — tries multiple sources with fallbacks
 */
export async function getTrendingTopics(geo = "US") {

  // Source 1: Google Trends RSS (sometimes blocks servers)
  try {
    const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "application/rss+xml, application/xml, text/xml, */*",
      },
      timeout: 12000,
    });

    const xml = response.data;
    const matches = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)];

    if (matches.length > 1) {
      const topics = matches.slice(1, 11).map((m) => m[1].trim()).filter(Boolean);
      console.log(`✅ Google Trends: ${topics.slice(0, 3).join(", ")}`);
      return topics;
    }

    // Try plain title tags
    const plain = [...xml.matchAll(/<title>(.*?)<\/title>/g)];
    if (plain.length > 1) {
      const topics = plain.slice(1, 11).map((m) => m[1].trim()).filter(Boolean);
      console.log(`✅ Google Trends (plain): ${topics.slice(0, 3).join(", ")}`);
      return topics;
    }
  } catch (err) {
    console.log(`⚠️  Google Trends failed: ${err.message}`);
  }

  // Source 2: Reddit r/popular titles as trend proxy (public JSON, no auth)
  try {
    const response = await axios.get("https://www.reddit.com/r/popular.json?limit=10", {
      headers: { "User-Agent": "TrendHunterBot/1.0" },
      timeout: 10000,
    });
    const posts = response.data?.data?.children || [];
    const topics = posts
      .map((p) => p.data?.title)
      .filter(Boolean)
      .slice(0, 10);

    if (topics.length > 0) {
      console.log(`✅ Reddit trending: ${topics.slice(0, 3).join(", ").slice(0, 80)}`);
      return topics;
    }
  } catch (err) {
    console.log(`⚠️  Reddit fallback failed: ${err.message}`);
  }

  // Final fallback: crypto-themed evergreen topics
  console.log(`⚠️  Using built-in fallback topics`);
  return [
    "AI revolution", "Moon mission", "Crypto bull run", "Diamond hands",
    "Pepe comeback", "Solana surge", "Meme season", "Robot uprising",
    "Space race", "Internet takeover",
  ];
}

/**
 * Picks the best topic — skips tragic/sensitive news
 */
export function pickBestTopic(topics) {
  const skipWords = [
    "death", "died", "killed", "shooting", "murder", "attack",
    "crash", "disaster", "war", "tragedy", "funeral", "obituary",
    "earthquake", "hurricane", "bombing", "riot", "arrested",
  ];

  const filtered = topics.filter(
    (t) => !skipWords.some((bad) => t.toLowerCase().includes(bad))
  );

  const best = filtered[0] || topics[0] || "Crypto Season";
  console.log(`   🎯 Selected trend: "${best}"`);
  return best;
}
