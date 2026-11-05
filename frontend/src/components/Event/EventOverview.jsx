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
  Download
} from 'lucide-react';
import { eventReportsAPI, eventPointsAPI, eventStagesAPI, publicEventAPI } from '../../services/api';
import EventlooLogo from '../common/EventlooLogo';
import { downloadEventQrPoster } from '../../utils/qrPosterGenerator';

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

  const handleDownloadQrPoster = async () => {
    try {
      setDownloadingQr(true);
      await downloadEventQrPoster({
        event,
        portalData,
        publicUrl: portalData?.public_url || `${window.location.origin}/events/${eventId}/public`,
        eventId,
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
      {/* 2. MINIMAL METRIC CARDS (ALL-WHITE, MATCHING APP DASHBOARDS)               */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        
        {/* Total Programs */}
        <div
          onClick={() => setActiveTab('programs')}
          className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:border-slate-300 transition duration-200 hover:-translate-y-0.5 cursor-pointer"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total Programs</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{totalPrograms}</p>
          <p className="mt-1 text-xs text-slate-500 font-normal">
            {stagePrograms} Stage · {offStagePrograms} Off-Stage
          </p>
        </div>

        {/* Registered Participants */}
        <div
          onClick={() => setActiveTab('participants')}
          className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:border-slate-300 transition duration-200 hover:-translate-y-0.5 cursor-pointer"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Participants</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{totalParticipants}</p>
          <p className="mt-1 text-xs text-slate-500 font-normal">
            {event?.max_participants ? `Cap: ${event.max_participants}` : 'Unlimited capacity'}
          </p>
        </div>

        {/* Competing Teams */}
        <div
          onClick={() => setActiveTab('points')}
          className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:border-slate-300 transition duration-200 hover:-translate-y-0.5 cursor-pointer"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Teams</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{totalTeams}</p>
          <p className="mt-1 text-xs text-slate-500 font-normal">
            {event?.is_team_based ? 'Team-based scoring' : 'Individual events'}
          </p>
        </div>

        {/* Completed & Scored */}
        <div
          onClick={() => setActiveTab('results')}
          className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-2xs hover:border-slate-300 transition duration-200 hover:-translate-y-0.5 cursor-pointer"
        >
          <div className="flex items-baseline justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Completed & Scored</p>
            <span className="text-xs font-semibold text-indigo-600">{completionPercent}%</span>
          </div>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">
            {completedPrograms}
            <span className="text-sm font-normal text-slate-400"> / {totalPrograms}</span>
          </p>
          <div className="mt-2 w-full bg-slate-100 rounded-full h-1 overflow-hidden">
            <div
              className="bg-indigo-600 h-1 rounded-full transition-all duration-300"
              style={{ width: `${Math.min(100, completionPercent)}%` }}
            />
          </div>
        </div>

      </div>

      {/* ========================================================================= */}
      {/* 2.5 PUBLIC LIVE RESULTS PORTAL & QR BANNER (ALL-WHITE MINIMAL)            */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center justify-center shrink-0">
            <QrCode className="w-5 h-5 text-indigo-600" />
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
            <p className="text-[11px] text-slate-400 mt-0.5 truncate">
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
      {/* 3. TWO-COLUMN MINIMAL LAYOUT (ALL-WHITE SURFACES)                         */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* Left Column (2 Cols): Quick Operations + Categories Breakdown */}
        <div className="lg:col-span-2 space-y-5">
          
          {/* Quick Operations Shortcuts */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Quick Operations
              </h3>
              <span className="text-xs text-slate-400">Direct Navigation</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <button
                onClick={() => setActiveTab('programs')}
                className="p-3 rounded-lg border border-slate-200/70 hover:border-slate-300 hover:bg-slate-50 transition-all text-left cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-900 block">Programs</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Manage events list</span>
              </button>

              <button
                onClick={() => setActiveTab('schedule')}
                className="p-3 rounded-lg border border-slate-200/70 hover:border-slate-300 hover:bg-slate-50 transition-all text-left cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-900 block">Schedule</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Stages & timetable</span>
              </button>

              <button
                onClick={() => setActiveTab('assignments')}
                className="p-3 rounded-lg border border-slate-200/70 hover:border-slate-300 hover:bg-slate-50 transition-all text-left cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-900 block">Assignments</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Assign participants</span>
              </button>

              <button
                onClick={() => setActiveTab('mark-entry')}
                className="p-3 rounded-lg border border-slate-200/70 hover:border-slate-300 hover:bg-slate-50 transition-all text-left cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-900 block">Mark Entry</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Score & evaluations</span>
              </button>

              <button
                onClick={() => setActiveTab('documents')}
                className="p-3 rounded-lg border border-slate-200/70 hover:border-slate-300 hover:bg-slate-50 transition-all text-left cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-900 block">Documents</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Calling sheets & forms</span>
              </button>

              <button
                onClick={() => setActiveTab('certificates')}
                className="p-3 rounded-lg border border-slate-200/70 hover:border-slate-300 hover:bg-slate-50 transition-all text-left cursor-pointer"
              >
                <span className="text-xs font-semibold text-slate-900 block">Certificates & Badges</span>
                <span className="text-[11px] text-slate-400 block mt-0.5">Print passes & awards</span>
              </button>
            </div>
          </div>

          {/* Categories Breakdown */}
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Categories Breakdown
              </h3>
              <button
                onClick={() => setActiveTab('programs')}
                className="text-xs font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-0.5 cursor-pointer"
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
                      className="p-3 rounded-lg border border-slate-200/70 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200/60 shrink-0">
                            {catCode}
                          </span>
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {cat.name}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-400 block mt-1">
                          {partCount} registered entries
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-sm font-bold text-slate-900 block leading-tight">
                          {progCount}
                        </span>
                        <span className="text-[10px] text-slate-400">programs</span>
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
                      className="p-2.5 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2.5"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-5 h-5 rounded text-[11px] font-bold text-slate-500 bg-slate-100 flex items-center justify-center shrink-0">
                          #{rank}
                        </span>
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {team.team_name || team.name || 'Team'}
                        </span>
                      </div>

                      <span className="text-xs font-bold text-slate-900 shrink-0">
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

            {/* Official Eventloo Logo on Pure White Background (Matches Login Page) */}
            <div className="flex justify-center pt-1">
              <EventlooLogo size="md" />
            </div>

            {/* Accent Bar in Eventloo Indigo */}
            <div className="w-9 h-1 rounded-full bg-indigo-600 mx-auto mt-3 mb-2" />

            {/* Event Title & Subtitle */}
            <h3 className="text-2xl font-extrabold tracking-tight text-slate-900">
              {event?.title || 'Gravitas'}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 tracking-[0.22em] uppercase mt-0.5">
              {event?.venue || 'CAMPUS FESTIVAL'}
            </p>

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

            {/* Two-Line Clean Sentence */}
            <div className="text-sm font-semibold text-slate-600 leading-snug mb-5">
              <p>Scan to view results,</p>
              <p>schedule & points table.</p>
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
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EventOverview;
