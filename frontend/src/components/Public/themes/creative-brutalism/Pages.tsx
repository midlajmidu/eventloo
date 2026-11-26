import { Camera, CheckCircle2, Search, Trophy, XCircle } from "lucide-react";
import { computeStandings, formatTime, groupSchedule } from "@/lib/site-data";
import { QrScanner } from "@/components/shared/QrScanner";
import type { ThemePageProps } from "../themeTypes";
import { useResultsFilter, useVerifyPage } from "../shared/kit";
import { Block, PageHead, Shell } from "./Shell";

const tones = ["bg-pop", "bg-accent", "bg-pop-2", "bg-background"];
const Empty = ({ children }: { children: string }) => <Block className="p-10 text-center font-archivo text-2xl uppercase">{children}</Block>;

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
      <PageHead title="Results" sub="Select a category and program to view official results." />
      <main className="mx-auto max-w-5xl space-y-8 px-5 sm:px-8">
        {/* 2 Dropdowns Section */}
        <Block className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label htmlFor="brutal-category-select" className="block font-bebas text-xl tracking-wider uppercase text-foreground mb-2">
                1. Select Category
              </label>
              <select
                id="brutal-category-select"
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full border-4 border-foreground bg-background px-4 py-3 font-archivo text-lg uppercase outline-none focus:bg-pop cursor-pointer"
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
              <label htmlFor="brutal-program-select" className="block font-bebas text-xl tracking-wider uppercase text-foreground mb-2">
                2. Select Program
              </label>
              <select
                id="brutal-program-select"
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full border-4 border-foreground bg-background px-4 py-3 font-archivo text-lg uppercase outline-none focus:bg-pop cursor-pointer"
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
        </Block>

        {/* Selected Program Results */}
        {!selectedProgram ? (
          <Block className="p-10 text-center">
            <Trophy className="mx-auto h-12 w-12 text-foreground mb-3" />
            <p className="font-bebas text-3xl tracking-wider">Please select a program above to view results.</p>
            <p className="font-mono text-sm mt-1">Official event standings will be rendered here.</p>
          </Block>
        ) : programResults.length === 0 ? (
          <Block key={selectedProgram.id}>
            <div className="border-b-4 border-foreground bg-secondary px-6 py-4 text-secondary-foreground">
              <h2 className="font-anton text-3xl uppercase">{selectedProgram.name}</h2>
              {selectedProgram.category && <span className="font-bebas text-xl tracking-widest text-pop block mt-0.5">{selectedProgram.category}</span>}
            </div>
            <div className="p-8 text-center font-archivo text-xl uppercase text-muted-foreground">
              Results for this program have not been officially published yet. Please check back soon!
            </div>
          </Block>
        ) : (
          <Block key={selectedProgram.id}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b-4 border-foreground bg-secondary px-6 py-4 text-secondary-foreground">
              <h2 className="font-anton text-3xl uppercase">{selectedProgram.name}</h2>
              {selectedProgram.category && <span className="font-bebas text-xl tracking-widest text-pop">{selectedProgram.category}</span>}
            </div>
            <ol>
              {programResults.map((r) => (
                <li key={r.id} className="flex items-center gap-4 border-b-2 border-foreground px-6 py-4 last:border-0">
                  <span className={`grid h-12 w-12 shrink-0 place-items-center border-4 border-foreground font-anton text-2xl ${tones[r.position - 1] ?? "bg-background"}`}>
                    {r.position}
                  </span>
                  <div className="min-w-0 flex-1">
                    <span className="block truncate font-archivo text-xl font-bold">{r.participant_name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {[r.chest_number && `#${r.chest_number}`, r.team?.name, r.grade && `Grade ${r.grade}`].filter(Boolean).join(" / ")}
                    </span>
                  </div>
                  <span className="font-anton text-3xl text-pop">{r.points} PTS</span>
                </li>
              ))}
            </ol>
          </Block>
        )}
      </main>
    </Shell>
  );
}

export function Standings({ data, preview }: ThemePageProps) {
  const rows = computeStandings(data);
  return (
    <Shell data={data} preview={preview}>
      <PageHead title="Points" sub="Current standings of every team." tone="bg-pop" />
      <main className="mx-auto max-w-7xl space-y-4 px-5 sm:px-8">
        {rows.length === 0 && <Empty>Teams will appear here once they are registered.</Empty>}
        {rows.map((r, i) => (
          <div key={r.team.id} className={`flex items-center gap-4 border-4 border-foreground p-4 shadow-[6px_6px_0_var(--foreground)] sm:gap-8 sm:p-5 ${tones[i] ?? "bg-background"}`}>
            <span className="font-anton text-5xl sm:text-7xl">{String(i + 1).padStart(2, "0")}</span>
            <span className="h-10 w-3 border-2 border-foreground" style={{ background: r.team.color }} aria-hidden />
            <span className="min-w-0 flex-1"><span className="block truncate font-archivo text-xl uppercase sm:text-3xl">{r.team.name}</span><span className="font-mono text-sm">{r.firsts} firsts · {r.entries} entries</span></span>
            <span className="font-anton text-5xl sm:text-7xl">{r.points}</span>
          </div>
        ))}
      </main>
    </Shell>
  );
}

