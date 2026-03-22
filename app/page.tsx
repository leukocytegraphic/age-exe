"use client";

import { useState, useRef, useCallback } from "react";

const STAGES = { UPLOAD: "upload", QUESTIONS: "questions", ANALYZING: "analyzing", RESULT: "result" };
const VIBES = ["Main Character", "NPC Energy", "Chronically Online", "Lurker", "Clout Chaser", "Thought Leader", "Doomscroller"];
const TWEET_TOPICS = ["Hot Takes", "Memes Only", "News & Politics", "Tech & AI", "Sports", "Fan Accounts", "Self-promo"];

// Stable hash — samples start + middle + end to avoid header collision
async function buildCacheKey(username: string, pfpPreview: string, vibe: string, topic: string) {
  const img = pfpPreview || "";
  const len = img.length;
  const fingerprint = img.slice(0, 120)
    + img.slice(Math.floor(len * 0.45), Math.floor(len * 0.45) + 120)
    + img.slice(Math.max(0, len - 120));
  const raw = `${username.toLowerCase().trim()}::${fingerprint}::${vibe}::${topic}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const RESULT_CACHE: Record<string, { result: AnalysisResult; agedImage: string | null }> = {};

interface AnalysisResult {
  predicted_age: number;
  confidence: string;
  age_era: string;
  roast: string;
  pfp_energy: string;
  x_diagnosis: string;
  secret_trait: string;
  aged_portrait_prompt?: string;
}

function getColor(age: number) {
  if (age < 22) return "#00ff88";
  if (age < 30) return "#00cfff";
  if (age < 40) return "#ffcc00";
  if (age < 52) return "#ff8c42";
  return "#ff4466";
}

export default function Home() {
  const [stage, setStage] = useState(STAGES.UPLOAD);
  const [username, setUsername] = useState("");
  const [pfpFile, setPfpFile] = useState<File | null>(null);
  const [pfpPreview, setPfpPreview] = useState<string | null>(null);
  const [vibe, setVibe] = useState("");
  const [tweetTopic, setTweetTopic] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [xProfile, setXProfile] = useState<any>(null);
  const [xStatus, setXStatus] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [analyzeStep, setAnalyzeStep] = useState("");
  const [agedImage, setAgedImage] = useState<string | null>(null);
  const [imageStatus, setImageStatus] = useState<"idle" | "loading" | "done" | "failed">("idle");
  const [fromCache, setFromCache] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    setPfpFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPfpPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false);
    if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
  };

  const goToQuestions = async () => {
    if (!username.trim() || !pfpFile) return;
    setStage(STAGES.QUESTIONS);
    setXStatus("loading");
    try {
      const res = await fetch("/api/x-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username }),
      });
      const data = await res.json();
      if (data.profile?.display_name) {
        setXProfile(data.profile);
        setXStatus("done");
      } else {
        setXStatus("failed");
      }
    } catch {
      setXStatus("failed");
    }
  };

  const createCanvasPortrait = (imgSrc: string, age: number): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const W = 320, H = 480;
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        if (age < 25) { bg.addColorStop(0, "#0a1628"); bg.addColorStop(1, "#050e1a"); }
        else if (age < 40) { bg.addColorStop(0, "#1a1206"); bg.addColorStop(1, "#0d0c05"); }
        else if (age < 55) { bg.addColorStop(0, "#1a0c06"); bg.addColorStop(1, "#0d0905"); }
        else { bg.addColorStop(0, "#180a0a"); bg.addColorStop(1, "#0d0606"); }
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = "rgba(255,255,255,0.025)"; ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        const fX = 40, fY = 60, fW = 240, fH = 290;
        ctx.save();
        ctx.beginPath(); ctx.roundRect(fX, fY, fW, fH, 4); ctx.clip();
        const aspect = img.width / img.height;
        let dW = fW, dH = fH;
        if (aspect > fW / fH) { dH = fH; dW = dH * aspect; } else { dW = fW; dH = dW / aspect; }
        ctx.drawImage(img, fX + (fW - dW) / 2, fY + (fH - dH) / 2, dW, dH);
        const ai = Math.min((age - 16) / 52, 1);
        if (age > 40) { ctx.globalAlpha = ai * 0.35; ctx.fillStyle = "#c8a882"; ctx.fillRect(fX, fY, fW, fH); }
        if (age > 55) { ctx.globalAlpha = (age - 55) / 30 * 0.4; ctx.fillStyle = "#888"; ctx.fillRect(fX, fY, fW, fH); }
        ctx.globalAlpha = 1;
        const vig = ctx.createRadialGradient(fX + fW / 2, fY + fH / 2, fH * 0.2, fX + fW / 2, fY + fH / 2, fH * 0.8);
        vig.addColorStop(0, "transparent"); vig.addColorStop(1, "rgba(0,0,0,0.72)");
        ctx.fillStyle = vig; ctx.fillRect(fX, fY, fW, fH);
        ctx.restore();
        const ac = getColor(age);
        ctx.strokeStyle = ac + "55"; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(fX, fY, fW, fH, 4); ctx.stroke();
        const bl = 16; ctx.strokeStyle = ac; ctx.lineWidth = 2;
        [[fX, fY], [fX + fW, fY], [fX, fY + fH], [fX + fW, fY + fH]].forEach(([cx, cy], i) => {
          const sx = i % 2 === 0 ? 1 : -1, sy = i < 2 ? 1 : -1;
          ctx.beginPath(); ctx.moveTo(cx, cy + sy * bl); ctx.lineTo(cx, cy); ctx.lineTo(cx + sx * bl, cy); ctx.stroke();
        });
        const bY = fY + fH - 26;
        ctx.fillStyle = ac; ctx.beginPath(); ctx.roundRect(fX + fW / 2 - 34, bY, 68, 20, 2); ctx.fill();
        ctx.fillStyle = "#08090d"; ctx.font = "bold 10px 'Courier New'"; ctx.textAlign = "center";
        ctx.fillText(`AGE ${age}`, fX + fW / 2, bY + 14);
        const iY = fY + fH + 18;
        ctx.fillStyle = ac; ctx.font = "bold 50px 'Courier New'"; ctx.fillText(String(age), W / 2, iY + 44);
        ctx.fillStyle = "#2a2a35"; ctx.font = "9px 'Courier New'"; ctx.fillText("YEARS OLD", W / 2, iY + 60);
        ctx.fillStyle = "rgba(0,0,0,0.12)";
        for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
        ctx.fillStyle = "#111118"; ctx.font = "7px 'Courier New'"; ctx.fillText("AGE.EXE · X ORACLE", W / 2, H - 8);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve("");
      img.src = imgSrc;
    });
  };

  const generateAgedImage = async (prompt: string, age: number, pfpFallback: string): Promise<string | null> => {
    setImageStatus("loading");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, age }),
      });
      const data = await res.json();
      if (data.imageBase64) {
        setImageStatus("done");
        return data.imageBase64;
      }
      setImageStatus("failed");
      return await createCanvasPortrait(pfpFallback, age);
    } catch {
      setImageStatus("failed");
      return await createCanvasPortrait(pfpFallback, age);
    }
  };

  const analyzeAge = async () => {
    if (!pfpPreview || !pfpFile) return;
    setStage(STAGES.ANALYZING);
    setAgedImage(null);
    setFromCache(false);
    setImageStatus("idle");
    const cacheKey = await buildCacheKey(username, pfpPreview, vibe, tweetTopic);
    if (RESULT_CACHE[cacheKey]) {
      setAnalyzeStep("Oracle remembers you...");
      await new Promise(r => setTimeout(r, 900));
      const { result: cached, agedImage: cachedImg } = RESULT_CACHE[cacheKey];
      setAgedImage(cachedImg);
      setResult(cached);
      setFromCache(true);
      setStage(STAGES.RESULT);
      return;
    }
    try {
      const pfpBase64 = pfpPreview.split(",")[1];
      const mediaType = pfpFile.type;
      setAnalyzeStep("Reading your PFP energy...");
      await new Promise(r => setTimeout(r, 500));
      setAnalyzeStep("Feeding live X data to Oracle...");
      await new Promise(r => setTimeout(r, 600));
      setAnalyzeStep("Calculating digital age...");
      const analysisRes = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, pfpBase64, mediaType, vibe, tweetTopic, xProfile }),
      });
      const analysisData = await analysisRes.json();
      if (!analysisRes.ok || analysisData.error) throw new Error(analysisData.error || "Analysis failed");
      const parsed: AnalysisResult = analysisData.result;
      setAnalyzeStep("Generating your aged portrait...");
      const img = await generateAgedImage(parsed.aged_portrait_prompt || `person aged ${parsed.predicted_age}`, parsed.predicted_age, pfpPreview);
      RESULT_CACHE[cacheKey] = { result: parsed, agedImage: img };
      setAgedImage(img);
      setResult(parsed);
      setStage(STAGES.RESULT);
    } catch (err) {
      console.error(err);
      const fallback: AnalysisResult = { predicted_age: 27, confidence: "Low", age_era: "Signal Lost", roast: "Oracle system overload.", pfp_energy: "Undefined", x_diagnosis: "System error.", secret_trait: "Mystery User" };
      const img = await createCanvasPortrait(pfpPreview, fallback.predicted_age);
      setAgedImage(img);
      setResult(fallback);
      setStage(STAGES.RESULT);
    }
  };

  const downloadCard = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const h2c = await import("html2canvas");
      const canvas = await h2c.default(cardRef.current, { backgroundColor: "#08090d", scale: 2, useCORS: true, allowTaint: true });
      const a = document.createElement("a");
      a.download = `age-oracle-@${username}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch { alert("Try screenshotting instead!"); }
    setDownloading(false);
  };

  const reset = () => {
    setStage(STAGES.UPLOAD); setUsername(""); setPfpFile(null); setPfpPreview(null);
    setVibe(""); setTweetTopic(""); setResult(null); setXProfile(null);
    setXStatus("idle"); setAnalyzeStep(""); setAgedImage(null);
    setImageStatus("idle"); setFromCache(false);
  };

  const ac = result ? getColor(result.predicted_age) : "#00cfff";

  return (
    <main style={{ minHeight: "100vh", background: "#08090d", fontFamily: "'Courier New',monospace", color: "#e8e8e8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 100, backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)" }} />
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <div style={{ fontSize: 9, letterSpacing: 6, color: "#2a2a35", marginBottom: 8 }}>◈ X ORACLE SYSTEM v5.0 ◈</div>
        <h1 style={{ fontSize: "clamp(2.2rem,7vw,4rem)", fontWeight: 900, letterSpacing: -3, margin: 0, background: "linear-gradient(135deg,#00cfff 0%,#ff4466 55%,#ffcc00 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>AGE.EXE</h1>
        <p style={{ color: "#2e2e3a", fontSize: 11, marginTop: 7, letterSpacing: 3 }}>DROP YOUR PFP. FACE YOUR DIGITAL TRUTH.</p>
      </div>

      {stage === STAGES.UPLOAD && (
        <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ fontSize: 9, letterSpacing: 3, color: "#333", display: "block", marginBottom: 6 }}>X USERNAME</label>
            <div style={{ display: "flex", alignItems: "center", background: "#0d0e14", border: "1px solid #1a1a24", borderRadius: 4 }}>
              <span style={{ padding: "12px", color: "#333", fontSize: 15 }}>@</span>
              <input value={username} onChange={e => setUsername(e.target.value)} placeholder="yourhandle" onKeyDown={e => e.key === "Enter" && username.trim() && pfpFile && goToQuestions()} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: "#e8e8e8", fontSize: 14, padding: "12px 12px 12px 0", fontFamily: "'Courier New',monospace" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: 9, letterSpacing: 3, color: "#333", display: "block", marginBottom: 6 }}>PROFILE PICTURE</label>
            <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop} onClick={() => fileRef.current?.click()} style={{ border: dragOver ? "1px solid #00cfff" : "1px dashed #1e1e28", borderRadius: 4, padding: pfpPreview ? 16 : 30, textAlign: "center", cursor: "pointer", background: dragOver ? "rgba(0,207,255,0.03)" : "#0a0b10" }}>
              {pfpPreview ? (
                <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                  <img src={pfpPreview} alt="pfp" style={{ width: 60, height: 60, borderRadius: "50%", objectFit: "cover" }} />
                  <div style={{ textAlign: "left" }}>
                    <div style={{ color: "#00cfff", fontSize: 11 }}>✓ PFP loaded</div>
                    <div style={{ color: "#2a2a35", fontSize: 9, marginTop: 2 }}>click to change</div>
                  </div>
                </div>
              ) : (
                <div><div style={{ fontSize: 24, marginBottom: 8, opacity: .2 }}>◎</div><div style={{ color: "#333", fontSize: 11, letterSpacing: 1 }}>DRAG & DROP or CLICK</div></div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }} onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          </div>
          <button onClick={goToQuestions} disabled={!username.trim() || !pfpFile} style={{ background: username.trim() && pfpFile ? "linear-gradient(135deg,#00cfff,#0077ff)" : "#0f1018", border: "none", color: "#fff", padding: "13px", borderRadius: 4, fontSize: 11, cursor: "pointer" }}>CONTINUE →</button>
        </div>
      )}

      {stage === STAGES.QUESTIONS && (
        <div style={{ width: "100%", maxWidth: 420, display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ textAlign: "center" }}>
            {xStatus === "loading" && <div style={{ color: "#3a3a4a", fontSize: 13 }}>⟳ Reading @{username} live...</div>}
            {xStatus === "done" && <div style={{ color: "#e8e8e8", fontSize: 13 }}>Live data from <span style={{ color: "#00cfff" }}>@{username}</span> ✓</div>}
          </div>
          <div>
            <label style={{ fontSize: 9, letterSpacing: 3, color: "#2a2a35", display: "block", marginBottom: 8 }}>YOUR X VIBE</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {VIBES.map(v => (
                <button key={v} onClick={() => setVibe(v)} style={{ padding: "6px 11px", borderRadius: 2, fontSize: 10, cursor: "pointer", background: vibe === v ? "rgba(0,207,255,0.1)" : "#0d0e14", border: vibe === v ? "1px solid #00cfff" : "1px solid #1a1a24", color: vibe === v ? "#00cfff" : "#3a3a4a" }}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: 9, letterSpacing: 3, color: "#2a2a35", display: "block", marginBottom: 8 }}>YOU MOSTLY TWEET ABOUT</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TWEET_TOPICS.map(t => (
                <button key={t} onClick={() => setTweetTopic(t)} style={{ padding: "6px 11px", borderRadius: 2, fontSize: 10, cursor: "pointer", background: tweetTopic === t ? "rgba(255,68,102,0.1)" : "#0d0e14", border: tweetTopic === t ? "1px solid #ff4466" : "1px solid #1a1a24", color: tweetTopic === t ? "#ff4466" : "#3a3a4a" }}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => setStage(STAGES.UPLOAD)} style={{ flex: 1, background: "transparent", border: "1px solid #1a1a24", color: "#333", padding: "11px", borderRadius: 4, cursor: "pointer" }}>← BACK</button>
            <button onClick={analyzeAge} style={{ flex: 2, background: "linear-gradient(135deg,#ff4466,#ff8c42)", border: "none", color: "#fff", padding: "11px", borderRadius: 4, cursor: "pointer" }}>REVEAL MY AGE ⚡</button>
          </div>
        </div>
      )}

      {stage === STAGES.ANALYZING && (
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 38, marginBottom: 22, color: "#00cfff", opacity: .5 }}>◎</div>
          <div style={{ fontSize: 11, letterSpacing: 4, color: "#00cfff", marginBottom: 10 }}>ORACLE PROCESSING</div>
          <div style={{ fontSize: 10, color: "#3a3a4a" }}>{analyzeStep}</div>
        </div>
      )}

      {stage === STAGES.RESULT && result && (
        <div style={{ width: "100%", maxWidth: 560, display: "flex", flexDirection: "column", gap: 10 }}>
          <div ref={cardRef} style={{ background: "#08090d", padding: 14, borderRadius: 10 }}>
            <div style={{ background: "#0d0e14", border: `1px solid ${ac}20`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "flex" }}>
                <div style={{ width: 180, flexShrink: 0, position: "relative", borderRight: "1px solid #111118" }}>
                  {agedImage ? <img src={agedImage} alt="aged portrait" style={{ width: "100%", display: "block", objectFit: "cover", minHeight: 270 }} /> : <div style={{ height: 270, background: "#0a0b10" }} />}
                  <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(transparent,rgba(8,9,13,0.95))", padding: "18px 10px 8px", textAlign: "center" }}>
                    <div style={{ color: "#00cfff", fontSize: 11 }}>@{username}</div>
                  </div>
                </div>
                <div style={{ flex: 1, padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
                  <span style={{ fontSize: "3.6rem", fontWeight: 900, color: ac, lineHeight: 1 }}>{result.predicted_age}</span>
                  <div style={{ fontSize: 11, color: "#555" }}>{result.x_diagnosis}</div>
                  <div style={{ fontSize: 11, color: "#444", fontStyle: "italic" }}>{result.secret_trait}</div>
                </div>
              </div>
              <div style={{ borderTop: "1px solid #0e0f18", padding: "10px 14px", background: "#080910" }}>
                <span style={{ fontSize: 12, color: "#ccc" }}>&ldquo;{result.roast}&rdquo;</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={downloadCard} style={{ flex: 2, background: `${ac}18`, border: `1px solid ${ac}40`, color: ac, padding: "12px", borderRadius: 4, cursor: "pointer" }}>{downloading ? "⟳ SAVING..." : "↓ DOWNLOAD CARD"}</button>
            <button onClick={reset} style={{ flex: 1, background: "transparent", border: "1px solid #1a1a24", color: "#333", padding: "12px", borderRadius: 4, cursor: "pointer" }}>← RUN AGAIN</button>
          </div>
        </div>
      )}
    </main>
  );
}