/**
 * The forecast, from Open-Meteo.
 *
 * Open-Meteo is free for non-commercial use, needs no API key and allows
 * browser requests, which is what lets this tool work with no server and no
 * running cost behind it. The request goes straight from the visitor's
 * browser to Open-Meteo; nothing passes through DO101.
 *
 * `parseForecast` is kept separate from `fetchForecast` so the whole
 * normalising layer can be unit tested against a captured response.
 */

export class WeatherError extends Error {}

export const ENDPOINT = "https://api.open-meteo.com/v1/forecast";
export const ATTRIBUTION_URL = "https://open-meteo.com/";

/** How many days ahead to ask for. Seven is what a week-view needs. */
export const FORECAST_DAYS = 7;

export interface CurrentWeather {
  /** Local wall-clock stamp at the place, e.g. "2026-09-21T14:00". */
  time: string;
  temp: number;
  apparent: number;
  humidity: number;
  dewPoint: number;
  isDay: boolean;
  precip: number;
  code: number;
  cloudCover: number;
  pressure: number;
  wind: number;
  windDirection: number;
  gusts: number;
}

export interface HourPoint {
  time: string;
  temp: number;
  apparent: number;
  /** Percent, 0–100. */
  precipProbability: number;
  precip: number;
  code: number;
  wind: number;
  uv: number;
  isDay: boolean;
  humidity: number;
  pressure: number;
}

export interface DayPoint {
  /** Local date, "2026-09-21". */
  date: string;
  code: number;
  max: number;
  min: number;
  apparentMax: number;
  apparentMin: number;
  sunrise: string;
  sunset: string;
  daylightSeconds: number;
  uvMax: number;
  precipSum: number;
  precipProbabilityMax: number;
  windMax: number;
  gustMax: number;
}

export interface WeatherReport {
  fetchedAt: number;
  timezone: string;
  timezoneAbbreviation: string;
  utcOffsetSeconds: number;
  elevation: number;
  current: CurrentWeather;
  /** Every hour the API returned, yesterday included. */
  hours: HourPoint[];
  /** Yesterday first, then today and the days ahead. */
  days: DayPoint[];
}

const CURRENT_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "dew_point_2m",
  "apparent_temperature",
  "is_day",
  "precipitation",
  "weather_code",
  "cloud_cover",
  "pressure_msl",
  "wind_speed_10m",
  "wind_direction_10m",
  "wind_gusts_10m",
] as const;

const HOURLY_FIELDS = [
  "temperature_2m",
  "apparent_temperature",
  "precipitation_probability",
  "precipitation",
  "weather_code",
  "wind_speed_10m",
  "uv_index",
  "is_day",
  "relative_humidity_2m",
  "pressure_msl",
] as const;

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "apparent_temperature_max",
  "apparent_temperature_min",
  "sunrise",
  "sunset",
  "daylight_duration",
  "uv_index_max",
  "precipitation_sum",
  "precipitation_probability_max",
  "wind_speed_10m_max",
  "wind_gusts_10m_max",
] as const;

/**
 * Two decimal places, about a kilometre.
 *
 * The weather models behind this have a grid between 1 and 11 km wide, so
 * sending a position to five decimal places would buy no accuracy at all and
 * would hand a third party someone's street. A forecast is the same across a
 * whole town, so the precision goes no further than a town.
 */
export const COORD_PRECISION = 2;

export function roundCoord(value: number): string {
  return value.toFixed(COORD_PRECISION);
}

export function forecastUrl(lat: number, lon: number): string {
  const url = new URL(ENDPOINT);
  url.searchParams.set("latitude", roundCoord(lat));
  url.searchParams.set("longitude", roundCoord(lon));
  url.searchParams.set("current", CURRENT_FIELDS.join(","));
  url.searchParams.set("hourly", HOURLY_FIELDS.join(","));
  url.searchParams.set("daily", DAILY_FIELDS.join(","));
  // Wall-clock times in the place's own zone, which is what gets displayed.
  url.searchParams.set("timezone", "auto");
  // Yesterday comes along so today can be compared with it.
  url.searchParams.set("past_days", "1");
  url.searchParams.set("forecast_days", String(FORECAST_DAYS));
  return url.toString();
}

