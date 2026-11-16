import { Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useState, Component, type ReactNode } from "react";
import { navItems, navSearch } from "../nav";
import { ThemeNav } from "../shared/kit";
import { Playful3DIcon } from "../ThemedEventlooLogo";
import type { SiteData } from "@/lib/site-types";

/** WebGL scenes load only in the browser, only when WebGL exists. */
export const Scenes = { Hero: lazy(() => import("./Scenes").then((m) => ({ default: m.HeroScene }))), Countdown: lazy(() => import("./Scenes").then((m) => ({ default: m.CountdownScene }))) };

export function useWebGL() {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    try {
      const c = document.createElement("canvas");
      setOk(!!(c.getContext("webgl2") || c.getContext("webgl")));
    } catch { setOk(false); }
  }, []);
  return ok;
}

class SceneBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(err: any) { console.warn("WebGL scene error, using fallback:", err); }
  render() { return this.state.error ? this.props.fallback : this.props.children; }
}

export function ClientScene({ when, children, fallback }: { when: boolean; children: ReactNode; fallback: ReactNode }) {
  return when ? (
    <SceneBoundary fallback={fallback}>
      <Suspense fallback={fallback}>{children}</Suspense>
    </SceneBoundary>
  ) : <>{fallback}</>;
}

export function Shell({ data, preview, children }: { data: SiteData; preview?: string | undefined; children: ReactNode }) {
  const ev = data.event;
  return (
    <div className="theme-playful min-h-screen overflow-x-clip bg-background font-sans-dm text-foreground">
      <ThemeNav preview={preview} s={{
        header: "sticky top-0 z-50 px-3 pt-3",
        brand: (<>
          <Playful3DIcon className="h-8 w-auto shrink-0" />
          <span className="font-fredoka text-xl font-bold">Eventloo</span>
          <span className="hidden rounded-full bg-secondary px-2.5 py-0.5 text-[10px] font-bold tracking-widest text-primary uppercase sm:block">Festival Portal</span>
        </>),
        link: "rounded-full px-3 py-1.5 font-fredoka text-[15px] font-semibold transition hover:bg-secondary",
        active: "data-[status=active]:bg-primary data-[status=active]:text-primary-foreground",
        scan: "rounded-full bg-accent px-4 py-1.5 font-fredoka text-[15px] font-semibold text-accent-foreground shadow-[0_4px_0_color-mix(in_oklab,var(--accent)_60%,black)] transition active:translate-y-1 active:shadow-none",
        settings: "inline-flex items-center gap-1.5 rounded-full border-2 border-primary px-3 py-1 font-fredoka font-semibold text-primary",
        mobile: "mx-2 mt-2 space-y-1 rounded-3xl bg-card p-3 shadow-xl lg:hidden",
        mobileLink: "block rounded-2xl px-4 py-2.5 font-fredoka text-lg font-semibold hover:bg-secondary",
      }} />
      {children}
      <footer className="mx-3 mb-3 mt-28 rounded-[2.5rem] bg-foreground text-background">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:px-10 md:grid-cols-3">
          <div>
            <p className="font-fredoka text-3xl font-bold">Eventloo <span className="text-accent">●</span></p>
            <p className="mt-2 max-w-xs text-sm opacity-75">Event Management for Colleges, Schools and Organizations</p>
          </div>
          <div>
            <p className="font-fredoka text-sm font-semibold text-pop-3">Organiser</p>
            <p className="mt-1 font-semibold">{ev?.organizer || ev?.name}</p>
            {ev?.venue && <p className="text-sm opacity-70">{ev.venue}</p>}
          </div>
          <ul className="flex flex-wrap gap-2">
            {navItems.map((i) => <li key={i.label}><Link to={i.to} search={navSearch(i, preview)} className="inline-block rounded-full bg-background/10 px-3 py-1 text-sm font-semibold hover:bg-background/20">{i.label}</Link></li>)}
          </ul>
        </div>
        <p className="border-t border-background/10 py-4 text-center text-xs opacity-60">© {new Date().getFullYear()} {ev?.name} · Powered by Eventloo</p>
      </footer>
    </div>
  );
}

export function PageHead({ title, sub, art }: { title: string; sub: string; art?: string }) {
  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center gap-6 px-5 pb-10 pt-12 text-center sm:flex-row sm:text-left">
      {art && <img src={art} alt="" className="h-32 w-32 animate-bob object-contain drop-shadow-xl" />}
      <div>
        <h1 className="extrude font-fredoka text-6xl font-bold text-background sm:text-7xl">{title}</h1>
        <p className="mt-4 max-w-md text-muted-foreground">{sub}</p>
      </div>
    </section>
  );
}

export const Pill = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <div className={`rounded-[1.75rem] bg-card shadow-[0_10px_0_var(--border),0_20px_40px_-20px_color-mix(in_oklab,var(--primary)_40%,transparent)] ${className}`}>{children}</div>
);
