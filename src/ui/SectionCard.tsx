"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface SectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned slot in the header row (e.g. an inline action button). */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Visual emphasis variant. `subtle` removes the border for nested usage. */
  variant?: "default" | "subtle";
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  variant = "default",
}: SectionCardProps) {
  return (
    <section
      className={cn(
        "rounded-lg bg-white",
        variant === "default" && "border border-zinc-200",
        variant === "subtle" && "",
        className,
      )}
    >
      {(title || description || action) && (
        <header
          className={cn(
            "flex items-start gap-3 px-4 pt-4",
            children ? "pb-3" : "pb-4",
          )}
        >
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-[13px] font-semibold text-zinc-900 leading-tight">
                {title}
              </h3>
            )}
            {description && (
              <p className="text-[12px] text-zinc-500 mt-0.5">{description}</p>
            )}
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </header>
      )}
      {children && <div className="px-4 pb-4">{children}</div>}
    </section>
  );
}
