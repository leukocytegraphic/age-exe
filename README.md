# AGE.EXE — X Oracle

> Drop your PFP. Face your digital truth.

Predicts your internet age from your X profile picture + live account data. Generates a full-body aged portrait. Roasts you specifically.

---

## Stack

- **Next.js 14** (App Router)
- **Claude claude-opus-4-5** — vision analysis + age prediction
- **Nitter** — free X profile scraping (no API key)
- **Hugging Face FLUX.1-schnell** — free AI full-body image generation

---

## Quick Start (Local)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/age-exe.git
cd age-exe
npm install
```

### 2. Get your free API keys

**Anthropic (required)**
1. Go to https://console.anthropic.com
2. Create account → API Keys → Create Key
3. Free $5 credit included

**Hugging Face (optional but recommended for real aged portraits)**
1. Go to https://huggingface.co/settings/tokens
2. Create account (free) → New Token → Read access
3. Without this key, portraits use canvas effects instead

### 3. Set up environment variables

```bash
cp .env.local.example .env.local
```

Edit `.env.local`:
```
ANTHROPIC_API_KEY=sk-ant-...your key...
HUGGINGFACE_API_KEY=hf_...your key...
```

### 4. Run

```bash
npm run dev
```

Open http://localhost:3000

---

## Deploy to Vercel

### Option A — Vercel CLI (fastest)

```bash
npm install -g vercel
vercel

# Follow prompts, then add env vars:
vercel env add ANTHROPIC_API_KEY
vercel env add HUGGINGFACE_API_KEY

# Deploy to production
vercel --prod
```

### Option B — GitHub + Vercel Dashboard

1. Push to GitHub:
```bash
git init
git add .
git commit -m "initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/age-exe.git
git push -u origin main
```

2. Go to https://vercel.com/new
3. Import your GitHub repo
4. Add environment variables in the Vercel dashboard:
   - `ANTHROPIC_API_KEY` → your Anthropic key
   - `HUGGINGFACE_API_KEY` → your HF key
5. Click Deploy

---

## Push to GitHub (new repo)

```bash
# If you haven't already
git init
git add .
git commit -m "feat: initial AGE.EXE build"
git branch -M main

# Create repo on github.com first, then:
git remote add origin https://github.com/YOUR_USERNAME/age-exe.git
git push -u origin main
```

---

## How It Works

```
User uploads PFP + enters username
         ↓
/api/x-agent  ← scrapes live X profile via Nitter
         ↓
/api/analyze  ← Claude vision reads PFP + X data → age prediction + roast
         ↓
/api/generate-image ← HuggingFace FLUX generates full-body aged portrait
         ↓
Result card with aged portrait + stats + roast
         ↓
Download as PNG
```

### X Scraping
Uses public Nitter instances (no API key). Reads: display name, bio, join date, follower count, following count, tweet count, recent tweets, pinned tweet. Falls back gracefully if all instances are down.

### Image Generation
Uses FLUX.1-schnell on Hugging Face free tier. If HF key isn't set or model is loading, falls back to a canvas-based aging effect on the original PFP.

### Cache
Results are cached in-memory by SHA-256 hash of `username + pfp + vibe + topic`. Same inputs = same result every time. Different inputs = fresh analysis.

---

## Vercel Config Notes

- API routes have 30s timeout (needed for image generation)
- Add this to `vercel.json` if you hit timeout issues:

```json
{
  "functions": {
    "app/api/generate-image/route.ts": { "maxDuration": 60 },
    "app/api/analyze/route.ts": { "maxDuration": 30 }
  }
}
```

---

## License

MIT — do whatever, just don't be weird about it.
