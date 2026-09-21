import { describe, it, expect } from "vitest";
import {
  SHORTS_SEO_LIMITS,
  charCount,
  countEmoji,
  countHashtags,
  countPhrase,
  detectNiche,
  generateShortsSeo,
  parseTopic,
  wordCount,
  type NicheId,
} from "@/lib/youtube/shorts-seo";

const YEAR = 2026;
const gen = (raw: string, variation = 0, niche: NicheId | "auto" = "auto") =>
  generateShortsSeo(raw, { variation, niche, year: YEAR });

/** A spread of the things people actually paste into a Shorts SEO box. */
const TOPICS = [
  "How to lose belly fat at home",
  "iPhone 17 ka hidden camera setting",
  "SIP me 5000 rupees har mahine, 10 saal baad kitna",
  "UPSC prelims revision strategy for working students",
  "2 minute paneer sandwich recipe",
  "Goa trip budget under 10000",
  "discipline over motivation",
  "bgmi sensitivity settings for no recoil",
  "IPL final last over analysis",
  "resume mistakes freshers make",
  "skincare routine for oily skin in summer",
  "ai",
  "chatgpt se paise kaise kamaye, freelancing, ai tools",
  "#shorts #viral trending video kaise banaye",
  "weight loss",
  "Kya AI se job chali jayegi? tech news today",
  "ghar baithe online earning app se paisa",
  "class 10 board exam last month plan",
  "बालों के लिए तेल", // Devanagari — the parser must not crash
  "supercalifragilisticexpialidocious extraordinarily complicated terminology explanation",
];

describe("reading the pasted topic", () => {
  it("drops filler and platform words to find the main keyword", () => {
    expect(parseTopic("How to make paneer sandwich")?.main).toBe("Make Paneer Sandwich");
    expect(parseTopic("best youtube shorts tips for weight loss")?.main).toBe("Weight Loss");
  });

  it("drops a dangling qualifier but only when the keyword survives it", () => {
    expect(parseTopic("How to lose belly fat at home")?.main).toBe("Lose Belly Fat");
    expect(parseTopic("work from home jobs")?.main).toBe("Work Home Jobs");
    expect(parseTopic("work from home")?.main).toBe("Work Home");
  });

  it("keeps at most four words", () => {
    const keyword = parseTopic("SIP me 5000 rupees har mahine 10 saal baad kitna")!;
    expect(keyword.main.split(" ")).toHaveLength(4);
  });

  it("falls back to stopwords rather than giving up on a short topic", () => {
    expect(parseTopic("kya hai ye")?.main).toBeTruthy();
  });

  it("returns null only when there is nothing usable", () => {
    expect(parseTopic("")).toBeNull();
    expect(parseTopic("   \n  ")).toBeNull();
    expect(parseTopic("😀😀😀")).toBeNull();
    expect(parseTopic("!!! ??? ...")).toBeNull();
  });

  it("keeps pasted hashtags and later chunks as tag material", () => {
    const keyword = parseTopic("weight loss, home workout, #fatloss")!;
    expect(keyword.secondary).toContain("home workout");
    expect(keyword.pastedTags).toContain("fatloss");
  });

  it("builds a PascalCase hashtag from the keyword", () => {
    expect(parseTopic("weight loss tips")?.hashtag).toBe("#WeightLoss");
  });
});

describe("niche detection", () => {
  it("recognises the obvious ones", () => {
    const cases: [string, NicheId][] = [
      ["iphone camera setting", "tech"],
      ["sip mutual fund return", "money"],
      ["upsc revision notes", "study"],
      ["belly fat workout", "fitness"],
      ["paneer recipe", "food"],
      ["goa trip flight", "travel"],
      ["bgmi sensitivity", "gaming"],
      ["ipl batting", "sports"],
      ["interview resume tips", "career"],
      ["oily skin acne", "beauty"],
    ];
    for (const [topic, expected] of cases) {
      expect(detectNiche(parseTopic(topic)!).niche, topic).toBe(expected);
    }
  });

  it("falls back to general and says it was not detected", () => {
    const detection = detectNiche(parseTopic("random cheez ka jugaad")!);
    expect(detection.niche).toBe("general");
    expect(detection.detected).toBe(false);
  });

  it("honours an explicit niche over the detected one", () => {
    expect(gen("belly fat workout", 0, "food")!.niche).toBe("food");
  });
});

