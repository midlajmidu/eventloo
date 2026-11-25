import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Menu, Settings, X } from "lucide-react";
import { navItems, navSearch } from "../nav";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { EditorialIcon } from "../ThemedEventlooLogo";
import type { SiteData } from "@/lib/site-types";

/** Gentle fade-up when an element enters the viewport. */
export function Reveal({ children, className = "", delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && (setShown(true), io.disconnect()), { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} style={{ transitionDelay: `${delay}ms` }} className={`transition duration-1000 ease-out motion-reduce:transition-none ${shown ? "translate-y-0 opacity-100" : "translate-y-6 opacity-0 motion-reduce:translate-y-0 motion-reduce:opacity-100"} ${className}`}>
      {children}
    </div>
  );
}

export function Ornament({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-3 text-gold ${className}`} aria-hidden>
      <span className="h-px w-16 bg-gradient-to-r from-transparent to-gold" /><span className="text-xs">◆</span><span className="h-px w-16 bg-gradient-to-l from-transparent to-gold" />
    </div>
  );
}

export function SectionTitle({ children }: { children: string }) {
  return (
    <div className="flex items-center justify-center gap-4 sm:gap-5">
      <span className="hidden h-px w-16 sm:w-24 bg-gradient-to-r from-transparent to-gold/70 sm:block" />
      <h2 className="font-editorial text-2xl sm:text-3xl lg:text-4xl text-primary font-normal tracking-tight">{children}</h2>
      <span className="hidden h-px w-16 sm:w-24 bg-gradient-to-l from-transparent to-gold/70 sm:block" />
    </div>
  );
}

function Header({ preview, logo }: { preview?: string | undefined; logo?: string | null | undefined }) {
  const [open, setOpen] = useState(false);
  const isAdmin = useIsAdmin();
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur">
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
        <Link to="/" search={{ preview }} className="flex min-w-0 items-center gap-3">
          <EditorialIcon className="h-6 w-auto shrink-0 text-primary" />
          <span className="font-editorial text-xl font-bold text-primary">Eventloo</span>
          <span className="hidden h-5 w-px bg-border sm:block" />
          <span className="hidden truncate text-sm text-muted-foreground sm:block">Official Festival Portal</span>
        </Link>
        <ul className="hidden items-center gap-7 font-sans-dm text-sm lg:flex">
          {navItems.map((i) => (
            <li key={i.label}>
              <Link to={i.to} search={navSearch(i, preview)} activeOptions={{ exact: true, includeSearch: false }}
                className="border-b border-transparent pb-1 text-foreground/80 transition-colors hover:text-primary data-[status=active]:border-gold data-[status=active]:text-primary">
                {i.label}
              </Link>
            </li>
          ))}
          {isAdmin && (
            <li>
              <Link to="/admin" className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-primary-foreground transition hover:opacity-90">
                <Settings className="h-3.5 w-3.5" /> Settings
              </Link>
            </li>
          )}
        </ul>
        <button className="p-2 text-primary lg:hidden" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)}>{open ? <X /> : <Menu />}</button>
      </nav>
      {open && (
        <ul className="border-t border-border px-5 py-3 font-sans-dm lg:hidden">
          {navItems.map((i) => (
            <li key={i.label}><Link to={i.to} search={navSearch(i, preview)} onClick={() => setOpen(false)} className="block py-2.5 text-foreground">{i.label}</Link></li>
          ))}
          {isAdmin && <li><Link to="/admin" className="block py-2.5 font-semibold text-primary">Settings</Link></li>}
        </ul>
      )}
    </header>
  );
}

export function Wave({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 1440 120" overflow="visible" preserveAspectRatio="none" className={className} aria-hidden>
      <path className="animate-wave-slow fill-current" d="M-60,64 C240,120 480,0 720,48 C960,96 1200,24 1500,56 L1500,120 L-60,120 Z" />
    </svg>
  );
}

function Footer({ data, preview }: { data: SiteData; preview?: string | undefined }) {
  const ev = data.event;
  return (
    <footer className="relative mt-24 overflow-hidden text-primary-foreground">
      <Wave className="-mb-px block h-16 w-full text-primary sm:h-24" />
      <div className="bg-primary">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 pb-12 pt-6 sm:grid-cols-3 sm:px-8">
          <div>
            <div className="flex items-center gap-3">
              <EditorialIcon className="h-6 w-auto text-gold" />
              <span className="font-editorial text-2xl">Eventloo</span>
            </div>
            <p className="mt-3 max-w-xs font-sans-dm text-sm opacity-80">Event Management for Colleges, Schools and Organizations</p>
          </div>
          <div className="font-sans-dm text-sm">
            <p className="text-xs tracking-[0.25em] text-gold uppercase">Organiser</p>
            <p className="mt-2 opacity-90">{ev?.organizer || ev?.name}</p>
            {ev?.venue && <p className="opacity-70">{ev.venue}</p>}
          </div>
          <div className="font-sans-dm text-sm">
            <p className="text-xs tracking-[0.25em] text-gold uppercase">Useful links</p>
            <ul className="mt-2 grid grid-cols-2 gap-1.5">
              {navItems.map((i) => <li key={i.label}><Link to={i.to} search={navSearch(i, preview)} className="opacity-80 hover:opacity-100">{i.label}</Link></li>)}
            </ul>
          </div>
        </div>
        <p className="border-t border-primary-foreground/15 py-4 text-center font-sans-dm text-xs opacity-60">© {new Date().getFullYear()} {ev?.name} · Powered by Eventloo</p>
      </div>
    </footer>
  );
}

export function Shell({ data, preview, children }: { data: SiteData; preview?: string | undefined; children: ReactNode }) {
  return (
    <div className="theme-minimal-editorial min-h-screen scroll-smooth bg-background font-sans-dm text-foreground">
      <Header preview={preview} logo={data.event?.logo_url} />
      {children}
      <Footer data={data} preview={preview} />
    </div>
  );
}

export function PageIntro({ eyebrow, title, subtitle }: { eyebrow?: string | undefined; title: string; subtitle: string }) {
  return (
    <section className="mx-auto max-w-4xl px-6 pb-8 pt-10 sm:pb-12 sm:pt-16 text-center">
      {eyebrow && <p className="text-[11px] sm:text-xs tracking-[0.25em] text-gold uppercase font-semibold">{eyebrow}</p>}
      <h1 className="mt-2.5 font-editorial text-3xl sm:text-4xl lg:text-5xl text-primary font-normal tracking-tight">{title}</h1>
      <Ornament className="mt-4 sm:mt-5" />
      <p className="mx-auto mt-4 max-w-xl text-xs sm:text-sm text-muted-foreground leading-relaxed">{subtitle}</p>
    </section>
  );
}
