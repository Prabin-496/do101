"use client";

import * as React from "react";
import type { IpadicFeatures, Tokenizer } from "@sglkc/kuromoji";
import { readLocal, writeLocal } from "@/lib/utils/storage";
import {
  loadTokenizer, onTokenizerStatus, readyTokenizer, tokenizerStatus,
  type TokenizerStatus,
} from "./tokenizer";

/**
 * Set when a reader has turned the analyser off.
 *
 * It loads by default. Reading a kanji correctly means knowing which word it
 * belongs to, and nothing small enough to bundle can do that — without the
 * analyser the tool falls back to reading characters one at a time, which is
 * how 従業員 became "gyōin" and 困難 became "muzuka". A tool that reads
 * Japanese wrongly by default is not worth the bytes it saves, so the download
 * is the normal path and this key records an explicit opt-out.
 */
const OPT_OUT_KEY = "japanese:analyser-off";

export interface TokenizerHandle {
  status: TokenizerStatus;
  /**
   * The loaded analyser, or null. Returned rather than a ready flag so that a
   * render which uses it can depend on it honestly.
   */
  instance: Tokenizer<IpadicFeatures> | null;
  load: () => void;
}

/** The server has no analyser, and must not claim one mid-hydration. */
const noTokenizer = () => null;
const idle = (): TokenizerStatus => "idle";

/**
 * Tracks the shared analyser from a component.
 *
 * The analyser is a module-level singleton — one 17MB download serves the whole
 * page — so this subscribes to it rather than owning it, and a component that
 * mounts after the download has already finished sees it immediately. Nothing
 * is fetched until `load` is called, which is what keeps the download off a
 * page view for everyone who never asks for it.
 */
export function useTokenizer(): TokenizerHandle {
  const status = React.useSyncExternalStore(onTokenizerStatus, tokenizerStatus, idle);
  const instance = React.useSyncExternalStore(onTokenizerStatus, readyTokenizer, noTokenizer);

  const load = React.useCallback(() => {
    writeLocal(OPT_OUT_KEY, false);
    // The failure is already reflected in the status; swallowing it here keeps
    // it from also surfacing as an unhandled rejection.
    void loadTokenizer().catch(() => {});
  }, []);

  // Deliberately an effect rather than a render-time call: it reaches
  // localStorage and starts a download, neither of which belongs in a render.
  // It runs on mount rather than on first keystroke so that the readings are
  // already right the first time a reader pastes something in.
  React.useEffect(() => {
    if (!readLocal(OPT_OUT_KEY, false)) void loadTokenizer().catch(() => {});
  }, []);

  return { status, instance, load };
}
