import type { Tool } from "../types";

/**
 * Learning tools. Interactive things worth spending ten minutes inside.
 */
export const LEARN_TOOLS: Tool[] = [
  {
    id: "earth-globe",
    name: "3D Earth Globe",
    short: "Spin a real globe and learn where every country is.",
    long: "A genuine 3D globe you can drag, spin and zoom, with all 250 countries and territories. Click any country for its flag, capital, region, area, languages, currency and land neighbours — then hop straight to a neighbour. There is a quiz mode when you want to test yourself rather than browse.",
    category: "learn",
    route: "/tools/earth-globe",
    keywords: ["3d globe", "interactive world map", "country map", "world globe online", "learn countries", "geography quiz", "where is country"],
    aliases: ["world globe", "interactive globe", "country finder map", "geography game"],
    icon: "🌍",
    accent: "sky",
    browserOnly: true,
    aiInvocable: false,
    input: "none",
    output: "none",
    related: ["digital-clock", "memory-test", "reaction-test", "typing-test"],
    seoTitle: "3D Earth Globe — Interactive World Map & Country Quiz | DO101",
    seoDescription: "Spin an interactive 3D globe, click any country and see its flag, capital, area, languages and neighbours. Includes a geography quiz. Free, no sign-up.",
    steps: [
      "Drag the globe to spin it, and scroll to zoom in.",
      "Click any country to see its details on the right.",
      "Press “Quiz me” to be given a country to find.",
    ],
    features: [
      "A true orthographic projection — a sphere, not a flat map",
      "All 250 countries and territories, coloured by region",
      "Flag, capital, region, area, languages, currency and ISO codes",
      "Jump straight to any land neighbour",
      "Search by country name, capital or ISO code",
      "Quiz mode that asks you to find a country",
      "Full country list underneath for keyboard and screen-reader use",
      "Runs entirely in your browser and works offline once loaded",
    ],
    faqs: [
      {
        q: "Is this a real 3D globe or a picture?",
        a: "It is a real orthographic projection rendered live to a canvas — the same maths a physical globe obeys. Countries are actual polygon shapes, so what you see at the edge is genuinely foreshortened by the curve rather than a flat image faked with shading.",
      },
      {
        q: "Where does the country information come from?",
        a: "Outlines come from world-atlas, built on Natural Earth data, which is public domain. The facts come from the mledoze/countries dataset under the Open Database Licence, credited at the bottom of the page. Borders and names follow those datasets — they are not a political statement by DO101.",
      },
      {
        q: "Why is there no population figure?",
        a: "The dataset DO101 uses does not include population, and inventing a number would be worse than leaving it out. Area, capital, languages, currency and neighbours all come straight from the data.",
      },
      {
        q: "Can I use it with a keyboard?",
        a: "Yes. Every country is listed underneath the globe, and selecting one there spins the globe to it — the same as clicking it on the sphere.",
      },
      {
        q: "Does it work offline?",
        a: "Yes, once the page has loaded. The map and country data are fetched once and cached by your browser.",
      },
    ],
    featured: true,
  },
  {
    id: "station-alarm",
    name: "Train Station Alarm",
    short: "Sleep on the train and get woken before your stop.",
    long: "Pick your destination, put the phone down, and the alarm wakes you with vibration and sound as you come within range. It runs on GPS alone once armed, so it keeps working in a tunnel or anywhere the signal drops. Built for the very real problem of falling asleep on a Japanese train and waking up three stations too late.",
    category: "travel",
    route: "/tools/station-alarm",
    keywords: ["train station alarm", "wake me up before my stop", "gps alarm", "location alarm", "commute alarm", "train sleep alarm", "station reminder"],
    aliases: ["wake me at my station", "gps location alarm", "commuter alarm", "train alarm"],
    icon: "🚉",
    accent: "fire",
    browserOnly: true,
    aiInvocable: false,
    input: "none",
    output: "none",
    related: ["weather", "digital-clock", "earth-globe", "timestamp-converter", "reaction-test"],
    seoTitle: "Train Station Alarm — GPS Wake-Up Before Your Stop | DO101",
    seoDescription: "Set a GPS alarm that vibrates and rings before your train station. Works offline once armed, no app to install, no account. Free in your browser.",
    steps: [
      "Search for your destination station, or tap it on the map.",
      "Choose how far out you want waking — 800 m is a good default.",
      "Press start, keep the tab open with the screen on, and relax.",
    ],
    features: [
      "Vibration, a loud repeating chime and a full-screen alert together",
      "Works on GPS alone once armed — no signal needed",
      "Live distance, speed, arrival estimate and direction",
      "Adjustable radius from 300 m to 3 km",
      "Warns you when the GPS fix is too poor to trust",
      "Saves your usual stations on the device",
      "No app to install and no account",
    ],
    faqs: [
      {
        q: "Does it work if I lose signal in a tunnel?",
        a: "Yes. Once you have pressed start, the alarm uses your device's GPS, which does not need a network. The map tiles will not load underground, but the distance countdown and the alarm keep working.",
      },
      {
        q: "Can I lock my phone or switch apps?",
        a: "No, and this is the one real limitation. Browsers pause tabs that go to the background, which would stop the alarm. Keep this page open and in front with the screen on — the tool asks for a screen wake lock to help, and warns you if the browser refuses.",
      },
      {
        q: "Will it vibrate on an iPhone?",
        a: "No. Safari on iOS does not give web pages access to the vibration motor — that is Apple's decision, not a bug here. On an iPhone the alarm uses sound and a full-screen alert instead, so turn your volume up.",
      },
      {
        q: "How accurate is it?",
        a: "GPS is typically accurate to 5–20 m outdoors and much worse between tall buildings or underground. The tool shows the accuracy it is getting and warns you when it exceeds 100 m — in that case choose a larger radius so a drifting fix cannot make you miss your stop.",
      },
      {
        q: "What radius should I choose?",
        a: "800 m is a sensible default for a city train. On a fast intercity service pick 2 or 3 km, which gives you roughly a minute to wake up and gather your things.",
      },
      {
        q: "Is my location sent anywhere?",
        a: "No. Your position is read by the page and never leaves the device. Station search does contact OpenStreetMap's geocoder when you type a name, but the alarm itself makes no network requests at all.",
      },
      {
        q: "Does it cost anything?",
        a: "No. There is no account, no subscription and no app to install.",
      },
    ],
    featured: true,
  },
  {
    id: "weather",
    name: "Weather",
    short: "What it is like outside right now, explained in plain English.",
    long:
      "A weather page that answers the question instead of handing you a table of numbers. It finds where you are, then tells you what it is actually like out — whether it feels colder than the thermometer says and why, when the rain starts and stops, whether you need a coat, an umbrella or sunscreen. Every reading comes with what it means: wind as what you would notice, humidity as how muggy it feels, pressure as what is coming next. Twenty-four hours ahead by the hour and a week beyond that. No account, no app, and your location never touches a DO101 server.",
    category: "travel",
    route: "/tools/weather",
    keywords: [
      "weather", "weather today", "weather near me", "current weather", "local weather",
      "hourly forecast", "weather forecast", "is it going to rain", "do i need a coat",
      "feels like temperature", "uv index today", "wind speed", "7 day forecast",
      "weather my location", "rain radar alternative", "free weather app",
    ],
    aliases: [
      "check weather", "do weather", "whats the weather", "what is the weather",
      "weather app", "forecast", "temperature outside", "will it rain today",
      "weather where i am", "how cold is it",
    ],
    icon: "🌤",
    accent: "sky",
    browserOnly: true,
    aiInvocable: false,
    input: "none",
    output: "none",
    related: ["station-alarm", "earth-globe", "digital-clock", "calendar"],
    seoTitle: "Weather Near Me — Plain-English Forecast, No Sign-Up | DO101",
    seoDescription:
      "Current weather for wherever you are, explained: what it feels like and why, when rain starts and stops, and whether you need a coat. Hourly and 7-day. Free, no account.",
    steps: [
      "Press Use my location, or search for any town or city in the world.",
      "Read the one-line answer at the top, then the coat-and-umbrella advice under it.",
      "Scroll the hourly strip to see when rain arrives and when it clears.",
      "Check “what the numbers mean” for wind, UV, humidity and pressure in plain words.",
      "Switch between °C and °F, and the 24-hour and 12-hour clock, at the top right.",
    ],
    features: [
      "One sentence at the top that answers “what is it like out?”",
      "Explains why it feels warmer or colder than the thermometer says",
      "Tells you when rain starts and stops, not just a daily percentage",
      "Coat, umbrella and sunscreen advice from the temperature your body feels",
      "Wind described as what you would actually notice, on the Beaufort scale",
      "UV with how long fair skin takes to burn, humidity as how muggy it feels",
      "Pressure read as a three-hour trend — what is coming, not just what it is",
      "Compares right now with the same time yesterday",
      "Hourly temperature and rain chance for 24 hours, plus a 7-day outlook",
      "Sunrise, sunset and how much daylight is left today",
      "Warnings for gales, extreme UV, dangerous heat and hard frost",
      "°C or °F and a 24 or 12-hour clock, remembered on your device",
      "Your location goes straight to the forecast service — never to DO101",
    ],
    faqs: [
      {
        q: "Does it know where I am automatically?",
        a: "Only if you press Use my location and allow it. Nothing asks your browser for a position until you do, so opening the page will not throw a permission prompt at you. If you would rather not share it, search for your town instead — the forecast is identical.",
      },
      {
        q: "Where does my location go?",
        a: "From your browser straight to Open-Meteo, who return the forecast, and to OpenStreetMap to turn the coordinates into a town name. It never passes through a DO101 server, because there isn't one — the whole page runs in your browser. The coordinates are also rounded before being sent, since a forecast is the same across a whole town.",
      },
      {
        q: "Where does the forecast come from?",
        a: "Open-Meteo, which combines the open data published by national weather services — the same national models that sit behind most weather apps. It is free for non-commercial use and needs no account, which is what lets this tool stay free with nothing to sign up for.",
      },
      {
        q: "Why does it say it feels colder than the temperature?",
        a: "Because it usually does. Wind strips warmth off your skin faster than still air, and damp air conducts heat away from you, so 8°C in a stiff breeze feels more like 4°C. In hot weather it works the other way: high humidity stops sweat evaporating, so your body cannot cool itself and 30°C feels like 34°C. The page tells you which of the two is happening.",
      },
      {
        q: "How accurate is it?",
        a: "The next few hours are usually very good, tomorrow is good, and the far end of the week is a rough steer rather than a promise. That is true of every forecast, not just this one. Rain timing is the hardest part — a shower that arrives half an hour late is normal, so treat the rain window as roughly when rather than exactly when.",
      },
      {
        q: "What does the UV number mean?",
        a: "It is how strong the sun's burning radiation is, on an open-ended scale where anything under 3 is harmless and 8 or more will burn fair, untanned skin in about a quarter of an hour. The page gives you the rough burn time rather than making you look the band up.",
      },
      {
        q: "Why show pressure as rising or falling?",
        a: "Because the direction tells you more than the number. A drop of more than about 3 hPa in three hours is the classic sign of a front coming through, which usually means wind and rain within a few hours. Steady high pressure means tomorrow will probably look like today.",
      },
      {
        q: "Can I use it for somewhere I am travelling to?",
        a: "Yes — search for the place and it is remembered in the Recent row, so you can flip between home and where you are going. All times shown are local to the place you are looking at, not to you.",
      },
      {
        q: "Does it work offline?",
        a: "No. A forecast has to be fetched, so it needs a connection. What it does keep on your device is your chosen place, your recent places and your °C/°F preference, so it comes straight back up when you return.",
      },
    ],
  },
  {
    id: "trading-analyzer",
    name: "TradeLens — Forex & Gold Strategy Analyzer",
    short: "Test a gold or forex strategy against real history before you risk a penny on it.",
    long:
      "A free analysis laboratory for XAU/USD and the major forex pairs. Load real price history — from your own MetaTrader 5 terminal, a free public source or a CSV you exported yourself — and get a candlestick chart with EMAs, RSI, MACD, Bollinger Bands, ATR, market structure and support and resistance. A transparent rule engine reads the chart and tells you exactly why it says buy, sell or neutral, rule by rule, with the conditions that would invalidate it. Then backtest those rules with realistic spread and commission, judge them on a period the tuning never saw, size positions from your own risk limit, and paper-trade the whole thing with virtual money. Everything runs in your browser. It is an education and research tool, not a prediction service, and it cannot place a real order.",
    category: "learn",
    route: "/tools/trading-analyzer",
    keywords: [
      "forex backtesting", "gold trading strategy", "xauusd analysis", "free backtesting software",
      "forex strategy tester", "gold signals", "xauusd backtest", "metatrader 5 python",
      "mt5 xauusd data", "forex position size calculator", "lot size calculator gold",
      "paper trading simulator", "forex risk calculator", "trading strategy optimiser",
      "rsi macd strategy", "support resistance indicator", "free trading journal",
      "xauusd strategy backtest", "forex demo without broker", "gold pip calculator",
    ],
    aliases: [
      "tradelens", "forex analyzer", "gold analyzer", "backtest a strategy", "test my trading strategy",
      "xauusd tool", "gold trading tool", "forex backtest", "paper trade forex", "position size calculator",
    ],
    icon: "🥇",
    accent: "sun",
    browserOnly: true,
    aiInvocable: false,
    input: "none",
    output: "none",
    related: ["position-size", "pip-value", "currency-converter", "compound-interest"],
    seoTitle: "Free Forex & Gold Strategy Backtester — XAUUSD Analysis | DO101",
    seoDescription:
      "Backtest gold and forex strategies free in your browser. Candlestick charts, RSI, MACD, transparent buy and sell rules, risk calculator and paper trading. No account.",
    steps: [
      "Pick a data source: your own MetaTrader 5 terminal, a free public source, or a CSV you exported.",
      "Choose a symbol and timeframe, and load the chart.",
      "Read the signal panel — every rule that voted, why it voted, and what would invalidate it.",
      "Adjust the rules and their weights, or start from one of the gold presets.",
      "Backtest with realistic spread and commission, and compare the tuned period against the held-back one.",
      "Size a position from your own risk limit in the risk calculator, then paper-trade it with virtual money.",
    ],
    features: [
      "Built around XAU/USD: gold contract sizing, session ranges and gold-specific presets",
      "Reads your own broker's gold bars from MetaTrader 5, free, with a local bridge script",
      "Works with no API key at all, and with a CSV file when you would rather not fetch anything",
      "Candlestick chart with zoom, pan, volume, EMA, SMA, RSI, MACD, Bollinger Bands and ATR",
      "Support and resistance as clustered zones from confirmed swing pivots, not single lines",
      "Buy, sell or neutral with a score that is stated as rule agreement, never a win probability",
      "Two strategy engines: weighted voting rules, and Deep Smart Money — filters that must all pass before an order-block, EMA-cross, box-breakout or stop-hunt trigger counts",
      "Every signal lists the rules for it, the rules against it and what would invalidate it",
      "Backtesting with spread, commission and slippage, and next-bar fills to prevent look-ahead",
      "Win rate, profit factor, expectancy in R, drawdown, streaks, Sharpe-like score and equity curve",
      "Separate tuning and held-back periods, with overfitting checks on every parameter search",
      "Risk calculator with position size, pip value, reward-to-risk and what your leverage really means",
      "Paper trading with virtual balance, stops, targets, trade history and a performance dashboard",
      "Runs entirely in your browser — no account, no upload, and no way to place a real order",
    ],
    faqs: [
      {
        q: "What is the Deep Smart Money strategy?",
        a: "A port of a popular Pine Script built on smart-money ideas. Unlike the weighted engine, nothing votes: six filters must all pass — price on the right side of the 200-period average, the fast average on the right side of the slow one, volume above its average, a strong candle, RSI on the right side of 50, and a cooldown since the last signal. Only then can one of four triggers fire: a reclaimed order block after a break of structure, an EMA crossover, a breakout from a tight box, or a stop-loss hunt where price sweeps a swing level and closes back. It sets its own stop at the signal bar's extreme and its target as a multiple of that. The top half of the original script was not available, so the conditions it defined are rebuilt from their conventional meanings — each is a named, adjustable setting, and the signal panel shows exactly which ones passed on every bar.",
      },
      {
        q: "Can I paste in my own Pine Script?",
        a: "Not directly — there is no Pine interpreter in the page, and Pine's execution model differs from a browser backtest in ways that change results, such as when a bar's values are final. What you can do is rebuild the rules with the weighted engine's settings, or ask for a script to be ported the way Deep Smart Money was. Either way the backtest applies the same next-bar fills, costs and held-back period to it, so the comparison with your TradingView numbers is fair — and where the two disagree, the disagreement is usually informative.",
      },
      {
        q: "Is this financial advice, or a signal service?",
        a: "Neither. This is not financial advice, it is not personal to you, and it is not a recommendation to buy or sell anything — it is a laboratory for testing ideas. Every buy or sell here is the arithmetic output of rules you can read and change, applied to past prices — it knows nothing about you, your circumstances or the future, and it can be wrong. Treat a signal as a prompt to look at the chart yourself, not as an instruction.",
      },
      {
        q: "What does the confidence score mean?",
        a: "It is how strongly the rules you switched on agree with each other, as a percentage of the total weight you gave them. A score of 72 means rules worth 72% of the weight point the same way. It is not a probability of the trade winning, and nothing in the tool could calculate that honestly — which is why it is never described that way.",
      },
      {
        q: "Can I use my own MetaTrader 5 gold data?",
        a: "Yes, and it is the most accurate option. MetaTrader publishes a free Python package that reads history out of a running MT5 terminal. Because that connection is local to your machine, no web page can call it directly, so the Gold desk tab gives you a small bridge script to run next to MetaTrader. It serves your broker's own XAUUSD candles — with their contract size, digits and live spread — to this page on 127.0.0.1 and nowhere else. The script is read-only: it cannot place an order and never touches your balance or positions. There is also a CSV mode if you would rather not run a server at all.",
      },
      {
        q: "Does more accurate data make the strategy more accurate?",
        a: "It makes the test honest, which is not the same thing. Your broker's real bars, spread and contract size mean a backtest is measuring the strategy rather than an approximation of the market. A rule set that loses money on accurate gold data is telling you the truth sooner. No data source, and no combination of indicators, can make a strategy reliable enough to trust blindly.",
      },
      {
        q: "Where does the price data come from, and is it really free?",
        a: "Four sources, all free. Your own MetaTrader 5 terminal through the local bridge; a public exchange endpoint that needs no key, whose gold instruments are tokens backed one-to-one by physical gold and therefore a proxy rather than XAU/USD; the European Central Bank's daily reference rates for forex; and optionally Twelve Data or Alpha Vantage using a free key you obtain yourself. Your key is stored in your browser and sent straight to that provider — never to DO101, and no key is built into this page.",
      },
      {
        q: "How does the backtester avoid flattering itself?",
        a: "Signals are read at a bar's close and filled at the next bar's open, never at the price that produced them. When a single bar contains both the stop and the target, the stop is taken, because the order they happened in is unknowable. Gaps fill at the open rather than at the level. Every trade pays the spread and any commission you set. Trading is blocked until the indicators have warmed up. And if your data has closing prices only, the engine says so and refuses to pretend it can test an intrabar stop.",
      },
      {
        q: "What is the held-back period for?",
        a: "Any search over enough parameter combinations will find something that worked on the data it searched — that is what searching does. So the tool splits your history: parameters are chosen on the first part, and then reported on a later part the search never looked at. It also shows the rank agreement between the two halves and whether the winning settings sit on a plateau or an isolated spike. If the held-back result collapses, the settings described the past rather than the market.",
      },
      {
        q: "What leverage should I use?",
        a: "That is not a question this tool will answer, because the honest answer depends on your account, your broker's margin rules and a tolerance for loss a web page cannot know. Leverage is treated here as a ceiling you set: it never increases what a stop costs you, but it caps how large a position you may hold, and the risk panel shows the margin it ties up and how far the market would have to move to wipe the account out. Higher leverage lets you take positions that a small adverse move can end.",
      },
      {
        q: "Can it place trades for me?",
        a: "No. There is no broker connection and no order endpoint in this application, and the MetaTrader bridge deliberately calls only the three read-only functions it needs for price history. The paper account is a number and a list in your browser's storage. Nothing here can move real money.",
      },
      {
        q: "What CSV format does it accept?",
        a: "Date, open, high, low, close and optionally volume, with or without a header row — MetaTrader's date-and-time export, TradingView, Dukascopy and ordinary spreadsheet saves all work. It detects the delimiter, works out which way round ambiguous dates are and tells you what it assumed, infers the timeframe from the gaps between bars, collapses duplicate timestamps and widens any bar whose high or low does not contain its own open and close. A close-only file is accepted and clearly flagged.",
      },
      {
        q: "Is my data uploaded anywhere?",
        a: "No. CSV files are read in the page, settings and the paper account live in this browser's local storage, and every calculation — indicators, backtests, the parameter search — runs on your own device. The only network requests are the price fetches themselves, which go straight from your browser to whichever source you picked.",
      },
      {
        q: "Why does it sometimes say NEUTRAL when the chart looks obvious?",
        a: "Because the rules disagree, or because a filter you set has cut in: agreement below your minimum score, an ADX reading saying the market is directionless, volatility at double its recent normal, or a higher-timeframe trend pointing the other way while you have asked for agreement. The cautions listed under the verdict always say which of these it was.",
      },
    ],
  },
];
