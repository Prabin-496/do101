"use client";

import * as React from "react";
import { Card } from "@/components/ui/Card";
import { Textarea, Input, Label } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { FileDrop } from "@/components/ui/FileDrop";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState } from "@/components/ui/Feedback";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";

const ALGOS = ["SHA-1", "SHA-256", "SHA-384", "SHA-512"] as const;
type Algo = (typeof ALGOS)[number];

const MAX_FILE = 100 * 1024 * 1024;

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toBase64(buffer: ArrayBuffer): string {
  let binary = "";
  new Uint8Array(buffer).forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary);
}

export function HashGenerator() {
  const [source, setSource] = React.useState<"text" | "file">("text");
  const [text, setText] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [hashes, setHashes] = React.useState<Record<Algo, { hex: string; b64: string }> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [expected, setExpected] = React.useState("");

  const compute = React.useCallback(
    async (data: BufferSource) => {
      setBusy(true);
      setError(null);
      try {
        const entries = await Promise.all(
          ALGOS.map(async (algo) => {
            const digest = await crypto.subtle.digest(algo, data);
            return [algo, { hex: toHex(digest), b64: toBase64(digest) }] as const;
          }),
        );
        setHashes(Object.fromEntries(entries) as Record<Algo, { hex: string; b64: string }>);
        track("tool_complete", { tool: "hash-generator" });
      } catch {
        setError("Hashing failed. Web Crypto needs a secure context (https or localhost).");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    if (source !== "text" || !text) return;
    const id = window.setTimeout(() => compute(new TextEncoder().encode(text)), 150);
    return () => window.clearTimeout(id);
  }, [text, source, compute]);

  const onFiles = async (files: File[]) => {
    const f = files[0];
    if (!f) return;
    if (f.size > MAX_FILE) {
      setError(`${f.name} is ${formatBytes(f.size)} — files over 100 MB are not supported here.`);
      return;
    }
    setFile(f);
    const buffer = await f.arrayBuffer();
    await compute(buffer);
  };

  const normalisedExpected = expected.trim().toLowerCase();
  const matchedAlgo = hashes
    ? ALGOS.find((a) => hashes[a].hex === normalisedExpected || hashes[a].b64 === expected.trim())
    : undefined;

  return (
    <div className="space-y-4">
      <Tabs
        ariaLabel="Hash source"
        value={source}
        onChange={(v) => {
          setSource(v as "text" | "file");
          setHashes(null);
          setError(null);
        }}
        items={[
          { id: "text", label: "Hash text" },
          { id: "file", label: "Hash a file" },
        ]}
      />

      {source === "text" ? (
        <div>
          <Label htmlFor="hash-in">Text to hash</Label>
          <Textarea
            id="hash-in"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (!e.target.value) setHashes(null);
            }}
            placeholder="Type anything — the digests update as you type."
            className="min-h-[140px] font-mono text-sm"
          />
        </div>
      ) : (
        <>
          <FileDrop
            onFiles={onFiles}
            accept="*/*"
            multiple={false}
            icon="📄"
            title="Drop a file to hash"
            hint="Up to 100 MB · read locally, never uploaded"
          />
          {file ? (
            <p className="text-sm font-extrabold">
              {file.name} · {formatBytes(file.size)}
            </p>
          ) : null}
        </>
      )}

      {busy ? <p className="text-sm font-extrabold text-[var(--muted)]">Hashing…</p> : null}
      {error ? <ErrorState message={error} /> : null}

      {hashes ? (
        <>
          <Card className="divide-y-2 divide-[var(--border)]">
            {ALGOS.map((algo) => (
              <div key={algo} className="p-4">
                <div className="mb-1 flex items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
                    {algo}
                  </h3>
                  <div className="flex gap-2">
                    <CopyButton value={hashes[algo].hex} label="Hex" size="sm" />
                    <CopyButton value={hashes[algo].b64} label="Base64" size="sm" />
                  </div>
                </div>
                <code className="block break-all font-mono text-xs font-bold">
                  {hashes[algo].hex}
                </code>
              </div>
            ))}
          </Card>

          <Card className="p-5">
            <Label htmlFor="expected">Compare with a published checksum</Label>
            <Input
              id="expected"
              value={expected}
              onChange={(e) => setExpected(e.target.value)}
              placeholder="Paste the digest you were given…"
              className="font-mono text-sm"
            />
            {expected.trim() ? (
              matchedAlgo ? (
                <p className="mt-3 rounded-xl bg-[var(--grass-soft)] px-4 py-3 text-sm font-extrabold text-[var(--grass-dark)] dark:text-[var(--grass)]">
                  ✅ Matches the {matchedAlgo} digest.
                </p>
              ) : (
                <p className="mt-3 rounded-xl bg-[var(--cherry-soft)] px-4 py-3 text-sm font-extrabold">
                  ❌ No match against any of the four digests above.
                </p>
              )
            ) : null}
          </Card>

          <Button
            tone="ghost"
            onClick={() => {
              setText("");
              setFile(null);
              setHashes(null);
              setExpected("");
            }}
          >
            Reset
          </Button>
        </>
      ) : null}
    </div>
  );
}
