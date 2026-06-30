import { useState, useRef } from "react";

const LOADING_STEPS = [
  "Searching live price data",
  "Scanning recent news",
  "Checking earnings calendar",
  "Pulling analyst targets",
  "Assessing sector context",
  "Computing risk/reward",
  "Building your trade plan",
];

const QUICK = ["NVDA", "META", "PLTR", "AAPL", "MSFT", "AMD", "GOOGL"];

const fmt = (n) => (n != null ? "$" + Number(n).toFixed(2) : "—");
const pct = (n) => (n != null ? Number(n).toFixed(1) + "%" : "—");

const vColor = (v) =>
  v === "BUY NOW" ? "#00d4a0" : v === "WAIT FOR DIP" ? "#f0a020" : "#ff4555";
const vBg = (v) =>
  v === "BUY NOW" ? "rgba(0,212,160,0.06)" : v === "WAIT FOR DIP" ? "rgba(240,160,32,0.06)" : "rgba(255,69,85,0.06)";
const vBorder = (v) =>
  v === "BUY NOW" ? "rgba(0,212,160,0.25)" : v === "WAIT FOR DIP" ? "rgba(240,160,32,0.25)" : "rgba(255,69,85,0.25)";
const rColor = (r) =>
  r === "HIGH" ? "#ff4555" : r === "MEDIUM" ? "#f0a020" : r === "LOW" ? "#00d4a0" : "#4a5870";
const rBg = (r) =>
  r === "HIGH" ? "rgba(255,69,85,0.12)" : r === "MEDIUM" ? "rgba(240,160,32,0.12)" : r === "LOW" ? "rgba(0,212,160,0.12)" : "rgba(74,88,112,0.12)";

function StatBar({ value, color }) {
  return (
    <div style={{ height: 4, background: "#1a2030", borderRadius: 2, overflow: "hidden", marginBottom: 6 }}>
      <div style={{ height: "100%", width: value + "%", background: color, borderRadius: 2, transition: "width 1.2s ease" }} />
    </div>
  );
}

function Box({ label, value, sub, valueColor }) {
  return (
    <div style={{ background: "#0b0f1a", border: "1px solid #1c2438", borderRadius: 8, padding: "11px 13px" }}>
      <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "#4a5870", textTransform: "uppercase", marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 700, fontSize: 15, color: valueColor || "#c8d0e0" }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: "#4a5870", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function ListItem({ text, dotColor }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, padding: "5px 0", borderBottom: "0.5px solid #1a2030", fontSize: 12, lineHeight: 1.5, color: "#c8d0e0" }}>
      <div style={{ width: 5, height: 5, borderRadius: "50%", background: dotColor, flexShrink: 0, marginTop: 5 }} />
      <span>{text}</span>
    </div>
  );
}

