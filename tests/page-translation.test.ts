import { describe, it, expect } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { LOCALES, DEFAULT_LOCALE } from "@/lib/i18n/locales";
import { normalizeKey, translateText, type Dictionary } from "@/lib/i18n/dictionary";
import { isTranslatable, normalize } from "../scripts/i18n-harvest.mjs";

const root = join(import.meta.dirname, "..");
const dictDir = join(root, "src", "lib", "i18n", "dictionaries");

describe("dictionary lookup", () => {
  const dict: Dictionary = {
    "How to use it": "使い方",
    "About the": "について",
    Copy: "コピー",
  };

  it("collapses the whitespace JSX leaves in the markup", () => {
    expect(normalizeKey("  How to\n    use it  ")).toBe("How to use it");
    expect(translateText(dict, "\n  How to use it\n")).toBe("\n  使い方\n");
  });

  it("keeps the padding around a fragment so words do not weld together", () => {
    // `<span>{count} items</span>` puts the space inside the text node.
    expect(translateText({ items: "件" }, " items ")).toBe(" 件 ");
  });

  it("leaves anything it does not know", () => {
    expect(translateText(dict, "My Secret Contract.pdf")).toBeNull();
    expect(translateText(dict, "")).toBeNull();
    expect(translateText(dict, "   ")).toBeNull();
  });

  it("reports no change when the translation equals the English", () => {
    expect(translateText({ PDF: "PDF" }, "PDF")).toBeNull();
  });
});

describe("generated dictionaries", () => {
  const translatable = LOCALES.filter((l) => l.code !== DEFAULT_LOCALE);

  it("ships a file for every language the switcher offers", () => {
    for (const locale of translatable) {
      const file = join(dictDir, `${locale.code}.json`);
      expect(existsSync(file), `no dictionary for ${locale.code}`).toBe(true);
    }
  });

  it("has an import for every file, and a file for every import", () => {
    // The import map in dictionary.ts is written out by hand because a
    // template-literal import cannot be bundled; this keeps it honest.
    const source = readFileSync(join(root, "src", "lib", "i18n", "dictionary.ts"), "utf8");
    const imported = [...source.matchAll(/import\("\.\/dictionaries\/([a-z-]+)\.json"\)/g)].map(
      (m) => m[1],
    );
    const onDisk = readdirSync(dictDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(/\.json$/, ""));

    expect([...imported].sort()).toEqual([...onDisk].sort());
    expect([...imported].sort()).toEqual(translatable.map((l) => l.code).sort());
  });

  it("holds flat string-to-string maps with no empty entries", () => {
    for (const locale of translatable) {
      const raw = JSON.parse(readFileSync(join(dictDir, `${locale.code}.json`), "utf8"));
      for (const [key, value] of Object.entries(raw)) {
        expect(typeof value, `${locale.code}: ${key} is not a string`).toBe("string");
        expect((value as string).trim(), `${locale.code}: ${key} is empty`).not.toBe("");
        expect(key, `${locale.code} has an unnormalised key`).toBe(normalizeKey(key));
      }
    }
  });

  it("never rewrites the product name", () => {
    for (const locale of translatable) {
      const raw: Dictionary = JSON.parse(
        readFileSync(join(dictDir, `${locale.code}.json`), "utf8"),
      );
      for (const [key, value] of Object.entries(raw)) {
        if (key.includes("DO101")) {
          expect(value, `${locale.code} lost DO101 in "${key}"`).toContain("DO101");
        }
      }
    }
  });
});

describe("harvesting", () => {
  it("takes prose, labels and fragments", () => {
    for (const text of [
      "How to use it",
      "Merge PDF",
      "About the",
      "Combine several PDFs into one, in the order you choose.",
      "No watermark and no page limit",
      "🇩🇰 Denmark +45",
    ]) {
      expect(isTranslatable(text), `rejected "${text}"`).toBe(true);
    }
  });

  it("leaves code, data and identifiers alone", () => {
    for (const text of [
      "flex items-center gap-2 rounded-2xl",
      "Asia/Dubai",
      "NIU",
      "29,743 km²",
      "https://do101.online/tools",
      "page.tsx",
      "const x = () => {}",
      "42",
      "→",
      "ja",
    ]) {
      expect(isTranslatable(text), `accepted "${text}"`).toBe(false);
    }
  });

  it("skips text that is already in another script", () => {
    // A tool's own Japanese sample text must not be sent to a translator.
    expect(isTranslatable("こんにちは world")).toBe(false);
    expect(isTranslatable("नमस्ते")).toBe(false);
  });

  it("normalises the same way the runtime lookup does", () => {
    expect(normalize("  How to\n  use it ")).toBe(normalizeKey("  How to\n  use it "));
  });
});
