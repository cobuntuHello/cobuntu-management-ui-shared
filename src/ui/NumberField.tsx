"use client";

import * as React from "react";
import { TextField, type TextFieldProps } from "./TextField";

export interface NumberFieldProps
  extends Omit<TextFieldProps, "value" | "onChange" | "type"> {
  value: number | "";
  onChange: (next: number | "") => void;
  min?: number;
  max?: number;
  step?: number;
  /** Disallow non-integer input (e.g. installment count, attendance cap). */
  integer?: boolean;
}

export const NumberField = React.forwardRef<HTMLInputElement, NumberFieldProps>(
  function NumberField(
    { value, onChange, min, max, step, integer, inputMode, ...rest },
    ref,
  ) {
    function handle(e: React.ChangeEvent<HTMLInputElement>) {
      const raw = e.target.value;
      if (raw === "") {
        onChange("");
        return;
      }
      const parsed = integer ? parseInt(raw, 10) : parseFloat(raw);
      if (Number.isNaN(parsed)) return;
      onChange(parsed);
    }

    return (
      <TextField
        ref={ref}
        type="number"
        inputMode={inputMode ?? (integer ? "numeric" : "decimal")}
        value={value === "" ? "" : String(value)}
        onChange={handle}
        min={min}
        max={max}
        step={step ?? (integer ? 1 : undefined)}
        {...rest}
      />
    );
  },
);
