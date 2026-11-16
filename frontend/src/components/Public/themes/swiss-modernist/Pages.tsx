import { Camera, CheckCircle2, Search, Trophy, XCircle } from "lucide-react";
import { computeStandings, formatTime, groupSchedule } from "@/lib/site-data";
import { QrScanner } from "@/components/shared/QrScanner";
import type { ThemePageProps } from "../themeTypes";
import { useResultsFilter, useVerifyPage } from "../shared/kit";
import { PageHead, Shell } from "./Shell";

const Empty = ({ children }: { children: string }) => <p className="border-y border-foreground py-16 text-center text-xl font-semibold">{children}</p>;

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
      <PageHead n="R" title="Results" sub="Select a category and program to view official results." event={data.event?.name} />
      <main className="mx-auto max-w-7xl space-y-8 px-5 sm:px-8">
        {/* 2 Dropdowns Section */}
        <section className="border-2 border-foreground p-6 sm:p-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label htmlFor="swiss-category-select" className="block text-[11px] font-bold tracking-[0.3em] uppercase text-accent mb-2">
                01 / Select Category
              </label>
              <select
                id="swiss-category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border-2 border-foreground bg-transparent px-4 py-3 text-base font-bold tracking-wider uppercase outline-none focus:bg-foreground focus:text-background cursor-pointer"
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
              <label htmlFor="swiss-program-select" className="block text-[11px] font-bold tracking-[0.3em] uppercase text-accent mb-2">
                02 / Select Program
              </label>
              <select
                id="swiss-program-select"
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full border-2 border-foreground bg-transparent px-4 py-3 text-base font-bold tracking-wider uppercase outline-none focus:bg-foreground focus:text-background cursor-pointer"
              >
                <option value="">-- Choose a Program ({availablePrograms.length}) --</option>
                {availablePrograms.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} {p.category ? `(${p.category})` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Selected Program Results */}
        {!selectedProgram ? (
          <div className="border-y border-foreground py-16 text-center">
            <Trophy className="mx-auto h-12 w-12 text-foreground mb-3" />
            <p className="text-2xl font-black tracking-tight">Please select a program above to view results.</p>
            <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground mt-2">Official classifications will be displayed here.</p>
          </div>
        ) : programResults.length === 0 ? (
          <section key={selectedProgram.id} className="border-t-2 border-foreground py-8">
            <h2 className="text-4xl font-black tracking-tight">{selectedProgram.name}</h2>
            {selectedProgram.category && <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase mt-1">{selectedProgram.category}</p>}
            <div className="border-t border-border mt-6 py-12 text-center text-muted-foreground text-lg font-bold uppercase tracking-wider">
              Results for this program have not been officially published yet. Please check back soon!
            </div>
          </section>
        ) : (
          <section key={selectedProgram.id} className="grid gap-6 border-t-2 border-foreground py-8 md:grid-cols-12">
            <div className="md:col-span-4">
              <p className="text-[11px] font-bold tracking-[0.3em] text-accent uppercase">OFFICIAL RESULT</p>
              <h2 className="mt-2 text-4xl font-black tracking-tight">{selectedProgram.name}</h2>
              {selectedProgram.category && <p className="text-xs tracking-[0.25em] text-muted-foreground uppercase mt-1">{selectedProgram.category}</p>}
            </div>
            <ol className="md:col-span-8">
              {programResults.map((r) => (
                <li key={r.id} className="grid grid-cols-[3.5rem_1fr_auto] items-baseline gap-4 border-b border-border py-4">
                  <span className={`text-4xl font-black tracking-tighter ${r.position === 1 ? "text-accent" : ""}`}>{r.position}</span>
                  <div>
                    <span className="block text-xl font-bold">{r.participant_name}</span>
                    <span className="text-xs text-muted-foreground tracking-wider uppercase font-semibold">
                      {[r.chest_number && `#${r.chest_number}`, r.team?.name, r.grade && `Grade ${r.grade}`].filter(Boolean).join(" / ")}
                    </span>
                  </div>
                  <span className="text-lg font-black tabular-nums">{r.points} PTS</span>
                </li>
              ))}
            </ol>
          </section>
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
      <PageHead n="P" title="Points" sub="Current standings of every team." event={data.event?.name} />
      <main className="mx-auto max-w-7xl px-5 sm:px-8">
        {rows.length === 0 ? <Empty>Teams will appear here once they are registered.</Empty> : (
          <ol className="border-t border-foreground">
            {rows.map((r, i) => (
              <li key={r.team.id} className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 border-b border-border py-5 sm:grid-cols-[5rem_1fr_2fr_auto]">
                <span className={`text-5xl font-black tracking-tighter ${i === 0 ? "text-accent" : ""}`}>{String(i + 1).padStart(2, "0")}</span>
                <span><span className="block text-xl font-bold">{r.team.name}</span><span className="text-xs tracking-[0.2em] text-muted-foreground uppercase">{r.firsts} firsts</span></span>
                <span className="hidden h-3 bg-muted sm:block"><span className="block h-full bg-primary" style={{ width: `${(r.points / max) * 100}%` }} /></span>
                <span className="text-4xl font-black tabular-nums tracking-tighter">{r.points}</span>
              </li>
            ))}
          </ol>
        )}
      </main>
    </Shell>
  );
}

export function Schedule({ data, preview }: ThemePageProps) {
  const days = groupSchedule(data.programs);
  return (
    <Shell data={data} preview={preview}>
      <PageHead n="S" title="Schedule" sub="Every program, stage and hour of the festival." event={data.event?.name} />
      <main className="mx-auto max-w-7xl px-5 sm:px-8">
        {days.length === 0 && <Empty>The schedule will be announced soon.</Empty>}
        {days.map(([day, programs]) => (
          <section key={day} className="grid gap-4 border-t border-foreground py-8 md:grid-cols-12">
            <h2 className="text-2xl font-black tracking-tight md:col-span-3">{day}</h2>
            <ul className="md:col-span-9">
              {programs.map((p) => (
                <li key={p.id} className="grid grid-cols-[5.5rem_1fr] gap-4 border-b border-border py-4 sm:grid-cols-[7rem_1fr_auto]">
                  <span className="font-bold tabular-nums">{formatTime(p.starts_at)}</span>
                  <span><span className="block text-lg font-bold">{p.name}</span><span className="text-sm text-muted-foreground">{[p.category, p.venue].filter(Boolean).join(" / ")}</span></span>
                  <span className="col-start-2 w-fit border border-foreground px-2 py-0.5 text-[10px] font-semibold tracking-[0.2em] uppercase sm:col-start-auto sm:self-center">{p.status}</span>
                </li>
              ))}
            </ul>
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
      <PageHead n="V" title="Verify" sub="Scan a candidate's QR badge or enter the chest number below." event={data.event?.name} />
      <main className="mx-auto max-w-2xl px-5 sm:px-8 space-y-8">
        <div className="border-2 border-foreground p-6 sm:p-8 space-y-6">
          {/* 1. Camera Scanner - Open primarily */}
          <div className="space-y-3">
            {v.scan ? (
              <div className="space-y-3">
                <QrScanner onScan={v.onScan} className="border-2 border-foreground" />
                <button
                  type="button"
                  onClick={() => v.setScan(false)}
                  className="inline-flex w-full items-center justify-center gap-2 border-2 border-foreground py-3 font-bold uppercase tracking-wider text-muted-foreground hover:bg-foreground hover:text-background transition-colors cursor-pointer text-xs"
                >
                  <Camera className="h-4 w-4" /> Close camera scanner
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => v.setScan(true)}
                className="inline-flex w-full items-center justify-center gap-2 border-2 border-foreground py-4 font-bold uppercase tracking-wider hover:bg-foreground hover:text-background transition-colors cursor-pointer"
              >
                <Camera className="h-4 w-4" /> Open camera scanner
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t-2 border-foreground w-full" />
            <span className="bg-background px-3 text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground shrink-0">
              Or enter chest number manually
            </span>
            <div className="border-t-2 border-foreground w-full" />
          </div>

          {/* 2. Manual Chest No Form */}
          <form onSubmit={(e) => { e.preventDefault(); v.run(v.code); }} className="flex border-2 border-foreground">
            <label className="sr-only" htmlFor="badge">Chest Number</label>
            <input
              id="badge"
              value={v.code}
              onChange={(e) => v.setCode(e.target.value)}
              placeholder="ENTER CHEST NO (E.G. 1000)"
              className="min-w-0 flex-1 bg-transparent px-4 py-4 text-base font-bold tracking-[0.2em] uppercase outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 bg-primary px-6 font-bold text-primary-foreground hover:bg-accent cursor-pointer transition-colors"
            >
              <Search className="h-4 w-4" />
              Verify
            </button>
          </form>

          {/* 3. Verification Result Card */}
          <div className="pt-2" aria-live="polite">
            {v.state.status === "loading" && <p className="border-t border-foreground pt-4 font-bold text-center">Checking…</p>}
            {v.state.status === "missing" && (
              <p className="flex items-center justify-center gap-2 border-t-4 border-accent pt-4 text-lg font-bold text-accent uppercase">
                <XCircle className="h-5 w-5" /> No candidate found for this chest number.
              </p>
            )}
            {v.state.status === "error" && <p className="border-t-4 border-accent pt-4 font-bold text-accent text-center">{v.state.message}</p>}
            {v.state.status === "found" && (() => {
              const badgeUrl = v.state.badge.badge_url || `/events/${data.event?.id || 2}/badge/${v.state.badge.chest_number || v.code}`;
              return (
                <div className="bg-primary p-8 text-primary-foreground">
                  <p className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.3em] uppercase"><CheckCircle2 className="h-4 w-4 text-accent" /> Verified candidate</p>
                  <p className="mt-4 text-5xl font-black tracking-tight">{v.state.badge.full_name}</p>
                  <p className="mt-3 text-primary-foreground/70">{[v.state.badge.chest_number && `#${v.state.badge.chest_number}`, v.state.badge.team_name, v.state.badge.institution].filter(Boolean).join(" / ")}</p>
                  <div className="mt-4 pt-3 border-t border-primary-foreground/30">
                    <a
                      href={badgeUrl}
                      className="inline-flex items-center justify-center gap-2 border-2 border-primary-foreground bg-transparent px-6 py-2.5 font-bold tracking-[0.2em] uppercase text-primary-foreground transition-colors hover:bg-primary-foreground hover:text-primary active:scale-95 cursor-pointer text-sm"
                    >
                      <span>Click to view your badge</span>
                      <span aria-hidden="true">→</span>
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </main>
    </Shell>
  );
}
