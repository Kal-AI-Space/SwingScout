export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let body = req.body;
  if (typeof body === "string") body = JSON.parse(body);

  const { ticker } = body;
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  try {
    // Step 1: Fetch real live price + quote data from Finnhub
    const finnhubRes = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${finnhubKey}`
    );
    const quote = await finnhubRes.json();
    console.log("Finnhub quote:", JSON.stringify(quote));

    const currentPrice = quote.c || null;
    const highDay = quote.h || null;
    const lowDay = quote.l || null;
    const prevClose = quote.pc || null;
    const changePercent = quote.dp || null;

    if (!currentPrice || currentPrice === 0) {
      return res.status(200).json({ parsed: null, error: "Could not fetch live price. Check ticker symbol." });
    }

    // Step 2: Fetch company profile from Finnhub
    const profileRes = await fetch(
      `https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${finnhubKey}`
    );
    const profile = await profileRes.json();
    const companyName = profile.name || ticker;
    const industry = profile.finnhubIndustry || "Technology";

    // Step 3: Fetch basic financials
    const newsRes = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${finnhubKey}`
    );
    const news = await newsRes.json();
    const recentHeadlines = Array.isArray(news)
      ? news.slice(0, 5).map(n => n.headline).join("; ")
      : "No recent news available";

    console.log("Price:", currentPrice, "Company:", companyName);

    const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

    // Step 4: Send to Groq for analysis
    const prompt = `You are an elite swing trade analyst. Today is ${today}.

LIVE MARKET DATA FOR ${ticker}:
- Company: ${companyName}
- Industry: ${industry}
- Current Price: $${currentPrice}
- Today's High: $${highDay}
- Today's Low: $${lowDay}
- Previous Close: $${prevClose}
- Change Today: ${changePercent}%
- Recent News Headlines: ${recentHeadlines}

Based on this real market data, provide a swing trade analysis for a retail trader with:
- Account size: $5,000-7,000
- Target: 3-8% gains per trade
- Hold period: 1-4 weeks
- Hard 7% stop loss on all positions
- No leverage or margin

Return ONLY a raw JSON object, absolutely no markdown, no code fences, no explanation:
{"ticker":"${ticker}","company":"${companyName}","current_price":${currentPrice},"verdict":"BUY NOW","entry_low":0.00,"entry_high":0.00,"stop_loss":0.00,"take_profit_1":0.00,"take_profit_2":0.00,"risk_reward":"2:1","max_loss_pct":0.0,"tp1_gain_pct":0.0,"tp2_gain_pct":0.0,"confidence":70,"probability":65,"hold_min_days":7,"hold_max_days":21,"primary_catalyst":"specific catalyst based on news and price action","timing":"specific timing reason based on today's price action","earnings_date":"DD MMM YYYY or Unknown","earnings_risk":"MEDIUM","exit_trigger_1":"specific condition","exit_trigger_2":"specific condition","exit_trigger_3":"specific condition","risk_1":"specific risk","risk_2":"specific risk","sector_note":"current sector context","analyst_target":0.00,"data_date":"${new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" })}"}

Rules:
- current_price MUST be exactly ${currentPrice}
- entry_low and entry_high must be within 3% of ${currentPrice}
- stop_loss must be 5-7% below entry_low
- take_profit_1 must be 4-6% above entry_high
- take_profit_2 must be 8-14% above entry_high
- verdict must be exactly: BUY NOW, WAIT FOR DIP, or AVOID
- earnings_risk must be exactly: HIGH, MEDIUM, LOW, or NONE
- confidence and probability must be integers 0-100`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    });

    const groqData = await groqRes.json();
    console.log("Groq status:", groqRes.status);

    const raw = groqData?.choices?.[0]?.message?.content || "";
    console.log("Groq raw:", raw.slice(0, 400));

    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ parsed: null, error: "No JSON in Groq response", raw: clean.slice(0, 200) });

    const parsed = JSON.parse(match[0]);
    // Always force the real Finnhub price — never trust LLM for this
    parsed.current_price = currentPrice;
    parsed.company = companyName;
    parsed.ticker = ticker;

    console.log("Success:", parsed.ticker, parsed.current_price);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ parsed });

  } catch(e) {
    console.log("Error:", e.message);
    return res.status(500).json({ parsed: null, error: e.message });
  }
}
