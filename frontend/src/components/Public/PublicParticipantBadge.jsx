import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { 
  Award, 
  Calendar, 
  MapPin, 
  User, 
  ShieldCheck, 
  Sparkles, 
  Share2, 
  Printer, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  School as SchoolIcon, 
  Hash, 
  Users, 
  Layers, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertCircle 
} from 'lucide-react';
import EventlooLogo from '../common/EventlooLogo';
import QRCodeSVG from '../common/QRCodeSVG';
import { publicAPI } from '../../services/api';

const PublicParticipantBadge = () => {
  const { eventId, studentId, chestOrStudentId } = useParams();
  const identifier = studentId || chestOrStudentId;

  const [loading, setLoading] = useState(true);
  const [badgeData, setBadgeData] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState('programs'); // 'programs' | 'qr'

  useEffect(() => {
    if (eventId && identifier) {
      fetchBadgeData();
    }
  }, [eventId, identifier]);

  const fetchBadgeData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await publicAPI.getParticipantBadge(eventId, identifier);
      setBadgeData(res.data);
    } catch (err) {
      console.error('Error fetching participant public badge:', err);
      setError(err.response?.data?.error || 'Unable to load digital badge. Please check the link or QR code.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2200);
  };

  const handlePrint = () => {
    window.print();
  };

  // Helper formatting for date
  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return isoString;
    }
  };

  // Helper formatting for time
  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 p-8 flex flex-col items-center text-center space-y-4 animate-pulse">
          <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-white/70 animate-spin" />
          </div>
          <div className="h-6 w-40 bg-white/20 rounded-full" />
          <div className="h-4 w-60 bg-white/10 rounded-full" />
          <div className="h-32 w-full bg-white/10 rounded-2xl mt-4" />
        </div>
      </div>
    );
  }

  if (error || !badgeData) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Pass Not Found</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            {error || 'The digital pass you requested could not be verified for this event.'}
          </p>
          <div className="pt-2">
            <button
              onClick={fetchBadgeData}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-md transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
          <div className="pt-4 border-t border-gray-100 flex items-center justify-center">
            <EventlooLogo size="sm" showSubtitle={false} />
          </div>
        </div>
      </div>
    );
  }

  const { school, event, participant, stats, programs = [], qr_code_svg } = badgeData;
  const publicUrl = window.location.href;

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-100 flex flex-col items-center justify-start pb-12 selection:bg-indigo-500 selection:text-white print:bg-white print:p-0">
      
      {/* Dynamic Background Glow Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none print:hidden">
        <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] bg-gradient-to-tr from-indigo-600/20 via-blue-600/20 to-purple-600/20 rounded-full blur-3xl opacity-70" />
        <div className="absolute bottom-10 -right-20 w-80 h-80 bg-blue-600/10 rounded-full blur-2xl" />
      </div>

      {/* Main Container - Mobile Centric (max-w-md for perfect mobile viewport feel) */}
      <main className="w-full max-w-md px-3 sm:px-4 pt-4 sm:pt-6 relative z-10 space-y-4">
        
        {/* Top Floating App Bar */}
        <header className="flex items-center justify-between px-2 py-1 print:hidden">
          <div className="flex items-center space-x-2">
            <EventlooLogo size="sm" theme="dark" showSubtitle={false} />
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleCopyLink}
              title="Copy badge link"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-slate-200 transition-colors backdrop-blur-md cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handlePrint}
              title="Print badge pass"
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 text-slate-200 transition-colors backdrop-blur-md cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* DIGITAL PASS / BADGE HERO CARD                            */}
        {/* ======================================================== */}
        <section className="bg-gradient-to-b from-white/15 to-white/5 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden relative print:border-gray-300 print:bg-white print:text-black print:shadow-none">
          
          {/* Lanyard Pass Cutout Accent */}
          <div className="w-full flex justify-center pt-3 pb-1">
            <div className="w-16 h-2 rounded-full bg-slate-900/80 border border-white/20 shadow-inner" />
          </div>

          {/* School Accreditation Header */}
          <div className="px-5 pt-3 pb-4 border-b border-white/10 flex items-center justify-between">
            <div className="flex items-center space-x-3 min-w-0">
              {school.logo ? (
                <img
                  src={school.logo}
                  alt={school.name}
                  className="w-10 h-10 rounded-xl object-contain bg-white p-1 shadow-sm shrink-0 border border-white/30"
                />
              ) : (
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-600 flex items-center justify-center font-black text-white text-base shadow-sm shrink-0">
                  {school.name ? school.name.charAt(0).toUpperCase() : <SchoolIcon className="w-5 h-5" />}
                </div>
              )}
              <div className="truncate">
                <div className="text-[10px] font-bold tracking-widest uppercase text-indigo-300 print:text-indigo-700">
                  INSTITUTION
                </div>
                <h2 className="text-xs sm:text-sm font-bold text-white truncate print:text-black">
                  {school.name}
                </h2>
              </div>
            </div>

            {/* Official Pass Badge */}
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 print:bg-emerald-50 print:text-emerald-700">
              <ShieldCheck className="w-3 h-3 text-emerald-400" />
              <span>OFFICIAL</span>
            </span>
          </div>

          {/* Event Title Banner */}
          <div className="px-5 py-3 bg-indigo-950/40 border-b border-white/10 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Festival / Event
              </div>
              <h3 className="text-sm font-extrabold text-white tracking-tight">
                {event.title}
              </h3>
            </div>
            {event.start_date && (
              <div className="text-right">
                <span className="text-[11px] font-medium text-slate-300 flex items-center space-x-1">
                  <Calendar className="w-3 h-3 text-indigo-400 inline" />
                  <span>{formatDate(event.start_date)}</span>
                </span>
                {event.venue && (
                  <span className="text-[10px] text-slate-400 block truncate max-w-[120px]">
                    {event.venue}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Participant Hero Section */}
          <div className="p-5 sm:p-6 text-center relative">
            
            {/* Ambient Avatar Glow */}
            <div className="relative inline-block mb-3">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-500 via-indigo-500 to-purple-600 p-1 shadow-lg ring-4 ring-white/10">
                <div className="w-full h-full rounded-xl bg-slate-900 flex items-center justify-center text-2xl font-black text-white">
                  {participant.name ? participant.name.charAt(0).toUpperCase() : <User className="w-8 h-8" />}
                </div>
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-500 border-2 border-slate-900 flex items-center justify-center text-white shadow-sm">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Participant Name */}
            <h1 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight uppercase print:text-black">
              {participant.name}
            </h1>

            {/* Big Event Chest Number Display */}
            <div className="mt-3 inline-flex items-center space-x-2 px-4 py-2 rounded-2xl bg-white text-slate-950 shadow-xl border border-white font-mono">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                CHEST NO
              </span>
              <span className="text-lg sm:text-xl font-black tracking-tight text-indigo-700">
                #{participant.chest_number || 'N/A'}
              </span>
            </div>

            {/* Core Details Pills */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
              {/* Team Pill */}
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white/10 border border-white/15 text-slate-200 print:text-black print:border-gray-200">
                <Users className="w-3.5 h-3.5 text-indigo-400" />
                <span className="font-semibold">{participant.team_name || 'Individual'}</span>
              </div>

              {/* Category Pill */}
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white/10 border border-white/15 text-slate-200 print:text-black print:border-gray-200">
                <Layers className="w-3.5 h-3.5 text-purple-400" />
                <span className="font-semibold uppercase">{participant.category || 'General'}</span>
              </div>

              {/* Admission / Grade Pill if available */}
              {(participant.grade || participant.student_id) && (
                <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-xl bg-white/10 border border-white/15 text-slate-300 print:text-black print:border-gray-200">
                  <Hash className="w-3.5 h-3.5 text-amber-400" />
                  <span className="font-medium">
                    {participant.grade ? `Grade ${participant.grade}` : `ID: ${participant.student_id}`}
                    {participant.section ? ` - ${participant.section}` : ''}
                  </span>
                </div>
              )}
            </div>

            {/* Event Stats Counter Bar */}
            <div className="mt-6 pt-5 border-t border-white/10 grid grid-cols-3 gap-2 text-center">
              <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Total Events
                </div>
                <div className="text-lg font-black text-white mt-0.5 print:text-black">
                  {stats.total_programs}
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Stage Events
                </div>
                <div className="text-lg font-black text-indigo-400 mt-0.5">
                  {stats.stage_count}
                </div>
              </div>

              <div className="bg-white/5 rounded-xl p-2.5 border border-white/10">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Off-Stage
                </div>
                <div className="text-lg font-black text-purple-400 mt-0.5">
                  {stats.offstage_count}
                </div>
              </div>
            </div>

          </div>

        </section>

        {/* ======================================================== */}
        {/* TABS SELECTOR (Programs vs QR Code)                       */}
        {/* ======================================================== */}
        <div className="flex bg-white/10 backdrop-blur-md p-1 rounded-2xl border border-white/15 print:hidden">
          <button
            onClick={() => setActiveTab('programs')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'programs'
                ? 'bg-white text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Award className="w-3.5 h-3.5" />
            <span>Programs ({programs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'qr'
                ? 'bg-white text-slate-900 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Digital QR Pass</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: PROGRAMS LIST                                      */}
        {/* ======================================================== */}
        {(activeTab === 'programs' || window.matchMedia?.('print').matches) && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                <span>Enrolled Competitions</span>
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                {programs.length} registered
              </span>
            </div>

            {programs.length > 0 ? (
              <div className="space-y-2.5">
                {programs.map((prog, idx) => (
                  <div
                    key={prog.id || idx}
                    className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 hover:border-white/30 transition-all shadow-md group print:bg-white print:border-gray-200 print:text-black"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono text-indigo-400 font-bold">
                            #{String(idx + 1).padStart(2, '0')}
                          </span>
                          <h4 className="text-sm font-extrabold text-white truncate group-hover:text-indigo-200 transition-colors print:text-black">
                            {prog.name}
                          </h4>
                        </div>

                        {/* Program Meta Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[11px]">
                          {/* Stage or Offstage */}
                          <span className={`px-2 py-0.5 rounded-md font-semibold text-[10px] ${
                            prog.is_stage
                              ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                              : 'bg-slate-700/60 text-slate-300 border border-slate-600'
                          }`}>
                            {prog.type_label || (prog.is_stage ? 'Stage' : 'Offstage')}
                          </span>

                          {/* Mode Solo/Group */}
                          <span className="px-2 py-0.5 rounded-md font-medium text-[10px] bg-white/5 text-slate-300 border border-white/10">
                            {prog.mode_label || (prog.is_team_based ? 'Group' : 'Individual')}
                          </span>

                          {/* Stage Location / Venue */}
                          {prog.stage_name && (
                            <span className="inline-flex items-center space-x-1 text-slate-300 text-[11px]">
                              <MapPin className="w-3 h-3 text-rose-400" />
                              <span className="truncate max-w-[130px]">{prog.stage_name}</span>
                            </span>
                          )}

                          {/* Scheduled Time */}
                          {prog.start_time && (
                            <span className="inline-flex items-center space-x-1 text-slate-300 text-[11px]">
                              <Clock className="w-3 h-3 text-amber-400" />
                              <span>{formatTime(prog.start_time)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status / Result Badge */}
                      <div className="text-right shrink-0">
                        {prog.status === 'Participated' ? (
                          <div className="flex flex-col items-end">
                            <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                              Participated
                            </span>
                            {prog.position && (
                              <span className="text-[11px] font-black text-amber-400 mt-1">
                                {prog.position === 1 ? '🥇 1st Place' : prog.position === 2 ? '🥈 2nd Place' : prog.position === 3 ? '🥉 3rd Place' : `Rank #${prog.position}`}
                              </span>
                            )}
                            {prog.grade && prog.grade !== '-' && (
                              <span className="text-[10px] font-bold text-slate-300">
                                Grade: {prog.grade}
                              </span>
                            )}
                          </div>
                        ) : prog.status === 'Completed' ? (
                          <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Scheduled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/5 rounded-2xl p-6 text-center text-xs text-slate-400 border border-white/10">
                No programs assigned to this participant yet.
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* TAB 2: QR DIGITAL PASS                                    */}
        {/* ======================================================== */}
        {activeTab === 'qr' && (
          <section className="bg-white/10 backdrop-blur-xl rounded-3xl p-6 border border-white/20 shadow-2xl text-center space-y-4">
            <div>
              <h3 className="text-base font-extrabold text-white">Scannable Badge Pass</h3>
              <p className="text-xs text-slate-400 mt-1">
                Scan this QR code with any smartphone camera to view this live festival pass.
              </p>
            </div>

            {/* QR Card Frame */}
            <div className="mx-auto w-56 h-56 bg-white p-3 rounded-3xl shadow-xl flex items-center justify-center border-4 border-indigo-500/30">
              <QRCodeSVG
                svgString={qr_code_svg}
                eventId={event.id}
                studentId={participant.id}
                value={publicUrl}
                size={210}
                className="w-full h-full"
              />
            </div>

            <div className="space-y-2">
              <div className="text-xs font-mono font-bold text-slate-300">
                Participant Chest #{participant.chest_number || 'N/A'}
              </div>
              <p className="text-[11px] text-slate-400 break-all px-2 font-mono">
                {publicUrl}
              </p>
            </div>

            <div className="pt-2 flex items-center justify-center space-x-2">
              <button
                onClick={handleCopyLink}
                className="flex-1 py-2.5 px-4 rounded-xl bg-white text-slate-950 font-bold text-xs hover:bg-slate-100 transition-colors shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4 text-slate-800" />}
                <span>{copied ? 'Link Copied!' : 'Copy Public URL'}</span>
              </button>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* FOOTER & EVENTLOO VERIFIED EMBLEM                        */}
        {/* ======================================================== */}
        <footer className="pt-4 pb-2 text-center space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-slate-400 text-[10px]">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Real-time digital pass verified by</span>
            <span className="font-bold text-white">Eventloo</span>
          </div>

          <div className="text-[10px] text-slate-500">
            {school.name} • {event.title} • {new Date().getFullYear()}
          </div>
        </footer>

      </main>
    </div>
  );
};

export default PublicParticipantBadge;
