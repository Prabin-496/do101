"use client";

import * as React from "react";
import { Button, type ButtonTone, type ButtonSize } from "./Button";

export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied!",
  tone = "panel",
  size = "sm",
  disabled,
  className,
  onCopied,
}: {
  value: string | (() => string);
  label?: string;
  copiedLabel?: string;
  tone?: ButtonTone;
  size?: ButtonSize;
  disabled?: boolean;
  className?: string;
  onCopied?: () => void;
}) {
  const [copied, setCopied] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  const copy = async () => {
    const text = typeof value === "function" ? value() : value;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setFailed(false);
      onCopied?.();
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setFailed(true);
      setTimeout(() => setFailed(false), 2400);
    }
  };

  return (
    <Button
      type="button"
      tone={copied ? "grass" : tone}
      size={size}
      onClick={copy}
      disabled={disabled}
      className={className}
      aria-live="polite"
    >
      {failed ? "Press ⌘C" : copied ? copiedLabel : label}
    </Button>
  );
}
