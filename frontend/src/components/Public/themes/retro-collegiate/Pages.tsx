import { Camera, CheckCircle2, Search, Trophy, XCircle } from "lucide-react";
import { computeStandings, formatTime, groupSchedule } from "@/lib/site-data";
import { QrScanner } from "@/components/shared/QrScanner";
import type { ThemePageProps } from "../themeTypes";
import { useResultsFilter, useVerifyPage } from "../shared/kit";
import { PageHead, Paper, Shell } from "./Shell";

const ribbon = ["bg-secondary", "bg-primary/15", "bg-accent/25"];
const Empty = ({ children }: { children: string }) => <Paper className="p-10 text-center font-baskerville text-lg italic">{children}</Paper>;

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
      <PageHead title="Live Results" sub="Select a category and program to view official results." event={data.event?.name} />
      <main className="mx-auto max-w-4xl space-y-6 px-5 sm:px-8">
        {/* 2 Dropdowns Section */}
        <Paper className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="retro-category-select" className="block font-oswald text-xs tracking-[0.2em] uppercase font-bold text-primary mb-2">
                1. Select Category
              </label>
              <select
                id="retro-category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full rounded-md border-2 border-primary bg-background px-4 py-3 font-oswald text-sm tracking-wider uppercase text-foreground outline-none focus:ring-2 focus:ring-accent cursor-pointer"
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
              <label htmlFor="retro-program-select" className="block font-oswald text-xs tracking-[0.2em] uppercase font-bold text-primary mb-2">
                2. Select Program
              </label>
              <select
                id="retro-program-select"
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full rounded-md border-2 border-primary bg-background px-4 py-3 font-oswald text-sm tracking-wider uppercase text-foreground outline-none focus:ring-2 focus:ring-accent cursor-pointer"
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
        </Paper>

        {/* Selected Program Results */}
        {!selectedProgram ? (
          <Paper className="p-10 text-center font-baskerville">
            <Trophy className="mx-auto h-12 w-12 text-primary/70 mb-3" />
            <p className="text-xl italic font-bold">Please select a program above to view results.</p>
            <p className="text-sm text-muted-foreground mt-1">Official records will be retrieved for the chosen contest.</p>
          </Paper>
        ) : programResults.length === 0 ? (
          <Paper key={selectedProgram.id} className="overflow-hidden">
            <div className="bg-primary px-5 py-4 text-center text-primary-foreground">
              <h2 className="font-fraunces text-2xl font-black">{selectedProgram.name}</h2>
              {selectedProgram.category && <p className="font-oswald text-xs tracking-[0.3em] text-secondary uppercase mt-0.5">{selectedProgram.category}</p>}
            </div>
            <div className="p-8 text-center font-baskerville italic text-muted-foreground text-lg">
              Results for this program have not been officially published yet. Please check back soon!
            </div>
          </Paper>
        ) : (
          <Paper key={selectedProgram.id} className="overflow-hidden">
            <div className="bg-primary px-5 py-4 text-center text-primary-foreground">
              <h2 className="font-fraunces text-2xl font-black">{selectedProgram.name}</h2>
              {selectedProgram.category && <p className="font-oswald text-xs tracking-[0.3em] text-secondary uppercase mt-0.5">{selectedProgram.category}</p>}
            </div>
            <ol className="p-5">
              {programResults.map((r) => (
                <li key={r.id} className={`mb-2.5 flex items-center gap-3.5 rounded-md px-3.5 py-2.5 ${ribbon[r.position - 1] ?? "border border-border"}`}>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-primary bg-card font-fraunces text-xl font-black">
                    {r.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-fraunces text-lg font-bold">{r.participant_name}</span>
                    <span className="text-xs text-muted-foreground font-oswald tracking-wide uppercase">
                      {[r.chest_number && `#${r.chest_number}`, r.team?.name, r.grade && `Grade ${r.grade}`].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <span className="font-oswald text-xl font-bold">{r.points} pts</span>
                </li>
              ))}
            </ol>
          </Paper>
        )}
      </main>
    </Shell>
  );
}

