import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { Prose, PageHeader } from "@/components/layout/Prose";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Contact DO101 — Feedback, Bug Reports & Tool Requests",
  description:
    "Get in touch with DO101 about a bug, a tool you would like to see, a privacy question or anything else.",
  path: "/contact",
});

export default function ContactPage() {
  const email = SITE.contactEmail;

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Contact", href: "/contact" }]} />
      <PageHeader
        title="Contact"
        lead="Bugs, ideas, privacy questions or a tool you wish existed — all welcome."
      />

      <Card className="mb-8 p-6">
        {email ? (
          <>
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
              Email
            </p>
            <p className="mt-1 break-all text-2xl font-extrabold">
              <a href={`mailto:${email}`} className="underline">
                {email}
              </a>
            </p>
            <p className="mt-3 text-sm font-semibold text-[var(--muted)]">
              We read everything. Replies are best-effort — DO101 is a small project, not a support
              desk with a rota.
            </p>
            <div className="mt-5">
              <ButtonLink href={`mailto:${email}`} tone="grass">
                Send an email
              </ButtonLink>
            </div>
          </>
        ) : (
          <>
            <p className="text-xs font-extrabold uppercase tracking-widest text-[var(--muted)]">
              Contact address
            </p>
            <p className="mt-2 text-lg font-extrabold">Not configured on this deployment yet.</p>
            <p className="mt-3 text-sm font-semibold text-[var(--muted)]">
              DO101 deliberately does not display a made-up support address. The contact email is
              read from the <code className="font-mono">NEXT_PUBLIC_CONTACT_EMAIL</code> environment
              variable; once the site owner sets it, it appears here and in the site metadata.
            </p>
          </>
        )}
      </Card>

      <Prose>
        <h2>What is worth writing about</h2>
        <ul>
          <li>
            <strong>A bug.</strong> Tell us the tool, the browser, and what you expected to happen.
            A screenshot helps enormously.
          </li>
          <li>
            <strong>A wrong answer.</strong> If a calculator disagrees with your maths, we want to
            know — include the numbers you entered.
          </li>
          <li>
            <strong>A missing tool.</strong> Tell us what you were trying to do, not just the tool
            name. The job matters more than the label.
          </li>
          <li>
            <strong>Privacy questions.</strong> Anything the{" "}
            <Link href="/privacy">privacy page</Link> does not answer clearly.
          </li>
          <li>
            <strong>Accessibility problems.</strong> If a tool is hard to use with a keyboard or a
            screen reader, that counts as a bug.
          </li>
        </ul>

        <h2>What DO101 cannot help with</h2>
        <p>
          We cannot recover a file you did not save. Browser-based tools do not keep a copy of
          anything — that is the point of them — so once a tab is closed the result is gone.
        </p>
      </Prose>

      <div className="mt-10 flex flex-wrap gap-3">
        <ButtonLink href="/tools" tone="panel">
          Browse the tools
        </ButtonLink>
        <ButtonLink href="/about" tone="panel">
          About DO101
        </ButtonLink>
      </div>
    </div>
  );
}
