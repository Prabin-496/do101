import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "datetime",
  path: "/tools/datetime",
  title: "Free Clock & Time Tools — Full-Screen Clock | DO101",
  description: "A free full-screen digital and flip clock plus timestamp conversion and date maths. No download, no ads, and everything reads your own device clock.",
  heading: "Date & time tools",
  lead: "A clock worth leaving on screen, plus the date and timestamp maths you occasionally need. Nothing to install.",
  body: [
    {
      heading: "A clock you can actually leave running",
      text: (
        <>
          <p>The <Link href="/tools/digital-clock">full-screen clock</Link> exists because the good desktop options are downloads, and the good web options are covered in advertising. This one is neither: open it, press full screen, and the controls fade away.</p>
          <p>It offers the classic split-flap flip cards or plain glowing digits, six themes, sixteen time zones, and — where the browser allows it — a screen wake lock so the display does not dim halfway through a meeting.</p>
          <p>Settings are remembered in your browser, so the second time you open it, it is already the clock you wanted.</p>
        </>
      ),
    },
    {
      heading: "The rest of the time tools",
      text: (
        <>
          <p>The <Link href="/tools/timestamp-converter">Unix Timestamp Converter</Link> turns epoch numbers into readable dates and back, detecting seconds versus milliseconds automatically.</p>
          <p>The <Link href="/calculators/age">Age Calculator</Link> does exact calendar arithmetic — real month lengths and leap years, not a 30-day approximation — which is also the fastest way to count the days between two dates.</p>
        </>
      ),
    },
  ],
  faqs: [
    {
      q: "Is the clock accurate?",
      a: "It reads your device's clock, so it is exactly as accurate as your computer. Time zone conversion uses the browser's own IANA database, which stays current with system updates.",
    },
    {
      q: "Will my screen dim while the clock is showing?",
      a: "Not while the browser grants a screen wake lock, which most current desktop browsers do in full screen. A small note appears on screen when the lock is active.",
    },
    {
      q: "Does it work offline?",
      a: "Yes. Once the page has loaded there is nothing further to fetch, so the clock keeps running with no connection.",
    },
    {
      q: "Do I need to install anything?",
      a: "No. It is a web page — no download, no extension, no account.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
