export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let body = req.body;
  if (typeof body === "string") body = JSON.parse(body);

  const { ticker } = body;
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  try {
    // Step 1: Fetch real live price from Finnhub
    const [quoteRes, profileRes, newsRes] = await Promise.all([
      fetch(`https://finnhub.io/api/v1/quote?symbol=${ticker}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${ticker}&token=${finnhubKey}`),
      fetch(`https://finnhub.io/api/v1/company-news?symbol=${ticker}&from=${new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0]}&to=${new Date().toISOString().split('T')[0]}&token=${finnhubKey}`),
    ]);

    const [quote, profile, news] = await Promise.all([
      quoteRes.json(),
      profileRes.json(),
      newsRes.json(),
    ]);

    const currentPrice = quote.c;
    const highDay = quote.h;
    const lowDay = quote.l;
    const prevClose = quote.pc;
    const changePercent = quote.dp?.toFixed(2);
    const companyName = profile.name || ticker;
    const industry = profile.finnhubIndustry || "Technology";
    const marketCap = profile.marketCapitalization ? `$${(profile.marketCapitalization / 1000).toFixed(1)}B` : "Unknown";

    if (!currentPrice || currentPrice === 0) {
      return res.status(200).json({ parsed: null, error: "Invalid ticker or market is closed. Try again during market hours." });
    }

    const recentHeadlines = Array.isArray(news)
      ? news.slice(0, 7).map(n => `- ${n.headline}`).join("\n")
      : "No recent news available";

    console.log(`${ticker} | Price: ${currentPrice} | Company: ${companyName}`);

    const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

    const systemPrompt = `You are an elite swing trader analyst for US equities. Your client is a retail swing trader who:
- Buys quality stocks on confirmed pullbacks, holds 1–4 weeks
- Cash only — no leverage or margin
- Targets 3–8% gains per trade with a hard 7% stop loss on ALL positions
- Prefers large-cap AI and technology (Mag 7, semiconductors, AI software)
- Loses money on meme stocks and FOMO buys — never recommend these
- Account size ~$5,000–7,000 USD
- Applies Islamic finance screening — avoids companies with excessive debt (debt/equity > 33%), interest-based revenue, or haram business activities

Strategy: buy quality on confirmed pullbacks with a clear catalyst, defined risk, realistic target. Be specific, opinionated, and sharp. Never give generic advice.`;

    const userPrompt = `Today is ${today}. Analyse ${ticker} for a swing trade.

LIVE MARKET DATA (from Finnhub — use these exact figures):
- Company: ${companyName}
- Industry: ${industry}
- Market Cap: ${marketCap}
- Current Price: $${currentPrice}
- Today's High: $${highDay}
- Today's Low: $${lowDay}  
- Previous Close: $${prevClose}
- Change Today: ${changePercent}%

RECENT NEWS (last 7 days):
${recentHeadlines}

Using this real data, provide a sharp, specific swing trade analysis. Consider:
1. Is the stock in a confirmed pullback or at resistance?
2. What is the technical setup based on today's price action?
3. What recent news is the primary catalyst?
4. Is this halal-compliant for an Islamic finance screened portfolio?
5. What are the specific entry, stop, and target levels?

Respond ONLY with raw valid JSON — no markdown fences, no explanation, nothing before or after:
{
  "ticker": "${ticker}",
  "company": "${companyName}",
  "current_price": ${currentPrice},
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
  "primary_catalyst": "Single specific sentence — the #1 reason to enter based on real news above",
  "timing": "Single specific sentence — why entry timing is right TODAY based on price action",
  "earnings_date": "DD MMM YYYY or Unknown",
  "earnings_risk": "HIGH",
  "exit_trigger_1": "Specific measurable condition that means exit immediately",
  "exit_trigger_2": "Second specific exit condition",
  "exit_trigger_3": "Third specific exit condition",
  "risk_1": "Primary specific risk that could invalidate this trade",
  "risk_2": "Secondary specific risk factor",
  "sector_note": "One specific sentence on current sector or macro backdrop",
  "analyst_target": 0.00,
  "data_date": "${new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" })}"
}

Rules:
- current_price MUST be exactly ${currentPrice} — never change this
- entry_low and entry_high must be within 3% of ${currentPrice}
- stop_loss must be 5-7% below entry_low
- take_profit_1 must be 4-6% above entry_high  
- take_profit_2 must be 8-14% above entry_high
- verdict must be exactly: BUY NOW, WAIT FOR DIP, or AVOID
- earnings_risk must be exactly: HIGH, MEDIUM, LOW, or NONE
- confidence and probability are integers 0-100
- Never recommend meme stocks, penny stocks, or crypto-only plays
- If stock is near all-time highs with no pullback, use WAIT FOR DIP
- If fundamentals are broken or haram business, use AVOID
- Be specific — reference actual news headlines, actual price levels, actual catalysts`;

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${groqKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });

    const groqData = await groqRes.json();
    console.log("Groq status:", groqRes.status);

    const raw = groqData?.choices?.[0]?.message?.content || "";
    console.log("Groq raw:", raw.slice(0, 500));

    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ parsed: null, error: "No JSON in response", raw: clean.slice(0, 200) });

    const parsed = JSON.parse(match[0]);

    // Always force real Finnhub data — never trust LLM for price/company
    parsed.current_price = currentPrice;
    parsed.company = companyName;
    parsed.ticker = ticker;

    console.log("Success:", parsed.ticker, parsed.current_price, parsed.verdict);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ parsed });

  } catch(e) {
    console.log("Error:", e.message);
    return res.status(500).json({ parsed: null, error: e.message });
  }
}
