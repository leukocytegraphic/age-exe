import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { username, pfpBase64, mediaType, vibe, tweetTopic, xProfile } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "No Anthropic key configured" }, { status: 500 });

    // Build rich X context from scraped data
    let xCtx = "No X profile data available.";
    if (xProfile?.display_name) {
      const tweets = xProfile.recent_tweets?.slice(0, 3).join(" | ") || "none";
      xCtx = [
        `Name: ${xProfile.display_name}`,
        `Bio: ${xProfile.bio || "none"}`,
        `Joined: ${xProfile.join_date || "unknown"}`,
        `Followers: ${xProfile.followers || "?"} | Following: ${xProfile.following || "?"}`,
        `Tweets posted: ${xProfile.tweet_count || "?"}`,
        `Account type: ${xProfile.account_type || "unknown"}`,
        `Recent tweets: ${tweets}`,
        xProfile.pinned_tweet ? `Pinned: "${xProfile.pinned_tweet}"` : "",
      ].filter(Boolean).join("\n");
    }

    const prompt = `You are the X Oracle — a sharp, witty cultural analyst. Analyze this profile picture for @${username}.

SELF-REPORTED INFO:
- Their X vibe: "${vibe || "not given"}"
- They tweet about: "${tweetTopic || "not given"}"

LIVE X ACCOUNT DATA:
${xCtx}

YOUR JOB:
1. Look hard at the image. Note EVERYTHING: lighting, background, expression, colors, filters, pose, outfit, art style, image quality, real face vs cartoon vs meme vs anime vs abstract, any text visible, photo quality.
2. Cross-reference with the live X data for a sharper personality read.
3. Predict their real age based on all signals.

ROAST RULES — MOST IMPORTANT:
- The roast MUST reference something SPECIFIC you can literally SEE in this image
- If you see a real face: comment on their expression, background, lighting, outfit, filter choice
- If you see anime/cartoon: roast the CHOICE of using that as a PFP
- If you see a meme: roast what that says about them
- BANNED roasts: anything generic that could apply to anyone ("posts at 2am", "chronically online", etc.)
- Good roast examples: "Ring light on a blank wall — influencer budget, basement vibes.", "Anime villain arc but bio says Software Engineer.", "Grayscale filter doing heavy lifting for the mystery aesthetic.", "That smile says LinkedIn, those eyes say everything is fine."
- Be funny, specific, a little mean but not cruel. Max 14 words.

AGED PORTRAIT — describe this EXACT person at their predicted age, full body head to toe:
- Their specific features (hair color/style, skin tone, face shape, any distinguishing features)
- How those features would look at that age (grey hair, wrinkles, weight changes, style shift)
- What they'd be wearing at that age and where they'd be standing

Return ONLY raw JSON, zero markdown, zero explanation:
{
  "predicted_age": <integer 16-68, NEVER 0 or 27 as default, make a real prediction>,
  "confidence": "Low|Medium|High",
  "age_era": "<5 words max, creative era label>",
  "roast": "<MUST reference something visible in this specific image, 8-14 words, funny>",
  "pfp_energy": "<3-4 words capturing their essence>",
  "x_diagnosis": "<8 words max, specific behavioral diagnosis>",
  "secret_trait": "<7 words max, something uncomfortably accurate>",
  "aged_portrait_prompt": "<detailed full body portrait prompt of this exact person at predicted_age>"
}`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
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

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic API error:", res.status, errText);
      return NextResponse.json({ error: `Anthropic error ${res.status}: ${errText}` }, { status: 500 });
    }

    const data = await res.json();

    if (data.error) {
      console.error("Anthropic returned error:", data.error);
      return NextResponse.json({ error: data.error.message || "Anthropic error" }, { status: 500 });
    }

    const text = data.content?.map((b: { type: string; text?: string }) => b.text || "").join("") || "";
    if (!text) {
      return NextResponse.json({ error: "Empty response from Claude" }, { status: 500 });
    }

    const clean = text.replace(/```[\s\S]*?```|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const age = parseInt(parsed.predicted_age);
    parsed.predicted_age = (!isNaN(age) && age >= 16 && age <= 68) ? age : 26;

    return NextResponse.json({ result: parsed });
  } catch (err) {
    console.error("Analyze route error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
