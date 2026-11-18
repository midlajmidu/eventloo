import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  ArrowRight,
  ChevronRight,
  QrCode,
  ExternalLink,
  Copy,
  Check,
  X,
  Download,
  BookOpen,
  UserCheck,
  Users,
  Shield,
  Award,
  Layers,
  Flag,
} from 'lucide-react';
import { eventReportsAPI, eventPointsAPI, eventStagesAPI, publicEventAPI } from '../../services/api';
import EventlooLogo from '../common/EventlooLogo';
import { downloadEventQrPoster } from '../../utils/qrPosterGenerator';

const CATEGORY_COLORS = [
  {
    bar: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
    dot: 'bg-indigo-500',
    badge: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
    text: 'text-indigo-600',
  },
  {
    bar: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
    text: 'text-emerald-600',
  },
  {
    bar: 'bg-gradient-to-r from-amber-500 to-orange-500',
    dot: 'bg-amber-500',
    badge: 'bg-amber-50 text-amber-700 border-amber-200/80',
    text: 'text-amber-600',
  },
  {
    bar: 'bg-gradient-to-r from-purple-500 to-violet-600',
    dot: 'bg-purple-500',
    badge: 'bg-purple-50 text-purple-700 border-purple-200/80',
    text: 'text-purple-600',
  },
  {
    bar: 'bg-gradient-to-r from-rose-500 to-pink-500',
    dot: 'bg-rose-500',
    badge: 'bg-rose-50 text-rose-700 border-rose-200/80',
    text: 'text-rose-600',
  },
  {
    bar: 'bg-gradient-to-r from-sky-500 to-cyan-500',
    dot: 'bg-sky-500',
    badge: 'bg-sky-50 text-sky-700 border-sky-200/80',
    text: 'text-sky-600',
  },
];

