import { describe, it, expect } from "vitest";
import {
  KNOWN_CODES,
  isSnowy,
  isWet,
  weatherCode,
  weatherIcon,
} from "@/lib/weather/codes";
import {
  DEFAULT_UNITS,
  formatClock,
  formatDay,
  formatDuration,
  formatRain,
  formatTemp,
  formatTempDelta,
  formatVisibility,
  formatWind,
  guessUnits,
  toFahrenheit,
  type Units,
} from "@/lib/weather/units";
import {
  WeatherError,
  comingDays,
  currentHourIndex,
  dayFor,
  forecastUrl,
  nextHours,
  parseForecast,
  roundCoord,
  todayIso,
  yesterday,
  type WeatherReport,
} from "@/lib/weather/api";
import {
  addHour,
  beaufort,
  compass,
  compassShort,
  cloudReading,
  daylightSentence,
  dewPointReading,
  feelsLike,
  gustNote,
  headline,
  humidityReading,
  minutesOfDay,
  pressureReading,
  pressureThreeHoursAgo,
  rainSentence,
  rainWindows,
  sameHourYesterday,
  uvReading,
  warnings,
  whatToWear,
  yesterdaySentence,
} from "@/lib/weather/describe";
import { addRecent, coordsLabel, samePlace, MAX_RECENT, type Place } from "@/lib/weather/location";

const METRIC: Units = { system: "metric", clock24: true };
const IMPERIAL: Units = { system: "imperial", clock24: false };

/* --------------------------------- fixtures -------------------------------- */

interface HourSpec {
  temp?: number;
  apparent?: number;
  probability?: number;
  precip?: number;
  code?: number;
  wind?: number;
  uv?: number;
  isDay?: number;
  humidity?: number;
  pressure?: number;
}

/**
 * Builds a response in the shape Open-Meteo returns: two days of hours
 * starting at midnight yesterday, so "now" has a same-hour-yesterday to be
 * compared against.
 */
function rawResponse(options: {
  currentHour?: number;
  hours?: Record<number, HourSpec>;
  currentOverrides?: Record<string, number>;
} = {}) {
  const { currentHour = 12, hours = {}, currentOverrides = {} } = options;
  const dates = ["2026-09-20", "2026-09-21"];
  const times: string[] = [];
  for (const date of dates) {
    for (let h = 0; h < 24; h += 1) times.push(`${date}T${String(h).padStart(2, "0")}:00`);
  }

  // Index 24 is midnight today, so today's hour h sits at 24 + h.
  const at = (i: number): HourSpec => hours[i] ?? {};
  const pick = <K extends keyof HourSpec>(i: number, key: K, fallback: number): number =>
    (at(i)[key] as number | undefined) ?? fallback;

  const nowIndex = 24 + currentHour;

  return {
    timezone: "Europe/London",
    timezone_abbreviation: "BST",
    utc_offset_seconds: 3600,
    elevation: 24,
    current: {
      time: `2026-09-21T${String(currentHour).padStart(2, "0")}:00`,
      temperature_2m: 15,
      relative_humidity_2m: 60,
      dew_point_2m: 8,
      apparent_temperature: 15,
      is_day: 1,
      precipitation: 0,
      weather_code: 2,
      cloud_cover: 45,
      pressure_msl: 1013,
      wind_speed_10m: 10,
      wind_direction_10m: 270,
      wind_gusts_10m: 15,
      ...currentOverrides,
    },
    hourly: {
      time: times,
      temperature_2m: times.map((_, i) => pick(i, "temp", 15)),
      apparent_temperature: times.map((_, i) => pick(i, "apparent", pick(i, "temp", 15))),
      precipitation_probability: times.map((_, i) => pick(i, "probability", 0)),
      precipitation: times.map((_, i) => pick(i, "precip", 0)),
      weather_code: times.map((_, i) => pick(i, "code", 2)),
      wind_speed_10m: times.map((_, i) => pick(i, "wind", 10)),
      uv_index: times.map((_, i) => pick(i, "uv", 2)),
      is_day: times.map((_, i) => pick(i, "isDay", 1)),
      relative_humidity_2m: times.map((_, i) => pick(i, "humidity", 60)),
      pressure_msl: times.map((_, i) => pick(i, "pressure", 1013)),
    },
    daily: {
      time: dates,
      weather_code: [3, 2],
      temperature_2m_max: [14, 19],
      temperature_2m_min: [7, 10],
      apparent_temperature_max: [13, 18],
      apparent_temperature_min: [5, 9],
      sunrise: dates.map((d) => `${d}T06:40`),
      sunset: dates.map((d) => `${d}T19:10`),
      daylight_duration: [45000, 45000],
      uv_index_max: [3, 5],
      precipitation_sum: [2.4, 0],
      precipitation_probability_max: [70, 10],
      wind_speed_10m_max: [22, 18],
      wind_gusts_10m_max: [40, 33],
    },
    ...{ nowIndex },
  };
}

