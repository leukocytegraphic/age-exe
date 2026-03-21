import { NextRequest, NextResponse } from "next/server";
import { scrapeXProfile } from "@/lib/x-scraper";

export async function POST(req: NextRequest) {
  try {
    const { username } = await req.json();
    if (!username) return NextResponse.json({ error: "username required" }, { status: 400 });

    const profile = await scrapeXProfile(username);
    return NextResponse.json({ profile });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
