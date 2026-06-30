export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let body = req.body;
  if (typeof body === "string") body = JSON.parse(body);

  const { ticker } = body;
  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `You are an elite swing trader analyst for US equities. Your client is a retail swing trader who:
- Buys quality stocks on confirmed pullbacks, holds 1–4 weeks
- Cash only — no leverage or margin
- Targets 3–8% gains per trade with a hard 7% stop loss on ALL positions
- Prefers large-cap AI and technology (Mag 7, semiconductors, AI software)
- Account size ~$5,000–7,000 USD

Search Google for the following about ${ticker}:
1. Live current stock price today
2. Recent news from the last 7 days
3. Upcoming earnings date
4. Analyst price targets and recent rating changes
5. Recent price action and technical setup

Today's date is ${new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" })}.

Based on your research, respond ONLY with a raw valid JSON object — no markdown, no explanation, nothing before or after:
{
  "ticker": "${ticker}",
  "company": "Full Company Name",
  "current_price": 0.00,
  "verdict": "BUY NOW",
  "entry_low": 0.00,
  "entry_high": 0.00,
  "stop_loss": 0.00,
  "take_profit_1": 0.00,
  "take_profit_2": 0.00,
  "risk_reward": "2.1:1",
  "max_loss_pct": 0.0,
  "tp1_gain_pct": 0.0,
  "tp2_gain_pct": 0.0,
  "confidence": 72,
  "probability": 65,
  "hold_min_days": 7,
  "hold_max_days": 21,
  "primary_catalyst": "Single sentence — the #1 reason to enter",
  "timing": "Single sentence — why entry timing is right today",
  "earnings_date": "DD MMM YYYY or Unknown",
  "earnings_risk": "HIGH",
  "exit_trigger_1": "Specific condition that means exit immediately",
  "exit_trigger_2": "Second specific exit condition",
  "exit_trigger_3": "Third specific exit condition",
  "risk_1": "Primary risk that could invalidate this trade",
  "risk_2": "Secondary risk factor",
  "sector_note": "One sentence on broader sector or macro backdrop",
  "analyst_target": 0.00,
  "data_date": "${new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" })}"
}
Rules: verdict must be exactly "BUY NOW", "WAIT FOR DIP", or "AVOID". earnings_risk must be exactly "HIGH", "MEDIUM", "LOW", or "NONE". confidence and probability are integers 0-100. Never recommend meme stocks, penny stocks, or crypto-only plays.`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ google_search: {} }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 1500 },
      }),
    }
  );

  const data = await response.json();
  console.log("Gemini response:", JSON.stringify(data).slice(0, 500));
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json(data);
}
