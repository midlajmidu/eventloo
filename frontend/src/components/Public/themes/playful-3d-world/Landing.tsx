import { Link } from "@tanstack/react-router";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import campus from "@/assets/playful/campus.webp";
import trophy from "@/assets/playful/trophy.webp";
import flag from "@/assets/playful/flag.webp";
import calendar from "@/assets/playful/calendar.webp";
import badge from "@/assets/playful/badge.webp";
import { formatDateRange, pad, useCountdown } from "@/lib/site-data";
import type { ThemePageProps } from "../themeTypes";
import { CountUp, InView, explore, useScrollY } from "../shared/kit";
import { ClientScene, Pill, Scenes, Shell, useWebGL } from "./Shell";

const art = { results: trophy, points: flag, schedule: calendar, verify: badge } as const;
const tint = ["bg-secondary", "bg-muted", "bg-[color-mix(in_oklab,var(--pop)_22%,white)]", "bg-[color-mix(in_oklab,var(--pop-3)_30%,white)]"];
const blocks = ["bg-accent", "bg-pop-2", "bg-pop", "bg-primary"];

/** A real CSS 3D box (front, top and side faces) used for stats. */
function Cube({ children, tone }: { children: React.ReactNode; tone: string }) {
  return (
    <div className="group [perspective:900px]">
      <div className="relative transition-transform duration-500 [transform-style:preserve-3d] [transform:rotateX(-12deg)_rotateY(18deg)] group-hover:[transform:rotateX(-6deg)_rotateY(6deg)]">
        <div className={`relative z-10 rounded-2xl px-4 py-6 text-center text-primary-foreground ${tone}`}>{children}</div>
        <div className={`absolute inset-x-0 top-0 h-6 origin-top rounded-t-2xl brightness-125 [transform:rotateX(90deg)] ${tone}`} aria-hidden />
        <div className={`absolute inset-y-0 right-0 w-6 origin-right rounded-r-2xl brightness-75 [transform:rotateY(90deg)] ${tone}`} aria-hidden />
      </div>
    </div>
  );
}

