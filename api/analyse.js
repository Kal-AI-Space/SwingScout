export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let body = req.body;
  if (typeof body === "string") body = JSON.parse(body);

  const { ticker } = body;
  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `You are a swing trade analyst. Based on your knowledge of ${ticker} stock as of mid-2026, provide a swing trade analysis.

Return ONLY a JSON object, nothing else, no markdown:
{"ticker":"${ticker}","company":"Full Company Name","current_price":100.00,"verdict":"BUY NOW","entry_low":98.00,"entry_high":102.00,"stop_loss":93.00,"take_profit_1":107.00,"take_profit_2":112.00,"risk_reward":"2:1","max_loss_pct":7.0,"tp1_gain_pct":5.0,"tp2_gain_pct":9.0,"confidence":70,"probability":65,"hold_min_days":7,"hold_max_days":21,"primary_catalyst":"reason","timing":"timing","earnings_date":"DD MMM YYYY","earnings_risk":"MEDIUM","exit_trigger_1":"condition","exit_trigger_2":"condition","exit_trigger_3":"condition","risk_1":"risk","risk_2":"risk","sector_note":"context","analyst_target":120.00,"data_date":"July 2026"}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
      }),
    }
  );

  const data = await response.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const raw = parts.map(p => p.text || "").join("");
  console.log("RAW:", raw.slice(0, 300));

  try {
    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ parsed: null });
    const parsed = JSON.parse(match[0]);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ parsed });
  } catch(e) {
    return res.status(200).json({ parsed: null });
  }
}
