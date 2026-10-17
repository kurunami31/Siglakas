"use client";

import { useLive } from "./providers";
import { can } from "@/lib/auth/permissions";
import { Icon } from "./icons";

/**
 * Opens the browser's print dialog.
 *
 * Printing is a staff affordance — the Secretariat pins notices on a board —
 * so it renders nothing for a public viewer and keeps the public pages clean.
 * Printing itself still works for anyone via the browser; only the button is
 * hidden. The button is also hidden while printing, so it never prints itself.
 */
export function PrintButton({ label = "Print" }: { label?: string }) {
  const { role } = useLive();
  if (!can(role, "edit_result")) return null;

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
