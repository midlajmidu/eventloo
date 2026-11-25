import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BookOpen, CalendarDays, Landmark, MapPin, Sparkles, Users } from "lucide-react";
import coast from "@/assets/minimal/coast-hero.webp";
import sailboat from "@/assets/minimal/sailboat.webp";
import iconTrophy from "@/assets/minimal/icon-trophy.webp";
import iconFlag from "@/assets/minimal/icon-flag.webp";
import iconCalendar from "@/assets/minimal/icon-calendar.webp";
import iconBadge from "@/assets/minimal/icon-badge.webp";
import { formatDateRange, pad, useCountdown } from "@/lib/site-data";
import type { ThemePageProps } from "../themeTypes";
import { Ornament, Reveal, SectionTitle, Shell, Wave } from "./Shell";

const statIcons = [BookOpen, Users, Sparkles, Landmark];

function useParallax(factor: number) {
  const [y, setY] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setY(window.scrollY * factor)); };
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, [factor]);
  return y;
}

export function Landing({ data, preview }: ThemePageProps) {
  const ev = data.event;
  const y = useParallax(0.15);
  const { parts, started, enabled } = useCountdown(ev?.start_date ?? null);
  const dates = formatDateRange(ev?.start_date ?? null, ev?.end_date ?? null);
  const words = (ev?.theme_title || ev?.name || "").trim().split(/\s+/);
  const last = words.length > 1 ? words.pop() : undefined;
  const cards = [
    { t: "Live Results", d: "Track program results and winners in real time.", img: iconTrophy, to: "/results" },
    { t: "Team Points", d: "Follow your team's performance and standings.", img: iconFlag, to: "/points-table" },
    { t: "Event Schedule", d: "Check program timings, venues and updates.", img: iconCalendar, to: "/schedule" },
    { t: "Verify Candidate", d: "Scan QR or enter details to verify participant badges.", img: iconBadge, to: "/verify-badge" },
  ] as const;

  return (
    <Shell data={data} preview={preview}>
      {/* Hero */}
      <section className="relative overflow-hidden bg-background">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src={coast}
            alt="Watercolor lighthouse on a coastal cliff at sunrise"
            width={1920}
            height={896}
            className="h-full w-full object-cover object-right-top opacity-30 sm:opacity-100 sm:object-right transition-opacity duration-700"
            style={{ transform: `translateY(${y}px)` }}
          />
          {/* Subtle gradient vignette on mobile to guarantee crystal-clear editorial readability */}
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/90 to-background/30 sm:hidden" />
          <div className="hidden sm:block absolute inset-y-0 left-0 w-3/5 bg-gradient-to-r from-background via-background/80 to-transparent" />
        </div>

        <div className="relative mx-auto flex max-w-7xl flex-col justify-center px-6 py-12 sm:min-h-[540px] sm:px-8 lg:min-h-[600px] lg:py-16">
          <div className="max-w-2xl">
            {/* Festival Context Eyebrow - Ensures event info is never lost */}
            <div className="animate-rise flex flex-wrap items-center gap-2 text-[11px] sm:text-xs font-semibold tracking-[0.25em] text-gold uppercase mb-3 sm:mb-4">
              <span>{ev?.name || "The Annual Festival"}</span>
              {dates && (
                <>
                  <span className="text-gold/40">·</span>
                  <span className="font-normal text-muted-foreground tracking-wider">{dates}</span>
                </>
              )}
            </div>

            {/* Editorial Title - Minimal, balanced and responsive */}
            <h1 className="animate-rise font-editorial text-3xl sm:text-5xl md:text-6xl lg:text-7xl leading-[1.12] sm:leading-[1.08] text-primary tracking-tight break-words">
              {words.join(" ")}
              {last && <span className="block font-serif text-gold italic font-normal mt-0.5 sm:mt-1">{last}</span>}
            </h1>

            {/* Tagline */}
            {ev?.tagline && (
              <p className="mt-4 sm:mt-5 animate-rise text-xs sm:text-sm tracking-[0.25em] text-foreground/80 uppercase [animation-delay:.2s] font-medium">
                {ev.tagline}
              </p>
            )}

            {/* Quick Venue Badge on mobile/tablet if available */}
            {ev?.venue && (
              <div className="mt-3 animate-rise flex items-center gap-1.5 text-xs text-muted-foreground [animation-delay:.25s]">
                <MapPin className="h-3.5 w-3.5 text-gold shrink-0" />
                <span>{ev.venue}</span>
              </div>
            )}

            {/* Primary CTA Strip */}
            <div className="mt-7 sm:mt-8 animate-rise flex flex-wrap items-center gap-3 [animation-delay:.35s]">
              <a
                href="#explore"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 sm:px-6 sm:py-3 text-xs sm:text-sm font-semibold text-primary-foreground shadow-xs transition hover:gap-3 hover:opacity-95 cursor-pointer"
              >
                Explore Festival <ArrowRight className="h-4 w-4" />
              </a>
              <Link
                to="/results"
                search={{ preview }}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card/80 backdrop-blur px-4 py-2.5 sm:px-5 sm:py-3 text-xs sm:text-sm font-semibold text-foreground transition hover:border-gold/60 hover:text-primary cursor-pointer"
              >
                Live Results
              </Link>
            </div>
          </div>
        </div>
        <Wave className="absolute inset-x-0 bottom-0 hidden h-16 w-full text-background sm:block" />
      </section>

      {/* Identity */}
      <section className="px-6 pt-10 sm:pt-14 text-center">
        <Reveal>
          <p className="text-[11px] sm:text-xs tracking-[0.3em] text-gold uppercase font-semibold">Official Festival Portal</p>
          <h2 className="mt-2.5 font-editorial text-2xl sm:text-4xl lg:text-5xl tracking-tight text-primary font-normal">{ev?.name}</h2>
          {(dates || ev?.venue) && (
            <div className="mt-5 flex flex-wrap justify-center gap-2.5 text-xs sm:text-sm">
              {dates && <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2"><CalendarDays className="h-4 w-4 text-gold" />{dates}</span>}
              {ev?.venue && <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2"><MapPin className="h-4 w-4 text-gold" />{ev.venue}</span>}
            </div>
          )}
          <Ornament className="mt-7 sm:mt-8" />
        </Reveal>
      </section>

      {/* About */}
      {ev?.description && (
        <section className="mx-auto mt-12 grid max-w-6xl items-center gap-8 px-6 md:grid-cols-2">
          <Reveal className="border-l-2 border-gold/60 pl-6">
            <h2 className="font-editorial text-3xl text-primary sm:text-4xl">About the Event</h2>
            <p className="mt-4 text-lg leading-relaxed text-foreground/85">{ev.description}</p>
          </Reveal>
          <Reveal delay={150}>
            <img src={ev.artwork_url || sailboat} alt="" loading="lazy" width={1280} height={832} className="w-full animate-float-slow [mask-image:radial-gradient(ellipse_at_center,black_55%,transparent_75%)]" />
          </Reveal>
        </section>
      )}

      {/* Stats */}
      {ev && ev.stats.length > 0 && (
        <section className="mx-auto mt-16 max-w-6xl px-6">
          <Reveal><SectionTitle>Festival at a Glance</SectionTitle></Reveal>
          <div className="mt-10 grid grid-cols-2 gap-y-10 md:grid-cols-4 md:divide-x md:divide-border">
            {ev.stats.map((s, i) => {
              const Icon = statIcons[i % statIcons.length]!;
              return (
                <Reveal key={s.label + i} delay={i * 100} className="text-center">
                  <Icon className="mx-auto h-7 w-7 text-gold" strokeWidth={1.4} />
                  <p className="mt-2.5 font-editorial text-3xl sm:text-4xl lg:text-5xl text-primary font-normal">{s.value}</p>
                  <p className="mt-1 text-xs tracking-[0.25em] text-muted-foreground uppercase">{s.label}</p>
                </Reveal>
              );
            })}
          </div>
        </section>
      )}

      {/* Countdown */}
      {enabled && (
        <section className="mx-auto mt-20 max-w-3xl px-6 text-center">
          <Reveal>
            <p className="font-editorial text-2xl text-primary">{started ? "The Festival Has Begun" : "The Festival Begins In"}</p>
            <div className="relative mt-6 rounded-[2.5rem] border border-gold/50 bg-card p-2 shadow-[0_20px_50px_-30px_var(--gold)]">
              <div className="grid grid-cols-4 divide-x divide-border rounded-[2rem] border border-gold/25 px-2 py-6 sm:py-8" aria-live="polite">
                {parts.map((p) => (
                  <div key={p.l}>
                    <p className="font-editorial text-3xl sm:text-4xl lg:text-5xl text-primary tabular-nums font-normal">{pad(p.v)}</p>
                    <p className="mt-1 text-xs text-muted-foreground sm:text-sm">{p.l}</p>
                  </div>
                ))}
              </div>
              <span className="absolute -left-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border border-gold/60 bg-background" aria-hidden />
              <span className="absolute -right-2 top-1/2 h-4 w-4 -translate-y-1/2 rotate-45 border border-gold/60 bg-background" aria-hidden />
            </div>
          </Reveal>
        </section>
      )}

      {/* Explore */}
      <section id="explore" className="mx-auto mt-24 max-w-7xl scroll-mt-24 px-6">
        <Reveal><SectionTitle>Explore the Festival</SectionTitle></Reveal>
        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c, i) => (
            <Reveal key={c.t} delay={i * 100}>
              <Link to={c.to} search={{ preview }} className="group flex h-full flex-col items-center rounded-2xl border border-border bg-card p-6 text-center transition duration-500 hover:-translate-y-1 hover:border-gold/60 hover:shadow-[0_20px_40px_-25px_var(--primary)]">
                <img src={c.img} alt="" loading="lazy" width={384} height={384} className="h-28 w-28 transition [mask-image:radial-gradient(circle,black_50%,transparent_70%)] duration-700 group-hover:scale-105" />
                <h3 className="mt-2 font-editorial text-xl text-primary">{c.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.d}</p>
                <span className="mt-5 grid h-9 w-9 place-items-center rounded-full bg-gold text-primary-foreground transition group-hover:translate-x-1"><ArrowRight className="h-4 w-4" /></span>
              </Link>
            </Reveal>
          ))}
        </div>
      </section>
    </Shell>
  );
}
