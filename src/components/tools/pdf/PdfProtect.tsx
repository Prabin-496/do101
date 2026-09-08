"use client";

import * as React from "react";
import { FileDrop } from "@/components/ui/FileDrop";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input, Label, Toggle } from "@/components/ui/Field";
import { ErrorState, EmptyState, InfoNote, SuccessNote } from "@/components/ui/Feedback";
import { usePdfFiles } from "./usePdfFile";
import { protectPdf } from "@/lib/pdf/security";
import { downloadBytes, pdfName, PdfError } from "@/lib/pdf/engine";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";
import { recordCompletion } from "@/lib/gamify";

/** Rough, honest strength feedback — length and variety, nothing more. */
function assessPassword(password: string): { label: string; tone: string; hint: string } {
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  if (password.length === 0) return { label: "", tone: "muted", hint: "" };
  if (password.length < 8) {
    return { label: "Too short", tone: "cherry", hint: "Use at least 8 characters — 12 or more is much better." };
  }
  if (password.length >= 16 || (password.length >= 12 && classes >= 3)) {
    return { label: "Strong", tone: "grass", hint: "Good. Store it somewhere you will not lose it." };
  }
  if (classes >= 3) return { label: "Reasonable", tone: "sun", hint: "Longer is better than more symbols." };
  return { label: "Weak", tone: "fire", hint: "A longer passphrase of several words beats a short complex one." };
}

export function PdfProtect() {
  const { files, error, setError, loading, add, reset } = usePdfFiles(false);
  const [password, setPassword] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [reveal, setReveal] = React.useState(false);
  const [allowPrinting, setAllowPrinting] = React.useState(true);
  const [allowCopying, setAllowCopying] = React.useState(false);
  const [allowModifying, setAllowModifying] = React.useState(false);
  const [allowAnnotating, setAllowAnnotating] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Uint8Array | null>(null);

  const file = files[0];
  const strength = assessPassword(password);
  const mismatch = confirm.length > 0 && confirm !== password;

  const apply = async () => {
    if (!file || !password || mismatch) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const bytes = await protectPdf(file.bytes, {
        userPassword: password,
        allowPrinting,
        allowCopying,
        allowModifying,
        allowAnnotating,
      });
      setResult(bytes);
      track("tool_complete", { tool: "pdf-protect" });
      recordCompletion(15);
    } catch (err) {
      setError(err instanceof PdfError ? err.message : "The document could not be protected.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <InfoNote icon="🔐">
        <strong>Real AES encryption, applied on your device.</strong> The password never leaves this
        page and is not stored anywhere — not by DO101, not in your browser. That also means{" "}
        <strong>nobody can recover it for you</strong>: if you forget it, the document is gone.
      </InfoNote>

      {!file ? (
        <FileDrop
          onFiles={add}
          accept="application/pdf,.pdf"
          multiple={false}
          icon="🔐"
          title="Drop the PDF you want to protect"
          hint="Encrypted on your device · nothing is uploaded"
        />
      ) : null}

      {loading ? <p className="text-sm font-extrabold text-[var(--muted)]">Reading…</p> : null}
      {error ? <ErrorState message={error} /> : null}

      {file ? (
        <>
          <Card className="p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-extrabold">
                📄 {file.name} · {file.pageCount} pages · {formatBytes(file.size)}
              </p>
              <Button
                size="sm"
                tone="ghost"
                onClick={() => {
                  reset();
                  setResult(null);
                }}
              >
                Choose another
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="pdf-password" hint={strength.label}>
                  Password
                </Label>
                <Input
                  id="pdf-password"
                  type={reveal ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="A passphrase of several words works well"
                />
                {strength.hint ? (
                  <p
                    className="mt-1 text-xs font-bold"
                    style={{ color: `var(--${strength.tone})` }}
                  >
                    {strength.hint}
                  </p>
                ) : null}
              </div>
              <div>
                <Label htmlFor="pdf-confirm">Confirm password</Label>
                <Input
                  id="pdf-confirm"
                  type={reveal ? "text" : "password"}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                />
                {mismatch ? (
                  <p className="mt-1 text-xs font-extrabold text-[var(--cherry)]">
                    The two passwords do not match.
                  </p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <Toggle
                  checked={reveal}
                  onChange={setReveal}
                  label="Show the password"
                  description="Useful for checking a long passphrase before you commit to it."
                />
              </div>
            </div>

            <h3 className="mb-3 mt-6 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
              What someone with the password may do
            </h3>
            <div className="grid gap-2 sm:grid-cols-2">
              <Toggle checked={allowPrinting} onChange={setAllowPrinting} label="Print" />
              <Toggle checked={allowCopying} onChange={setAllowCopying} label="Copy text" />
              <Toggle checked={allowModifying} onChange={setAllowModifying} label="Edit the document" />
              <Toggle checked={allowAnnotating} onChange={setAllowAnnotating} label="Add comments" />
            </div>
            <p className="mt-3 text-xs font-semibold text-[var(--muted)]">
              These permissions are recorded in the file and respected by mainstream readers. They
              are a policy signal rather than a hard guarantee — the password itself is what actually
              protects the contents.
            </p>

            <div className="mt-4">
              <Button
                tone="cherry"
                onClick={apply}
                disabled={busy || !password || mismatch || password !== confirm}
              >
                {busy ? "Encrypting…" : "Protect PDF"}
              </Button>
            </div>
          </Card>

          {result ? (
            <Card className="do-pop space-y-3 bg-[var(--grass-soft)] p-5">
              <SuccessNote>
                Encrypted · {formatBytes(result.length)}. Opening it now asks for your password.
              </SuccessNote>
              <p className="rounded-xl bg-[var(--bg)] px-3 py-2 text-sm font-semibold">
                ⚠️ Save the password somewhere safe first. There is no recovery — not by you and not
                by DO101.
              </p>
              <Button
                tone="grass"
                onClick={() => downloadBytes(result, pdfName(file.name, "protected"))}
              >
                Download protected PDF
              </Button>
            </Card>
          ) : null}
        </>
      ) : (
        <EmptyState
          icon="🔐"
          title="No PDF yet"
          description="Add a PDF and choose a password to encrypt it on your own device."
        />
      )}
    </div>
  );
}
