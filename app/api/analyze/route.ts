import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Ensure your environment variable in Vercel is named GEMINI_API_KEY
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function POST(req: Request) {
  try {
    const { username, pfpBase64, mediaType, vibe, tweetTopic, xProfile } = await req.json();

    if (!pfpBase64) {
      return NextResponse.json({ error: "No image provided" }, { status: 400 });
    }

    // FIX: Using 'gemini-1.5-flash' is the standard. 
    // If you get a 404, the SDK might be looking for the 'models/' prefix internally.
    const model = genAI.getGenerativeModel({ 
      model: "gemini-1.5-flash",
    });

    const prompt = `
      You are the X Oracle. Analyze this user based on their PFP and X data.
      User: @${username}
      Vibe: ${vibe}
      Topic: ${tweetTopic}
      Bio: ${xProfile?.description || "Unknown"}
      
      Return a JSON object with:
      {
        "predicted_age": number,
        "confidence": "High" | "Medium" | "Low",
        "age_era": "string",
        "roast": "string",
        "pfp_energy": "string",
        "x_diagnosis": "string",
        "secret_trait": "string",
        "aged_portrait_prompt": "detailed prompt for a full-body AI portrait of this person looking 50 years older"
      }
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: pfpBase64,
          mimeType: mediaType,
        },
      },
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Clean the response in case the model wrapped it in markdown blocks
    const cleanJson = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanJson);

    return NextResponse.json({ result: parsed });

  } catch (error: any) {
    console.error("Gemini API error:", error.status, error.message);
    
    // If Google still throws a 404, we return a helpful error to your terminal
    return NextResponse.json({ 
      error: "Oracle Connection Failed", 
      details: error.message 
    }, { status: error.status || 500 });
  }
}