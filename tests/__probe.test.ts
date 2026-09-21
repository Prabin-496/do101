import { describe, expect, it } from "vitest";
import { analyse } from "../src/lib/japanese/annotate";
describe("p", () => { it("c", () => {
  const cases: Array<[string,string]> = [
    ["一人","ひとり"],["二人","ふたり"],["三人","さんにん"],["四人","よにん"],["1人","ひとり"],["3人","さんにん"],
    ["一日","ついたち"],["二日","ふつか"],["三日","みっか"],["十日","とおか"],["二十日","はつか"],
    ["3分","さんぷん"],["1分","いっぷん"],["10分","じゅっぷん"],["1回","いっかい"],["六本","ろっぽん"],
    ["四月","しがつ"],["9月","くがつ"],["六百","ろっぴゃく"],["二十歳","はたち"],["1億円","いちおくえん"],
    ["3ヶ月","さんかげつ"],["2時間","にじかん"],["五千円","ごせんえん"],["12歳","じゅうにさい"],
  ];
  const out: string[] = [];
  for (const [t,want] of cases) { const a=analyse(t); if (a.hiragana!==want) out.push(`${t} → ${a.hiragana} ✗ want ${want}`); }
  out.push(`--- romaji: 1億円=${analyse("1億円").romaji} | 3人=${analyse("3人").romaji} | 二人=${analyse("二人").romaji}`);
  expect(out).toEqual([]);
}); });
