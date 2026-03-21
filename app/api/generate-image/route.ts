import { NextRequest, NextResponse } from "next/server";
import { generateAgedPortrait } from "@/lib/image-gen";

export async function POST(req: NextRequest) {
  try {
    const { prompt, age } = await req.json();
    if (!prompt || !age) return NextResponse.json({ error: "prompt and age required" }, { status: 400 });

    const result = await generateAgedPortrait(prompt, age);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