function report(options: Parameters<typeof rawResponse>[0] = {}): WeatherReport {
  return parseForecast(rawResponse(options), 1_700_000_000_000);
}

/* ---------------------------------- codes ---------------------------------- */

describe("weather codes", () => {
  it("gives every known code a label, a sentence and an icon", () => {
    for (const code of KNOWN_CODES) {
      const entry = weatherCode(code);
      expect(entry.label.length, `${code} label`).toBeGreaterThan(2);
      expect(entry.sentence.endsWith("."), `${code} sentence is a sentence`).toBe(true);
      expect(entry.icon.length, `${code} icon`).toBeGreaterThan(0);
    }
  });

  it("covers the codes Open-Meteo actually emits", () => {
    // The WMO subset documented by Open-Meteo.
    for (const code of [0, 1, 2, 3, 45, 48, 51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99]) {
      expect(KNOWN_CODES, `code ${code} is missing`).toContain(code);
    }
  });

  it("falls back rather than throwing on a code it has never seen", () => {
    expect(weatherCode(1234).label).toBe("Unclear");
  });

  it("swaps the sun for the moon after dark, where that makes sense", () => {
    expect(weatherIcon(0, true)).toBe("☀️");
    expect(weatherIcon(0, false)).toBe("🌙");
    // Rain looks the same at night.
    expect(weatherIcon(63, false)).toBe(weatherIcon(63, true));
  });

  it("knows which codes mean you will get wet", () => {
    expect(isWet(0)).toBe(false);
    expect(isWet(3)).toBe(false);
    expect(isWet(63)).toBe(true);
    expect(isWet(73)).toBe(true);
    expect(isWet(95)).toBe(true);
    expect(isSnowy(73)).toBe(true);
    expect(isSnowy(63)).toBe(false);
  });
});

/* ---------------------------------- units ---------------------------------- */

