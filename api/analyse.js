export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let body = req.body;
  if (typeof body === "string") body = JSON.parse(body);

  const { ticker } = body;
  const apiKey = process.env.GEMINI_API_KEY;

  const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

  const prompt = `Today is ${today}. Search Google for the LIVE current stock price of ${ticker}, recent news in the last 7 days, upcoming earnings date, and analyst price targets.

Using ONLY the real data you find from Google Search, fill in this JSON with accurate current values. Return ONLY the raw JSON object, no markdown, no explanation, nothing else:

{"ticker":"${ticker}","company":"Full Company Name","current_price":0.00,"verdict":"BUY NOW","entry_low":0.00,"entry_high":0.00,"stop_loss":0.00,"take_profit_1":0.00,"take_profit_2":0.00,"risk_reward":"2:1","max_loss_pct":7.0,"tp1_gain_pct":0.0,"tp2_gain_pct":0.0,"confidence":70,"probability":65,"hold_min_days":7,"hold_max_days":21,"primary_catalyst":"specific reason based on recent news","timing":"specific timing reason","earnings_date":"DD MMM YYYY or Unknown","earnings_risk":"MEDIUM","exit_trigger_1":"specific condition","exit_trigger_2":"specific condition","exit_trigger_3":"specific condition","risk_1":"specific risk","risk_2":"specific risk","sector_note":"current sector context","analyst_target":0.00,"data_date":"${new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" })}"}

Rules:
- current_price MUST be the real live price you find from Google Search today
- verdict must be exactly BUY NOW, WAIT FOR DIP, or AVOID
- earnings_risk must be exactly HIGH, MEDIUM, LOW, or NONE
- entry_low and entry_high should be within 3% of current_price
- stop_loss should be 5-7% below entry_low
- take_profit_1 should be 4-6% above entry_high
- take_profit_2 should be 8-14% above entry_high`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          tools: [{ googleSearch: {} }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
            thinkingConfig: { thinkingBudget: 0 }
          },
        }),
      }
    );

    const data = await response.json();
    console.log("Gemini status:", response.status);
    console.log("Gemini raw:", JSON.stringify(data).slice(0, 600));

    const parts = data?.candidates?.[0]?.content?.parts || [];
    const raw = parts
      .filter(p => p.text && !p.thought)
      .map(p => p.text)
      .join("");

    console.log("Extracted text:", raw.slice(0, 400));

    if (!raw) {
      console.log("No text parts found. Full candidates:", JSON.stringify(data?.candidates).slice(0, 400));
      return res.status(200).json({ parsed: null, error: "Empty response from Gemini" });
    }

    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);

    if (!match) {
      console.log("No JSON found in:", clean.slice(0, 300));
      return res.status(200).json({ parsed: null, error: "No JSON in response", raw: clean.slice(0, 300) });
    }

    const parsed = JSON.parse(match[0]);
    console.log("Success:", parsed.ticker, parsed.current_price);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ parsed });

  } catch (e) {
    console.log("Error:", e.message);
    return res.status(500).json({ parsed: null, error: e.message });
  }
}
