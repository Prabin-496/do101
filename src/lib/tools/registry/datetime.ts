import type { Tool } from "../types";

/**
 * Date and time tools. Clocks, differences and timers — all reading the
 * visitor's own device clock, with nothing sent anywhere.
 */
export const DATETIME_TOOLS: Tool[] = [
  {
    id: "digital-clock",
    name: "Full-Screen Digital Clock",
    short: "A big, calm clock for your second screen.",
    long: "A full-screen clock built to be left running: a split-flap flip display or glowing digits, six themes, any time zone, and controls that fade away after a few seconds. Where the browser allows it, the screen is kept awake so it never dims mid-meeting.",
    category: "datetime",
    route: "/tools/digital-clock",
    keywords: ["digital clock", "full screen clock", "flip clock", "online clock", "clock screensaver", "desk clock", "big clock"],
    aliases: ["fliqlo alternative", "flip clock screensaver", "big screen clock", "online timer clock"],
    icon: "🕒",
    accent: "sky",
    browserOnly: true,
    aiInvocable: false,
    input: "none",
    output: "none",
    related: ["timestamp-converter", "age", "typing-test", "reaction-test"],
    seoTitle: "Full-Screen Digital Clock — Free Flip Clock Online | DO101",
    seoDescription: "A free full-screen digital and flip clock for your desk or second monitor. Six themes, any time zone, keeps the screen awake. No download, no ads.",
    steps: [
      "Pick a display style and theme.",
      "Set the time zone, or leave it on this device.",
      "Press full screen and leave it running.",
    ],
    features: [
      "Split-flap flip cards or glowing digits",
      "Six themes including Amber, Terminal and Paper",
      "Any of sixteen time zones, or your own",
      "Controls fade away in full screen",
      "Keeps the screen awake where the browser allows it",
      "Settings saved on your device",
    ],
    faqs: [
      {
        q: "Does it work as a screensaver?",
        a: "It behaves like one in the browser: full screen, controls fading out, and the screen kept awake through the Screen Wake Lock API. A true operating-system screensaver has to be installed separately — this needs no download at all.",
      },
      {
        q: "Will my screen still dim?",
        a: "Not while the browser grants a wake lock, which most current desktop browsers do in full screen. A note appears on screen when the lock is active.",
      },
      {
        q: "Is it accurate?",
        a: "It reads your device's clock, so it is exactly as accurate as your computer. Time zones are converted with the browser's own database.",
      },
      {
        q: "Does it work offline?",
        a: "Yes. Once the page has loaded there is nothing more to fetch.",
      },
      {
        q: "Are my settings saved?",
        a: "Yes, in this browser only. Nothing is sent anywhere.",
      },
    ],
    featured: true,
  },
];
