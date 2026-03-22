"use client";
import { useState, useRef, useCallback } from "react";
import html2canvas from "html2canvas";

const VIBES = ["Main Character","NPC Energy","Chronically Online","Lurker","Clout Chaser","Thought Leader","Doomscroller"];
const TWEET_TOPICS = ["Hot Takes","Memes Only","News & Politics","Tech & AI","Sports","Fan Accounts","Self-promo"];

// Stable cache key from username + pfp sample + vibe + topic
async function buildCacheKey(username: string, pfp: string, vibe: string, topic: string) {
  const img = pfp || "";
  const len = img.length;
  const sample = img.slice(0,120) + img.slice(Math.floor(len*0.45), Math.floor(len*0.45)+120) + img.slice(Math.max(0,len-120));
  const raw = `${username.toLowerCase().trim()}::${sample}::${vibe}::${topic}`;
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(raw));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("").slice(0,32);
}

interface OracleResult {
  predicted_age: number;
  confidence: string;
  age_era: string;
  roast: string;
  pfp_energy: string;
  x_diagnosis: string;
  secret_trait: string;
  aged_portrait_prompt: string;
}

const CACHE: Record<string, { result: OracleResult; agedImg: string | null }> = {};

function getColor(age: number) {
  if (age < 20) return "#00ff88";
  if (age < 30) return "#00cfff";
  if (age < 40) return "#ffcc00";
  if (age < 55) return "#ff8c42";
  return "#ff4466";
}

