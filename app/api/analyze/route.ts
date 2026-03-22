import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { username, pfpBase64, mediaType, vibe, tweetTopic, xProfile } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "No Gemini API key configured" }, { status: 500 });

    // Build X context
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
1. Look hard at the image. Note EVERYTHING visible: lighting, background, expression, colors, filters, pose, outfit, art style, image quality, real face vs cartoon vs meme vs anime vs abstract, any text visible.
2. Cross-reference with the live X data for a sharper personality read.
3. Predict their real age based on all signals combined.

ROAST RULES — MOST IMPORTANT FIELD:
- Must reference something SPECIFIC and VISIBLE in this exact image
- If real face: comment on expression, background, lighting, outfit, filter
- If anime/cartoon: roast the choice of using that PFP
- If meme PFP: roast what that says about them
- BANNED: generic roasts like "posts at 2am", "chronically online" — too generic
- GOOD examples: "Rainbow glasses on an ape — bold choice for a professional bio.", "Pixel art PFP in 2024 screaming nostalgia loudly.", "Anime villain arc but the bio says God first.", "That filter is carrying this whole aesthetic."
- Funny, specific, a little mean but not cruel. 8-14 words MAX.

AGED PORTRAIT: Describe this exact person aged to predicted_age, full body head to toe. Include specific physical features visible, how they age, what they wear at that age, where they stand.

Return ONLY raw JSON, zero markdown:
{
  "predicted_age": <integer 16-68, make a REAL prediction based on what you see, NEVER default to 27>,
  "confidence": "Low|Medium|High",
  "age_era": "<5 words max, creative era label specific to this person>",
  "roast": "<MUST reference something VISIBLE in this image, 8-14 words, funny and specific>",
  "pfp_energy": "<3-4 words capturing their unique essence>",
  "x_diagnosis": "<8 words max, specific behavioral diagnosis based on their data>",
  "secret_trait": "<7 words max, uncomfortably accurate observation>",
  "aged_portrait_prompt": "<detailed full body portrait prompt of this exact person at predicted_age>"
}`;

    // Gemini API call with vision
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { inline_data: { mime_type: mediaType, data: pfpBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: {
            temperature: 0.9,
            maxOutputTokens: 1024,
          }
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("Gemini API error:", res.status, errText);
      return NextResponse.json({ error: `Gemini error ${res.status}: ${errText}` }, { status: 500 });
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    if (!text) {
      return NextResponse.json({ error: "Empty response from Gemini" }, { status: 500 });
    }

    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);

    const age = parseInt(parsed.predicted_age);
    parsed.predicted_age = (!isNaN(age) && age >= 16 && age <= 68) ? age : 26;

    return NextResponse.json({ result: parsed });
  } catch (err) {
    console.error("Analyze route error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
