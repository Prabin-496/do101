import type { Metadata } from "next";
import Link from "next/link";
import { Breadcrumbs } from "@/components/tools/Breadcrumbs";
import { Prose, PageHeader } from "@/components/layout/Prose";
import { LocalDataControls } from "@/components/tools/LocalDataControls";
import { buildMetadata } from "@/lib/seo/metadata";
import { SITE } from "@/lib/site";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy — What DO101 Collects | DO101",
  description:
    "Exactly what happens to your data on DO101: which tools run entirely in your browser, what is stored locally, and what the optional AI router sends.",
  path: "/privacy",
});

const UPDATED = "7 September 2026";

export default function PrivacyPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:py-10">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Privacy", href: "/privacy" }]} />
      <PageHeader
        title="Privacy"
        lead={`How DO101 handles your data. Last updated ${UPDATED}.`}
      />

      <Prose>
        <h2>The short version</h2>
        <ul>
          <li>Almost every tool runs entirely in your browser. Those files and texts never reach a server.</li>
          <li>DO101 has no accounts, so there is nothing to sign up for and no profile to build.</li>
          <li>Favourites, recent tools and game scores are stored in your own browser, not on a server.</li>
          <li>The only feature that sends anything off your device is the optional AI router, and only the message you type.</li>
        </ul>

        <h2>Tools that run entirely in your browser</h2>
        <p>
          The image compressor, image resizer, JPG↔PNG converters, QR generator, word and character
          counters, text cleaner, text diff, case converter, JSON formatter and validator, Base64
          tool, URL encoder and decoder, UUID generator, JWT decoder, timestamp converter, regex
          tester, hash generator, all four calculators and all four games run on your device using
          your browser&rsquo;s own APIs.
        </p>
        <p>
          <strong>
            Your file is processed in your browser and is not uploaded by DO101.
          </strong>{" "}
          There is no upload endpoint for these tools, so the data physically cannot reach us.
        </p>

        <h2 id="local-data">What is stored on your device</h2>
        <p>
          DO101 uses your browser&rsquo;s <code>localStorage</code> to remember a few things so the
          site is nicer to come back to:
        </p>
        <ul>
          <li>Your recently used tools</li>
          <li>Personal bests for the games</li>
          <li>An XP total and daily streak, both calculated from your own activity on this device</li>
          <li>Your light/dark theme preference</li>
        </ul>
        <p>
          None of this is transmitted anywhere, and it is not synced between your devices. You can
          erase all of it at any time:
        </p>
      </Prose>

      <div className="my-6">
        <LocalDataControls />
      </div>

      <Prose>
        <h2>DO101 AI</h2>
        <p>
          The <Link href="/ai">AI router</Link> is the one feature that leaves your browser. When you
          send a message there, the text is posted to a DO101 endpoint so a tool can be chosen. If an
          AI model provider is configured on this deployment, that message is forwarded to the
          provider purely to pick a tool and pull out its arguments; the provider&rsquo;s own terms
          then apply to that request. The chosen tool afterwards runs locally in your browser.
        </p>
        <p>
          Messages are not stored in a DO101 database. Ordinary server logs may briefly record
          request metadata such as IP address and timestamp, which is also what powers the basic
          rate limiting that stops the endpoint being abused.
        </p>
        <p>
          <strong>Please do not paste passwords, API keys, tokens or personal data into DO101 AI.</strong>{" "}
          Use the tool&rsquo;s own page for anything sensitive — nothing leaves your browser there.
        </p>

        <h2>News</h2>
        <p>
          The <Link href="/news">news pages</Link> read public RSS and Atom feeds published by the
          outlets themselves. That fetching happens on DO101&rsquo;s server on a schedule — at most
          once every 20 minutes — not in your browser, so <strong>the publishers never see your
          IP address or anything else about you</strong> while you are browsing the headlines.
        </p>
        <p>
          Nothing about your reading is recorded. There is no database, no reading history, no
          personalisation and no click tracking. Everyone sees the same page. When you follow a
          headline you go directly to the publisher&rsquo;s site, and their own privacy policy
          applies from that point.
        </p>
        <p>
          DO101 stores only headlines, timestamps and the short excerpt the feed itself publishes,
          and only in a temporary cache. Full articles are never copied. Every feed read is listed
          on the <Link href="/news/sources">sources page</Link>.
        </p>

        <h2>Typing Battle</h2>
        <p>
          Typing Battle connects two browsers directly using WebRTC. A free public signalling service
          is used only to exchange connection details so the two browsers can find each other; your
          keystrokes travel peer to peer and never pass through DO101. Your display name is sent
          straight to your opponent&rsquo;s browser. Rooms are not stored anywhere and disappear when
          the host closes the tab.
        </p>

        <h2>Analytics</h2>
        <p>
          DO101 ships with an analytics abstraction but no analytics provider is loaded by default,
          so no analytics requests are made. If a privacy-friendly, cookie-free provider is added
          later, this page will be updated first and the events collected will be limited to
          anonymous product usage — which tools are opened and completed — with no personal data and
          no cross-site tracking.
        </p>

        <h2>Advertising</h2>
        <p>
          DO101 is preparing to show advertising from Google AdSense to cover hosting. Ad code is
          only loaded when a publisher ID is configured, and it is not configured on a deployment
          that has not been approved. When ads are enabled, Google and its partners may use cookies
          or similar technologies to serve and measure them, subject to Google&rsquo;s own policies.
          You can review and change your Google ad settings at{" "}
          <a
            href="https://adssettings.google.com"
            rel="noopener noreferrer nofollow"
            target="_blank"
          >
            adssettings.google.com
          </a>
          .
        </p>
        <p>
          Where consent is legally required for advertising or analytics cookies in your
          jurisdiction, DO101 will present the appropriate consent control before those technologies
          load.
        </p>

        <h2>Cookies</h2>
        <p>
          DO101 itself sets no tracking cookies. Preferences are kept in localStorage rather than
          cookies. Third-party cookies may be set by advertising once it is enabled, as described
          above.
        </p>

        <h2>Children</h2>
        <p>
          DO101 is a general-audience website and is not directed at children under 13. We do not
          knowingly collect personal information from anyone, including children.
        </p>

        <h2>Your rights</h2>
        <p>
          Because DO101 does not operate accounts or a user database, there is generally no personal
          data held about you to access, correct or delete. Data stored on your own device can be
          erased with the button above or by clearing site data in your browser. If you believe we
          hold information about you, contact us using the details on the{" "}
          <Link href="/contact">contact page</Link>.
        </p>

        <h2>Changes to this policy</h2>
        <p>
          If DO101 starts collecting something new — analytics, advertising, or a feature that needs
          a server — this page will be updated before that happens, and the date at the top will
          change.
        </p>

        <h2>Contact</h2>
        <p>
          Questions about privacy can be sent through the <Link href="/contact">contact page</Link>.
          This policy applies to {SITE.url}.
        </p>
      </Prose>
    </div>
  );
}
