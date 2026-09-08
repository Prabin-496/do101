import type { Metadata } from "next";
import { ToolShell } from "@/components/tools/ToolShell";
import { EarthGlobe } from "@/components/tools/geo/EarthGlobe";
import { JsonLd } from "@/components/seo/JsonLd";
import { toolMetadata } from "@/lib/seo/metadata";
import { toolSchema, faqSchema, breadcrumbSchema } from "@/lib/seo/structured-data";
import { getTool } from "@/lib/tools/tool-registry";
import { loadCountries, formatArea } from "@/lib/geo/countries";

const tool = getTool("earth-globe")!;
export const metadata: Metadata = toolMetadata(tool);

const REGION_ORDER = ["Africa", "Americas", "Asia", "Europe", "Oceania", "Antarctic"];

export default async function Page() {
  // Rendered on the server so the reference table is in the HTML: useful without
  // JavaScript, readable by a screen reader, and crawlable.
  const countries = await loadCountries();
  const byRegion = REGION_ORDER.map((region) => ({
    region,
    countries: countries.filter((c) => c.region === region),
  })).filter((group) => group.countries.length > 0);

  return (
    <>
      <JsonLd
        data={[
          toolSchema(tool),
          faqSchema(tool.faqs)!,
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "Learn", href: "/tools/earth-globe" },
            { name: tool.name, href: tool.route },
          ]),
        ]}
      />
      <ToolShell
        tool={tool}
        extraContent={
          <section aria-labelledby="reference-heading">
            <h2 id="reference-heading" className="mb-3 text-xl sm:text-2xl">
              Every country and its capital
            </h2>
            <p className="mb-5 text-sm font-semibold text-[var(--muted)]">
              All {countries.length} countries and territories in the dataset, grouped by region.
              Handy as a reference on its own — and every one of them is on the globe above.
            </p>

            <div className="space-y-8">
              {byRegion.map((group) => (
                <div key={group.region}>
                  <h3 className="mb-3 text-lg">
                    {group.region}{" "}
                    <span className="text-sm font-extrabold text-[var(--muted)]">
                      ({group.countries.length})
                    </span>
                  </h3>
                  <div className="do-scroll overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr className="border-b-2 border-[var(--border)]">
                          <th scope="col" className="py-2 pr-4 font-extrabold">
                            Country
                          </th>
                          <th scope="col" className="py-2 pr-4 font-extrabold">
                            Capital
                          </th>
                          <th scope="col" className="py-2 pr-4 font-extrabold">
                            Area
                          </th>
                          <th scope="col" className="py-2 font-extrabold">
                            Code
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.countries.map((country) => (
                          <tr key={country.code} className="border-b border-[var(--border)]">
                            <td className="py-1.5 pr-4 font-bold">
                              <span aria-hidden>{country.flag}</span> {country.name}
                            </td>
                            <td className="py-1.5 pr-4 text-[var(--muted)]">
                              {country.capital.join(", ") || "—"}
                            </td>
                            <td className="whitespace-nowrap py-1.5 pr-4 text-[var(--muted)]">
                              {formatArea(country.area)}
                            </td>
                            <td className="py-1.5 font-mono text-xs text-[var(--muted)]">
                              {country.code}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>
          </section>
        }
      >
        <EarthGlobe />
      </ToolShell>
    </>
  );
}
