"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface SectionCardProps {
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned slot in the header row. Renders as a button when
   *  `onClick` is unset; as a decorative node (e.g. a chevron) when
   *  `onClick` is set, because the whole card is then the click target.
   *  Nested `<button>` inside `<button>` is invalid HTML — pass a span
   *  with an icon instead. */
  action?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Visual emphasis variant. `subtle` removes the border for nested usage. */
  variant?: "default" | "subtle";
  /** Makes the entire card a clickable button. Better mobile UX than a
   *  small "Edit" affordance — the whole row becomes a tap target. */
  onClick?: () => void;
  /** Disables the click + dims the card. Only meaningful with `onClick`. */
  disabled?: boolean;
}

export function SectionCard({
  title,
  description,
  action,
  children,
  className,
  variant = "default",
  onClick,
  disabled,
}: SectionCardProps) {
  const interactive = !!onClick && !disabled;

  const content = (
    <>
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
    </>
  );

  const baseClass = cn(
    "rounded-lg bg-white",
    variant === "default" && "border border-zinc-200",
    variant === "subtle" && "",
    className,
  );

  if (interactive) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseClass,
          "block w-full text-left transition-colors cursor-pointer hover:bg-zinc-50/60",
        )}
      >
        {content}
      </button>
    );
  }

  if (onClick && disabled) {
    return (
      <div
        className={cn(
          baseClass,
          "block w-full text-left opacity-60 cursor-not-allowed",
        )}
        aria-disabled
      >
        {content}
      </div>
    );
  }

  return <section className={baseClass}>{content}</section>;
}
