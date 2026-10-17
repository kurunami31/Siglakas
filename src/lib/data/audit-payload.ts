import type { Command } from "./repo";

/**
 * Serialize a command for the audit trail with secrets stripped out.
 *
 * Without this a password reset would write the bcrypt hash into the AuditLog
 * tab — and anyone with read access to the sheet would be looking straight at
 * it. Shared by both repositories so the two can never drift.
 */
export function auditPayload(command: Command, limit = 500): string {
  return JSON.stringify(command, (key, value) =>
    key === "password" || key === "passwordHash" ? "[redacted]" : value,
  ).slice(0, limit);
}