const EventOverview = ({ event, eventId, onRefresh, categories = [], setActiveTab }) => {
  const [analytics, setAnalytics] = useState(null);
  const [teamPoints, setTeamPoints] = useState([]);
  const [stages, setStages] = useState([]);
  const [portalData, setPortalData] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);

  useEffect(() => {
    fetchExtraData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchExtraData = async () => {
    try {
      const [analyticsRes, pointsRes, stagesRes, portalRes] = await Promise.allSettled([
        eventReportsAPI.getEventAnalytics(eventId),
        eventPointsAPI.getEventTeamPoints(eventId),
        eventStagesAPI.list(eventId),
        publicEventAPI.getPublicPortal(eventId),
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
      if (portalRes.status === 'fulfilled') {
        setPortalData(portalRes.value.data || null);
      }
    } catch (err) {
      console.error('Error fetching event overview extra data:', err);
    }
  };

  const handleCopyPublicUrl = () => {
    const url = portalData?.public_url || `${window.location.origin}/events/${eventId}/public`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const eventLogoUrl = event?.logo || event?.event_logo || portalData?.event?.logo || portalData?.event?.event_logo;

  const handleDownloadQrPoster = async () => {
    try {
      setDownloadingQr(true);
      const logoUrl = eventLogoUrl
        ? (eventLogoUrl.startsWith('http') ? eventLogoUrl : `${window.location.origin}${eventLogoUrl}`)
        : null;
      await downloadEventQrPoster({
        event,
        portalData,
        publicUrl: portalData?.public_url || `${window.location.origin}/events/${eventId}/public`,
        eventId,
        eventLogoUrl: logoUrl,
        filename: `${(event?.title || 'Festival').replace(/[^a-zA-Z0-9_-]/g, '_')}_Official_QR_Poster.png`
      });
    } catch (err) {
      console.error('Failed to download QR Poster PNG:', err);
      alert('Unable to generate QR Poster. Please try again.');
    } finally {
      setDownloadingQr(false);
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

  // Derive counts from event data
  const programs = event?.programs || [];
  const totalPrograms = analytics?.total_programs ?? programs.length;
  const completedPrograms = analytics?.completed_programs ?? programs.filter(p => p.is_published || p.is_finished).length;
  const stagePrograms = programs.filter(p => p.stage || p.is_stage).length;
  const offStagePrograms = totalPrograms > stagePrograms ? totalPrograms - stagePrograms : 0;
  
  const totalParticipants = analytics?.total_participants ?? event?.current_participants ?? 0;
  const totalTeams = analytics?.total_teams ?? event?.current_teams ?? 0;
  const totalStages = stages.length;

  const completionPercent = totalPrograms > 0 ? Math.round((completedPrograms / totalPrograms) * 100) : 0;

  // Maximum programs count among categories for relative bar graph widths
  const maxProgCount = Math.max(1, ...categories.map(c => {
    const code = c.code || c.id;
    return programs.filter(p => p.category === code).length;
  }));

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
    <div className="p-4 sm:p-6 space-y-5 bg-[#f7f8fb]">
      
      {/* ========================================================================= */}
      {/* 1. CLEAN ALL-WHITE EVENT HEADER                                           */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600">
              Event Overview
            </span>
            <span className="text-slate-300">·</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
              event?.status === 'published' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
              event?.status === 'ongoing' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
              event?.status === 'completed' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
              'bg-amber-50 text-amber-700 border border-amber-200'
            }`}>
              {event?.status || 'Draft'}
            </span>
            {event?.is_schedule_published && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                Schedule Live
              </span>
            )}
          </div>

          <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900">
            {event?.title || 'Event Dashboard'}
          </h1>

          <p className="text-xs text-slate-500 mt-1">
            {formatDate(event?.start_date)} {event?.end_date && event?.end_date !== event?.start_date ? `– ${formatDate(event?.end_date)}` : ''} · {event?.venue || 'Campus Venue'}
          </p>
        </div>

        {/* Header Actions */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={handleManualRefresh}
            disabled={refreshing}
            title="Refresh dashboard stats"
            className="p-2 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 border border-slate-200/80 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setActiveTab('programs')}
            className="px-3.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Manage Programs</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. PUBLIC LIVE RESULTS PORTAL & QR BANNER (TOP BANNER)                    */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-900">
                Public Live Results & Schedule Portal
              </h4>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                Live URL
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
              Share with students, parents, and attendees to track published program results, live team points, and schedules.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
          <button
            onClick={() => setShowQrModal(true)}
            className="px-3.5 py-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer shadow-2xs"
          >
            <QrCode className="w-3.5 h-3.5 text-slate-500" />
            <span>Show QR</span>
          </button>
          <a
            href={`/events/${eventId}/public`}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold flex items-center gap-2 transition-colors shadow-2xs"
          >
            <span>Open Portal</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. METRIC CARDS (REAL UI ICONS, ALL-WHITE SURFACES)                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Programs */}
        <div
          onClick={() => setActiveTab('programs')}
          className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Programs</p>
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shrink-0">
              <BookOpen className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{totalPrograms}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-normal">
            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{stagePrograms} Stage · {offStagePrograms} Off-Stage</span>
          </div>
        </div>

        {/* Registered Participants */}
        <div
          onClick={() => setActiveTab('participants')}
          className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Participants</p>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-emerald-600 shrink-0">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{totalParticipants}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-normal">
            <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{event?.max_participants ? `Cap: ${event.max_participants}` : 'Unlimited capacity'}</span>
          </div>
        </div>

        {/* Competing Teams */}
        <div
          onClick={() => setActiveTab('points')}
          className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Teams</p>
            <div className="w-8 h-8 rounded-lg bg-violet-50 border border-violet-100/80 flex items-center justify-center text-violet-600 shrink-0">
              <Shield className="w-4 h-4" />
            </div>
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{totalTeams}</p>
          <div className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 font-normal">
            <Flag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">{event?.is_team_based ? 'Team-based scoring' : 'Individual events'}</span>
          </div>
        </div>

        {/* Completed & Scored */}
        <div
          onClick={() => setActiveTab('results')}
          className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Completed & Scored</p>
            <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100/80 flex items-center justify-center text-amber-600 shrink-0">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between mt-1.5">
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              {completedPrograms}
              <span className="text-sm font-normal text-slate-400"> / {totalPrograms}</span>
            </p>
            <span className="text-xs font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/80">
              {completionPercent}%
            </span>
          </div>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-amber-500 h-1.5 rounded-full"
              style={{ width: `${Math.min(100, completionPercent)}%` }}
            />
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 3. TWO-COLUMN MINIMAL LAYOUT (ALL-WHITE SURFACES)                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Column (2 Cols): Categories Breakdown (Colored Bar Graph) */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Categories Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Categories Breakdown
                </h3>
                <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                  {categories.length} Categories
                </span>
              </div>
              <button
                onClick={() => setActiveTab('programs')}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
              >
                <span>View all</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {categories && categories.length > 0 ? (
              <div className="space-y-3.5">
                {categories.map((cat, idx) => {
                  const catCode = cat.code || cat.id;
                  const catPrograms = programs.filter(p => p.category === catCode);
                  const progCount = catPrograms.length;
                  const analyticsCat = analytics?.category_stats?.[catCode];
                  const partCount = analyticsCat?.participants ?? catPrograms.reduce((acc, p) => acc + (p.participants_count || 0), 0);
                  const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                  const progPct = totalPrograms > 0 ? Math.round((progCount / totalPrograms) * 100) : 0;
                  const barWidthPct = maxProgCount > 0 ? Math.round((progCount / maxProgCount) * 100) : 0;

                  return (
                    <div
                      key={catCode}
                      className="p-3.5 rounded-xl border border-slate-100 hover:border-slate-200/90 hover:bg-slate-50/40 transition-all space-y-2.5"
                    >
                      {/* Category Header Info */}
                      <div className="flex items-center justify-between text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`w-2.5 h-2.5 rounded-full ${color.dot} shrink-0`} />
                          <span className="font-bold text-slate-900 truncate">
                            {cat.name}
                          </span>
                          <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase tracking-wider ${color.badge} shrink-0`}>
                            {catCode}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5 shrink-0">
                          <span className="text-[11px] text-slate-400 hidden sm:inline">
                            {partCount} registered entries
                          </span>
                          <span className="text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded-md border border-slate-200/70 shadow-2xs">
                            {progCount} <span className="text-[10px] font-medium text-slate-400">progs ({progPct}%)</span>
                          </span>
                        </div>
                      </div>

                      {/* The Colored Bar Graph Track */}
                      <div className="w-full bg-slate-100/90 rounded-full h-2.5 overflow-hidden p-0.5">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${color.bar}`}
                          style={{ width: `${Math.max(progCount > 0 ? 5 : 0, barWidthPct)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}

                {/* Footer summary legend */}
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100">
                  <span>Total festival load</span>
                  <span className="font-semibold text-slate-600">
                    {totalPrograms} total programs · {totalParticipants} participants
                  </span>
                </div>
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
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Team Standings
              </h3>
              <button
                onClick={() => setActiveTab('points')}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
              >
                <span>Full Board</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {teamPoints && teamPoints.length > 0 ? (
              <div className="space-y-1.5">
                {teamPoints.slice(0, 5).map((team, idx) => {
                  const rank = idx + 1;
                  return (
                    <div
                      key={team.team_id || team.id || idx}
                      className={`p-2.5 rounded-lg border transition-colors flex items-center justify-between gap-2.5 ${
                        rank === 1
                          ? 'border-amber-200/80 bg-amber-50/40'
                          : rank === 2
                          ? 'border-slate-200 bg-slate-50/50'
                          : rank === 3
                          ? 'border-amber-100 bg-amber-50/20'
                          : 'border-slate-100 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {rank === 1 ? (
                          <span
                            className="w-6 h-6 rounded-md bg-amber-100/80 border border-amber-300 text-amber-700 font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs"
                            title="1st Place - Gold"
                          >
                            <span className="text-sm">🥇</span>
                          </span>
                        ) : rank === 2 ? (
                          <span
                            className="w-6 h-6 rounded-md bg-slate-200/70 border border-slate-300 text-slate-700 font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs"
                            title="2nd Place - Silver"
                          >
                            <span className="text-sm">🥈</span>
                          </span>
                        ) : rank === 3 ? (
                          <span
                            className="w-6 h-6 rounded-md bg-amber-100/60 border border-amber-300/80 text-amber-800 font-extrabold text-xs flex items-center justify-center shrink-0 shadow-2xs"
                            title="3rd Place - Bronze"
                          >
                            <span className="text-sm">🥉</span>
                          </span>
                        ) : (
                          <span className="w-6 h-6 rounded-md text-[11px] font-bold text-slate-500 bg-slate-100 border border-slate-200/70 flex items-center justify-center shrink-0">
                            #{rank}
                          </span>
                        )}
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {team.team_name || team.name || 'Team'}
                        </span>
                      </div>

                      <span className={`text-xs shrink-0 ${
                        rank === 1 ? 'font-extrabold text-amber-700' : 'font-bold text-slate-900'
                      }`}>
                        {team.total_points ?? team.points ?? 0} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-6 text-center text-xs text-slate-400">
                Points will calculate automatically once marks are published.
              </div>
            )}
          </div>

          {/* Stages & Venue Setup */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Stages & Venues ({totalStages})
              </h3>
              <button
                onClick={() => setActiveTab('stages')}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
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
                    className="p-2 rounded-lg border border-slate-100 flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-slate-800 truncate">{stg.name}</span>
                    <span className="text-[11px] text-slate-400 shrink-0">{stg.location || stg.room || 'Main Ground'}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-xs text-slate-400 text-center py-4">
                No stages added yet.
              </div>
            )}
          </div>

        </div>

      </div>

      {/* ========================================================================= */}
      {/* 4. MODAL: QR PASS FOR LIVE EVENT PORTAL                                  */}
      {/* ========================================================================= */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 sm:p-7 max-w-sm w-full text-center shadow-2xl relative animate-in fade-in zoom-in-95">
            {/* Top Close Button */}
            <button
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* 1. TOP: Official Event Logo */}
            {eventLogoUrl ? (
              <div className="flex justify-center pt-1 mb-2.5">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border border-slate-200/80 p-1.5 bg-white shadow-2xs flex items-center justify-center overflow-hidden">
                  <img
                    src={eventLogoUrl}
                    alt={event?.title || 'Event Logo'}
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            ) : (
              <div className="flex justify-center pt-1 mb-2.5">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-cyan-500 text-white flex items-center justify-center font-extrabold text-2xl shadow-sm">
                  {((event?.title || 'E').trim().charAt(0) || 'E').toUpperCase()}
                </div>
              </div>
            )}

            {/* Event Title & Subtitle */}
            <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {event?.title || 'Gravitas'}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 tracking-[0.22em] uppercase mt-0.5">
              {event?.venue || 'CAMPUS FESTIVAL'}
            </p>

            {/* Accent Bar in Eventloo Indigo */}
            <div className="w-8 h-1 rounded-full bg-indigo-600 mx-auto mt-2.5 mb-1" />

            {/* Rounded QR Code Frame with Camera Focus Brackets */}
            <div className="w-64 h-64 mx-auto p-4 bg-white rounded-2xl border border-indigo-100/80 shadow-xs flex items-center justify-center relative my-4">
              <div className="absolute top-3 left-3 w-6 h-6 border-t-[3.5px] border-l-[3.5px] border-indigo-600 rounded-tl-md pointer-events-none" />
              <div className="absolute top-3 right-3 w-6 h-6 border-t-[3.5px] border-r-[3.5px] border-indigo-600 rounded-tr-md pointer-events-none" />
              <div className="absolute bottom-3 left-3 w-6 h-6 border-b-[3.5px] border-l-[3.5px] border-indigo-600 rounded-bl-md pointer-events-none" />
              <div className="absolute bottom-3 right-3 w-6 h-6 border-b-[3.5px] border-r-[3.5px] border-indigo-600 rounded-br-md pointer-events-none" />

              {portalData?.qr_code_svg ? (
                <div
                  dangerouslySetInnerHTML={{ __html: portalData.qr_code_svg }}
                  className="w-full h-full flex items-center justify-center p-1.5"
                />
              ) : (
                <div className="text-xs text-slate-400">Loading QR Code...</div>
              )}
            </div>

            {/* Heading & Description after QR Code (Template Match) */}
            <div className="my-4 px-1">
              <h4 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">
                View Your Public Event Page
              </h4>
              <p className="text-xs sm:text-[13px] text-slate-500 font-medium mt-1 leading-relaxed">
                Explore the event results, schedule, and points table for {event?.title || 'this event'}.
              </p>
            </div>

            {/* Primary Action: Download Poster (PNG) */}
            <div className="space-y-3">
              <button
                onClick={handleDownloadQrPoster}
                disabled={downloadingQr}
                className="w-full py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                <Download className={`w-4 h-4 ${downloadingQr ? 'animate-bounce' : ''}`} />
                <span>{downloadingQr ? 'Generating Poster...' : 'Download QR Poster (PNG)'}</span>
              </button>

              <div className="flex items-center justify-center gap-4 text-xs font-semibold">
                <a
                  href={`/events/${eventId}/public`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:text-indigo-800 transition-colors inline-flex items-center gap-1"
                >
                  <span>Open Public Portal</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* 2. BOTTOM: Eventloo Logo Placed at Down */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase">Powered by</span>
                <EventlooLogo size="sm" showSubtitle={false} />
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EventOverview;
