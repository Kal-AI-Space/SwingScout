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

    // Pre-calculate all price levels in JS — never let Groq touch these
    const entryLow = parseFloat((currentPrice * 0.98).toFixed(2));
    const entryHigh = parseFloat((currentPrice * 1.005).toFixed(2));
    const stopLoss = parseFloat((currentPrice * 0.935).toFixed(2));
    const tp1 = parseFloat((currentPrice * 1.055).toFixed(2));
    const tp2 = parseFloat((currentPrice * 1.11).toFixed(2));
    const maxLossPct = parseFloat(((currentPrice - stopLoss) / currentPrice * 100).toFixed(1));
    const tp1GainPct = parseFloat(((tp1 - currentPrice) / currentPrice * 100).toFixed(1));
    const tp2GainPct = parseFloat(((tp2 - currentPrice) / currentPrice * 100).toFixed(1));
    const rr = (tp1GainPct / maxLossPct).toFixed(1);

    const systemPrompt = `You are an elite swing trader analyst for US equities. Your client:
- Buys quality stocks on confirmed pullbacks, holds 1–4 weeks
- Cash only, no leverage, hard 7% stop loss on ALL positions
- Targets 3–8% gains, account size $5,000–7,000 USD
- Prefers Mag 7, semiconductors, AI software
- Never meme stocks or FOMO buys

Be specific and opinionated. Reference actual news headlines in your reasoning. Never use generic filler text.`;

    const userPrompt = `Analyse ${ticker} (${companyName}) for a swing trade. Today is ${today}.

LIVE DATA:
Price: $${currentPrice} | High: $${highDay} | Low: $${lowDay} | Prev Close: $${prevClose} | Change: ${changePercent}%
Market Cap: ${marketCap} | Industry: ${industry}

NEWS LAST 7 DAYS:
${recentHeadlines}

Answer these questions with a SINGLE short answer each. Be decisive and specific:

Q1. VERDICT: Should we BUY NOW, WAIT FOR DIP, or AVOID? (pick one)
Q2. CONFIDENCE: Rate your confidence in this setup 0-100. Consider: strong news=higher, weak setup=lower, uncertain macro=lower.
Q3. PROBABILITY: What is the realistic probability of hitting TP1? 0-100. Be honest, not optimistic.
Q4. HOLD_MIN: Minimum days to hold based on the catalyst. Integer only.
Q5. HOLD_MAX: Maximum days to hold. Integer only.
Q6. CATALYST: One specific sentence — the #1 reason to enter RIGHT NOW. Must reference a specific news headline above.
Q7. TIMING: One specific sentence — why is TODAY the right entry day based on price action?
Q8. EARNINGS_DATE: Next earnings date in format DD MMM YYYY. If unknown say Unknown.
Q9. EARNINGS_RISK: Rate earnings risk as HIGH, MEDIUM, LOW, or NONE.
Q10. EXIT1: Specific exit condition with a price level e.g. "Close below $X for two consecutive days"
Q11. EXIT2: Second specific exit condition with price reference.
Q12. EXIT3: Third specific exit condition.
Q13. RISK1: The #1 specific risk that could kill this trade right now.
Q14. RISK2: Second specific risk.
Q15. SECTOR: One sentence on current ${industry} sector conditions.
Q16. ANALYST_TARGET: Your best estimate of Wall St 12-month consensus target price. Number only.

Then return ONLY this JSON using your answers above — no markdown, no explanation:
{"ticker":"${ticker}","company":"${companyName}","current_price":${currentPrice},"verdict":"A1","entry_low":${entryLow},"entry_high":${entryHigh},"stop_loss":${stopLoss},"take_profit_1":${tp1},"take_profit_2":${tp2},"risk_reward":"${rr}:1","max_loss_pct":${maxLossPct},"tp1_gain_pct":${tp1GainPct},"tp2_gain_pct":${tp2GainPct},"confidence":A2,"probability":A3,"hold_min_days":A4,"hold_max_days":A5,"primary_catalyst":"A6","timing":"A7","earnings_date":"A8","earnings_risk":"A9","exit_trigger_1":"A10","exit_trigger_2":"A11","exit_trigger_3":"A12","risk_1":"A13","risk_2":"A14","sector_note":"A15","analyst_target":A16,"data_date":"${dataDate}"}`;

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
        temperature: 0.4,
        max_tokens: 2000,
      }),
    });

    const groqData = await groqRes.json();
    const raw = groqData?.choices?.[0]?.message?.content || "";
    console.log("Groq raw:", raw.slice(0, 800));

    const clean = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return res.status(200).json({ parsed: null, error: "No JSON found", raw: clean.slice(0, 300) });

    const parsed = JSON.parse(match[0]);

    // Hard lock all price levels — Groq cannot change these
    parsed.current_price = currentPrice;
    parsed.company = companyName;
    parsed.ticker = ticker;
    parsed.entry_low = entryLow;
    parsed.entry_high = entryHigh;
    parsed.stop_loss = stopLoss;
    parsed.take_profit_1 = tp1;
    parsed.take_profit_2 = tp2;
    parsed.max_loss_pct = maxLossPct;
    parsed.tp1_gain_pct = tp1GainPct;
    parsed.tp2_gain_pct = tp2GainPct;
    parsed.risk_reward = `${rr}:1`;

    console.log("Success:", parsed.ticker, parsed.current_price, parsed.verdict, "Conf:", parsed.confidence, "Prob:", parsed.probability, "Hold:", parsed.hold_min_days, "-", parsed.hold_max_days);
    res.setHeader("Access-Control-Allow-Origin", "*");
    return res.status(200).json({ parsed });

  } catch(e) {
    console.log("Error:", e.message);
    return res.status(500).json({ parsed: null, error: e.message });
  }
}