describe("units", () => {
  it("converts to Fahrenheit", () => {
    expect(toFahrenheit(0)).toBe(32);
    expect(toFahrenheit(100)).toBe(212);
  });

  it("formats a temperature the way people say it", () => {
    expect(formatTemp(15.4, METRIC)).toBe("15°");
    expect(formatTemp(15.4, METRIC, true)).toBe("15°C");
    expect(formatTemp(15, IMPERIAL, true)).toBe("59°F");
  });

  it("never shows minus zero", () => {
    expect(formatTemp(-0.4, METRIC)).toBe("0°");
  });

  it("treats a difference as a difference, not a temperature", () => {
    // 5°C colder is 9°F colder, not -13°F.
    expect(formatTempDelta(-5, METRIC)).toBe("5°");
    expect(formatTempDelta(-5, IMPERIAL)).toBe("9°");
  });

  it("formats wind, rain and visibility per system", () => {
    expect(formatWind(16.1, METRIC)).toBe("16 km/h");
    expect(formatWind(16.1, IMPERIAL)).toBe("10 mph");
    expect(formatRain(0.4, METRIC)).toBe("0.4 mm");
    expect(formatRain(12, METRIC)).toBe("12 mm");
    expect(formatRain(25.4, IMPERIAL)).toBe("1.0 in");
    expect(formatVisibility(500, METRIC)).toBe("500 m");
    expect(formatVisibility(12000, METRIC)).toBe("12 km");
  });

  it("reads the clock out of a local stamp without re-zoning it", () => {
    expect(formatClock("2026-09-21T14:00", METRIC)).toBe("14:00");
    expect(formatClock("2026-09-21T14:00", IMPERIAL)).toBe("2pm");
    expect(formatClock("2026-09-21T14:30", IMPERIAL)).toBe("2:30pm");
    expect(formatClock("2026-09-21T00:00", IMPERIAL)).toBe("12am");
    expect(formatClock("2026-09-21T12:00", IMPERIAL)).toBe("12pm");
  });

  it("names the day relative to today", () => {
    expect(formatDay("2026-09-21", "2026-09-21")).toBe("Today");
    expect(formatDay("2026-09-22", "2026-09-21")).toBe("Tomorrow");
    expect(formatDay("2026-09-20", "2026-09-21")).toBe("Yesterday");
    // Further out falls back to a weekday name.
    expect(formatDay("2026-09-24", "2026-09-21").length).toBeGreaterThan(2);
  });

  it("says durations the way a person would", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(120)).toBe("2 h");
    expect(formatDuration(200)).toBe("3 h 20 min");
  });

  it("guesses units from the locale, and defaults to metric", () => {
    expect(guessUnits("en-US").system).toBe("imperial");
    expect(guessUnits("en-GB").system).toBe("metric");
    expect(guessUnits("ja-JP")).toEqual({ system: "metric", clock24: true });
    expect(guessUnits(undefined).system).toBe("metric");
    expect(DEFAULT_UNITS.system).toBe("metric");
  });
});

/* ----------------------------------- api ----------------------------------- */

describe("the forecast request", () => {
  it("rounds coordinates to about a kilometre before sending them", () => {
    expect(roundCoord(51.507351)).toBe("51.51");
    const url = new URL(forecastUrl(51.507351, -0.127758));
    expect(url.searchParams.get("latitude")).toBe("51.51");
    expect(url.searchParams.get("longitude")).toBe("-0.13");
  });

  it("asks for yesterday too, so today can be compared with it", () => {
    const url = new URL(forecastUrl(0, 0));
    expect(url.searchParams.get("past_days")).toBe("1");
    expect(url.searchParams.get("timezone")).toBe("auto");
  });
});

describe("parsing the forecast", () => {
  it("normalises hours and days into flat arrays", () => {
    const r = report();
    expect(r.hours).toHaveLength(48);
    expect(r.days).toHaveLength(2);
    expect(r.timezone).toBe("Europe/London");
    expect(r.current.temp).toBe(15);
    expect(r.hours[0].time).toBe("2026-09-20T00:00");
  });

  it("rejects a body that is not a forecast", () => {
    expect(() => parseForecast("nope")).toThrow(WeatherError);
    expect(() => parseForecast({})).toThrow(WeatherError);
  });

  it("passes on the reason when the service refuses", () => {
    expect(() => parseForecast({ error: true, reason: "Out of range" })).toThrow("Out of range");
  });

  it("survives a column going missing rather than producing NaN", () => {
    const raw = rawResponse();
    delete (raw.hourly as Record<string, unknown>).uv_index;
    const r = parseForecast(raw);
    expect(r.hours.every((h) => Number.isFinite(h.uv))).toBe(true);
  });

  it("finds where now sits in the hourly series", () => {
    const r = report({ currentHour: 12 });
    expect(currentHourIndex(r)).toBe(36);
    expect(r.hours[currentHourIndex(r)].time).toBe("2026-09-21T12:00");
  });

  it("slices the hours ahead from now", () => {
    const r = report({ currentHour: 12 });
    const ahead = nextHours(r, 6);
    expect(ahead).toHaveLength(6);
    expect(ahead[0].time).toBe("2026-09-21T12:00");
    expect(ahead[5].time).toBe("2026-09-21T17:00");
  });

  it("stops at the end of the series rather than padding", () => {
    const r = report({ currentHour: 22 });
    expect(nextHours(r, 24)).toHaveLength(2);
  });

  it("separates yesterday from the days ahead", () => {
    const r = report();
    expect(todayIso(r)).toBe("2026-09-21");
    expect(comingDays(r).map((d) => d.date)).toEqual(["2026-09-21"]);
    expect(yesterday(r)!.date).toBe("2026-09-20");
    expect(dayFor(r, "2026-09-21")!.max).toBe(19);
  });
});

