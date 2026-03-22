"use client";

import { useState, useRef } from "react";
import html2canvas from "html2canvas";

export default function Home() {
  const [username, setUsername] = useState("");
  const [pfp, setPfp] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [agedImg, setAgedImg] = useState<string | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const reader = new FileReader();
      reader.onload = (ev) => setPfp(ev.target?.result as string);
      reader.readAsDataURL(e.target.files[0]);
    }
  };

  const runOracle = async () => {
    if (!username || !pfp) return alert("Enter handle and upload PFP first!");
    
    setLoading(true);
    try {
      // 1. Get Analysis from Gemini
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          username, 
          pfpBase64: pfp.split(",")[1], 
          vibe: "Main Character", 
          tweetTopic: "Tech" 
        }),
      });
      const data = await res.json();
      
      if (data.error) throw new Error(data.error);
      setResult(data.result);

      // 2. Generate Aged Portrait from Flux
      const imgRes = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: data.result.aged_portrait_prompt }),
      });
      const imgData = await imgRes.json();
      
      if (imgData.imageBase64) {
        setAgedImg(imgData.imageBase64);
      }
    } catch (err: any) {
      console.error(err);
      alert(`Oracle Error: ${err.message}`);
    }
    setLoading(false);
  };

  const downloadCard = async () => {
    if (!cardRef.current) return;
    try {
      const canvas = await html2canvas(cardRef.current, {
        backgroundColor: "#000000",
        useCORS: true,
      });
      const link = document.createElement("a");
      link.download = `${username}-digital-age.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (err) {
      alert("Failed to save image. Try taking a screenshot!");
    }
  };

  return (
    <main className="min-h-screen bg-black text-white p-6 flex flex-col items-center justify-center font-mono">
      {/* Background Glow */}
      <div className="fixed inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-900/20 via-black to-black -z-10" />

      <div className="text-center mb-10">
        <h1 className="text-5xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600">
          AGE.EXE
        </h1>
        <p className="text-[10px] tracking-[0.3em] text-cyan-800 uppercase mt-2">Digital Age Oracle v2.5</p>
      </div>
      
      {!result ? (
        <div className="flex flex-col gap-6 w-full max-w-xs p-8 border border-gray-800 bg-gray-900/50 backdrop-blur-md rounded-2xl">
          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase ml-1">X Handle</label>
            <input 
              className="w-full bg-black p-3 border border-gray-800 text-white rounded-lg focus:border-cyan-500 outline-none transition-all" 
              placeholder="@username" 
              value={username}
              onChange={e => setUsername(e.target.value)} 
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-gray-500 uppercase ml-1">Profile Photo</label>
            <div className="relative group">
              <input 
                type="file" 
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" 
                onChange={handleUpload} 
              />
              <div className="w-full bg-black p-4 border border-dashed border-gray-700 rounded-lg text-center text-xs text-gray-500 group-hover:border-cyan-500 transition-all">
                {pfp ? "✓ Image Loaded" : "Click to Upload PFP"}
              </div>
            </div>
          </div>

          <button 
            onClick={runOracle} 
            disabled={loading || !username || !pfp} 
            className="w-full bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-800 text-white p-4 rounded-lg font-bold text-sm shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all active:scale-95"
          >
            {loading ? "CONSULTING ORACLE..." : "REVEAL MY TRUTH"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-8 animate-in fade-in zoom-in duration-500">
          <div 
            ref={cardRef} 
            className="bg-black p-6 border-2 border-cyan-500/50 rounded-2xl max-w-[320px] text-center shadow-[0_0_40px_rgba(6,182,212,0.2)]"
          >
            <div className="relative aspect-square mb-6 overflow-hidden rounded-xl border border-gray-800">
              <img 
                src={agedImg || pfp || ""} 
                alt="Aged Portrait"
                className="w-full h-full object-cover" 
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-4">
                <p className="text-cyan-400 text-xs font-bold">@{username}</p>
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[10px] text-cyan-500/70 tracking-widest uppercase">Predicted Digital Age</p>
              <h2 className="text-7xl font-black text-white tracking-tighter">{result.predicted_age}</h2>
            </div>

            <p className="text-sm my-6 text-gray-300 italic px-4 leading-relaxed">
              "{result.roast}"
            </p>

            <div className="text-left text-[9px] space-y-3 border-t border-gray-900 pt-6 mt-2">
              <div className="flex justify-between">
                <span className="text-gray-500 uppercase">Generation Era:</span>
                <span className="text-cyan-400 font-bold">{result.age_era}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 uppercase">Diagnosis:</span>
                <span className="text-white">{result.x_diagnosis}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 uppercase">Secret Trait:</span>
                <span className="text-white">{result.secret_trait}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-4">
            <button 
              onClick={downloadCard} 
              className="bg-white text-black px-8 py-3 rounded-full font-bold text-xs uppercase hover:bg-cyan-400 transition-colors shadow-lg"
            >
              Save Identity
            </button>
            <button 
              onClick={() => window.location.reload()} 
              className="bg-gray-900 text-gray-400 px-8 py-3 rounded-full font-bold text-xs uppercase hover:text-white transition-colors"
            >
              Reset
            </button>
          </div>
        </div>
      )}

      <footer className="fixed bottom-6 text-[8px] text-gray-700 tracking-[0.5em] uppercase">
        Encrypted Connection Established
      </footer>
    </main>
  );
}