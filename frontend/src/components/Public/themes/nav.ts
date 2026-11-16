export const navItems = [
  { to: "/", label: "Home" },
  { to: "/results", label: "Results" },
  { to: "/points-table", label: "Points Table" },
  { to: "/schedule", label: "Schedule" },
  { to: "/verify-badge", label: "Verify Badge" },
] as const;

export type NavItem = (typeof navItems)[number];

/** Search params for a nav link: keeps an admin preview and opens the scanner for "Scan QR". */
export function navSearch(item: NavItem, preview?: string) {
  return { preview, scan: "scan" in item ? true : undefined };
}
