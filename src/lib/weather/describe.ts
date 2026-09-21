/**
 * Turning the numbers into something a person can act on.
 *
 * This is the point of the tool. "18°C, 72% humidity, 24 km/h WNW" is data;
 * "mild, but the wind makes it feel more like 15° — take a jacket" is an
 * answer. Every function here is pure so the wording can be unit tested,
 * which matters more than usual when the whole value is in the wording.
 *
 * The thresholds are the conventional meteorological ones — Beaufort for
 * wind, the WHO bands for UV, dew point for how muggy it feels — rather than
 * anything invented here.
 */
import type { CurrentWeather, DayPoint, HourPoint, WeatherReport } from "./api";
import { isSnowy, weatherCode } from "./codes";
import { formatClock, formatDuration, formatTemp, formatTempDelta, type Units } from "./units";

/* ---------------------------------- wind ---------------------------------- */

export interface Beaufort {
  force: number;
  name: string;
  /** What you would actually notice at this strength. */
  effect: string;
}

const BEAUFORT: { upTo: number; name: string; effect: string }[] = [
  { upTo: 1, name: "Calm", effect: "the air is completely still" },
  { upTo: 5, name: "Light air", effect: "you would not notice it" },
  { upTo: 11, name: "Light breeze", effect: "you can feel it on your face" },
  { upTo: 19, name: "Gentle breeze", effect: "leaves rustle and hair moves" },
  { upTo: 28, name: "Moderate breeze", effect: "loose paper lifts and small branches move" },
  { upTo: 38, name: "Fresh breeze", effect: "small trees sway and umbrellas get awkward" },
  { upTo: 49, name: "Strong breeze", effect: "umbrellas turn inside out" },
  { upTo: 61, name: "Near gale", effect: "it is hard work walking into it" },
  { upTo: 74, name: "Gale", effect: "twigs snap off trees and walking is difficult" },
  { upTo: 88, name: "Strong gale", effect: "branches come down — take care outside" },
  { upTo: 102, name: "Storm", effect: "trees uproot and there is real damage" },
  { upTo: 117, name: "Violent storm", effect: "widespread damage — stay indoors" },
  { upTo: Infinity, name: "Hurricane force", effect: "stay inside and away from windows" },
];

export function beaufort(kmh: number): Beaufort {
  const index = BEAUFORT.findIndex((step) => kmh < step.upTo);
  const force = index === -1 ? 12 : index;
  const step = BEAUFORT[force];
  return { force, name: step.name, effect: step.effect };
}

const COMPASS = ["north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west"];
const COMPASS_SHORT = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

