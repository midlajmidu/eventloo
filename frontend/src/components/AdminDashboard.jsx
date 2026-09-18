import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Activity,
  AlignLeft,
  CalendarDays,
  GraduationCap,
  Sparkles,
  Trophy,
  UsersRound,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { dashboardAPI } from '../services/api';

const MetricCard = ({ label, value, detail, icon: Icon, accent }) => (
  <div className="group rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_30px_rgba(15,23,42,0.07)]">
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{value}</p>
        <p className="mt-2 text-xs font-medium text-slate-500">{detail}</p>
      </div>
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" strokeWidth={1.8} />
      </div>
    </div>
  </div>
);

const StudentRadarTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const item = payload[0]?.payload;
  return (
    <div className="rounded-xl border border-slate-200 bg-white/95 px-4 py-3 shadow-xl backdrop-blur">
      <p className="text-sm font-semibold text-slate-900">{item?.fullName}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        Students <span className="ml-1 font-semibold text-indigo-600">{item?.students || 0}</span>
      </p>
    </div>
  );
};

const CATEGORY_COLORS = ['#4f46e5', '#0891b2', '#059669', '#d97706', '#e11d48', '#7c3aed'];

const AdminDashboard = () => {
  const { user } = useOutletContext();
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      setError('');
      const { data } = await dashboardAPI.getAdminSummary();
      setDashboardData(data);
    } catch (requestError) {
      console.error('Failed to fetch dashboard data:', requestError);
      setError('The dashboard could not be loaded. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const studentsByTeam = useMemo(() => (
    (dashboardData?.studentsByTeam || []).map((team) => ({
      ...team,
      fullName: team.name,
      name: team.name.length > 18 ? `${team.name.slice(0, 17)}…` : team.name,
      students: Number(team.students || 0),
    }))
  ), [dashboardData]);

  const leadingTeam = useMemo(() => (
    [...(dashboardData?.pointsByTeam || [])].sort(
      (first, second) => Number(second.points || 0) - Number(first.points || 0),
    )[0]
  ), [dashboardData]);

  const participantsByCategory = useMemo(() => (
    (dashboardData?.participantsByCategory || []).map((category, index) => ({
      ...category,
      participants: Number(category.participants || 0),
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length],
    }))
  ), [dashboardData]);

  const totalEvents = Number(dashboardData?.totalEvents || 0);
  const activeEvents = Number(dashboardData?.activeEvents || 0);
  const completedEvents = Number(dashboardData?.completedEvents || 0);
  const totalStudents = Number(dashboardData?.totalStudents || 0);
  const assignedStudents = Number(dashboardData?.studentsInTeams || 0);
  const unassignedStudents = Number(dashboardData?.unassignedStudents || 0);
  const totalTeams = Number(dashboardData?.totalTeams || 0);
  const radarHeight = Math.min(440, Math.max(350, 320 + studentsByTeam.length * 8));
  const categoryChartHeight = Math.min(440, Math.max(350, participantsByCategory.length * 54 + 90));

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-slate-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-slate-50 px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <Activity className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-lg font-semibold text-slate-900">Unable to load dashboard</h2>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <button
            type="button"
            onClick={fetchDashboardData}
            className="mt-5 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
              <Sparkles className="h-3.5 w-3.5" />
              School overview
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              {user?.school?.name || 'Your school'} at a glance.
            </p>
          </div>
          <div className="text-left sm:text-right">
            <p className="text-xs font-medium text-slate-400">Updated today</p>
            <p className="mt-1 text-sm font-semibold text-slate-700">
              {new Date().toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Events"
            value={totalEvents}
            detail={`${activeEvents} active · ${completedEvents} completed`}
            icon={CalendarDays}
            accent="bg-blue-50 text-blue-600"
          />
          <MetricCard
            label="Teams"
            value={totalTeams}
            detail={`${studentsByTeam.length} represented below`}
            icon={UsersRound}
            accent="bg-violet-50 text-violet-600"
          />
          <MetricCard
            label="Students"
            value={totalStudents}
            detail={`${assignedStudents} in teams · ${unassignedStudents} unassigned`}
            icon={GraduationCap}
            accent="bg-emerald-50 text-emerald-600"
          />
          <MetricCard
            label="Leading Team"
            value={leadingTeam?.name || '—'}
            detail={leadingTeam ? `${leadingTeam.points || 0} global points` : 'No published points yet'}
            icon={Trophy}
            accent="bg-amber-50 text-amber-600"
          />
        </section>

        <section className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">Students by Team</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Every registered team member, including students without program assignments.
                </p>
              </div>
              <div className="flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
                {assignedStudents} students in teams
              </div>
            </div>

            {studentsByTeam.length ? (
              <div className="px-2 py-4 sm:px-5">
                <div style={{ height: radarHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={studentsByTeam} outerRadius="68%" margin={{ top: 30, right: 60, bottom: 30, left: 60 }}>
                      <PolarGrid stroke="#dbe2ea" radialLines />
                      <PolarAngleAxis
                        dataKey="name"
                        tick={{ fill: '#64748b', fontSize: 12, fontWeight: 500 }}
                        tickLine={false}
                      />
                      <PolarRadiusAxis
                        angle={90}
                        allowDecimals={false}
                        axisLine={false}
                        tick={{ fill: '#94a3b8', fontSize: 10 }}
                        tickCount={5}
                      />
                      <Tooltip content={<StudentRadarTooltip />} />
                      <Radar
                        name="Students"
                        dataKey="students"
                        stroke="#4f46e5"
                        strokeWidth={2.5}
                        fill="#6366f1"
                        fillOpacity={0.18}
                        dot={{ r: 4, fill: '#4f46e5', stroke: '#fff', strokeWidth: 2 }}
                        activeDot={{ r: 6, fill: '#4338ca', stroke: '#fff', strokeWidth: 2 }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[360px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <UsersRound className="h-6 w-6" />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800">No teams created yet</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                  Team student distribution will appear here after students are added to teams.
                </p>
              </div>
            )}
          </article>

          <article className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div>
                <h2 className="text-lg font-semibold tracking-tight text-slate-950">Participants by Category</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Unique students assigned to at least one event program.
                </p>
              </div>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <AlignLeft className="h-4.5 w-4.5" strokeWidth={1.8} />
              </div>
            </div>

            {participantsByCategory.length ? (
              <div className="px-3 py-4 sm:px-5">
                <div style={{ height: categoryChartHeight }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={participantsByCategory}
                      layout="vertical"
                      margin={{ top: 14, right: 34, bottom: 14, left: 16 }}
                      barCategoryGap="24%"
                    >
                      <CartesianGrid horizontal={false} stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={112}
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
                      />
                      <Tooltip
                        cursor={{ fill: '#f8fafc' }}
                        formatter={(value) => [value, 'Participants']}
                        contentStyle={{ borderRadius: 12, borderColor: '#e2e8f0', boxShadow: '0 12px 30px rgba(15,23,42,.08)' }}
                      />
                      <Bar dataKey="participants" radius={[0, 8, 8, 0]} maxBarSize={38}>
                        {participantsByCategory.map((category) => (
                          <Cell key={category.id || category.code} fill={category.color} />
                        ))}
                        <LabelList dataKey="participants" position="right" fill="#475569" fontSize={12} fontWeight={700} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <div className="flex min-h-[350px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500">
                  <AlignLeft className="h-6 w-6" />
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800">No categories available</p>
                <p className="mt-1 max-w-xs text-xs leading-5 text-slate-500">
                  Participant totals will appear after categories and program assignments are created.
                </p>
              </div>
            )}
          </article>
        </section>

      </div>
    </main>
  );
};

export default AdminDashboard;
