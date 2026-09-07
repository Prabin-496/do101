import { decodeBase64 } from "./encoding";

export interface JwtPart {
  raw: string;
  json: string;
  data: Record<string, unknown>;
}

export interface DecodedJwt {
  header: JwtPart;
  payload: JwtPart;
  signature: string;
  /** Standard time claims resolved to milliseconds, when present. */
  issuedAt?: number;
  notBefore?: number;
  expiresAt?: number;
  isExpired?: boolean;
  isNotYetValid?: boolean;
}

export type JwtResult =
  | { ok: true; jwt: DecodedJwt }
  | { ok: false; error: string };

function decodePart(part: string, label: string): JwtPart {
  let json: string;
  try {
    json = decodeBase64(part);
  } catch {
    throw new Error(`The ${label} is not valid base64url.`);
  }
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(json) as Record<string, unknown>;
  } catch {
    throw new Error(`The ${label} did not contain valid JSON.`);
  }
  return { raw: part, json: JSON.stringify(data, null, 2), data };
}

export function decodeJwt(token: string): JwtResult {
  const trimmed = token.trim().replace(/^Bearer\s+/i, "");
  if (!trimmed) return { ok: false, error: "Paste a token to decode." };

  const parts = trimmed.split(".");
  if (parts.length < 2) {
    return {
      ok: false,
      error: "A JWT has three dot-separated parts: header.payload.signature.",
    };
  }

  try {
    const header = decodePart(parts[0], "header");
    const payload = decodePart(parts[1], "payload");
    const num = (k: string) =>
      typeof payload.data[k] === "number" ? (payload.data[k] as number) * 1000 : undefined;

    const expiresAt = num("exp");
    const notBefore = num("nbf");
    const now = Date.now();

    return {
      ok: true,
      jwt: {
        header,
        payload,
        signature: parts[2] ?? "",
        issuedAt: num("iat"),
        notBefore,
        expiresAt,
        isExpired: expiresAt !== undefined ? expiresAt < now : undefined,
        isNotYetValid: notBefore !== undefined ? notBefore > now : undefined,
      },
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Could not decode token." };
  }
}

export const JWT_CLAIM_HELP: Record<string, string> = {
  iss: "Issuer — who created and signed the token.",
  sub: "Subject — who the token is about, usually a user id.",
  aud: "Audience — the recipient the token is intended for.",
  exp: "Expiration time — the token must be rejected after this moment.",
  nbf: "Not before — the token must be rejected before this moment.",
  iat: "Issued at — when the token was created.",
  jti: "JWT ID — a unique identifier used to prevent replay.",
  alg: "Algorithm used to sign the token.",
  typ: "Token type, almost always JWT.",
  kid: "Key ID — tells the verifier which key signed this token.",
  scope: "Permissions granted to the token holder.",
};
