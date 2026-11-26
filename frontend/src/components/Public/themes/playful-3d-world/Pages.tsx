import { Camera, CheckCircle2, Search, Trophy, XCircle } from "lucide-react";
import trophy from "@/assets/playful/trophy.webp";
import flag from "@/assets/playful/flag.webp";
import calendar from "@/assets/playful/calendar.webp";
import badge from "@/assets/playful/badge.webp";
import { computeStandings, formatTime, groupSchedule } from "@/lib/site-data";
import { QrScanner } from "@/components/shared/QrScanner";
import type { ThemePageProps } from "../themeTypes";
import { useResultsFilter, useVerifyPage } from "../shared/kit";
import { PageHead, Pill, Shell } from "./Shell";

const podium = ["bg-accent", "bg-pop-2", "bg-pop"];
const Empty = ({ children }: { children: string }) => <Pill className="p-10 text-center font-fredoka text-xl font-semibold">{children}</Pill>;

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
      <PageHead title="Results" sub="Select a category and program to view official results." art={trophy} />
      <main className="mx-auto max-w-4xl space-y-6 px-5">
        {/* 2 Dropdowns Section */}
        <Pill className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="playful-category-select" className="block font-fredoka text-sm font-bold text-primary uppercase mb-2">
                1. Select Category
              </label>
              <select
                id="playful-category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-2xl bg-muted px-4 py-3 font-fredoka text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-secondary cursor-pointer"
              >
                <option value="">All Categories ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="playful-program-select" className="block font-fredoka text-sm font-bold text-primary uppercase mb-2">
                2. Select Program
              </label>
              <select
                id="playful-program-select"
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full rounded-2xl bg-muted px-4 py-3 font-fredoka text-sm font-bold text-foreground outline-none focus:ring-4 focus:ring-secondary cursor-pointer"
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
        </Pill>

        {/* Selected Program Results */}
        {!selectedProgram ? (
          <Pill className="p-10 text-center font-fredoka">
            <Trophy className="mx-auto h-12 w-12 text-primary mb-3" />
            <p className="text-xl font-bold text-foreground">Please select a program above to view results.</p>
            <p className="text-sm text-muted-foreground mt-1">Official winners will appear right here.</p>
          </Pill>
        ) : programResults.length === 0 ? (
          <Pill key={selectedProgram.id} className="p-8 text-center font-fredoka">
            <h2 className="text-2xl font-bold">{selectedProgram.name}</h2>
            {selectedProgram.category && <span className="mt-2 inline-block rounded-full bg-secondary px-3 py-0.5 text-xs font-bold text-primary uppercase">{selectedProgram.category}</span>}
            <p className="mt-6 text-muted-foreground text-base">Results for this program have not been officially published yet. Please check back soon!</p>
          </Pill>
        ) : (
          <Pill key={selectedProgram.id} className="p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-muted pb-3">
              <h2 className="font-fredoka text-2xl font-bold">{selectedProgram.name}</h2>
              {selectedProgram.category && <span className="rounded-full bg-secondary px-3 py-0.5 text-xs font-bold text-primary uppercase">{selectedProgram.category}</span>}
            </div>
            <ol className="mt-4 space-y-2">
              {programResults.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-2xl bg-background p-2 pr-4 shadow-sm">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl font-fredoka text-xl font-bold text-primary-foreground shadow-[0_4px_0_rgba(0,0,0,.15)] ${podium[r.position - 1] ?? "bg-primary"}`}>
                    {r.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.participant_name}</span>
                    <span className="text-xs text-muted-foreground">
                      {[r.chest_number && `#${r.chest_number}`, r.team?.name, r.grade && `Grade ${r.grade}`].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <span className="font-fredoka text-lg font-bold text-primary">{r.points} pts</span>
                </li>
              ))}
            </ol>
          </Pill>
        )}
      </main>
    </Shell>
  );
}

