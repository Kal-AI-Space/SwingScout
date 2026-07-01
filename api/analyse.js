export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let body = req.body;
  if (typeof body === "string") body = JSON.parse(body);

  const { ticker } = body;
  const apiKey = process.env.GEMINI_API_KEY;

  try {
    // Step 1: Fetch real live price from Yahoo Finance
    let currentPrice = null;
    try {
      const yfRes = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      const yfData = await yfRes.json();
      currentPrice = yfData?.chart?.result?.[0]?.meta?.regularMarketPrice || null;
      console.log("Yahoo Finance price:", currentPrice);
    } catch(e) {
      console.log("Yahoo Finance failed:", e.message);
    }

    const priceContext = currentPrice
      ? `The REAL current market price of ${ticker} today is $${currentPrice.toFixed(2)}. Use this exact price as current_price.`
      : `Search for the current price of ${ticker}.`;

    // Step 2: Send to Gemini for analysis
    const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

    const prompt = `Today is ${today}. ${priceContext}

Analyse ${ticker} as a swing trade opportunity for a retail trader with $5,000-7,000 account, targeting 3-8% gains, 1-4 week holds, hard 7% stop loss.

Return ONLY this raw JSON object, no markdown, no explanation:
{"ticker":"${ticker}","company":"Full Company Name","current_price":${currentPrice || 0},"verdict":"BUY NOW","entry_low":0.00,"entry_high":0.00,"stop_loss":0.00,"take_profit_1":0.00,"take_profit_2":0.00,"risk_reward":"2:1","max_loss_pct":0.0,"tp1_gain_pct":0.0,"tp2_gain_pct":0.0,"confidence":70,"probability":65,"hold_min_days":7,"hold_max_days":21,"primary_catalyst":"specific catalyst","timing":"specific timing reason","earnings_date":"DD MMM YYYY or Unknown","earnings_risk":"MEDIUM","exit_trigger_1":"specific condition","exit_trigger_2":"specific condition","exit_trigger_3":"specific condition","risk_1":"specific risk","risk_2":"specific risk","sector_note":"current sector context","analyst_target":0.00,"data_date":"${new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" })}"}

Rules:
- current_price MUST be ${currentPrice || "the real market price you find"}
- entry_low and entry_high within 3% of current_price
- stop_loss 5-7% below entry_low
- take_profit_1 4-6% above entry_high
- take_profit_2 8-14% above entry_high
- verdict must be exactly: BUY NOW, WAIT FOR DIP, or AVOID
- earnings_risk must be exactly: HIGH, MEDIUM, LOW, or NONE`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2000,
            thinkingConfig: { thinkingBudget: 0 }
          },
        }),
      }
    );

    const data = await response.json();
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const raw = parts.filter(p => p.text && !p.thought).map(p => p.text).join("");
    console.log("Gemini raw:", raw.slice(0, 400));

    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ parsed: null, error: "No JSON found" });

    const parsed = JSON.parse(match[0]);
    // Force the real price in case Gemini ignored it
    if (currentPrice) parsed.current_price = currentPrice;

    console.log("Success:", parsed.ticker, parsed.current_price);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ parsed });

  } catch(e) {
    console.log("Error:", e.message);
    return res.status(500).json({ parsed: null, error: e.message });
  }
}
