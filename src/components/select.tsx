"use client";

import { Icon } from "./icons";

export interface SelectOption<T extends string> {
  value: T;
  label: string;
}

/**
 * A styled native `<select>`.
 *
 * Native is deliberate: it keeps full keyboard and screen-reader behaviour and
 * the platform picker on mobile, which a hand-rolled listbox would have to
 * reimplement (and usually gets wrong). The caret is ours, so it can animate —
 * `appearance-none` hides the OS arrow and the chevron below rotates 180° on
 * focus, which is the "open" affordance we can actually detect.
 */
export function Select<T extends string>({
  value,
  onChange,
  options,
  label,
  hideLabel,
  className = "",
  title,
}: {
  value: T;
  onChange: (value: T) => void;
  options: Array<SelectOption<T>>;
  label?: string;
  hideLabel?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <label className={`block ${className}`}>
      {label && (
        <span className={`mb-1 block text-[0.65rem] uppercase tracking-widest text-foam/70 ${hideLabel ? "sr-only" : ""}`}>
          {label}
        </span>
      )}
      <span className="relative inline-flex w-full items-center">
        <select
          value={value}
          title={title}
          onChange={(e) => onChange(e.target.value as T)}
          className="peer w-full appearance-none rounded-lg border border-foam/25 bg-ink/60 py-2.5 pl-3 pr-9 text-sm text-parchment outline-none transition hover:border-foam/40 focus-visible:border-straw"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon
          name="chevronRight"
          size={14}
          className="pointer-events-none absolute right-2.5 rotate-90 text-foam/60 transition-transform duration-200 ease-out peer-focus:-rotate-90"
        />
      </span>
    </label>
  );
}
