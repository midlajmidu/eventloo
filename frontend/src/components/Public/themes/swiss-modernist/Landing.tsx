import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import building from "@/assets/swiss/building.webp";
import trophy from "@/assets/brutal/obj-trophy.webp";
import flag from "@/assets/brutal/obj-flag.webp";
import calendar from "@/assets/brutal/obj-calendar.webp";
import badge from "@/assets/brutal/obj-badge.webp";
import { formatDateRange, pad, useCountdown } from "@/lib/site-data";
import type { ThemePageProps } from "../themeTypes";
import { CountUp, InView, explore, useScrollY } from "../shared/kit";
import { Rule, Shell } from "./Shell";

const art = { results: trophy, points: flag, schedule: calendar, verify: badge } as const;

export function Landing({ data, preview }: ThemePageProps) {
  const ev = data.event;
  const y = useScrollY(1);
  const { parts, started, enabled } = useCountdown(ev?.start_date ?? null);
  const dates = formatDateRange(ev?.start_date ?? null, ev?.end_date ?? null);
  const year = ev?.start_date ? new Date(ev.start_date).getUTCFullYear() : null;
  const words = (ev?.name || "").trim().split(/\s+/).filter(Boolean);
  const taglineWords = (ev?.tagline || "").split(/[·•|,]/).map((w) => w.trim()).filter(Boolean);
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <Shell data={data} preview={preview}>
      {/* Hero */}
      <section className="relative mx-auto max-w-7xl px-5 pt-10 sm:px-8 lg:pt-16">
        {year && <span className="pointer-events-none absolute -top-4 right-0 select-none text-[28vw] font-black leading-none tracking-[-0.08em] text-muted lg:text-[300px]" aria-hidden>{year}</span>}
        <div className="relative grid items-end gap-10 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <p className="text-[11px] font-semibold tracking-[0.3em] uppercase">{ev?.theme_title || "The Annual Festival"}{year ? ` / ${year}` : ""}</p>
            <h1 className="mt-6 text-[clamp(3.5rem,10.5vw,8.5rem)] font-black uppercase leading-[0.82] tracking-[-0.06em]">
              {words.map((w, i) => (
                <span key={i} className="block overflow-hidden"><span className={`block animate-clip-up ${i % 2 ? "text-accent" : ""}`} style={{ animationDelay: `${i * 120}ms` }}>{w}</span></span>
              ))}
            </h1>
            <div className="mt-8 flex flex-wrap items-end gap-8">
              {taglineWords.length > 0 && (
                <ul className="border-l-2 border-accent pl-4 text-sm font-semibold uppercase leading-6 tracking-[0.2em]">
                  {taglineWords.map((w) => <li key={w}>{w}</li>)}
                </ul>
              )}
              <a href="#explore" className="group inline-flex items-center gap-4 bg-accent px-6 py-4 text-sm font-bold tracking-wide text-accent-foreground uppercase">
                Explore Festival <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </a>
            </div>
          </div>
          <div className="relative mx-auto w-full max-w-lg lg:col-span-5">
            <div className="absolute inset-[6%] rounded-full bg-accent" style={{ transform: `translateY(${y * 0.06}px)` }} aria-hidden />
            <img src={building} alt="Black and white concrete colonnade" width={1280} height={1280} className="relative w-full grayscale contrast-125" style={{ transform: `translateY(${y * -0.04}px)` }} />
          </div>
        </div>
      </section>

      {/* Identity */}
      <section className="mx-auto mt-14 max-w-7xl px-5 sm:px-8">
        <div className="grid border-y border-foreground md:grid-cols-12">
          <div className="flex items-center gap-4 py-6 md:col-span-5 md:border-r md:border-border md:pr-6">
            <span className="h-10 w-1.5 -skew-x-[20deg] bg-accent" aria-hidden />
            <div>
              <p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground uppercase">The Annual Festival</p>
              <p className="text-3xl font-black uppercase tracking-tight">{ev?.name}</p>
            </div>
          </div>
          {dates && <div className="border-t border-border py-6 md:col-span-3 md:border-r md:border-t-0 md:px-6"><p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground uppercase">Dates</p><p className="mt-1 text-lg font-bold">{dates}</p></div>}
          {ev?.venue && <div className="border-t border-border py-6 md:col-span-3 md:border-t-0 md:px-6"><p className="text-[10px] font-semibold tracking-[0.3em] text-muted-foreground uppercase">Venue</p><p className="mt-1 text-lg font-bold">{ev.venue}</p></div>}
          <div className="stripes hidden text-foreground md:col-span-1 md:block" aria-hidden />
        </div>
      </section>

      {/* 01 About */}
      {ev?.description && (
        <section className="mx-auto mt-24 max-w-7xl px-5 sm:px-8">
          <Rule n={num()} label="About" />
          <div className="mt-8 grid gap-10 md:grid-cols-12">
            <InView className="transition duration-700 md:col-span-6" off="opacity-0 translate-y-6" on="opacity-100 translate-y-0">
              <h2 className="text-5xl font-black leading-[0.9] tracking-[-0.04em] sm:text-6xl">About the<br />event<span className="text-accent">.</span></h2>
              <p className="mt-8 max-w-lg text-lg leading-relaxed text-foreground/80">{ev.description}</p>
            </InView>
            <div className="relative md:col-span-5 md:col-start-8">
              <div className="aspect-[4/5] overflow-hidden bg-card">
                <img src={ev.artwork_url || building} alt="" loading="lazy" className="h-full w-full scale-150 object-cover object-[30%_40%] grayscale" />
              </div>
              <div className="absolute -bottom-5 -left-5 h-24 w-24 bg-accent" aria-hidden />
            </div>
          </div>
        </section>
      )}

      {/* 02 Glance */}
      {ev && ev.stats.length > 0 && (
        <section className="mx-auto mt-24 max-w-7xl px-5 sm:px-8">
          <Rule n={num()} label="Festival at a glance" />
          <div className="mt-6 grid grid-cols-2 md:grid-flow-col md:auto-cols-fr md:grid-cols-none">
            {ev.stats.map((s, i) => (
              <div key={s.label + i} className="border-b border-border py-8 pr-4 md:border-b-0 md:border-l md:px-6 md:first:border-l-0 md:first:pl-0">
                <CountUp value={s.value} className="block text-6xl font-black tracking-[-0.06em] sm:text-8xl" />
                <p className="mt-2 text-[11px] font-semibold tracking-[0.3em] text-muted-foreground uppercase">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 03 Countdown */}
      {enabled && (
        <section className="mx-auto mt-24 max-w-7xl px-5 sm:px-8">
          <Rule n={num()} label={started ? "The festival has begun" : "The festival begins in"} />
          <div className="relative mt-8 overflow-hidden bg-primary text-primary-foreground">
            <div className="absolute inset-y-0 -left-10 w-1/3 -skew-x-[20deg] bg-accent" aria-hidden />
            <div className="relative grid grid-cols-4 gap-px px-4 py-10 sm:py-14 md:pl-[30%]" aria-live="polite">
              {parts.map((p) => (
                <div key={p.l} className="border-l border-primary-foreground/20 pl-3 sm:pl-6">
                  <p className="text-5xl font-black tabular-nums tracking-[-0.06em] sm:text-8xl">{pad(p.v)}</p>
                  <p className="mt-1 text-[10px] font-semibold tracking-[0.3em] text-primary-foreground/60 uppercase">{p.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 04 Explore */}
      <section id="explore" className="mx-auto mt-24 max-w-7xl scroll-mt-20 px-5 sm:px-8">
        <Rule n={num()} label="Explore the festival" />
        <div className="mt-6 grid border-l border-t border-foreground sm:grid-cols-2 lg:grid-cols-4">
          {explore.map((c, i) => (
            <Link key={c.key} to={c.to} search={{ preview }} className="group relative flex min-h-[340px] flex-col border-b border-r border-foreground p-6 transition-colors hover:bg-card">
              <span className="text-[11px] font-semibold tracking-[0.3em] text-accent">{String(i + 1).padStart(2, "0")}</span>
              <div className="relative my-4 flex flex-1 items-center justify-center">
                <span className={`absolute h-20 w-20 bg-accent ${i % 2 ? "rounded-full" : "rotate-12"}`} aria-hidden />
                <img src={art[c.key]} alt="" loading="lazy" className="relative h-36 w-36 object-contain grayscale transition-transform duration-500 group-hover:-translate-y-1" />
              </div>
              <h3 className="text-2xl font-black tracking-tight">{c.t}</h3>
              <p className="mt-1 pr-12 text-sm text-muted-foreground">{c.d}</p>
              <span className="absolute bottom-6 right-6 grid h-10 w-10 place-items-center bg-primary text-primary-foreground transition-colors group-hover:bg-accent"><ArrowUpRight className="h-5 w-5" /></span>
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  );
}
