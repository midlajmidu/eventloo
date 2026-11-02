import React, { useState, useEffect, useMemo } from 'react';
import { teamManagerAPI } from '../../services/api';
import {
  Trophy,
  Medal,
  Users,
  Award,
  BarChart3,
  Activity,
  ChevronRight,
  GraduationCap,
  X,
  Star,
  Calendar,
  Globe,
  Search,
  Filter,
  Layers,
  Info,
  TrendingUp,
  Percent
} from 'lucide-react';

const scoreFormat = (value) => Number(value || 0).toFixed(2).replace(/\.00$/, '');

const TeamManagerPoints = () => {
  const [myTeams, setMyTeams] = useState([]);
  const [leaderboard, setLeaderboard] = useState({ teams: [], students: [], events: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // View modes: 'global' (Global Points System) or 'event_wise' (Event-Wise Points & Rankings)
  const [viewMode, setViewMode] = useState('global');

  // Global tab: 'teams' | 'students'
  const [activeGlobalTab, setActiveGlobalTab] = useState('teams');
  const [globalSearch, setGlobalSearch] = useState('');

  // Event-wise state: 'all' (matrix) or specific event id
  const [selectedEventId, setSelectedEventId] = useState('all');
  const [activeEventTab, setActiveEventTab] = useState('teams'); // 'teams' | 'students'
  const [eventSearch, setEventSearch] = useState('');

  // Breakdown modal
  const [selectedTeamBreakdown, setSelectedTeamBreakdown] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [teamsResponse, leaderboardResponse] = await Promise.all([
        teamManagerAPI.getMyTeams().catch((err) => {
          console.warn('My teams error in points:', err);
          return { data: [] };
        }),
        teamManagerAPI.getLeaderboard().catch((err) => {
          console.warn('Leaderboard error in points:', err);
          return { data: { teams: [], students: [], events: [] } };
        }),
      ]);

      const rawTeams = teamsResponse?.data;
      const teamsList = Array.isArray(rawTeams) ? rawTeams : (rawTeams?.results || []);
      setMyTeams(teamsList);
      setLeaderboard(leaderboardResponse?.data || { teams: [], students: [], events: [] });
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load points and ranking data');
    } finally {
      setLoading(false);
    }
  };

  const teamsList = Array.isArray(myTeams) ? myTeams : (myTeams?.results || []);
  const leaderboardTeams = Array.isArray(leaderboard?.teams) ? leaderboard.teams : [];
  const leaderboardStudents = Array.isArray(leaderboard?.students) ? leaderboard.students : [];
  const eventsList = Array.isArray(leaderboard?.events) ? leaderboard.events : [];

  const managedTeamIds = useMemo(() => {
    return new Set(teamsList.map((t) => t.id || t.team_id));
  }, [teamsList]);

  const activeManagedTeam = teamsList[0] || {};
  const activeTeamName = activeManagedTeam.name || activeManagedTeam.team_name || 'My Team';

  // Calculate managed team's standing in global ranking
  const myTeamGlobalRank = useMemo(() => {
    const found = leaderboardTeams.find((t) => managedTeamIds.has(t.id));
    return found ? found.rank : (leaderboardTeams.length > 0 ? 1 : '—');
  }, [leaderboardTeams, managedTeamIds]);

  const totalGlobalPoints = useMemo(() => {
    const found = leaderboardTeams.find((t) => managedTeamIds.has(t.id));
    if (found) return found.points ?? found.global_points ?? 0;
    return teamsList.reduce((sum, t) => sum + (t.global_points || t.points_earned || 0), 0);
  }, [leaderboardTeams, managedTeamIds, teamsList]);

  const totalRawPoints = useMemo(() => {
    const found = leaderboardTeams.find((t) => managedTeamIds.has(t.id));
    if (found && found.total_raw_points !== undefined) return found.total_raw_points;
    return 0;
  }, [leaderboardTeams, managedTeamIds]);

  // Active selected event object if an event is chosen
  const currentSelectedEvent = useMemo(() => {
    if (selectedEventId === 'all') return null;
    return eventsList.find((e) => String(e.id) === String(selectedEventId)) || null;
  }, [eventsList, selectedEventId]);

  // Filtered lists for Global View
  const filteredGlobalTeams = useMemo(() => {
    if (!globalSearch.trim()) return leaderboardTeams;
    const q = globalSearch.trim().toLowerCase();
    return leaderboardTeams.filter((t) => t.name?.toLowerCase().includes(q));
  }, [leaderboardTeams, globalSearch]);

  const filteredGlobalStudents = useMemo(() => {
    if (!globalSearch.trim()) return leaderboardStudents;
    const q = globalSearch.trim().toLowerCase();
    return leaderboardStudents.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.student_id?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
    );
  }, [leaderboardStudents, globalSearch]);

  // Filtered lists for Event-Wise View
  const filteredEventTeams = useMemo(() => {
    if (!currentSelectedEvent) return [];
    const list = currentSelectedEvent.teams || [];
    if (!eventSearch.trim()) return list;
    const q = eventSearch.trim().toLowerCase();
    return list.filter((t) => t.name?.toLowerCase().includes(q));
  }, [currentSelectedEvent, eventSearch]);

  const filteredEventStudents = useMemo(() => {
    if (!currentSelectedEvent) return [];
    const list = currentSelectedEvent.students || [];
    if (!eventSearch.trim()) return list;
    const q = eventSearch.trim().toLowerCase();
    return list.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) ||
        s.student_id?.toLowerCase().includes(q) ||
        s.category?.toLowerCase().includes(q)
    );
  }, [currentSelectedEvent, eventSearch]);

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 mx-auto" />
          <p className="mt-3 text-sm font-medium text-slate-500">Loading standings & points...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb] px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <Activity className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">Unable to load points</h2>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* ========================================================================= */}
        {/* 1. HEADER */}
        {/* ========================================================================= */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Performance & Standings
            </p>
            <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Points & Leaderboard
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Championship ranking and points tables for{' '}
              <span className="font-semibold text-slate-700">{activeTeamName}</span>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs">
              <Trophy className="h-3.5 w-3.5 text-indigo-600" />
              <span>{scoreFormat(totalGlobalPoints)} Championship Pts</span>
            </div>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. MODE SELECTOR (Global Points vs Event-Wise Points) */}
        {/* ========================================================================= */}
        <section className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200/80 pb-4">
          <div className="grid grid-cols-2 sm:inline-flex rounded-2xl border border-slate-200 bg-white p-1 shadow-2xs w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setViewMode('global')}
              className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs font-semibold transition-all ${
                viewMode === 'global'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Globe className="h-4 w-4 shrink-0" />
              <span className="truncate">Global System</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('event_wise')}
              className={`inline-flex min-h-[40px] items-center justify-center gap-2 rounded-xl px-3 sm:px-4 py-2 text-xs font-semibold transition-all ${
                viewMode === 'event_wise'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Calendar className="h-4 w-4 shrink-0" />
              <span className="truncate">Event Rankings</span>
              {eventsList.length > 0 && (
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                    viewMode === 'event_wise' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {eventsList.length}
                </span>
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
            <span>Official Published Scores</span>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3A. GLOBAL POINTS SYSTEM VIEW */}
        {/* ========================================================================= */}
        {viewMode === 'global' && (
          <div className="mt-6 space-y-6">
            {/* Global Summary Metrics */}
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3 sm:px-3.5 sm:py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                  <Trophy className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900">{scoreFormat(totalGlobalPoints)}</p>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">Global Score (%)</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3 sm:px-3.5 sm:py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                  <Medal className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900">Rank #{myTeamGlobalRank}</p>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    of {leaderboardTeams.length || 1} Teams
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3 sm:px-3.5 sm:py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                  <TrendingUp className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900">{totalRawPoints} pts</p>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">Raw Points</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white p-3 sm:px-3.5 sm:py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
                  <Calendar className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold text-slate-900">{eventsList.length} Festivals</p>
                  <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">Published</p>
                </div>
              </div>
            </div>

            {/* Explanation Notice */}
            <div className="flex items-start gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4 text-xs text-slate-600">
              <Info className="h-4 w-4 shrink-0 text-indigo-600 mt-0.5" />
              <div>
                <p className="font-semibold text-indigo-900">Global Points Championship Calculation</p>
                <p className="mt-0.5">
                  In every published event: <code>earned points ÷ total published event points × 100</code> gives that event’s percentage. The sum of these percentages across all events yields each team’s final Global Championship score.
                </p>
              </div>
            </div>

            {/* Global Standings Table Card */}
            <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
              <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => setActiveGlobalTab('teams')}
                    className={`min-h-[38px] flex items-center justify-center px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      activeGlobalTab === 'teams'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Teams ({leaderboardTeams.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveGlobalTab('students')}
                    className={`min-h-[38px] flex items-center justify-center px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                      activeGlobalTab === 'students'
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>Students ({leaderboardStudents.length})</span>
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    placeholder={`Search ${activeGlobalTab}...`}
                    value={globalSearch}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    className="h-10 sm:h-8.5 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-1 focus:ring-indigo-100"
                  />
                </div>
              </div>

              {/* Global Teams Dual-View */}
              {activeGlobalTab === 'teams' && (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-50/80">
                        <tr>
                          {['Rank', 'Team', 'Roster', 'Events Entered', 'Raw Points', 'Global Championship Score'].map((label) => (
                            <th
                              key={label}
                              className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 ${
                                label.includes('Score') || label.includes('Points') ? 'text-right' : 'text-left'
                              }`}
                            >
                              {label}
                            </th>
                          ))}
                          <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Breakdown
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredGlobalTeams.length === 0 ? (
                          <tr>
                            <td colSpan="7" className="py-12 text-center text-xs text-slate-400">
                              No teams found matching search.
                            </td>
                          </tr>
                        ) : (
                          filteredGlobalTeams.map((team, idx) => {
                            const rankNum = team.rank || idx + 1;
                            const isMyTeam = managedTeamIds.has(team.id) || team.is_managed;

                            return (
                              <tr
                                key={team.id || idx}
                                className={`transition-colors ${
                                  isMyTeam ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-slate-50'
                                }`}
                              >
                                <td className="whitespace-nowrap px-5 py-3.5">
                                  <div className="flex items-center gap-1.5">
                                    <span
                                      className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                                        rankNum === 1
                                          ? 'bg-amber-100 text-amber-800'
                                          : rankNum === 2
                                            ? 'bg-slate-200 text-slate-700'
                                            : rankNum === 3
                                              ? 'bg-amber-50 text-amber-700'
                                              : 'bg-slate-100 text-slate-600'
                                      }`}
                                    >
                                      {rankNum}
                                    </span>
                                    {rankNum === 1 && <Medal className="h-4 w-4 text-amber-500" />}
                                  </div>
                                </td>

                                <td className="whitespace-nowrap px-5 py-3.5">
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-slate-900">{team.name}</p>
                                    {isMyTeam && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                                        Your Team
                                      </span>
                                    )}
                                  </div>
                                </td>

                                <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-600">
                                  {team.members || 10} members
                                </td>

                                <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-600">
                                  {team.events_participated || (team.event_breakdown ? team.event_breakdown.length : 1)} festivals
                                </td>

                                <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-xs text-slate-600">
                                  {team.total_raw_points ?? '—'} pts
                                </td>

                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                  <span className="text-sm font-bold text-slate-900">
                                    {scoreFormat(team.points ?? team.global_points ?? 0)}
                                  </span>
                                  <span className="ml-1 text-xs text-slate-400">pts</span>
                                </td>

                                <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                  <button
                                    type="button"
                                    onClick={() => setSelectedTeamBreakdown(team)}
                                    className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                                  >
                                    <span>View Events</span>
                                    <ChevronRight className="h-3 w-3" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Native Cards */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {filteredGlobalTeams.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-400">
                        No teams found matching search.
                      </div>
                    ) : (
                      filteredGlobalTeams.map((team, idx) => {
                        const rankNum = team.rank || idx + 1;
                        const isMyTeam = managedTeamIds.has(team.id) || team.is_managed;

                        return (
                          <div key={team.id || idx} className={`p-4 space-y-3 ${isMyTeam ? 'bg-indigo-50/30' : ''}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2.5">
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                                    rankNum === 1
                                      ? 'bg-amber-100 text-amber-800'
                                      : rankNum === 2
                                        ? 'bg-slate-200 text-slate-700'
                                        : rankNum === 3
                                          ? 'bg-amber-50 text-amber-700'
                                          : 'bg-slate-100 text-slate-600'
                                  }`}
                                >
                                  #{rankNum}
                                </span>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <p className="text-sm font-semibold text-slate-900">{team.name}</p>
                                    {isMyTeam && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                                        Your Team
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-xs text-slate-400 mt-0.5">
                                    {team.members || 10} members · {team.events_participated || (team.event_breakdown ? team.event_breakdown.length : 1)} festivals
                                  </p>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-bold text-slate-900">
                                  {scoreFormat(team.points ?? team.global_points ?? 0)}
                                  <span className="ml-1 text-[11px] font-normal text-slate-400">pts</span>
                                </p>
                                <p className="text-[11px] text-slate-500 font-medium">
                                  {team.total_raw_points ?? '—'} raw pts
                                </p>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedTeamBreakdown(team)}
                              className="min-h-[40px] w-full flex items-center justify-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 active:bg-indigo-100 transition-colors"
                            >
                              <span>View Event Breakdown</span>
                              <ChevronRight className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        );
                      })
                    )}
                  </div>
                </>
              )}

              {/* Global Students Dual-View */}
              {activeGlobalTab === 'students' && (
                <>
                  {/* Desktop Table */}
                  <div className="hidden md:block overflow-x-auto">
                    <table className="min-w-full">
                      <thead className="bg-slate-50/80">
                        <tr>
                          {['Rank', 'Student', 'Student ID', 'Category', 'Festivals', 'Global Score'].map((label) => (
                            <th
                              key={label}
                              className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 ${
                                label.includes('Score') ? 'text-right' : 'text-left'
                              }`}
                            >
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredGlobalStudents.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="py-12 text-center text-xs text-slate-400">
                              {leaderboardStudents.length === 0
                                ? 'Student global scores will be published after judging concludes.'
                                : 'No students found matching search.'}
                            </td>
                          </tr>
                        ) : (
                          filteredGlobalStudents.map((st, i) => (
                            <tr key={st.id || i} className="hover:bg-slate-50 transition-colors">
                              <td className="whitespace-nowrap px-5 py-3.5 font-bold text-xs text-slate-700">
                                #{st.rank || i + 1}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-slate-900">
                                {st.name}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-slate-500">
                                {st.student_id}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3.5 text-xs">
                                <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 uppercase font-medium text-[10px]">
                                  {st.category || 'General'}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-600">
                                {st.events_participated || 1}
                              </td>
                              <td className="whitespace-nowrap px-5 py-3.5 text-right font-bold text-sm text-slate-900">
                                {scoreFormat(st.points ?? st.global_points)} pts
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Native Cards */}
                  <div className="md:hidden divide-y divide-slate-100">
                    {filteredGlobalStudents.length === 0 ? (
                      <div className="py-10 text-center text-xs text-slate-400">
                        {leaderboardStudents.length === 0
                          ? 'Student global scores will be published after judging concludes.'
                          : 'No students found matching search.'}
                      </div>
                    ) : (
                      filteredGlobalStudents.map((st, i) => (
                        <div key={st.id || i} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                                #{st.rank || i + 1}
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{st.name}</p>
                                <p className="font-mono text-xs text-slate-400">{st.student_id}</p>
                              </div>
                            </div>
                            <span className="shrink-0 text-sm font-bold text-slate-900">
                              {scoreFormat(st.points ?? st.global_points)} pts
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                            <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 uppercase font-medium text-[10px]">
                              {st.category || 'General'}
                            </span>
                            <span>{st.events_participated || 1} festival(s)</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 3B. EVENT-WISE POINTS & RANKINGS VIEW */}
        {/* ========================================================================= */}
        {viewMode === 'event_wise' && (
          <div className="mt-6 space-y-6">
            {/* Event Selector Strip */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Select Event or Festival:
                </p>
                {eventsList.length > 0 && (
                  <span className="text-xs text-slate-400">{eventsList.length} events with points</span>
                )}
              </div>

              {/* Event Tabs Pills */}
              <div className="-mx-4 px-4 sm:mx-0 sm:px-0 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  onClick={() => setSelectedEventId('all')}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                    selectedEventId === 'all'
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/20'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  <span>All Events Comparison</span>
                </button>

                {eventsList.map((ev) => {
                  const isSelected = String(selectedEventId) === String(ev.id);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => setSelectedEventId(ev.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                        isSelected
                          ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/20'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                      }`}
                    >
                      <Calendar className="h-3.5 w-3.5 opacity-60" />
                      <span>{ev.name}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {ev.total_points} pts
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* If NO events found */}
            {eventsList.length === 0 ? (
              <div className="rounded-2xl border border-slate-200/80 bg-white p-12 text-center shadow-xs">
                <Calendar className="mx-auto h-8 w-8 text-slate-300" />
                <h3 className="mt-3 text-sm font-semibold text-slate-900">No event points published yet</h3>
                <p className="mt-1 text-xs text-slate-400">
                  Event-wise points and rankings will appear here once program marks are published.
                </p>
              </div>
            ) : selectedEventId === 'all' ? (
              /* ========================================================================= */
              /* ALL EVENTS COMPARISON MATRIX */
              /* ========================================================================= */
              <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                <div className="border-b border-slate-100 p-4 sm:p-5">
                  <h3 className="text-base font-semibold text-slate-900">
                    All Events Points Overview
                  </h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Complete breakdown of raw points earned by each team across every festival.
                  </p>
                </div>

                {/* Desktop Table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full">
                    <thead className="bg-slate-50/80">
                      <tr>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Rank
                        </th>
                        <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Team
                        </th>
                        {eventsList.map((ev) => (
                          <th
                            key={ev.id}
                            className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                          >
                            <div>{ev.name}</div>
                            <div className="text-[9px] font-normal text-slate-400">({ev.total_points} total pts)</div>
                          </th>
                        ))}
                        <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Total Raw Pts
                        </th>
                        <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          Global Score (%)
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {leaderboardTeams.map((team, idx) => {
                        const isMyTeam = managedTeamIds.has(team.id) || team.is_managed;
                        const breakdownMap = {};
                        (team.event_breakdown || []).forEach((eb) => {
                          breakdownMap[eb.event_id] = eb;
                        });

                        return (
                          <tr
                            key={team.id || idx}
                            className={`transition-colors ${
                              isMyTeam ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-slate-50'
                            }`}
                          >
                            <td className="whitespace-nowrap px-5 py-3.5 font-bold text-xs text-slate-700">
                              #{team.rank || idx + 1}
                            </td>

                            <td className="whitespace-nowrap px-5 py-3.5">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">{team.name}</p>
                                {isMyTeam && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                                    Your Team
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Event columns */}
                            {eventsList.map((ev) => {
                              const eb = breakdownMap[ev.id];
                              return (
                                <td key={ev.id} className="whitespace-nowrap px-5 py-3.5 text-center">
                                  {eb ? (
                                    <div>
                                      <span className="font-semibold text-xs text-slate-900">{eb.event_points} pts</span>
                                      <div className="text-[10px] text-indigo-600 font-medium">{scoreFormat(eb.percentage)}%</div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-slate-300">—</span>
                                  )}
                                </td>
                              );
                            })}

                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-bold text-xs text-slate-900">
                              {team.total_raw_points ?? '—'} pts
                            </td>

                            <td className="whitespace-nowrap px-5 py-3.5 text-right font-bold text-sm text-indigo-600">
                              {scoreFormat(team.points ?? team.global_points)} pts
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards View */}
                <div className="md:hidden divide-y divide-slate-100">
                  {leaderboardTeams.map((team, idx) => {
                    const isMyTeam = managedTeamIds.has(team.id) || team.is_managed;
                    const breakdownMap = {};
                    (team.event_breakdown || []).forEach((eb) => {
                      breakdownMap[eb.event_id] = eb;
                    });

                    return (
                      <div key={team.id || idx} className={`p-4 space-y-3 ${isMyTeam ? 'bg-indigo-50/30' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                              #{team.rank || idx + 1}
                            </span>
                            <div>
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-semibold text-slate-900">{team.name}</p>
                                {isMyTeam && (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                                    Your Team
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-slate-500 mt-0.5">
                                {team.total_raw_points ?? '—'} raw pts
                              </p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-sm font-bold text-indigo-600">
                              {scoreFormat(team.points ?? team.global_points)} pts
                            </p>
                            <p className="text-[10px] text-slate-400">Global Score</p>
                          </div>
                        </div>

                        {/* Event Pills Breakdown on mobile */}
                        <div className="space-y-1.5 rounded-xl bg-slate-50 p-2.5">
                          {eventsList.map((ev) => {
                            const eb = breakdownMap[ev.id];
                            return (
                              <div key={ev.id} className="flex items-center justify-between text-xs">
                                <span className="text-slate-600 truncate max-w-[170px]">{ev.name}</span>
                                {eb ? (
                                  <span className="font-semibold text-slate-900">
                                    {eb.event_points} pts <span className="text-indigo-600 font-medium">({scoreFormat(eb.percentage)}%)</span>
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* ========================================================================= */
              /* SPECIFIC EVENT STANDINGS */
              /* ========================================================================= */
              currentSelectedEvent && (
                <div className="space-y-6">
                  {/* Event Spotlight Header Card */}
                  <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Event Standings</span>
                        </div>
                        <h2 className="mt-2 text-xl font-bold text-slate-900">{currentSelectedEvent.name}</h2>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Total published points distributed in this event:{' '}
                          <strong className="text-slate-800">{currentSelectedEvent.total_points} pts</strong>
                        </p>
                      </div>

                      {/* Top Team Spotlight */}
                      {currentSelectedEvent.teams?.[0] && (
                        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-800">
                            <Trophy className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-800">
                              Event Winner
                            </p>
                            <p className="text-sm font-bold text-amber-950">
                              {currentSelectedEvent.teams[0].name}
                            </p>
                            <p className="text-xs font-medium text-amber-700">
                              {currentSelectedEvent.teams[0].event_points} pts ({scoreFormat(currentSelectedEvent.teams[0].percentage)}%)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Sub-Tabs: Teams vs Students in this event */}
                  <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
                    <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="grid grid-cols-2 sm:flex items-center gap-2 w-full sm:w-auto">
                        <button
                          type="button"
                          onClick={() => setActiveEventTab('teams')}
                          className={`min-h-[38px] flex items-center justify-center px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            activeEventTab === 'teams'
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>Teams ({currentSelectedEvent.teams?.length || 0})</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveEventTab('students')}
                          className={`min-h-[38px] flex items-center justify-center px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${
                            activeEventTab === 'students'
                              ? 'bg-indigo-600 text-white shadow-sm'
                              : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          <span>Scorers ({currentSelectedEvent.students?.length || 0})</span>
                        </button>
                      </div>

                      <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                        <input
                          type="search"
                          placeholder={`Search in ${currentSelectedEvent.name}...`}
                          value={eventSearch}
                          onChange={(e) => setEventSearch(e.target.value)}
                          className="h-10 sm:h-8.5 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-8 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-1 focus:ring-indigo-100"
                        />
                      </div>
                    </div>

                    {/* Event Team Dual-View */}
                    {activeEventTab === 'teams' && (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-slate-50/80">
                              <tr>
                                {['Rank', 'Team', 'Points Scored', 'Share of Event Points'].map((label) => (
                                  <th
                                    key={label}
                                    className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 ${
                                      label.includes('Points') || label.includes('Share') ? 'text-right' : 'text-left'
                                    }`}
                                  >
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredEventTeams.length === 0 ? (
                                <tr>
                                  <td colSpan="4" className="py-12 text-center text-xs text-slate-400">
                                    No teams found matching search.
                                  </td>
                                </tr>
                              ) : (
                                filteredEventTeams.map((team, idx) => {
                                  const rankNum = team.rank || idx + 1;
                                  const isMyTeam = managedTeamIds.has(team.id) || team.is_managed;
                                  const percentNum = Math.min(Number(team.percentage || 0), 100);

                                  return (
                                    <tr
                                      key={team.id || idx}
                                      className={`transition-colors ${
                                        isMyTeam ? 'bg-indigo-50/40 hover:bg-indigo-50/60' : 'hover:bg-slate-50'
                                      }`}
                                    >
                                      <td className="whitespace-nowrap px-5 py-3.5">
                                        <div className="flex items-center gap-1.5">
                                          <span
                                            className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                                              rankNum === 1
                                                ? 'bg-amber-100 text-amber-800'
                                                : rankNum === 2
                                                  ? 'bg-slate-200 text-slate-700'
                                                  : rankNum === 3
                                                    ? 'bg-amber-50 text-amber-700'
                                                    : 'bg-slate-100 text-slate-600'
                                            }`}
                                          >
                                            {rankNum}
                                          </span>
                                          {rankNum === 1 && <Medal className="h-4 w-4 text-amber-500" />}
                                        </div>
                                      </td>

                                      <td className="whitespace-nowrap px-5 py-3.5">
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-semibold text-slate-900">{team.name}</p>
                                          {isMyTeam && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                                              Your Team
                                            </span>
                                          )}
                                        </div>
                                      </td>

                                      <td className="whitespace-nowrap px-5 py-3.5 text-right font-bold text-sm text-slate-900">
                                        {team.event_points} pts
                                      </td>

                                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                                        <div className="flex items-center justify-end gap-2.5">
                                          <span className="font-semibold text-xs text-indigo-700">
                                            {scoreFormat(team.percentage)}%
                                          </span>
                                          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                                            <div
                                              className="h-full rounded-full bg-indigo-600"
                                              style={{ width: `${percentNum}%` }}
                                            />
                                          </div>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                })
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Native Cards */}
                        <div className="md:hidden divide-y divide-slate-100">
                          {filteredEventTeams.length === 0 ? (
                            <div className="py-10 text-center text-xs text-slate-400">
                              No teams found matching search.
                            </div>
                          ) : (
                            filteredEventTeams.map((team, idx) => {
                              const rankNum = team.rank || idx + 1;
                              const isMyTeam = managedTeamIds.has(team.id) || team.is_managed;
                              const percentNum = Math.min(Number(team.percentage || 0), 100);

                              return (
                                <div key={team.id || idx} className={`p-4 space-y-2.5 ${isMyTeam ? 'bg-indigo-50/30' : ''}`}>
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="flex items-center gap-2.5">
                                      <span
                                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${
                                          rankNum === 1
                                            ? 'bg-amber-100 text-amber-800'
                                            : rankNum === 2
                                              ? 'bg-slate-200 text-slate-700'
                                              : rankNum === 3
                                                ? 'bg-amber-50 text-amber-700'
                                                : 'bg-slate-100 text-slate-600'
                                        }`}
                                      >
                                        #{rankNum}
                                      </span>
                                      <div>
                                        <div className="flex items-center gap-2">
                                          <p className="text-sm font-semibold text-slate-900">{team.name}</p>
                                          {isMyTeam && (
                                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-600 text-white">
                                              Your Team
                                            </span>
                                          )}
                                        </div>
                                        <p className="text-xs text-slate-500 mt-0.5 font-medium">
                                          {team.event_points} pts earned
                                        </p>
                                      </div>
                                    </div>
                                    <span className="shrink-0 text-sm font-bold text-indigo-700">
                                      {scoreFormat(team.percentage)}%
                                    </span>
                                  </div>
                                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${percentNum}%` }} />
                                  </div>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}

                    {/* Event Students Dual-View */}
                    {activeEventTab === 'students' && (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block overflow-x-auto">
                          <table className="min-w-full">
                            <thead className="bg-slate-50/80">
                              <tr>
                                {['Rank', 'Student', 'Student ID', 'Category', 'Points Scored', 'Event Share'].map((label) => (
                                  <th
                                    key={label}
                                    className={`px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400 ${
                                      label.includes('Points') || label.includes('Share') ? 'text-right' : 'text-left'
                                    }`}
                                  >
                                    {label}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {filteredEventStudents.length === 0 ? (
                                <tr>
                                  <td colSpan="6" className="py-12 text-center text-xs text-slate-400">
                                    No individual student scores published for this event yet.
                                  </td>
                                </tr>
                              ) : (
                                filteredEventStudents.map((st, i) => (
                                  <tr key={st.id || i} className="hover:bg-slate-50 transition-colors">
                                    <td className="whitespace-nowrap px-5 py-3.5 font-bold text-xs text-slate-700">
                                      #{st.rank || i + 1}
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5 font-semibold text-sm text-slate-900">
                                      {st.name}
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-slate-500">
                                      {st.student_id}
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5 text-xs">
                                      <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 uppercase font-medium text-[10px]">
                                        {st.category || 'General'}
                                      </span>
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-bold text-sm text-slate-900">
                                      {st.event_points} pts
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3.5 text-right font-medium text-xs text-indigo-700">
                                      {scoreFormat(st.percentage)}%
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>

                        {/* Mobile Native Cards */}
                        <div className="md:hidden divide-y divide-slate-100">
                          {filteredEventStudents.length === 0 ? (
                            <div className="py-10 text-center text-xs text-slate-400">
                              No individual student scores published for this event yet.
                            </div>
                          ) : (
                            filteredEventStudents.map((st, i) => (
                              <div key={st.id || i} className="p-4 space-y-2">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-center gap-2.5">
                                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
                                      #{st.rank || i + 1}
                                    </span>
                                    <div>
                                      <p className="text-sm font-semibold text-slate-900">{st.name}</p>
                                      <p className="font-mono text-xs text-slate-400">{st.student_id}</p>
                                    </div>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className="text-sm font-bold text-slate-900">{st.event_points} pts</p>
                                    <p className="text-xs font-semibold text-indigo-600">{scoreFormat(st.percentage)}%</p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between text-xs text-slate-500 pt-1">
                                  <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-slate-700 uppercase font-medium text-[10px]">
                                    {st.category || 'General'}
                                  </span>
                                  <span>Event Top Scorer</span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. TEAM BREAKDOWN MODAL */}
      {/* ========================================================================= */}
      {selectedTeamBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">
                  {selectedTeamBreakdown.name} Performance
                </h3>
                <p className="text-xs text-slate-500">Event-wise points breakdown</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTeamBreakdown(null)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-amber-50/70 border border-amber-200/60 p-3.5 sm:p-4">
                <div>
                  <p className="text-xs font-semibold text-amber-900">Total Global Championship Score</p>
                  <p className="text-xl sm:text-2xl font-bold text-amber-700">
                    {scoreFormat(selectedTeamBreakdown.points ?? selectedTeamBreakdown.global_points ?? 0)} pts
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-amber-800 font-semibold">
                    Rank #{selectedTeamBreakdown.rank || 1}
                  </p>
                  <p className="text-xs text-amber-600">
                    {selectedTeamBreakdown.members || 10} members
                  </p>
                </div>
              </div>

              {selectedTeamBreakdown.event_breakdown && selectedTeamBreakdown.event_breakdown.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedTeamBreakdown.event_breakdown.map((item, i) => (
                    <div
                      key={item.event_id || i}
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3 sm:p-3.5 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-900">{item.event_name}</p>
                        <span className="text-xs font-bold text-indigo-700">
                          {scoreFormat(item.percentage)}%
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                        <span>{item.event_points} pts earned ÷ {item.total_event_points} event total</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div
                          className="h-full rounded-full bg-indigo-600"
                          style={{ width: `${Math.min(Number(item.percentage || 0), 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-xs text-slate-600">No events published yet for this team.</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setSelectedTeamBreakdown(null)}
                className="min-h-[40px] w-full sm:w-auto rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default TeamManagerPoints;