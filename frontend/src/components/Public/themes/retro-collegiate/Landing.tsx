import { Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import campus from "@/assets/retro/campus.webp";
import megaphone from "@/assets/retro/megaphone.webp";
import trophy from "@/assets/retro/trophy.webp";
import flag from "@/assets/retro/flag.webp";
import calendar from "@/assets/retro/calendar.webp";
import badge from "@/assets/retro/badge.webp";
import { formatDateRange, pad, useCountdown } from "@/lib/site-data";
import type { ThemePageProps } from "../themeTypes";
import { CountUp, InView, explore, useScrollY } from "../shared/kit";
import { Banner, Shell } from "./Shell";

const art = { results: trophy, points: flag, schedule: calendar, verify: badge } as const;

/** One flip-clock digit pair; re-keys on change so the card flips. */
function Flip({ v, l }: { v: number; l: string }) {
  return (
    <div className="text-center">
      <div className="relative mx-auto grid h-24 w-full max-w-[9rem] place-items-center overflow-hidden rounded-lg bg-primary text-primary-foreground shadow-[0_6px_0_var(--accent)] [perspective:400px] sm:h-36">
        <span key={v} className="animate-flip-in font-oswald text-5xl font-bold tabular-nums sm:text-7xl">{pad(v)}</span>
        <span className="absolute inset-x-0 top-1/2 h-px bg-background/25" aria-hidden />
      </div>
      <p className="mt-3 font-oswald text-xs tracking-[0.3em] uppercase sm:text-sm">{l}</p>
    </div>
  );
}

export function Landing({ data, preview }: ThemePageProps) {
  const ev = data.event;
  const y = useScrollY(1);
  const { parts, started, enabled } = useCountdown(ev?.start_date ?? null);
  const dates = formatDateRange(ev?.start_date ?? null, ev?.end_date ?? null);
  const year = ev?.start_date ? new Date(ev.start_date).getUTCFullYear() : null;

  return (
    <Shell data={data} preview={preview}>
      {/* Hero poster */}
      <section className="relative overflow-hidden border-b-4 border-primary">
        <img src={campus} alt="Vintage poster of a college campus with a clock tower and festival tents" width={1920} height={1088}
          className="relative w-full object-cover object-right md:absolute md:inset-0 md:h-full" style={{ transform: `translateY(${y * 0.12}px)` }} />
        <div className="relative mx-auto flex max-w-7xl flex-col justify-center px-5 py-10 sm:px-8 md:min-h-[600px] lg:min-h-[680px]">
          <div className="max-w-xl text-center md:text-left">
            {ev?.theme_title && <p className="inline-block rounded bg-background/85 px-3 py-1 font-oswald text-sm font-semibold tracking-[0.35em] text-primary uppercase">★ {ev.theme_title} ★</p>}
            <div className="relative mt-2 inline-block">
                            <h1 className="animate-rise font-retro-script text-[clamp(2.75rem,12vw,8.5rem)] leading-[1.05] text-primary md:text-background [text-shadow:4px_4px_0_var(--accent),8px_8px_0_var(--primary)]">{ev?.name}</h1>
                          </div>
            {year && (
              <div className="mt-3 flex justify-center md:justify-start">
                <span className="relative bg-accent px-10 py-1 font-oswald text-2xl font-bold tracking-[0.3em] text-accent-foreground [clip-path:polygon(0_0,100%_0,94%_50%,100%_100%,0_100%,6%_50%)]">{year}</span>
              </div>
            )}
            {ev?.tagline && <p className="mt-5 inline-block rounded bg-background/85 px-3 py-1 font-oswald text-sm font-semibold tracking-[0.35em] text-primary uppercase">{ev.tagline}</p>}
            <a href="#explore" className="mt-7 inline-flex items-center gap-2 rounded-md border-2 border-primary bg-accent px-6 py-3 font-oswald font-semibold tracking-widest text-accent-foreground uppercase shadow-[4px_4px_0_var(--primary)] transition hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-[2px_2px_0_var(--primary)]">
              Explore festival <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </div>
      </section>

      {/* Admission ticket */}
      <section className="mx-auto -mt-1 max-w-5xl px-5 pt-12 sm:px-8">
        <InView className="transition duration-700" off="opacity-0 rotate-2 translate-y-6" on="opacity-100 rotate-0 translate-y-0">
          <div className="relative grid overflow-hidden rounded-lg border-2 border-primary bg-card md:grid-cols-[1fr_auto]">
            <span className="absolute -left-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border-2 border-primary bg-background" aria-hidden />
            <span className="absolute -right-4 top-1/2 h-8 w-8 -translate-y-1/2 rounded-full border-2 border-primary bg-background md:hidden" aria-hidden />
            <div className="px-10 py-6 text-center md:text-left">
              <p className="font-oswald text-xs tracking-[0.35em] text-accent uppercase">Admit one · The annual festival</p>
              <p className="font-fraunces text-5xl font-black text-primary uppercase sm:text-6xl">{ev?.name}</p>
              <div className="mt-2 flex flex-wrap justify-center gap-x-6 font-oswald tracking-wider uppercase md:justify-start">
                {dates && <span>{dates}</span>}{ev?.venue && <span>★ {ev.venue}</span>}
              </div>
            </div>
            <div className="grid place-items-center border-t-2 border-dashed border-primary p-5 md:border-l-2 md:border-t-0">
              <div className="animate-stamp rounded-sm border-[3px] border-double border-accent px-4 py-3 text-center text-accent">
                <p className="font-oswald text-xs tracking-[0.3em]">OFFICIAL</p>
                <p className="font-fraunces text-3xl font-black">{year ?? "★"}</p>
                <p className="font-oswald text-xs tracking-[0.3em]">ENTRY</p>
              </div>
            </div>
          </div>
        </InView>
      </section>

      {/* Newspaper about */}
      {ev?.description && (
        <section className="mx-auto mt-24 max-w-6xl px-5 sm:px-8">
          <div className="border-y-4 border-double border-primary py-2 text-center font-oswald text-xs tracking-[0.4em] uppercase">The Festival Gazette{year ? ` · Edition ${year}` : ""}</div>
          <div className="mt-8 grid items-center gap-10 md:grid-cols-[3fr_2fr]">
            <div>
              <h2 className="inline-block -rotate-1 bg-accent px-5 py-1 font-fraunces text-4xl font-black text-accent-foreground uppercase sm:text-5xl">About the event</h2>
              <p className="mt-6 font-baskerville text-lg leading-relaxed first-letter:float-left first-letter:mr-2 first-letter:font-fraunces first-letter:text-7xl first-letter:font-black first-letter:leading-[0.8] first-letter:text-accent">{ev.description}</p>
            </div>
            <div className="relative">
              <div className="halftone absolute inset-6 text-secondary" aria-hidden />
              <img src={ev.artwork_url || megaphone} alt="" loading="lazy" className="relative mx-auto w-full max-w-sm animate-wobble" />
            </div>
          </div>
        </section>
      )}

      {/* Scoreboard stats */}
      {ev && ev.stats.length > 0 && (
        <section className="mx-auto mt-24 max-w-6xl px-5 sm:px-8">
          <div className="rounded-xl border-4 border-accent bg-primary p-6 text-primary-foreground shadow-[8px_8px_0_var(--accent)] sm:p-8">
            <p className="text-center font-fraunces text-2xl font-black tracking-wide text-secondary uppercase sm:text-3xl">★ Festival at a glance ★</p>
            <div className="mt-6 grid grid-cols-2 gap-px bg-primary-foreground/20 md:grid-flow-col md:auto-cols-fr md:grid-cols-none">
              {ev.stats.map((s, i) => (
                <div key={s.label + i} className="bg-primary px-3 py-5 text-center">
                  <CountUp value={s.value} className="block font-oswald text-5xl font-bold text-secondary tabular-nums sm:text-7xl" />
                  <p className="mt-1 font-oswald text-xs tracking-[0.3em] uppercase opacity-80">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Flip countdown */}
      {enabled && (
        <section className="mt-24">
          <div className="torn-top torn-bottom bg-secondary/60 py-16">
            <div className="mx-auto max-w-4xl px-5 sm:px-8">
              <Banner>{started ? "The festival has begun" : "The festival begins in"}</Banner>
              <div className="mt-8 rounded-xl border-4 border-accent bg-card p-4 sm:p-6">
                <div className="grid grid-cols-4 gap-3 sm:gap-6" aria-live="polite">
                  {parts.map((p) => <Flip key={p.l} v={p.v} l={p.l} />)}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Explore */}
      <section id="explore" className="mx-auto mt-24 max-w-7xl scroll-mt-20 px-5 sm:px-8">
        <Banner>Explore the festival</Banner>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {explore.map((c, i) => (
            <InView key={c.key} delay={i * 90} className="transition duration-500" off="opacity-0 translate-y-8" on="opacity-100 translate-y-0">
              <Link to={c.to} search={{ preview }} className="group relative flex h-full flex-col items-center rounded-md border-2 border-primary bg-card p-6 text-center shadow-[5px_5px_0_var(--primary)] transition hover:-translate-y-1 hover:shadow-[8px_8px_0_var(--accent)]">
                <span className="absolute inset-2 rounded border border-dashed border-primary/30" aria-hidden />
                <img src={art[c.key]} alt="" loading="lazy" className="h-32 w-32 object-contain mix-blend-multiply transition group-hover:rotate-3" />
                <h3 className="mt-3 font-fraunces text-2xl font-black text-primary">{c.t}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{c.d}</p>
                <span className="mt-4 grid h-10 w-10 place-items-center rounded-full bg-accent text-accent-foreground"><ArrowRight className="h-4 w-4" /></span>
              </Link>
            </InView>
          ))}
        </div>
      </section>
    </Shell>
  );
}
