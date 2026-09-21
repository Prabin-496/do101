import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "productivity",
  path: "/tools/productivity",
  title: "Free Productivity Tools — Notes, WBS, Canvas, Workspace | DO101",
  description:
    "Free productivity tools in your browser: private notes, a WBS builder with Gantt and Excel export, a whiteboard and diagram canvas, a split-screen workspace and more.",
  heading: "Productivity tools",
  lead: "Small utilities that save a surprising amount of time — for notes, project plans, diagrams and getting several jobs onto one screen. No account, and nothing uploaded.",
  body: [
    {
      heading: "Planning and thinking",
      text: (
        <>
          <p>
            The <Link href="/tools/wbs">WBS Builder</Link> produces a work breakdown structure the way
            a project office expects one: numbered rows that renumber themselves as you indent and
            reorder, durations counted from the dates, summary rows that roll up their children, a
            Gantt timeline beside it, and an Excel download set up to print.
          </p>
          <p>
            <Link href="/tools/canvas">Canvas</Link> is a whiteboard and a flowchart editor in one:
            sketch, drop in a screenshot and draw over it, then connect real diagram shapes with
            arrows that follow them. <Link href="/tools/notes">Notes</Link> saves as you type,
            searches everything and exports to Markdown.
          </p>
        </>
      ),
    },
    {
      heading: "Working faster",
      text: (
        <>
          <p>
            The <Link href="/workspace">Split-Screen Workspace</Link> puts two, three or four DO101
            tools side by side — translate on one side and take notes on the other, or keep a
            calendar beside your writing — and remembers the layout.{" "}
            <Link href="/tools/excel-shortcuts">Excel Shortcuts</Link> is searchable by what you want
            to do rather than which keys to press, and says when each shortcut is worth reaching for.
          </p>
          <p>
            <Link href="/tools/talkie-genz">TalkieGenZ</Link> turns a browser into a walkie-talkie for
            up to six people, voice going straight from browser to browser.{" "}
            <Link href="/tools/phone-check">PhoneCheck</Link> reads a number against the published
            numbering plans — country, line type, region — and says where each fact came from.
          </p>
        </>
      ),
    },
    {
      heading: "Private because there is nowhere for it to go",
      text: (
        <p>
          Notes, plans, diagrams and phone numbers stay in your browser. There is no DO101 account,
          so there is no database of your work to lose or leak — and nothing to pay for.
        </p>
      ),
    },
  ],
  faqs: [
    {
      q: "Where are my notes and plans saved?",
      a: "In your own browser's storage, on the device you are using. That is what makes them private and free, and it also means clearing your browser's site data deletes them — export anything you want to keep.",
    },
    {
      q: "Can I open the WBS in Excel?",
      a: "Yes. The WBS Builder downloads a real Excel workbook with frozen headings, the timeline bars coloured in and a page set up to print, and it can reopen its own export.",
    },
    {
      q: "Do these tools need an account?",
      a: "No. None of them has a sign-up, a trial or a premium tier.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
