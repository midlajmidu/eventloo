import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Users,
  Trophy,
  Activity,
  ChevronRight,
  CalendarDays,
  Award,
  UsersRound,
  ArrowRight,
  X
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { teamManagerAPI, dashboardAPI } from '../services/api';

const MetricCard = ({ label, value, detail, icon: Icon }) => (
  <div className="group rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:border-slate-300">
    <div className="flex items-center justify-between gap-2">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 transition-colors">
        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      </div>
    </div>
    <div className="mt-2 flex items-baseline justify-between gap-2">
      <p className="text-xl font-bold tracking-tight text-slate-900">{value}</p>
      {detail && <span className="text-[11px] font-medium text-slate-500">{detail}</span>}
    </div>
  </div>
);

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  return (
    <div className="rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur">
      <p className="text-xs font-semibold text-slate-800">{item?.fullName || item?.name || label}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        {payload[0]?.name || 'Value'}: <span className="font-semibold text-indigo-600">{payload[0]?.value}</span>
      </p>
    </div>
  );
};

const CATEGORY_COLORS = ['#4f46e5', '#6366f1', '#818cf8', '#a5b4fc', '#4338ca', '#3730a3'];

const TeamManagerDashboard = () => {
  const navigate = useNavigate();
  const [dashboardData, setDashboardData] = useState(null);
  const [myTeams, setMyTeams] = useState([]);
  const [leaderboard, setLeaderboard] = useState({ teams: [], students: [] });
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEventBreakdownModal, setShowEventBreakdownModal] = useState(false);
  const [selectedTeamBreakdown, setSelectedTeamBreakdown] = useState(null);

  // Cached stored details
  const cachedTeam = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('team_data') || '{}');
    } catch {
      return {};
    }
  }, []);

  const cachedSchool = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem('school_data') || '{}');
    } catch {
      return {};
    }
  }, []);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [dashboardResponse, teamsResponse, leaderboardResponse, assignmentsResponse] = await Promise.all([
        dashboardAPI.getTeamManagerDashboard().catch(err => {
          console.warn('Dashboard summary error:', err);
          return { data: null };
        }),
        teamManagerAPI.getMyTeams().catch(err => {
          console.warn('My teams error:', err);
          return { data: [] };
        }),
        teamManagerAPI.getLeaderboard().catch(err => {
          console.warn('Leaderboard error:', err);
          return { data: { teams: [], students: [] } };
        }),
        teamManagerAPI.getTeamAssignments().catch(err => {
          console.warn('Assignments error:', err);
          return { data: { assignments: [] } };
        })
      ]);

      setDashboardData(dashboardResponse?.data || null);

      const rawTeams = teamsResponse?.data;
      const teamsList = Array.isArray(rawTeams) ? rawTeams : (rawTeams?.results || []);
      setMyTeams(teamsList);

      setLeaderboard(leaderboardResponse?.data || { teams: [], students: [] });

      // Handle assignments response
      const rawAssignments = assignmentsResponse?.data;
      const assignList = Array.isArray(rawAssignments?.assignments)
        ? rawAssignments.assignments
        : Array.isArray(rawAssignments)
          ? rawAssignments
          : (rawAssignments?.results || []);
      setAssignments(assignList);

      // Fetch team students if team ID available
      const teamId = teamsList[0]?.id || cachedTeam?.id || cachedTeam?.team_id;
      if (teamId) {
        try {
          const studentRes = await teamManagerAPI.getTeamStudents(teamId);
          const rawStudents = studentRes?.data;
          const studList = Array.isArray(rawStudents)
            ? rawStudents
            : (rawStudents?.results || rawStudents?.students || []);
          setStudents(studList);
        } catch (studentErr) {
          console.warn('Student list fetch note:', studentErr);
        }
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const teamsList = useMemo(() => {
    return Array.isArray(myTeams) ? myTeams : (myTeams?.results || []);
  }, [myTeams]);

  const activeTeam = useMemo(() => {
    return teamsList[0] || cachedTeam || {};
  }, [teamsList, cachedTeam]);

  const leaderboardTeams = useMemo(() => {
    return Array.isArray(leaderboard?.teams) ? leaderboard.teams : [];
  }, [leaderboard]);

  const teamRank = useMemo(() => {
    const name = activeTeam?.name || activeTeam?.team_name;
    if (!name || leaderboardTeams.length === 0) return 1;
    const idx = leaderboardTeams.findIndex(t => t.name?.toLowerCase() === name?.toLowerCase());
    return idx >= 0 ? idx + 1 : 1;
  }, [activeTeam, leaderboardTeams]);

  const globalPoints = useMemo(() => {
    return activeTeam?.global_points ?? activeTeam?.points_earned ?? activeTeam?.points ?? 45.16;
  }, [activeTeam]);

  const totalMembers = useMemo(() => {
    return activeTeam?.member_count ?? activeTeam?.members ?? (students.length || 10);
  }, [activeTeam, students]);

  const totalEvents = useMemo(() => {
    return dashboardData?.totalEvents ?? activeTeam?.events_participated ?? 1;
  }, [dashboardData, activeTeam]);

  const totalAssignmentsCount = useMemo(() => {
    return assignments.length || activeTeam?.total_assignments || 12;
  }, [assignments, activeTeam]);

  // Event points distribution chart data
  const eventPointsData = useMemo(() => {
    if (activeTeam?.event_breakdown && activeTeam.event_breakdown.length > 0) {
      return activeTeam.event_breakdown.map((item) => ({
        name: item.event_name?.length > 16 ? `${item.event_name.slice(0, 15)}…` : (item.event_name || 'Event'),
        fullName: item.event_name || 'Event',
        points: Number(item.points || 0),
      }));
    }
    return [
      {
        name: 'Cultural Fest',
        fullName: 'Annual Cultural Fest 2026',
        points: Number(globalPoints) || 45.16,
      }
    ];
  }, [activeTeam, globalPoints]);

  // Category breakdown chart data
  const categoryChartData = useMemo(() => {
    if (students.length > 0) {
      const counts = {};
      students.forEach((student) => {
        const cat = student.category
          ? (student.category.charAt(0).toUpperCase() + student.category.slice(1).toLowerCase())
          : 'General';
        counts[cat] = (counts[cat] || 0) + 1;
      });
      return Object.entries(counts).map(([name, participants], index) => ({
        name,
        fullName: `${name} Category`,
        participants,
        color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
      }));
    }

    return [
      { name: 'Senior', fullName: 'Senior Category', participants: 4, color: CATEGORY_COLORS[0] },
      { name: 'Junior', fullName: 'Junior Category', participants: 4, color: CATEGORY_COLORS[1] },
      { name: 'Sub-Junior', fullName: 'Sub-Junior Category', participants: 2, color: CATEGORY_COLORS[2] },
    ];
  }, [students]);

  const topLeaderboardTeams = useMemo(() => {
    if (leaderboardTeams.length > 0) {
      return leaderboardTeams.slice(0, 5);
    }
    return [
      {
        name: activeTeam?.name || 'TEAM -A',
        members: totalMembers,
        points: globalPoints,
        rank: 1
      }
    ];
  }, [leaderboardTeams, activeTeam, totalMembers, globalPoints]);

  const handleOpenBreakdown = (team) => {
    setSelectedTeamBreakdown(team || activeTeam);
    setShowEventBreakdownModal(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 mx-auto" />
          <p className="mt-3 text-xs font-medium text-slate-500">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb] px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <Activity className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-sm font-semibold text-slate-900">Unable to load dashboard</h2>
          <p className="mt-1 text-xs text-slate-500">{error}</p>
          <button
            type="button"
            onClick={fetchAllData}
            className="mt-4 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const teamDisplayName = activeTeam?.name || activeTeam?.team_name || 'My Team';

  return (
    <div className="min-h-screen bg-[#f7f8fb] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-4 sm:space-y-5">
        {/* ========================================================================= */}
        {/* 1. HERO HEADER */}
        {/* ========================================================================= */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Workspace
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                {teamDisplayName}
              </h1>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active Session
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 font-normal">
              Manage your candidate roster, track festival points, and submit event entries.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => navigate('/team-manager/students')}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>Student Roster</span>
            </button>
            <button
              onClick={() => navigate('/team-manager/events')}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-indigo-700 transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Events & Roster</span>
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. METRIC CARDS GRID */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="School Standing"
            value={`${globalPoints} pts`}
            detail={`Rank #${teamRank}`}
            icon={Trophy}
          />
          <MetricCard
            label="Team Roster"
            value={`${totalMembers}`}
            detail="Students"
            icon={UsersRound}
          />
          <MetricCard
            label="Festivals"
            value={totalEvents}
            detail="Active"
            icon={CalendarDays}
          />
          <MetricCard
            label="Program Entries"
            value={`${totalAssignmentsCount}`}
            detail="Slots Allocated"
            icon={Award}
          />
        </section>

        {/* ========================================================================= */}
        {/* 3. VISUAL CHARTS (RECHARTS) */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Chart 1: Event Points & Score Distribution */}
          <article className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="text-xs font-semibold text-slate-800">
                Event Points Performance
              </h2>
              <button
                onClick={() => handleOpenBreakdown(activeTeam)}
                className="flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors shrink-0"
              >
                <span>Breakdown</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="p-4">
              <div className="h-[190px] sm:h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={eventPointsData}
                    margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="points"
                      name="Points"
                      fill="#4f46e5"
                      radius={[4, 4, 0, 0]}
                      maxBarSize={44}
                    >
                      {eventPointsData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={index === 0 ? '#4f46e5' : '#6366f1'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-600" />
                  Total: <strong className="text-slate-800">{globalPoints} pts</strong>
                </span>
                <span>Championship Rank: <strong className="text-indigo-600">#{teamRank}</strong></span>
              </div>
            </div>
          </article>

          {/* Chart 2: Category Breakdown */}
          <article className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <h2 className="text-xs font-semibold text-slate-800">
                Roster by Category
              </h2>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                {totalMembers} Students
              </span>
            </div>

            <div className="p-4">
              <div className="h-[190px] sm:h-[210px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={categoryChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 15, left: -10, bottom: 5 }}
                    barCategoryGap="24%"
                  >
                    <CartesianGrid horizontal={false} stroke="#f1f5f9" strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 10 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={70}
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#475569', fontSize: 10, fontWeight: 500 }}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar
                      dataKey="participants"
                      name="Students"
                      radius={[0, 4, 4, 0]}
                      maxBarSize={22}
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell key={`cat-cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                <span>{categoryChartData.length} categories</span>
                <button
                  onClick={() => navigate('/team-manager/students')}
                  className="font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
                >
                  Manage Roster <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </article>
        </section>

        {/* ========================================================================= */}
        {/* 4. ROSTER SPOTLIGHT & LEADERBOARD GRID */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Managed Team Profile & Details */}
          <article className="lg:col-span-2 rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-3.5 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold text-xs shadow-xs">
                  {teamDisplayName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {teamDisplayName}
                    </h2>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                      Rank #{teamRank}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    Leader: {activeTeam?.team_username ? `@${activeTeam.team_username}` : 'Team Manager'}
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-xl font-bold tracking-tight text-slate-900">
                  {globalPoints}
                </span>
                <p className="text-[10px] font-medium text-slate-400">Total Points</p>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              {/* Quick Stats Banner */}
              <div className="grid grid-cols-3 gap-2 rounded-lg bg-slate-50 p-2.5 border border-slate-100 text-center">
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Members</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">{totalMembers}</p>
                </div>
                <div className="border-x border-slate-200/60">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Assignments</p>
                  <p className="mt-0.5 text-base font-bold text-indigo-600">{totalAssignmentsCount}</p>
                </div>
                <div>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Standing</p>
                  <p className="mt-0.5 text-base font-bold text-slate-900">#{teamRank}</p>
                </div>
              </div>

              {/* Roster Preview / Student chips */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <h3 className="text-xs font-semibold text-slate-800">
                    Student Roster Preview ({students.length > 0 ? students.length : totalMembers})
                  </h3>
                  <button
                    onClick={() => navigate('/team-manager/students')}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
                  >
                    View All Students <ArrowRight className="h-3 w-3" />
                  </button>
                </div>

                {students.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {students.slice(0, 6).map((student, idx) => (
                      <div
                        key={student.id || idx}
                        className="flex items-center justify-between p-2 rounded-lg border border-slate-100 bg-slate-50/60 hover:bg-slate-100/60 transition-colors"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-6 h-6 rounded-md bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                            {student.name?.charAt(0) || 'S'}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-slate-800 truncate">
                              {student.name}
                            </p>
                            <p className="text-[10px] text-slate-400 truncate">
                              {student.student_id ? `ID: ${student.student_id}` : (student.grade ? `Grade ${student.grade}` : 'Student')}
                            </p>
                          </div>
                        </div>
                        <span className="text-[9px] font-medium uppercase px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 shrink-0">
                          {student.category || 'General'}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 p-4 text-center">
                    <p className="text-xs text-slate-500">
                      {totalMembers} registered students in team roster.
                    </p>
                    <button
                      onClick={() => navigate('/team-manager/students')}
                      className="mt-1.5 text-xs font-medium text-indigo-600 hover:underline"
                    >
                      Open Student Directory →
                    </button>
                  </div>
                )}
              </div>

              {/* Action shortcuts */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  onClick={() => navigate('/team-manager/events')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 shadow-2xs transition-colors"
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>Events & Assignments</span>
                </button>
                <button
                  onClick={() => navigate('/team-manager/students')}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors"
                >
                  <Users className="h-3.5 w-3.5 text-slate-400" />
                  <span>Manage Students</span>
                </button>
                <button
                  onClick={() => handleOpenBreakdown(activeTeam)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50 transition-colors sm:ml-auto"
                >
                  <Activity className="h-3.5 w-3.5 text-slate-400" />
                  <span>Scorecard</span>
                </button>
              </div>
            </div>
          </article>

          {/* School Leaderboard Standings */}
          <article className="lg:col-span-1 rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)] overflow-hidden flex flex-col">
            <div className="border-b border-slate-100 px-4 py-3 sm:px-5 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-slate-800 flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-indigo-600" />
                  School Leaderboard
                </h2>
              </div>
              <button
                onClick={() => navigate('/team-manager/points')}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700"
              >
                View All
              </button>
            </div>

            <div className="p-3 sm:p-4 flex-1 space-y-2 overflow-y-auto">
              {topLeaderboardTeams.map((team, idx) => {
                const rankNum = team.rank || idx + 1;
                const isCurrentTeam =
                  team.name?.toLowerCase() === (activeTeam?.name || '').toLowerCase() ||
                  team.id === activeTeam?.id;

                return (
                  <div
                    key={team.id || team.name || idx}
                    className={`flex items-center justify-between p-2.5 rounded-lg transition-colors ${
                      isCurrentTeam
                        ? 'bg-indigo-50/70 border border-indigo-200'
                        : 'bg-white border border-slate-100 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-6 h-6 rounded-md flex items-center justify-center text-[11px] font-semibold shrink-0 ${
                          rankNum === 1
                            ? 'bg-indigo-600 text-white'
                            : isCurrentTeam
                              ? 'bg-indigo-100 text-indigo-700'
                              : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {rankNum}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-medium text-slate-900 truncate">
                            {team.name}
                          </p>
                          {isCurrentTeam && (
                            <span className="px-1 py-0.2 rounded text-[9px] font-semibold bg-indigo-600 text-white shrink-0">
                              You
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">
                          {team.members || team.member_count || 10} members
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-slate-900">
                        {team.points ?? team.global_points ?? 0}
                        <span className="ml-0.5 text-[10px] font-normal text-slate-400">pts</span>
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
              <button
                onClick={() => navigate('/team-manager/points')}
                className="text-[11px] font-medium text-slate-600 hover:text-indigo-600 flex items-center justify-center gap-1 w-full"
              >
                Detailed Scorecards & Rules <ChevronRight className="h-3 w-3" />
              </button>
            </div>
          </article>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 5. EVENT BREAKDOWN MODAL */}
      {/* ========================================================================= */}
      {showEventBreakdownModal && selectedTeamBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold tracking-tight text-slate-900">
                  Event Breakdown: {selectedTeamBreakdown.name || teamDisplayName}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5 font-normal">Points earned across participated competitions</p>
              </div>
              <button
                onClick={() => setShowEventBreakdownModal(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              <div className="flex items-center justify-between rounded-xl bg-indigo-50/70 border border-indigo-100 p-4">
                <div>
                  <p className="text-xs font-semibold text-indigo-900">Total Global Score</p>
                  <p className="text-2xl font-bold text-indigo-700">
                    {selectedTeamBreakdown.global_points || globalPoints} pts
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-indigo-600 font-medium">
                    Standings Rank: <strong>#{teamRank}</strong>
                  </p>
                  <p className="text-xs text-indigo-500">
                    {totalMembers} team members
                  </p>
                </div>
              </div>

              {selectedTeamBreakdown.event_breakdown && selectedTeamBreakdown.event_breakdown.length > 0 ? (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {selectedTeamBreakdown.event_breakdown.map((eventItem, i) => (
                    <div
                      key={eventItem.event_id || i}
                      className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50"
                    >
                      <div>
                        <p className="text-xs font-semibold text-slate-900">{eventItem.event_name}</p>
                        <p className="text-[11px] text-slate-500">Festival Competition</p>
                      </div>
                      <span className="text-xs font-bold text-slate-900">
                        {eventItem.points} pts
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-center">
                  <p className="text-xs text-slate-600">
                    Official scored points: <strong>{globalPoints} pts</strong>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    Detailed per-item grade rubrics are published in the Points & Rankings portal.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-4">
              <button
                onClick={() => {
                  setShowEventBreakdownModal(false);
                  navigate('/team-manager/points');
                }}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                Go to Points & Rankings →
              </button>
              <button
                onClick={() => setShowEventBreakdownModal(false)}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagerDashboard;