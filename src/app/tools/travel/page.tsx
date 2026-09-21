import type { Metadata } from "next";
import Link from "next/link";
import { CategoryLanding, categoryMetadata, type CategoryPageConfig } from "@/components/tools/CategoryLanding";

const config: CategoryPageConfig = {
  category: "travel",
  path: "/tools/travel",
  title: "Free Travel Tools — Station Alarm & Weather | DO101",
  description:
    "Free travel tools: a GPS train station alarm that wakes you before your stop, even in tunnels, and a plain-English weather forecast for anywhere you are going.",
  heading: "Travel tools",
  lead: "Getting there, and being woken when you arrive — plus knowing what the weather will actually feel like when you step off.",
  body: [
    {
      heading: "Never sleep past your stop",
      text: (
        <p>
          The <Link href="/tools/station-alarm">Train Station Alarm</Link> was built for a very real
          problem: falling asleep on a train and waking three stations too late. Pick your
          destination, put the phone down, and it wakes you with vibration and sound as you come
          within range. Once armed it runs on GPS alone, so it keeps working in a tunnel or anywhere
          the mobile signal drops.
        </p>
      ),
    },
    {
      heading: "Weather that answers the question",
      text: (
        <p>
          <Link href="/tools/weather">Weather</Link> tells you what it is like out rather than handing
          you a table: whether it feels colder than the thermometer says and why, when the rain starts
          and stops, and whether you need a coat, an umbrella or sunscreen. Search for where you are
          travelling to and it is remembered, with times shown local to that place.
        </p>
      ),
    },
  ],
  faqs: [
    {
      q: "Does the station alarm work without mobile signal?",
      a: "Yes. Once it is armed it relies on GPS alone, which does not need a mobile connection, so it keeps tracking through tunnels and dead zones.",
    },
    {
      q: "Can I check the weather for somewhere I am travelling to?",
      a: "Yes. Search for any town or city; it is kept in your recent places so you can switch between home and your destination.",
    },
  ],
};

export const metadata: Metadata = categoryMetadata(config);

export default function Page() {
  return <CategoryLanding config={config} />;
}
