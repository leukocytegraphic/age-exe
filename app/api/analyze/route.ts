import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { username, pfpBase64, mediaType, vibe, tweetTopic, xProfile } = await req.json();

    // Ensure your Vercel Environment Variable is named GEMINI_API_KEY
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

Return ONLY a JSON object with these exact keys:
{
  "predicted_age": number (16-68),
  "confidence": "Low" | "Medium" | "High",
  "age_era": string (5 words max),
  "roast": string (specific to image, 8-14 words),
  "pfp_energy": string (3-4 words),
  "x_diagnosis": string (8 words max),
  "secret_trait": string (7 words max),
  "aged_portrait_prompt": string (one line description of this person aged to predicted_age, full body)
}`;

    // Note: Changed to gemini-1.5-flash as 2.5 is not a standard release yet
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ 
            parts: [
              { inline_data: { mime_type: mediaType || "image/png", data: pfpBase64 } },
              { text: prompt }
            ]
          }],
          generationConfig: { 
            temperature: 0.8, 
            maxOutputTokens: 1024,
            // Forces Gemini to output valid JSON structure
            response_mime_type: "application/json" 
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

    // Robust JSON Extraction
    try {
      const jsonStart = text.indexOf("{");
      const jsonEnd = text.lastIndexOf("}");
      
      if (jsonStart === -1 || jsonEnd === -1) {
        throw new Error("JSON markers not found in AI response");
      }

      let jsonStr = text.slice(jsonStart, jsonEnd + 1);
      
      // Sanitizing control characters that break JSON.parse
      jsonStr = jsonStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");

      const parsed = JSON.parse(jsonStr);
      
      // Normalize predicted_age
      const age = parseInt(parsed.predicted_age);
      parsed.predicted_age = (!isNaN(age) && age >= 16 && age <= 68) ? age : 26;

      return NextResponse.json({ result: parsed });
    } catch (parseError) {
      console.error("Failed to parse JSON string:", text);
      return NextResponse.json({ error: "AI output was not valid JSON", raw: text }, { status: 500 });
    }

  } catch (err) {
    console.error("Analyze route error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}