/* --------------------------------- describe -------------------------------- */

describe("wind in words", () => {
  it("puts speeds on the Beaufort scale", () => {
    expect(beaufort(0).force).toBe(0);
    expect(beaufort(0).name).toBe("Calm");
    expect(beaufort(15).force).toBe(3);
    expect(beaufort(35).name).toBe("Fresh breeze");
    expect(beaufort(70).name).toBe("Gale");
    expect(beaufort(200).force).toBe(12);
  });

  it("describes what you would notice, not just a number", () => {
    expect(beaufort(35).effect).toContain("umbrellas");
  });

  it("names the direction the wind comes from", () => {
    expect(compass(0)).toBe("north");
    expect(compass(90)).toBe("east");
    expect(compass(225)).toBe("south-west");
    expect(compass(360)).toBe("north");
    expect(compassShort(315)).toBe("NW");
  });

  it("mentions gusts only when they are worth mentioning", () => {
    expect(gustNote(10, 14)).toBeNull();
    expect(gustNote(40, 45)).toBeNull();
    expect(gustNote(20, 50)).toContain("50");
  });
});

describe("why it feels different", () => {
  it("says nothing when the difference is too small to notice", () => {
    const r = report({ currentOverrides: { temperature_2m: 15, apparent_temperature: 14.2 } });
    expect(feelsLike(r.current, METRIC).reason).toBeNull();
  });

  it("blames the wind when it is windy and colder", () => {
    const r = report({
      currentOverrides: { temperature_2m: 8, apparent_temperature: 3, wind_speed_10m: 30 },
    });
    const felt = feelsLike(r.current, METRIC);
    expect(felt.reason).toContain("colder");
    expect(felt.reason).toContain("wind");
  });

  it("blames the humidity when it is muggy and warmer", () => {
    const r = report({
      currentOverrides: {
        temperature_2m: 30,
        apparent_temperature: 34,
        relative_humidity_2m: 85,
        wind_speed_10m: 2,
      },
    });
    const felt = feelsLike(r.current, METRIC);
    expect(felt.reason).toContain("warmer");
    expect(felt.reason).toContain("sweat");
  });

  it("scales the difference into the chosen units", () => {
    const r = report({ currentOverrides: { temperature_2m: 8, apparent_temperature: 3, wind_speed_10m: 30 } });
    // 5°C colder is 9°F colder.
    expect(feelsLike(r.current, IMPERIAL).reason).toContain("9°");
  });
});

describe("readings in plain words", () => {
  it("bands the dew point by how muggy it feels", () => {
    expect(dewPointReading(2).word).toBe("Very dry");
    expect(dewPointReading(13).word).toBe("Comfortable");
    expect(dewPointReading(20).word).toBe("Humid");
    expect(dewPointReading(24).word).toBe("Oppressive");
  });

  it("bands relative humidity separately", () => {
    expect(humidityReading(20).word).toBe("Dry");
    expect(humidityReading(50).word).toBe("Comfortable");
    expect(humidityReading(95).word).toBe("Saturated");
  });

  it("gives UV a band and a burn time", () => {
    expect(uvReading(1).band).toBe("low");
    expect(uvReading(1).burnMinutes).toBeNull();
    expect(uvReading(4).band).toBe("moderate");
    expect(uvReading(7).band).toBe("high");
    expect(uvReading(9).band).toBe("very high");
    expect(uvReading(12).band).toBe("extreme");
    expect(uvReading(12).burnMinutes).toBe(10);
  });

  it("describes cloud cover", () => {
    expect(cloudReading(5).word).toBe("Clear");
    expect(cloudReading(95).word).toBe("Overcast");
  });

  it("reads pressure as a trend when it can", () => {
    expect(pressureReading(1013, null).word).toBe("1013 hPa");
    expect(pressureReading(1009, 1013).word).toBe("Falling fast");
    // Under a full hPa in three hours is the conventional "steady".
    expect(pressureReading(1012.5, 1013).word).toBe("Steady");
    expect(pressureReading(1012, 1013).word).toBe("Falling");
    expect(pressureReading(1018, 1013).word).toBe("Rising fast");
    expect(pressureReading(1011.5, 1013).word).toBe("Falling");
  });

  it("explains what a sharp drop means", () => {
    expect(pressureReading(1005, 1013).note).toContain("rain");
  });

  it("finds the pressure three hours back, and copes when it cannot", () => {
    const r = report({ currentHour: 12, hours: { 33: { pressure: 1020 } } });
    expect(pressureThreeHoursAgo(r, currentHourIndex(r))).toBe(1020);
    expect(pressureThreeHoursAgo(r, 1)).toBeNull();
  });
});

