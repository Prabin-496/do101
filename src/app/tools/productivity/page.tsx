import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "productivity",
  path: "/tools/productivity",
  title: "Free Productivity Tools — Meetings, Tasks, Reports, Planner | DO101",
  description:
    "Free work tools in your browser: meeting action items, task lists from email, a daily planner, SOPs, weekly reports, follow-ups, notes and more. Nothing uploaded.",
  heading: "Productivity tools",
  lead: "Tools for the admin that eats a working day — meeting follow-ups, buried tasks, reports, procedures, plans and replies — plus notes, project plans and diagrams. No account, no AI service, and nothing uploaded.",
  body: [
    {
      heading: "From meetings and messages to a plan",
      text: (
        <>
          <p>
            <Link href="/tools/meeting-action-items">Meeting Notes to Action Items</Link> turns notes or a Zoom,
            Teams or Meet transcript into tasks with owners and deadlines, decisions and a follow-up email. The{" "}
            <Link href="/tools/task-extractor">Email &amp; Chat Task Extractor</Link> does the same for an inbox or a
            Slack channel, with what was asked of you first, and{" "}
            <Link href="/tools/what-did-i-miss">What Did I Miss?</Link> ranks the messages from your time off by
            how much they need you.
          </p>
          <p>
            Then the <Link href="/tools/daily-planner">Daily Work Planner</Link> fits those tasks around the meetings
            you already have — and says honestly what will not fit today.
          </p>
        </>
      ),
    },
    {
      heading: "Writing it up",
      text: (
        <>
          <p>
            The <Link href="/tools/work-report-generator">Report Generator</Link> turns your work notes into a
            stand-up or weekly report, grouped by project with hours totalled. The{" "}
            <Link href="/tools/sop-generator">SOP Generator</Link> turns a rough explanation of a process into a
            numbered procedure in Word. The <Link href="/tools/customer-inquiry-replies">Customer Inquiry Reply
            Helper</Link> answers repeat questions from your own FAQ, and the{" "}
            <Link href="/tools/follow-up-tracker">Sales Follow-up Tracker</Link> tells you which leads are overdue,
            with the message drafted.
          </p>
          <p>
            <Link href="/tools/document-search">Private Document Search</Link> searches across your PDFs, Word files
            and spreadsheets without uploading them, and the{" "}
            <Link href="/tools/japanese-workplace">Japanese Workplace Message Helper</Link> explains what business
            Japanese really means and drafts a correctly polite reply.
          </p>
        </>
      ),
    },
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
    {
      q: "Are the meeting, task and report tools AI?",
      a: "No. They use clear, visible rules — which is why they are free, instant and private. Every result shows the rule that produced it and can be edited before you download it as Excel, Word or a calendar file.",
    },
    {
      q: "Where is my work saved?",
      a: "In the files you download. There is no DO101 database: Excel files you save can be opened again in the same tool to carry on, and a few tools keep a working draft in your own browser until you clear it.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
