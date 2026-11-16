import * as React from "react";

/**
 * One heading style for every section of an item's Pricing tab (Variants or
 * Tickets, Donations, Discount codes): a title and one muted sentence. The
 * approved redesign (pricing-donations-and-code-editor-v1.html, 2026-11-16)
 * found three styles on one page; this is the "Variants" one, which the
 * product and event packages already used, made shared so they cannot drift.
 */
export function PricingSectionHeading({
  title,
  description,
  action,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** A small action on the right (e.g. "New" once a list exists). */
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {/* Theme-aware: an event page can be dark. Falls back to the zinc the
            light pages already used. */}
        <h2 className="text-[15px] font-semibold" style={{ color: "var(--text-color, #18181b)" }}>{title}</h2>
        {description && (
          <p className="mt-1 max-w-[68ch] text-[12px] leading-relaxed"
            style={{ color: "color-mix(in srgb, var(--text-color, #18181b) 60%, transparent)" }}>{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
