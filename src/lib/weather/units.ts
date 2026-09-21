/**
 * Units, and turning numbers into something you would say out loud.
 *
 * Everything the API returns is metric; the conversion happens at the very
 * edge, when a value is formatted, so nothing downstream has to remember
 * which system a number is already in.
 */

export type UnitSystem = "metric" | "imperial";

export interface Units {
  system: UnitSystem;
  /** 24-hour clock, which most of the world reads more easily than am/pm. */
  clock24: boolean;
}

export const DEFAULT_UNITS: Units = { system: "metric", clock24: true };

/**
 * The three countries that use Fahrenheit day to day, plus the handful of
 * places that read a 12-hour clock by default. Guessed from the browser
 * locale so the first view is usually right, and always overridable.
 */
export function guessUnits(locale: string | undefined): Units {
  const tag = (locale ?? "").toLowerCase();
  const region = tag.split("-")[1] ?? "";
  const imperial = ["us", "lr", "mm"].includes(region);
  const twelveHour = ["us", "gb", "au", "nz", "ca", "ph", "in", "eg"].includes(region);
  return { system: imperial ? "imperial" : "metric", clock24: !twelveHour };
}

/* --------------------------------- numbers -------------------------------- */

export function toFahrenheit(celsius: number): number {
  return celsius * 1.8 + 32;
}

export function toMph(kmh: number): number {
  return kmh / 1.609344;
}

export function toInches(mm: number): number {
  return mm / 25.4;
}

export function toMiles(km: number): number {
  return km / 1.609344;
}

/* -------------------------------- formatting ------------------------------- */

/** A temperature as people say it: a whole number and a degree sign. */
export function formatTemp(celsius: number, units: Units, withUnit = false): string {
  const value = units.system === "imperial" ? toFahrenheit(celsius) : celsius;
  const rounded = Math.round(value);
  // -0° is never what anybody means.
  const safe = Object.is(rounded, -0) ? 0 : rounded;
  return withUnit ? `${safe}°${units.system === "imperial" ? "F" : "C"}` : `${safe}°`;
}

export function tempUnit(units: Units): string {
  return units.system === "imperial" ? "°F" : "°C";
}

/** A temperature difference, where 1°C is 1.8°F rather than 33.8°F. */
export function formatTempDelta(celsiusDelta: number, units: Units): string {
  const value = units.system === "imperial" ? celsiusDelta * 1.8 : celsiusDelta;
  return `${Math.round(Math.abs(value))}°`;
}

export function formatWind(kmh: number, units: Units): string {
  return units.system === "imperial"
    ? `${Math.round(toMph(kmh))} mph`
    : `${Math.round(kmh)} km/h`;
}

export function formatRain(mm: number, units: Units): string {
  if (units.system === "imperial") {
    const inches = toInches(mm);
    return inches < 0.1 ? `${inches.toFixed(2)} in` : `${inches.toFixed(1)} in`;
  }
  return mm < 1 ? `${mm.toFixed(1)} mm` : `${Math.round(mm)} mm`;
}

export function formatVisibility(meters: number, units: Units): string {
  const km = meters / 1000;
  if (units.system === "imperial") {
    const miles = toMiles(km);
    return miles < 1 ? `${Math.round(meters * 1.09361)} yd` : `${miles.toFixed(1)} mi`;
  }
  return km < 1 ? `${Math.round(meters)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}

/**
 * The clock time of an ISO timestamp, read in the place's own time zone.
 *
 * Open-Meteo returns local wall-clock stamps with no offset (`2026-09-21T14:00`),
 * which is exactly what we want to show, so they are read as literal text
 * rather than parsed into an instant that the browser would then re-zone.
 */
export function formatClock(iso: string, units: Units): string {
  const match = /T(\d{2}):(\d{2})/.exec(iso);
  // A missing stamp must not quietly become midnight: `Number("")` is 0.
  if (!match) return "—";
  const time = `${match[1]}:${match[2]}`;
  if (units.clock24) return time;
  const h = Number(match[1]);
  const m = Number(match[2]);
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour12}${suffix}` : `${hour12}:${String(m).padStart(2, "0")}${suffix}`;
}

/** "Today", "Tomorrow", then the weekday. */
export function formatDay(iso: string, todayIso: string, locale = "en"): string {
  const date = iso.slice(0, 10);
  if (date === todayIso) return "Today";

  const parsed = new Date(`${date}T12:00:00Z`);
  const today = new Date(`${todayIso}T12:00:00Z`);
  const days = Math.round((parsed.getTime() - today.getTime()) / 86_400_000);
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";

  try {
    return new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: "UTC" }).format(parsed);
  } catch {
    return date.slice(5);
  }
}

/** A duration in minutes, said the way a person would. */
export function formatDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const rest = total % 60;
  if (rest === 0) return `${hours} h`;
  return `${hours} h ${rest} min`;
}