export default function Home() {
  const [stage, setStage] = useState<"upload"|"questions"|"loading"|"result">("upload");
  const [username, setUsername] = useState("");
  const [pfp, setPfp] = useState<string|null>(null);
  const [pfpFile, setPfpFile] = useState<File|null>(null);
  const [vibe, setVibe] = useState("");
  const [topic, setTopic] = useState("");
  const [result, setResult] = useState<OracleResult|null>(null);
  const [agedImg, setAgedImg] = useState<string|null>(null);
  const [loadingStep, setLoadingStep] = useState("");
  const [imgStatus, setImgStatus] = useState<"loading"|"done"|"failed"|"idle">("idle");
  const [xProfile, setXProfile] = useState<Record<string,unknown>|null>(null);
  const [xStatus, setXStatus] = useState<"idle"|"loading"|"done"|"failed">("idle");
  const [fromCache, setFromCache] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = useCallback((file: File) => {
    if (!file || !file.type.startsWith("image/")) return;
    setPfpFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setPfp(e.target?.result as string);
    reader.readAsDataURL(file);
  }, []);

  const fetchXData = async (handle: string) => {
    setXStatus("loading");
    try {
      const res = await fetch("/api/x-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: handle }),
      });
      const data = await res.json();
      if (data.profile?.display_name) { setXProfile(data.profile); setXStatus("done"); }
      else setXStatus("failed");
    } catch { setXStatus("failed"); }
  };

  const goToQuestions = () => {
    if (!username.trim() || !pfp) return;
    setStage("questions");
    fetchXData(username);
  };

  const generateAgedImage = async (prompt: string, age: number): Promise<string|null> => {
    setImgStatus("loading");
    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, age }),
      });
      const data = await res.json();
      if (data.imageBase64) { setImgStatus("done"); return data.imageBase64; }
      setImgStatus("failed");
      return null;
    } catch { setImgStatus("failed"); return null; }
  };

  const runOracle = async () => {
    if (!pfp || !pfpFile) return;
    setStage("loading");
    setFromCache(false);

    const cacheKey = await buildCacheKey(username, pfp, vibe, topic);
    if (CACHE[cacheKey]) {
      setLoadingStep("Oracle remembers you...");
      await new Promise(r => setTimeout(r, 800));
      const { result: cached, agedImg: cachedImg } = CACHE[cacheKey];
      setResult(cached); setAgedImg(cachedImg);
      setFromCache(true); setStage("result"); return;
    }

    try {
      setLoadingStep("Reading your PFP energy...");
      await new Promise(r => setTimeout(r, 500));
      setLoadingStep("Cross-referencing X timeline...");
      await new Promise(r => setTimeout(r, 500));
      setLoadingStep("Calculating digital age...");

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username,
          pfpBase64: pfp.split(",")[1],
          mediaType: pfpFile.type,
          vibe, tweetTopic: topic, xProfile,
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const parsed: OracleResult = data.result;

      setResult(parsed);
      setStage("result");

      setLoadingStep("Generating aged portrait...");
      const img = await generateAgedImage(parsed.aged_portrait_prompt, parsed.predicted_age);
      setAgedImg(img);
      CACHE[cacheKey] = { result: parsed, agedImg: img };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(`Oracle Error: ${msg}`);
      setStage("questions");
    }
  };

  const downloadCard = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: "#08090d", scale: 2, useCORS: true, allowTaint: true });
      const a = document.createElement("a");
      a.download = `age-oracle-@${username}.png`;
      a.href = canvas.toDataURL("image/png");
      a.click();
    } catch { alert("Try screenshotting instead!"); }
    setDownloading(false);
  };

  const reset = () => {
    setStage("upload"); setUsername(""); setPfp(null); setPfpFile(null);
    setVibe(""); setTopic(""); setResult(null); setAgedImg(null);
    setXProfile(null); setXStatus("idle"); setImgStatus("idle"); setFromCache(false);
  };

  const ac = result ? getColor(result.predicted_age) : "#00cfff";

  return (
    <main style={{ minHeight:"100vh", background:"#08090d", fontFamily:"'Courier New',monospace", color:"#e8e8e8", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"20px", position:"relative", overflow:"hidden" }}>
      <style>{`
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes pulse{0%,100%{opacity:.3}50%{opacity:1}}
        @keyframes shimmer{0%{opacity:.5}50%{opacity:1}100%{opacity:.5}}
        .fadeup{animation:fadeUp .4s ease forwards}
      `}</style>

      {/* BG effects */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:100,backgroundImage:"repeating-linear-gradient(0deg,transparent,transparent 2px,rgba(0,0,0,0.04) 2px,rgba(0,0,0,0.04) 4px)"}}/>
      <div style={{position:"fixed",top:"8%",left:"4%",width:280,height:280,borderRadius:"50%",background:"radial-gradient(circle,rgba(0,207,255,0.06) 0%,transparent 70%)",pointerEvents:"none"}}/>
      <div style={{position:"fixed",bottom:"12%",right:"6%",width:240,height:240,borderRadius:"50%",background:"radial-gradient(circle,rgba(255,68,102,0.05) 0%,transparent 70%)",pointerEvents:"none"}}/>

      {/* Header */}
      <div style={{textAlign:"center",marginBottom:30}}>
        <div style={{fontSize:9,letterSpacing:6,color:"#2a2a35",marginBottom:8}}>◈ X ORACLE SYSTEM v5.0 ◈</div>
        <h1 style={{fontSize:"clamp(2.2rem,7vw,4rem)",fontWeight:900,letterSpacing:-3,margin:0,background:"linear-gradient(135deg,#00cfff 0%,#ff4466 55%,#ffcc00 100%)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",backgroundClip:"text"}}>AGE.EXE</h1>
        <p style={{color:"#2e2e3a",fontSize:11,marginTop:7,letterSpacing:3}}>DROP YOUR PFP. FACE YOUR DIGITAL TRUTH.</p>
      </div>

      {/* UPLOAD */}
      {stage === "upload" && (
        <div className="fadeup" style={{width:"100%",maxWidth:420,display:"flex",flexDirection:"column",gap:14}}>
          <div>
            <label style={{fontSize:9,letterSpacing:3,color:"#333",display:"block",marginBottom:6}}>X USERNAME</label>
            <div style={{display:"flex",alignItems:"center",background:"#0d0e14",border:"1px solid #1a1a24",borderRadius:4}}>
              <span style={{padding:"12px",color:"#333",fontSize:15}}>@</span>
              <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="yourhandle"
                onKeyDown={e=>e.key==="Enter"&&username.trim()&&pfp&&goToQuestions()}
                style={{flex:1,background:"transparent",border:"none",outline:"none",color:"#e8e8e8",fontSize:14,padding:"12px 12px 12px 0",fontFamily:"'Courier New',monospace"}}/>
            </div>
          </div>
          <div>
            <label style={{fontSize:9,letterSpacing:3,color:"#333",display:"block",marginBottom:6}}>PROFILE PICTURE</label>
            <div onDragOver={e=>{e.preventDefault();setDragOver(true);}} onDragLeave={()=>setDragOver(false)}
              onDrop={e=>{e.preventDefault();setDragOver(false);if(e.dataTransfer.files[0])handleFile(e.dataTransfer.files[0]);}}
              onClick={()=>fileRef.current?.click()}
              style={{border:dragOver?"1px solid #00cfff":"1px dashed #1e1e28",borderRadius:4,padding:pfp?16:30,textAlign:"center",cursor:"pointer",background:dragOver?"rgba(0,207,255,0.03)":"#0a0b10",transition:"all .2s"}}>
              {pfp?(
                <div style={{display:"flex",alignItems:"center",gap:12,justifyContent:"center"}}>
                  <img src={pfp} alt="pfp" style={{width:60,height:60,borderRadius:"50%",objectFit:"cover",border:"2px solid #00cfff33"}}/>
                  <div style={{textAlign:"left"}}><div style={{color:"#00cfff",fontSize:11}}>✓ PFP loaded</div><div style={{color:"#2a2a35",fontSize:9,marginTop:2}}>click to change</div></div>
                </div>
              ):(
                <div><div style={{fontSize:24,marginBottom:8,opacity:.2}}>◎</div><div style={{color:"#333",fontSize:11,letterSpacing:1}}>DRAG & DROP or CLICK</div><div style={{color:"#1e1e28",fontSize:9,marginTop:3}}>JPG · PNG · WEBP</div></div>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{display:"none"}} onChange={e=>e.target.files?.[0]&&handleFile(e.target.files[0])}/>
          </div>
          <button onClick={goToQuestions} disabled={!username.trim()||!pfp}
            style={{background:username.trim()&&pfp?"linear-gradient(135deg,#00cfff,#0077ff)":"#0f1018",border:"none",color:username.trim()&&pfp?"#08090d":"#222230",padding:"13px 32px",borderRadius:4,fontSize:11,fontWeight:700,letterSpacing:4,cursor:username.trim()&&pfp?"pointer":"not-allowed",fontFamily:"'Courier New',monospace",transition:"all .2s"}}>
            CONTINUE →
          </button>
        </div>
      )}

      {/* QUESTIONS */}
      {stage === "questions" && (
        <div className="fadeup" style={{width:"100%",maxWidth:420,display:"flex",flexDirection:"column",gap:18}}>
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:9,letterSpacing:4,color:"#2a2a35",marginBottom:5}}>STEP 2 · VIBE CHECK</div>
            {xStatus==="loading"&&<div style={{color:"#3a3a4a",fontSize:13,animation:"pulse 1.5s infinite"}}>⟳ Scanning @{username}...</div>}
            {xStatus==="done"&&<div style={{color:"#e8e8e8",fontSize:13}}>Live data from <span style={{color:"#00cfff"}}>@{username}</span> ✓</div>}
            {xStatus==="failed"&&<div style={{color:"#3a3a4a",fontSize:13}}><span style={{color:"#00cfff"}}>@{username}</span> · no live data</div>}
          </div>
          <div>
            <label style={{fontSize:9,letterSpacing:3,color:"#2a2a35",display:"block",marginBottom:8}}>YOUR X VIBE</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {VIBES.map(v=>(
                <button key={v} onClick={()=>setVibe(v)} style={{padding:"6px 11px",borderRadius:2,fontSize:10,cursor:"pointer",fontFamily:"'Courier New',monospace",letterSpacing:1,background:vibe===v?"rgba(0,207,255,0.1)":"#0d0e14",border:vibe===v?"1px solid #00cfff":"1px solid #1a1a24",color:vibe===v?"#00cfff":"#3a3a4a",transition:"all .12s"}}>{v}</button>
              ))}
            </div>
          </div>
          <div>
            <label style={{fontSize:9,letterSpacing:3,color:"#2a2a35",display:"block",marginBottom:8}}>YOU MOSTLY TWEET ABOUT</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {TWEET_TOPICS.map(t=>(
                <button key={t} onClick={()=>setTopic(t)} style={{padding:"6px 11px",borderRadius:2,fontSize:10,cursor:"pointer",fontFamily:"'Courier New',monospace",letterSpacing:1,background:topic===t?"rgba(255,68,102,0.1)":"#0d0e14",border:topic===t?"1px solid #ff4466":"1px solid #1a1a24",color:topic===t?"#ff4466":"#3a3a4a",transition:"all .12s"}}>{t}</button>
              ))}
            </div>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>setStage("upload")} style={{flex:1,background:"transparent",border:"1px solid #1a1a24",color:"#333",padding:"11px",borderRadius:4,fontSize:10,cursor:"pointer",fontFamily:"'Courier New',monospace",letterSpacing:2}}>← BACK</button>
            <button onClick={runOracle} style={{flex:2,background:"linear-gradient(135deg,#ff4466,#ff8c42)",border:"none",color:"#fff",padding:"11px",borderRadius:4,fontSize:11,fontWeight:700,letterSpacing:3,cursor:"pointer",fontFamily:"'Courier New',monospace"}}>REVEAL MY AGE ⚡</button>
          </div>
        </div>
      )}

      {/* LOADING */}
      {stage === "loading" && (
        <div style={{textAlign:"center"}}>
          <div style={{fontSize:38,marginBottom:22,animation:"spin 2s linear infinite",display:"inline-block",color:"#00cfff",opacity:.5}}>◎</div>
          <div style={{fontSize:11,letterSpacing:4,color:"#00cfff",marginBottom:10}}>ORACLE PROCESSING</div>
          <div style={{fontSize:10,color:"#3a3a4a",letterSpacing:2,animation:"shimmer 1.5s infinite"}}>{loadingStep}</div>
        </div>
      )}

      {/* RESULT */}
      {stage === "result" && result && (
        <div className="fadeup" style={{width:"100%",maxWidth:680,display:"flex",flexDirection:"column",gap:10}}>
          {fromCache&&<div style={{textAlign:"center",fontSize:9,letterSpacing:3,color:"#2a6644",padding:"5px 12px",background:"rgba(0,255,136,0.05)",border:"1px solid rgba(0,255,136,0.1)",borderRadius:3}}>◈ SAME INPUTS · ORACLE LOCKED · CONSISTENT RESULT</div>}

          <div ref={cardRef} style={{background:"#08090d",padding:12,borderRadius:12,width:"100%",maxWidth:640}}>
            <div style={{background:"#0d0e14",border:"1px solid rgba(0,207,255,0.2)",borderRadius:10,overflow:"hidden",fontFamily:"'Courier New',monospace",width:"100%"}}>

              {/* Header */}
              <div style={{background:"linear-gradient(90deg,rgba(0,207,255,0.08),transparent)",borderBottom:"1px solid rgba(0,207,255,0.1)",padding:"8px 16px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                <span style={{fontSize:9,letterSpacing:3,color:"#333a4a"}}>X ORACLE // DIGITAL ID</span>
                <span style={{fontSize:9,letterSpacing:2,color:"#333a4a"}}>CONF: {result.confidence}</span>
              </div>

              {/* Image — full width, fixed height, no cropping issues */}
              <div style={{position:"relative",width:"100%",height:320,overflow:"hidden",background:"#0a0b10"}}>
                {imgStatus==="loading" && (
                  <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:10,zIndex:2,background:"#0a0b10"}}>
                    <div style={{fontSize:28,animation:"spin 2s linear infinite",color:"#00cfff",opacity:.3}}>◎</div>
                    <div style={{fontSize:9,color:"#2a3040",letterSpacing:2,animation:"shimmer 1.5s infinite",textAlign:"center"}}>generating aged portrait...</div>
                  </div>
                )}
                <img
                  src={agedImg || pfp || ""}
                  alt="portrait"
                  style={{width:"100%",height:"100%",objectFit:"cover",objectPosition:"top center",display:"block",filter:agedImg?"none":"saturate(.4) brightness(.6)"}}
                />
                {/* Gradient overlay at bottom of image */}
                <div style={{position:"absolute",bottom:0,left:0,right:0,background:"linear-gradient(transparent,rgba(8,9,13,0.98))",padding:"60px 16px 14px"}}>
                  <div style={{display:"flex",alignItems:"baseline",gap:6}}>
                    <span style={{fontSize:"3.2rem",fontWeight:900,color:ac,lineHeight:1,letterSpacing:-3}}>{result.predicted_age}</span>
                    <span style={{fontSize:10,color:"#2e3a4a",letterSpacing:2}}>YRS</span>
                  </div>
                  <div style={{fontSize:8,color:"#3a4a5a",letterSpacing:2,textTransform:"uppercase",marginTop:3}}>{result.age_era}</div>
                </div>
              </div>

              {/* Details — full width below image, all fields visible */}
              <div style={{padding:"18px 18px 14px",display:"flex",flexDirection:"column",gap:14}}>

                {/* Username + energy row */}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",paddingBottom:12,borderBottom:"1px solid rgba(0,207,255,0.08)"}}>
                  <div>
                    <div style={{fontSize:14,color:"#00cfff",letterSpacing:1,fontWeight:700}}>@{username}</div>
                    <div style={{fontSize:10,color:"#2a3040",letterSpacing:1,marginTop:3}}>{result.pfp_energy}</div>
                  </div>
                  {xProfile && (xProfile as {join_year?:number}).join_year && (
                    <div style={{textAlign:"right"}}>
                      <div style={{fontSize:8,letterSpacing:3,color:"#1e2535",marginBottom:3}}>ON X SINCE</div>
                      <div style={{fontSize:11,color:"#3a4a5a"}}>{(xProfile as {join_year?:number}).join_year}</div>
                    </div>
                  )}
                </div>

                {/* Diagnosis + Secret trait — side by side on wide, stacked on narrow */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
                  <div>
                    <div style={{fontSize:8,letterSpacing:3,color:"#1e2535",marginBottom:4}}>X DIAGNOSIS</div>
                    <div style={{fontSize:11,color:"#556070",lineHeight:1.5}}>{result.x_diagnosis}</div>
                  </div>
                  <div>
                    <div style={{fontSize:8,letterSpacing:3,color:"#1e2535",marginBottom:4}}>SECRET TRAIT</div>
                    <div style={{fontSize:11,color:"#445060",fontStyle:"italic",lineHeight:1.5}}>{result.secret_trait}</div>
                  </div>
                </div>

                {/* Roast — full width */}
                <div style={{borderTop:"1px solid #111820",paddingTop:12}}>
                  <div style={{fontSize:8,letterSpacing:3,color:"#1e2535",marginBottom:6}}>◈ ORACLE SAYS</div>
                  <div style={{fontSize:12,color:"#99aabb",fontStyle:"italic",lineHeight:1.6}}>"{result.roast}"</div>
                </div>
              </div>

              {/* Footer */}
              <div style={{padding:"5px 16px",background:"#060709",display:"flex",justifyContent:"space-between",borderTop:"1px solid #0a0b10"}}>
                <span style={{fontSize:7,color:"#1a1a22",letterSpacing:3}}>AGE.EXE · X ORACLE</span>
                <span style={{fontSize:7,color:"#1a1a22",letterSpacing:2}}>ENTERTAINMENT ONLY</span>
              </div>
            </div>
          </div>

          <div style={{display:"flex",gap:8}}>
            <button onClick={downloadCard} disabled={downloading}
              style={{flex:2,background:`linear-gradient(135deg,${ac}18,${ac}0c)`,border:`1px solid ${ac}40`,color:ac,padding:"12px",borderRadius:4,fontSize:10,fontWeight:700,cursor:"pointer",letterSpacing:3,fontFamily:"'Courier New',monospace",transition:"all .2s"}}>
              {downloading?"⟳ SAVING...":"↓ DOWNLOAD CARD"}
            </button>
            <button onClick={reset}
              style={{flex:1,background:"transparent",border:"1px solid #1a1a24",color:"#333",padding:"12px",borderRadius:4,fontSize:10,cursor:"pointer",letterSpacing:3,fontFamily:"'Courier New',monospace"}}>
              ← RUN AGAIN
            </button>
          </div>
        </div>
      )}

      <div style={{marginTop:36,fontSize:8,color:"#111118",letterSpacing:3,textAlign:"center"}}>FOR ENTERTAINMENT ONLY · X ORACLE AI</div>
    </main>
  );
}
