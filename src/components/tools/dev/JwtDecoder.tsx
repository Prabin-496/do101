"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { ErrorState, InfoNote } from "@/components/ui/Feedback";
import { decodeJwt, JWT_CLAIM_HELP } from "@/lib/dev/jwt";
import { track } from "@/lib/analytics";

function DateLine({ label, ms }: { label: string; ms?: number }) {
  if (ms === undefined) return null;
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-[var(--border)] py-2 last:border-0">
      <span className="text-xs font-extrabold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <span className="text-sm font-bold">{new Date(ms).toLocaleString()}</span>
    </div>
  );
}

export function JwtDecoder() {
  const [token, setToken] = React.useState("");
  const result = React.useMemo(() => (token.trim() ? decodeJwt(token) : null), [token]);

  React.useEffect(() => {
    if (result?.ok) track("tool_complete", { tool: "jwt-decoder" });
  }, [result?.ok]);

  const claims =
    result?.ok
      ? Object.keys(result.jwt.payload.data).filter((k) => JWT_CLAIM_HELP[k])
      : [];

  return (
    <div className="space-y-4">
      <div>
        <label
          htmlFor="jwt-in"
          className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
        >
          JSON Web Token
        </label>
        <Textarea
          id="jwt-in"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.signature"
          className="min-h-[130px] font-mono text-sm"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button tone="ghost" onClick={() => setToken("")} disabled={!token}>
          Clear
        </Button>
      </div>

      <InfoNote icon="⚠️">
        <strong>Decoding a JWT does not verify its signature.</strong> Anyone can read — or forge —
        the contents of an unverified token. Only your server, holding the secret or public key, can
        confirm a token is authentic.
      </InfoNote>

      {result && !result.ok ? <ErrorState message={result.error} /> : null}

      {result?.ok ? (
        <>
          {result.jwt.isExpired ? (
            <p className="rounded-2xl border-2 border-[var(--cherry)] bg-[var(--cherry-soft)] px-4 py-3 text-sm font-extrabold">
              ⏰ This token expired {new Date(result.jwt.expiresAt!).toLocaleString()}.
            </p>
          ) : result.jwt.expiresAt ? (
            <p className="rounded-2xl border-2 border-[var(--grass)] bg-[var(--grass-soft)] px-4 py-3 text-sm font-extrabold">
              ✅ Not expired — valid until {new Date(result.jwt.expiresAt).toLocaleString()}.
            </p>
          ) : null}

          {result.jwt.isNotYetValid ? (
            <p className="rounded-2xl border-2 border-[var(--fire)] bg-[var(--fire-soft)] px-4 py-3 text-sm font-extrabold">
              This token is not valid yet (nbf is in the future).
            </p>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            {(
              [
                ["Header", result.jwt.header.json, "sky"],
                ["Payload", result.jwt.payload.json, "grape"],
              ] as const
            ).map(([label, json, tone]) => (
              <Card key={label} className="overflow-hidden">
                <div className="flex items-center justify-between border-b-2 border-[var(--border)] px-4 py-2">
                  <h3
                    className="text-sm font-extrabold uppercase tracking-wider"
                    style={{ color: `var(--${tone})` }}
                  >
                    {label}
                  </h3>
                  <CopyButton value={json} label="Copy" size="sm" />
                </div>
                <pre className="do-scroll max-h-[280px] overflow-auto p-4 font-mono text-xs leading-relaxed">
                  {json}
                </pre>
              </Card>
            ))}
          </div>

          {result.jwt.issuedAt || result.jwt.expiresAt || result.jwt.notBefore ? (
            <Card className="p-5">
              <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
                Timestamps
              </h3>
              <DateLine label="Issued at (iat)" ms={result.jwt.issuedAt} />
              <DateLine label="Not before (nbf)" ms={result.jwt.notBefore} />
              <DateLine label="Expires (exp)" ms={result.jwt.expiresAt} />
            </Card>
          ) : null}

          {claims.length ? (
            <Card className="p-5">
              <h3 className="mb-3 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
                What these claims mean
              </h3>
              <dl className="space-y-2">
                {claims.map((claim) => (
                  <div key={claim} className="flex flex-wrap gap-2">
                    <dt className="font-mono text-sm font-extrabold">{claim}</dt>
                    <dd className="text-sm font-semibold text-[var(--muted)]">
                      {JWT_CLAIM_HELP[claim]}
                    </dd>
                  </div>
                ))}
              </dl>
            </Card>
          ) : null}

          <Card className="p-4">
            <p className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
              Signature (not verified)
            </p>
            <code className="mt-1 block break-all font-mono text-xs">
              {result.jwt.signature || "— none —"}
            </code>
          </Card>
        </>
      ) : null}
    </div>
  );
}
