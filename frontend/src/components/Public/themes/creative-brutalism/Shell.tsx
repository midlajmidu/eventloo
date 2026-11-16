import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { navItems, navSearch } from "../nav";
import { ThemeNav } from "../shared/kit";
import { BrutalismIcon } from "../ThemedEventlooLogo";
import type { SiteData } from "@/lib/site-types";

export function Shell({ data, preview, children }: { data: SiteData; preview?: string | undefined; children: ReactNode }) {
  const ev = data.event;
  return (
    <div className="theme-brutal grain min-h-screen overflow-x-clip bg-background font-grotesk text-foreground">
      <ThemeNav preview={preview} s={{
        header: "sticky top-0 z-50 border-b-4 border-foreground bg-background",
        brand: (<>
          <BrutalismIcon className="h-7 w-auto shrink-0" />
          <span className="bg-foreground px-2 py-0.5 font-archivo text-lg text-background">EVENTLOO</span>
          <span className="hidden font-bebas text-lg tracking-widest sm:block">Official Festival Portal ✱</span>
        </>),
        link: "font-bebas text-xl tracking-wider transition hover:text-accent",
        active: "data-[status=active]:bg-pop data-[status=active]:px-1.5",
        scan: "border-2 border-foreground bg-accent px-3 py-1 font-bebas text-xl tracking-wider shadow-[4px_4px_0_var(--foreground)] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none",
        settings: "inline-flex items-center gap-1.5 bg-foreground px-3 py-1.5 font-bebas text-lg tracking-wider text-background",
        mobile: "border-t-4 border-foreground bg-pop px-5 py-2 lg:hidden",
        mobileLink: "block border-b-2 border-foreground py-2 font-bebas text-3xl tracking-wide last:border-0",
      }} />
      {children}
      <footer className="relative mt-28 bg-foreground text-background">
        <div className="stripes h-5 text-accent" aria-hidden />
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-3">
          <div>
            <p className="font-archivo text-5xl leading-none">EVENT<span className="text-accent">LOO</span></p>
            <p className="mt-4 max-w-xs font-mono text-sm text-background/70">Event Management for Colleges, Schools and Organizations</p>
          </div>
          <div className="font-mono text-sm">
            <p className="font-bebas text-2xl tracking-wider text-pop">Organiser</p>
            <p>{ev?.organizer || ev?.name}</p>
            {ev?.venue && <p className="text-background/60">{ev.venue}</p>}
          </div>
          <ul className="grid grid-cols-2 gap-1 font-bebas text-2xl tracking-wide">
            {navItems.map((i) => <li key={i.label}><Link to={i.to} search={navSearch(i, preview)} className="hover:text-accent">{i.label}</Link></li>)}
          </ul>
        </div>
        <p className="border-t-2 border-background/20 px-5 py-4 font-mono text-xs text-background/50 sm:px-8">© {new Date().getFullYear()} {ev?.name} — powered by Eventloo</p>
      </footer>
    </div>
  );
}

export function PageHead({ title, sub, tone = "bg-accent" }: { title: string; sub: string; tone?: string }) {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-10 pt-12 sm:px-8">
      <h1 className="font-anton text-[clamp(4rem,13vw,10rem)] uppercase leading-[0.85]">
        <span className={`inline-block animate-clip-up border-4 border-foreground px-3 ${tone}`}>{title}</span>
      </h1>
      <p className="mt-5 max-w-md border-l-4 border-foreground pl-4 font-mono text-sm">{sub}</p>
    </section>
  );
}

export const Block = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`border-4 border-foreground bg-background shadow-[8px_8px_0_var(--foreground)] ${className}`}>{children}</div>
);
