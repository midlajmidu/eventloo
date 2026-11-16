import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { Menu, Settings, X } from "lucide-react";
import { navItems, navSearch } from "../nav";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { EnchantedGoldIcon } from "../ThemedEventlooLogo";

export function Header({ preview, logo }: { preview?: string | undefined; logo?: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const isAdmin = useIsAdmin();
  return (
    <header className="fixed inset-x-0 top-0 z-50 bg-gradient-to-b from-night-deep/90 via-night-deep/60 to-transparent">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link to="/" search={{ preview }} className="flex min-w-0 items-center gap-2.5">
          <EnchantedGoldIcon className="h-6 w-auto shrink-0" />
          <span className="font-display text-lg font-semibold text-foreground uppercase tracking-wider">Eventloo</span>
          <span className="hidden h-5 w-px bg-gold/60 sm:block" />
          <span className="hidden truncate text-[11px] font-semibold tracking-[0.2em] text-foreground/80 sm:block">OFFICIAL FESTIVAL PORTAL</span>
        </Link>
        <ul className="hidden items-center gap-6 lg:flex">
          {navItems.map((i) => (
            <li key={i.label}>
              <Link
                to={i.to}
                search={navSearch(i, preview)}
                activeOptions={{ exact: true, includeSearch: false }}
                className="border-b-2 border-transparent pb-1 text-sm font-semibold text-foreground/85 transition hover:text-gold data-[status=active]:border-gold data-[status=active]:text-foreground"
              >
                {i.label}
              </Link>
            </li>
          ))}
          {isAdmin && (
            <li>
              <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-[0_0_18px_var(--glow)] transition hover:brightness-110">
                <Settings className="h-3.5 w-3.5" /> Settings
              </Link>
            </li>
          )}
        </ul>
        <button className="rounded-md p-2 text-foreground lg:hidden" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>
          {open ? <X /> : <Menu />}
        </button>
      </nav>
      {open && (
        <ul className="mx-4 mb-3 space-y-1 rounded-xl border border-border bg-night-deep/95 p-3 lg:hidden">
          {navItems.map((i) => (
            <li key={i.label}>
              <Link to={i.to} search={navSearch(i, preview)} onClick={() => setOpen(false)} className="block rounded-md px-3 py-2 font-semibold text-foreground hover:bg-muted">
                {i.label}
              </Link>
            </li>
          ))}
          {isAdmin && (
            <li>
              <Link to="/admin" className="block rounded-md px-3 py-2 font-semibold text-gold hover:bg-muted">Settings</Link>
            </li>
          )}
        </ul>
      )}
    </header>
  );
}
