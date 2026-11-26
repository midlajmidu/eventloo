import { useCallback, useEffect, useState } from "react";
import { Camera, CheckCircle2, Search, Trophy, XCircle } from "lucide-react";
import { computeStandings, formatTime, groupSchedule } from "@/lib/site-data";
import { useVerify } from "@/hooks/use-verify";
import { useResultsFilter } from "../shared/kit";
import { QrScanner, extractBadgeCode } from "@/components/shared/QrScanner";
import type { ThemePageProps } from "../themeTypes";
import { Parchment, SceneBanner, Shell } from "./Shell";

const medal = ["text-gold", "text-ink-soft", "text-accent"];

function Empty({ children }: { children: string }) {
  return <Parchment className="text-center text-lg">{children}</Parchment>;
}

export function Results({ data, preview }: ThemePageProps) {
  const {
    categories,
    selectedCategory,
    setSelectedCategory,
    availablePrograms,
    selectedProgramId,
    setSelectedProgramId,
    selectedProgram,
    programResults,
  } = useResultsFilter(data);

  return (
    <Shell data={data} preview={preview}>
      <SceneBanner eyebrow={data.event?.name} title="Live Results" subtitle="Select a category and program to view official results." />
      <main className="mx-auto max-w-4xl space-y-6 px-6 pb-10">
        {/* 2 Dropdowns Filter Section */}
        <Parchment className="p-4 sm:p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Dropdown 1: Category */}
            <div>
              <label htmlFor="category-select" className="block font-display text-xs tracking-widest text-ink-soft uppercase mb-2">
                1. Select Category
              </label>
              <select
                id="category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-xl border border-gold/60 bg-parchment px-4 py-3 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-gold cursor-pointer"
              >
                <option value="">All Categories ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Dropdown 2: Program */}
            <div>
              <label htmlFor="program-select" className="block font-display text-xs tracking-widest text-ink-soft uppercase mb-2">
                2. Select Program
              </label>
              <select
                id="program-select"
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full rounded-xl border border-gold/60 bg-parchment px-4 py-3 text-sm font-semibold text-ink outline-none focus:ring-2 focus:ring-gold cursor-pointer"
              >
                <option value="">-- Choose a Program ({availablePrograms.length}) --</option>
                {availablePrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.category ? `(${p.category})` : ""}{p.is_published ? " (Published)" : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Parchment>

        {/* Selected Program Results or Guidance */}
        {!selectedProgram ? (
          <Parchment className="text-center py-12 text-ink-soft font-display">
            <Trophy className="mx-auto h-12 w-12 text-gold/60 mb-3" />
            <p className="text-lg">Please select a program above to view results.</p>
            <p className="text-xs text-ink-soft/70 mt-1">Winners will be displayed once a program is selected.</p>
          </Parchment>
        ) : programResults.length === 0 ? (
          <Parchment key={selectedProgram.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gold/40 pb-3">
              <h2 className="font-display text-2xl font-bold">{selectedProgram.name}</h2>
              {selectedProgram.category && <span className="text-sm tracking-widest text-ink-soft uppercase">{selectedProgram.category}</span>}
            </div>
            <div className="text-center py-8 text-ink-soft italic font-display">
              Results for this program have not been officially published yet. Please check back soon!
            </div>
          </Parchment>
        ) : (
          <Parchment key={selectedProgram.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gold/40 pb-3">
              <h2 className="font-display text-2xl font-bold">{selectedProgram.name}</h2>
              {selectedProgram.category && <span className="text-sm tracking-widest text-ink-soft uppercase">{selectedProgram.category}</span>}
            </div>
            <ol className="mt-4 space-y-3">
              {programResults.map((r) => (
                <li key={r.id} className="flex items-center gap-4">
                  <span className={`font-display text-3xl font-bold ${medal[r.position - 1] ?? "text-ink-soft"}`}>{r.position}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-lg font-semibold">{r.participant_name}</p>
                    <p className="text-sm text-ink-soft">
                      {[r.chest_number && `#${r.chest_number}`, r.team?.name, r.grade && `Grade ${r.grade}`].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  <span className="font-display font-bold text-secondary">{r.points} pts</span>
                </li>
              ))}
            </ol>
          </Parchment>
        )}
      </main>
    </Shell>
  );
}

export function Standings({ data, preview }: ThemePageProps) {
  const rows = computeStandings(data);
  return (
    <Shell data={data} preview={preview}>
      <SceneBanner eyebrow={data.event?.name} title="Points Table" subtitle="The standings of every team on the path of knowledge." />
      <main className="mx-auto max-w-4xl px-6 pb-10">
        {rows.length === 0 ? (
          <Empty>Teams will appear here once they are registered.</Empty>
        ) : (
          <Parchment className="overflow-x-auto p-0 sm:p-0">
            <table className="w-full min-w-[480px] text-left">
              <thead className="font-display text-sm tracking-widest text-ink-soft">
                <tr className="border-b border-gold/40"><th className="p-4">Rank</th><th className="p-4">Team</th><th className="p-4 text-right">Firsts</th><th className="p-4 text-right">Points</th></tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.team.id} className="border-b border-gold/20 last:border-0">
                    <td className={`p-4 font-display text-2xl font-bold ${medal[i] ?? ""}`}>{i + 1}</td>
                    <td className="p-4 text-lg font-semibold"><span className="mr-2 inline-block h-3 w-3 rounded-full" style={{ background: r.team.color }} />{r.team.name}</td>
                    <td className="p-4 text-right">{r.firsts}</td>
                    <td className="p-4 text-right font-display text-2xl font-bold">{r.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Parchment>
        )}
      </main>
    </Shell>
  );
}

export function Schedule({ data, preview }: ThemePageProps) {
  const days = groupSchedule(data.programs);
  return (
    <Shell data={data} preview={preview}>
      <SceneBanner eyebrow={data.event?.name} title="Event Schedule" subtitle="Every program, stage and hour of the festival." />
      <main className="mx-auto max-w-4xl space-y-10 px-6 pb-10">
        {days.length === 0 && <Empty>The schedule will be announced soon.</Empty>}
        {days.map(([day, programs]) => (
          <section key={day}>
            <h2 className="mb-4 text-center font-display text-sm font-semibold tracking-[0.35em] text-gold">✦ {day.toUpperCase()} ✦</h2>
            <div className="space-y-3">
              {programs.map((p) => (
                <Parchment key={p.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div>
                    <h3 className="font-display text-xl font-bold">{p.name}</h3>
                    <p className="text-ink-soft">{[p.category, p.venue].filter(Boolean).join(" · ")}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="font-semibold">{formatTime(p.starts_at)}</p>
                    <span className="mt-1 inline-block rounded-full bg-secondary px-3 py-0.5 text-xs font-semibold tracking-wider text-foreground uppercase">{p.status}</span>
                  </div>
                </Parchment>
              ))}
            </div>
          </section>
        ))}
      </main>
    </Shell>
  );
}

export function Verify({ data, preview, code, scan: openScan }: ThemePageProps) {
  const v = useVerify(code, data.event?.id);
  const [scan, setScan] = useState(openScan !== false);
  useEffect(() => { if (openScan !== undefined) setScan(openScan); }, [openScan]);
  const onScan = useCallback((t: string) => { setScan(false); v.run(extractBadgeCode(t)); }, [v.run]);

  return (
    <Shell data={data} preview={preview}>
      <SceneBanner eyebrow={data.event?.name} title="Verify Badge" subtitle="Scan a candidate's QR badge or enter the chest number below." />
      <main className="mx-auto max-w-xl px-6 pb-10">
        <Parchment className="space-y-6">
          {/* 1. Camera Scanner - Open primarily */}
          <div className="space-y-3">
            {scan ? (
              <div className="space-y-3">
                <QrScanner onScan={onScan} className="rounded-2xl" />
                <button
                  type="button"
                  onClick={() => setScan(false)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gold/60 py-2.5 text-xs font-semibold text-ink-soft hover:text-ink cursor-pointer transition-colors"
                >
                  <Camera className="h-4 w-4" /> Close camera scanner
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setScan(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-gold/60 bg-parchment-deep/30 px-5 py-3 font-semibold text-ink hover:bg-parchment-deep/60 cursor-pointer transition-colors"
              >
                <Camera className="h-4 w-4" /> Open camera scanner
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-gold/40 w-full" />
            <span className="bg-parchment px-3 text-xs uppercase tracking-widest text-ink-soft shrink-0">
              Or enter chest number manually
            </span>
            <div className="border-t border-gold/40 w-full" />
          </div>

          {/* 2. Manual Chest No Form */}
          <form onSubmit={(e) => { e.preventDefault(); v.run(v.code); }} className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="badge">Chest Number</label>
            <input
              id="badge"
              value={v.code}
              onChange={(e) => v.setCode(e.target.value)}
              placeholder="Enter Chest No (e.g. 1000)"
              className="min-w-0 flex-1 rounded-xl border border-gold/60 bg-background/0 px-4 py-3 text-base uppercase tracking-widest text-ink outline-none focus:ring-2 focus:ring-gold"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-secondary px-6 py-3 font-semibold text-foreground cursor-pointer shadow-md hover:brightness-110 active:scale-95 transition-all"
            >
              <Search className="h-4 w-4" />
              Verify
            </button>
          </form>

          {/* 3. Verification Result Card */}
          <div className="pt-2" aria-live="polite">
            {v.state.status === "loading" && <p className="text-center font-display text-ink-soft">Consulting the records…</p>}
            {v.state.status === "missing" && (
              <p className="flex items-center justify-center gap-2 text-destructive font-semibold">
                <XCircle className="h-5 w-5" /> No candidate found for this chest number.
              </p>
            )}
            {v.state.status === "error" && <p className="text-center text-destructive">{v.state.message}</p>}
            {v.state.status === "found" && (() => {
              const badgeUrl = v.state.badge.badge_url || `/events/${data.event?.id || 2}/badge/${v.state.badge.chest_number || v.code}`;
              return (
                <div className="rounded-xl border-2 border-gold bg-parchment-deep/40 p-5 text-center">
                  <CheckCircle2 className="mx-auto h-10 w-10 text-secondary" />
                  <p className="mt-2 font-display text-sm tracking-widest">VERIFIED CANDIDATE</p>
                  <p className="mt-1 font-display text-3xl font-bold">{v.state.badge.full_name}</p>
                  <p className="mt-2 text-ink-soft">{[v.state.badge.chest_number && `#${v.state.badge.chest_number}`, v.state.badge.team_name, v.state.badge.institution].filter(Boolean).join(" · ")}</p>
                  <div className="mt-4 pt-3 border-t border-gold/30">
                    <a
                      href={badgeUrl}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 via-amber-600 to-amber-700 px-5 py-2.5 font-display text-sm font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:shadow-lg active:scale-95 cursor-pointer"
                    >
                      <span>Click to view your badge</span>
                      <span aria-hidden="true">→</span>
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        </Parchment>
      </main>
    </Shell>
  );
}
