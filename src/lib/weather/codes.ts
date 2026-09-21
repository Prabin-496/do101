/**
 * WMO weather codes in plain English.
 *
 * Open-Meteo reports the weather as a WMO 4677 code, which is a number
 * between 0 and 99 and means nothing to anybody. Every code gets three
 * things here: a short label for a heading, an icon, and a sentence that says
 * what it is actually like to stand outside in it — which is the whole point
 * of this tool.
 */

export interface WeatherCode {
  /** Two or three words, for a heading. */
  label: string;
  /** What it is like to be out in it. */
  sentence: string;
  /** Emoji for daytime, and for after dark where it differs. */
  icon: string;
  nightIcon?: string;
  /** Groups that the advice and the styling key off. */
  group: "clear" | "cloud" | "fog" | "drizzle" | "rain" | "snow" | "storm";
  /** Roughly how much it is doing, 0 calm to 3 severe. Drives the warnings. */
  severity: 0 | 1 | 2 | 3;
}

const CODES: Record<number, WeatherCode> = {
  0: { label: "Clear", sentence: "Not a cloud in the sky.", icon: "☀️", nightIcon: "🌙", group: "clear", severity: 0 },
  1: { label: "Mostly clear", sentence: "Bright, with the odd bit of cloud.", icon: "🌤", nightIcon: "🌙", group: "clear", severity: 0 },
  2: { label: "Partly cloudy", sentence: "A mix of sun and cloud.", icon: "⛅", nightIcon: "☁️", group: "cloud", severity: 0 },
  3: { label: "Overcast", sentence: "Grey and completely clouded over.", icon: "☁️", group: "cloud", severity: 0 },

  45: { label: "Fog", sentence: "Thick fog — you will not see far at all.", icon: "🌫", group: "fog", severity: 2 },
  48: { label: "Freezing fog", sentence: "Fog that freezes on contact, so surfaces turn icy.", icon: "🌫", group: "fog", severity: 3 },

  51: { label: "Light drizzle", sentence: "A fine drizzle — barely enough to bother with a hood.", icon: "🌦", group: "drizzle", severity: 1 },
  53: { label: "Drizzle", sentence: "Steady drizzle. You will be damp after ten minutes.", icon: "🌦", group: "drizzle", severity: 1 },
  55: { label: "Heavy drizzle", sentence: "Dense drizzle that soaks you slowly but thoroughly.", icon: "🌧", group: "drizzle", severity: 2 },
  56: { label: "Freezing drizzle", sentence: "Drizzle that freezes where it lands. Pavements get slippery.", icon: "🌧", group: "drizzle", severity: 3 },
  57: { label: "Freezing drizzle", sentence: "Heavy freezing drizzle — ice forming on every surface.", icon: "🌧", group: "drizzle", severity: 3 },

  61: { label: "Light rain", sentence: "Light rain. An umbrella is optional but nice.", icon: "🌦", group: "rain", severity: 1 },
  63: { label: "Rain", sentence: "Proper rain. Take a coat or an umbrella.", icon: "🌧", group: "rain", severity: 2 },
  65: { label: "Heavy rain", sentence: "Heavy rain — you will get soaked without one.", icon: "🌧", group: "rain", severity: 3 },
  66: { label: "Freezing rain", sentence: "Rain freezing on contact. Roads and paths turn to ice.", icon: "🌧", group: "rain", severity: 3 },
  67: { label: "Freezing rain", sentence: "Heavy freezing rain — genuinely dangerous underfoot.", icon: "🌧", group: "rain", severity: 3 },

  71: { label: "Light snow", sentence: "Light snow falling. Pretty, and not settling much.", icon: "🌨", group: "snow", severity: 1 },
  73: { label: "Snow", sentence: "Snow coming down steadily and starting to settle.", icon: "🌨", group: "snow", severity: 2 },
  75: { label: "Heavy snow", sentence: "Heavy snow. Expect it to settle fast and slow everything down.", icon: "❄️", group: "snow", severity: 3 },
  77: { label: "Snow grains", sentence: "Tiny grains of snow, more gritty than fluffy.", icon: "🌨", group: "snow", severity: 1 },

  80: { label: "Light showers", sentence: "Passing showers — wet one minute, bright the next.", icon: "🌦", group: "rain", severity: 1 },
  81: { label: "Showers", sentence: "Showers coming through, some of them heavy.", icon: "🌧", group: "rain", severity: 2 },
  82: { label: "Violent showers", sentence: "Torrential downpours. Wait them out if you can.", icon: "⛈", group: "rain", severity: 3 },

  85: { label: "Snow showers", sentence: "Bursts of snow coming through.", icon: "🌨", group: "snow", severity: 2 },
  86: { label: "Heavy snow showers", sentence: "Heavy bursts of snow, settling quickly.", icon: "❄️", group: "snow", severity: 3 },

  95: { label: "Thunderstorm", sentence: "A thunderstorm. Get indoors if you hear it close.", icon: "⛈", group: "storm", severity: 3 },
  96: { label: "Storm with hail", sentence: "Thunderstorm with hail. Keep off the road if you can.", icon: "⛈", group: "storm", severity: 3 },
  99: { label: "Storm with heavy hail", sentence: "Severe thunderstorm with large hail. Stay inside.", icon: "⛈", group: "storm", severity: 3 },
};

const UNKNOWN: WeatherCode = {
  label: "Unclear",
  sentence: "The forecast came back with a code nobody recognises.",
  icon: "❓",
  group: "cloud",
  severity: 0,
};

export function weatherCode(code: number): WeatherCode {
  return CODES[code] ?? UNKNOWN;
}

/** The icon to show, which for clear skies depends on whether the sun is up. */
export function weatherIcon(code: number, isDay: boolean): string {
  const entry = weatherCode(code);
  return !isDay && entry.nightIcon ? entry.nightIcon : entry.icon;
}

/** True when the sky itself is the story, so "sunny" beats "18 degrees". */
export function isWet(code: number): boolean {
  const group = weatherCode(code).group;
  return group === "rain" || group === "drizzle" || group === "snow" || group === "storm";
}

export function isSnowy(code: number): boolean {
  return weatherCode(code).group === "snow";
}

/** Every code the table knows, for tests and for the reference list. */
export const KNOWN_CODES: number[] = Object.keys(CODES).map(Number);
