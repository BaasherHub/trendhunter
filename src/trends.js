import axios from "axios";

/**
 * Fetches trending topics from Google Trends daily RSS feed.
 * Pure HTTP — no external package needed.
 */
export async function getTrendingTopics(geo = "US") {
  try {
    const url = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=${geo}`;
    const response = await axios.get(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.5",
      },
      timeout: 15000,
    });

    const xml = response.data;

    // Parse all CDATA titles from the RSS feed
    const titleMatches = [...xml.matchAll(/<title><!\[CDATA\[(.*?)\]\]><\/title>/g)];

    if (!titleMatches || titleMatches.length === 0) {
      // Try alternate format without CDATA
      const plainTitles = [...xml.matchAll(/<title>(.*?)<\/title>/g)];
      if (plainTitles.length > 1) {
        const topics = plainTitles
          .slice(1, 11)
          .map((m) => m[1].trim())
          .filter((t) => t.length > 0);
        console.log(`✅ Found ${topics.length} trending topics (plain format)`);
        return topics;
      }
      throw new Error("No trending topics found in RSS feed");
    }

    // Skip index 0 — it's the feed title itself
    const topics = titleMatches
      .slice(1, 11)
      .map((m) => m[1].trim())
      .filter((t) => t.length > 0);

    console.log(`✅ Found ${topics.length} trending topics`);
    console.log(`   Top 5: ${topics.slice(0, 5).join(", ")}`);

    return topics;
  } catch (error) {
    console.error(`❌ Google Trends fetch failed: ${error.message}`);
    console.log(`   Using fallback trending topics...`);

    // Fallback: culturally relevant evergreen meme coin themes
    const fallbacks = [
      "AI takeover", "Moon mission", "Diamond hands", "Crypto bull run",
      "Pepe revival", "Elon tweet", "Solana surge", "Meme season",
    ];
    return fallbacks;
  }
}

/**
 * Picks the best topic — filters out sensitive/tragic news
 */
export function pickBestTopic(topics) {
  const skipWords = [
    "death", "died", "killed", "shooting", "murder", "attack",
    "crash", "disaster", "war", "tragedy", "funeral", "obituary",
    "earthquake", "hurricane", "bombing", "riot",
  ];

  const filtered = topics.filter(
    (t) => !skipWords.some((bad) => t.toLowerCase().includes(bad))
  );

  const best = filtered[0] || topics[0] || "Crypto Season";
  console.log(`   🎯 Selected trend: "${best}"`);
  return best;
}
