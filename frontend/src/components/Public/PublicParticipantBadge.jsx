import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Award, 
  Calendar, 
  MapPin, 
  User, 
  ShieldCheck, 
  Share2, 
  Printer, 
  CheckCircle2, 
  Clock, 
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
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200/90 p-8 flex flex-col items-center text-center space-y-4 shadow-sm animate-pulse">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center">
            <RefreshCw className="w-7 h-7 text-slate-400 animate-spin" />
          </div>
          <div className="h-5 w-36 bg-slate-200 rounded-full" />
          <div className="h-3.5 w-52 bg-slate-100 rounded-full" />
          <div className="h-28 w-full bg-slate-100 rounded-xl mt-4" />
        </div>
      </div>
    );
  }

  if (error || !badgeData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Digital Pass Not Found</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || 'The digital pass you requested could not be verified for this event.'}
          </p>
          <div className="pt-2">
            <button
              onClick={fetchBadgeData}
              className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              Try Again
            </button>
          </div>
          <div className="pt-4 border-t border-slate-100 flex items-center justify-center">
            <EventlooLogo size="sm" theme="light" showSubtitle={false} />
          </div>
        </div>
      </div>
    );
  }

  const { school, event, participant, stats, programs = [], qr_code_svg } = badgeData;
  const publicUrl = window.location.href;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-800 flex flex-col items-center justify-start pb-12 print:bg-white print:p-0">
      
      {/* Main Container - Mobile Optimized */}
      <main className="w-full max-w-md px-4 pt-5 space-y-4">
        
        {/* Top Minimal Navigation Bar */}
        <header className="flex items-center justify-between px-1 py-1 print:hidden">
          <div className="flex items-center space-x-2">
            <EventlooLogo size="sm" theme="light" showSubtitle={false} />
          </div>

          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleCopyLink}
              title="Copy badge pass link"
              className="p-2 rounded-xl bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Share2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handlePrint}
              title="Print badge pass"
              className="p-2 rounded-xl bg-white border border-slate-200/90 text-slate-700 hover:bg-slate-100 transition-colors shadow-2xs cursor-pointer"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* ======================================================== */}
        {/* WHITE MINIMAL & PROFESSIONAL BADGE CARD                   */}
        {/* ======================================================== */}
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden print:border-slate-300 print:shadow-none">
          
          {/* Institution Header Row */}
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              {school.logo ? (
                <img
                  src={school.logo}
                  alt={school.name}
                  className="w-11 h-11 rounded-xl object-contain bg-white p-1 border border-slate-200/80 shrink-0"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-slate-100 border border-slate-200/80 flex items-center justify-center font-bold text-slate-800 text-base shrink-0">
                  {school.name ? school.name.charAt(0).toUpperCase() : <SchoolIcon className="w-5 h-5 text-slate-600" />}
                </div>
              )}
              <div className="truncate">
                <span className="text-[10px] font-bold tracking-wider uppercase text-slate-400 block">
                  INSTITUTION
                </span>
                <h2 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                  {school.name}
                </h2>
              </div>
            </div>

            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>OFFICIAL</span>
            </span>
          </div>

          {/* Event Title & Metadata Banner */}
          <div className="px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                FESTIVAL / EVENT
              </span>
              <h3 className="text-sm font-bold text-slate-900 truncate">
                {event.title}
              </h3>
            </div>
            {event.start_date && (
              <div className="text-right shrink-0">
                <span className="text-[11px] font-medium text-slate-600 flex items-center justify-end space-x-1">
                  <Calendar className="w-3 h-3 text-slate-400" />
                  <span>{formatDate(event.start_date)}</span>
                </span>
                {event.venue && (
                  <span className="text-[10px] text-slate-400 block truncate max-w-[140px]">
                    {event.venue}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Participant Identity Hero */}
          <div className="p-6 text-center">
            
            {/* Clean Avatar */}
            <div className="relative inline-block mb-2.5">
              <div className="w-20 h-20 rounded-full bg-slate-100 border-2 border-slate-200/90 flex items-center justify-center text-2xl font-bold text-slate-700 mx-auto shadow-xs">
                {participant.name ? participant.name.charAt(0).toUpperCase() : <User className="w-8 h-8 text-slate-400" />}
              </div>
              <div className="absolute bottom-0 right-0 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center border-2 border-white shadow-xs">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Participant Name */}
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight uppercase leading-snug">
              {participant.name}
            </h1>

            {/* Chest Number Badge - Bold, Minimal, High-Contrast */}
            <div className="mt-3 inline-flex items-center space-x-2 px-4 py-1.5 rounded-xl bg-slate-900 text-white font-mono shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                CHEST NO
              </span>
              <span className="text-lg font-bold text-white tracking-tight">
                #{participant.chest_number || 'N/A'}
              </span>
            </div>

            {/* Details Tags */}
            <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5 text-xs">
              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span>{participant.team_name || 'Individual'}</span>
              </span>

              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium uppercase">
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>{participant.category || 'General'}</span>
              </span>

              {(participant.grade || participant.student_id) && (
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 border border-slate-200 font-medium">
                  <Hash className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    {participant.grade ? `Grade ${participant.grade}` : `ID: ${participant.student_id}`}
                    {participant.section ? ` - ${participant.section}` : ''}
                  </span>
                </span>
              )}
            </div>

            {/* Metric Counters Grid */}
            <div className="mt-6 pt-5 border-t border-slate-100 grid grid-cols-3 gap-2 text-center">
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Total Events
                </span>
                <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                  {stats.total_programs}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Stage Events
                </span>
                <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                  {stats.stage_count}
                </span>
              </div>

              <div className="bg-slate-50 border border-slate-100 rounded-xl p-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Off-Stage
                </span>
                <span className="text-lg font-bold text-slate-900 mt-0.5 block">
                  {stats.offstage_count}
                </span>
              </div>
            </div>

          </div>

        </section>

        {/* ======================================================== */}
        {/* TABS (Programs vs Digital QR Pass)                        */}
        {/* ======================================================== */}
        <div className="flex bg-slate-200/70 p-1 rounded-xl border border-slate-200/90 print:hidden">
          <button
            onClick={() => setActiveTab('programs')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'programs'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Award className="w-3.5 h-3.5 text-slate-500" />
            <span>Programs ({programs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-1.5 ${
              activeTab === 'qr'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Share2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Digital QR Pass</span>
          </button>
        </div>

        {/* ======================================================== */}
        {/* TAB 1: ENROLLED COMPETITIONS LIST                         */}
        {/* ======================================================== */}
        {(activeTab === 'programs' || window.matchMedia?.('print').matches) && (
          <section className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Registered Programs
              </h3>
              <span className="text-[11px] text-slate-400 font-medium">
                {programs.length} total
              </span>
            </div>

            {programs.length > 0 ? (
              <div className="space-y-2">
                {programs.map((prog, idx) => (
                  <div
                    key={prog.id || idx}
                    className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs space-y-2 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-mono text-slate-400 font-bold">
                            #{String(idx + 1).padStart(2, '0')}
                          </span>
                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {prog.name}
                          </h4>
                        </div>

                        {/* Program Meta Chips */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                          {/* Stage or Offstage */}
                          <span className="px-2 py-0.5 rounded-md font-medium text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                            {prog.type_label || (prog.is_stage ? 'Stage' : 'Offstage')}
                          </span>

                          {/* Mode Solo/Group */}
                          <span className="px-2 py-0.5 rounded-md font-medium text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                            {prog.mode_label || (prog.is_team_based ? 'Group' : 'Individual')}
                          </span>

                          {/* Stage Venue */}
                          {prog.stage_name && (
                            <span className="inline-flex items-center space-x-1 text-slate-600 text-[11px]">
                              <MapPin className="w-3 h-3 text-slate-400" />
                              <span className="truncate max-w-[140px]">{prog.stage_name}</span>
                            </span>
                          )}

                          {/* Scheduled Time */}
                          {prog.start_time && (
                            <span className="inline-flex items-center space-x-1 text-slate-600 text-[11px]">
                              <Clock className="w-3 h-3 text-slate-400" />
                              <span>{formatTime(prog.start_time)}</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Status / Result Badge */}
                      <div className="text-right shrink-0">
                        {prog.status === 'Participated' ? (
                          <div className="flex flex-col items-end">
                            <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              Participated
                            </span>
                            {prog.position && (
                              <span className="text-[11px] font-bold text-amber-700 mt-1">
                                {prog.position === 1 ? '🥇 1st Place' : prog.position === 2 ? '🥈 2nd Place' : prog.position === 3 ? '🥉 3rd Place' : `Rank #${prog.position}`}
                              </span>
                            )}
                            {prog.grade && prog.grade !== '-' && (
                              <span className="text-[10px] font-medium text-slate-500">
                                Grade: {prog.grade}
                              </span>
                            )}
                          </div>
                        ) : prog.status === 'Completed' ? (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Completed
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Scheduled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-xl p-6 text-center text-xs text-slate-400 border border-slate-200/90">
                No programs assigned to this participant yet.
              </div>
            )}
          </section>
        )}

        {/* ======================================================== */}
        {/* TAB 2: DIGITAL QR CODE PASS                               */}
        {/* ======================================================== */}
        {activeTab === 'qr' && (
          <section className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm text-center space-y-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Official QR Digital Pass</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Scan with any smartphone camera to verify participant credentials.
              </p>
            </div>

            {/* QR Card Box */}
            <div className="mx-auto w-56 h-56 bg-white p-3 rounded-2xl shadow-xs flex items-center justify-center border border-slate-200">
              <QRCodeSVG
                svgString={qr_code_svg}
                eventId={event.id}
                studentId={participant.id}
                value={publicUrl}
                size={200}
                className="w-full h-full"
              />
            </div>

            <div className="space-y-1">
              <div className="text-xs font-mono font-bold text-slate-800">
                Participant Chest #{participant.chest_number || 'N/A'}
              </div>
              <p className="text-[11px] text-slate-400 break-all px-2 font-mono">
                {publicUrl}
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleCopyLink}
                className="w-full py-2 px-4 rounded-xl bg-slate-900 text-white font-bold text-xs hover:bg-slate-800 transition-colors shadow-xs flex items-center justify-center space-x-2 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-slate-300" />}
                <span>{copied ? 'Link Copied!' : 'Copy Public URL'}</span>
              </button>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* FOOTER                                                    */}
        {/* ======================================================== */}
        <footer className="pt-3 pb-2 text-center space-y-1.5">
          <div className="inline-flex items-center space-x-1.5 text-xs text-slate-500">
            <span>Powered by</span>
            <span className="font-bold text-slate-800">Eventloo</span>
          </div>

          <div className="text-[10px] text-slate-400">
            {school.name} • {event.title}
          </div>
        </footer>

      </main>
    </div>
  );
};

export default PublicParticipantBadge;
