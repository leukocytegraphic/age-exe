// Scrapes public X profile data via Nitter (no API key needed)
// Nitter is an open-source X/Twitter frontend that doesn't require auth

export interface XProfileData {
  display_name: string | null;
  bio: string | null;
  join_date: string | null;
  join_year: number | null;
  followers: string | null;
  following: string | null;
  tweet_count: string | null;
  recent_tweets: string[];
  pinned_tweet: string | null;
  avatar_url: string | null;
  verified: boolean;
  account_type: string | null;
}

// Multiple nitter instances for fallback
const NITTER_INSTANCES = [
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
  "https://nitter.woodland.cafe",
  "https://nitter.1d4.us",
];

export async function scrapeXProfile(username: string): Promise<XProfileData> {
  const handle = username.replace("@", "").trim();
  
  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `${instance}/${handle}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; bot)",
          "Accept": "text/html",
        },
        signal: AbortSignal.timeout(8000),
      });

      if (!res.ok) continue;
      const html = await res.text();

      // Parse with regex — no DOM parser needed server-side
      const profile = parseNitterHTML(html, instance);
      if (profile.display_name) return profile; // success
    } catch {
      continue; // try next instance
    }
  }

  // Fallback: return empty profile (analysis will proceed without X data)
  return emptyProfile();
}

function parseNitterHTML(html: string, instance: string): XProfileData {
  const get = (pattern: RegExp) => {
    const m = html.match(pattern);
    return m ? m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim() : null;
  };

  // Display name
  const display_name = get(/<title>([^(]+)\s*\(/) ||
    get(/class="profile-card-fullname"[^>]*>([^<]+)</) || null;

  // Bio
  const bio = get(/class="profile-bio"[^>]*>\s*<p[^>]*>([\s\S]*?)<\/p>/)
    ?.replace(/<[^>]+>/g, "").trim() || null;

  // Stats
  const followers = get(/Followers<\/span>\s*<span[^>]*>([\d,KM.]+)/) ||
    get(/followers"[^>]*>([\d,KM.]+)/) || null;

  const following = get(/Following<\/span>\s*<span[^>]*>([\d,KM.]+)/) ||
    get(/following"[^>]*>([\d,KM.]+)/) || null;

  const tweet_count = get(/Tweets<\/span>\s*<span[^>]*>([\d,KM.]+)/) ||
    get(/tweets"[^>]*>([\d,KM.]+)/) || null;

  // Join date
  const join_date = get(/Joined\s*<\/span>\s*<span[^>]*>([^<]+)</) ||
    get(/class="profile-joindate"[^>]*>\s*<span[^>]*title="([^"]+)"/) || null;

  const join_year = join_date
    ? parseInt(join_date.match(/\d{4}/)?.[0] || "0") || null
    : null;

  // Avatar
  const avatar_raw = get(/class="profile-card-avatar"[^>]*href="([^"]+)"/) ||
    get(/profile-card-avatar.*?src="([^"]+)"/) || null;
  const avatar_url = avatar_raw
    ? avatar_raw.startsWith("http") ? avatar_raw : `${instance}${avatar_raw}`
    : null;

  // Recent tweets — grab up to 5
  const tweetMatches = [...html.matchAll(/class="tweet-content[^"]*"[^>]*>([\s\S]*?)<\/div>/g)];
  const recent_tweets = tweetMatches
    .slice(0, 5)
    .map(m => m[1].replace(/<[^>]+>/g, "").trim())
    .filter(t => t.length > 5);

  // Pinned tweet
  const pinned_tweet = get(/class="pinned"[\s\S]*?tweet-content[^>]*>([\s\S]*?)<\/div>/)
    ?.replace(/<[^>]+>/g, "").trim() || null;

  // Guess account type from bio + tweet content
  const allText = `${bio || ""} ${recent_tweets.join(" ")}`.toLowerCase();
  const account_type = allText.match(/\b(ceo|founder|cto|developer|engineer|dev)\b/) ? "Tech/Professional"
    : allText.match(/\b(artist|designer|creative|photographer)\b/) ? "Creative"
    : allText.match(/\b(news|journalist|reporter|media)\b/) ? "Media"
    : allText.match(/\b(crypto|nft|web3|defi|blockchain)\b/) ? "Crypto"
    : allText.match(/\b(gamer|gaming|streamer|twitch)\b/) ? "Gaming"
    : "Personal";

  const verified = html.includes("icon-ok verified") || html.includes("verified-icon");

  return {
    display_name,
    bio,
    join_date,
    join_year,
    followers,
    following,
    tweet_count,
    recent_tweets,
    pinned_tweet,
    avatar_url,
    verified,
    account_type,
  };
}

function emptyProfile(): XProfileData {
  return {
    display_name: null,
    bio: null,
    join_date: null,
    join_year: null,
    followers: null,
    following: null,
    tweet_count: null,
    recent_tweets: [],
    pinned_tweet: null,
    avatar_url: null,
    verified: false,
    account_type: null,
  };
}
