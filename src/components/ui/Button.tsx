import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";

export type ButtonTone = "grass" | "sky" | "grape" | "fire" | "cherry" | "ghost" | "panel";
export type ButtonSize = "sm" | "md" | "lg";

const TONES: Record<ButtonTone, string> = {
  grass: "[--btn-bg:var(--grass)] [--btn-shadow:var(--grass-dark)] [--btn-fg:#fff]",
  sky: "[--btn-bg:var(--sky)] [--btn-shadow:var(--sky-dark)] [--btn-fg:#fff]",
  grape: "[--btn-bg:var(--grape)] [--btn-shadow:var(--grape-dark)] [--btn-fg:#fff]",
  fire: "[--btn-bg:var(--fire)] [--btn-shadow:var(--fire-dark)] [--btn-fg:#fff]",
  cherry: "[--btn-bg:var(--cherry)] [--btn-shadow:var(--cherry-dark)] [--btn-fg:#fff]",
  ghost: "do-btn-ghost",
  panel:
    "[--btn-bg:var(--panel)] [--btn-shadow:var(--border-strong)] [--btn-fg:var(--ink)] border-2 border-[var(--border)]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "text-xs px-3.5 py-2 rounded-xl",
  md: "text-sm px-5 py-3",
  lg: "text-base px-7 py-4",
};

export function buttonClass(tone: ButtonTone = "grass", size: ButtonSize = "md", extra?: string) {
  return cn("do-btn", TONES[tone], SIZES[size], extra);
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: ButtonTone;
  size?: ButtonSize;
}

export function Button({ tone = "grass", size = "md", className, ...props }: ButtonProps) {
  return <button className={buttonClass(tone, size, className)} {...props} />;
}

interface ButtonLinkProps extends React.ComponentProps<typeof Link> {
  tone?: ButtonTone;
  size?: ButtonSize;
}

export function ButtonLink({ tone = "grass", size = "md", className, ...props }: ButtonLinkProps) {
  return <Link className={buttonClass(tone, size, className)} {...props} />;
}