describe("when it will rain", () => {
  it("groups the wet hours into spells", () => {
    const r = report({
      currentHour: 12,
      hours: { 38: { probability: 60 }, 39: { probability: 80 }, 40: { probability: 55 } },
    });
    const windows = rainWindows(nextHours(r, 12));
    expect(windows).toHaveLength(1);
    expect(windows[0].from.time).toBe("2026-09-21T14:00");
    expect(windows[0].to.time).toBe("2026-09-21T16:00");
    expect(windows[0].peak.time).toBe("2026-09-21T15:00");
  });

  it("keeps two separate spells separate", () => {
    const r = report({
      currentHour: 12,
      hours: { 38: { probability: 60 }, 42: { probability: 70 } },
    });
    expect(rainWindows(nextHours(r, 12))).toHaveLength(2);
  });

  it("ignores a low chance", () => {
    const r = report({ currentHour: 12, hours: { 38: { probability: 20 } } });
    expect(rainWindows(nextHours(r, 12))).toHaveLength(0);
  });

  it("says when it starts and stops", () => {
    const r = report({
      currentHour: 12,
      hours: { 38: { probability: 60 }, 39: { probability: 80 }, 40: { probability: 55 } },
    });
    const sentence = rainSentence(nextHours(r, 12), METRIC);
    expect(sentence).toContain("14:00");
    expect(sentence).toContain("17:00");
    expect(sentence).toContain("15:00");
  });

  it("says so plainly when it is already raining", () => {
    const r = report({ currentHour: 12, hours: { 36: { probability: 90 }, 37: { probability: 70 } } });
    expect(rainSentence(nextHours(r, 12), METRIC)).toMatch(/^Rain now/);
  });

  it("calls snow snow", () => {
    const r = report({
      currentHour: 12,
      hours: { 38: { probability: 80, code: 73 } },
    });
    expect(rainSentence(nextHours(r, 12), METRIC)).toMatch(/^Snow/);
  });

  it("does not invent a stop time for rain still falling at the last hour", () => {
    // Every hour of the slice is wet, so nothing here knows when it ends.
    const wet: Record<number, { probability: number }> = {};
    for (let i = 36; i < 48; i += 1) wet[i] = { probability: 80 };
    const r = report({ currentHour: 12, hours: wet });
    const sentence = rainSentence(nextHours(r, 12), METRIC);
    expect(sentence).toContain("does not let up");
    expect(sentence).not.toContain("until");
  });

  it("says the same for a spell that arrives later and never stops", () => {
    const wet: Record<number, { probability: number }> = {};
    for (let i = 38; i < 48; i += 1) wet[i] = { probability: 80 };
    const r = report({ currentHour: 12, hours: wet });
    const sentence = rainSentence(nextHours(r, 12), METRIC);
    expect(sentence).toContain("14:00");
    expect(sentence).toContain("still going");
    expect(sentence).not.toContain("until");
  });

  it("reassures when nothing is coming", () => {
    const r = report({ currentHour: 12 });
    expect(rainSentence(nextHours(r, 12), METRIC)).toContain("Nothing wet");
  });

  it("mentions a second spell when there is one", () => {
    const r = report({
      currentHour: 8,
      hours: { 34: { probability: 60 }, 38: { probability: 70 } },
    });
    expect(rainSentence(nextHours(r, 14), METRIC)).toContain("Another spell");
  });

  it("steps to the next clock hour, wrapping past midnight", () => {
    expect(addHour("2026-09-21T14:00")).toBe("2026-09-21T15:00");
    expect(addHour("2026-09-21T23:00").slice(11)).toBe("00:00");
  });
});

