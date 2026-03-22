import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("❌ ERROR: GEMINI_API_KEY missing");
      return NextResponse.json({ error: "Key missing" }, { status: 500 });
    }

    const { username, pfpBase64, mediaType, vibe, tweetTopic } = await req.json();
    const genAI = new GoogleGenerativeAI(apiKey);

    // FIXED: Updated to the 2026 stable model
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `
      You are the X Oracle. Return ONLY a JSON object for user @${username}. 
      No preamble, no markdown blocks. Just the raw JSON.
      
      {
        "predicted_age": number,
        "confidence": "High" | "Medium" | "Low",
        "age_era": "string",
        "roast": "one savage sentence",
        "pfp_energy": "string",
        "x_diagnosis": "string",
        "secret_trait": "string",
        "aged_portrait_prompt": "A professional hyper-realistic full-body portrait of a 75-year-old version of this person, same ethnicity and features, highly detailed"
      }
    `;

    console.log("📡 Dialing the Oracle (Gemini 2.5)...");
    
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: pfpBase64, mimeType: mediaType || "image/jpeg" } },
    ]);

    const text = result.response.text();
    
    // Pro-grade JSON extraction: finds the first { and last } to avoid crashes
    const jsonStart = text.indexOf('{');
    const jsonEnd = text.lastIndexOf('}') + 1;
    const cleanJson = text.substring(jsonStart, jsonEnd);
    
    const parsed = JSON.parse(cleanJson);
    return NextResponse.json({ result: parsed });

  } catch (error: any) {
    console.error("❌ ORACLE CRASH:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}