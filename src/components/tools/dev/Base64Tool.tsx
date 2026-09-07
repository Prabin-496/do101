"use client";

import * as React from "react";
import { Textarea, Toggle } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { Tabs } from "@/components/ui/Tabs";
import { ErrorState, InfoNote } from "@/components/ui/Feedback";
import { FileDrop } from "@/components/ui/FileDrop";
import { encodeBase64, decodeBase64 } from "@/lib/dev/encoding";
import { formatBytes } from "@/lib/utils/format";
import { track } from "@/lib/analytics";

const MAX_FILE = 2 * 1024 * 1024;

export function Base64Tool() {
  const [mode, setMode] = React.useState<"encode" | "decode">("encode");
  const [input, setInput] = React.useState("");
  const [urlSafe, setUrlSafe] = React.useState(false);
  const [dataUri, setDataUri] = React.useState<{ name: string; value: string } | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);

  const { output, error } = React.useMemo(() => {
    if (!input.trim()) return { output: "", error: null as string | null };
    try {
      return {
        output: mode === "encode" ? encodeBase64(input, urlSafe) : decodeBase64(input),
        error: null,
      };
    } catch {
      return {
        output: "",
        error:
          mode === "decode"
            ? "That is not valid Base64. Check for missing characters or stray whitespace."
            : "This text could not be encoded.",
      };
    }
  }, [input, mode, urlSafe]);

  const onFiles = async (files: File[]) => {
    const file = files[0];
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_FILE) {
      setFileError(
        `${file.name} is ${formatBytes(file.size)} — the 2 MB limit keeps the page responsive.`,
      );
      return;
    }
    try {
      const buffer = await file.arrayBuffer();
      let binary = "";
      new Uint8Array(buffer).forEach((b) => {
        binary += String.fromCharCode(b);
      });
      setDataUri({
        name: file.name,
        value: `data:${file.type || "application/octet-stream"};base64,${btoa(binary)}`,
      });
      track("tool_complete", { tool: "base64", mode: "file" });
    } catch {
      setFileError(`${file.name} could not be read.`);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs
        ariaLabel="Base64 mode"
        value={mode}
        onChange={(v) => setMode(v as "encode" | "decode")}
        items={[
          { id: "encode", label: "Encode →" },
          { id: "decode", label: "← Decode" },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <label
            htmlFor="b64-in"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            {mode === "encode" ? "Plain text" : "Base64"}
          </label>
          <Textarea
            id="b64-in"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "encode" ? "Type anything — emoji included 🎉" : "SGVsbG8gd29ybGQ="}
            className="min-h-[220px] font-mono text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="b64-out"
            className="mb-1.5 block text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]"
          >
            {mode === "encode" ? "Base64" : "Plain text"}
          </label>
          <Textarea
            id="b64-out"
            value={output}
            readOnly
            placeholder="The result appears here."
            className="min-h-[220px] bg-[var(--panel)] font-mono text-sm"
          />
        </div>
      </div>

      {mode === "encode" ? (
        <Toggle
          checked={urlSafe}
          onChange={setUrlSafe}
          label="URL-safe output"
          description="Uses - and _ instead of + and /, with no padding. This is what JWTs use."
        />
      ) : null}

      <div className="flex flex-wrap gap-2">
        <CopyButton
          value={output}
          label="Copy result"
          tone="grass"
          size="md"
          disabled={!output}
          onCopied={() => track("tool_complete", { tool: "base64", mode })}
        />
        <Button
          tone="sky"
          onClick={() => {
            setInput(output);
            setMode(mode === "encode" ? "decode" : "encode");
          }}
          disabled={!output}
        >
          Send result back
        </Button>
        <Button
          tone="ghost"
          onClick={() => {
            setInput("");
            setDataUri(null);
            setFileError(null);
          }}
          disabled={!input}
        >
          Clear
        </Button>
      </div>

      {error ? <ErrorState message={error} /> : null}

      <div className="pt-2">
        <h3 className="mb-2 text-sm font-extrabold uppercase tracking-wider text-[var(--muted)]">
          File → data URI
        </h3>
        <FileDrop
          onFiles={onFiles}
          accept="*/*"
          multiple={false}
          icon="📎"
          title="Drop a small file"
          hint="Up to 2 MB · the data URI is copied to your clipboard"
        />
        {dataUri ? (
          <div className="mt-3 space-y-2">
            <p className="text-sm font-extrabold text-[var(--grass)]">
              ✅ {dataUri.name} → {formatBytes(dataUri.value.length)} data URI
            </p>
            <Textarea
              readOnly
              aria-label="Data URI"
              value={dataUri.value}
              className="min-h-[120px] bg-[var(--panel)] font-mono text-xs"
            />
            <CopyButton value={dataUri.value} label="Copy data URI" tone="grass" />
          </div>
        ) : null}
        {fileError ? <ErrorState className="mt-2" message={fileError} /> : null}
      </div>

      <InfoNote icon="ℹ️">
        Base64 is an encoding, not encryption. Anyone can decode it — never use it to hide secrets.
      </InfoNote>
    </div>
  );
}
