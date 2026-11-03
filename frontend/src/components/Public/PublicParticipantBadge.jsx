import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Calendar, 
  MapPin, 
  User, 
  ShieldCheck, 
  CheckCircle2, 
  Clock, 
  Hash, 
  Users, 
  Layers, 
  Copy, 
  Check, 
  RefreshCw, 
  AlertCircle,
  Flag,
  Bookmark,
  QrCode,
  Trophy
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200/90 p-8 flex flex-col items-center text-center space-y-4 shadow-sm animate-pulse">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <RefreshCw className="w-7 h-7 animate-spin" />
          </div>
          <div className="h-5 w-40 bg-slate-200 rounded-full" />
          <div className="h-3.5 w-52 bg-slate-100 rounded-full" />
          <div className="h-32 w-full bg-slate-100 rounded-2xl mt-4" />
        </div>
      </div>
    );
  }

  if (error || !badgeData) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] flex flex-col items-center justify-center p-4">
        <div className="w-full max-w-md bg-white rounded-3xl border border-slate-200 shadow-sm p-6 text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-rose-50 text-rose-500 flex items-center justify-center">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Digital Pass Not Found</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || 'The digital pass you requested could not be verified for this event.'}
          </p>
          <div className="pt-2">
            <button
              onClick={fetchBadgeData}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
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
    <div className="min-h-screen bg-[#f6f7fb] font-sans text-slate-800 flex flex-col items-center justify-start pb-12 print:bg-white print:p-0">
      
      {/* Main Container - Mobile Optimized */}
      <main className="w-full max-w-md px-4 pt-4 sm:pt-6 space-y-3">

        {/* ========================================================================= */}
        {/* PHYSICAL LANYARD STRAP & CHROME BADGE CLAMP (EVENTLOO INDIGO COLOR)       */}
        {/* ========================================================================= */}
        <div className="relative flex flex-col items-center pt-1 -mb-7 z-10 print:hidden select-none pointer-events-none">
          {/* Lanyard Fabric Ribbon */}
          <div className="w-12 h-16 bg-gradient-to-r from-indigo-800 via-indigo-600 to-indigo-800 shadow-md relative overflow-hidden flex items-center justify-center">
            {/* Subtle woven fabric texture lines */}
            <div className="absolute inset-0 bg-[repeating-linear-gradient(45deg,transparent,transparent_2px,rgba(255,255,255,0.08)_2px,rgba(255,255,255,0.08)_4px)]" />
            <div className="w-full h-full border-x border-indigo-950/30" />
          </div>

          {/* Chrome / Metallic Buckle Clamp */}
          <div className="w-12 h-7 bg-gradient-to-b from-slate-200 via-white to-slate-400 rounded-sm border border-slate-300 shadow-md relative -mt-0.5 flex flex-col items-center justify-center">
            {/* Clamp highlight & screw detailing */}
            <div className="w-10 h-0.5 bg-white/90 shadow-2xs" />
            <div className="flex items-center justify-between w-9 mt-1 px-1">
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-300 shadow-inner" />
              <div className="w-1.5 h-1.5 rounded-full bg-slate-400 border border-slate-300 shadow-inner" />
            </div>
          </div>

          {/* Transparent / Metallic Hook Loop going through card hole */}
          <div className="w-5 h-4 bg-gradient-to-b from-slate-400 via-slate-200 to-slate-400 rounded-b-md shadow-xs -mt-0.5 border border-slate-400/80" />
        </div>

        {/* ========================================================================= */}
        {/* WHITE MINIMAL & PROFESSIONAL BADGE CARD (EXACT MODEL UI MATCH)            */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-[32px] border border-slate-200/80 shadow-xl shadow-slate-200/60 overflow-hidden relative print:border-slate-300 print:shadow-none print:mt-0">
          
          {/* Lanyard Hole Cutout Slot in Card */}
          <div className="pt-4 flex justify-center print:hidden">
            <div className="w-16 h-3 bg-slate-200/90 rounded-full border border-slate-300/60 shadow-inner" />
          </div>

          <div className="px-6 pt-3 pb-0">
            {/* Top Row: Institution Name & OFFICIAL Pill */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5 min-w-0">
                {/* Eventloo Indigo Accent Bar */}
                <div className="w-1.5 h-7 rounded-full bg-indigo-600 shrink-0 mt-0.5" />
                <div className="truncate">
                  <h2 className="text-sm sm:text-base font-bold text-slate-900 leading-tight truncate">
                    {school.name || 'Institution'}
                  </h2>
                  <span className="text-[9px] font-extrabold tracking-[0.2em] text-slate-400 uppercase block mt-0.5">
                    INSTITUTION
                  </span>
                </div>
              </div>

              {/* Official Verified Pill */}
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 shadow-2xs">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                <span>OFFICIAL</span>
              </span>
            </div>

            {/* Festival / Event Section */}
            <div className="flex items-end justify-between mt-5 pb-3 border-b border-slate-100">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  FESTIVAL / EVENT
                </span>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-0.5 truncate">
                  {event.title}
                </h3>
              </div>

              {event.start_date && (
                <div className="text-right shrink-0 pb-0.5">
                  <span className="text-xs font-semibold text-slate-500 flex items-center justify-end gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <span>{formatDate(event.start_date)}</span>
                  </span>
                </div>
              )}
            </div>

            {/* Avatar & Participant Identity */}
            <div className="text-center pt-5">
              {/* Circular Avatar with Tinted Ring */}
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full border-2 border-indigo-600/70 bg-indigo-50/70 flex items-center justify-center mx-auto shadow-xs">
                {participant.name ? (
                  <span className="text-3xl sm:text-4xl font-black text-indigo-700">
                    {participant.name.charAt(0).toUpperCase()}
                  </span>
                ) : (
                  <User className="w-10 h-10 text-indigo-400" />
                )}
              </div>

              {/* Participant Name */}
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase mt-4">
                {participant.name}
              </h1>

              {/* CHEST NO #1000 Hero Pill */}
              <div className="mt-3 inline-flex items-center rounded-full bg-[#1e1b4b] text-white px-5 py-2 shadow-sm">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-200/90">
                  CHEST NO
                </span>
                <span className="h-3.5 w-px bg-white/20 mx-2.5" />
                <span className="text-base sm:text-lg font-black text-white tracking-wider">
                  #{participant.chest_number || 'N/A'}
                </span>
              </div>

              {/* Metadata Badges: Team, Category, Grade */}
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
                {participant.team_name && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 text-slate-700 border border-slate-200/50 font-bold">
                    <Users className="w-3.5 h-3.5 text-slate-500" />
                    <span>{participant.team_name}</span>
                  </span>
                )}

                {participant.category && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 text-slate-700 border border-slate-200/50 font-bold uppercase">
                    <Layers className="w-3.5 h-3.5 text-slate-500" />
                    <span>{participant.category}</span>
                  </span>
                )}

                {(participant.grade || participant.student_id) && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100/90 text-slate-700 border border-slate-200/50 font-bold">
                    <Hash className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {participant.grade ? `Grade ${participant.grade}` : `ID: ${participant.student_id}`}
                      {participant.section ? ` - ${participant.section}` : ''}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Dual-Tone Wave Graphic in Eventloo Indigo */}
          <div className="w-full overflow-hidden leading-none mt-6 -mb-1 select-none pointer-events-none">
            <svg
              viewBox="0 0 400 55"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-full h-14 block object-cover"
              preserveAspectRatio="none"
            >
              <path
                d="M0 32C80 12 160 45 240 22C310 3 360 16 400 12V55H0V32Z"
                fill="url(#badgeWaveLight)"
                opacity="0.35"
              />
              <path
                d="M0 42C100 22 190 52 280 30C335 15 375 28 400 24V55H0V42Z"
                fill="url(#badgeWaveDark)"
              />
              <defs>
                <linearGradient id="badgeWaveLight" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#4F46E5" />
                </linearGradient>
                <linearGradient id="badgeWaveDark" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#4338CA" />
                  <stop offset="100%" stopColor="#1E1B4B" />
                </linearGradient>
              </defs>
            </svg>
          </div>

        </section>

        {/* ========================================================================= */}
        {/* STATS BAR (TOTAL EVENTS | STAGE EVENTS | OFF-STAGE)                       */}
        {/* ========================================================================= */}
        <section className="bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs flex items-center justify-around divide-x divide-slate-100">
          {/* Total Events */}
          <div className="flex items-center gap-3 px-2 flex-1 justify-center">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black text-slate-900 block leading-tight">
                {stats.total_programs}
              </span>
              <span className="text-[11px] font-medium text-slate-500 block">
                Total Events
              </span>
            </div>
          </div>

          {/* Stage Events */}
          <div className="flex items-center gap-3 px-2 flex-1 justify-center">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black text-slate-900 block leading-tight">
                {stats.stage_count}
              </span>
              <span className="text-[11px] font-medium text-slate-500 block">
                Stage Events
              </span>
            </div>
          </div>

          {/* Off-Stage Events */}
          <div className="flex items-center gap-3 px-2 flex-1 justify-center">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
              <Flag className="w-4 h-4" />
            </div>
            <div>
              <span className="text-base sm:text-lg font-black text-slate-900 block leading-tight">
                {stats.offstage_count}
              </span>
              <span className="text-[11px] font-medium text-slate-500 block">
                Off-Stage
              </span>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* TAB BUTTONS (Programs (X) | Digital QR Pass)                              */}
        {/* ========================================================================= */}
        <div className="flex items-center gap-2 pt-1 print:hidden">
          <button
            onClick={() => setActiveTab('programs')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'programs'
                ? 'bg-[#1e1b4b] text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <Bookmark className="w-4 h-4" />
            <span>Programs ({programs.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('qr')}
            className={`flex-1 py-3 px-4 rounded-xl font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer ${
              activeTab === 'qr'
                ? 'bg-[#1e1b4b] text-white shadow-sm'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200/80'
            }`}
          >
            <QrCode className="w-4 h-4" />
            <span>Digital QR Pass</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB CONTENT 1: REGISTERED PROGRAMS LIST                                   */}
        {/* ========================================================================= */}
        {(activeTab === 'programs' || window.matchMedia?.('print').matches) && (
          <section className="space-y-2.5 pt-1">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                REGISTERED PROGRAMS
              </h3>
              <span className="text-xs font-semibold text-slate-400">
                {programs.length} total
              </span>
            </div>

            {programs.length > 0 ? (
              <div className="space-y-2.5">
                {programs.map((prog, idx) => (
                  <div
                    key={prog.id || idx}
                    className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-2xs space-y-3 hover:shadow-xs transition-shadow"
                  >
                    {/* Top Row: #01, Name, Status Badge */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="px-2 py-0.5 rounded-lg text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                          #{String(idx + 1).padStart(2, '0')}
                        </span>
                        <h4 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                          {prog.name}
                        </h4>
                      </div>

                      {/* Status badge */}
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                        {prog.status === 'Participated' ? 'Participated' : prog.status === 'Completed' ? 'Completed' : 'Scheduled'}
                      </span>
                    </div>

                    {/* Bottom Row: Tags (Stage, Group, Venue) & Awards */}
                    <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5 text-slate-600">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[11px]">
                          {prog.type_label || (prog.is_stage ? 'Stage' : 'Off-Stage')}
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium text-[11px]">
                          {prog.mode_label || (prog.is_team_based ? 'Group' : 'Individual')}
                        </span>
                        {prog.stage_name && (
                          <span className="flex items-center gap-1 text-slate-500 text-xs ml-1">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate max-w-[130px]">{prog.stage_name}</span>
                          </span>
                        )}
                      </div>

                      {/* Award / Result */}
                      {prog.position ? (
                        <span className="font-bold text-amber-600 flex items-center gap-1 text-xs shrink-0">
                          <Trophy className="w-3.5 h-3.5 text-amber-500" />
                          <span>
                            {prog.position === 1 ? '1st Place' : prog.position === 2 ? '2nd Place' : prog.position === 3 ? '3rd Place' : `Rank #${prog.position}`}
                          </span>
                        </span>
                      ) : prog.grade && prog.grade !== '-' ? (
                        <span className="font-bold text-indigo-600 text-xs shrink-0">
                          Grade {prog.grade}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center text-xs text-slate-400 border border-slate-200/80 shadow-2xs">
                No programs assigned to this participant yet.
              </div>
            )}
          </section>
        )}

        {/* ========================================================================= */}
        {/* TAB CONTENT 2: DIGITAL QR PASS (SCANNABLE VERIFICATION CARD)              */}
        {/* ========================================================================= */}
        {activeTab === 'qr' && (
          <section className="bg-white rounded-2xl p-6 border border-slate-200/80 shadow-2xs text-center space-y-4">
            <div>
              <h3 className="text-base font-bold text-slate-900">Official Digital QR Pass</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Scan with any smartphone camera to verify participant credentials and live results.
              </p>
            </div>

            {/* High-Resolution QR Frame */}
            <div className="mx-auto w-56 h-56 bg-white p-3 rounded-2xl shadow-xs flex items-center justify-center border border-slate-200">
              <QRCodeSVG
                svgString={qr_code_svg}
                eventId={event.id}
                studentId={participant.id}
                value={publicUrl}
                size={210}
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
                className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors shadow-xs flex items-center justify-center gap-2 cursor-pointer"
              >
                {copied ? <Check className="w-4 h-4 text-white" /> : <Copy className="w-4 h-4 text-white" />}
                <span>{copied ? 'Link Copied to Clipboard!' : 'Copy Verification Link'}</span>
              </button>
            </div>
          </section>
        )}

        {/* ========================================================================= */}
        {/* FOOTER                                                                    */}
        {/* ========================================================================= */}
        <footer className="pt-6 pb-4 text-center space-y-1.5 print:hidden">
          <div className="inline-flex items-center gap-2 text-xs text-slate-500">
            <span>Powered by</span>
            <EventlooLogo size="sm" theme="light" showSubtitle={false} />
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
