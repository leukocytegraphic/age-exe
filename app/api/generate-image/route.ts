import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, age } = await req.json();

    const hfKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfKey || hfKey === "your_hf_key_here") {
      return NextResponse.json({ error: "No HuggingFace key" }, { status: 500 });
    }

    const fullPrompt = `${prompt}. Full body portrait head to toe, age ${age} years old, hyper-realistic photography, natural lighting, sharp details, standing pose showing full body. No cartoon, no anime, no illustration.`;

    // Try with a timeout — HF free tier can be slow
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch(
      "https://router.huggingface.co/hf-inference/models/black-forest-labs/FLUX.1-schnell",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${hfKey}`,
          "Content-Type": "application/json",
          "x-wait-for-model": "true",
        },
        body: JSON.stringify({
          inputs: fullPrompt,
          parameters: { num_inference_steps: 4, width: 512, height: 768 }
        }),
        signal: controller.signal,
      }
    );

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text();
      console.error("HF error:", response.status, errText.slice(0, 200));
      return NextResponse.json({ error: `HF ${response.status}` }, { status: 500 });
    }

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = `data:image/png;base64,${buffer.toString("base64")}`;
    return NextResponse.json({ imageBase64: base64 });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("Image gen error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
