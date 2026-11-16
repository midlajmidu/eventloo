import { useEffect, useState } from "react";
import type { Program, Result, SiteData, Team, EventInfo, BadgeResult } from "./site-types";

export type SiteSearch = { preview?: string | undefined; code?: string | undefined; scan?: boolean | undefined };
export const validateSiteSearch = (s: Record<string, unknown>): SiteSearch => ({
  preview: typeof s["preview"] === "string" ? s["preview"] : undefined,
  code: typeof s["code"] === "string" ? s["code"] : undefined,
  scan: s["scan"] === true || s["scan"] === "1" || s["scan"] === 1 ? true : undefined,
});

export function formatDateRange(start: string | null, end: string | null) {
  if (!start) return "";
  const f = (d: string, y: boolean) => {
    try {
      return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", ...(y ? { year: "numeric" } : {}), timeZone: "UTC" });
    } catch {
      return d;
    }
  };
  if (!end) return f(start, true);
  return `${f(start, false)} – ${f(end, true)}`;
}

export function formatTime(d: string | null) {
  if (!d) return "Time to be announced";
  try {
    return new Date(d).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return d;
  }
}

export type Standing = { team: Team; points: number; firsts: number; entries: number };
export function computeStandings(data: SiteData): Standing[] {
  if (!data?.teams) return [];
  return data.teams
    .map((team) => {
      const rs = (data.results || []).filter((r) => String(r.team_id) === String(team.id));
      const points = team.total_points ?? rs.reduce((s, r) => s + (r.points || 0), 0);
      const firsts = team.first_places ?? rs.filter((r) => r.position === 1).length;
      return { team, points, firsts, entries: rs.length };
    })
    .sort((a, b) => b.points - a.points || b.firsts - a.firsts || a.team.name.localeCompare(b.team.name));
}

export type ProgramResults = { program: Program; results: (Result & { team?: Team | undefined })[] };
export function groupResults(data: SiteData): ProgramResults[] {
  if (!data?.programs) return [];
  return data.programs
    .map((program) => ({
      program,
      results: (data.results || [])
        .filter((r) => String(r.program_id) === String(program.id))
        .sort((a, b) => a.position - b.position)
        .map((r) => ({ ...r, team: (data.teams || []).find((t) => String(t.id) === String(r.team_id)) })),
    }))
    .filter((g) => g.results.length > 0);
}

export function groupSchedule(programs: Program[]) {
  const map = new Map<string, Program[]>();
  for (const p of (programs || [])) {
    const key = p.starts_at
      ? (() => {
          try {
            return new Date(p.starts_at).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
          } catch {
            return "Scheduled Programs";
          }
        })()
      : "To be announced";
    map.set(key, [...(map.get(key) ?? []), p]);
  }
  return [...map.entries()];
}

export function useCountdown(start: string | null) {
  const parseTarget = (s: string | null): number | null => {
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map(Number);
      return new Date(y, m - 1, d, 9, 0, 0).getTime();
    }
    const t = new Date(s).getTime();
    return isNaN(t) ? null : t;
  };

  const target = parseTarget(start);
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const ms = target && now ? Math.max(0, target - now) : 0;
  return {
    enabled: target !== null,
    started: target !== null && now !== null && ms === 0,
    parts: [
      { v: Math.floor(ms / 86400000), l: "Days" },
      { v: Math.floor(ms / 3600000) % 24, l: "Hours" },
      { v: Math.floor(ms / 60000) % 60, l: "Minutes" },
      { v: Math.floor(ms / 1000) % 60, l: "Seconds" },
    ],
  };
}

export const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Maps live Eventloo backend API response to standardized SiteData structure
 */
export function mapEventlooToSiteData(data: any): SiteData {
  if (!data) return { event: null, teams: [], programs: [], results: [] };
  const ev = data.event || data;

  const totalCandidates = data.stats?.total_participants ?? data.stats?.total_candidates ?? 0;
  const totalTeams = data.stats?.total_teams ?? (data.team_standings?.length || 0);
  const totalPrograms = data.stats?.total_programs ?? (data.programs?.length || 0);
  const totalStages = data.stats?.total_stages ?? (data.stages?.length || 0);

  const statsList = [
    { label: "Candidates", value: totalCandidates > 0 ? `${totalCandidates}` : "0" },
    { label: "Teams", value: totalTeams > 0 ? `${totalTeams}` : "0" },
    { label: "Programs", value: totalPrograms > 0 ? `${totalPrograms}` : "0" },
    { label: "Stages", value: totalStages > 0 ? `${totalStages}` : "0" },
  ];

  const teams: Team[] = (data.team_standings || []).map((t: any) => ({
    id: t.team_id,
    name: t.team_name,
    color: "#D97706",
    first_places: t.first_places || 0,
    second_places: t.second_places || 0,
    third_places: t.third_places || 0,
    total_points: t.total_points || 0,
  }));

  const programs: Program[] = (data.programs || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    category: p.category_name || p.category || "General",
    venue: p.stage_name || p.venue || "Campus Venue",
    starts_at: p.start_time || null,
    ends_at: p.end_time || null,
    status: p.is_published ? "Completed" : "Upcoming",
    is_published: p.is_published,
  }));

  // Flatten results from programs
  const results: Result[] = [];
  (data.programs || []).forEach((p: any) => {
    (p.results || []).forEach((r: any, idx: number) => {
      results.push({
        id: `${p.id}-${idx}`,
        program_id: p.id,
        position: r.position || idx + 1,
        participant_name: r.student_name || "Participant",
        team_id: r.team_id || (teams.find((t) => t.name === r.team_name)?.id) || null,
        team_name: r.team_name || "",
        points: r.points || (r.position === 1 ? 10 : r.position === 2 ? 5 : r.position === 3 ? 3 : 1),
        grade: r.grade,
        chest_number: r.chest_number,
      });
    });
  });

  const eventInfo: EventInfo = {
    id: ev.id,
    name: ev.title || ev.name || "Festival",
    theme_title: ev.public_theme_title || "Make It Your Own",
    tagline: ev.tagline || "Explore · Create · Compete",
    description: ev.public_about_text || ev.description || "",
    logo_url: ev.logo || ev.school_logo || null,
    artwork_url: null,
    start_date: ev.start_datetime || ev.start_date || null,
    end_date: ev.end_date || null,
    venue: ev.venue || "Campus Venue",
    organizer: ev.school_name || "Eventloo",
    stats: statsList,
    website_theme: ev.public_theme_color || "enchanted-illustrated",
  };

  return {
    event: eventInfo,
    teams,
    programs,
    results,
  };
}
