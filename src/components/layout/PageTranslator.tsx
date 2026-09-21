"use client";

import * as React from "react";
import { useLanguage } from "./LanguageProvider";
import {
  loadDictionary,
  translateText,
  type Dictionary,
} from "@/lib/i18n/dictionary";
import { DEFAULT_LOCALE } from "@/lib/i18n/locales";

/**
 * Translates the whole page, not just the parts that were wired up for it.
 *
 * The chosen language lives in this device's storage, so the server has no way
 * to know it and every page arrives rendered in English. Rather than thread a
 * translation key through all 154 routes and the components under them, this
 * walks the rendered DOM once the language is known and swaps the text it
 * recognises, then keeps watching so anything React renders later is swapped
 * too. The dictionary is keyed by the English itself, so a string with no
 * entry — a filename, something the visitor typed, a number — is left exactly
 * as it was.
 *
 * Nothing here runs for English: no walk, no observer, no dictionary fetched.
 */

/* ------------------------------ what to skip ---------------------------- */

const SKIP_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "NOSCRIPT",
  "TEMPLATE",
  "CODE",
  "PRE",
  "KBD",
  "SAMP",
  "TEXTAREA",
  "INPUT",
]);

/** Attributes a visitor reads or hears. */
const TEXT_ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;

/** Marks an element whose text this has rewritten, so it can be found again. */
const TOUCHED = "data-i18n";

function isSkipped(el: Element): boolean {
  if (SKIP_TAGS.has(el.tagName)) return true;
  if (el.hasAttribute("data-no-translate")) return true;
  if (el.getAttribute("translate") === "no") return true;
  // Something being edited is the visitor's text, whatever language it is in.
  if (el.hasAttribute("contenteditable")) return true;
  return false;
}

/* ------------------------------ bookkeeping ----------------------------- */

interface NodeRecord {
  /** The English this node held before it was rewritten. */
  source: string;
  /** What was written, so a later pass can tell its own work from React's. */
  output: string;
}

const textRecords = new WeakMap<Text, NodeRecord>();
const attrRecords = new WeakMap<Element, Map<string, NodeRecord>>();

/**
 * The English currently behind a node.
 *
 * If the node still holds what was written into it, the remembered English is
 * the truth. If React has since rendered something different, that new value
 * is the English and the old record is stale.
 */
function englishOf(node: Text): string {
  const record = textRecords.get(node);
  return record && node.nodeValue === record.output ? record.source : (node.nodeValue ?? "");
}

function writeText(node: Text, source: string, output: string) {
  if (node.nodeValue !== output) node.nodeValue = output;
  textRecords.set(node, { source, output });
  const parent = node.parentElement;
  if (parent && !parent.hasAttribute(TOUCHED)) parent.setAttribute(TOUCHED, "");
}

/* ------------------------------ translating ----------------------------- */

/** The direct text children of an element, ignoring React's comment markers. */
function textChildren(el: Element): Text[] {
  const out: Text[] = [];
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) out.push(node as Text);
  }
  return out;
}

function hasElementChild(el: Element): boolean {
  for (const node of el.childNodes) {
    if (node.nodeType === Node.ELEMENT_NODE) return true;
  }
  return false;
}

/**
 * Handles one element's own text.
 *
 * React splits adjacent text children apart, so `<h2>About the {name}</h2>`
 * reaches the DOM as two nodes. Translated separately they read badly — and in
 * a language that orders the words differently, wrongly. So when an element
 * holds nothing but text, the pieces are joined and looked up as one sentence;
 * the translation goes into the first node and the rest are emptied. Every
 * node stays in place, which matters: React still owns them and would fail if
 * they vanished.
 */
function translateElementText(el: Element, dict: Dictionary) {
  const nodes = textChildren(el);
  if (!nodes.length) return;

  if (nodes.length > 1 && !hasElementChild(el)) {
    const sources = nodes.map(englishOf);
    const joined = sources.join("");
    const translated = translateText(dict, joined);
    if (translated !== null) {
      writeText(nodes[0], sources[0], translated);
      for (let i = 1; i < nodes.length; i += 1) writeText(nodes[i], sources[i], "");
      return;
    }
  }

  for (const node of nodes) {
    const source = englishOf(node);
    const translated = translateText(dict, source);
    if (translated !== null) writeText(node, source, translated);
  }
}

