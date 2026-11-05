"use client";

import { typesByCategory } from "@/lib/business-types";

// Menu dei tipi di attività, diviso per categoria (Bellezza, Sport, ...).
// Usato nella registrazione e nelle impostazioni.
export function BusinessTypeSelect({
  id,
  value,
  defaultValue,
  onChange,
  disabled,
  className,
}: {
  id: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <select
      id={id}
      name="business_type"
      required
      value={value}
      defaultValue={value === undefined ? defaultValue : undefined}
      onChange={onChange ? (e) => onChange(e.target.value) : undefined}
      disabled={disabled}
      className={className}
    >
      {typesByCategory().map(({ category, types }) => (
        <optgroup key={category} label={category}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}