export function Standings({ data, preview }: ThemePageProps) {
  const rows = computeStandings(data);
  const max = Math.max(1, ...rows.map((r) => r.points));
  return (
    <Shell data={data} preview={preview}>
      <PageHead title="Team Points" sub="Current standings of every team." art={flag} />
      <main className="mx-auto max-w-4xl space-y-4 px-5">
        {rows.length === 0 && <Empty>Teams will appear here once they are registered.</Empty>}
        {rows.map((r, i) => (
          <Pill key={r.team.id} className="flex items-center gap-4 p-4">
            <span className={`grid h-14 w-14 shrink-0 place-items-center rounded-2xl font-fredoka text-2xl font-bold text-primary-foreground ${podium[i] ?? "bg-primary"}`}>{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-fredoka text-xl font-bold">{r.team.name}</p>
              <div className="mt-2 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ width: `${(r.points / max) * 100}%`, background: r.team.color }} /></div>
            </div>
            <span className="font-fredoka text-3xl font-bold text-primary">{r.points}</span>
          </Pill>
        ))}
      </main>
    </Shell>
  );
}

export function Schedule({ data, preview }: ThemePageProps) {
  const days = groupSchedule(data.programs);
  return (
    <Shell data={data} preview={preview}>
      <PageHead title="Schedule" sub="Every program, stage and hour of the festival." art={calendar} />
      <main className="mx-auto max-w-4xl space-y-10 px-5">
        {days.length === 0 && <Empty>The schedule will be announced soon.</Empty>}
        {days.map(([day, programs]) => (
          <section key={day}>
            <h2 className="inline-block rounded-full bg-primary px-5 py-1.5 font-fredoka text-lg font-bold text-primary-foreground">{day}</h2>
            <div className="mt-4 space-y-3">
              {programs.map((p) => (
                <Pill key={p.id} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center">
                  <span className="w-fit rounded-xl bg-accent px-3 py-1 font-fredoka font-bold text-accent-foreground">{formatTime(p.starts_at)}</span>
                  <span className="flex-1"><span className="block font-fredoka text-xl font-bold">{p.name}</span><span className="text-sm text-muted-foreground">{[p.category, p.venue].filter(Boolean).join(" · ")}</span></span>
                  <span className="w-fit rounded-full bg-secondary px-3 py-0.5 text-xs font-bold text-primary uppercase">{p.status}</span>
                </Pill>
              ))}
            </div>
          </section>
        ))}
      </main>
    </Shell>
  );
}

export function Verify({ data, preview, code, scan: openScan }: ThemePageProps) {
  const v = useVerifyPage(code, openScan, data.event?.id);
  return (
    <Shell data={data} preview={preview}>
      <PageHead title="Verify Badge" sub="Scan a candidate's QR badge or enter the chest number below." art={badge} />
      <main className="mx-auto max-w-xl px-5">
        <Pill className="p-6 sm:p-8 space-y-6">
          {/* 1. Camera Scanner - Open primarily */}
          <div className="space-y-3">
            {v.scan ? (
              <div className="space-y-3">
                <QrScanner onScan={v.onScan} className="overflow-hidden rounded-2xl" />
                <button
                  type="button"
                  onClick={() => v.setScan(false)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-muted py-2.5 font-fredoka text-xs font-semibold text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <Camera className="h-4 w-4" /> Close camera scanner
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => v.setScan(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-3 font-fredoka font-semibold text-accent-foreground cursor-pointer transition-all hover:scale-102 active:scale-98"
              >
                <Camera className="h-4 w-4" /> Open camera scanner
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-muted w-full" />
            <span className="bg-card px-3 text-xs uppercase tracking-widest text-muted-foreground shrink-0 font-fredoka font-bold">
              Or enter chest number manually
            </span>
            <div className="border-t border-muted w-full" />
          </div>

          {/* 2. Manual Chest No Form */}
          <form onSubmit={(e) => { e.preventDefault(); v.run(v.code); }} className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="badge">Chest Number</label>
            <input
              id="badge"
              value={v.code}
              onChange={(e) => v.setCode(e.target.value)}
              placeholder="Enter Chest No (e.g. 1000)"
              className="min-w-0 flex-1 rounded-2xl bg-muted px-4 py-3 font-fredoka text-base tracking-widest uppercase outline-none focus:ring-4 focus:ring-secondary"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-6 py-3 font-fredoka font-semibold text-primary-foreground shadow-[0_4px_0_var(--pop-2)] hover:brightness-110 active:translate-y-1 transition-all cursor-pointer"
            >
              <Search className="h-4 w-4" />
              Verify
            </button>
          </form>

          {/* 3. Verification Result Card */}
          <div className="pt-2" aria-live="polite">
            {v.state.status === "loading" && <p className="text-center font-fredoka">Checking…</p>}
            {v.state.status === "missing" && (
              <p className="flex items-center justify-center gap-2 font-semibold text-destructive">
                <XCircle className="h-5 w-5" /> No candidate found for this chest number.
              </p>
            )}
            {v.state.status === "error" && <p className="text-center text-destructive">{v.state.message}</p>}
            {v.state.status === "found" && (() => {
              const badgeUrl = v.state.badge.badge_url || `/events/${data.event?.id || 2}/badge/${v.state.badge.chest_number || v.code}`;
              return (
                <div className="animate-stamp rounded-3xl bg-pop-3/40 p-6 text-center [transform:none]">
                  <CheckCircle2 className="mx-auto h-12 w-12 text-primary" />
                  <p className="mt-2 text-xs font-bold tracking-widest text-primary uppercase">Verified candidate</p>
                  <p className="font-fredoka text-3xl font-bold">{v.state.badge.full_name}</p>
                  <p className="mt-2 text-muted-foreground">{[v.state.badge.chest_number && `#${v.state.badge.chest_number}`, v.state.badge.team_name, v.state.badge.institution].filter(Boolean).join(" · ")}</p>
                  <div className="mt-4 pt-3 border-t border-primary/20">
                    <a
                      href={badgeUrl}
                      className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 font-fredoka font-bold text-primary-foreground shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    >
                      <span>Click to view your badge</span>
                      <span aria-hidden="true">→</span>
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        </Pill>
      </main>
    </Shell>
  );
}
