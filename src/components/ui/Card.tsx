import * as React from "react";
import { cn } from "@/lib/utils/cn";

export function Card({
  className,
  hover = false,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { hover?: boolean }) {
  return <div className={cn("do-card", hover && "do-card-hover", className)} {...props} />;
}

export function CardBody({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5 sm:p-6", className)} {...props} />;
}

export function SectionTitle({
  icon,
  title,
  subtitle,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-4", className)}>
      <h2 className="flex items-center gap-2 text-xl sm:text-2xl">
        {icon ? <span aria-hidden>{icon}</span> : null}
        {title}
      </h2>
      {subtitle ? <p className="mt-1 text-sm text-[var(--muted)]">{subtitle}</p> : null}
    </div>
  );
}
