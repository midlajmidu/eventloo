import { Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import statue from "@/assets/brutal/statue.webp";
import building from "@/assets/swiss/building.webp";
import megaphone from "@/assets/brutal/megaphone.webp";
import eye from "@/assets/brutal/eye.webp";
import trophy from "@/assets/brutal/obj-trophy.webp";
import flag from "@/assets/brutal/obj-flag.webp";
import calendar from "@/assets/brutal/obj-calendar.webp";
import badge from "@/assets/brutal/obj-badge.webp";
import { formatDateRange, pad, useCountdown } from "@/lib/site-data";
import type { ThemePageProps } from "../themeTypes";
import { CountUp, InView, explore, useScrollY } from "../shared/kit";
import { Shell } from "./Shell";

const art = { results: trophy, points: flag, schedule: calendar, verify: badge } as const;
const slabs = ["", "bg-accent px-3", "bg-pop px-3", "bg-secondary px-3 text-secondary-foreground"];
const cardTone = ["bg-secondary text-secondary-foreground -rotate-2", "bg-accent rotate-1", "bg-pop -rotate-1", "bg-pop-2 rotate-2"];
const countTone = ["bg-accent", "bg-pop", "bg-pop-2", "bg-background"];

export function Landing({ data, preview }: ThemePageProps) {
  const ev = data.event;
  const y = useScrollY(1);
  const { parts, started, enabled } = useCountdown(ev?.start_date ?? null);
  const dates = formatDateRange(ev?.start_date ?? null, ev?.end_date ?? null);
  const year = ev?.start_date ? new Date(ev.start_date).getUTCFullYear() : null;
  const words = [...(ev?.name || "").trim().split(/\s+/).filter(Boolean), ...(year ? [String(year)] : [])];
  const tag = (ev?.tagline || "").split(/[·•|,]/).map((w) => w.trim()).filter(Boolean);
  const marquee = [ev?.name, ...tag, dates, ev?.venue].filter(Boolean) as string[];
  let n = 0;
  const num = () => String(++n).padStart(2, "0");

  return (
    <Shell data={data} preview={preview}>
      {/* Hero poster */}
      <section className="relative mx-auto grid max-w-7xl gap-6 px-5 pt-8 sm:px-8 lg:grid-cols-12 lg:pt-12">
        <div className="relative z-10 lg:col-span-7">
          <h1 className="font-anton text-[clamp(4.5rem,15vw,12rem)] uppercase leading-[0.86]">
            {words.map((w, i) => (
              <span key={i} className="block overflow-hidden py-0.5">
                <span className={`inline-block animate-clip-up ${slabs[i % slabs.length]}`} style={{ animationDelay: `${i * 110}ms` }}>{w}</span>
              </span>
            ))}
          </h1>
          <div className="mt-6 flex flex-wrap items-center gap-6">
            {tag.length > 0 && <ul className="font-bebas text-2xl leading-7 tracking-widest">{tag.map((t) => <li key={t}>✱ {t}</li>)}</ul>}
            <a href="#explore" className="group inline-flex items-center gap-3 border-4 border-foreground bg-foreground px-6 py-3 font-bebas text-2xl tracking-wider text-background shadow-[6px_6px_0_var(--accent)] transition hover:translate-x-1 hover:translate-y-1 hover:shadow-none">
              Explore festival <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        </div>
        <div className="relative min-h-[420px] lg:col-span-5">
          <img src={building} alt="" className="absolute right-0 top-0 w-2/3 border-4 border-foreground grayscale" style={{ transform: `translateY(${y * 0.08}px)` }} aria-hidden />
          <div className="torn-top absolute bottom-4 left-0 h-[75%] w-[85%] bg-secondary" aria-hidden />
          <img src={statue} alt="Halftone classical bust" width={1024} height={1280} className="relative z-10 ml-auto mr-4 mt-10 w-[78%] max-w-sm drop-shadow-[10px_10px_0_var(--foreground)]" style={{ transform: `translateY(${y * -0.05}px)` }} />
          <span className="absolute left-[18%] top-[48%] z-20 -rotate-12 bg-pop px-6 py-1 font-bebas text-xl tracking-widest" aria-hidden>CREATE</span>
          <span className="absolute right-2 top-2 z-20 animate-spin-slow font-archivo text-7xl text-accent" aria-hidden>✱</span>
        </div>
      </section>

      {/* Kinetic marquee */}
      {marquee.length > 0 && (
        <div className="mt-10 -rotate-1 overflow-hidden border-y-4 border-foreground bg-pop py-2" aria-hidden>
          <div className="flex w-max animate-marquee gap-10 whitespace-nowrap font-anton text-4xl uppercase">
            {[...marquee, ...marquee, ...marquee, ...marquee].map((m, i) => <span key={i}>{m} <span className="text-accent">✱</span></span>)}
          </div>
        </div>
      )}

      {/* Identity */}
      <section className="mx-auto mt-14 max-w-7xl px-5 sm:px-8">
        <div className="grid border-4 border-foreground bg-secondary text-secondary-foreground md:grid-cols-[1fr_auto_auto]">
          <div className="p-6"><p className="font-bebas text-xl tracking-widest text-pop">The annual festival</p><p className="font-anton text-5xl uppercase sm:text-6xl">{ev?.name}</p></div>
          {dates && <div className="border-t-4 border-foreground bg-accent p-6 text-foreground md:border-l-4 md:border-t-0"><p className="font-bebas text-xl tracking-widest">Dates</p><p className="font-archivo text-2xl">{dates}</p></div>}
          {ev?.venue && <div className="border-t-4 border-foreground bg-background p-6 text-foreground md:border-l-4 md:border-t-0"><p className="font-bebas text-xl tracking-widest">Venue</p><p className="font-archivo text-2xl">{ev.venue}</p></div>}
        </div>
        <div className="stripes mt-2 h-4 text-accent" aria-hidden />
      </section>

      {/* About */}
      {ev?.description && (
        <section className="mx-auto mt-24 grid max-w-7xl items-center gap-10 px-5 sm:px-8 md:grid-cols-2">
          <InView className="transition duration-700" off="opacity-0 -translate-x-10" on="opacity-100 translate-x-0">
            <p className="font-bebas text-2xl tracking-widest text-accent">{num()} /</p>
            <h2 className="font-archivo text-5xl uppercase leading-[0.9] sm:text-7xl">About<br />the event</h2>
            <p className="mt-6 max-w-lg font-mono text-base leading-relaxed">{ev.description}</p>
          </InView>
          <div className="relative mx-auto w-full max-w-md">
            <div className="absolute inset-6 -rotate-3 border-4 border-foreground bg-secondary" aria-hidden />
            <img src={ev.artwork_url || megaphone} alt="" loading="lazy" className="relative w-full rotate-2 object-contain p-6" />
            <span className="absolute -right-2 -top-4 font-archivo text-7xl text-pop [text-shadow:3px_3px_0_var(--foreground)]" aria-hidden>★</span>
          </div>
        </section>
      )}

      {/* Stats */}
      {ev && ev.stats.length > 0 && (
        <section className="mt-24 border-y-4 border-foreground bg-accent">
          <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8">
            <p className="font-bebas text-2xl tracking-widest">{num()} / Festival at a glance</p>
            <div className="mt-4 grid grid-cols-2 md:grid-flow-col md:auto-cols-fr md:grid-cols-none">
              {ev.stats.map((s, i) => (
                <div key={s.label + i} className="border-t-4 border-foreground py-4 md:border-l-4 md:border-t-0 md:px-6 md:first:border-l-0 md:first:pl-0">
                  <CountUp value={s.value} className="block font-anton text-7xl leading-none sm:text-9xl" />
                  <p className="font-bebas text-2xl tracking-widest">{s.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Countdown */}
      {enabled && (
        <section className="mx-auto mt-24 max-w-7xl px-5 sm:px-8">
          <div className="grid overflow-hidden border-4 border-foreground md:grid-cols-[2fr_3fr]">
            <img src={eye} alt="" loading="lazy" className="h-40 w-full object-cover grayscale md:h-full" aria-hidden />
            <div className="bg-secondary p-6 text-secondary-foreground sm:p-8">
              <p className="font-bebas text-2xl tracking-widest text-pop">{num()} / {started ? "The festival has begun" : "The festival begins in"}</p>
              <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3" aria-live="polite">
                {parts.map((p, i) => (
                  <div key={p.l} className={`border-4 border-foreground p-2 text-center text-foreground shadow-[5px_5px_0_var(--foreground)] ${countTone[i]}`}>
                    <p className="font-anton text-4xl tabular-nums sm:text-6xl">{pad(p.v)}</p>
                    <p className="font-bebas text-base tracking-widest sm:text-lg">{p.l}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Explore */}
      <section id="explore" className="mx-auto mt-24 max-w-7xl scroll-mt-20 px-5 sm:px-8">
        <h2 className="flex items-center gap-4 font-archivo text-4xl uppercase sm:text-6xl">
          <span className="font-bebas text-2xl tracking-widest text-accent">{num()} /</span> Explore <span className="hidden h-1 flex-1 bg-foreground sm:block" /><ArrowRight className="h-10 w-10" />
        </h2>
        <div className="-mx-5 mt-10 flex snap-x snap-mandatory gap-6 overflow-x-auto px-5 pb-6 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
          {explore.map((c, i) => (
            <Link key={c.key} to={c.to} search={{ preview }} className={`group relative flex w-[78vw] max-w-xs shrink-0 snap-center flex-col border-4 border-foreground p-5 shadow-[8px_8px_0_var(--foreground)] transition hover:rotate-0 hover:-translate-y-1 sm:w-auto sm:max-w-none ${cardTone[i]}`}>
              <img src={art[c.key]} alt="" loading="lazy" className="mx-auto h-36 w-36 object-contain grayscale contrast-125 mix-blend-multiply" />
              <h3 className="mt-3 font-anton text-3xl uppercase leading-none">{c.t}</h3>
              <p className="mt-2 pr-10 font-mono text-sm">{c.d}</p>
              <span className="absolute bottom-4 right-4 grid h-10 w-10 place-items-center bg-foreground text-background"><ArrowUpRight /></span>
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  );
}
