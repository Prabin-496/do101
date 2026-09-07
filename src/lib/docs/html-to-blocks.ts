"use client";

import type { Block, Run } from "./layout";

/**
 * Turns an HTML fragment into the flat block model the PDF renderer draws.
 * Parsed with the browser's own DOMParser — the markup is never injected into
 * the live page, so untrusted document content cannot execute anything.
 */
export function htmlToBlocks(html: string): Block[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: Block[] = [];

  const runsFrom = (node: Node, bold = false, italic = false): Run[] => {
    const runs: Run[] = [];

    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const text = child.textContent ?? "";
        if (text.trim() || text === " ") runs.push({ text, bold, italic });
        return;
      }
      if (child.nodeType !== Node.ELEMENT_NODE) return;

      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === "br") {
        runs.push({ text: "\n", bold, italic });
        return;
      }
      const nextBold = bold || tag === "strong" || tag === "b";
      const nextItalic = italic || tag === "em" || tag === "i";
      runs.push(...runsFrom(el, nextBold, nextItalic));
    });

    return runs;
  };

  const walkList = (list: HTMLElement, depth: number) => {
    const ordered = list.tagName.toLowerCase() === "ol";
    let index = 1;

    Array.from(list.children).forEach((child) => {
      if (child.tagName.toLowerCase() !== "li") return;
      const li = child as HTMLElement;

      // Nested lists are pulled out and rendered after their parent item.
      const nested = Array.from(li.children).filter((c) =>
        ["ul", "ol"].includes(c.tagName.toLowerCase()),
      );
      nested.forEach((n) => n.remove());

      blocks.push({
        type: "listItem",
        ordered,
        index: index++,
        depth,
        runs: runsFrom(li),
      });
      nested.forEach((n) => walkList(n as HTMLElement, depth + 1));
    });
  };

  const walk = (node: Node) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) return;
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();

      if (/^h[1-6]$/.test(tag)) {
        blocks.push({
          type: "heading",
          level: Number(tag[1]) as 1 | 2 | 3 | 4 | 5 | 6,
          runs: runsFrom(el),
        });
      } else if (tag === "p") {
        const runs = runsFrom(el);
        const image = el.querySelector("img");
        if (image?.src) blocks.push({ type: "image", dataUrl: image.src });
        if (runs.some((r) => r.text.trim())) blocks.push({ type: "paragraph", runs });
      } else if (tag === "ul" || tag === "ol") {
        walkList(el, 0);
      } else if (tag === "img") {
        if (el.getAttribute("src")) {
          blocks.push({ type: "image", dataUrl: el.getAttribute("src")! });
        }
      } else if (tag === "hr") {
        blocks.push({ type: "rule" });
      } else if (tag === "table") {
        const rows = Array.from(el.querySelectorAll("tr")).map((tr) =>
          Array.from(tr.querySelectorAll("th, td")).map(
            (cell) => cell.textContent?.trim() ?? "",
          ),
        );
        if (rows.length) blocks.push({ type: "table", rows });
      } else if (tag === "blockquote" || tag === "pre") {
        blocks.push({ type: "paragraph", runs: runsFrom(el, false, tag === "blockquote") });
      } else {
        walk(el);
      }
    });
  };

  walk(doc.body);
  return blocks;
}