export function Standings({ data, preview }: ThemePageProps) {
  const rows = computeStandings(data);
  return (
    <Shell data={data} preview={preview}>
      <PageHead title="Points Table" sub="Current standings of every team." event={data.event?.name} />
      <main className="mx-auto max-w-4xl px-5 sm:px-8">
        {rows.length === 0 ? <Empty>Teams will appear here once they are registered.</Empty> : (
          <div className="overflow-x-auto rounded-xl border-4 border-accent bg-primary text-primary-foreground shadow-[8px_8px_0_var(--accent)]">
            <table className="w-full min-w-[460px] text-left">
              <thead className="font-oswald text-xs tracking-[0.3em] text-secondary uppercase"><tr className="border-b border-primary-foreground/20"><th className="p-4">Rank</th><th className="p-4">Team</th><th className="p-4 text-right">Firsts</th><th className="p-4 text-right">Points</th></tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.team.id} className="border-b border-primary-foreground/10 last:border-0">
                    <td className="p-4 font-oswald text-3xl font-bold text-secondary">{i + 1}</td>
                    <td className="p-4 font-fraunces text-xl font-bold"><span className="mr-2 inline-block h-3 w-3 rotate-45" style={{ background: r.team.color }} />{r.team.name}</td>
                    <td className="p-4 text-right font-oswald">{r.firsts}</td>
                    <td className="p-4 text-right"><span className="inline-block min-w-16 rounded bg-background/10 px-2 text-center font-oswald text-3xl font-bold tabular-nums">{r.points}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </Shell>
  );
}

export function Schedule({ data, preview }: ThemePageProps) {
  const days = groupSchedule(data.programs);
  return (
    <Shell data={data} preview={preview}>
      <PageHead title="Schedule" sub="Every program, stage and hour of the festival." event={data.event?.name} />
      <main className="mx-auto max-w-4xl space-y-12 px-5 sm:px-8">
        {days.length === 0 && <Empty>The schedule will be announced soon.</Empty>}
        {days.map(([day, programs]) => (
          <section key={day}>
            <h2 className="mx-auto w-fit bg-accent px-8 py-1 font-oswald text-xl font-semibold tracking-[0.25em] text-accent-foreground uppercase [clip-path:polygon(0_0,100%_0,95%_50%,100%_100%,0_100%,5%_50%)]">{day}</h2>
            <Paper className="mt-5 divide-y-2 divide-dashed divide-primary/30">
              {programs.map((p) => (
                <div key={p.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-center sm:gap-6">
                  <span className="font-oswald text-2xl font-bold text-accent sm:w-28">{formatTime(p.starts_at)}</span>
                  <span className="flex-1"><span className="block font-fraunces text-xl font-bold">{p.name}</span><span className="font-baskerville text-sm italic text-muted-foreground">{[p.category, p.venue].filter(Boolean).join(" · ")}</span></span>
                  <span className="w-fit rounded-full border-2 border-primary px-3 font-oswald text-xs tracking-[0.2em] uppercase">{p.status}</span>
                </div>
              ))}
            </Paper>
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
      <PageHead title="Verify Badge" sub="Scan a candidate's QR badge or enter the chest number below." event={data.event?.name} />
      <main className="mx-auto max-w-xl px-5">
        <Paper className="p-6 sm:p-8 space-y-6">
          {/* 1. Camera Scanner - Open primarily */}
          <div className="space-y-3">
            {v.scan ? (
              <div className="space-y-3">
                <QrScanner onScan={v.onScan} className="rounded-md border-2 border-primary" />
                <button
                  type="button"
                  onClick={() => v.setScan(false)}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-md border-2 border-primary py-2.5 font-oswald text-xs tracking-wider uppercase text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                  <Camera className="h-4 w-4" /> Close camera scanner
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => v.setScan(true)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-md border-2 border-primary bg-secondary/40 py-3 font-oswald text-sm tracking-wider uppercase text-foreground hover:bg-secondary cursor-pointer transition-colors"
              >
                <Camera className="h-4 w-4" /> Open camera scanner
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t-2 border-primary/20 w-full" />
            <span className="bg-card px-3 text-xs uppercase tracking-widest text-muted-foreground shrink-0 font-oswald font-bold">
              Or enter chest number manually
            </span>
            <div className="border-t-2 border-primary/20 w-full" />
          </div>

          {/* 2. Manual Chest No Form */}
          <form onSubmit={(e) => { e.preventDefault(); v.run(v.code); }} className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="badge">Chest Number</label>
            <input
              id="badge"
              value={v.code}
              onChange={(e) => v.setCode(e.target.value)}
              placeholder="Enter Chest No (e.g. 1000)"
              className="min-w-0 flex-1 rounded-md border-2 border-primary bg-background px-4 py-3 font-oswald text-base tracking-[0.2em] uppercase outline-none focus:ring-2 focus:ring-accent"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-6 py-3 font-oswald font-semibold tracking-wider text-accent-foreground uppercase hover:opacity-90 active:scale-95 transition-all cursor-pointer shadow-sm"
            >
              <Search className="h-4 w-4" />
              Verify
            </button>
          </form>

          {/* 3. Verification Result Card */}
          <div className="pt-2" aria-live="polite">
            {v.state.status === "loading" && <p className="text-center font-baskerville italic">Checking the register…</p>}
            {v.state.status === "missing" && (
              <p className="flex items-center justify-center gap-2 text-accent font-semibold font-oswald tracking-wide">
                <XCircle className="h-5 w-5" /> No candidate found for this chest number.
              </p>
            )}
            {v.state.status === "error" && <p className="text-center text-accent">{v.state.message}</p>}
            {v.state.status === "found" && (() => {
              const badgeUrl = v.state.badge.badge_url || `/events/${data.event?.id || 2}/badge/${v.state.badge.chest_number || v.code}`;
              return (
                <div className="relative rounded-md border-2 border-primary bg-background p-6 text-center">
                  <span className="absolute -right-3 -top-4 animate-stamp rounded-sm border-[3px] border-double border-accent bg-card px-3 py-1 font-oswald text-sm font-bold tracking-[0.2em] text-accent">VERIFIED</span>
                  <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
                  <p className="mt-2 font-fraunces text-3xl font-black">{v.state.badge.full_name}</p>
                  <p className="mt-2 text-muted-foreground">{[v.state.badge.chest_number && `#${v.state.badge.chest_number}`, v.state.badge.team_name, v.state.badge.institution].filter(Boolean).join(" · ")}</p>
                  <div className="mt-4 pt-3 border-t-2 border-primary/20">
                    <a
                      href={badgeUrl}
                      className="inline-flex items-center justify-center gap-2 rounded-md border-2 border-accent bg-accent px-6 py-2.5 font-oswald text-sm font-bold tracking-wider text-accent-foreground shadow-sm transition-all hover:opacity-90 active:scale-95 cursor-pointer uppercase"
                    >
                      <span>Click to view your badge</span>
                      <span aria-hidden="true">→</span>
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        </Paper>
      </main>
    </Shell>
  );
}
