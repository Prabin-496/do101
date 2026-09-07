import type { Metadata } from "next";
import { SITE, absoluteUrl } from "@/lib/site";
import type { Tool } from "@/lib/tools/types";

export function buildMetadata({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const url = absoluteUrl(path);
  const ogImage = `${absoluteUrl("/opengraph-image")}`;

  return {
    // Absolute: every title here already carries its own "| DO101" suffix, so
    // the root layout's template must not append a second one.
    title: { absolute: title },
    description,
    alternates: { canonical: url },
    robots: noIndex ? { index: false, follow: false } : undefined,
    openGraph: {
      type: "website",
      url,
      siteName: SITE.name,
      title,
      description,
      locale: SITE.locale,
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [ogImage],
      ...(SITE.twitter ? { creator: SITE.twitter, site: SITE.twitter } : {}),
    },
  };
}

export function toolMetadata(tool: Tool): Metadata {
  return {
    ...buildMetadata({
      title: tool.seoTitle,
      description: tool.seoDescription,
      path: tool.route,
    }),
    keywords: tool.keywords,
  };
}