/* -------------------------------- parsing --------------------------------- */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function num(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

/** Reads one column out of a `{ time: [], field: [] }` block. */
function column(block: Record<string, unknown>, field: string): number[] {
  const raw = block[field];
  return Array.isArray(raw) ? raw.map((v) => num(v)) : [];
}

function stringColumn(block: Record<string, unknown>, field: string): string[] {
  const raw = block[field];
  return Array.isArray(raw) ? raw.map((v) => str(v)) : [];
}

export function parseForecast(raw: unknown, fetchedAt = Date.now()): WeatherReport {
  if (!isRecord(raw)) throw new WeatherError("The forecast service sent something unreadable.");
  if (typeof raw.error === "boolean" && raw.error) {
    throw new WeatherError(str(raw.reason, "The forecast service refused that request."));
  }

  const current = isRecord(raw.current) ? raw.current : null;
  const hourly = isRecord(raw.hourly) ? raw.hourly : null;
  const daily = isRecord(raw.daily) ? raw.daily : null;
  if (!current || !hourly || !daily) {
    throw new WeatherError("The forecast came back incomplete. Try again in a moment.");
  }

  const hourTimes = stringColumn(hourly, "time");
  const hourTemp = column(hourly, "temperature_2m");
  const hourApparent = column(hourly, "apparent_temperature");
  const hourProb = column(hourly, "precipitation_probability");
  const hourPrecip = column(hourly, "precipitation");
  const hourCode = column(hourly, "weather_code");
  const hourWind = column(hourly, "wind_speed_10m");
  const hourUv = column(hourly, "uv_index");
  const hourIsDay = column(hourly, "is_day");
  const hourHumidity = column(hourly, "relative_humidity_2m");
  const hourPressure = column(hourly, "pressure_msl");

  const hours: HourPoint[] = hourTimes.map((time, i) => ({
    time,
    temp: hourTemp[i] ?? 0,
    apparent: hourApparent[i] ?? hourTemp[i] ?? 0,
    precipProbability: hourProb[i] ?? 0,
    precip: hourPrecip[i] ?? 0,
    code: hourCode[i] ?? 0,
    wind: hourWind[i] ?? 0,
    uv: hourUv[i] ?? 0,
    isDay: (hourIsDay[i] ?? 1) === 1,
    humidity: hourHumidity[i] ?? 0,
    pressure: hourPressure[i] ?? 0,
  }));

  const dayDates = stringColumn(daily, "time");
  const dayCode = column(daily, "weather_code");
  const dayMax = column(daily, "temperature_2m_max");
  const dayMin = column(daily, "temperature_2m_min");
  const dayApparentMax = column(daily, "apparent_temperature_max");
  const dayApparentMin = column(daily, "apparent_temperature_min");
  const sunrise = stringColumn(daily, "sunrise");
  const sunset = stringColumn(daily, "sunset");
  const daylight = column(daily, "daylight_duration");
  const uvMax = column(daily, "uv_index_max");
  const precipSum = column(daily, "precipitation_sum");
  const precipProbMax = column(daily, "precipitation_probability_max");
  const windMax = column(daily, "wind_speed_10m_max");
  const gustMax = column(daily, "wind_gusts_10m_max");

  const days: DayPoint[] = dayDates.map((date, i) => ({
    date,
    code: dayCode[i] ?? 0,
    max: dayMax[i] ?? 0,
    min: dayMin[i] ?? 0,
    apparentMax: dayApparentMax[i] ?? dayMax[i] ?? 0,
    apparentMin: dayApparentMin[i] ?? dayMin[i] ?? 0,
    sunrise: sunrise[i] ?? "",
    sunset: sunset[i] ?? "",
    daylightSeconds: daylight[i] ?? 0,
    uvMax: uvMax[i] ?? 0,
    precipSum: precipSum[i] ?? 0,
    precipProbabilityMax: precipProbMax[i] ?? 0,
    windMax: windMax[i] ?? 0,
    gustMax: gustMax[i] ?? 0,
  }));

  if (!hours.length || !days.length) {
    throw new WeatherError("The forecast came back empty for that spot.");
  }

  return {
    fetchedAt,
    timezone: str(raw.timezone, "UTC"),
    timezoneAbbreviation: str(raw.timezone_abbreviation, ""),
    utcOffsetSeconds: num(raw.utc_offset_seconds),
    elevation: num(raw.elevation),
    current: {
      time: str(current.time),
      temp: num(current.temperature_2m),
      apparent: num(current.apparent_temperature, num(current.temperature_2m)),
      humidity: num(current.relative_humidity_2m),
      dewPoint: num(current.dew_point_2m),
      isDay: num(current.is_day, 1) === 1,
      precip: num(current.precipitation),
      code: num(current.weather_code),
      cloudCover: num(current.cloud_cover),
      pressure: num(current.pressure_msl),
      wind: num(current.wind_speed_10m),
      windDirection: num(current.wind_direction_10m),
      gusts: num(current.wind_gusts_10m),
    },
    hours,
    days,
  };
}

/* -------------------------------- fetching -------------------------------- */

export async function fetchForecast(
  lat: number,
  lon: number,
  signal?: AbortSignal,
): Promise<WeatherReport> {
  let response: Response;
  try {
    response = await fetch(forecastUrl(lat, lon), { signal, headers: { accept: "application/json" } });
  } catch (err) {
    if ((err as Error).name === "AbortError") throw err;
    throw new WeatherError("Could not reach the forecast service. Check your connection and try again.");
  }

  if (!response.ok) {
    throw new WeatherError(
      response.status === 429
        ? "The free forecast service is busy right now. Give it a minute and try again."
        : `The forecast service answered with an error (${response.status}).`,
    );
  }

  return parseForecast(await response.json());
}

/* ------------------------------- slicing it ------------------------------- */

/** The local date at the place, taken from the current reading. */
export function todayIso(report: WeatherReport): string {
  return report.current.time.slice(0, 10);
}

/** Where "now" sits in the hourly series. */
export function currentHourIndex(report: WeatherReport): number {
  const stamp = report.current.time.slice(0, 13);
  const exact = report.hours.findIndex((h) => h.time.slice(0, 13) === stamp);
  if (exact >= 0) return exact;
  // Fall back to the last hour that is not in the future.
  const past = report.hours.filter((h) => h.time <= report.current.time);
  return past.length ? past.length - 1 : 0;
}

/** The next `count` hours starting from now, for the strip and the chart. */
export function nextHours(report: WeatherReport, count = 24): HourPoint[] {
  const start = currentHourIndex(report);
  return report.hours.slice(start, start + count);
}

export function dayFor(report: WeatherReport, date: string): DayPoint | undefined {
  return report.days.find((d) => d.date === date);
}

/** Today and the days ahead — yesterday is only there for the comparison. */
export function comingDays(report: WeatherReport): DayPoint[] {
  const today = todayIso(report);
  return report.days.filter((d) => d.date >= today);
}

export function yesterday(report: WeatherReport): DayPoint | undefined {
  const today = todayIso(report);
  return report.days.filter((d) => d.date < today).at(-1);
}
