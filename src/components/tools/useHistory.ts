"use client";

import * as React from "react";

const LIMIT = 80;

/**
 * Undo/redo for a whole document.
 *
 * The distinction that matters is between `commit` and `preview`: a drag fires
 * dozens of updates a second, and every one of them must show on screen while
 * the whole gesture costs exactly one press of undo.
 */
export interface History<T> {
  present: T;
  /** Records an undo step. */
  commit: (next: T | ((current: T) => T)) => void;
  /**
   * Updates without adding a history entry — used during a drag, so that one
   * gesture is one undo rather than one undo per pointer move.
   */
  preview: (next: T | ((current: T) => T)) => void;
  /**
   * Seals a gesture that was drawn with `preview`: records the document as it
   * was before the gesture as the undo target, and keeps the current one.
   */
  seal: (before: T) => void;
  /** Replaces the whole document and clears the past, e.g. when loading a file. */
  reset: (next: T) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
}

function resolve<T>(next: T | ((current: T) => T), current: T): T {
  return typeof next === "function" ? (next as (c: T) => T)(current) : next;
}

interface State<T> {
  past: T[];
  present: T;
  future: T[];
}

export function useHistory<T>(initial: T): History<T> {
  const [state, setState] = React.useState<State<T>>({ past: [], present: initial, future: [] });

  const commit = React.useCallback((next: T | ((current: T) => T)) => {
    setState((s) => {
      const present = resolve(next, s.present);
      if (present === s.present) return s;
      return { past: [...s.past, s.present].slice(-LIMIT), present, future: [] };
    });
  }, []);

  const preview = React.useCallback((next: T | ((current: T) => T)) => {
    setState((s) => {
      const present = resolve(next, s.present);
      return present === s.present ? s : { ...s, present };
    });
  }, []);

  const seal = React.useCallback((before: T) => {
    setState((s) => {
      // A gesture that changed nothing should not cost an undo press.
      if (s.present === before) return s;
      return { past: [...s.past, before].slice(-LIMIT), present: s.present, future: [] };
    });
  }, []);

  const reset = React.useCallback((next: T) => {
    setState({ past: [], present: next, future: [] });
  }, []);

  const undo = React.useCallback(() => {
    setState((s) => {
      if (!s.past.length) return s;
      const present = s.past[s.past.length - 1];
      return { past: s.past.slice(0, -1), present, future: [s.present, ...s.future].slice(0, LIMIT) };
    });
  }, []);

  const redo = React.useCallback(() => {
    setState((s) => {
      if (!s.future.length) return s;
      const [present, ...future] = s.future;
      return { past: [...s.past, s.present].slice(-LIMIT), present, future };
    });
  }, []);

  return {
    present: state.present,
    commit,
    preview,
    seal,
    reset,
    undo,
    redo,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
