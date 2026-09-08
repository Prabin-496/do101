export const SITE = {
  name: "DO101",
  tagline: "Do more. Simply.",
  description:
    "Free online tools for images, text, developers, calculations and productivity, plus typing and reaction games. Fast, simple and browser-first.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://do101.online").replace(/\/$/, ""),
  locale: "en_US",
  twitter: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "thisisnonpersonal@gmail.com",
  adsenseClient: process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "",
} as const;

export function absoluteUrl(path = "/") {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
