"use client";

import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function FileDrop({
  onFiles,
  accept = "image/*",
  multiple = true,
  hint,
  title = "Drop images here",
  icon = "🖼️",
  disabled,
}: {
  onFiles: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  hint?: string;
  title?: string;
  icon?: string;
  disabled?: boolean;
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const handleFiles = (list: FileList | null) => {
    if (!list?.length) return;
    onFiles(Array.from(list));
  };

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(e.dataTransfer.files);
      }}
      className={cn(
        "rounded-2xl border-[3px] border-dashed p-6 text-center transition-colors sm:p-10",
        dragging
          ? "border-[var(--grass)] bg-[var(--grass-soft)]"
          : "border-[var(--border)] bg-[var(--panel)]",
        disabled && "pointer-events-none opacity-50",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        className="sr-only"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
      <span className={cn("block text-5xl", dragging ? "" : "do-bob")} aria-hidden>
        {icon}
      </span>
      <p className="mt-3 text-lg font-extrabold">{title}</p>
      <p className="mt-1 text-sm font-semibold text-[var(--muted)]">
        {hint ?? "or choose a file from your device"}
      </p>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="do-btn [--btn-bg:var(--grass)] [--btn-shadow:var(--grass-dark)] [--btn-fg:#fff] mt-4 px-6 py-3 text-sm"
      >
        Choose {multiple ? "files" : "file"}
      </button>
    </div>
  );
}
