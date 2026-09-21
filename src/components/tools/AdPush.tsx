"use client";

import * as React from "react";

declare global {
  interface Window {
    adsbygoogle?: unknown[];
  }
}

/**
 * Asks AdSense to fill the <ins> unit rendered just before it. Every manual
 * unit needs exactly one push, including after a client-side navigation.
 */
export function AdPush() {
  React.useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch {
      // An ad blocker, or a unit that was already filled. Neither is worth surfacing.
    }
  }, []);
  return null;
}
