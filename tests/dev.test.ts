import { describe, it, expect } from "vitest";
import { parseJson, formatJson, minifyJson, findDuplicateKeys } from "@/lib/dev/json";
import { encodeBase64, decodeBase64, encodeUrl, decodeUrl, parseQueryString } from "@/lib/dev/encoding";
import { generateUuids, UUID_PATTERN, MAX_UUIDS } from "@/lib/dev/uuid";
import { decodeJwt } from "@/lib/dev/jwt";
import { detectUnit, describeTimestamp } from "@/lib/dev/timestamp";
import { runRegex } from "@/lib/dev/regex";

describe("JSON", () => {
  it("parses valid JSON", () => {
    const result = parseJson('{"a":1}');
    expect(result.ok).toBe(true);
  });

  it("rejects an empty document with a helpful message", () => {
    const result = parseJson("   ");
    expect(result.ok).toBe(false);
  });

  it("rejects a trailing comma and reports a line", () => {
    const result = parseJson('{\n  "a": 1,\n}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.line).toBeGreaterThan(0);
  });

  it("rejects single-quoted keys", () => {
    expect(parseJson("{'a':1}").ok).toBe(false);
  });

  it("formats with two-space indentation", () => {
    const result = formatJson('{"a":1}');
    expect(result.output).toBe('{\n  "a": 1\n}');
  });

  it("sorts keys when asked", () => {
    const result = formatJson('{"b":1,"a":2}', { sortKeys: true });
    expect(result.output?.indexOf('"a"')).toBeLessThan(result.output?.indexOf('"b"') ?? 0);
  });

  it("minifies back to the smallest form", () => {
    expect(minifyJson('{\n "a": 1\n}').output).toBe('{"a":1}');
  });

  it("spots duplicate sibling keys", () => {
    expect(findDuplicateKeys('{"a":1,"a":2}')).toEqual(["a"]);
  });

  it("does not flag the same key in different objects", () => {
    expect(findDuplicateKeys('{"x":{"a":1},"y":{"a":2}}')).toEqual([]);
  });

  it("does not treat a value that looks like a key as one", () => {
    expect(findDuplicateKeys('{"a":"b","c":"b"}')).toEqual([]);
  });
});

describe("Base64", () => {
  it("round-trips plain ASCII", () => {
    expect(decodeBase64(encodeBase64("Hello world"))).toBe("Hello world");
  });

  it("round-trips Unicode and emoji", () => {
    const text = "héllo 🎉 日本語";
    expect(decodeBase64(encodeBase64(text))).toBe(text);
  });

  it("produces the known encoding for a simple string", () => {
    expect(encodeBase64("Hello world")).toBe("SGVsbG8gd29ybGQ=");
  });

  it("produces URL-safe output without padding", () => {
    const encoded = encodeBase64("??>>??", true);
    expect(encoded).not.toContain("+");
    expect(encoded).not.toContain("/");
    expect(encoded).not.toContain("=");
  });

  it("decodes URL-safe input", () => {
    const text = "sub?a=1&b=2";
    expect(decodeBase64(encodeBase64(text, true))).toBe(text);
  });

  it("handles an empty string", () => {
    expect(encodeBase64("")).toBe("");
  });
});

describe("URL encoding", () => {
  it("escapes spaces as %20 in component mode", () => {
    expect(encodeUrl("hello world", "component")).toBe("hello%20world");
  });

  it("escapes structural characters in component mode only", () => {
    expect(encodeUrl("a/b?c=d", "component")).toBe("a%2Fb%3Fc%3Dd");
    expect(encodeUrl("https://a.com/b?c=d", "uri")).toBe("https://a.com/b?c=d");
  });

  it("round-trips", () => {
    const text = "a b&c=d/é🎉";
    expect(decodeUrl(encodeUrl(text, "component"))).toBe(text);
  });

  it("parses query parameters out of a URL", () => {
    const parsed = parseQueryString("https://x.com/p?a=1&b=hello%20world");
    expect(parsed?.params).toEqual([
      { key: "a", value: "1" },
      { key: "b", value: "hello world" },
    ]);
  });

  it("returns null when there is no query string", () => {
    expect(parseQueryString("https://x.com/p")).toBeNull();
  });
});

describe("UUID", () => {
  it("generates the requested count", () => {
    expect(generateUuids(7)).toHaveLength(7);
  });

  it("generates valid v4 UUIDs", () => {
    generateUuids(20).forEach((uuid) => expect(uuid).toMatch(UUID_PATTERN));
  });

  it("generates unique values", () => {
    const list = generateUuids(200);
    expect(new Set(list).size).toBe(200);
  });

  it("clamps out-of-range counts", () => {
    expect(generateUuids(0)).toHaveLength(1);
    expect(generateUuids(99_999)).toHaveLength(MAX_UUIDS);
  });

  it("applies formats", () => {
    expect(generateUuids(1, "no-dashes")[0]).not.toContain("-");
    expect(generateUuids(1, "braces")[0].startsWith("{")).toBe(true);
    const upper = generateUuids(1, "uppercase")[0];
    expect(upper).toBe(upper.toUpperCase());
  });
});

describe("JWT decoding", () => {
  // Signature is deliberately meaningless — decoding never verifies it.
  const token =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkRPMTAxIiwiaWF0IjoxNTE2MjM5MDIyfQ.fakesignature";

  it("decodes the header and payload", () => {
    const result = decodeJwt(token);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.jwt.header.data.alg).toBe("HS256");
      expect(result.jwt.payload.data.sub).toBe("1234567890");
      expect(result.jwt.issuedAt).toBe(1516239022 * 1000);
    }
  });

  it("strips a Bearer prefix", () => {
    expect(decodeJwt(`Bearer ${token}`).ok).toBe(true);
  });

  it("rejects a string with too few parts", () => {
    expect(decodeJwt("not.a-token").ok).toBe(false);
  });

  it("rejects an empty token", () => {
    expect(decodeJwt("").ok).toBe(false);
  });
});

