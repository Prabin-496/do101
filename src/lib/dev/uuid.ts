export type UuidFormat = "standard" | "uppercase" | "no-dashes" | "braces";

export const MAX_UUIDS = 1000;

function randomUuid(): string {
  const c: Crypto | undefined = typeof crypto !== "undefined" ? crypto : undefined;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  if (!c) throw new Error("This browser has no cryptographic random source.");
  // Fallback still uses a cryptographic source.
  const bytes = new Uint8Array(16);
  c.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function formatUuid(uuid: string, format: UuidFormat): string {
  switch (format) {
    case "uppercase":
      return uuid.toUpperCase();
    case "no-dashes":
      return uuid.replace(/-/g, "");
    case "braces":
      return `{${uuid}}`;
    default:
      return uuid;
  }
}

export function generateUuids(count: number, format: UuidFormat = "standard"): string[] {
  const n = Math.max(1, Math.min(Math.floor(count) || 1, MAX_UUIDS));
  return Array.from({ length: n }, () => formatUuid(randomUuid(), format));
}

export const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
