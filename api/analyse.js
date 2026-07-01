export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let body = req.body;
  if (typeof body === "string") body = JSON.parse(body);

  const { ticker } = body;
  const apiKey = process.env.GEMINI_API_KEY;

  const prompt = `You are a swing trade analyst. Analyse ${ticker} stock using live Google Search data for current price, recent news, earnings date, and analyst targets.

Return ONLY a raw JSON object, no markdown, no code fences, no explanation:
{"ticker":"${ticker}","company":"Full Name","current_price":0.00,"verdict":"BUY NOW","entry_low":0.00,"entry_high":0.00,"stop_loss":0.00,"take_profit_1":0.00,"take_profit_2":0.00,"risk_reward":"2:1","max_loss_pct":0.0,"tp1_gain_pct":0.0,"tp2_gain_pct":0.0,"confidence":70,"probability":65,"hold_min_days":7,"hold_max_days":21,"primary_catalyst":"reason","timing":"timing","earnings_date":"DD MMM YYYY","earnings_risk":"MEDIUM","exit_trigger_1":"condition","exit_trigger_2":"condition","exit_trigger_3":"condition","risk_1":"risk","risk_2":"risk","sector_note":"context","analyst_target":0.00,"data_date":"June 2026"}

verdict must be exactly BUY NOW, WAIT FOR DIP, or AVOID. earnings_risk must be HIGH, MEDIUM, LOW, or NONE.`;

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
  const raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || "";
  const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const match = clean.match(/\{[\s\S]*\}/);
  const parsed = match ? JSON.parse(match[0]) : null;
  console.log("parsed:", JSON.stringify(parsed)?.slice(0, 300));
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.status(200).json({ parsed });
}
