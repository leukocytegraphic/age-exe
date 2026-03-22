import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { prompt, age } = await req.json();

    const hfKey = process.env.HUGGINGFACE_API_KEY;
    if (!hfKey || hfKey === "your_hf_key_here") {
      return NextResponse.json({ error: "No HuggingFace key" }, { status: 500 });
    }

    const fullPrompt = `${prompt}. Full body portrait, head to toe, age ${age}, hyper-realistic photography, natural lighting, detailed face, standing pose, high quality photorealistic. No cartoon, no anime.`;

    const response = await fetch(
      "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell",
      {
        method: "POST",
        headers: { 
          Authorization: `Bearer ${hfKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ 
          inputs: fullPrompt,
          parameters: { num_inference_steps: 4, width: 512, height: 768 }
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      // Model loading on free tier — tell client to retry
      if (err.includes("loading") || err.includes("503")) {
        return NextResponse.json({ error: "model_loading" }, { status: 503 });
      }
      return NextResponse.json({ error: `HF error: ${response.status}` }, { status: 500 });
    }

    const blob = await response.blob();
    const buffer = Buffer.from(await blob.arrayBuffer());
    const base64 = `data:image/png;base64,${buffer.toString("base64")}`;
    return NextResponse.json({ imageBase64: base64 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
