import React, { useEffect, useState } from 'react';
import { ChevronRight, GraduationCap, Info, Trophy, UsersRound, X } from 'lucide-react';
import { pointsAPI } from '../../services/api';

const score = (value) => Number(value || 0).toFixed(2).replace(/\.00$/, '');

const Modal = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4 backdrop-blur-sm">
    <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
        <h2 className="text-lg font-semibold tracking-tight text-slate-950">{title}</h2>
        <button type="button" onClick={onClose} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-5">{children}</div>
    </div>
  </div>
);

const EventShare = ({ event }) => (
  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
    <div className="flex items-start justify-between gap-4">
      <div>
        <h4 className="text-sm font-semibold text-slate-900">{event.event_name}</h4>
        <p className="mt-1 text-xs text-slate-500">
          {event.event_points} earned ÷ {event.total_event_points} total event points
        </p>
      </div>
      <span className="shrink-0 text-lg font-semibold text-indigo-600">{score(event.percentage)}%</span>
    </div>
    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
      <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.min(Number(event.percentage || 0), 100)}%` }} />
    </div>
  </div>
);

const PointsPage = () => {
  const [leaderboard, setLeaderboard] = useState({ teams: [], students: [] });
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const response = await pointsAPI.getLeaderboard();
        setLeaderboard(response.data);
      } catch (error) {
        console.error('Error fetching global points:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchLeaderboard();
  }, []);

  const openStudent = async (student) => {
    setDetailsLoading(true);
    try {
      const response = await pointsAPI.getStudentDetails(student.id);
      setSelectedStudent(response.data);
    } catch (error) {
      console.error('Error fetching student details:', error);
      window.alert('Failed to load student details.');
    } finally {
      setDetailsLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Performance</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Global Points</h1>
          <p className="mt-1 text-sm text-slate-500">Percentage performance across every published event.</p>
        </header>

        <section className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: 'Ranked teams', value: leaderboard.teams.length, icon: UsersRound, tone: 'bg-indigo-50 text-indigo-600' },
            { label: 'Ranked students', value: leaderboard.students.length, icon: GraduationCap, tone: 'bg-violet-50 text-violet-600' },
            { label: 'Current leader', value: leaderboard.teams[0]?.name || '—', icon: Trophy, tone: 'bg-fuchsia-50 text-fuchsia-600' },
          ].map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-white px-4 py-3.5 shadow-sm">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></div>
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-slate-950">{value}</p>
                <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-4 flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 px-4 py-3.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
          <p className="text-xs leading-5 text-slate-600">
            For each event: earned points ÷ all published points in that event × 100. Those event percentages are added to form the global score.
          </p>
        </section>

        <section className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">Team leaderboard</h2>
              <p className="mt-0.5 text-xs text-slate-500">All official points earned by each team</p>
            </div>
            <div className="divide-y divide-slate-100">
              {leaderboard.teams.length ? leaderboard.teams.map((team, index) => (
                <button key={team.id} type="button" onClick={() => setSelectedTeam(team)} className="group flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${index === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{team.name}</span>
                    <span className="mt-0.5 block text-xs text-slate-400">{team.members} members · {team.events_participated} events</span>
                  </span>
                  <span className="text-sm font-bold text-indigo-600">{score(team.points)}%</span>
                  <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:text-indigo-500" />
                </button>
              )) : <div className="px-6 py-14 text-center text-sm text-slate-400">No published team scores available.</div>}
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-4">
              <h2 className="text-base font-semibold text-slate-950">Top students</h2>
              <p className="mt-0.5 text-xs text-slate-500">Published individual programs only</p>
            </div>
            <div className="divide-y divide-slate-100">
              {leaderboard.students.length ? leaderboard.students.slice(0, 10).map((student, index) => (
                <button key={student.id} type="button" onClick={() => openStudent(student)} disabled={detailsLoading} className="group flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-slate-50 disabled:opacity-60">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${index === 0 ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-100 text-slate-500'}`}>{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-slate-900">{student.name}</span>
                    <span className="mt-0.5 block truncate text-xs text-slate-400">{student.student_id} · {student.category}</span>
                  </span>
                  <span className="text-sm font-bold text-indigo-600">{score(student.points)}%</span>
                  <ChevronRight className="h-4 w-4 text-slate-300 transition group-hover:text-indigo-500" />
                </button>
              )) : <div className="px-6 py-14 text-center text-sm text-slate-400">No published individual scores available.</div>}
            </div>
          </article>
        </section>
      </div>

      {selectedTeam && (
        <Modal title={`${selectedTeam.name} · Event breakdown`} onClose={() => setSelectedTeam(null)}>
          <div className="mb-5 flex items-end justify-between rounded-xl bg-indigo-50 px-4 py-3">
            <div><p className="text-xs font-medium text-indigo-700">Combined global score</p><p className="mt-1 text-xs text-slate-500">Sum of {selectedTeam.events_participated} event percentages</p></div>
            <p className="text-3xl font-semibold text-indigo-700">{score(selectedTeam.points)}%</p>
          </div>
          <div className="space-y-3">{selectedTeam.event_breakdown.map((event) => <EventShare key={event.event_id} event={event} />)}</div>
        </Modal>
      )}

      {selectedStudent && (
        <Modal title={`${selectedStudent.student_name} · Performance`} onClose={() => setSelectedStudent(null)}>
          <div className="mb-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-indigo-50 p-4"><p className="text-xs text-indigo-700">Global score</p><p className="mt-1 text-2xl font-semibold text-indigo-700">{score(selectedStudent.global_percentage)}%</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Raw points earned</p><p className="mt-1 text-2xl font-semibold text-slate-900">{selectedStudent.raw_points}</p></div>
            <div className="rounded-xl bg-slate-50 p-4"><p className="text-xs text-slate-500">Published events</p><p className="mt-1 text-2xl font-semibold text-slate-900">{selectedStudent.events_participated}</p></div>
          </div>
          <div className="space-y-4">
            {selectedStudent.event_breakdown.map((event) => (
              <div key={event.event_id}>
                <EventShare event={event} />
                <div className="mt-2 space-y-1 px-2">
                  {event.programs.map((program) => (
                    <div key={program.program_id} className="flex items-center justify-between gap-4 text-xs text-slate-500">
                      <span>{program.program_name} · position {program.position || '—'} · chest {program.chest_number || '—'}</span>
                      <span className="shrink-0 font-medium text-slate-700">{program.points_earned} points</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </main>
  );
};

export default PointsPage;
