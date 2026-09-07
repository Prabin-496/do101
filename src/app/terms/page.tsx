import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { Prose, PageHeader } from "@/components/layout/Prose";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Use — DO101",
  description:
    "The terms that apply when you use DO101's free online tools, calculators and games, including disclaimers, acceptable use and limitations.",
  path: "/terms",
});

const UPDATED = "7 September 2026";

export default function TermsPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Terms", href: "/terms" }]} />
      <PageHeader title="Terms of use" lead={`Last updated ${UPDATED}.`} />

      <Prose>
        <p>
          These terms apply to your use of {SITE.url} (&ldquo;DO101&rdquo;). By using the site you
          agree to them. They are written to be readable rather than impressive; if something is
          unclear, ask on the <Link href="/contact">contact page</Link>.
        </p>

        <h2>The service</h2>
        <p>
          DO101 provides free online tools, calculators and games. No account is required. Most tools
          run entirely inside your browser, as described on the{" "}
          <Link href="/privacy">privacy page</Link>.
        </p>

        <h2>Acceptable use</h2>
        <p>You agree not to:</p>
        <ul>
          <li>Use DO101 for anything unlawful, or to process content you have no right to process.</li>
          <li>Attempt to disrupt, overload or gain unauthorised access to the site or its endpoints.</li>
          <li>Scrape or automate the site in a way that degrades it for other people.</li>
          <li>Use the AI endpoint to attempt to bypass its limits, or resell access to it.</li>
        </ul>

        <h2>Your content</h2>
        <p>
          You keep all rights to whatever you put into a DO101 tool. For browser-based tools nothing
          is transmitted to us, so we neither receive nor store it. You are responsible for ensuring
          you are allowed to process the content you use.
        </p>

        <h2>Accuracy and disclaimers</h2>
        <p>
          DO101 is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of
          any kind, whether express or implied, including any implied warranties of merchantability,
          fitness for a particular purpose and non-infringement.
        </p>
        <p>
          The tools are built carefully and tested, but you should verify anything important.
          Specifically:
        </p>
        <ul>
          <li>
            <strong>Calculators are informational.</strong> The BMI calculator in particular is a
            rough screening tool and is not medical advice. Nothing on DO101 is medical, legal,
            financial or professional advice.
          </li>
          <li>
            <strong>Decoding is not verifying.</strong> The JWT decoder reads a token; it does not
            and cannot confirm that the token is authentic.
          </li>
          <li>
            <strong>Lossy conversion is lossy.</strong> Compressing or converting an image changes
            it. Keep your original.
          </li>
        </ul>

        <h2>Service availability</h2>
        <p>
          DO101 may change, suspend or discontinue any part of the site at any time, and does not
          promise uninterrupted availability. Typing Battle depends on a free third-party signalling
          service and on your network permitting peer-to-peer connections, so it may be unavailable
          in some conditions.
        </p>

        <h2>News content</h2>
        <p>
          The news pages aggregate headlines from public RSS and Atom feeds. All headlines,
          excerpts and articles remain the property of their publishers, and every item links to
          the original. DO101 does not reproduce full articles, does not claim authorship, and is
          not responsible for the accuracy of anything a third party publishes.
        </p>
        <p>
          Inclusion of a feed is not an endorsement of its content. If you publish one of the listed
          feeds and would prefer not to be included, contact us and it will be removed.
        </p>

        <h2>Third-party services</h2>
        <p>
          DO101 uses third-party services including its hosting provider, a public WebRTC signalling
          broker for Typing Battle, and — where configured — an AI model provider and Google AdSense.
          Those services have their own terms and privacy policies, and DO101 is not responsible for
          them.
        </p>

        <h2>Advertising</h2>
        <p>
          DO101 may display advertising to cover its costs. Ads are labelled and kept out of the way
          of the tools. DO101 does not endorse advertised products and is not responsible for
          third-party sites you reach through an advertisement.
        </p>

        <h2>Limitation of liability</h2>
        <p>
          To the maximum extent permitted by law, DO101 and its operator are not liable for any
          indirect, incidental, special or consequential damages, or for any loss of data, profits or
          goodwill, arising from your use of the site. Because DO101 is provided free of charge,
          total liability for any claim is limited to the amount you paid to use it, which is zero.
        </p>
        <p>
          Nothing in these terms excludes liability that cannot lawfully be excluded, and some
          jurisdictions do not allow certain exclusions — in which case those exclusions do not apply
          to you.
        </p>

        <h2>Changes</h2>
        <p>
          These terms may be updated. The date at the top of the page shows when they last changed,
          and continuing to use DO101 after a change means you accept the updated terms.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about these terms can be sent through the{" "}
          <Link href="/contact">contact page</Link>.
        </p>
      </Prose>
    </div>
  );
}
