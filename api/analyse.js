export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let body = req.body;
  if (typeof body === "string") body = JSON.parse(body);

  const { ticker } = body;
  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `Give me a swing trade analysis for ${ticker} stock. Return ONLY a raw JSON object with these exact fields, no markdown, no code fences, just the raw JSON:
{
  "ticker": "${ticker}",
  "company": "Full Company Name",
  "current_price": 100.00,
  "verdict": "BUY NOW",
  "entry_low": 98.00,
  "entry_high": 102.00,
  "stop_loss": 93.00,
  "take_profit_1": 107.00,
  "take_profit_2": 112.00,
  "risk_reward": "2.1:1",
  "max_loss_pct": 7.0,
  "tp1_gain_pct": 5.0,
  "tp2_gain_pct": 9.0,
  "confidence": 72,
  "probability": 65,
  "hold_min_days": 7,
  "hold_max_days": 21,
  "primary_catalyst": "reason here",
  "timing": "timing reason here",
  "earnings_date": "15 Aug 2026",
  "earnings_risk": "MEDIUM",
  "exit_trigger_1": "exit condition",
  "exit_trigger_2": "exit condition",
  "exit_trigger_3": "exit condition",
  "risk_1": "risk factor",
  "risk_2": "risk factor",
  "sector_note": "sector context",
  "analyst_target": 125.00,
  "data_date": "June 2026"
}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        tools: [{ googleSearch: {} }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
      }),
    }
  );

  const data = await response.json();
  console.log("FULL GEMINI:", JSON.stringify(data).slice(0, 1000));
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json(data);
}
