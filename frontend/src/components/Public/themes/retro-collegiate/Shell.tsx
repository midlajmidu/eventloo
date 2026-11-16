import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { navItems, navSearch } from "../nav";
import { ThemeNav } from "../shared/kit";
import { RetroCollegiateIcon } from "../ThemedEventlooLogo";
import type { SiteData } from "@/lib/site-types";

export function Shell({ data, preview, children }: { data: SiteData; preview?: string | undefined; children: ReactNode }) {
  const ev = data.event;
  return (
    <div className="theme-retro grain min-h-screen overflow-x-clip bg-background font-sans-dm text-foreground">
      <ThemeNav preview={preview} s={{
        header: "sticky top-0 z-50 border-b-2 border-primary/80 bg-background/95 shadow-[0_3px_0_var(--accent)] backdrop-blur",
        brand: (<>
          <RetroCollegiateIcon className="h-7 w-7 text-primary shrink-0" />
          <span className="font-retro-script text-2xl text-accent [text-shadow:2px_2px_0_var(--primary)]">Eventloo</span>
          <span className="hidden border-l-2 border-primary/40 pl-3 font-oswald text-[11px] font-semibold tracking-[0.25em] uppercase sm:block">Official Festival Portal</span>
        </>),
        link: "border-b-[3px] border-transparent pb-0.5 font-oswald text-sm font-medium tracking-wider uppercase transition hover:text-accent",
        active: "data-[status=active]:border-accent data-[status=active]:text-accent",
        scan: "rounded-full bg-primary px-4 py-1.5 font-oswald text-sm font-semibold tracking-wider text-primary-foreground uppercase shadow-[2px_2px_0_var(--accent)] data-[status=active]:bg-accent",
        settings: "inline-flex items-center gap-1.5 rounded-full border-2 border-primary px-3 py-1 font-oswald text-sm tracking-wider uppercase",
        mobile: "border-t-2 border-primary/30 bg-card px-5 py-2 lg:hidden",
        mobileLink: "block border-b border-dashed border-primary/30 py-3 font-oswald text-lg tracking-wider uppercase last:border-0",
      }} />
      {children}
      <footer className="relative mt-28 text-primary-foreground">
        <div className="torn-top bg-primary pt-6">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
            <div>
              <p className="font-retro-script text-4xl text-secondary">Eventloo</p>
              <p className="mt-2 max-w-xs font-baskerville text-sm italic opacity-80">Event Management for Colleges, Schools and Organizations</p>
            </div>
            <div>
              <p className="font-oswald text-xs tracking-[0.3em] text-secondary uppercase">★ Organiser ★</p>
              <p className="mt-2 font-fraunces text-lg">{ev?.organizer || ev?.name}</p>
              {ev?.venue && <p className="text-sm opacity-70">{ev.venue}</p>}
            </div>
            <ul className="grid grid-cols-2 gap-1.5 font-oswald text-sm tracking-wider uppercase">
              {navItems.map((i) => <li key={i.label}><Link to={i.to} search={navSearch(i, preview)} className="opacity-80 hover:text-secondary hover:opacity-100">{i.label}</Link></li>)}
            </ul>
          </div>
          <p className="border-t border-primary-foreground/20 py-4 text-center font-oswald text-xs tracking-[0.3em] uppercase opacity-60">© {new Date().getFullYear()} {ev?.name} · Powered by Eventloo</p>
        </div>
      </footer>
    </div>
  );
}

export function Banner({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-4 ${className}`}>
      <span className="hidden h-[3px] w-20 bg-accent sm:block" aria-hidden />
      <h2 className="font-fraunces text-3xl font-black tracking-wide text-primary uppercase sm:text-5xl">{children}</h2>
      <span className="hidden h-[3px] w-20 bg-accent sm:block" aria-hidden />
    </div>
  );
}

export function PageHead({ title, sub, event }: { title: string; sub: string; event?: string | undefined }) {
  return (
    <section className="mx-auto max-w-4xl px-5 pb-10 pt-14 text-center">
      {event && <p className="font-oswald text-xs tracking-[0.35em] text-accent uppercase">★ {event} ★</p>}
      <h1 className="mt-3 font-retro-script text-6xl text-accent [text-shadow:3px_3px_0_var(--primary)] sm:text-7xl">{title}</h1>
      <p className="mx-auto mt-4 max-w-lg font-baskerville italic text-muted-foreground">{sub}</p>
      <div className="mx-auto mt-5 h-1.5 w-40 rounded-full bg-[repeating-linear-gradient(90deg,var(--accent)_0_12px,var(--primary)_12px_24px)]" aria-hidden />
    </section>
  );
}

export const Paper = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-md border-2 border-primary bg-card shadow-[5px_5px_0_var(--primary)] ${className}`}>{children}</div>
);
