"use client";

import { Icon } from "./icons";

/**
 * Opens the browser's print dialog. Hidden when printing (and therefore never
 * prints itself), and keyboard reachable like any other button.
 */
export function PrintButton({ label = "Print" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-foam/25 px-3 text-sm hover:border-straw hover:text-straw print:hidden"
    >
      <Icon name="scroll" size={14} />
      {label}
    </button>
  );
}
