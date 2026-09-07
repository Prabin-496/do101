import type { Metadata } from "next";
import Link from "next/link";
import { AiConsole } from "@/components/ai/AiConsole";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { Faq } from "@/components/tools/Faq";
import { JsonLd } from "@/components/seo/JsonLd";
import { buildMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema, faqSchema } from "@/lib/seo/structured-data";
import { isAiConfigured } from "@/lib/ai/provider";

export const metadata: Metadata = buildMetadata({
  title: "DO101 AI — Describe What You Need, the Right Tool Runs",
  description:
    "Tell DO101 AI what you want to do and it routes you to the right free tool, then runs it in your browser and shows the real output. No account needed.",
  path: "/ai",
});

const FAQS = [
  {
    q: "Does the AI actually run the tools?",
    a: "It picks the tool and pulls out the arguments. The tool itself then runs in your browser using exactly the same code the tool's own page uses, and you see its real output. The assistant never writes a result, so it cannot claim something the tool did not produce.",
  },
  {
    q: "What happens to my text?",
    a: "Your message is sent to DO101's routing endpoint so a tool can be chosen. If an AI model is configured on this deployment, the message is forwarded to that provider for routing only. The tool then runs locally in your browser. Don't paste secrets or personal data — use the tool page directly instead, where nothing is sent anywhere.",
  },
  {
    q: "Does DO101 work without the AI?",
    a: "Completely. Every tool has its own page and never depends on the assistant. DO101 AI also has a built-in rule-based router that handles common requests with no AI model at all.",
  },
  {
    q: "Can it compress my image?",
    a: "Not in the chat — image processing needs the file to stay on your device, so the assistant opens the Image Compressor for you instead of pretending to do it.",
  },
];

export default function AiPage() {
  const configured = isAiConfigured();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:py-10">
      <JsonLd
        data={[
          faqSchema(FAQS)!,
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: "DO101 AI", href: "/ai" },
          ]),
        ]}
      />
      <Breadcrumbs
        items={[
          { name: "Home", href: "/" },
          { name: "DO101 AI", href: "/ai" },
        ]}
      />

      <header className="mb-6">
        <h1 className="flex items-center gap-3 text-3xl sm:text-4xl">
          <span aria-hidden className="do-bob">
            🤖
          </span>
          DO101 AI
        </h1>
        <p className="mt-2 text-base font-semibold text-[var(--muted)]">
          Describe what you want to do in plain language. DO101 AI works out which of the{" "}
          <Link href="/tools" className="font-extrabold text-[var(--ink)] underline">
            free tools
          </Link>{" "}
          answers it, runs that tool in your browser, and shows you the real output.
        </p>
      </header>

      {!configured ? (
        <p className="mb-6 rounded-2xl border-2 border-[var(--sun)] bg-[var(--sun-soft)] px-4 py-3 text-sm font-bold">
          <strong>Rules-only mode.</strong> No AI model is configured on this deployment, so
          requests are matched by DO101&rsquo;s built-in rules. Common phrasings work well; unusual
          ones may not match. Every tool still works normally on its own page.
        </p>
      ) : null}

      <div className="mb-10">
        <AiConsole />
      </div>

      <div className="space-y-10">
        <section aria-labelledby="how-heading">
          <h2 id="how-heading" className="mb-4 text-xl sm:text-2xl">
            How DO101 AI works
          </h2>
          <ol className="space-y-3">
            {[
              "You describe the job in your own words.",
              "DO101 matches it to a tool and extracts the arguments — with built-in rules first, and an AI model only when the rules cannot place it.",
              "The tool runs in your browser using the same code its own page uses.",
              "You see the tool's actual output, plus a link to open the full tool.",
            ].map((step, i) => (
              <li key={step} className="do-card flex items-start gap-3 p-4">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--grass)] text-sm font-extrabold text-white">
                  {i + 1}
                </span>
                <span className="pt-1 text-sm font-semibold">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="limits-heading">
          <h2 id="limits-heading" className="mb-3 text-xl sm:text-2xl">
            What it deliberately will not do
          </h2>
          <ul className="space-y-2">
            {[
              "It will not answer general questions — it is a router for DO101 tools, not a chatbot.",
              "It will not process your images or files; those tools need the file to stay on your device.",
              "It will not describe a result it did not get from a real tool run.",
            ].map((item) => (
              <li
                key={item}
                className="flex items-start gap-2 rounded-2xl bg-[var(--panel)] px-4 py-3 text-sm font-semibold"
              >
                <span aria-hidden className="text-[var(--cherry)]">
                  ✕
                </span>
                {item}
              </li>
            ))}
          </ul>
        </section>

        <Faq items={FAQS} />
      </div>
    </div>
  );
}