describe("daylight", () => {
  it("reads minutes past midnight", () => {
    expect(minutesOfDay("2026-09-21T06:40")).toBe(400);
    expect(minutesOfDay("2026-09-21T00:00")).toBe(0);
  });

  it("refuses a missing stamp rather than calling it midnight", () => {
    // `Number("")` is 0, so a sliced empty string would read as 00:00 and the
    // page would claim the sun had been up for hours.
    expect(minutesOfDay("")).toBeNull();
    expect(minutesOfDay("nonsense")).toBeNull();
    expect(minutesOfDay("2026-09-21T99:99")).toBeNull();
  });

  it("says so rather than inventing a time when a stamp is missing", () => {
    expect(formatClock("", METRIC)).toBe("—");
    expect(formatClock("", IMPERIAL)).toBe("—");
  });

  it("gives up on a day whose sun times never arrived", () => {
    const r = report();
    const broken = { ...dayFor(r, "2026-09-21")!, sunrise: "", sunset: "" };
    expect(daylightSentence(broken, r.current.time, METRIC)).toBe("");
  });

  it("counts down the daylight left", () => {
    const r = report({ currentHour: 17 });
    const sentence = daylightSentence(dayFor(r, "2026-09-21")!, r.current.time, METRIC);
    expect(sentence).toContain("2 h 10 min");
    expect(sentence).toContain("19:10");
  });

  it("says it is still dark before sunrise", () => {
    const r = report({ currentHour: 5 });
    expect(daylightSentence(dayFor(r, "2026-09-21")!, r.current.time, METRIC)).toContain("Still dark");
  });

  it("says the sun has gone after sunset", () => {
    const r = report({ currentHour: 21 });
    expect(daylightSentence(dayFor(r, "2026-09-21")!, r.current.time, METRIC)).toContain("set at");
  });
});

describe("against yesterday", () => {
  it("compares the same hour a day back", () => {
    const r = report({ currentHour: 12, hours: { 12: { temp: 10 } } });
    const same = sameHourYesterday(r, currentHourIndex(r));
    expect(same!.time).toBe("2026-09-20T12:00");
    expect(yesterdaySentence(r.current, same, METRIC)).toContain("5° warmer");
  });

  it("says when there is nothing in it", () => {
    const r = report({ currentHour: 12, hours: { 12: { temp: 15 } } });
    expect(yesterdaySentence(r.current, sameHourYesterday(r, currentHourIndex(r)), METRIC)).toContain(
      "About the same",
    );
  });

  it("says nothing at all when yesterday is missing", () => {
    expect(yesterdaySentence(report().current, undefined, METRIC)).toBeNull();
  });
});

describe("what to wear", () => {
  const ahead = (r: WeatherReport) => nextHours(r, 12);

  it("scales the coat to the temperature your body feels", () => {
    const freezing = report({ currentOverrides: { apparent_temperature: -8 } });
    expect(whatToWear(freezing.current, ahead(freezing), 0)[0]).toContain("Serious winter coat");

    const mild = report({ currentOverrides: { apparent_temperature: 18 } });
    expect(whatToWear(mild.current, ahead(mild), 0)[0]).toContain("Long sleeves");

    const hot = report({ currentOverrides: { apparent_temperature: 32 } });
    expect(whatToWear(hot.current, ahead(hot), 0)[0]).toContain("Lightest clothes");
  });

  it("suggests an umbrella when rain is coming", () => {
    const r = report({ currentHour: 12, hours: { 38: { probability: 70 } } });
    expect(whatToWear(r.current, ahead(r), 0).join(" ")).toContain("umbrella");
  });

  it("prefers a hood to an umbrella when it is also windy", () => {
    const r = report({
      currentHour: 12,
      hours: { 38: { probability: 70, wind: 50 } },
      currentOverrides: { wind_speed_10m: 45 },
    });
    const advice = whatToWear(r.current, ahead(r), 0).join(" ");
    expect(advice).toContain("hooded");
  });

  it("warns about ice when it is cold enough", () => {
    const r = report({ currentOverrides: { temperature_2m: 0, apparent_temperature: -3 } });
    expect(whatToWear(r.current, ahead(r), 0).join(" ")).toContain("footing");
  });

  it("mentions sunscreen only when the UV justifies it", () => {
    const r = report();
    expect(whatToWear(r.current, ahead(r), 3).join(" ")).not.toContain("Sunscreen");
    expect(whatToWear(r.current, ahead(r), 8).join(" ")).toContain("Sunscreen");
  });

  it("warns when it drops sharply later", () => {
    const r = report({
      currentHour: 12,
      hours: { 40: { apparent: 5 } },
      currentOverrides: { apparent_temperature: 18 },
    });
    expect(whatToWear(r.current, ahead(r), 0).join(" ")).toContain("layer");
  });
});

