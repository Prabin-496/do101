import "server-only";

import type { MediaOption } from "./formats";

/**
 * The integration point for media downloading.
 *
 * DO101 ships no implementation of this interface, and that is deliberate
 * rather than unfinished. Retrieving the underlying media streams for a
 * YouTube video means working around the access controls YouTube puts in
 * front of them, which its Terms of Service prohibit, so the code to do it is
 * not written here and the tool does not pretend otherwise.
 *
 * What the interface is for: an operator who has a lawful route to the media
 * can supply one and the whole tool comes to life without any UI changes.
 * Lawful routes include content you own and host yourself, a licensing
 * agreement with the rights holder, and YouTube's own official APIs and
 * export tools.
 *
 * Wiring one up:
 *   1. Implement `DownloadProvider` in a module of your own.
 *   2. Return it from `getProvider()` below when your env vars are present.
 *   3. Set `YOUTUBE_PROVIDER` (and whatever credentials it needs).
 *
 * Until then every download route answers 501 with an explanation, which is
 * what the interface shows the visitor.
 */
export interface DownloadProvider {
  /** Short machine id, e.g. "self-hosted". */
  readonly id: string;
  /** Shown to visitors so they know who is serving the media. */
  readonly name: string;
  /** Where a visitor can read that provider's terms. */
  readonly termsUrl?: string;

  /**
   * What is available for this video. Return only renditions that genuinely
   * exist — the interface renders exactly what it is given.
   */
  listOptions(videoId: string): Promise<MediaOption[]>;

  /**
   * A URL the browser can fetch to get the file, plus how long it is good for.
   * Returning a short-lived signed URL is preferred to streaming through this
   * site, which would put its bandwidth in the middle of every download.
   */
  resolveDownload(
    videoId: string,
    optionId: string,
  ): Promise<{ url: string; expiresAt?: string }>;
}

export class ProviderNotConfiguredError extends Error {
  constructor() {
    super("No download provider is configured for this deployment.");
    this.name = "ProviderNotConfiguredError";
  }
}

export class ProviderRequestError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "ProviderRequestError";
    this.status = status;
  }
}

/** The env var an operator sets to name their provider module. */
export const PROVIDER_ENV = "YOUTUBE_PROVIDER";

/**
 * Returns the configured provider, or null.
 *
 * Null is the shipped state. Nothing here reaches out to YouTube.
 */
export function getProvider(): DownloadProvider | null {
  const configured = process.env[PROVIDER_ENV]?.trim();
  if (!configured) return null;

  // An operator adds their own case here. Left empty on purpose: shipping a
  // stub that returns invented formats would make the interface lie.
  return null;
}

export function isProviderConfigured(): boolean {
  return getProvider() !== null;
}

/** What the API tells the browser when there is nothing behind the button. */
export const NOT_CONFIGURED_MESSAGE =
  "This DO101 deployment has no media download provider connected, so video and audio downloads are not available here. The links below are the routes YouTube itself supports.";
