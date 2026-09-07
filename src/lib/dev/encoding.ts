/* Unicode-safe Base64 plus URL encoding helpers. */

export function encodeBase64(text: string, urlSafe = false): string {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  const b64 = btoa(binary);
  return urlSafe ? b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "") : b64;
}

export function decodeBase64(input: string): string {
  let normalized = input.trim().replace(/\s/g, "").replace(/-/g, "+").replace(/_/g, "/");
  while (normalized.length % 4 !== 0) normalized += "=";
  const binary = atob(normalized);
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

export function isProbablyBase64(input: string): boolean {
  const s = input.trim().replace(/\s/g, "");
  return s.length > 3 && /^[A-Za-z0-9+/\-_]+={0,2}$/.test(s);
}

export function encodeUrl(text: string, mode: "component" | "uri"): string {
  return mode === "component" ? encodeURIComponent(text) : encodeURI(text);
}

export function decodeUrl(text: string): string {
  return decodeURIComponent(text.replace(/\+/g, " "));
}

export interface ParsedQuery {
  base: string;
  params: Array<{ key: string; value: string }>;
}

export function parseQueryString(input: string): ParsedQuery | null {
  const text = input.trim();
  if (!text) return null;
  const qIndex = text.indexOf("?");
  const base = qIndex >= 0 ? text.slice(0, qIndex) : "";
  const query = qIndex >= 0 ? text.slice(qIndex + 1) : text.includes("=") ? text : "";
  if (!query) return null;
  const params = query
    .split("&")
    .filter(Boolean)
    .map((pair) => {
      const [k, ...rest] = pair.split("=");
      const raw = rest.join("=");
      const safeDecode = (v: string) => {
        try {
          return decodeURIComponent(v.replace(/\+/g, " "));
        } catch {
          return v;
        }
      };
      return { key: safeDecode(k), value: safeDecode(raw) };
    });
  return { base, params };
}
