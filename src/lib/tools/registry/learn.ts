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
    related: ["digital-clock", "earth-globe", "timestamp-converter", "reaction-test"],
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
];
