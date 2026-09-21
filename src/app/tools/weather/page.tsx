import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { Weather } from "@/components/tools/weather/Weather";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";

const tool = getTool("weather")!;
export const metadata: Metadata = toolMetadata(tool);

const EXPLAINED: [string, string][] = [
  ["Feels like", "Wind takes warmth off your skin and humidity stops sweat evaporating. This is the temperature your body is actually responding to."],
  ["Beaufort force", "Wind described by what you would notice — leaves rustling, umbrellas turning inside out, hard work walking into it."],
  ["Dew point", "The honest measure of mugginess. 80% humidity at 5°C is crisp; at 28°C it is unbearable. Dew point tells the two apart."],
  ["UV index", "How fast the sun burns. Under 3 is harmless; 8 and above burns fair skin in about fifteen minutes."],
  ["Pressure trend", "Falling more than 3 hPa in three hours is the classic sign of a front — wind and rain within a few hours."],
  ["Rain window", "When it starts and when it stops, instead of a daily percentage you cannot plan around."],
];

export default function Page() {
  return (
    <>
      <JsonLd
        data={[
          toolSchema(tool),
          faqSchema(tool.faqs)!,
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "Travel", href: "/tools?category=travel" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell
        tool={tool}
        wide
        extraContent={
          <>
            <section aria-labelledby="explained-heading">
              <h2 id="explained-heading" className="mb-3 text-xl sm:text-2xl">
                Every number, explained
              </h2>
              <p className="mb-3 text-sm font-semibold text-[var(--muted)]">
                Most weather pages hand you a table and leave you to interpret it. This one does the
                interpreting, using the same conventions forecasters use.
              </p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {EXPLAINED.map(([title, what]) => (
                  <li key={title} className="rounded-2xl bg-[var(--panel)] px-4 py-3">
                    <p className="text-sm font-extrabold">{title}</p>
                    <p className="text-xs font-semibold text-[var(--muted)]">{what}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="privacy-heading">
              <h2 id="privacy-heading" className="mb-3 text-xl sm:text-2xl">
                Where your location goes
              </h2>
              <div className="space-y-2 rounded-2xl bg-[var(--panel)] px-4 py-3">
                <p className="text-sm font-semibold">
                  Nothing asks your browser for a position until you press{" "}
                  <strong>Use my location</strong>, and you can skip it entirely by searching for
                  your town — the forecast is the same either way.
                </p>
                <p className="text-sm font-semibold text-[var(--muted)]">
                  When you do share it, the coordinates go from your browser straight to Open-Meteo
                  for the forecast and to OpenStreetMap for the place name. They are rounded first,
                  because a forecast is identical across a whole town. There is no DO101 server in
                  the middle — the page runs entirely in your browser, which is also why there is
                  nothing to sign up for.
                </p>
              </div>
            </section>
          </>
        }
      >
        <Weather />
      </ToolShell>
    </>
  );
}
