import type { ReactNode } from "react";
import sky from "@/assets/gravitas/sky.webp";
import type { SiteData } from "@/lib/site-types";
import { Header } from "./Header";
import { Footer } from "./Footer";

export function Shell({ data, preview, children, scene = false }: { data: SiteData; preview?: string | undefined; children: ReactNode; scene?: boolean }) {
  return (
    <div className="theme-enchanted min-h-screen bg-night font-serif text-foreground">
      <Header preview={preview} logo={data.event?.logo_url} />
      {children}
      {!scene && <div aria-hidden className="h-32 bg-gradient-to-b from-night to-secondary" />}
      <Footer organizer={data.event?.organizer} name={data.event?.name} />
    </div>
  );
}

/** Illustrated page banner shared by the theme's inner pages. */
export function SceneBanner({ eyebrow, title, subtitle }: { eyebrow?: string | undefined; title: string; subtitle: string }) {
  return (
    <section className="relative overflow-hidden pb-16 pt-32 text-center">
      <img src={sky} alt="" aria-hidden className="absolute inset-0 h-full w-full object-cover opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-transparent to-night" />
      <div className="relative px-6">
        {eyebrow && <p className="text-xs font-semibold tracking-[0.35em] text-gold">{eyebrow}</p>}
        <h1 className="mt-3 font-display text-4xl font-bold text-foreground text-glow sm:text-6xl">{title}</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-foreground/80">{subtitle}</p>
      </div>
    </section>
  );
}

export function Parchment({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-gold/60 bg-parchment p-6 text-ink shadow-[0_20px_60px_-25px_var(--glow)] sm:p-8 ${className}`}>{children}</div>;
}
