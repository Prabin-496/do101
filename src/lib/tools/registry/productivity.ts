import type { Tool } from "../types";

/**
 * Everyday tools: notes, calendar, keyboard reference and the split-screen
 * workspace that runs several of them at once. All local, all free.
 */
export const PRODUCTIVITY_TOOLS: Tool[] = [
  {
    id: "notes",
    name: "Notes",
    short: "A fast notepad that saves in your browser. No account.",
    long:
      "Write notes that save as you type, straight into this browser's storage. Pin the ones you need, colour them, search across everything and export the lot as a Markdown file. There is no account and no server — which is what makes it free and private, and also why the notes live on this device.",
    category: "productivity",
    route: "/tools/notes",
    keywords: [
      "online notepad", "notes app", "free notepad", "memo app",
      "browser notepad", "quick notes", "sticky notes online", "note taking app free",
      "notepad no sign up", "offline notepad",
    ],
    aliases: ["take a note", "notepad", "memo", "write this down"],
    icon: "🗒️",
    accent: "sun",
    browserOnly: true,
    aiInvocable: false,
    input: "text",
    output: "text",
    related: ["workspace", "calendar", "word-counter", "grammar-checker"],
    seoTitle: "Free Online Notepad — Saves in Your Browser, No Sign-Up | DO101",
    seoDescription:
      "A fast notes app that saves automatically in your browser. No account, no server, works offline. Pin, colour, search and export as Markdown.",
    steps: [
      "Press New note and start typing — it saves as you go.",
      "Add a title, or let the first line become one.",
      "Pin the notes you come back to, and colour them to tell them apart.",
      "Download everything as Markdown whenever you want a backup.",
    ],
    features: [
      "Saves as you type, with no save button to forget",
      "Pin, colour and search across every note",
      "Word count and last-edited time on each note",
      "Export all notes to a single Markdown file, and import one back",
      "Works offline once the page has loaded",
      "No account, no sync, no server — the notes never leave your device",
    ],
    faqs: [
      {
        q: "Where are my notes stored?",
        a: "In your browser's local storage, on this device. They are not uploaded and there is no account attached to them.",
      },
      {
        q: "Will my notes appear on my phone?",
        a: "No. Local storage is per-browser and per-device, so notes written here stay here. Download the Markdown export and open it elsewhere if you need them on another device.",
      },
      {
        q: "Can I lose my notes?",
        a: "Yes — clearing your browsing data, using private browsing, or a browser that evicts storage under pressure will remove them. Export a Markdown backup if a note matters.",
      },
      {
        q: "Is there a limit on how much I can write?",
        a: "Browsers usually allow around 5MB per site for local storage, which is roughly a million words of plain text. You will not reach it with notes.",
      },
    ],
    featured: true,
  },
  {
    id: "workspace",
    name: "Split-Screen Workspace",
    short: "Run two, three or four DO101 tools side by side.",
    long:
      "Put the tools you use together on one screen. Translate on the left and take notes on the right, check a citation while you proofread, or keep a calendar beside your writing. Choose a layout, drag the bars to resize, and the arrangement is remembered for next time.",
    category: "productivity",
    route: "/workspace",
    keywords: [
      "split screen tools", "multi tool workspace", "side by side tools",
      "split screen translator and notes", "dual pane tools", "productivity workspace",
    ],
    aliases: ["split screen", "two tools at once", "side by side"],
    icon: "🧩",
    accent: "grape",
    browserOnly: true,
    aiInvocable: false,
    input: "none",
    output: "none",
    related: ["notes", "japanese-translator", "calendar", "grammar-checker"],
    seoTitle: "Split-Screen Workspace — Use Several Free Tools at Once | DO101",
    seoDescription:
      "Run two, three or four DO101 tools side by side in one window. Resizable panes, a layout that is remembered, and everything still runs in your browser.",
    steps: [
      "Pick a layout: side by side, three columns, stacked or four panes.",
      "Choose a tool for each pane from the dropdown in its header.",
      "Drag the bars between panes to resize, or use the arrow keys.",
      "Press the focus button on any pane to work in it full width for a moment.",
    ],
    features: [
      "Five layouts, from a single pane to a four-pane grid",
      "Eleven tools available in any pane",
      "Resizable panes, by drag or keyboard",
      "Focus a single pane without losing the layout",
      "Layout, sizes and tool choices remembered on this device",
      "Panes load only when chosen, so nothing is downloaded unnecessarily",
    ],
    faqs: [
      {
        q: "Which tools can I put in a pane?",
        a: "Notes, the Japanese translator, the romaji converter, the calendar, the Excel shortcut reference, and the writing tools: grammar checker, paraphraser, readability, tone, citations and similarity.",
      },
      {
        q: "Does it work on a phone?",
        a: "The panes stack into a single column on narrow screens. Two tools side by side on a phone leaves each about 160 pixels wide, which is not usable, so the layout adapts instead.",
      },
      {
        q: "Is my layout saved?",
        a: "Yes, in this browser's local storage. It is not tied to an account and will not follow you to another device.",
      },
    ],
    featured: true,
  },
  {
    id: "excel-shortcuts",
    name: "Excel Shortcuts",
    short: "Every useful Excel shortcut, with what it is actually for.",
    long:
      "A searchable reference of Excel keyboard shortcuts for Windows and Mac. Each one says not just which keys to press but when you would reach for it — why Ctrl+Shift+L saves you reopening filter menus, or why Alt+; matters the moment you copy from a filtered list. Search by what you want to do, not by the keys.",
    category: "productivity",
    route: "/tools/excel-shortcuts",
    keywords: [
      "excel shortcuts", "excel keyboard shortcuts", "excel shortcuts list",
      "excel shortcuts mac", "excel shortcuts windows", "excel cheat sheet",
      "excel keyboard shortcuts pdf", "useful excel shortcuts", "excel tips",
    ],
    aliases: ["excel keyboard shortcuts", "excel cheat sheet", "shortcut for excel"],
    icon: "⌨️",
    accent: "grass",
    browserOnly: true,
    aiInvocable: true,
    input: "none",
    output: "none",
    related: ["csv-to-excel", "excel-to-csv", "excel-to-pdf", "workspace"],
    seoTitle: "Excel Keyboard Shortcuts — Windows & Mac, With Use Cases | DO101",
    seoDescription:
      "Searchable Excel shortcut reference for Windows and Mac. Every shortcut explains when you would actually use it. Free, no sign-up.",
    steps: [
      "Search by what you want to do, such as \"stop numbers changing\".",
      "Switch between Windows and Mac keys — your platform is picked automatically.",
      "Filter by category, or show just the ones worth learning first.",
      "Read the use case to understand when each one earns its place.",
    ],
    features: [
      "Over ninety shortcuts across eleven categories",
      "Windows and Mac keys side by side, with your platform detected",
      "A use case for every shortcut, not just the key combination",
      "A starred shortlist of the ones worth learning first",
      "Search across actions, use cases and key combinations",
      "Says plainly where a Windows shortcut has no Mac equivalent",
    ],
    faqs: [
      {
        q: "Which version of Excel do these cover?",
        a: "Microsoft 365 and Excel 2016 onwards, on both Windows and Mac. A handful of Windows ribbon sequences have no Mac equivalent, and those are marked rather than filled with a guess.",
      },
      {
        q: "Why do some Mac shortcuts need the Fn key?",
        a: "Mac keyboards map Home, End, Page Up and Page Down onto the arrow keys with Fn. You can also turn on \"Use F1, F2, etc. as standard function keys\" in System Settings so the F-key shortcuts work without Fn.",
      },
      {
        q: "Which shortcuts should I learn first?",
        a: "The starred ones. If you only learn three, make them Ctrl+1 for the Format Cells dialog, Ctrl+Arrow to jump to the edge of your data, and Ctrl+Alt+V then V to paste values.",
      },
    ],
    featured: false,
  },
  {
    id: "calendar",
    name: "Calendar",
    short: "A clear month and year calendar with week numbers and date maths.",
    long:
      "See any month or a whole year at a glance, with ISO week numbers down the side and today marked. Click a date for its week number, day of the year, quarter and how far away it is, and work out the gap between any two dates in days, weeks or working days.",
    category: "datetime",
    route: "/tools/calendar",
    keywords: [
      "online calendar", "calendar with week numbers", "iso week number calendar",
      "yearly calendar", "date calculator", "days between dates", "what week is it",
      "day of year calculator", "printable calendar view",
    ],
    aliases: ["show me a calendar", "what week number is it", "days between dates"],
    icon: "📅",
    accent: "sky",
    browserOnly: true,
    aiInvocable: true,
    input: "none",
    output: "none",
    related: ["age", "timestamp-converter", "notes", "workspace"],
    seoTitle: "Free Online Calendar — Week Numbers, Year View & Date Maths | DO101",
    seoDescription:
      "A clean month and year calendar with ISO week numbers, day-of-year, quarters and a days-between-dates calculator. Free and browser-based.",
    steps: [
      "Browse months with the arrows, or switch to the whole-year view.",
      "Click any date to see its week number, day of the year and quarter.",
      "Choose whether your week starts on Monday or Sunday.",
      "Use the date range boxes to count days, weeks or weekdays between two dates.",
    ],
    features: [
      "Month view and a full twelve-month year view",
      "ISO-8601 week numbers, the standard used across Europe",
      "Day of the year, days remaining and calendar quarter",
      "Days, weeks and working days between any two dates",
      "Monday or Sunday week start",
      "Counted in calendar days, so daylight saving never shifts the answer",
    ],
    faqs: [
      {
        q: "How are week numbers calculated?",
        a: "By ISO-8601: weeks start on Monday, and week 1 is the week containing the first Thursday of the year. This is the standard used across Europe and in most business software, and it can differ from the US convention by a week.",
      },
      {
        q: "Why does the days-between count sometimes differ from other tools?",
        a: "Some tools count the gap and some count both end dates. This one gives the gap — from Monday to Tuesday is one day. The working-days figure counts both ends inclusively, which is how leave is usually booked.",
      },
      {
        q: "Does it handle leap years and daylight saving?",
        a: "Yes. Dates are compared as calendar days rather than by adding 24-hour blocks, which is what causes off-by-one errors around clock changes. February 29 is handled correctly, and the tool tells you whether the year you are looking at is a leap year.",
      },
    ],
    featured: false,
  },
];
