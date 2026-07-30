// Role-simulation pages - there's no real per-account login yet, so
// "switching account" just means jumping to that role's POV. See
// CLAUDE.md: these tabs simulate each role for now, real accounts planned later.
export const ROLE_STORAGE_KEY = "tempsens-current-role";

export const ROLE_LINKS = [
  { href: "/sales-support", label: "Sales Support", initials: "SS" },
  { href: "/sales-support-supervisor", label: "Sales Support Supervisor", initials: "SSS" },
  { href: "/sales-manager", label: "Sales Manager", initials: "SM" },
  { href: "/operational-manager", label: "Operational Manager", initials: "OM" },
  { href: "/general-manager", label: "General Manager", initials: "GM" },
  { href: "/production-manager", label: "Production Manager", initials: "PM" },
  { href: "/warehouse-manager", label: "Warehouse Manager", initials: "WM" },
  { href: "/production", label: "Production", initials: "PR" },
  { href: "/exim", label: "Export Import", initials: "EXIM" },
  { href: "/engineering", label: "Engineering", initials: "ENG" },
];

// GM acts as the de-facto admin of this page for now, so it's the default
// role shown before anything's been picked via Switch account.
export const DEFAULT_ROLE = ROLE_LINKS[4];

// Client-only - reads whichever role was last picked via Switch account,
// used to tag "who submitted this" on forms/POs without real login.
export function getCurrentRole(): typeof ROLE_LINKS[number] {
  if (typeof window === "undefined") return DEFAULT_ROLE;
  const stored = window.localStorage.getItem(ROLE_STORAGE_KEY);
  return ROLE_LINKS.find((r) => r.href === stored) ?? DEFAULT_ROLE;
}
