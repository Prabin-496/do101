import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Label({
  className,
  children,
  hint,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { hint?: string }) {
  return (
    <label className={cn("mb-1.5 flex items-baseline justify-between gap-2", className)} {...props}>
      <span className="text-xs font-extrabold uppercase tracking-wider text-[var(--muted)]">
        {children}
      </span>
      {hint ? <span className="text-xs font-semibold text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn("do-input", className)} {...props} />;
  },
);

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn("do-input do-scroll min-h-[160px] resize-y font-medium", className)}
      spellCheck={false}
      {...props}
    />
  );
});

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn("do-input cursor-pointer appearance-none pr-9", className)} {...props}>
      {children}
    </select>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors",
        checked
          ? "border-[var(--grass)] bg-[var(--grass-soft)]"
          : "border-[var(--border)] hover:bg-[var(--panel)]",
      )}
    >
      <span
        className={cn(
          "relative h-6 w-11 shrink-0 rounded-full transition-colors",
          checked ? "bg-[var(--grass)]" : "bg-[var(--border)]",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all",
            checked ? "left-[22px]" : "left-0.5",
          )}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-extrabold">{label}</span>
        {description ? (
          <span className="block text-xs font-semibold text-[var(--muted)]">{description}</span>
        ) : null}
      </span>
    </button>
  );
}

export function Slider({
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="range"
      className={cn(
        "h-3 w-full cursor-pointer appearance-none rounded-full bg-[var(--panel-2)] accent-[var(--grass)]",
        className,
      )}
      {...props}
    />
  );
}
