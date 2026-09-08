"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Toggle } from "@/components/ui/Field";
import { ErrorState, EmptyState, InfoNote, SuccessNote } from "@/components/ui/Feedback";
import { unlockPdf, inspectProtection } from "@/lib/pdf/security";
import { downloadBytes, pdfName, PdfError, MAX_PDF_BYTES } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

interface Loaded {
  name: string;
  size: number;
  bytes: ArrayBuffer;
  opensWithoutPassword: boolean;
  encrypted: boolean;
}

/**
 * Loads the file directly rather than through usePdfFiles, because that helper
 * deliberately refuses encrypted documents — which are exactly what this page
 * is for.
 */
export function PdfUnlock() {
  const [file, setFile] = React.useState<Loaded | null>(null);
  const [password, setPassword] = React.useState("");
  const [reveal, setReveal] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<{ bytes: Uint8Array; neededPassword: boolean } | null>(
    null,
  );

  const load = async (files: File[]) => {
    const incoming = files[0];
    if (!incoming) return;
    setError(null);
    setResult(null);
    setPassword("");

    if (incoming.size > MAX_PDF_BYTES) {
      setError(`${incoming.name} is larger than the 100 MB limit.`);
      return;
    }

    setBusy(true);
    try {
      const bytes = await incoming.arrayBuffer();
      const state = await inspectProtection(bytes);
      setFile({ name: incoming.name, size: incoming.size, bytes, ...state });
      if (!state.encrypted) {
        setError(
          `${incoming.name} is not protected at all — there is nothing here to remove. You can use it as it is.`,
        );
      }
    } catch {
      setError(`${incoming.name} could not be read as a PDF.`);
    } finally {
      setBusy(false);
    }
  };

  const unlock = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      setResult(await unlockPdf(file.bytes, password));
      track("tool_complete", { tool: "pdf-unlock" });
      recordCompletion(15);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "This PDF could not be unlocked.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <InfoNote icon="⚖️">
        <strong>This removes protection you are entitled to remove.</strong> It strips the
        restrictions from a PDF that already opens on your machine, and removes a password when you
        type the password yourself. It is <strong>not</strong> a password cracker and will not open a
        document you do not have the password for — a wrong password is rejected outright. Only use
        it on documents you own or have permission to modify.
      </InfoNote>

      {!file ? (
        <FileDrop
          onFiles={load}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="🔓"
          title="Drop the protected PDF"
          hint="Unlocked on your device · the file and password never leave your browser"
          disabled={busy}
        />
      ) : null}

      {error ? <ErrorState message={error} /> : null}

      {file ? (
        <>
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold">
                📄 {file.name} · {formatBytes(file.size)}
              </p>
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  setFile(null);
                  setResult(null);
                  setError(null);
                }}
              >
                Choose another
              </Button>
            </div>

            {!file.encrypted ? (
              <p className="rounded-xl bg-[var(--sky-soft)] px-4 py-3 text-sm font-bold">
                This PDF carries no encryption. Nothing needs removing.
              </p>
            ) : file.opensWithoutPassword ? (
              <p className="rounded-xl bg-[var(--grass-soft)] px-4 py-3 text-sm font-bold">
                ✅ This PDF opens without a password but carries{" "}
                <strong>permission restrictions</strong> — the kind that block printing or copying.
                Those can be removed now, no password needed.
              </p>
            ) : (
              <>
                <p className="rounded-xl bg-[var(--sun-soft)] px-4 py-3 text-sm font-bold">
                  🔒 This PDF asks for a password when it opens. Type the password you normally use
                  and it will be removed from the copy you download.
                </p>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="unlock-password">Document password</Label>
                    <Input
                      id="unlock-password"
                      type={reveal ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="off"
                      placeholder="The password you use to open it"
                    />
                  </div>
                  <div className="flex items-end">
                    <Toggle checked={reveal} onChange={setReveal} label="Show the password" />
                  </div>
                </div>
              </>
            )}

            {file.encrypted ? (
              <div className="mt-4">
                <Button
                  tone="cherry"
                  onClick={unlock}
                  disabled={busy || (!file.opensWithoutPassword && !password)}
                >
                  {busy ? "Unlocking…" : "Remove protection"}
                </Button>
              </div>
            ) : null}
          </Card>

          {result ? (
            <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
              <SuccessNote>
                {result.neededPassword
                  ? "Password removed — this copy opens without one."
                  : "Restrictions removed — printing and copying are no longer blocked."}
              </SuccessNote>
              <Button
                tone="grass"
                onClick={() => downloadBytes(result.bytes, pdfName(file.name, "unlocked"))}
              >
                Download unlocked PDF
              </Button>
            </Card>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="🔓"
          title="No PDF yet"
          description="Add a protected PDF and DO101 will tell you which kind of protection it carries."
        />
      )}
    </div>
  );
}
