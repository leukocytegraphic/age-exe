import { NextRequest, NextResponse } from "next/server";
import { XProfileData } from "@/lib/x-scraper";

export async function POST(req: NextRequest) {
  try {
    const { username, pfpBase64, mediaType, vibe, tweetTopic, xProfile } =
      await req.json() as {
        username: string;
        pfpBase64: string;
        mediaType: string;
        vibe: string;
        tweetTopic: string;
        xProfile: XProfileData | null;
      };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "No Anthropic key" }, { status: 500 });

    // Build rich X context from scraped data
    let xCtx = "No X profile data available.";
    if (xProfile?.display_name) {
      const tweets = xProfile.recent_tweets?.slice(0, 3).join(" | ") || "none";
      const pinned = xProfile.pinned_tweet ? `Pinned: "${xProfile.pinned_tweet}"` : "";
      xCtx = [
        `Name: ${xProfile.display_name}`,
        `Bio: ${xProfile.bio || "none"}`,
        `Joined: ${xProfile.join_date || "unknown"}`,
        `Followers: ${xProfile.followers || "?"} | Following: ${xProfile.following || "?"}`,
        `Tweets: ${xProfile.tweet_count || "?"}`,
        `Account type: ${xProfile.account_type || "unknown"}`,
        `Recent tweets: ${tweets}`,
        pinned,
      ].filter(Boolean).join("\n");
    }

    const prompt = `You are the X Oracle. Analyze this profile picture for @${username}.

SELF-REPORTED:
- Vibe: "${vibe || "not given"}"
- Tweets about: "${tweetTopic || "not given"}"

LIVE X DATA (scraped in real-time):
${xCtx}

STEP 1: Look carefully at the image — lighting, background, expression, colors, filters, pose, outfit, art style, image quality, real face vs cartoon vs meme vs abstract, anything visible.

STEP 2: Cross-reference visual signals with the live X data above for a sharper age read.

STEP 3: Build a SPECIFIC character profile. The more the live X data, the sharper your read.

ROAST RULE: Must reference something SPECIFIC and VISIBLE in this image. Generic roasts are banned.
Good: "Ring light on a blank wall — the duality of man.", "Anime villain arc but make it LinkedIn."
Banned: "Definitely posts at 2am." — could apply to anyone.

AGED PORTRAIT PROMPT: Describe this EXACT person aged to predicted_age. Include:
- Their specific facial features (hair color/style, skin tone, eye shape, face shape)
- How those features change at that age (grey hair, wrinkles, weight changes, etc.)
- Full body — what they'd be wearing at that age
- Where they'd be standing / background scene
Write as a detailed image generation prompt.

Return ONLY raw JSON, no markdown:
{
  "predicted_age": <integer 16-68>,
  "confidence": "Low|Medium|High",
  "age_era": "<5 words max>",
  "roast": "<references something VISIBLE in this image, max 12 words>",
  "pfp_energy": "<3-4 words>",
  "x_diagnosis": "<8 words max, based on live X data if available>",
  "secret_trait": "<7 words max>",
  "aged_portrait_prompt": "<detailed full body image gen prompt>"
}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-5",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: pfpBase64 } },
            { type: "text", text: prompt },
          ],
        }],
      }),
    });

    const data = await res.json();
    const text = data.content?.map((b: { type: string; text?: string }) => b.text || "").join("") || "";
    const clean = text.replace(/```[\s\S]*?```|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const age = parseInt(parsed.predicted_age);
    parsed.predicted_age = (!isNaN(age) && age >= 16 && age <= 68) ? age : 26;

    return NextResponse.json({ result: parsed });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