export function Schedule({ data, preview }: ThemePageProps) {
  const days = groupSchedule(data.programs);
  return (
    <Shell data={data} preview={preview}>
      <PageHead title="Schedule" sub="Every program, stage and hour of the festival." tone="bg-pop-2" />
      <main className="mx-auto max-w-7xl space-y-12 px-5 sm:px-8">
        {days.length === 0 && <Empty>The schedule will be announced soon.</Empty>}
        {days.map(([day, programs]) => (
          <section key={day}>
            <h2 className="inline-block border-4 border-foreground bg-foreground px-3 font-bebas text-3xl tracking-widest text-background">{day}</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {programs.map((p) => (
                <Block key={p.id} className="p-5">
                  <p className="font-anton text-4xl">{formatTime(p.starts_at)}</p>
                  <h3 className="mt-1 font-archivo text-xl uppercase">{p.name}</h3>
                  <p className="font-mono text-sm">{[p.category, p.venue].filter(Boolean).join(" / ")}</p>
                  <span className="mt-3 inline-block bg-pop px-2 font-bebas text-lg tracking-widest">{p.status}</span>
                </Block>
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
      <PageHead title="Verify" sub="Scan a candidate's QR badge or enter the chest number below." tone="bg-secondary text-secondary-foreground" />
      <main className="mx-auto max-w-2xl px-5 sm:px-8">
        <Block className="p-5 sm:p-8 space-y-6">
          {/* 1. Camera Scanner - Open primarily */}
          <div className="space-y-3">
            {v.scan ? (
              <div className="space-y-3">
                <QrScanner onScan={v.onScan} className="border-4 border-foreground" />
                <button
                  type="button"
                  onClick={() => v.setScan(false)}
                  className="inline-flex w-full items-center justify-center gap-2 border-4 border-foreground bg-pop-2 py-3 font-bebas text-xl tracking-wider text-foreground hover:bg-pop transition-transform cursor-pointer"
                >
                  <Camera className="h-5 w-5" /> Close camera scanner
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => v.setScan(true)}
                className="inline-flex w-full items-center justify-center gap-2 border-4 border-foreground bg-foreground py-3 font-bebas text-2xl tracking-wider text-background hover:bg-accent hover:text-foreground transition-all cursor-pointer"
              >
                <Camera className="h-5 w-5" /> Open camera scanner
              </button>
            )}
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t-4 border-foreground w-full" />
            <span className="bg-background border-2 border-foreground px-3 py-1 text-sm font-bebas tracking-widest uppercase text-foreground shrink-0">
              Or enter chest number manually
            </span>
            <div className="border-t-4 border-foreground w-full" />
          </div>

          {/* 2. Manual Chest No Form */}
          <form onSubmit={(e) => { e.preventDefault(); v.run(v.code); }} className="flex flex-col gap-3 sm:flex-row">
            <label className="sr-only" htmlFor="badge">Chest Number</label>
            <input
              id="badge"
              value={v.code}
              onChange={(e) => v.setCode(e.target.value)}
              placeholder="ENTER CHEST NO (E.G. 1000)"
              className="min-w-0 flex-1 border-4 border-foreground bg-background px-4 py-3 font-archivo text-xl uppercase outline-none focus:bg-pop"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 border-4 border-foreground bg-accent px-6 py-3 font-bebas text-2xl tracking-wider hover:translate-x-1 hover:translate-y-1 transition-transform cursor-pointer"
            >
              <Search className="h-5 w-5" />
              Verify
            </button>
          </form>

          {/* 3. Verification Result Card */}
          <div className="pt-2" aria-live="polite">
            {v.state.status === "loading" && <p className="font-mono text-center">Checking…</p>}
            {v.state.status === "missing" && (
              <p className="flex items-center gap-2 border-4 border-foreground bg-pop-2 p-4 font-archivo">
                <XCircle className="h-6 w-6" /> No candidate found for this chest number.
              </p>
            )}
            {v.state.status === "error" && <p className="border-4 border-foreground bg-pop-2 p-4 font-archivo">{v.state.message}</p>}
            {v.state.status === "found" && (() => {
              const badgeUrl = v.state.badge.badge_url || `/events/${data.event?.id || 2}/badge/${v.state.badge.chest_number || v.code}`;
              return (
                <div className="animate-stamp border-4 border-foreground bg-pop p-6 [transform:rotate(-2deg)]">
                  <p className="flex items-center gap-2 font-bebas text-2xl tracking-widest"><CheckCircle2 /> Verified candidate</p>
                  <p className="font-anton text-5xl uppercase">{v.state.badge.full_name}</p>
                  <p className="mt-2 font-mono">{[v.state.badge.chest_number && `#${v.state.badge.chest_number}`, v.state.badge.team_name, v.state.badge.institution].filter(Boolean).join(" / ")}</p>
                  <div className="mt-4 pt-3 border-t-4 border-foreground">
                    <a
                      href={badgeUrl}
                      className="inline-flex items-center justify-center gap-2 border-4 border-foreground bg-accent px-6 py-2.5 font-bebas text-2xl tracking-wider text-foreground shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] transition-transform hover:translate-x-1 hover:translate-y-1 active:translate-x-2 active:translate-y-2 cursor-pointer"
                    >
                      <span>Click to view your badge</span>
                      <span aria-hidden="true">→</span>
                    </a>
                  </div>
                </div>
              );
            })()}
          </div>
        </Block>
      </main>
    </Shell>
  );
}
