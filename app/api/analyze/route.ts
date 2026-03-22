import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { username, pfpBase64, mediaType, vibe, tweetTopic, xProfile } = await req.json();

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "No Gemini API key configured" }, { status: 500 });

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

    const prompt = `You are the X Oracle. Analyze this profile picture for @${username}.

SELF-REPORTED: Vibe: "${vibe || "not given"}" | Tweets about: "${tweetTopic || "not given"}"

LIVE X DATA: ${xCtx}

Look at the image carefully. Note everything visible: lighting, background, expression, colors, filters, pose, outfit, art style, real face vs cartoon vs meme vs anime.

ROAST: Must reference something SPECIFIC you can SEE in this image. No generic roasts.
Good: "Rainbow glasses on an ape pfp — bold life choice.", "Pixel art pfp in 2024, screaming nostalgia.", "Anime villain arc but bio says God first."
Bad: "Posts at 2am", "chronically online" — too generic, banned.

IMPORTANT: Your response must be valid JSON. Do NOT use newlines or line breaks inside any string values. Keep all strings on one line.

Return ONLY this JSON object, nothing else:
{"predicted_age": <integer 16-68>,"confidence": "Low|Medium|High","age_era": "<5 words max>","roast": "<specific to this image, 8-14 words>","pfp_energy": "<3-4 words>","x_diagnosis": "<8 words max>","secret_trait": "<7 words max>","aged_portrait_prompt": "<one line description of this person aged to predicted_age, full body>"}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [
            { inline_data: { mime_type: mediaType, data: pfpBase64 } },
            { text: prompt }
          ]}],
          generationConfig: { temperature: 0.9, maxOutputTokens: 1024 }
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

    // Extract JSON object from response
    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}");
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("No JSON braces found:", text.slice(0, 300));
      return NextResponse.json({ error: "No JSON in response" }, { status: 500 });
    }

    let jsonStr = text.slice(jsonStart, jsonEnd + 1);

    // Fix unescaped newlines inside JSON strings — the main cause of parse failures
    // Replace actual newline characters inside string values with a space
    jsonStr = jsonStr.replace(/"([^"]*)"/g, (_match: string, inner: string) => {
      const fixed = inner.replace(/\n/g, " ").replace(/\r/g, "").replace(/\t/g, " ");
      return `"${fixed}"`;
    });

    const parsed = JSON.parse(jsonStr);
    const age = parseInt(parsed.predicted_age);
    parsed.predicted_age = (!isNaN(age) && age >= 16 && age <= 68) ? age : 26;

    return NextResponse.json({ result: parsed });
  } catch (err) {
    console.error("Analyze route error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
