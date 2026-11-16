import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { navItems, navSearch } from "../nav";
import { ThemeNav } from "../shared/kit";
import { SwissModernistIcon } from "../ThemedEventlooLogo";
import type { SiteData } from "@/lib/site-types";

export function Shell({ data, preview, children }: { data: SiteData; preview?: string | undefined; children: ReactNode }) {
  const ev = data.event;
  return (
    <div className="theme-swiss min-h-screen overflow-x-clip bg-background font-swiss text-foreground antialiased">
      <ThemeNav preview={preview} s={{
        header: "sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur",
        brand: (<>
          <SwissModernistIcon className="h-7 w-auto shrink-0" />
          <span className="text-lg font-extrabold tracking-tight">Eventloo</span>
          <span className="hidden text-[10px] font-semibold tracking-[0.25em] text-muted-foreground uppercase sm:block">/ Official Festival Portal</span>
        </>),
        link: "border-b-2 border-transparent pb-1 text-[13px] font-semibold tracking-tight transition-colors hover:text-accent",
        active: "data-[status=active]:border-accent data-[status=active]:text-foreground",
        scan: "bg-primary px-4 py-2 text-[13px] font-semibold text-primary-foreground transition hover:bg-accent data-[status=active]:bg-accent",
        settings: "inline-flex items-center gap-1.5 border border-foreground px-3 py-1.5 text-[13px] font-semibold hover:bg-foreground hover:text-background",
        mobile: "border-t border-border px-5 py-2 lg:hidden",
        mobileLink: "block border-b border-border py-3 text-base font-semibold last:border-0",
      }} />
      {children}
      <footer className="relative mt-28 overflow-hidden bg-primary text-primary-foreground">
        <div className="absolute -right-24 top-0 h-full w-72 origin-top -skew-x-[24deg] bg-accent" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-12">
          <div className="md:col-span-5">
            <p className="text-3xl font-black tracking-tight">Eventloo</p>
            <p className="mt-3 max-w-xs text-sm text-primary-foreground/70">Event Management for Colleges, Schools and Organizations</p>
          </div>
          <div className="md:col-span-3">
            <p className="text-[10px] font-semibold tracking-[0.3em] text-primary-foreground/50 uppercase">Organiser</p>
            <p className="mt-2 text-sm font-semibold">{ev?.organizer || ev?.name}</p>
            {ev?.venue && <p className="text-sm text-primary-foreground/70">{ev.venue}</p>}
          </div>
          <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm md:col-span-4">
            {navItems.map((i) => <li key={i.label}><Link to={i.to} search={navSearch(i, preview)} className="text-primary-foreground/80 hover:text-primary-foreground">{i.label}</Link></li>)}
          </ul>
        </div>
        <p className="relative border-t border-primary-foreground/15 px-5 py-4 text-[11px] tracking-[0.2em] text-primary-foreground/50 uppercase sm:px-8">© {new Date().getFullYear()} {ev?.name} — Powered by Eventloo</p>
      </footer>
    </div>
  );
}

/** "01 — LABEL" rule used to open every section. */
export function Rule({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-4 border-t border-foreground pt-3 text-[11px] font-semibold tracking-[0.3em] uppercase">
      <span className="text-accent">{n}</span><span>—</span><span>{label}</span>
    </div>
  );
}

export function PageHead({ n, title, sub, event }: { n: string; title: string; sub: string; event?: string | undefined }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-10 pt-14 sm:px-8">
      <Rule n={n} label={event || "Festival"} />
      <div className="mt-6 grid gap-6 md:grid-cols-12">
        <h1 className="animate-clip-up text-6xl font-black leading-[0.85] tracking-[-0.05em] sm:text-8xl md:col-span-8">{title}<span className="text-accent">.</span></h1>
        <p className="max-w-xs self-end text-sm text-muted-foreground md:col-span-4">{sub}</p>
      </div>
    </section>
  );
}