function ResultCard({ d }) {
  const col = vColor(d.verdict);
  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <style>{`@keyframes fadeIn { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }`}</style>

      {/* Verdict Banner */}
      <div style={{ background: vBg(d.verdict), border: `1px solid ${vBorder(d.verdict)}`, borderRadius: 10, padding: "18px 22px", marginBottom: 10, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, letterSpacing: "2px", color: "#4a5870", textTransform: "uppercase", marginBottom: 4 }}>Trade Signal — {d.ticker}</div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#fff", marginBottom: 4 }}>{d.company}</div>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 13, color: "#4a5870" }}>
            Current price: <span style={{ color: "#e8a020", fontSize: 17, fontWeight: 700 }}>{fmt(d.current_price)}</span>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 30, letterSpacing: 2, color: col }}>{d.verdict}</div>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, color: col, marginTop: 2 }}>R/R {d.risk_reward || "—"}</div>
        </div>
      </div>

      {/* 4 Key Numbers */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 7, marginBottom: 7 }}>
        <Box label="Entry Zone" value={`${fmt(d.entry_low)} – ${fmt(d.entry_high)}`} sub="Buy in this range" valueColor="#e8a020" />
        <Box label="Stop Loss" value={fmt(d.stop_loss)} sub="Hard exit — no debate" valueColor="#ff4555" />
        <Box label="Take Profit 1" value={fmt(d.take_profit_1)} sub={`+${pct(d.tp1_gain_pct)}`} valueColor="#00d4a0" />
        <Box label="Take Profit 2" value={fmt(d.take_profit_2)} sub={`+${pct(d.tp2_gain_pct)} stretch`} valueColor="#00d4a0" />
      </div>

      {/* Stats Row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7, marginBottom: 7 }}>
        <div style={{ background: "#0b0f1a", border: "1px solid #1c2438", borderRadius: 8, padding: "11px 13px" }}>
          <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "#4a5870", textTransform: "uppercase", marginBottom: 8 }}>Confidence</div>
          <StatBar value={d.confidence || 0} color="#e8a020" />
          <div style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 700, fontSize: 22, color: "#e8a020" }}>
            {d.confidence || 0}<span style={{ fontSize: 12, color: "#4a5870" }}>%</span>
          </div>
        </div>
        <div style={{ background: "#0b0f1a", border: "1px solid #1c2438", borderRadius: 8, padding: "11px 13px" }}>
          <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "#4a5870", textTransform: "uppercase", marginBottom: 8 }}>Success Probability</div>
          <StatBar value={d.probability || 0} color="#00d4a0" />
          <div style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 700, fontSize: 22, color: "#00d4a0" }}>
            {d.probability || 0}<span style={{ fontSize: 12, color: "#4a5870" }}>%</span>
          </div>
        </div>
        <div style={{ background: "#0b0f1a", border: "1px solid #1c2438", borderRadius: 8, padding: "11px 13px" }}>
          <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "#4a5870", textTransform: "uppercase", marginBottom: 6 }}>Hold Period</div>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontWeight: 700, fontSize: 20, color: "#fff", marginTop: 8 }}>
            {d.hold_min_days}–{d.hold_max_days} <span style={{ fontSize: 12, color: "#4a5870" }}>days</span>
          </div>
          <div style={{ fontSize: 10, color: "#4a5870", marginTop: 4 }}>Max risk: <span style={{ color: "#ff4555" }}>{pct(d.max_loss_pct)}</span></div>
        </div>
      </div>

      {/* Catalyst */}
      <div style={{ background: "#0b0f1a", border: "1px solid #1c2438", borderLeft: "3px solid #e8a020", borderRadius: 8, padding: "13px 15px", marginBottom: 7 }}>
        <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "#e8a020", textTransform: "uppercase", marginBottom: 7 }}>⚡ Primary Catalyst</div>
        <div style={{ fontSize: 13, color: "#fff", lineHeight: 1.6, fontWeight: 500 }}>{d.primary_catalyst}</div>
        <div style={{ fontSize: 12, color: "#4a5870", marginTop: 6, lineHeight: 1.5 }}>⏱ Timing: {d.timing}</div>
      </div>

      {/* Earnings */}
      <div style={{ background: "#0b0f1a", border: "1px solid #1c2438", borderRadius: 8, padding: "11px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "#4a5870", textTransform: "uppercase", marginBottom: 4 }}>📅 Next Earnings</div>
          <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 15, color: "#fff", fontWeight: 700 }}>{d.earnings_date || "Unknown"}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "#4a5870", textTransform: "uppercase", marginBottom: 4 }}>Earnings Risk</div>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 12px", borderRadius: 4, letterSpacing: 1, color: rColor(d.earnings_risk), background: rBg(d.earnings_risk) }}>
            {d.earnings_risk}
          </span>
        </div>
      </div>

      {/* Exit + Risk */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 7 }}>
        <div style={{ background: "#0b0f1a", border: "1px solid #1c2438", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "#4a5870", textTransform: "uppercase", marginBottom: 10 }}>🚪 Exit Immediately If</div>
          {[d.exit_trigger_1, d.exit_trigger_2, d.exit_trigger_3].filter(Boolean).map((x, i) => (
            <ListItem key={i} text={x} dotColor="#ff4555" />
          ))}
        </div>
        <div style={{ background: "#0b0f1a", border: "1px solid #1c2438", borderRadius: 8, padding: "12px 14px" }}>
          <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "#4a5870", textTransform: "uppercase", marginBottom: 10 }}>⚠ Risk Factors</div>
          {[d.risk_1, d.risk_2].filter(Boolean).map((x, i) => (
            <ListItem key={i} text={x} dotColor="#f0a020" />
          ))}
        </div>
      </div>

      {/* Analyst Target */}
      <div style={{ background: "#0b0f1a", border: "1px solid #1c2438", borderRadius: 8, padding: "11px 15px", display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "1.5px", color: "#4a5870", textTransform: "uppercase", marginBottom: 3 }}>Wall St. Analyst Consensus Target</div>
          <div style={{ fontSize: 11, color: "#4a5870", marginTop: 2 }}>{d.sector_note}</div>
        </div>
        <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 16, fontWeight: 700, color: "#00d4a0" }}>{fmt(d.analyst_target)}</div>
      </div>

      {/* Powered by */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
        <div style={{ fontSize: 10, color: "#2a3448", letterSpacing: 1 }}>POWERED BY</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: "#4a8af4", letterSpacing: 1 }}>GEMINI + GOOGLE SEARCH</div>
      </div>

      <div style={{ fontSize: 10, color: "#2a3448", textAlign: "center", lineHeight: 1.7, borderTop: "1px solid #1a2030", paddingTop: 10 }}>
        Live data via Google Search · {d.data_date || "June 2026"} · Educational only — not financial advice<br />
        Always set your stop loss before entering any position. Trade responsibly.
      </div>
    </div>
  );
}

