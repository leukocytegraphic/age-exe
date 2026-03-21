// Free image generation via Hugging Face Inference API
// Uses FLUX.1-schnell — fast, free, high quality
// Get your free key at: https://huggingface.co/settings/tokens

const HF_API_URL = "https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-schnell";

export interface ImageGenResult {
  imageBase64: string | null;
  error: string | null;
}

export async function generateAgedPortrait(
  prompt: string,
  age: number
): Promise<ImageGenResult> {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey || apiKey === "your_hf_key_here") {
    return { imageBase64: null, error: "No HuggingFace API key configured" };
  }

  const fullPrompt = `Full body portrait photograph, head to toe, ${prompt}. 
    Age ${age} years old. Realistic photography style, natural lighting, 
    detailed face showing age ${age}, appropriate clothing for age, 
    standing pose showing full body, high quality, photorealistic.
    --no cartoon, --no anime, --no illustration`;

  try {
    const res = await fetch(HF_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: fullPrompt,
        parameters: {
          num_inference_steps: 4, // schnell is fast with 4 steps
          width: 512,
          height: 768, // portrait ratio for full body
          guidance_scale: 0,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const err = await res.text();
      // Model loading - common on free tier, just means retry
      if (err.includes("loading")) {
        return { imageBase64: null, error: "model_loading" };
      }
      return { imageBase64: null, error: `HF error: ${res.status}` };
    }

    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = blob.type || "image/jpeg";

    return { imageBase64: `data:${mimeType};base64,${base64}`, error: null };
  } catch (err) {
    return { imageBase64: null, error: String(err) };
  }
}
