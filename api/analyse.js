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
    const marketCap = profile.marketCapitalization
      ? `$${(profile.marketCapitalization / 1000).toFixed(1)}B`
      : "Unknown";

    if (!currentPrice || currentPrice === 0) {
      return res.status(200).json({ parsed: null, error: "Invalid ticker or market is closed." });
    }

    const recentHeadlines = Array.isArray(news) && news.length > 0
      ? news.slice(0, 7).map(n => `- ${n.headline}`).join("\n")
      : "No recent news found";

    const today = new Date().toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" });
    const dataDate = new Date().toLocaleDateString("en-AU", { month: "long", year: "numeric" });

    const entryLow = (currentPrice * 0.98).toFixed(2);
    const entryHigh = (currentPrice * 1.005).toFixed(2);
    const stopLoss = (currentPrice * 0.935).toFixed(2);
    const tp1 = (currentPrice * 1.055).toFixed(2);
    const tp2 = (currentPrice * 1.11).toFixed(2);

    const systemPrompt = `You are an elite swing trader analyst for US equities. Your client is a retail swing trader who:
- Buys quality stocks on confirmed pullbacks, holds 1–4 weeks
- Cash only — no leverage or margin
- Targets 3–8% gains per trade with a hard 7% stop loss on ALL positions
- Prefers large-cap AI and technology (Mag 7, semiconductors, AI software)
- Loses money on meme stocks and FOMO buys — never recommend these
- Account size ~$5,000–7,000 USD

Strategy: buy quality on confirmed pullbacks with a clear catalyst, defined risk, realistic target.
Be specific, opinionated and sharp. Reference actual news and actual price levels in your reasoning.
Never use generic placeholder text. Every sentence must be specific to this stock right now.`;

    const userPrompt = `Today is ${today}. Analyse ${ticker} for a swing trade.

LIVE MARKET DATA:
- Company: ${companyName}
- Industry: ${industry}
- Market Cap: ${marketCap}
- Current Price: $${currentPrice}
- Today High: $${highDay}
- Today Low: $${lowDay}
- Previous Close: $${prevClose}
- Change Today: ${changePercent}%

RECENT NEWS (last 7 days):
${recentHeadlines}

PRE-CALCULATED LEVELS (use these exact numbers):
- entry_low: ${entryLow}
- entry_high: ${entryHigh}
- stop_loss: ${stopLoss}
- take_profit_1: ${tp1}
- take_profit_2: ${tp2}
- max_loss_pct: ${((currentPrice - parseFloat(stopLoss)) / currentPrice * 100).toFixed(1)}
- tp1_gain_pct: ${((parseFloat(tp1) - currentPrice) / currentPrice * 100).toFixed(1)}
- tp2_gain_pct: ${((parseFloat(tp2) - currentPrice) / currentPrice * 100).toFixed(1)}

YOUR JOB — generate these values based on your analysis of the news and price action above:
- verdict: is this BUY NOW, WAIT FOR DIP, or AVOID right now? Be decisive.
- confidence: integer 0-100 — how confident are YOU in this specific setup today?
- probability: integer 0-100 — what is the realistic success probability for this trade?
- hold_min_days: integer — minimum days to hold based on the catalyst timeline
- hold_max_days: integer — maximum days to hold based on the catalyst timeline
- primary_catalyst: ONE specific sentence referencing actual news above — the #1 reason to enter
- timing: ONE specific sentence explaining why TODAY is the right entry based on today's price action
- earnings_date: when is the next earnings? format DD MMM YYYY or Unknown
- earnings_risk: HIGH, MEDIUM, LOW, or NONE
- exit_trigger_1: specific price level or condition e.g. "Close below $${stopLoss} on volume"
- exit_trigger_2: second specific exit condition with price reference
- exit_trigger_3: third specific exit condition with price reference
- risk_1: specific risk that could invalidate this trade for ${ticker} right now
- risk_2: secondary specific risk for ${ticker}
- sector_note: one specific sentence on ${industry} sector current conditions
- analyst_target: your best estimate of Wall St consensus 12-month price target
- risk_reward: calculate from the pre-calculated levels above

Return ONLY a raw JSON object. No markdown. No code fences. No explanation. No preamble:
{"ticker":"${ticker}","company":"${companyName}","current_price":${currentPrice},"verdict":"YOUR_VERDICT","entry_low":${entryLow},"entry_high":${entryHigh},"stop_loss":${stopLoss},"take_profit_1":${tp1},"take_profit_2":${tp2},"risk_reward":"YOUR_CALC","max_loss_pct":${((currentPrice - parseFloat(stopLoss)) / currentPrice * 100).toFixed(1)},"tp1_gain_pct":${((parseFloat(tp1) - currentPrice) / currentPrice * 100).toFixed(1)},"tp2_gain_pct":${((parseFloat(tp2) - currentPrice) / currentPrice * 100).toFixed(1)},"confidence":YOUR_INT,"probability":YOUR_INT,"hold_min_days":YOUR_INT,"hold_max_days":YOUR_INT,"primary_catalyst":"YOUR_SPECIFIC_SENTENCE","timing":"YOUR_SPECIFIC_SENTENCE","earnings_date":"YOUR_DATE","earnings_risk":"YOUR_LEVEL","exit_trigger_1":"YOUR_SPECIFIC_CONDITION","exit_trigger_2":"YOUR_SPECIFIC_CONDITION","exit_trigger_3":"YOUR_SPECIFIC_CONDITION","risk_1":"YOUR_SPECIFIC_RISK","risk_2":"YOUR_SPECIFIC_RISK","sector_note":"YOUR_SPECIFIC_SENTENCE","analyst_target":YOUR_NUMBER,"data_date":"${dataDate}"}`;

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
          { role: "user", content: userPrompt },
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

    // Always lock real Finnhub price and pre-calculated levels
    parsed.current_price = currentPrice;
    parsed.company = companyName;
    parsed.ticker = ticker;
    parsed.entry_low = parseFloat(entryLow);
    parsed.entry_high = parseFloat(entryHigh);
    parsed.stop_loss = parseFloat(stopLoss);
    parsed.take_profit_1 = parseFloat(tp1);
    parsed.take_profit_2 = parseFloat(tp2);

    console.log("Success:", parsed.ticker, parsed.current_price, parsed.verdict, "Conf:", parsed.confidence, "Prob:", parsed.probability);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ parsed });

  } catch(e) {
    console.log("Error:", e.message);
    return res.status(500).json({ parsed: null, error: e.message });
  }
}