export default function SwingScout() {
  const [ticker, setTicker] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadMsg, setLoadMsg] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const timerRef = useRef(null);

  const runAnalysis = async (sym) => {
    const t = (sym || ticker).trim().toUpperCase();
    if (!t) return;
    if (sym) setTicker(sym);

    setLoading(true);
    setResult(null);
    setError(null);

    let idx = 0;
    setLoadMsg(LOADING_STEPS[0]);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      idx = (idx + 1) % LOADING_STEPS.length;
      setLoadMsg(LOADING_STEPS[idx]);
    }, 2800);

    try {
      const res = await fetch("/api/analyse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: t }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();

      // Extract text from Gemini response
      const text = data?.candidates?.[0]?.content?.parts
        ?.filter((p) => p.text)
        ?.map((p) => p.text)
        ?.join("") || "";

      if (!text) throw new Error("No analysis returned — please try again.");

      const match = text.match(/\{[\s\S]*\}/);
      if (!match) throw new Error("Could not parse analysis — please try again.");

      const parsed = JSON.parse(match[0]);
      setResult(parsed);
    } catch (e) {
      setError(e.message || "Something went wrong. Please try again.");
    } finally {
      clearInterval(timerRef.current);
      setLoading(false);
    }
  };

  return (
    <div style={{ background: "#060910", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif", color: "#c8d0e0", padding: "20px 14px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:wght@300;400;500;600&family=Courier+Prime:wght@400;700&display=swap');
        * { box-sizing: border-box; }
        body { background: #060910; }
        input::placeholder { color: #4a5870; font-size: 13px; letter-spacing: 1px; }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100% { opacity:1 } 50% { opacity:0.4 } }
      `}</style>

      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 24, maxWidth: 660, margin: "0 auto 24px" }}>
        <div style={{ fontFamily: "'Bebas Neue', cursive", fontSize: 44, letterSpacing: 4, color: "#fff", lineHeight: 1, textShadow: "0 0 40px rgba(232,160,32,0.35)" }}>
          SWING SCOUT
        </div>
        <div style={{ fontSize: 10, letterSpacing: "3px", color: "#4a5870", textTransform: "uppercase", marginTop: 5 }}>
          AI-Powered Swing Trade Intelligence · Live Google Search Data
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 8 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#4a8af4", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 10, color: "#4a8af4", letterSpacing: 1, fontWeight: 600 }}>GEMINI + GOOGLE SEARCH</span>
        </div>
        <div style={{ height: 1, background: "linear-gradient(90deg,transparent,#e8a020,transparent)", margin: "14px auto 0", maxWidth: 400 }} />
      </div>

      <div style={{ maxWidth: 660, margin: "0 auto" }}>
        {/* Input */}
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={ticker}
            onChange={(e) => setTicker(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === "Enter" && runAnalysis()}
            placeholder="Enter ticker — e.g. NVDA"
            maxLength={10}
            style={{ flex: 1, background: "#0b0f1a", border: "1px solid #1c2438", borderRadius: 6, padding: "13px 16px", fontFamily: "'Courier Prime', monospace", fontSize: 18, fontWeight: 700, color: "#fff", letterSpacing: 3, outline: "none" }}
          />
          <button
            onClick={() => runAnalysis()}
            disabled={loading}
            style={{ background: loading ? "#1c2438" : "#e8a020", border: "none", borderRadius: 6, padding: "13px 22px", fontFamily: "'Bebas Neue', cursive", fontSize: 18, letterSpacing: 2, color: loading ? "#4a5870" : "#060910", cursor: loading ? "not-allowed" : "pointer", whiteSpace: "nowrap", transition: "all 0.2s" }}
          >
            {loading ? "SCANNING..." : "ANALYSE"}
          </button>
        </div>

        {/* Quick picks */}
        <div style={{ fontSize: 11, color: "#4a5870", textAlign: "center", marginBottom: 20 }}>
          Quick:{" "}
          {QUICK.map((q) => (
            <span key={q} onClick={() => !loading && runAnalysis(q)} style={{ color: "#e8a020", cursor: loading ? "not-allowed" : "pointer", margin: "0 4px", opacity: loading ? 0.4 : 1 }}>
              {q}
            </span>
          ))}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 20px" }}>
            <div style={{ width: 44, height: 44, border: "2px solid #1a2030", borderTopColor: "#e8a020", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 18px" }} />
            <div style={{ fontFamily: "'Courier Prime', monospace", fontSize: 12, color: "#e8a020", letterSpacing: 1, animation: "pulse 2s ease infinite" }}>
              {loadMsg}...
            </div>
            <div style={{ fontSize: 11, color: "#2a3448", marginTop: 8 }}>Searching Google for live data · takes 15–30 seconds</div>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div style={{ background: "rgba(255,69,85,0.08)", border: "1px solid rgba(255,69,85,0.3)", borderRadius: 8, padding: 16, fontSize: 13, color: "#ff4555", textAlign: "center", lineHeight: 1.6 }}>
            ⚠ {error}
          </div>
        )}

        {/* Result */}
        {result && !loading && <ResultCard d={result} />}

        {/* Footer */}
        {!result && !loading && !error && (
          <div style={{ textAlign: "center", marginTop: 60, fontSize: 11, color: "#1c2438", lineHeight: 1.8 }}>
            Built by <span style={{ color: "#2a3448" }}>Kal Wahid</span> ·{" "}
            <a href="https://www.linkedin.com/in/kareemwahid/" target="_blank" rel="noreferrer" style={{ color: "#2a3448" }}>LinkedIn</a>
          </div>
        )}
      </div>
    </div>
  );
}
