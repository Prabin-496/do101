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
  {
    id: "wbs",
    name: "WBS Builder",
    short: "A project WBS spreadsheet with a Gantt, built for Excel.",
    long:
      "A work breakdown structure the way a project office expects one: a spreadsheet, one row per task, with WBS Number, Task Title, Task Owner, Start Date, Due Date, Duration, % Complete and a Timeline column. The numbering keeps itself in order as you indent, outdent and drag rows around; duration counts itself from the dates; summary rows roll up their children. A Gantt timeline sits beside it and writes back to the same dates, and the Excel download arrives with frozen headings, coloured timeline bars and a page set up to print. Everything runs in your browser, and nothing is uploaded.",
    category: "productivity",
    route: "/tools/wbs",
    keywords: [
      "wbs", "work breakdown structure", "wbs template excel", "wbs generator",
      "work breakdown structure template", "wbs excel", "project breakdown tool",
      "wbs chart maker", "wbs dictionary", "free wbs software", "project scope breakdown",
      "wbs numbering", "wbs diagram", "work breakdown structure chart", "wbs org chart",
      "project tree diagram", "wbs gantt chart", "gantt chart maker", "free gantt chart excel",
      "project timeline template", "gantt chart template",
    ],
    aliases: [
      "work breakdown structure", "wbs template", "break down a project",
      "project task breakdown", "wbs to excel", "gantt chart", "project timeline",
    ],
    icon: "🧱",
    accent: "sky",
    browserOnly: true,
    aiInvocable: false,
    input: "text",
    output: "file",
    related: ["canvas", "csv-to-excel", "excel-shortcuts", "calendar"],
    seoTitle: "Free WBS Builder — Work Breakdown Structure to Excel | DO101",
    seoDescription:
      "Build a work breakdown structure with automatic WBS numbering, custom columns and roll-up totals, then export a real Excel .xlsx. Free, and nothing is uploaded.",
    steps: [
      "Start from a template, paste an outline, or open a spreadsheet you already have.",
      "Add rows, indent them to make sub-tasks, and drag them into order — the WBS numbers follow.",
      "Fill in owners and dates; duration and the timeline work themselves out.",
      "Check it on the Gantt beside the sheet, dragging bars to reschedule if you need to.",
      "Download the Excel workbook, copy the timeline straight into a spreadsheet, or export the chart as a picture.",
    ],
    features: [
      "A spreadsheet first: WBS Number, Task Title, Owner, Start, Due, Duration, % Complete and Timeline",
      "Sticky headings, resizable columns, inline editing, and rows you can drag into order",
      "Duration counted from the dates, and a week-by-week timeline bar, both worked out for you",
      "The sheet, the Gantt and the chart side by side, all updating as you type",
      "A Gantt by day, week, month or quarter with a month band, milestones, progress fill and a today line",
      "Drag a bar to reschedule a task — the dates in the sheet change with it",
      "Copy for Excel: the whole timeline on the clipboard, one column per period, ready to paste",
      "A drag-and-drop chart view: pan, zoom, rearrange cards and rename them in place",
      "Top-down, left-to-right or indented layouts, with elbow, curved or straight connectors",
      "Card shapes, colour themes, and colouring by level, branch or any choice column — per card if you want",
      "Automatic WBS numbering: decimal, outline, letters or a flat list, with prefixes and padding",
      "Custom columns of any type — text, number, currency, percent, date or a fixed list of choices",
      "Roll-ups that total, average or weight the work packages beneath each summary row",
      "Excel export with live =SUM(), =MIN() and =MAX() formulas on the summary rows",
      "Collapsible row groups, column widths and real Excel dates, currency and percentages",
      "Excel files that arrive finished: frozen headings, coloured timeline bars, a % Complete data bar, landscape print setup",
      "Optional WBS dictionary, Gantt and branch-summary sheets in the same workbook",
      "Chart exports as PNG or SVG, or as a diagram file you can keep editing on the Canvas",
      "Imports a spreadsheet back in, reading the hierarchy from codes, level columns or indentation",
      "Saves in your browser as you work — no account, no server, nothing uploaded",
    ],
    faqs: [
      {
        q: "What is a work breakdown structure?",
        a: "A WBS splits the whole of a project into smaller pieces, level by level, until each piece is small enough to estimate and assign. The top levels are phases or major deliverables; the lowest level holds the work packages people actually do. Everything the project delivers should appear somewhere in it, and nothing that is out of scope should.",
      },
      {
        q: "Is the Excel file a real workbook?",
        a: "Yes — it is a genuine .xlsx, not a renamed CSV. Numbers, dates and percentages arrive as real Excel values with number formats, so sorting, filtering and charting work immediately. Summary rows can carry live =SUM(), =MIN() and =MAX() formulas over their children, so the totals recalculate when you edit a task in Excel.",
      },
      {
        q: "Can I add my own columns?",
        a: "Yes. Add as many as you like, choose the type, and say how each one should roll up to its summary rows — sum, earliest, latest, average, or a weighted average by another column. The built-in columns can be renamed, retyped, reordered and hidden too. Your columns appear in the grid and in the download in the order you set.",
      },
      {
        q: "Can I bring in a WBS I already have?",
        a: "Open a .xlsx, .xls, .ods or .csv file and the hierarchy is read from whichever convention it uses: a WBS code column like 1.2.1, one column per level, a numeric level column, or indented task names. Columns that match the ones here are reused; columns that do not are created for you. A pasted outline works too.",
      },
      {
        q: "Can I draw the WBS rather than type it?",
        a: "Yes. The Chart tab is a canvas: drag cards to place them, drag the background to pan, hold ⌘ or Ctrl and scroll to zoom, double-click a card to rename it, and use the +/− bubble on a summary card to fold a branch away. The layout is automatic until you move something, and Auto-layout puts every hand-placed card back. Because the chart and the spreadsheet are the same document, a card you drag is still a row in the Excel download.",
      },
      {
        q: "Does the Excel file need formatting once it opens?",
        a: "No. The headings and the first two columns are frozen, the timeline blocks are coloured by conditional formatting so the bars appear on their own, % Complete gets a data bar, and the page is set to print landscape across one page wide. Dates, durations and percentages are real Excel values underneath, so you can sort, filter and chart them. Turn the formatting off in Layout & export if you would rather have a plain sheet.",
      },
      {
        q: "How do I get a Gantt chart into Excel?",
        a: "Two ways, and both keep real dates rather than pictures. Copy for Excel puts the whole table on the clipboard — task, dates, duration, percent complete, and one column per day, week, month or quarter with a block where the task runs — so you paste it straight into a sheet and can see the shape of the plan at once; select the period columns and apply a conditional format to turn the blocks into coloured bars. Or download the .xlsx, which carries the same thing as its own Gantt sheet alongside the WBS.",
      },
      {
        q: "Where do the Gantt bars come from?",
        a: "The start and finish columns, which you can point at any date columns you like. Work packages get a bar from their own dates; summary tasks span their children automatically, because their start rolls up as the earliest and their finish as the latest. A task with only one date is drawn as a single day, which is how a milestone behaves. Percent complete fills the bar, and there is a dashed line for today.",
      },
      {
        q: "Can I export the chart as a picture?",
        a: "Download it as a PNG for a slide or a document, or as an SVG if you want it to stay sharp at any size. You can also copy the image straight to the clipboard. For free-form work — extra shapes, arrows, annotations — Send to Canvas saves a diagram file that opens in the DO101 Canvas.",
      },
      {
        q: "Where is my work saved?",
        a: "In this browser, on this device, and nowhere else. There is no account and no server, which is what keeps the tool free and private — and also means the breakdown will not appear on your other devices, and clearing your browsing data removes it. Use Save project file for a backup you can reopen here or keep alongside the spreadsheet.",
      },
      {
        q: "How deep should a WBS go?",
        a: "Far enough that each work package can be estimated, owned and tracked by one person or team, and no further. A common rule of thumb is that a work package should be somewhere between eight and eighty hours of work. Three or four levels covers most projects; more than that usually means the schedule, not the scope, is being broken down.",
      },
    ],
    featured: true,
  },
  {
    id: "canvas",
    name: "Canvas",
    short: "Draw, diagram and explain on one infinite white canvas.",
    long:
      "A whiteboard and a draw.io-style diagram editor in one place. Sketch with the pen, highlight what matters, drop in a screenshot and draw on top of it — then place a real flowchart shape, type in it, and drag a blue arrow to the next one so the connector follows them both about. Sticky notes, text and arrows sit alongside the boxes, there is a laser pointer for explaining live, and every fill, border, line and label can be restyled. Keep several boards for a step-by-step explanation and download any of them as a PNG or SVG. It all runs on your own device, with no account and nothing uploaded.",
    category: "productivity",
    route: "/tools/canvas",
    keywords: [
      "online whiteboard", "free whiteboard", "digital whiteboard", "draw online", "drawing tool",
      "diagram maker", "flowchart maker", "draw.io alternative", "drawio", "diagrams.net alternative",
      "free flowchart tool", "online diagram tool", "org chart maker", "mind map maker",
      "network diagram", "uml diagram", "process flow diagram", "lucidchart alternative",
      "excalidraw alternative", "miro alternative", "virtual whiteboard", "infinite canvas",
      "sketch online", "explain with drawing", "teaching whiteboard", "annotate screenshot",
    ],
    aliases: [
      "white board", "drawing board", "sketch pad", "scribble", "doodle online",
      "draw and explain", "teach online drawing", "markup a screenshot",
      "draw io", "dwar.io", "flow chart creator", "make a flowchart", "chart maker",
      "whiteboard diagram", "process map", "system design diagram",
      "diagram maker", "whiteboard",
    ],
    icon: "🎨",
    accent: "sky",
    browserOnly: true,
    aiInvocable: false,
    input: "none",
    output: "file",
    related: ["wbs", "notes", "image-compressor", "workspace"],
    seoTitle: "Free Online Whiteboard & Diagram Maker — Draw and Explain | DO101",
    seoDescription:
      "Draw freehand and build flowcharts on one canvas: pen, highlighter, sticky notes, laser pointer and draw.io-style shapes. Free, no account, nothing uploaded.",
    steps: [
      "Pick the pen on the left and draw straight onto the canvas, or pick a shape to place one.",
      "Drag a shape onto the canvas to size it as you place it, then type its label.",
      "Hover a shape and click a blue arrow to add the next one, already connected.",
      "Paste or drop a screenshot to draw, highlight and point at what is on it.",
      "Restyle anything on the right — fill, border, ink, text, paper and connector routing.",
      "Add a board for each step, then download a PNG or SVG — or Save to keep the lot.",
    ],
    features: [
      "Freehand pen, highlighter and eraser on the same canvas as the shapes",
      "A searchable shape library — process, decision, database, document and more",
      "Blue quick-add arrows that place the next shape already connected",
      "Connectors that re-route themselves whenever either shape moves",
      "Sticky notes you can join up with arrows, plus free text and floating arrows",
      "A laser pointer that fades on its own — for explaining live, never saved",
      "Paste or drop screenshots and photos, then annotate them",
      "Alignment guides and snap-to-grid for shapes; free movement for sketching",
      "Templates: flowchart, org chart, mind map, system design, lanes, network and a retro board",
      "Plain, grid, dotted or lined paper in any colour you like",
      "Several boards in one file, for explaining something a step at a time",
      "Full styling on any selection, right-click menus, copy and paste, and layer ordering",
      "Download as PNG up to 4×, as SVG for print, or every board at once as a ZIP",
      "Copy image pastes directly into Word, Excel, PowerPoint, Google Docs and Slides",
      "Opens the files the old Whiteboard and Diagram Maker saved",
      "Autosaves in your browser — no account, and nothing is uploaded",
    ],
    faqs: [
      {
        q: "Is this a whiteboard or a diagram tool?",
        a: "Both, on one canvas — that is the point of it. Ink, sticky notes and screenshots live in the same document as proper flowchart shapes and connectors, so you can scribble a note beside a box, circle part of a diagram in red, or draw an arrow to a screenshot. Nothing makes you choose a mode first.",
      },
      {
        q: "What is the difference between a drawn arrow and a connector?",
        a: "An arrow drawn with the arrow tool is a free line: both ends stay exactly where you put them, which is what you want when pointing at part of a picture. A connector is made by dragging one of the blue arrows from a shape, and it is attached — move either shape and it re-routes itself. Connectors can be labelled and given right-angle, straight or curved routing.",
      },
      {
        q: "Is this a free alternative to draw.io?",
        a: "For the everyday job people open draw.io (diagrams.net) for — flowcharts, org charts, network and system diagrams — yes, with no account, no watermark and no export limit. It is deliberately smaller in scope: there are no plugin libraries, no cloud storage integrations and no real-time co-editing, so if you need those, draw.io itself is still the better pick. What it adds instead is freehand drawing over the top.",
      },
      {
        q: "Can I use it to explain something on a call?",
        a: "Yes — that is what it is built for. Share your screen, draw as you talk, and press X for the laser pointer to point at things without leaving a mark. The laser trail fades after a second and is never saved or exported. Use one board per step and you can hand the whole explanation over afterwards as a ZIP of numbered PNGs.",
      },
      {
        q: "Can I draw on top of a screenshot?",
        a: "Yes. Copy a screenshot and press ⌘V, or drag the image file onto the canvas. It is scaled down to a sensible size, and you can then draw, highlight, add arrows and label it, then export the whole thing as one picture.",
      },
      {
        q: "How do I connect two shapes?",
        a: "Hover a shape and four blue arrows appear around it. Click one and a new shape is added on that side, already connected. Drag one onto an existing shape to join those two instead, or drop it on empty space to create and connect in a single gesture. Double-click any connector to give it a label.",
      },
      {
        q: "How does the eraser work?",
        a: "Rubbing over something removes the whole thing rather than punching a hole in the middle of it, which is how digital boards behave and is almost always what you want. Deleting a shape takes its connectors with it. Undo brings any of it straight back.",
      },
      {
        q: "Is anything I draw uploaded?",
        a: "No. The canvas, the pictures you paste onto it, the templates and both exporters all run in your browser. There is no upload endpoint behind this tool, so a screenshot of something private, or a diagram of an internal system, never leaves your device.",
      },
      {
        q: "Where is my work saved, and will it still be here tomorrow?",
        a: "It autosaves into this browser on this device, so a refresh or an accidental tab close will not lose it. It is not synced to an account, which also means it will not appear on your other devices and clearing your browsing data removes it. Press Save to download a file you can reopen here at any time. Very large boards full of pictures can outgrow what a browser will hold, and the tool tells you when that happens.",
      },
      {
        q: "I have files from the old Whiteboard and Diagram Maker. Can I still open them?",
        a: "Yes. Press Open file and both formats load straight in, shapes, connectors, ink and all — a saved diagram arrives as one board. Anything either tool had left autosaved in this browser is carried over automatically the first time you open the canvas.",
      },
      {
        q: "What are boards for?",
        a: "Each board is a separate page in the same file. They are useful for explaining something a step at a time — one board per step — and you can download them all at once as a ZIP of numbered PNGs.",
      },
      {
        q: "Should I download the PNG or the SVG?",
        a: "PNG for slides, chat and documents — pick 2× or higher so it stays sharp on a retina screen. SVG for print, for a website, or when someone needs to recolour it later, because it stays sharp at any size and the text stays real text. Pictures you pasted are carried inside both.",
      },
      {
        q: "Can I paste it into Word or Excel?",
        a: "Yes. Press Copy and then paste into Word, Excel, PowerPoint, Google Docs, Slides, an email or a chat — it arrives as a picture you can resize like any other. Choose 3× or 4× first if it is going to be printed, or download the SVG, which Microsoft 365 places as a true vector.",
      },
      {
        q: "Can I open a .drawio or .vsdx file?",
        a: "Not yet. Those are different formats with their own XML schemas. This tool reads the .do101.json files it writes itself, so a drawing started here can always be finished here.",
      },
      {
        q: "Does it work on a phone, a tablet or with a stylus?",
        a: "Yes. Drawing, placing, dragging, connecting and resizing all work by touch and by pen, and the panels stack on a narrow screen. A stylus on a tablet is the nicest way to sketch; a mouse and a larger canvas are far more comfortable for a diagram past a handful of shapes.",
      },
    ],
    featured: true,
  },
];
