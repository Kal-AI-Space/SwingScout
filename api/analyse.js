export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  let body = req.body;
  if (typeof body === "string") body = JSON.parse(body);

  const { ticker } = body;
  const finnhubKey = process.env.FINNHUB_API_KEY;
  const groqKey = process.env.GROQ_API_KEY;

  try {
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
      return res.status(200).json({ parsed: null, error: "Invalid ticker or market is closed." });
    }

    const recentHeadlines = Array.isArray(news) && news.length > 0
      ? news.slice(0, 7).map(n => `- ${n.headline}`).join("\n")
      : "No recent news found";

    const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });

    const systemPrompt = `You are an elite swing trader analyst for US equities. Your client is a retail swing trader who:
- Buys quality stocks on confirmed pullbacks, holds 1–4 weeks
- Cash only — no leverage or margin
- Targets 3–8% gains per trade with a hard 7% stop loss on ALL positions
- Prefers large-cap AI and technology (Mag 7, semiconductors, AI software)
- Loses money on meme stocks and FOMO buys — never recommend these
- Account size ~$5,000–7,000 USD
- Applies Islamic finance screening — avoids companies with excessive debt (debt/equity > 33%), interest-based revenue, or haram business activities

Strategy: buy quality on confirmed pullbacks with a clear catalyst, defined risk, realistic target.
You must be specific, opinionated, and sharp. Reference actual news, actual price levels, actual catalysts.
NEVER use generic placeholder text. NEVER copy example values. ALWAYS calculate real numbers based on the live price provided.`;

    const userPrompt = `Today is ${today}. Analyse ${ticker} for a swing trade opportunity.

LIVE MARKET DATA:
- Company: ${companyName}
- Industry: ${industry}
- Market Cap: ${marketCap}
- Current Price: $${currentPrice}
- Today High: $${highDay}
- Today Low: $${lowDay}
- Previous Close: $${prevClose}
- Change Today: ${changePercent}%

RECENT NEWS HEADLINES (last 7 days):
${recentHeadlines}

INSTRUCTIONS:
1. Assess the technical setup — is this stock in a pullback, at support, breaking out, or at resistance?
2. Identify the single strongest catalyst from the news above
3. Calculate precise entry, stop, and target levels based on the REAL current price of $${currentPrice}
4. Give a REAL confidence score based on how strong the setup is (not a default number)
5. Give a REAL probability based on market conditions (not a default number)
6. Give a REAL hold period based on the catalyst timeline
7. Write specific exit triggers referencing actual price levels
8. Check halal compliance — flag if debt-heavy or interest-based business

Return ONLY a raw JSON object. No markdown. No code fences. No explanation. Every field must have a REAL calculated value — never use placeholder numbers:

{
  "ticker": "${ticker}",
  "company": "${companyName}",
  "current_price": ${currentPrice},
  "verdict": "one of: BUY NOW or WAIT FOR DIP or AVOID",
  "entry_low": calculated as 1-2% below current price if in pullback,
  "entry_high": calculated as 0-1% above current price,
  "stop_loss": calculated as 5-7% below entry_low,
  "take_profit_1": calculated as 4-6% above entry_high,
  "take_profit_2": calculated as 9-13% above entry_high,
  "risk_reward": "calculated ratio e.g. 2.3:1",
  "max_loss_pct": calculated percentage loss to stop,
  "tp1_gain_pct": calculated percentage gain to TP1,
  "tp2_gain_pct": calculated percentage gain to TP2,
  "confidence": integer 0-100 based on YOUR assessment of this specific setup,
  "probability": integer 0-100 based on YOUR assessment of success likelihood,
  "hold_min_days": integer based on catalyst timeline,
  "hold_max_days": integer based on catalyst timeline,
  "primary_catalyst": "specific sentence referencing actual news headline above",
  "timing": "specific sentence explaining why TODAY specifically is the right entry based on price action",
  "earnings_date": "DD MMM YYYY or Unknown",
  "earnings_risk": "one of: HIGH or MEDIUM or LOW or NONE",
  "exit_trigger_1": "specific price level or condition e.g. close below $XXX",
  "exit_trigger_2": "specific condition with price reference",
  "exit_trigger_3": "specific condition with price reference",
  "risk_1": "specific risk referencing this stock's actual situation",
  "risk_2": "specific secondary risk for this stock",
  "sector_note": "specific current observation about ${industry} sector",
  "analyst_target": your estimate of Wall St consensus target price,
  "data_date": "${new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" })}"
}`;

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
        temperature: 0.3,
        max_tokens: 2000,
      }),
    });

    const groqData = await groqRes.json();
    const raw = groqData?.choices?.[0]?.message?.content || "";
    console.log("Groq raw:", raw.slice(0, 600));

    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ parsed: null, error: "No JSON in response", raw: clean.slice(0, 300) });

    const parsed = JSON.parse(match[0]);

    // Always force real Finnhub data
    parsed.current_price = currentPrice;
    parsed.company = companyName;
    parsed.ticker = ticker;

    console.log("Success:", parsed.ticker, parsed.current_price, parsed.verdict, "Conf:", parsed.confidence);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ parsed });

  } catch(e) {
    console.log("Error:", e.message);
    return res.status(500).json({ parsed: null, error: e.message });
  }
}
