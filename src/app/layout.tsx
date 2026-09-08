import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Nunito, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { SITE, absoluteUrl } from "@/lib/site";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { CommandPaletteProvider } from "@/components/layout/CommandPalette";
import { LanguageProvider } from "@/components/layout/LanguageProvider";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { JsonLd } from "@/components/seo/JsonLd";
import { websiteSchema, organizationSchema } from "@/lib/seo/structured-data";

const nunito = Nunito({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-nunito",
  weight: ["400", "600", "700", "800", "900"],
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono-code",
  weight: ["400", "600"],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: "DO101 — Free Online Tools, Calculators & Games",
    template: "%s | DO101",
  },
  description: SITE.description,
  applicationName: SITE.name,
  alternates: { canonical: absoluteUrl("/") },
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: SITE.name,
    url: SITE.url,
    title: "DO101 — Free Online Tools, Calculators & Games",
    description: SITE.description,
    locale: SITE.locale,
  },
  twitter: {
    card: "summary_large_image",
    title: "DO101 — Free Online Tools, Calculators & Games",
    description: SITE.description,
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#111b21" },
  ],
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${nunito.variable} ${mono.variable}`}>
      <body className="flex min-h-dvh flex-col antialiased">
        <ThemeProvider>
          <LanguageProvider>
            <CommandPaletteProvider>
            <a
              href="#main"
              className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-[var(--grass)] focus:px-4 focus:py-2 focus:font-extrabold focus:text-white"
            >
              Skip to content
            </a>
              <Navbar />
              <main id="main" className="flex-1">
                {children}
              </main>
              <Footer />
              {/* Always reachable, even deep inside a long tool page. */}
              <LanguageSwitcher floating />
            </CommandPaletteProvider>
          </LanguageProvider>
        </ThemeProvider>
        <JsonLd data={[websiteSchema(), organizationSchema()]} />
        {SITE.adsenseClient ? (
          <Script
            async
            strategy="afterInteractive"
            crossOrigin="anonymous"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${SITE.adsenseClient}`}
          />
        ) : null}
      </body>
    </html>
  );
}