describe("the generated title", () => {
  it("lands inside 45–65 characters for every topic and variation", () => {
    for (const topic of TOPICS) {
      for (let v = 0; v < 6; v += 1) {
        const result = gen(topic, v)!;
        expect(result, topic).not.toBeNull();
        expect(
          result.title.chars,
          `"${topic}" v${v} → ${result.title.text} (${result.title.chars})`,
        ).toBeGreaterThanOrEqual(SHORTS_SEO_LIMITS.titleMinChars);
        expect(result.title.chars, result.title.text).toBeLessThanOrEqual(
          SHORTS_SEO_LIMITS.titleMaxChars,
        );
      }
    }
  });

  it("carries exactly two hashtags, one of them #Shorts", () => {
    for (const topic of TOPICS) {
      for (let v = 0; v < 4; v += 1) {
        const { title } = gen(topic, v)!;
        expect(title.hashtags, title.text).toBe(2);
        expect(title.text.toLowerCase(), title.text).toMatch(/#\w*shorts/);
      }
    }
  });

  it("carries one or two emoji", () => {
    for (const topic of TOPICS) {
      for (let v = 0; v < 4; v += 1) {
        const { title } = gen(topic, v)!;
        expect(title.emoji, title.text).toBeGreaterThanOrEqual(1);
        expect(title.emoji, title.text).toBeLessThanOrEqual(2);
      }
    }
  });

  it("keeps the visitor's keyword in the title", () => {
    for (const topic of TOPICS) {
      for (let v = 0; v < 4; v += 1) {
        const result = gen(topic, v)!;
        const where = `"${topic}" v${v} → ${result.title.text}`;
        // The first keyword word is never dropped...
        expect(countPhrase(result.title.text, result.keyword.short.split(" ")[0]), where)
          .toBeGreaterThanOrEqual(1);
        // ...and the two-word form survives whenever the title budget allows it.
        if (charCount(result.keyword.short) <= 24) {
          expect(countPhrase(result.title.text, result.keyword.short), where).toBeGreaterThanOrEqual(1);
        }
      }
    }
  });
});

describe("the generated description", () => {
  it("lands inside 80–150 words with the keyword 3–4 times and 5 hashtags", () => {
    for (const topic of TOPICS) {
      for (let v = 0; v < 6; v += 1) {
        const { description, keyword } = gen(topic, v)!;
        const where = `"${topic}" v${v}`;
        expect(description.words, `${where} words`).toBeGreaterThanOrEqual(
          SHORTS_SEO_LIMITS.descMinWords,
        );
        expect(description.words, `${where} words`).toBeLessThanOrEqual(
          SHORTS_SEO_LIMITS.descMaxWords,
        );
        expect(description.keywordCount, `${where} keyword "${keyword.main}"`).toBeGreaterThanOrEqual(3);
        expect(description.keywordCount, `${where} keyword "${keyword.main}"`).toBeLessThanOrEqual(4);
        expect(description.hashtags, `${where} hashtags`).toBe(5);
        expect(description.inRange, where).toBe(true);
      }
    }
  });

  it("includes a call to action", () => {
    for (const topic of TOPICS.slice(0, 8)) {
      const { description } = gen(topic)!;
      expect(description.text.toLowerCase()).toMatch(/subscribe/);
      expect(description.text.toLowerCase()).toMatch(/like|save|comment/);
    }
  });

  it("puts the hashtags on the last line", () => {
    const { description } = gen("paneer sandwich recipe")!;
    const lines = description.text.trim().split("\n");
    expect(lines[lines.length - 1]).toBe(description.hashtagLine);
    expect(countHashtags(description.hashtagLine)).toBe(5);
  });
});

describe("the generated tags", () => {
  it("lands inside 300–500 characters", () => {
    for (const topic of TOPICS) {
      for (let v = 0; v < 4; v += 1) {
        const { tags } = gen(topic, v)!;
        expect(tags.chars, `"${topic}" v${v}: ${tags.text}`).toBeGreaterThanOrEqual(
          SHORTS_SEO_LIMITS.tagsMinChars,
        );
        expect(tags.chars, `"${topic}" v${v}`).toBeLessThanOrEqual(SHORTS_SEO_LIMITS.tagsMaxChars);
      }
    }
  });

  it("is comma separated, deduplicated and led by the keyword", () => {
    const { tags, keyword } = gen("belly fat workout")!;
    expect(tags.text).toBe(tags.list.join(", "));
    expect(tags.list[0]).toBe(keyword.main.toLowerCase());
    expect(new Set(tags.list).size).toBe(tags.list.length);
  });

  it("keeps every tag but the keyword inside YouTube's per-tag limit", () => {
    for (const topic of TOPICS) {
      const { tags } = gen(topic)!;
      for (const tag of tags.list.slice(1)) {
        expect(charCount(tag), tag).toBeLessThanOrEqual(SHORTS_SEO_LIMITS.tagMaxChars);
      }
    }
  });

  it("uses the injected year rather than the clock", () => {
    expect(gen("belly fat workout")!.tags.text).toContain(String(YEAR));
  });
});

describe("pinned comment, hook and checklist", () => {
  it("mentions the keyword and asks for engagement in the pinned comment", () => {
    for (const topic of TOPICS.slice(0, 8)) {
      const result = gen(topic)!;
      expect(countPhrase(result.pinnedComment, result.keyword.main), topic).toBeGreaterThanOrEqual(1);
      expect(result.pinnedComment.toLowerCase()).toMatch(/comment/);
    }
  });

  it("gives a spoken line, on-screen text and a first frame for the hook", () => {
    const { hook } = gen("belly fat workout")!;
    expect(hook.spoken).toBeTruthy();
    expect(hook.onScreen).toContain("BELLY FAT WORKOUT");
    expect(hook.firstFrame).toBeTruthy();
    expect(hook.text).toContain("0–3 sec");
  });

  it("keeps the spoken hook short enough to actually say in 3 seconds", () => {
    for (const topic of TOPICS) {
      const { hook } = gen(topic)!;
      expect(wordCount(hook.spoken), hook.spoken).toBeLessThanOrEqual(16);
    }
  });

  it("marks measured checklist rows as passing when the output passes", () => {
    for (const topic of TOPICS) {
      const { checklist } = gen(topic)!;
      const measured = checklist.filter((item) => item.measured);
      expect(measured.length).toBeGreaterThanOrEqual(6);
      for (const item of measured) expect(item.ok, `${topic}: ${item.text}`).toBe(true);
      expect(checklist.some((item) => !item.measured)).toBe(true);
    }
  });
});

describe("determinism and variation", () => {
  it("returns the same output for the same input and variation", () => {
    expect(gen("belly fat workout", 2)).toEqual(gen("belly fat workout", 2));
  });

  it("returns different titles and hooks across variations", () => {
    const titles = new Set<string>();
    const hooks = new Set<string>();
    for (let v = 0; v < 6; v += 1) {
      const result = gen("belly fat workout", v)!;
      titles.add(result.title.text);
      hooks.add(result.hook.spoken);
    }
    expect(titles.size).toBeGreaterThanOrEqual(4);
    expect(hooks.size).toBeGreaterThanOrEqual(3);
  });

  it("does not simply echo the input back", () => {
    const topic = "belly fat workout";
    const result = gen(topic)!;
    expect(result.title.text.toLowerCase()).not.toBe(topic);
    expect(wordCount(result.description.text)).toBeGreaterThan(wordCount(topic) * 10);
  });

  it("returns null for unusable input", () => {
    expect(gen("")).toBeNull();
    expect(gen("   ")).toBeNull();
  });
});

describe("copy all", () => {
  it("contains every section", () => {
    const result = gen("sip mutual fund")!;
    for (const heading of [
      "TITLE",
      "DESCRIPTION",
      "TAGS",
      "PINNED COMMENT",
      "HOOK — FIRST 3 SECONDS",
      "SEO CHECKLIST",
    ]) {
      expect(result.copyAll).toContain(heading);
    }
    expect(result.copyAll).toContain(result.title.text);
    expect(result.copyAll).toContain(result.tags.text);
    expect(result.copyAll).toContain(result.pinnedComment);
  });
});

describe("the measuring helpers", () => {
  it("counts code points, not UTF-16 units", () => {
    expect(charCount("🔥🔥")).toBe(2);
    expect(countEmoji("Title 🔥😱 #Shorts")).toBe(2);
  });

  it("ignores bullets when counting words", () => {
    expect(wordCount("• ek do teen")).toBe(3);
    expect(wordCount("#Shorts #Viral")).toBe(2);
  });

  it("counts phrases case-insensitively and across whitespace", () => {
    expect(countPhrase("Weight Loss aur weight  loss", "weight loss")).toBe(2);
    expect(countPhrase("nothing here", "")).toBe(0);
  });
});
