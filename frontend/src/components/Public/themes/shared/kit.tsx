import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { Menu, Settings, X } from "lucide-react";
import { navItems, navSearch } from "../nav";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useVerify } from "@/hooks/use-verify";
import { extractBadgeCode } from "@/components/shared/QrScanner";
import type { SiteData, Program, Result, Team } from "@/lib/site-types";

/** True once the element has scrolled into view (always true with reduced motion). */
export function useInView<T extends HTMLElement>(threshold = 0.2) {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return setSeen(true);
    const io = new IntersectionObserver(([e]) => e?.isIntersecting && (setSeen(true), io.disconnect()), { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen] as const;
}

/** Wrapper that applies `on` classes once visible and `off` classes before. */
export function InView({ children, className = "", off, on, delay = 0, as: Tag = "div" }: { children: ReactNode; className?: string; off: string; on: string; delay?: number; as?: "div" | "li" | "section" }) {
  const [ref, seen] = useInView<HTMLDivElement>();
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} style={{ transitionDelay: `${delay}ms` }} className={`${className} ${seen ? on : off}`}>
      {children}
    </Tag>
  );
}

/** Animates the numeric part of a stat value ("2+", "1,200") once visible; other text is kept as is. */
export function CountUp({ value, className = "" }: { value: string; className?: string }) {
  const [ref, seen] = useInView<HTMLSpanElement>();
  const m = value.match(/^(\D*)([\d,]+)(.*)$/);
  const target = m ? Number(m[2]!.replace(/,/g, "")) : NaN;
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!seen || Number.isNaN(target)) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 1200);
      setN(Math.round(target * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [seen, target]);
  return <span ref={ref} className={className}>{m ? `${m[1]}${seen ? n.toLocaleString() : 0}${m[3]}` : value}</span>;
}

/** Scroll progress of the page (0 at top), for light parallax. */
export function useScrollY(factor = 1) {
  const [y, setY] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const on = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => setY(window.scrollY * factor)); };
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, [factor]);
  return y;
}

export const explore = [
  { key: "results", t: "Live Results", d: "Track program results and winners in real time.", to: "/results" },
  { key: "points", t: "Team Points", d: "Follow your team's performance and standings.", to: "/points-table" },
  { key: "schedule", t: "Event Schedule", d: "Check program timings, venues and updates.", to: "/schedule" },
  { key: "verify", t: "Verify Candidate", d: "Scan QR or enter details to verify participant badges.", to: "/verify-badge" },
] as const;

/** Verify-page state shared by every theme: camera open primarily + manual chest no entry. */
export function useVerifyPage(code?: string, openScan?: boolean, eventId?: string | number) {
  const v = useVerify(code, eventId);
  const [scan, setScan] = useState(openScan !== false);
  useEffect(() => { if (openScan !== undefined) setScan(openScan); }, [openScan]);
  const onScan = useCallback((t: string) => { setScan(false); v.run(extractBadgeCode(t)); }, [v.run]);
  return { ...v, scan, setScan, onScan };
}

export type FilteredProgramResult = Result & { team?: Team };

/** Live results 2-dropdown filter shared by every theme: Category dropdown & Program dropdown */
export function useResultsFilter(data: SiteData) {
  const programs = useMemo(() => data.programs || [], [data.programs]);

  // Extract unique categories from programs
  const categories = useMemo(() => {
    const cats = new Set<string>();
    programs.forEach((p) => {
      if (p.category) cats.add(p.category.trim());
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [programs]);

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProgramId, setSelectedProgramId] = useState<string>("");

  // Filter programs based on selectedCategory
  const availablePrograms = useMemo(() => {
    if (!selectedCategory) return programs;
    return programs.filter(
      (p) => p.category?.toLowerCase() === selectedCategory.toLowerCase()
    );
  }, [programs, selectedCategory]);

  // Selected program object
  const selectedProgram = useMemo(() => {
    if (!selectedProgramId) return null;
    return programs.find((p) => String(p.id) === String(selectedProgramId)) || null;
  }, [programs, selectedProgramId]);

  // Results for the selected program
  const programResults = useMemo<FilteredProgramResult[]>(() => {
    if (!selectedProgram) return [];
    return (data.results || [])
      .filter((r) => String(r.program_id) === String(selectedProgram.id))
      .sort((a, b) => a.position - b.position)
      .map((r) => ({
        ...r,
        team: (data.teams || []).find((t) => String(t.id) === String(r.team_id)),
      }));
  }, [data.results, data.teams, selectedProgram]);

  const handleCategoryChange = (cat: string) => {
    setSelectedCategory(cat);
    // If the currently selected program is not in this new category, reset it
    if (cat && selectedProgramId) {
      const match = programs.find(
        (p) => String(p.id) === String(selectedProgramId) && p.category?.toLowerCase() === cat.toLowerCase()
      );
      if (!match) setSelectedProgramId("");
    }
  };

  const handleProgramChange = (progId: string) => {
    setSelectedProgramId(progId);
    if (progId) {
      const prog = programs.find((p) => String(p.id) === String(progId));
      if (prog?.category && !selectedCategory) {
        setSelectedCategory(prog.category);
      }
    }
  };

  return {
    categories,
    selectedCategory,
    setSelectedCategory: handleCategoryChange,
    availablePrograms,
    selectedProgramId,
    setSelectedProgramId: handleProgramChange,
    selectedProgram,
    programResults,
  };
}

type NavStyle = {
  header: string;
  link: string;
  active: string;
  scan: string;
  settings: string;
  mobile: string;
  mobileLink: string;
  brand: ReactNode;
};

/** Same navigation behaviour for every theme; only the look differs. */
export function ThemeNav({ preview, s }: { preview?: string | undefined; s: NavStyle }) {
  const [open, setOpen] = useState(false);
  const isAdmin = useIsAdmin();
  return (
    <header className={s.header}>
      <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 sm:px-8" aria-label="Main">
        <Link to="/" search={{ preview }} className="flex min-w-0 items-center gap-3">{s.brand}</Link>
        <ul className="hidden items-center gap-5 xl:gap-7 lg:flex">
          {navItems.map((i) => {
            const isScan = "scan" in i;
            return (
              <li key={i.label}>
                <Link to={i.to} search={navSearch(i, preview)} activeOptions={{ exact: true, includeSearch: isScan }}
                  className={isScan ? s.scan : `${s.link} ${s.active}`}>
                  {i.label}
                </Link>
              </li>
            );
          })}
          {isAdmin && (
            <li><Link to="/admin" className={s.settings}><Settings className="h-3.5 w-3.5" /> Settings</Link></li>
          )}
        </ul>
        <button className="p-2 lg:hidden" aria-label={open ? "Close menu" : "Open menu"} aria-expanded={open} onClick={() => setOpen((o) => !o)}>{open ? <X /> : <Menu />}</button>
      </nav>
      {open && (
        <ul className={s.mobile}>
          {navItems.map((i) => (
            <li key={i.label}><Link to={i.to} search={navSearch(i, preview)} onClick={() => setOpen(false)} className={s.mobileLink}>{i.label}</Link></li>
          ))}
          {isAdmin && <li><Link to="/admin" className={s.mobileLink}>Settings</Link></li>}
        </ul>
      )}
    </header>
  );
}