function translateAttributes(el: Element, dict: Dictionary) {
  for (const attr of TEXT_ATTRS) {
    const current = el.getAttribute(attr);
    if (current === null) continue;

    const records = attrRecords.get(el);
    const record = records?.get(attr);
    const source = record && current === record.output ? record.source : current;

    const translated = translateText(dict, source);
    if (translated === null) continue;

    el.setAttribute(attr, translated);
    const map = records ?? new Map<string, NodeRecord>();
    map.set(attr, { source, output: translated });
    attrRecords.set(el, map);
    if (!el.hasAttribute(TOUCHED)) el.setAttribute(TOUCHED, "");
  }
}

/** Walks an element and everything under it, skipping the excluded subtrees. */
function translateTree(root: Element, dict: Dictionary) {
  if (isSkipped(root)) return;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode: (node) =>
      isSkipped(node as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT,
  });

  translateAttributes(root, dict);
  translateElementText(root, dict);

  let current = walker.nextNode() as Element | null;
  while (current) {
    translateAttributes(current, dict);
    translateElementText(current, dict);
    current = walker.nextNode() as Element | null;
  }
}

/* ------------------------------- restoring ------------------------------ */

/**
 * Puts the English back before switching to a different language.
 *
 * Only nodes still holding what was written are touched; anything React has
 * re-rendered since is already whatever React wants it to be.
 */
function restoreEnglish() {
  for (const el of document.querySelectorAll(`[${TOUCHED}]`)) {
    for (const node of textChildren(el)) {
      const record = textRecords.get(node);
      if (record && node.nodeValue === record.output) node.nodeValue = record.source;
      textRecords.delete(node);
    }

    const records = attrRecords.get(el);
    if (records) {
      for (const [attr, record] of records) {
        if (el.getAttribute(attr) === record.output) el.setAttribute(attr, record.source);
      }
      attrRecords.delete(el);
    }

    el.removeAttribute(TOUCHED);
  }
}

/* -------------------------------- component ----------------------------- */

export function PageTranslator() {
  const { locale } = useLanguage();

  React.useEffect(() => {
    // Every switch starts from English, including the switch back to it.
    restoreEnglish();
    if (locale === DEFAULT_LOCALE) return;

    let cancelled = false;
    let observer: MutationObserver | null = null;
    let frame = 0;

    void loadDictionary(locale).then((dict) => {
      if (cancelled || !Object.keys(dict).length) return;

      const englishTitle = document.title;
      const translatedTitle = translateText(dict, englishTitle);
      if (translatedTitle !== null) document.title = translatedTitle;

      translateTree(document.body, dict);

      // Anything rendered after this point — a tool's result, a menu opening,
      // a route change — arrives in English and is caught here.
      const pending = new Set<Element>();

      const flush = () => {
        frame = 0;
        const targets = [...pending];
        pending.clear();
        observer?.disconnect();
        for (const el of targets) {
          if (el.isConnected) translateTree(el, dict);
        }
        connect();
      };

      const queue = (el: Element | null) => {
        if (!el) return;
        pending.add(el);
        if (!frame) frame = requestAnimationFrame(flush);
      };

      observer = new MutationObserver((records) => {
        for (const record of records) {
          if (record.type === "characterData") {
            queue(record.target.parentElement);
          } else if (record.type === "attributes") {
            queue(record.target as Element);
          } else {
            for (const added of record.addedNodes) {
              if (added.nodeType === Node.ELEMENT_NODE) queue(added as Element);
              else if (added.nodeType === Node.TEXT_NODE) queue(added.parentElement);
            }
          }
        }
      });

      const connect = () => {
        observer?.observe(document.body, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
          attributeFilter: [...TEXT_ATTRS],
        });
      };

      connect();
    });

    return () => {
      cancelled = true;
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
    };
  }, [locale]);

  return null;
}
