function adsenseClient(env: string | undefined): string {
  if (env === "off") return "";
  return env || "ca-pub-6916922494704991";
}

export const SITE = {
  name: "DO101",
  tagline: "Do more. Simply.",
  description:
    "Free online tools for images, text, developers, calculations and productivity, plus typing and reaction games. Fast, simple and browser-first.",
  url: (process.env.NEXT_PUBLIC_SITE_URL || "https://do101.online").replace(/\/$/, ""),
  locale: "en_US",
  twitter: process.env.NEXT_PUBLIC_TWITTER_HANDLE || "",
  contactEmail: process.env.NEXT_PUBLIC_CONTACT_EMAIL || "thisisnonpersonal@gmail.com",
  // The publisher ID is public — it appears in every page's HTML and in ads.txt.
  // Set NEXT_PUBLIC_ADSENSE_CLIENT to "off" to keep ads out of a deployment.
  adsenseClient: adsenseClient(process.env.NEXT_PUBLIC_ADSENSE_CLIENT),
} as const;

export function absoluteUrl(path = "/") {
  return `${SITE.url}${path.startsWith("/") ? path : `/${path}`}`;
}
