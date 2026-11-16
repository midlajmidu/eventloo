import { Link } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { ArrowRight, CalendarDays, MapPin } from "lucide-react";
import sky from "@/assets/gravitas/sky.webp";
import palace from "@/assets/gravitas/palace.webp";
import scholar from "@/assets/gravitas/scholar.webp";
import lantern from "@/assets/gravitas/lantern.webp";
import manuscripts from "@/assets/gravitas/manuscripts.webp";
import ribbon from "@/assets/gravitas/ribbon.webp";
import dunes from "@/assets/gravitas/dunes.webp";
import hourglass from "@/assets/gravitas/hourglass.webp";
import miniStudents from "@/assets/gravitas/mini-students.webp";
import miniAcademy from "@/assets/gravitas/mini-academy.webp";
import miniBooks from "@/assets/gravitas/mini-books.webp";
import miniGlobe from "@/assets/gravitas/mini-globe.webp";
import iconTrophy from "@/assets/gravitas/icon-trophy.webp";
import iconFlag from "@/assets/gravitas/icon-flag.webp";
import iconCalendar from "@/assets/gravitas/icon-calendar.webp";
import iconBadge from "@/assets/gravitas/icon-badge.webp";
import { formatDateRange, pad, useCountdown } from "@/lib/site-data";
import type { ThemePageProps } from "../themeTypes";
import { Shell } from "./Shell";

const minis = [miniBooks, miniStudents, miniGlobe, miniAcademy];

// deterministic star + particle fields (no hydration mismatch)
const rand = (i: number, n: number) => ((Math.sin(i * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
const stars = Array.from({ length: 70 }, (_, i) => ({ x: rand(i, 1) * 100, y: rand(i, 2) * 55, s: 1 + rand(i, 3) * 2.5, d: rand(i, 4) * 4, t: 2 + rand(i, 5) * 3 }));
const embers = Array.from({ length: 18 }, (_, i) => ({ x: rand(i, 6) * 100, d: rand(i, 7) * 8, t: 8 + rand(i, 8) * 8, s: 2 + rand(i, 9) * 3 }));

/** GSAP + ScrollTrigger scene choreography; skipped for reduced motion and simplified on small screens. */
function useScenes(root: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    let ctx: { revert: () => void } | undefined;
    let cancelled = false;
    (async () => {
      const { gsap } = await import("gsap");
      const { ScrollTrigger } = await import("gsap/ScrollTrigger");
      if (cancelled || !root.current) return;
      gsap.registerPlugin(ScrollTrigger);
      const mm = gsap.matchMedia();
      ctx = mm;
      mm.add(
        { desktop: "(min-width: 768px)", mobile: "(max-width: 767px)" },
        (c) => {
          const { desktop } = c.conditions as { desktop: boolean };
          const scope = root.current!;
          const hero = scope.querySelector("[data-hero]");
          // intro: title reveal
          gsap.fromTo(scope.querySelectorAll("[data-intro]"), { y: 40, opacity: 0 }, { y: 0, opacity: 1, duration: 1.4, ease: "power3.out", stagger: 0.2 });
          gsap.fromTo(scope.querySelectorAll("[data-fg]"), { y: 80, opacity: 0 }, { y: 0, opacity: 1, duration: 1.6, ease: "power2.out", delay: 0.2, stagger: 0.15 });
          // multi-layer parallax tied to hero scroll
          scope.querySelectorAll<HTMLElement>("[data-depth]").forEach((el) => {
            const depth = Number(el.dataset["depth"]) * (desktop ? 1 : 0.5);
            gsap.to(el, { yPercent: depth * 60, ease: "none", scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: true } });
          });
          // scene transition: night darkens as the parchment rises in
          gsap.to(scope.querySelector("[data-night-veil]"), { opacity: 0.85, ease: "none", scrollTrigger: { trigger: hero, start: "40% top", end: "bottom top", scrub: true } });
          // text & card reveals
          scope.querySelectorAll<HTMLElement>("[data-reveal]").forEach((el) => {
            gsap.fromTo(el, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 1.1, ease: "power3.out", scrollTrigger: { trigger: el, start: "top 85%" } });
          });
          scope.querySelectorAll<HTMLElement>("[data-stagger]").forEach((el) => {
            gsap.fromTo(el.children, { y: 60, opacity: 0, rotateX: desktop ? 25 : 0 }, { y: 0, opacity: 1, rotateX: 0, duration: 1, ease: "back.out(1.4)", stagger: 0.12, scrollTrigger: { trigger: el, start: "top 80%" } });
          });
          // dunes: hourglass tilts in and the sand drifts
          if (desktop) {
            gsap.fromTo(scope.querySelector("[data-hourglass]"), { rotate: -25, y: 60 }, { rotate: 0, y: 0, ease: "none", scrollTrigger: { trigger: "[data-dunes]", start: "top bottom", end: "top 30%", scrub: true } });
            gsap.fromTo(scope.querySelector("[data-dunes-bg]"), { scale: 1.15 }, { scale: 1, ease: "none", scrollTrigger: { trigger: "[data-dunes]", start: "top bottom", end: "bottom top", scrub: true } });
          }
        },
      );
    })();
    return () => {
      cancelled = true;
      ctx?.revert();
    };
  }, [root]);
}

