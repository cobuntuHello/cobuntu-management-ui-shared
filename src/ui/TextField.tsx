"use client";

import * as React from "react";
import { cn } from "../lib/cn";

export interface TextFieldProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size" | "prefix"> {
  label?: string;
  hint?: string;
  error?: string;
  /** Optional right-side adornment (e.g. currency code, unit). */
  suffix?: React.ReactNode;
  /** Optional left-side adornment (e.g. currency symbol). */
  prefix?: React.ReactNode;
}

export const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  function TextField(
    { label, hint, error, suffix, prefix, className, id, ...props },
    ref,
  ) {
    const generatedId = React.useId();
    const inputId = id ?? generatedId;

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-[12px] font-medium text-zinc-700 mb-1.5"
          >
            {label}
          </label>
        )}
        <div
          className={cn(
            "flex items-center rounded-lg border border-zinc-200 bg-white focus-within:border-zinc-400 transition-colors",
            error && "border-red-300 focus-within:border-red-400",
            props.disabled && "opacity-50 cursor-not-allowed",
          )}
        >
          {prefix && (
            <span className="pl-3 pr-1 text-[13px] text-zinc-400 select-none">
              {prefix}
            </span>
          )}
          <input
            id={inputId}
            ref={ref}
            className={cn(
              "flex-1 h-10 bg-transparent px-3 text-[13px] text-zinc-800 placeholder:text-zinc-400 focus:outline-none disabled:cursor-not-allowed",
              prefix && "pl-1",
              suffix && "pr-1",
              className,
            )}
            {...props}
          />
          {suffix && (
            <span className="pr-3 pl-1 text-[13px] text-zinc-400 select-none">
              {suffix}
            </span>
          )}
        </div>
        {error ? (
          <p className="text-[12px] text-red-500 mt-1">{error}</p>
        ) : hint ? (
          <p className="text-[12px] text-zinc-500 mt-1">{hint}</p>
        ) : null}
      </div>
    );
  },
);
