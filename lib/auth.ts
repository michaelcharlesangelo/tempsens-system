import crypto from "crypto";

// Simple SHA-256 hash with a static app-specific salt - appropriate for a
// small, internal set of production/QC accounts (not public-facing).
const SALT = "tempsens-system-v1";

export function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(SALT + password).digest("hex");
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
