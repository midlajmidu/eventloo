import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Users,
  UserCheck,
  MapPinned,
  CalendarClock,
  Trophy,
  Edit3,
  FileText,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Clock,
  Layers,
  RefreshCw,
  Calendar,
  MapPin,
  ShieldCheck,
  TrendingUp,
  Award,
  ChevronRight,
  Activity,
  AlertCircle
} from 'lucide-react';
import { eventReportsAPI, eventPointsAPI, eventStagesAPI } from '../../services/api';

const EventOverview = ({ event, eventId, onRefresh, categories = [], setActiveTab }) => {
  const [analytics, setAnalytics] = useState(null);
  const [teamPoints, setTeamPoints] = useState([]);
  const [stages, setStages] = useState([]);
  const [loadingExtra, setLoadingExtra] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchExtraData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchExtraData = async () => {
    try {
      setLoadingExtra(true);
      const [analyticsRes, pointsRes, stagesRes] = await Promise.allSettled([
        eventReportsAPI.getEventAnalytics(eventId),
        eventPointsAPI.getEventTeamPoints(eventId),
        eventStagesAPI.list(eventId),
      ]);

      if (analyticsRes.status === 'fulfilled') {
        setAnalytics(analyticsRes.value.data || null);
      }
      if (pointsRes.status === 'fulfilled') {
        const rawPoints = pointsRes.value.data?.results || pointsRes.value.data || [];
        setTeamPoints(rawPoints);
      }
      if (stagesRes.status === 'fulfilled') {
        const rawStages = stagesRes.value.data?.results || stagesRes.value.data || [];
        setStages(rawStages);
      }
    } catch (err) {
      console.error('Error fetching event overview extra data:', err);
    } finally {
      setLoadingExtra(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      if (onRefresh) await onRefresh();
      await fetchExtraData();
    } finally {
      setRefreshing(false);
    }
  };

  // Derive immediate counts from event.programs
  const programs = event?.programs || [];
  const totalPrograms = analytics?.total_programs ?? programs.length;
  const completedPrograms = analytics?.completed_programs ?? programs.filter(p => p.is_published || p.is_finished).length;
  const stagePrograms = programs.filter(p => p.stage || p.is_stage).length;
  const offStagePrograms = totalPrograms > stagePrograms ? totalPrograms - stagePrograms : 0;
  
  const totalParticipants = analytics?.total_participants ?? event?.current_participants ?? 0;
  const totalTeams = analytics?.total_teams ?? event?.current_teams ?? 0;
  const totalStages = stages.length;

  const completionPercent = totalPrograms > 0 ? Math.round((completedPrograms / totalPrograms) * 100) : 0;

  // Format dates
  const formatDate = (isoString) => {
    if (!isoString) return 'TBD';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* ========================================================================= */}
      {/* 1. TOP EVENT BANNER & STATUS SUMMARY                                      */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-widest bg-white/10 text-indigo-200 border border-white/10">
              Event Overview
            </span>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider ${
              event?.status === 'published' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' :
              event?.status === 'ongoing' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' :
              event?.status === 'completed' ? 'bg-slate-500/20 text-slate-300 border border-slate-500/30' :
              'bg-amber-500/20 text-amber-300 border border-amber-500/30'
            }`}>
              {event?.status || 'Draft'}
            </span>
            {event?.is_schedule_published && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span>Schedule Live</span>
              </span>
            )}
          </div>

          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
            {event?.title || 'Event Dashboard'}
          </h2>

          <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-300">
            <span className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <span>{formatDate(event?.start_date)} {event?.end_date && event?.end_date !== event?.start_date ? `– ${formatDate(event?.end_date)}` : ''}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-indigo-400" />
              <span>{event?.venue || 'Campus Venue'}</span>
            </span>
            {event?.registration_deadline && (
              <span className="flex items-center gap-1.5 text-amber-300/90">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Reg. Deadline: {formatDate(event?.registration_deadline)}</span>
              </span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2 self-start md:self-auto shrink-0">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            title="Refresh dashboard stats"
            className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/10 transition-colors shadow-2xs flex items-center justify-center cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setActiveTab('programs')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
          >
            <span>Manage Programs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CORE METRICS ROW (4 KEY KPI CARDS)                                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Programs */}
        <div
          onClick={() => setActiveTab('programs')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group hover:border-indigo-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-indigo-600 transition-colors">
              Total Programs
            </span>
            <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {totalPrograms}
            </span>
            <span className="text-xs text-slate-400 font-medium">events</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span>{stagePrograms} Stage · {offStagePrograms} Off-Stage</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Registered Participants */}
        <div
          onClick={() => setActiveTab('participants')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group hover:border-emerald-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-emerald-600 transition-colors">
              Participants
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {totalParticipants}
            </span>
            <span className="text-xs text-slate-400 font-medium">registered</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span>{event?.max_participants ? `Cap: ${event.max_participants}` : 'Unlimited Cap'}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Participating Teams */}
        <div
          onClick={() => setActiveTab('points')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group hover:border-amber-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-amber-600 transition-colors">
              Teams
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {totalTeams}
            </span>
            <span className="text-xs text-slate-400 font-medium">competing</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <span>{event?.is_team_based ? 'Team-based scoring' : 'Individual event'}</span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

        {/* Completion & Results */}
        <div
          onClick={() => setActiveTab('results')}
          className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-2xs hover:shadow-md transition-all cursor-pointer group hover:border-purple-200"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 group-hover:text-purple-600 transition-colors">
              Completed & Scored
            </span>
            <div className="w-8 h-8 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
              <Trophy className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2.5 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-black text-slate-900">
              {completedPrograms}
              <span className="text-sm font-bold text-slate-400">/{totalPrograms}</span>
            </span>
            <span className="text-xs font-bold text-purple-600">{completionPercent}%</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 border-t border-slate-100 pt-2">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden mr-2">
              <div
                className="bg-purple-600 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, completionPercent)}%` }}
              />
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:translate-x-0.5 transition-transform" />
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. TWO-COLUMN SPLIT: CATEGORIES & QUICK ACTIONS vs STANDINGS & SCHEDULE  */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Column (2 Cols): Quick Actions + Categories Breakdown */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Quick Actions Shortcuts */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-indigo-600" />
                <span>Quick Operations</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">Direct Shortcuts</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => setActiveTab('programs')}
                className="p-3 rounded-xl border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left flex items-start gap-2.5 cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                  <BookOpen className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-indigo-700">Programs</span>
                  <span className="text-[10px] text-slate-400 truncate block">Add & edit events</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('schedule')}
                className="p-3 rounded-xl border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left flex items-start gap-2.5 cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                  <CalendarClock className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-indigo-700">Schedule</span>
                  <span className="text-[10px] text-slate-400 truncate block">Stages & timeline</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('assignments')}
                className="p-3 rounded-xl border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left flex items-start gap-2.5 cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-indigo-700">Assignments</span>
                  <span className="text-[10px] text-slate-400 truncate block">Assign students</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('mark-entry')}
                className="p-3 rounded-xl border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left flex items-start gap-2.5 cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-indigo-700">Mark Entry</span>
                  <span className="text-[10px] text-slate-400 truncate block">Judge scores</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('documents')}
                className="p-3 rounded-xl border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left flex items-start gap-2.5 cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-indigo-700">Documents</span>
                  <span className="text-[10px] text-slate-400 truncate block">Calling sheets & PDFs</span>
                </div>
              </button>

              <button
                onClick={() => setActiveTab('certificates')}
                className="p-3 rounded-xl border border-slate-200/70 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all text-left flex items-start gap-2.5 cursor-pointer group"
              >
                <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <span className="text-xs font-bold text-slate-900 block truncate group-hover:text-indigo-700">Badges & Certs</span>
                  <span className="text-[10px] text-slate-400 truncate block">Physical 9-per-A4 PDF</span>
                </div>
              </button>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>Categories Breakdown</span>
              </h3>
              <button
                onClick={() => setActiveTab('programs')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {categories && categories.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {categories.map((cat) => {
                  const catCode = cat.code || cat.id;
                  const catPrograms = programs.filter(p => p.category === catCode);
                  const progCount = catPrograms.length;
                  const analyticsCat = analytics?.category_stats?.[catCode];
                  const partCount = analyticsCat?.participants ?? catPrograms.reduce((acc, p) => acc + (p.participants_count || 0), 0);

                  return (
                    <div
                      key={catCode}
                      className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-200/60 flex items-center justify-between gap-3 hover:bg-slate-100/70 transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-indigo-100 text-indigo-700 shrink-0">
                            {catCode}
                          </span>
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {cat.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500 block mt-1">
                          {partCount} registered entries
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-base font-black text-slate-900 block leading-tight">
                          {progCount}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">programs</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 text-xs text-slate-400">
                No student categories configured.
              </div>
            )}
          </div>

        </div>

        {/* Right Column (1 Col): Team Leaderboard & Stages Info */}
        <div className="space-y-5">
          
          {/* Team Points Leaderboard Preview */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3.5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Award className="w-3.5 h-3.5 text-amber-500" />
                <span>Team Standings</span>
              </h3>
              <button
                onClick={() => setActiveTab('points')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
              >
                <span>Full Board</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {teamPoints && teamPoints.length > 0 ? (
              <div className="space-y-2">
                {teamPoints.slice(0, 5).map((team, idx) => {
                  const rank = idx + 1;
                  return (
                    <div
                      key={team.team_id || team.id || idx}
                      className="p-2.5 rounded-xl bg-slate-50/90 border border-slate-200/60 flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center shrink-0 ${
                          rank === 1 ? 'bg-amber-100 text-amber-800 border border-amber-300' :
                          rank === 2 ? 'bg-slate-200 text-slate-800' :
                          rank === 3 ? 'bg-orange-100 text-orange-800' :
                          'bg-slate-100 text-slate-600'
                        }`}>
                          #{rank}
                        </span>
                        <div className="truncate">
                          <span className="text-xs font-bold text-slate-900 block truncate">
                            {team.team_name || team.name || 'Team'}
                          </span>
                          <span className="text-[10px] text-slate-400 block">
                            {team.programs_won ? `${team.programs_won} wins` : 'Competing'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-xs font-black border border-indigo-200/60">
                          {team.total_points ?? team.points ?? 0} pts
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-slate-400 bg-slate-50/80 rounded-xl border border-slate-100">
                Points will calculate automatically once marks and results are published.
              </div>
            )}
          </div>

          {/* Stages & Venue Setup */}
          <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-2xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <MapPinned className="w-3.5 h-3.5 text-indigo-600" />
                <span>Stages & Venues ({totalStages})</span>
              </h3>
              <button
                onClick={() => setActiveTab('stages')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5"
              >
                <span>Manage</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {stages && stages.length > 0 ? (
              <div className="space-y-1.5">
                {stages.slice(0, 4).map((stg) => (
                  <div
                    key={stg.id}
                    className="p-2 rounded-lg bg-slate-50 border border-slate-200/50 flex items-center justify-between text-xs"
                  >
                    <span className="font-bold text-slate-800 truncate">{stg.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">{stg.location || stg.room || 'Main Ground'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 text-center py-4 bg-slate-50 rounded-xl">
                No stages added yet.
              </div>
            )}
          </div>

        </div>

      </div>

    </div>
  );
};

export default EventOverview;