export function Landing({ data, preview }: ThemePageProps) {
  const ev = data.event;
  const gl = useWebGL();
  const y = useScrollY(1);
  const { parts, started, enabled } = useCountdown(ev?.start_date ?? null);
  const dates = formatDateRange(ev?.start_date ?? null, ev?.end_date ?? null);
  const year = ev?.start_date ? String(new Date(ev.start_date).getUTCFullYear()) : null;
  const title = (ev?.name || "").toUpperCase();
  const htmlTitle = (
    <div className="absolute inset-0 grid place-items-center px-6 text-center">
      <div>
        <h1 className="extrude font-fredoka text-[clamp(3.5rem,11vw,8rem)] font-bold leading-none text-background">{title}</h1>
        {year && <span className="mt-4 inline-block rounded-2xl bg-accent px-6 py-1 font-fredoka text-2xl font-bold text-accent-foreground shadow-[0_6px_0_color-mix(in_oklab,var(--accent)_60%,black)]">{year}</span>}
      </div>
    </div>
  );

  const htmlCountdown = (
    <div className="grid h-full grid-cols-4 items-center gap-3">
      {parts.map((p, i) => <div key={p.l} className={`rounded-2xl py-6 text-center font-fredoka text-5xl font-bold shadow-[0_10px_0_rgba(0,0,0,.2)] ${blocks[i]}`}>{pad(p.v)}</div>)}
    </div>
  );

  return (
    <Shell data={data} preview={preview}>
      {/* Hero: painted 3D campus + live WebGL title */}
      <section className="relative mx-3 mt-3 overflow-hidden rounded-[2.5rem]">
        <img src={campus} alt="Colourful 3D campus with an auditorium, stalls and students" width={1920} height={1088}
          className="absolute inset-0 h-full w-full object-cover object-[70%_center]" style={{ transform: `scale(1.06) translateY(${y * 0.1}px)` }} />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-transparent to-background/40" aria-hidden />
        <div className="relative h-[520px] sm:h-[620px] lg:h-[700px]">
          {gl && <h1 className="sr-only">{ev?.name}</h1>}
          <ClientScene when={gl} fallback={htmlTitle}>
            <Scenes.Hero title={title} year={year} />
          </ClientScene>
        </div>
        {(
          <div className="absolute inset-x-0 bottom-8 flex flex-col items-center gap-4 px-4 text-center">
            {ev?.tagline && <p className="rounded-full bg-card/90 px-5 py-2 font-fredoka text-sm font-semibold tracking-widest uppercase shadow-lg backdrop-blur">{ev.tagline}</p>}
            <a href="#explore" className="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3 font-fredoka text-lg font-semibold text-accent-foreground shadow-[0_6px_0_color-mix(in_oklab,var(--accent)_60%,black)] transition active:translate-y-1 active:shadow-none">
              Explore festival <ArrowRight className="h-5 w-5" />
            </a>
          </div>
        )}
      </section>

      {/* Floating identity panel */}
      <section className="relative z-10 mx-auto -mt-6 max-w-4xl px-5">
        <Pill className="flex flex-col items-center justify-between gap-4 px-6 py-5 text-center sm:flex-row sm:text-left">
          <div>
            <p className="text-[11px] font-bold tracking-[0.25em] text-primary uppercase">The annual festival</p>
            <p className="font-fredoka text-3xl font-bold">{ev?.name}</p>
          </div>
          <div className="flex flex-wrap justify-center gap-2 text-sm font-semibold">
            {dates && <span className="inline-flex items-center gap-2 rounded-full bg-secondary px-4 py-2"><CalendarDays className="h-4 w-4 text-primary" />{dates}</span>}
            {ev?.venue && <span className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2"><MapPin className="h-4 w-4 text-accent" />{ev.venue}</span>}
          </div>
        </Pill>
      </section>

      {/* About with 3D props */}
      {ev?.description && (
        <section className="mx-auto mt-24 grid max-w-6xl items-center gap-10 px-5 md:grid-cols-2">
          <InView className="transition duration-700" off="opacity-0 translate-y-8" on="opacity-100 translate-y-0">
            <h2 className="font-fredoka text-5xl font-bold text-primary">About the event</h2>
            <p className="mt-5 text-lg leading-relaxed text-foreground/80">{ev.description}</p>
          </InView>
          <div className="relative mx-auto h-80 w-full max-w-md">
            {ev.artwork_url ? <img src={ev.artwork_url} alt="" className="h-full w-full rounded-[2rem] object-cover" /> : (<>
              <div className="absolute inset-8 rounded-full bg-secondary" aria-hidden />
              <img src={trophy} alt="" loading="lazy" className="absolute left-4 top-6 w-40 animate-bob drop-shadow-xl" />
              <img src={calendar} alt="" loading="lazy" className="absolute bottom-2 right-6 w-36 animate-bob drop-shadow-xl [animation-delay:-1.5s]" />
              <img src={flag} alt="" loading="lazy" className="absolute right-20 top-0 w-28 animate-bob drop-shadow-xl [animation-delay:-2.5s]" />
            </>)}
          </div>
        </section>
      )}

      {/* Stats as 3D blocks */}
      {ev && ev.stats.length > 0 && (
        <section className="mx-auto mt-24 max-w-6xl px-5">
          <h2 className="text-center font-fredoka text-4xl font-bold">Festival at a glance</h2>
          <div className="mt-10 grid grid-cols-2 gap-8 md:grid-flow-col md:auto-cols-fr md:grid-cols-none">
            {ev.stats.map((s, i) => (
              <Cube key={s.label + i} tone={blocks[i % blocks.length]!}>
                <CountUp value={s.value} className="block font-fredoka text-5xl font-bold" />
                <p className="mt-1 text-sm font-bold tracking-wider uppercase opacity-90">{s.label}</p>
              </Cube>
            ))}
          </div>
        </section>
      )}

      {/* 3D countdown */}
      {enabled && (
        <section className="mx-3 mt-24 overflow-hidden rounded-[2.5rem] bg-primary px-5 py-12 text-primary-foreground">
          <h2 className="text-center font-fredoka text-4xl font-bold">{started ? "The festival has begun!" : "The festival begins in"}</h2>
          <div className="mx-auto mt-4 h-56 max-w-4xl sm:h-72">
            <ClientScene when={gl} fallback={htmlCountdown}>
              <Scenes.Countdown values={parts.map((p) => pad(p.v))} label={parts.map((p) => `${p.v} ${p.l}`).join(", ")} />
            </ClientScene>
          </div>
          <div className="mx-auto grid max-w-4xl grid-cols-4 text-center font-fredoka text-sm font-semibold tracking-wider uppercase opacity-90" aria-live="polite">
            {parts.map((p) => <span key={p.l}>{p.l}</span>)}
          </div>
          <div className="mx-auto mt-6 h-3 max-w-3xl rounded-full bg-accent" aria-hidden />
        </section>
      )}

      {/* 3D destinations */}
      <section id="explore" className="mx-auto mt-24 max-w-7xl scroll-mt-24 px-5">
        <h2 className="text-center font-fredoka text-4xl font-bold">Explore the festival</h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {explore.map((c, i) => (
            <Link key={c.key} to={c.to} search={{ preview }} className={`group flex flex-col items-center rounded-[2rem] p-6 text-center shadow-[0_10px_0_var(--border)] transition hover:-translate-y-2 hover:shadow-[0_16px_0_var(--border)] ${tint[i]}`}>
              <img src={art[c.key]} alt="" loading="lazy" className="h-36 w-36 object-contain drop-shadow-xl transition duration-500 group-hover:-translate-y-2 group-hover:rotate-6" />
              <h3 className="mt-2 font-fredoka text-2xl font-bold">{c.t}</h3>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{c.d}</p>
              <span className="mt-4 grid h-11 w-11 place-items-center rounded-full bg-primary text-primary-foreground shadow-[0_4px_0_var(--pop-2)]"><ArrowRight className="h-5 w-5" /></span>
            </Link>
          ))}
        </div>
      </section>
    </Shell>
  );
}