describe("the headline and the warnings", () => {
  it("leads with the sky and the temperature", () => {
    const r = report();
    expect(headline(r.current, "London", METRIC)).toBe("Partly cloudy and 15°C in London.");
  });

  it("adds the feels-like when it differs", () => {
    const r = report({ currentOverrides: { apparent_temperature: 10 } });
    expect(headline(r.current, "London", METRIC)).toContain("feels more like 10°C");
  });

  it("works without a place name", () => {
    expect(headline(report().current, "", METRIC)).toBe("Partly cloudy and 15°C.");
  });

  it("stays quiet in ordinary weather", () => {
    const r = report();
    expect(warnings(r.current, dayFor(r, "2026-09-21"))).toEqual([]);
  });

  it("speaks up for severe weather, gales, extreme UV and dangerous heat", () => {
    const storm = report({ currentOverrides: { weather_code: 95 } });
    expect(warnings(storm.current, undefined).join(" ")).toContain("thunderstorm");

    const gale = report({ currentOverrides: { wind_gusts_10m: 80 } });
    expect(warnings(gale.current, undefined).join(" ")).toContain("Gusts");

    const cold = report({ currentOverrides: { apparent_temperature: -15 } });
    expect(warnings(cold.current, undefined).join(" ")).toContain("frostbite");

    const heat = report({ currentOverrides: { apparent_temperature: 38 } });
    expect(warnings(heat.current, undefined).join(" ")).toContain("Heat");

    const r = report();
    const burning = { ...dayFor(r, "2026-09-21")!, uvMax: 9 };
    expect(warnings(r.current, burning).join(" ")).toContain("UV");
  });
});

/* --------------------------------- location -------------------------------- */

describe("places", () => {
  const place = (over: Partial<Place> = {}): Place => ({
    id: "1",
    name: "London",
    detail: "England, United Kingdom",
    lat: 51.5,
    lon: -0.13,
    ...over,
  });

  it("labels bare coordinates readably", () => {
    expect(coordsLabel(51.5074, -0.1278)).toBe("51.51°N, 0.13°W");
    expect(coordsLabel(-33.87, 151.21)).toBe("33.87°S, 151.21°E");
  });

  it("treats two spots within about a kilometre as the same place", () => {
    expect(samePlace(place(), place({ id: "2", lat: 51.503 }))).toBe(true);
    expect(samePlace(place(), place({ id: "3", lat: 52.5 }))).toBe(false);
  });

  it("puts the newest place first and drops the duplicate", () => {
    const list = [place({ id: "a", name: "Leeds", lat: 53.8, lon: -1.55 }), place({ id: "b" })];
    const next = addRecent(list, place({ id: "c" }));
    expect(next).toHaveLength(2);
    expect(next[0].id).toBe("c");
    expect(next[1].name).toBe("Leeds");
  });

  it("caps the list rather than growing forever", () => {
    let list: Place[] = [];
    for (let i = 0; i < 20; i += 1) {
      list = addRecent(list, place({ id: String(i), lat: 40 + i, lon: i }));
    }
    expect(list).toHaveLength(MAX_RECENT);
    expect(list[0].id).toBe("19");
  });
});