function Eyebrow({ children, light = true }: { children: string; light?: boolean }) {
  return (
    <div className={`flex items-center justify-center gap-4 font-display text-sm font-semibold tracking-[0.35em] ${light ? "text-gold" : "text-ink"}`}>
      <span className="h-px w-10 bg-current opacity-60" /> ✦ {children} ✦ <span className="h-px w-10 bg-current opacity-60" />
    </div>
  );
}

export function Landing({ data, preview }: ThemePageProps) {
  const ev = data.event;
  const root = useRef<HTMLDivElement>(null);
  useScenes(root);
  const { parts, started, enabled } = useCountdown(ev?.start_date ?? null);
  const dates = formatDateRange(ev?.start_date ?? null, ev?.end_date ?? null);
  const [t1, ...tRest] = (ev?.theme_title || ev?.name || "").split(" ");
  const cards = [
    { t: "Live Results", d: "Track program results and winners in real time.", img: iconTrophy, to: "/results" },
    { t: "Team Points", d: "Follow your team's performance and standings.", img: iconFlag, to: "/points-table" },
    { t: "Event Schedule", d: "Check program timings, venues and updates.", img: iconCalendar, to: "/schedule" },
    { t: "Verify Candidate", d: "Scan QR or enter details to verify participant badges.", img: iconBadge, to: "/verify-badge" },
  ] as const;

  return (
    <Shell data={data} preview={preview} scene>
      <div ref={root}>
        {/* Scene 1 — cinematic hero */}
        <section data-hero className="relative h-[100svh] min-h-[640px] overflow-hidden bg-night-deep">
          <img src={sky} alt="" aria-hidden width={1920} height={1088} data-depth="0.5" className="absolute inset-0 h-[115%] w-full object-cover" />
          <div className="absolute inset-0" data-depth="0.45">
            {stars.map((s, i) => (
              <span key={i} className="absolute rounded-full bg-parchment animate-twinkle"
                style={{ left: `${s.x}%`, top: `${s.y}%`, width: s.s, height: s.s, animationDelay: `${s.d}s`, animationDuration: `${s.t}s`, boxShadow: "0 0 6px var(--glow)" }} />
            ))}
            <span className="absolute right-[18%] top-[10%] h-[2px] w-40 rounded-full bg-gradient-to-l from-parchment to-transparent animate-shoot" />
          </div>
          <img src={ribbon} alt="" aria-hidden data-depth="0.35" className="pointer-events-none absolute -left-[10%] top-[2%] w-[120%] max-w-none opacity-70 mix-blend-screen animate-drift" />
          <div className="absolute inset-x-0 bottom-[22%] flex justify-center sm:bottom-[16%] sm:justify-end" data-depth="0.25">
            <div className="relative w-[170vw] max-w-none translate-x-[22%] sm:w-[78vw] sm:translate-x-[6%]">
              <img src={palace} alt="Illuminated palace academy in a palm oasis" width={1920} height={912} className="relative w-full drop-shadow-[0_0_40px_var(--glow)]" />
              <img src={palace} alt="" aria-hidden className="absolute left-0 top-[82%] w-full origin-top blur-[2px] animate-shimmer [mask-image:linear-gradient(to_bottom,black,transparent_35%)]" />
            </div>
          </div>
          <div className="absolute inset-x-0 top-[13%] z-10 px-4 text-center sm:top-[11%] sm:pl-[25%]" data-depth="-0.2">
            <h1 data-intro className="font-script text-6xl leading-none text-gold text-glow sm:text-8xl lg:text-9xl">
              {t1} {tRest.length > 0 && <span className="block sm:inline">{tRest.join(" ")}</span>}
            </h1>
            {ev?.tagline && <p data-intro className="mt-4 font-display text-sm font-semibold tracking-[0.4em] sm:text-base">{ev.tagline}</p>}
          </div>
          <div data-fg className="absolute bottom-[6%] left-[-22%] z-20 h-[50%] sm:left-[-2%] sm:h-[82%] lg:left-[2%]">
            <img src={scholar} alt="A scholar holding a manuscript gazes toward the academy" width={896} height={1344} data-depth="0.1" className="h-full w-auto" />
          </div>
          <div data-fg className="absolute bottom-[-2%] left-0 z-30 w-[70vw] max-w-[560px] sm:w-[40vw]">
            <img src={manuscripts} alt="Antique manuscripts, scrolls and a quill in an inkwell" width={1344} height={896} className="w-full drop-shadow-2xl" />
          </div>
          <div data-fg className="absolute bottom-[4%] right-[3%] z-30 w-[22vw] max-w-[200px] sm:right-[8%]">
            <div className="absolute inset-[-40%] rounded-full bg-[radial-gradient(circle,var(--glow)_0%,transparent_60%)] opacity-60 animate-flicker" />
            <img src={lantern} alt="Glowing brass lantern" width={768} height={1152} className="relative w-full drop-shadow-[0_0_30px_var(--glow)]" />
          </div>
          <div data-night-veil className="pointer-events-none absolute inset-0 z-[24] bg-night-deep opacity-0" />
          <div className="absolute inset-x-0 bottom-0 z-[25] h-40 bg-gradient-to-b from-transparent via-parchment-deep/60 to-parchment" />
        </section>

        {/* Scene 2 — identity reveal */}
        <section className="relative bg-parchment px-6 pb-24 pt-10 text-center text-ink">
          <p data-reveal className="font-display text-sm font-semibold tracking-[0.45em] text-ink-soft">THE ANNUAL FESTIVAL</p>
          <h2 data-reveal className="mt-2 font-display text-6xl font-extrabold tracking-wide sm:text-8xl lg:text-9xl">{ev?.name}</h2>
          {(dates || ev?.venue) && (
            <div data-reveal className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-lg font-semibold sm:text-xl">
              {dates && <span className="inline-flex items-center gap-2"><CalendarDays className="h-5 w-5" /> {dates}</span>}
              {dates && ev?.venue && <span className="hidden h-5 w-px bg-ink/40 sm:block" />}
              {ev?.venue && <span className="inline-flex items-center gap-2"><MapPin className="h-5 w-5" /> {ev.venue}</span>}
            </div>
          )}
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-b from-transparent to-night" />
        </section>

        {/* Scene 3 — manuscript about + statistics in arches */}
        <section className="relative overflow-hidden bg-night pb-10 pt-16">
          <img src={sky} alt="" aria-hidden loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-b from-night via-transparent to-night" />
          <div className="pointer-events-none absolute inset-0">
            {embers.map((e, i) => (
              <span key={i} className="absolute bottom-0 rounded-full bg-glow animate-ember" style={{ left: `${e.x}%`, width: e.s, height: e.s, animationDelay: `${e.d}s`, animationDuration: `${e.t}s` }} />
            ))}
          </div>
          {ev?.description && (
            <div data-reveal className="relative mx-auto max-w-3xl px-6">
              <div className="relative rounded-[2rem] border border-gold/40 bg-parchment px-8 py-10 text-center text-ink shadow-[0_30px_80px_-30px_var(--glow)] sm:px-14">
                <img src={manuscripts} alt="" aria-hidden loading="lazy" className="pointer-events-none absolute -bottom-10 -right-10 w-40 opacity-90 sm:w-56" />
                <Eyebrow light={false}>ABOUT THE EVENT</Eyebrow>
                <p className="relative mt-6 text-xl leading-relaxed sm:text-2xl">{ev.description}</p>
              </div>
            </div>
          )}
          {ev && ev.stats.length > 0 && (
            <div className="relative mx-auto mt-20 max-w-6xl px-6">
              <div data-reveal><Eyebrow>FESTIVAL AT A GLANCE</Eyebrow></div>
              <div data-stagger className="mt-10 grid grid-cols-2 gap-5 [perspective:800px] lg:grid-cols-4">
                {ev.stats.map((g, i) => (
                  <div key={g.label + i} className="arch group relative overflow-hidden border-2 border-gold/70 bg-parchment p-3 pb-6 text-center text-ink shadow-[0_0_40px_-10px_var(--glow)] transition hover:-translate-y-1">
                    <div className="arch overflow-hidden">
                      <img src={minis[i % minis.length]} alt="" loading="lazy" width={512} height={512} className="aspect-[5/4] w-full object-cover transition duration-700 group-hover:scale-105" />
                    </div>
                    <p className="mt-3 font-display text-4xl font-bold sm:text-5xl">{g.value}</p>
                    <p className="text-lg font-semibold text-ink-soft">{g.label}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Scene 4 — dunes: countdown + destinations */}
        <section data-dunes className="relative overflow-hidden">
          <img data-dunes-bg src={dunes} alt="" aria-hidden loading="lazy" width={1920} height={1088} className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-parchment/30" />
          <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-night via-night/60 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-secondary" />
          {enabled && (
            <div className="relative mx-auto max-w-5xl px-6 pt-28 text-center">
              <div data-reveal><Eyebrow light={false}>{started ? "THE FESTIVAL HAS BEGUN" : "THE FESTIVAL BEGINS IN"}</Eyebrow></div>
              <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row sm:justify-center">
                <img data-hourglass src={hourglass} alt="Hourglass" loading="lazy" width={768} height={1152} className="w-24 shrink-0 drop-shadow-xl sm:w-32" />
                <div data-stagger className="grid grid-cols-4 gap-2 sm:gap-4" aria-live="polite">
                  {parts.map((p) => (
                    <div key={p.l} className="rounded-2xl border-2 border-gold bg-secondary px-2 py-3 text-foreground shadow-xl sm:min-w-28 sm:px-5 sm:py-4">
                      <p className="font-display text-3xl font-bold tabular-nums sm:text-5xl">{pad(p.v)}</p>
                      <p className="text-sm sm:text-lg">{p.l}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          <div className="relative mx-auto max-w-6xl px-6 pb-16 pt-24">
            <div data-reveal><Eyebrow light={false}>EXPLORE THE EVENT</Eyebrow></div>
            <div data-stagger className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((c) => (
                <Link key={c.t} to={c.to} search={{ preview }} className="group flex flex-col items-center rounded-3xl border border-gold/60 bg-parchment/90 p-5 text-center text-ink shadow-xl transition hover:-translate-y-2 hover:shadow-[0_20px_50px_-15px_var(--glow)]">
                  <img src={c.img} alt="" loading="lazy" width={512} height={512} className="h-36 w-36 rounded-2xl object-cover mix-blend-multiply transition group-hover:scale-105" />
                  <h3 className="mt-3 font-display text-xl font-bold">{c.t}</h3>
                  <p className="mt-1 text-base text-ink-soft">{c.d}</p>
                  <span className="mt-4 grid h-9 w-9 place-items-center rounded-full bg-secondary text-foreground transition group-hover:bg-accent"><ArrowRight className="h-4 w-4" /></span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </div>
    </Shell>
  );
}
