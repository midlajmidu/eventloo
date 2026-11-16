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
      <section className="relative overflow-hidden">
        <img src={coast} alt="Watercolor lighthouse on a coastal cliff at sunrise" width={1920} height={896}
          className="pointer-events-none relative w-full object-cover sm:absolute sm:inset-0 sm:h-full sm:object-right" style={{ transform: `translateY(${y}px)` }} />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-center px-6 py-10 sm:min-h-[560px] sm:px-8 lg:min-h-[640px]">
          <div className="max-w-xl">
            <h1 className="animate-rise font-editorial text-6xl leading-[1.02] text-primary sm:text-7xl lg:text-8xl">
              {words.join(" ")}
              {last && <span className="block font-serif text-gold italic">{last}</span>}
            </h1>
            {ev?.tagline && <p className="mt-6 animate-rise text-xs tracking-[0.35em] text-foreground/80 uppercase [animation-delay:.2s]">{ev.tagline}</p>}
            <a href="#explore" className="mt-8 inline-flex animate-rise items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm text-primary-foreground transition hover:gap-3 [animation-delay:.35s]">
              Explore Festival <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
        <Wave className="absolute inset-x-0 bottom-0 hidden h-16 w-full text-background sm:block" />
      </section>

      {/* Identity */}
      <section className="px-6 pt-10 text-center">
        <Reveal>
          <p className="text-xs tracking-[0.35em] text-gold uppercase">The Annual Festival</p>
          <h2 className="mt-3 font-editorial text-6xl tracking-wide text-primary sm:text-8xl">{ev?.name}</h2>
          {(dates || ev?.venue) && (
            <div className="mt-6 flex flex-wrap justify-center gap-3 text-sm">
              {dates && <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2"><CalendarDays className="h-4 w-4 text-gold" />{dates}</span>}
              {ev?.venue && <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2"><MapPin className="h-4 w-4 text-gold" />{ev.venue}</span>}
            </div>
          )}
          <Ornament className="mt-8" />
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
                  <p className="mt-3 font-editorial text-5xl text-primary">{s.value}</p>
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
                    <p className="font-editorial text-4xl text-primary tabular-nums sm:text-6xl">{pad(p.v)}</p>
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