/** Meteorological convention: the direction the wind comes *from*. */
export function compass(degrees: number): string {
  return COMPASS[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

export function compassShort(degrees: number): string {
  return COMPASS_SHORT[Math.round((((degrees % 360) + 360) % 360) / 45) % 8];
}

/** Gusts only get a mention when they are meaningfully stronger than the wind. */
export function gustNote(wind: number, gusts: number): string | null {
  if (gusts < 25 || gusts < wind * 1.4) return null;
  return `Gusting to ${Math.round(gusts)} km/h, so it will come in sudden shoves.`;
}

/* ------------------------------- how it feels ------------------------------ */

export interface FeelsLike {
  /** Apparent minus actual, in °C. */
  delta: number;
  /** Null when the difference is too small to be worth a sentence. */
  reason: string | null;
}

/**
 * Why it does not feel like the number on the thermometer.
 *
 * Wind strips warmth away; humidity stops sweat evaporating; strong sun on a
 * still day does the opposite. Below about a degree and a half nobody can
 * tell, so nothing is said.
 */
export function feelsLike(current: CurrentWeather, units: Units): FeelsLike {
  const delta = current.apparent - current.temp;
  if (Math.abs(delta) < 1.5) return { delta, reason: null };

  const amount = formatTempDelta(delta, units);
  if (delta < 0) {
    const cause =
      current.wind >= 15
        ? "the wind is taking the warmth straight off you"
        : "the damp air is pulling heat out of you";
    return { delta, reason: `Feels ${amount} colder than it is — ${cause}.` };
  }

  const cause =
    current.humidity >= 70
      ? "the humidity stops sweat evaporating, so your body cannot cool itself"
      : "the sun is strong and there is no wind to move the heat away";
  return { delta, reason: `Feels ${amount} warmer than it is — ${cause}.` };
}

/* ------------------------------ damp and dry ------------------------------ */

export interface Reading {
  word: string;
  note: string;
}

/**
 * How muggy it is.
 *
 * Dew point, not relative humidity, is what people actually feel: 80% at 5°C
 * is crisp, 80% at 28°C is unbearable. The bands are the ones forecasters use.
 */
export function dewPointReading(dewPoint: number): Reading {
  if (dewPoint < 5) return { word: "Very dry", note: "Dry enough for lips and skin to notice." };
  if (dewPoint < 11) return { word: "Dry", note: "Crisp, comfortable air." };
  if (dewPoint < 16) return { word: "Comfortable", note: "About as pleasant as air gets." };
  if (dewPoint < 19) return { word: "Getting sticky", note: "Noticeably humid if you are moving about." };
  if (dewPoint < 22) return { word: "Humid", note: "Sweat will not dry. Hard work outdoors." };
  return { word: "Oppressive", note: "Draining, even standing still. Keep drinking water." };
}

export function humidityReading(humidity: number): Reading {
  if (humidity < 30) return { word: "Dry", note: "Static shocks and dry throats." };
  if (humidity < 60) return { word: "Comfortable", note: "The easy middle." };
  if (humidity < 80) return { word: "Damp", note: "Washing will take its time drying." };
  return { word: "Saturated", note: "The air is holding about as much water as it can." };
}

/* ----------------------------------- sun ---------------------------------- */

export interface UvReading extends Reading {
  band: "low" | "moderate" | "high" | "very high" | "extreme";
  /** Roughly how long untanned fair skin takes to burn, in minutes. */
  burnMinutes: number | null;
}

export function uvReading(uv: number): UvReading {
  const value = Math.max(0, uv);
  if (value < 3) {
    return { band: "low", word: "Low", note: "No protection needed.", burnMinutes: null };
  }
  if (value < 6) {
    return { band: "moderate", word: "Moderate", note: "Fair skin starts to burn in about 30 minutes.", burnMinutes: 30 };
  }
  if (value < 8) {
    return { band: "high", word: "High", note: "Sunscreen and a hat. Fair skin burns in about 20 minutes.", burnMinutes: 20 };
  }
  if (value < 11) {
    return { band: "very high", word: "Very high", note: "Stay in the shade near midday — fair skin burns in about 15 minutes.", burnMinutes: 15 };
  }
  return { band: "extreme", word: "Extreme", note: "Avoid being out at midday. Fair skin burns in about 10 minutes.", burnMinutes: 10 };
}

export function cloudReading(cover: number): Reading {
  if (cover < 12) return { word: "Clear", note: "Open sky." };
  if (cover < 40) return { word: "Mostly clear", note: "A few clouds drifting past." };
  if (cover < 70) return { word: "Part cloudy", note: "Sun in and out." };
  if (cover < 90) return { word: "Cloudy", note: "Mostly covered over." };
  return { word: "Overcast", note: "A solid grey lid." };
}

/* -------------------------------- pressure -------------------------------- */

/**
 * What the barometer is doing.
 *
 * The absolute value says what kind of air is overhead; the three-hour change
 * says what is coming, and that is the half people actually want. A fall of
 * more than about 3 hPa in three hours is the classic sign of a front.
 */
export function pressureReading(current: number, threeHoursAgo: number | null): Reading {
  const base =
    current < 1000
      ? "Low pressure — unsettled, and often wet and windy with it."
      : current > 1020
        ? "High pressure — settled, and usually calm and clear."
        : "Ordinary pressure, near the long-run average.";

  if (threeHoursAgo === null || !Number.isFinite(threeHoursAgo)) {
    return { word: `${Math.round(current)} hPa`, note: base };
  }

  const change = current - threeHoursAgo;
  if (change <= -3) {
    return { word: "Falling fast", note: "A sharp drop in three hours — wind and rain are on the way." };
  }
  if (change <= -1) {
    return { word: "Falling", note: `${base} Slowly dropping, so expect it to turn more unsettled.` };
  }
  if (change >= 3) {
    return { word: "Rising fast", note: "Climbing quickly — the weather is clearing and settling down." };
  }
  if (change >= 1) {
    return { word: "Rising", note: `${base} Slowly climbing, so things should improve.` };
  }
  return { word: "Steady", note: `${base} Barely moving, so expect more of the same.` };
}

/** The pressure three hours before now, when the series reaches back that far. */
export function pressureThreeHoursAgo(report: WeatherReport, currentIndex: number): number | null {
  const earlier = report.hours[currentIndex - 3];
  return earlier && Number.isFinite(earlier.pressure) && earlier.pressure > 0 ? earlier.pressure : null;
}

/* ----------------------------------- rain --------------------------------- */

export interface RainWindow {
  from: HourPoint;
  to: HourPoint;
  peak: HourPoint;
}

/** A run of hours counts as wet once it is more likely than not to rain. */
const WET_PROBABILITY = 40;

/**
 * Groups the coming hours into spells of rain.
 *
 * A forecast of "60% chance today" is nearly useless; "rain from about two
 * until five" is something you can plan around, and that is what this finds.
 */
export function rainWindows(hours: HourPoint[]): RainWindow[] {
  const windows: RainWindow[] = [];
  let run: HourPoint[] = [];

  const close = () => {
    if (!run.length) return;
    const peak = run.reduce((best, h) => (h.precipProbability > best.precipProbability ? h : best), run[0]);
    windows.push({ from: run[0], to: run[run.length - 1], peak });
    run = [];
  };

  for (const hour of hours) {
    if (hour.precipProbability >= WET_PROBABILITY || hour.precip > 0.2) run.push(hour);
    else close();
  }
  close();
  return windows;
}

/**
 * The one line about rain that belongs at the top of the page.
 *
 * Says when it starts and when it stops, because that is the question.
 */
export function rainSentence(hours: HourPoint[], units: Units): string {
  if (!hours.length) return "No hourly detail available.";
  const windows = rainWindows(hours);

  if (!windows.length) {
    const highest = hours.reduce((best, h) => Math.max(best, h.precipProbability), 0);
    if (highest < 15) return "Nothing wet expected for the next day or so.";
    return `Staying dry, most likely — the highest chance in the next ${hours.length} hours is only ${Math.round(highest)}%.`;
  }

  const first = windows[0];
  const startsNow = first.from === hours[0];
  const snow = isSnowy(first.peak.code);
  const what = snow ? "Snow" : "Rain";
  const start = formatClock(first.from.time, units);
  /**
   * A spell that is still going at the last hour we have has no known end,
   * so it does not get given one — quoting the hour after the data runs out
   * would be inventing a time, and reads as nonsense when that hour is
   * midnight.
   */
  const openEnded = first.to === hours[hours.length - 1];
  // A window is inclusive of its last wet hour, so it ends at the top of the next.
  const end = formatClock(addHour(first.to.time), units);

  const spell = startsNow
    ? openEnded
      ? `${what} now, and it does not let up in the next ${hours.length} hours.`
      : `${what} now, easing off around ${end}.`
    : openEnded
      ? `${what} from about ${start}, and still going ${hours.length} hours from now.`
      : `${what} likely from about ${start} until ${end}, heaviest near ${formatClock(first.peak.time, units)}.`;

  if (windows.length === 1) return spell;
  return `${spell} Another spell around ${formatClock(windows[1].from.time, units)}.`;
}

/**
 * The next clock hour, used only for saying when a spell of rain ends.
 *
 * The date is deliberately left alone — nothing reads it, and rolling it
 * over would mean month lengths and leap years for a label that only ever
 * shows the time.
 */
export function addHour(iso: string): string {
  const match = /T(\d{2}):/.exec(iso);
  if (!match) return iso;
  const next = (Number(match[1]) + 1) % 24;
  return `${iso.slice(0, 11)}${String(next).padStart(2, "0")}:00`;
}

/* -------------------------------- daylight -------------------------------- */

/**
 * How much of the day is left, which is the bit of sunrise/sunset anyone
 * actually uses.
 */
export function daylightSentence(day: DayPoint, nowIso: string, units: Units): string {
  const now = minutesOfDay(nowIso);
  const up = minutesOfDay(day.sunrise);
  const down = minutesOfDay(day.sunset);
  if (now === null || up === null || down === null) return "";

  const total = formatDuration(day.daylightSeconds / 60);

  if (now < up) {
    return `Still dark. The sun comes up at ${formatClock(day.sunrise, units)}, giving ${total} of daylight.`;
  }
  if (now >= down) {
    return `The sun set at ${formatClock(day.sunset, units)}. It rises again tomorrow morning.`;
  }
  const left = formatDuration(down - now);
  return `${left} of daylight left — the sun sets at ${formatClock(day.sunset, units)}.`;
}

/**
 * Minutes past midnight for a wall-clock stamp, or null if unreadable.
 *
 * The shape is matched rather than sliced and coerced: `Number("")` is 0,
 * not NaN, so a missing sunrise would otherwise read as midnight and the
 * page would confidently tell you the sun had already been up for hours.
 */
export function minutesOfDay(iso: string): number | null {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/* ----------------------------- against yesterday --------------------------- */

/** The same hour of the clock, one day back. */
export function sameHourYesterday(report: WeatherReport, currentIndex: number): HourPoint | undefined {
  return report.hours[currentIndex - 24];
}

/**
 * The comparison people make without being asked: is it colder than
 * yesterday? Under a degree and a half is not worth saying.
 */
export function yesterdaySentence(
  current: CurrentWeather,
  sameHour: HourPoint | undefined,
  units: Units,
): string | null {
  if (!sameHour) return null;
  const delta = current.temp - sameHour.temp;
  if (Math.abs(delta) < 1.5) return "About the same as this time yesterday.";
  const amount = formatTempDelta(delta, units);
  return `${amount} ${delta > 0 ? "warmer" : "colder"} than this time yesterday.`;
}

/* ------------------------------- what to wear ------------------------------ */

/**
 * The advice, in the order it matters.
 *
 * Driven by the apparent temperature rather than the real one, because that
 * is the number your body is responding to.
 */
export function whatToWear(
  current: CurrentWeather,
  hoursAhead: HourPoint[],
  uvMaxToday: number,
): string[] {
  const advice: string[] = [];
  const feels = current.apparent;

  if (feels < -5) advice.push("Serious winter coat, hat and gloves — exposed skin will hurt.");
  else if (feels < 3) advice.push("Winter coat, and gloves if you will be out a while.");
  else if (feels < 10) advice.push("A proper coat.");
  else if (feels < 16) advice.push("A jacket or a thick jumper.");
  else if (feels < 22) advice.push("Long sleeves are about right.");
  else if (feels < 28) advice.push("T-shirt weather.");
  else advice.push("Lightest clothes you own, and drink more water than you think you need.");

  const wetSoon = hoursAhead.slice(0, 12).some((h) => h.precipProbability >= 50 || h.precip > 0.2);
  const windy = current.wind >= 35 || hoursAhead.slice(0, 12).some((h) => h.wind >= 40);

  if (wetSoon) {
    advice.push(
      windy
        ? "Rain and wind together — a hooded coat will do better than an umbrella."
        : "Take an umbrella; there is rain in the next few hours.",
    );
  } else if (windy) {
    advice.push("It is windy enough to be worth a windproof layer.");
  }

  if (isSnowy(current.code) || current.temp <= 1) {
    advice.push("Watch your footing — it is cold enough for ice.");
  }

  if (uvMaxToday >= 6 && current.isDay) {
    advice.push("Sunscreen if you are out around midday; the sun is strong enough to burn.");
  }

  const swing = hoursAhead.slice(0, 12);
  if (swing.length) {
    const low = Math.min(...swing.map((h) => h.apparent));
    if (feels - low >= 7) {
      advice.push("It drops a lot later — take a layer you can put back on.");
    }
  }

  return advice;
}

/* -------------------------------- the headline ----------------------------- */

/**
 * One sentence that answers "what is it like out?" before anything else on
 * the page is read.
 */
export function headline(current: CurrentWeather, placeName: string, units: Units): string {
  const sky = weatherCode(current.code);
  const temp = formatTemp(current.temp, units, true);
  const where = placeName ? ` in ${placeName}` : "";
  const delta = current.apparent - current.temp;

  if (Math.abs(delta) >= 1.5) {
    return `${sky.label} and ${temp}${where}, though it feels more like ${formatTemp(current.apparent, units, true)}.`;
  }
  return `${sky.label} and ${temp}${where}.`;
}

/** A short warning strip, shown only when the weather is genuinely notable. */
export function warnings(current: CurrentWeather, today: DayPoint | undefined): string[] {
  const out: string[] = [];
  const sky = weatherCode(current.code);

  if (sky.severity >= 3) out.push(sky.sentence);
  if (current.gusts >= 60) out.push(`Gusts up to ${Math.round(current.gusts)} km/h — secure anything loose outside.`);
  if (today && today.uvMax >= 8) out.push(`UV reaches ${Math.round(today.uvMax)} today, which burns fair skin in about 15 minutes.`);
  if (current.apparent <= -10) out.push("Cold enough for frostbite on exposed skin within half an hour.");
  if (current.apparent >= 35) out.push("Heat this high is dangerous for anyone working or exercising outdoors.");

  return out;
}
