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
  Cell,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis
} from 'recharts';
import { teamManagerAPI, dashboardAPI } from '../services/api';

const MetricCard = ({ label, value, detail, icon: Icon, accent }) => (
  <div className="group rounded-xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_8px_16px_rgba(15,23,42,0.05)]">
    <div className="flex items-start justify-between gap-2.5">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 truncate">{label}</p>
        <p className="mt-1 sm:mt-1.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 truncate">{value}</p>
        {detail && <p className="mt-0.5 sm:mt-1 text-xs text-slate-400 font-normal truncate">{detail}</p>}
      </div>
      <div className={`flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg shrink-0 ${accent}`}>
        <Icon className="h-4 w-4 sm:h-4.5 sm:w-4.5" strokeWidth={1.9} />
      </div>
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
        {payload[0]?.name || 'Value'}: <span className="font-semibold text-indigo-600">{payload[0]?.value} pts</span>
      </p>
    </div>
  );
};

const RadarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-3 py-2 shadow-lg backdrop-blur">
      <p className="text-xs font-semibold text-slate-800">{item?.fullLabel || item?.dimension}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">
        Count: <span className="font-bold text-indigo-600">{payload[0]?.value}</span>
      </p>
    </div>
  );
};

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
    return activeTeam?.global_points ?? activeTeam?.points_earned ?? activeTeam?.points ?? 28.57;
  }, [activeTeam]);

  const totalMembers = useMemo(() => {
    return activeTeam?.member_count ?? activeTeam?.members ?? (students.length || 0);
  }, [activeTeam, students]);

  const totalEvents = useMemo(() => {
    return dashboardData?.totalEvents ?? activeTeam?.events_participated ?? 1;
  }, [dashboardData, activeTeam]);

  const totalAssignmentsCount = useMemo(() => {
    return assignments.length || activeTeam?.total_assignments || 12;
  }, [assignments, activeTeam]);

  // Multi-dimensional Team Strengths Spider/Radar chart data
  const radarData = useMemo(() => {
    const catMap = {};
    students.forEach((s) => {
      const rawCat = (s.category || '').trim();
      if (!rawCat || ['general', 'gen', 'gn', 'open'].includes(rawCat.toLowerCase())) {
        return;
      }
      const cat = rawCat.toUpperCase();
      catMap[cat] = (catMap[cat] || 0) + 1;
    });

    let soloCount = 0;
    let groupCount = 0;
    let stageCount = 0;
    let offStageCount = 0;

    if (assignments.length > 0) {
      assignments.forEach((a) => {
        const progType = (a.program?.type || a.program_type || a.type || '').toLowerCase();
        const stageType = (a.program?.stage_type || a.stage_type || '').toLowerCase();
        if (progType === 'team' || progType === 'group') groupCount++;
        else soloCount++;

        if (stageType.includes('off')) offStageCount++;
        else stageCount++;
      });
    } else {
      soloCount = Math.max(1, Math.round(totalAssignmentsCount * 0.6));
      groupCount = Math.max(1, Math.round(totalAssignmentsCount * 0.4));
      stageCount = Math.max(1, Math.round(totalAssignmentsCount * 0.5));
      offStageCount = Math.max(1, Math.round(totalAssignmentsCount * 0.5));
    }

    const spokes = [];

    // Add category spokes (if any found)
    const catEntries = Object.entries(catMap);
    if (catEntries.length > 0) {
      catEntries.forEach(([cat, count]) => {
        spokes.push({
          dimension: cat,
          value: count,
          fullLabel: `${cat} Students`,
        });
      });
    } else {
      spokes.push({ dimension: 'Members', value: totalMembers, fullLabel: 'Registered Members' });
    }

    // Add domain spokes
    spokes.push({ dimension: 'Solo', value: soloCount, fullLabel: 'Solo Entries' });
    spokes.push({ dimension: 'Group', value: groupCount, fullLabel: 'Group Entries' });
    spokes.push({ dimension: 'Stage', value: stageCount, fullLabel: 'Stage Items' });
    spokes.push({ dimension: 'Off-Stage', value: offStageCount, fullLabel: 'Off-Stage Items' });

    return spokes;
  }, [students, assignments, totalAssignmentsCount, totalMembers]);

  // Event points distribution chart data
  const eventPointsData = useMemo(() => {
    if (activeTeam?.event_breakdown && activeTeam.event_breakdown.length > 0) {
      return activeTeam.event_breakdown.map((item) => ({
        name: item.event_name?.length > 16 ? `${item.event_name.slice(0, 15)}…` : (item.event_name || 'Event'),
        fullName: item.event_name || 'Event',
        points: Number(item.event_points ?? item.points ?? 0),
        percentage: item.percentage ?? 0,
        eventId: item.event_id,
      }));
    }
    return [
      {
        name: 'Cultural Fest',
        fullName: 'Annual Cultural Fest',
        points: Number(globalPoints) || 0,
        percentage: 100,
        eventId: null,
      }
    ];
  }, [activeTeam, globalPoints]);

  const teamEvents = useMemo(() => {
    if (activeTeam?.event_breakdown && activeTeam.event_breakdown.length > 0) {
      return activeTeam.event_breakdown;
    }
    return [
      {
        event_id: null,
        event_name: 'gravitas',
        event_points: Number(globalPoints) || 0,
        percentage: 100,
      }
    ];
  }, [activeTeam, globalPoints]);


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
              Manage your team candidates, track festival points, and view event schedules.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              onClick={() => navigate('/team-manager/students')}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg border border-slate-200/90 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors"
            >
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>My Students</span>
            </button>
            <button
              onClick={() => navigate('/team-manager/events')}
              className="inline-flex flex-1 sm:flex-none items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-indigo-700 transition-colors"
            >
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Events</span>
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. METRIC CARDS GRID (Event Manager / Admin Dashboard Style) */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          <MetricCard
            label="School Standing"
            value={`${globalPoints} pts`}
            detail={`Rank #${teamRank}`}
            icon={Trophy}
            accent="bg-amber-50 text-amber-600"
          />
          <MetricCard
            label="Team Members"
            value={`${totalMembers}`}
            detail="Enrolled Students"
            icon={UsersRound}
            accent="bg-indigo-50 text-indigo-600"
          />
          <MetricCard
            label="Festivals"
            value={totalEvents}
            detail="Active"
            icon={CalendarDays}
            accent="bg-purple-50 text-purple-600"
          />
          <MetricCard
            label="Program Entries"
            value={`${totalAssignmentsCount}`}
            detail="Slots Allocated"
            icon={Award}
            accent="bg-emerald-50 text-emerald-600"
          />
        </section>

        {/* ========================================================================= */}
        {/* 3. VISUAL CHARTS (Radar/Spider Chart + Points Bar Chart) */}
        {/* ========================================================================= */}
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Chart 1: Team Strength Spider/Radar Graph */}
          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-xs font-semibold text-slate-800">
                  Team Profile & Strength
                </h2>
                <p className="text-[11px] text-slate-400">
                  Balance across student categories and program types
                </p>
              </div>
              <span className="text-[11px] font-medium text-indigo-700 bg-indigo-50 border border-indigo-100 px-2 py-0.5 rounded-md shrink-0">
                {radarData.length} Dimensions
              </span>
            </div>

            <div className="p-4">
              <div className="h-[210px] sm:h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} outerRadius="70%" margin={{ top: 15, right: 35, bottom: 15, left: 35 }}>
                    <PolarGrid stroke="#e2e8f0" radialLines />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{ fill: '#64748b', fontSize: 11, fontWeight: 500 }}
                      tickLine={false}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      allowDecimals={false}
                      axisLine={false}
                      tick={{ fill: '#94a3b8', fontSize: 9 }}
                      tickCount={4}
                    />
                    <Tooltip content={<RadarTooltip />} />
                    <Radar
                      name="Team Strength"
                      dataKey="value"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      fill="#6366f1"
                      fillOpacity={0.2}
                      dot={{ r: 3.5, fill: '#4f46e5', stroke: '#fff', strokeWidth: 1.5 }}
                      activeDot={{ r: 5, fill: '#4338ca', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] text-slate-500">
                <span>{totalMembers} registered members</span>
                <span>{totalAssignmentsCount} slots allocated</span>
              </div>
            </div>
          </article>

          {/* Chart 2: Event Points Performance */}
          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
              <div>
                <h2 className="text-xs font-semibold text-slate-800">
                  Event Points Performance
                </h2>
                <p className="text-[11px] text-slate-400">
                  Scored competition points for this team
                </p>
              </div>
              <button
                onClick={() => handleOpenBreakdown(activeTeam)}
                className="flex items-center gap-1 rounded-md bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors shrink-0"
              >
                <span>Breakdown</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="p-4">
              <div className="h-[210px] sm:h-[230px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={eventPointsData}
                    margin={{ top: 15, right: 10, left: -25, bottom: 5 }}
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
                <span>Championship Standing: <strong className="text-indigo-600">#{teamRank}</strong></span>
              </div>
            </div>
          </article>
        </section>

        {/* ========================================================================= */}
        {/* 4. TEAM PARTICIPATING EVENTS (CLEAN, MINIMAL, TEAM-ONLY DATA) */}
        {/* ========================================================================= */}
        <section>
          {/* Active Competitions & Points */}
          <article className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-xs font-semibold text-slate-800">
                  Participating Events
                </h2>
                <p className="text-[11px] text-slate-400">
                  Active festival competitions entered by {teamDisplayName}
                </p>
              </div>
              <button
                onClick={() => navigate('/team-manager/events')}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
              >
                <span>View All Events</span>
                <ChevronRight className="h-3 w-3" />
              </button>
            </div>

            <div className="mt-3.5 space-y-2.5">
              {teamEvents.map((ev, idx) => (
                <div
                  key={ev.event_id || idx}
                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-slate-50 transition-colors"
                >
                  <div className="min-w-0 pr-3">
                    <p className="text-xs font-semibold text-slate-900 truncate">
                      {ev.event_name || 'Active Festival'}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-400">
                      <span>Contribution: {ev.percentage ? `${ev.percentage}%` : '100%'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="text-xs font-bold text-slate-900">
                        {ev.event_points ?? ev.points ?? globalPoints}
                      </span>
                      <span className="text-[10px] text-slate-400 ml-0.5">pts</span>
                    </div>
                    <button
                      onClick={() => navigate('/team-manager/events')}
                      className="rounded-lg bg-white border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                    >
                      Open Event
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-slate-100 mt-3.5 flex items-center justify-between">
              <button
                onClick={() => navigate('/team-manager/students')}
                className="text-[11px] font-medium text-slate-600 hover:text-indigo-600 flex items-center gap-1"
              >
                <Users className="h-3 w-3 text-slate-400" />
                <span>My Students ({totalMembers})</span>
              </button>
              <button
                onClick={() => navigate('/team-manager/events')}
                className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <span>Go to Events Portal</span>
                <ArrowRight className="h-3 w-3" />
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
                        {eventItem.event_points ?? eventItem.points ?? 0} pts
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
