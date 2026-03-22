"use client";
import { useState, useRef, useCallback } from "react";

const STAGES = { UPLOAD: "upload", QUESTIONS: "questions", ANALYZING: "analyzing", RESULT: "result" };
const VIBES = ["Main Character", "NPC Energy", "Chronically Online", "Lurker", "Clout Chaser", "Thought Leader", "Doomscroller"];
const TWEET_TOPICS = ["Hot Takes", "Memes Only", "News & Politics", "Tech & AI", "Sports", "Fan Accounts", "Self-promo"];

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
      if (data.profile) {
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
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const W = 320, H = 480;
        const canvas = document.createElement("canvas");
        canvas.width = W; canvas.height = H;
        const ctx = canvas.getContext("2d")!;
        const bg = ctx.createLinearGradient(0, 0, 0, H);
        bg.addColorStop(0, "#0a0b10"); bg.addColorStop(1, "#050608");
        ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
        ctx.save();
        ctx.beginPath(); ctx.roundRect(40, 60, 240, 290, 4); ctx.clip();
        ctx.drawImage(img, 40, 60, 240, 290);
        ctx.restore();
        resolve(canvas.toDataURL("image/png"));
      };
      img.src = imgSrc;
    });
  };

  const analyzeAge = async () => {
    if (!pfpPreview || !pfpFile) return;
    setStage(STAGES.ANALYZING);
    setAnalyzeStep("Dialing the Oracle...");
    
    try {
      const cacheKey = await buildCacheKey(username, pfpPreview, vibe, tweetTopic);
      if (RESULT_CACHE[cacheKey]) {
        setResult(RESULT_CACHE[cacheKey].result);
        setAgedImage(RESULT_CACHE[cacheKey].agedImage);
        setFromCache(true);
        setStage(STAGES.RESULT);
        return;
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username, 
          pfpBase64: pfpPreview.split(",")[1], 
          vibe, 
          tweetTopic 
        }),
      });
      
      const data = await res.json();
      if (!data.result) throw new Error("Analysis failed");
      
      setResult(data.result);
      setAnalyzeStep("Generating Aged Portrait...");

      const imgRes = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: data.result.aged_portrait_prompt }),
      });
      
      const imgData = await imgRes.json();
      const finalImg = imgData.imageBase64 || await createCanvasPortrait(pfpPreview, data.result.predicted_age);
      
      setAgedImage(finalImg);
      RESULT_CACHE[cacheKey] = { result: data.result, agedImage: finalImg };
      setStage(STAGES.RESULT);
    } catch (err) {
      console.error(err);
      setStage(STAGES.UPLOAD);
      alert("System Crash. Try again.");
    }
  };

  const downloadCard = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    const html2canvas = (await import("html2canvas")).default;
    const canvas = await html2canvas(cardRef.current, { backgroundColor: "#08090d" });
    const link = document.createElement("a");
    link.download = `oracle-${username}.png`;
    link.href = canvas.toDataURL();
    link.click();
    setDownloading(false);
  };

  const ac = result ? getColor(result.predicted_age) : "#00cfff";

  return (
    <main style={{ minHeight: "100vh", background: "#08090d", fontFamily: "'Courier New',monospace", color: "#e8e8e8", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px" }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 30 }}>
        <h1 style={{ fontSize: "3rem", fontWeight: 900, background: "linear-gradient(to right, #00cfff, #ff4466)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>AGE.EXE</h1>
        <p style={{ fontSize: "10px", letterSpacing: "2px", color: "#444" }}>X ORACLE SYSTEM v5.0</p>
      </div>

      {stage === STAGES.UPLOAD && (
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 15 }}>
          <input className="bg-gray-900 p-4 rounded border border-gray-800 outline-none focus:border-cyan-500" placeholder="@username" value={username} onChange={e => setUsername(e.target.value)} />
          <div onClick={() => fileRef.current?.click()} style={{ border: "2px dashed #1e1e28", padding: 40, textAlign: "center", cursor: "pointer", borderRadius: 8 }}>
            {pfpPreview ? <img src={pfpPreview} style={{ width: 80, height: 80, borderRadius: "50%", margin: "0 auto" }} /> : "Drop PFP Here"}
          </div>
          <input type="file" ref={fileRef} hidden onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
          <button onClick={goToQuestions} disabled={!username || !pfpPreview} style={{ background: "#00cfff", color: "black", padding: 15, fontWeight: "bold", borderRadius: 4 }}>CONTINUE</button>
        </div>
      )}

      {stage === STAGES.QUESTIONS && (
        <div style={{ width: "100%", maxWidth: 400, display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <p style={{ fontSize: 10, color: "#555", marginBottom: 10 }}>SELECT VIBE</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
              {VIBES.map(v => (
                <button key={v} onClick={() => setVibe(v)} style={{ padding: "5px 10px", fontSize: 10, border: vibe === v ? "1px solid #00cfff" : "1px solid #222", color: vibe === v ? "#00cfff" : "#555" }}>{v}</button>
              ))}
            </div>
          </div>
          <button onClick={analyzeAge} style={{ background: "#ff4466", color: "white", padding: 15, fontWeight: "bold" }}>REVEAL MY AGE</button>
        </div>
      )}

      {stage === STAGES.ANALYZING && (
        <div style={{ textAlign: "center" }}>
          <div className="animate-spin text-4xl mb-4">◎</div>
          <p>{analyzeStep}</p>
        </div>
      )}

      {stage === STAGES.RESULT && result && (
        <div style={{ width: "100%", maxWidth: 500 }}>
          <div ref={cardRef} style={{ background: "#0d0e14", border: `2px solid ${ac}`, borderRadius: 12, overflow: "hidden" }}>
             <div style={{ display: "flex" }}>
                <img src={agedImage || ""} style={{ width: 200, height: 300, objectFit: "cover" }} />
                <div style={{ padding: 20, flex: 1 }}>
                   <h2 style={{ fontSize: "5rem", fontWeight: 900, color: ac }}>{result.predicted_age}</h2>
                   <p style={{ fontSize: 10, color: "#555" }}>{result.age_era}</p>
                   <div style={{ marginTop: 20 }}>
                      <p style={{ fontSize: 12 }}>"{result.roast}"</p>
                   </div>
                </div>
             </div>
          </div>
          <button onClick={downloadCard} style={{ width: "100%", marginTop: 20, background: ac, color: "black", padding: 15, fontWeight: "bold" }}>DOWNLOAD ID CARD</button>
          <button onClick={() => setStage(STAGES.UPLOAD)} style={{ width: "100%", marginTop: 10, color: "#555", fontSize: 10 }}>RUN AGAIN</button>
        </div>
      )}
    </main>
  );
}