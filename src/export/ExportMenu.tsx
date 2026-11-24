"use client";

/**
 * The Export button on the manage pages (T-397): one button, then a choice of
 * Excel (.xlsx) or CSV. The host keeps its own button look (`className`) and
 * label; the two options are format names, the same in every language, so they
 * need no copy of their own.
 */
import * as React from "react";
import type { ExportFormat } from "./tableExport";

export interface ExportMenuProps {
    /** The button's text, e.g. "Export". */
    label: React.ReactNode;
    onExport: (format: ExportFormat) => void;
    disabled?: boolean;
    /** Classes for the trigger button, so it matches the host's buttons. */
    className?: string;
    /** Which side the menu opens towards. */
    align?: "left" | "right";
    "data-testid"?: string;
}

const OPTIONS: Array<{ format: ExportFormat; label: string }> = [
    { format: "xlsx", label: "Excel (.xlsx)" },
    { format: "csv", label: "CSV (.csv)" },
];

export function ExportMenu({ label, onExport, disabled, className, align = "right", ...rest }: ExportMenuProps) {
    const [open, setOpen] = React.useState(false);
    const root = React.useRef<HTMLDivElement>(null);
    const menuId = React.useId();

    React.useEffect(() => {
        if (!open) return;
        const onDown = (e: MouseEvent) => {
            if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
        };
        const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
        document.addEventListener("mousedown", onDown);
        document.addEventListener("keydown", onKey);
        return () => {
            document.removeEventListener("mousedown", onDown);
            document.removeEventListener("keydown", onKey);
        };
    }, [open]);

    return (
        <div ref={root} className="relative inline-block">
            <button
                type="button"
                disabled={disabled}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-controls={open ? menuId : undefined}
                onClick={() => setOpen((v) => !v)}
                className={className}
                data-testid={rest["data-testid"]}
            >
                {label}
            </button>
            {open && (
                <div
                    id={menuId}
                    role="menu"
                    className={`absolute z-50 mt-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg ${align === "right" ? "right-0" : "left-0"}`}
                >
                    {OPTIONS.map((o) => (
                        <button
                            key={o.format}
                            type="button"
                            role="menuitem"
                            data-format={o.format}
                            onClick={() => { setOpen(false); onExport(o.format); }}
                            className="block w-full cursor-pointer px-3 py-2 text-left text-[13px] text-zinc-800 hover:bg-zinc-50"
                        >
                            {o.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