describe("timestamps", () => {
  it("detects seconds versus milliseconds", () => {
    expect(detectUnit(1_735_689_600)).toBe("seconds");
    expect(detectUnit(1_735_689_600_000)).toBe("milliseconds");
  });

  it("converts a known timestamp to the right ISO string", () => {
    expect(describeTimestamp(1_735_689_600)?.iso).toBe("2025-01-01T00:00:00.000Z");
  });

  it("honours an explicit unit override", () => {
    expect(describeTimestamp(1000, "milliseconds")?.iso).toBe("1970-01-01T00:00:01.000Z");
    expect(describeTimestamp(1000, "seconds")?.iso).toBe("1970-01-01T00:16:40.000Z");
  });

  it("rejects values that are not finite", () => {
    expect(describeTimestamp(Number.NaN)).toBeNull();
  });
});

describe("regex tester", () => {
  it("finds every global match", () => {
    const result = runRegex("\\d+", "g", "a1 b22 c333");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.matches.map((m) => m.match)).toEqual(["1", "22", "333"]);
  });

  it("returns capture groups", () => {
    const result = runRegex("(\\w)(\\d)", "g", "a1");
    if (result.ok) expect(result.matches[0].groups.map((g) => g.value)).toEqual(["a", "1"]);
  });

  it("returns named groups", () => {
    const result = runRegex("(?<letter>\\w)", "g", "a");
    if (result.ok) expect(result.matches[0].groups.some((g) => g.name === "letter")).toBe(true);
  });

  it("explains an invalid pattern instead of throwing", () => {
    const result = runRegex("(unclosed", "g", "text");
    expect(result.ok).toBe(false);
  });

  it("does not hang on a zero-width match", () => {
    const result = runRegex("a*", "g", "bbb");
    expect(result.ok).toBe(true);
  });

  it("returns no matches for an empty pattern", () => {
    const result = runRegex("", "g", "anything");
    if (result.ok) expect(result.matches).toHaveLength(0);
  });
});
