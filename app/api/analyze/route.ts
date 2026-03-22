import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("GEMINI_API_KEY missing");
      return NextResponse.json({ error: "Key missing" }, { status: 500 });
    }

    const { username, pfpBase64, mediaType, vibe, tweetTopic, xProfile } = await req.json();

    // Build X context from scraped data
    let xCtx = "No X profile data.";
    if (xProfile?.display_name) {
      const tweets = xProfile.recent_tweets?.slice(0, 3).join(" | ") || "none";
      xCtx = [
        `Name: ${xProfile.display_name}`,
        `Bio: ${xProfile.bio || "none"}`,
        `Joined: ${xProfile.join_date || "unknown"}`,
        `Followers: ${xProfile.followers || "?"} | Following: ${xProfile.following || "?"}`,
        `Tweets: ${xProfile.tweet_count || "?"}`,
        `Type: ${xProfile.account_type || "unknown"}`,
        `Recent: ${tweets}`,
        xProfile.pinned_tweet ? `Pinned: ${xProfile.pinned_tweet}` : "",
      ].filter(Boolean).join(" | ");
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `You are the X Oracle — a savage, witty cultural analyst. Analyze this profile picture for @${username}.

Context: Vibe="${vibe || "unknown"}" | Tweets about="${tweetTopic || "unknown"}" | ${xCtx}

Study the image carefully: face features, skin, hair, expression, outfit, background, lighting, filters, art style (real photo vs anime vs cartoon vs meme vs abstract).

Return ONLY a raw JSON object. No markdown. No explanation. No backticks. Just JSON.

Rules:
- predicted_age: integer between 0 and 100. Make a REAL guess based on what you see. NEVER default to 27.
- roast: must reference something SPECIFIC and VISIBLE in this exact image. Be funny and savage. No generic lines.
- aged_portrait_prompt: describe this EXACT person (same ethnicity, hair, features) aged to predicted_age, full body head to toe, what they wear, where they stand. Hyper-realistic photography style.

{"predicted_age":24,"confidence":"High","age_era":"Neo-Tokyo Edgelord","roast":"Your roast here referencing something specific you see","pfp_energy":"Chaotic Neutral","x_diagnosis":"Specific diagnosis","secret_trait":"Uncomfortably accurate trait","aged_portrait_prompt":"Hyper-realistic full body portrait of this exact person aged to predicted_age..."}`;

    const result = await model.generateContent([
      prompt,
      { inlineData: { data: pfpBase64, mimeType: mediaType || "image/jpeg" } },
    ]);

    const text = result.response.text();
    console.log("Gemini raw response:", text.slice(0, 200));

    const jsonStart = text.indexOf("{");
    const jsonEnd = text.lastIndexOf("}") + 1;
    const cleanJson = text.substring(jsonStart, jsonEnd);
    const parsed = JSON.parse(cleanJson);

    // Ensure age is valid 0-100
    const age = parseInt(parsed.predicted_age);
    parsed.predicted_age = (!isNaN(age) && age >= 0 && age <= 100) ? age : 25;

    return NextResponse.json({ result: parsed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Oracle crash:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
