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
  Trophy,
  RotateCw,
  RotateCcw
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
  const [isFlipped, setIsFlipped] = useState(false);
  const [backTab, setBackTab] = useState('programs'); // 'programs' | 'qr'

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
        {/* 3D FLIP CARD CONTAINER (FRONT: ID BADGE | BACK: SCHEDULE, STATS & QR)     */}
        {/* ========================================================================= */}
        <div className="w-full h-[530px] sm:h-[550px] perspective-1200 print:perspective-none print:h-auto">
          <div
            className={`relative w-full h-full transition-transform duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] preserve-3d ${
              isFlipped ? 'rotate-y-180' : 'rotate-y-0'
            }`}
          >
            {/* --------------------------------------------------------------------- */}
            {/* FRONT FACE: PHYSICAL CREDENTIAL BADGE                                  */}
            {/* --------------------------------------------------------------------- */}
            <div
              onClick={() => setIsFlipped(true)}
              title="Click to flip badge"
              className="w-full h-full bg-white rounded-[32px] border border-slate-200/80 shadow-xl shadow-slate-200/60 overflow-hidden relative cursor-pointer backface-hidden flex flex-col justify-between transition-shadow hover:shadow-2xl select-none"
            >
              {/* Lanyard Hole Cutout Slot in Card */}
              <div className="pt-3.5 flex justify-center print:hidden shrink-0">
                <div className="w-16 h-3 bg-slate-200/90 rounded-full border border-slate-300/60 shadow-inner" />
              </div>

              <div className="px-5 pt-1 pb-1 flex-1 flex flex-col justify-between min-h-0 overflow-hidden">
                <div>
                  {/* Top Row: Institution Name & OFFICIAL Pill */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2 min-w-0">
                      {school.logo ? (
                        <img
                          src={school.logo}
                          alt={school.name}
                          className="w-7 h-7 object-contain rounded-md shrink-0 mt-0.5 border border-slate-200/60"
                        />
                      ) : (
                        <div className="w-1.5 h-7 rounded-full bg-indigo-600 shrink-0 mt-0.5" />
                      )}
                      <div className="truncate">
                        <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-tight truncate">
                          {school.name || 'Institution'}
                        </h2>
                        <span className="text-[9px] font-extrabold tracking-[0.2em] text-slate-400 uppercase block mt-0.5">
                          OFFICIAL INSTITUTION PASS
                        </span>
                      </div>
                    </div>

                    {/* Official Verified Pill */}
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0 shadow-2xs">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                      <span>OFFICIAL</span>
                    </span>
                  </div>

                  {/* Festival / Event Section */}
                  <div className="flex items-end justify-between mt-2.5 pb-2 border-b border-slate-100">
                    <div className="min-w-0">
                      <span className="text-[9px] font-extrabold uppercase tracking-widest text-slate-400 block">
                        FESTIVAL / EVENT
                      </span>
                      <h3 className="text-base sm:text-lg font-black text-slate-900 tracking-tight mt-0.5 truncate capitalize">
                        {event.title}
                      </h3>
                    </div>

                    {event.start_date && (
                      <div className="text-right shrink-0 pb-0.5">
                        <span className="text-[11px] font-semibold text-slate-500 flex items-center justify-end gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>{formatDate(event.start_date)}</span>
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Avatar & Participant Identity */}
                  <div className="text-center pt-3 sm:pt-4">
                    {/* Fixed-dimension circular profile photo / WhatsApp-style default avatar */}
                    <div
                      className="rounded-full p-1 bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 shadow-md mx-auto flex items-center justify-center shrink-0"
                      style={{ width: '82px', height: '82px' }}
                    >
                      <div className="w-full h-full rounded-full bg-white flex items-center justify-center overflow-hidden">
                        {participant.photo_url ? (
                          <img
                            src={participant.photo_url}
                            alt={participant.name}
                            className="w-full h-full object-cover rounded-full"
                          />
                        ) : (
                          <div
                            className="w-full h-full bg-[#dfe5e7] flex items-center justify-center overflow-hidden relative"
                            title={participant.name || 'Participant'}
                          >
                            {/* WhatsApp-style Boy/Default Profile Silhouette */}
                            <svg
                              viewBox="0 0 100 100"
                              className="w-full h-full"
                              fill="none"
                              xmlns="http://www.w3.org/2000/svg"
                            >
                              <circle cx="50" cy="37" r="18" fill="#FFFFFF" />
                              <path
                                d="M14 90C14 71 30 59 50 59C70 59 86 71 86 90C86 96 82 100 76 100H24C18 100 14 96 14 90Z"
                                fill="#FFFFFF"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Participant Name */}
                    <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight uppercase mt-2.5 truncate">
                      {participant.name}
                    </h1>

                    {/* CHEST NO #1000 Hero Pill */}
                    <div className="mt-2 inline-flex items-center rounded-full bg-[#1e1b4b] text-white px-4 py-1 shadow-2xs">
                      <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-200/90">
                        CHEST NO
                      </span>
                      <span className="h-3.5 w-px bg-white/20 mx-2" />
                      <span className="text-sm sm:text-base font-black text-white tracking-wider">
                        #{participant.chest_number || 'N/A'}
                      </span>
                    </div>

                    {/* Metadata Badges: Team, Category, Grade */}
                    <div className="mt-2.5 flex flex-wrap items-center justify-center gap-1.5 text-xs">
                      {participant.team_name && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100/90 text-slate-700 border border-slate-200/50 font-bold text-[11px]">
                          <Users className="w-3 h-3 text-slate-500" />
                          <span>{participant.team_name}</span>
                        </span>
                      )}

                      {participant.category && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100/90 text-slate-700 border border-slate-200/50 font-bold uppercase text-[11px]">
                          <Layers className="w-3 h-3 text-slate-500" />
                          <span>{participant.category}</span>
                        </span>
                      )}

                      {(participant.grade || participant.student_id) && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-slate-100/90 text-slate-700 border border-slate-200/50 font-bold text-[11px]">
                          <Hash className="w-3 h-3 text-slate-500" />
                          <span>
                            {participant.grade ? `Grade ${participant.grade}` : `ID: ${participant.student_id}`}
                            {participant.section ? ` - ${participant.section}` : ''}
                          </span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Digital Verification Pass Barcode */}
                  <div className="flex flex-col items-center justify-center pt-4 space-y-1">
                    <div className="flex items-center justify-center gap-0.5 opacity-40 h-5">
                      {[2, 1, 3, 1, 4, 2, 1, 3, 2, 1, 4, 1, 2, 3, 2, 1, 4, 2, 1, 3, 2, 4, 1, 2, 3].map((bar, bIdx) => (
                        <div
                          key={bIdx}
                          className="bg-slate-900 rounded-xs"
                          style={{ width: `${bar * 1.3}px`, height: '100%' }}
                        />
                      ))}
                    </div>
                    <span className="text-[8px] font-mono tracking-widest text-slate-400 uppercase font-semibold">
                      AUTHENTICATED PASS • {participant.chest_number ? `#${participant.chest_number}` : `ID-${participant.id}`}
                    </span>
                  </div>
                </div>

                {/* Flip Card Interactive Pill Hint */}
                <div className="pt-2 pb-1 flex justify-center shrink-0">
                  <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold transition-all shadow-2xs border border-indigo-200/60 group">
                    <RotateCw className="w-3.5 h-3.5 transition-transform group-hover:rotate-180 duration-500 text-indigo-600" />
                    <span>Tap card to view schedule & stats</span>
                  </div>
                </div>
              </div>

              {/* Bottom Dual-Tone Wave Graphic in Eventloo Indigo */}
              <div className="w-full overflow-hidden leading-none select-none pointer-events-none shrink-0">
                <svg
                  viewBox="0 0 400 55"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-14 block object-cover"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 32C80 12 160 45 240 22C310 3 360 16 400 12V55H0V32Z"
                    fill="url(#badgeWaveLightFront)"
                    opacity="0.35"
                  />
                  <path
                    d="M0 42C100 22 190 52 280 30C335 15 375 28 400 24V55H0V42Z"
                    fill="url(#badgeWaveDarkFront)"
                  />
                  <defs>
                    <linearGradient id="badgeWaveLightFront" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#818CF8" />
                      <stop offset="100%" stopColor="#4F46E5" />
                    </linearGradient>
                    <linearGradient id="badgeWaveDarkFront" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4338CA" />
                      <stop offset="100%" stopColor="#1E1B4B" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

            {/* --------------------------------------------------------------------- */}
            {/* BACK FACE: SCHEDULE, 3 STATS BAR & REGISTERED PROGRAMS                */}
            {/* --------------------------------------------------------------------- */}
            <div
              className="absolute inset-0 w-full h-full bg-white rounded-[32px] border border-slate-200/80 shadow-xl shadow-slate-200/60 overflow-hidden backface-hidden rotate-y-180 flex flex-col justify-between"
            >
              {/* Lanyard Hole Cutout Slot in Card (matching front) */}
              <div className="pt-4 flex justify-center print:hidden shrink-0">
                <div className="w-16 h-3 bg-slate-200/90 rounded-full border border-slate-300/60 shadow-inner" />
              </div>

              <div className="px-5 pt-1.5 pb-0 flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Top Bar on Reverse Side (shrink-0) */}
                <div className="shrink-0 flex items-center justify-between pb-1.5 border-b border-slate-100">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-1.5 h-6 rounded-full bg-indigo-600 shrink-0" />
                    <div className="truncate">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider block truncate">
                        {school.name || 'Institution'}
                      </span>
                      <span className="text-[9px] font-extrabold tracking-widest text-slate-400 uppercase">
                        SCHEDULE & STATS
                      </span>
                    </div>
                  </div>

                  {/* Flip back button */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsFlipped(false);
                    }}
                    title="Flip to front"
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/70 transition-colors shadow-2xs cursor-pointer shrink-0"
                  >
                    <RotateCcw className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Flip Front</span>
                  </button>
                </div>

                {/* Participant quick recap (shrink-0) */}
                <div className="shrink-0 flex items-center justify-between py-1 text-xs font-semibold text-slate-600">
                  <span className="truncate uppercase font-bold text-slate-800">
                    {participant.name}
                  </span>
                  <span className="px-2 py-0.5 rounded-full bg-[#1e1b4b] text-white text-[10px] font-black tracking-wider shrink-0">
                    #{participant.chest_number || 'N/A'}
                  </span>
                </div>

                {/* ================================================================= */}
                {/* DYNAMIC STATS CARDS: Total Events + Each Event Type (Sports, Stage, etc.) */}
                {/* ================================================================= */}
                {(() => {
                  const typesList = stats?.type_counts ? Object.values(stats.type_counts) : [];
                  const cardCount = 1 + (typesList.length > 0 ? typesList.length : 2);
                  const gridColsClass = cardCount === 2 ? 'grid-cols-2' : cardCount === 3 ? 'grid-cols-3' : 'grid-cols-2 sm:grid-cols-4';

                  return (
                    <div className={`shrink-0 grid ${gridColsClass} gap-2 my-1`}>
                      {/* Total Events */}
                      <div className="bg-slate-50/90 rounded-2xl p-2 border border-slate-200/60 text-center">
                        <div className="w-6 h-6 mx-auto rounded-lg bg-indigo-100/70 text-indigo-600 flex items-center justify-center mb-0.5">
                          <Calendar className="w-3 h-3" />
                        </div>
                        <span className="text-base font-black text-slate-900 block leading-tight">
                          {stats.total_programs}
                        </span>
                        <span className="text-[10px] font-semibold text-slate-500 block truncate">
                          Total Events
                        </span>
                      </div>

                      {typesList.length > 0 ? (
                        typesList.map((tObj) => {
                          const isHex = tObj.color && tObj.color.startsWith('#');
                          const colorVal = tObj.color || '#4F46E5';
                          return (
                            <div key={tObj.code} className="bg-slate-50/90 rounded-2xl p-2 border border-slate-200/60 text-center">
                              <div
                                className="w-6 h-6 mx-auto rounded-lg flex items-center justify-center mb-0.5"
                                style={{
                                  backgroundColor: isHex ? `${colorVal}20` : '#EEF2FF',
                                  color: isHex ? colorVal : '#4F46E5',
                                }}
                              >
                                <Layers className="w-3 h-3" />
                              </div>
                              <span className="text-base font-black text-slate-900 block leading-tight">
                                {tObj.count ?? 0}
                              </span>
                              <span className="text-[10px] font-bold text-slate-600 block truncate capitalize" title={tObj.name}>
                                {tObj.name}
                              </span>
                            </div>
                          );
                        })
                      ) : (
                        <>
                          {/* Stage Events */}
                          <div className="bg-slate-50/90 rounded-2xl p-2 border border-slate-200/60 text-center">
                            <div className="w-6 h-6 mx-auto rounded-lg bg-indigo-100/70 text-indigo-600 flex items-center justify-center mb-0.5">
                              <Layers className="w-3 h-3" />
                            </div>
                            <span className="text-base font-black text-slate-900 block leading-tight">
                              {stats.stage_count}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 block truncate">
                              Stage
                            </span>
                          </div>

                          {/* Off-Stage Events */}
                          <div className="bg-slate-50/90 rounded-2xl p-2 border border-slate-200/60 text-center">
                            <div className="w-6 h-6 mx-auto rounded-lg bg-emerald-100/70 text-emerald-600 flex items-center justify-center mb-0.5">
                              <Flag className="w-3 h-3" />
                            </div>
                            <span className="text-base font-black text-slate-900 block leading-tight">
                              {stats.offstage_count}
                            </span>
                            <span className="text-[10px] font-semibold text-slate-500 block truncate">
                              Off-Stage
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}

                {/* Sub-tab Switcher: Programs | Digital QR (shrink-0) */}
                <div className="shrink-0 flex items-center gap-1.5 p-1 bg-slate-100/80 rounded-xl my-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setBackTab('programs');
                    }}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      backTab === 'programs'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Bookmark className="w-3.5 h-3.5" />
                    <span>Programs ({programs.length})</span>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setBackTab('qr');
                    }}
                    className={`flex-1 py-1 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      backTab === 'qr'
                        ? 'bg-white text-indigo-700 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>QR Pass</span>
                  </button>
                </div>

                {/* TAB 1: REGISTERED PROGRAMS (Scrollable inside card ONLY) */}
                {backTab === 'programs' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                    className="flex-1 min-h-0 overflow-y-auto badge-scrollbar space-y-2 pr-1.5 py-1"
                  >
                    {programs.length > 0 ? (
                      programs.map((prog, idx) => (
                        <div
                          key={prog.id || idx}
                          className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/70 text-xs space-y-1.5"
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-indigo-100 text-indigo-700 shrink-0">
                                #{String(idx + 1).padStart(2, '0')}
                              </span>
                              <h4 className="font-bold text-slate-900 truncate text-xs sm:text-sm">
                                {prog.name}
                              </h4>
                            </div>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                              {prog.status || 'Scheduled'}
                            </span>
                          </div>

                          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-200/50">
                            <div className="flex items-center gap-1.5 truncate">
                              {(() => {
                                const tLabel = prog.type_label || (prog.is_stage ? 'Stage' : 'Off-Stage');
                                const tColor = prog.type_color || (prog.is_stage ? '#4F46E5' : '#059669');
                                const isHex = tColor.startsWith('#');
                                return (
                                  <span
                                    className={`px-2 py-0.5 rounded-md font-bold text-[10px] capitalize border ${
                                      !isHex ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : ''
                                    }`}
                                    style={isHex ? {
                                      backgroundColor: `${tColor}18`,
                                      color: tColor,
                                      borderColor: `${tColor}45`
                                    } : {}}
                                  >
                                    {tLabel}
                                  </span>
                                );
                              })()}
                              {prog.stage_name && (
                                <span className="flex items-center gap-1 truncate text-slate-500">
                                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                                  <span className="truncate max-w-[110px]">{prog.stage_name}</span>
                                </span>
                              )}
                            </div>

                            {/* Position or Grade Award */}
                            {prog.position ? (
                              <span className="font-bold text-amber-600 flex items-center gap-1 text-[11px] shrink-0">
                                <Trophy className="w-3 h-3 text-amber-500" />
                                <span>{prog.position === 1 ? '1st' : prog.position === 2 ? '2nd' : prog.position === 3 ? '3rd' : `#${prog.position}`}</span>
                              </span>
                            ) : prog.grade && prog.grade !== '-' ? (
                              <span className="font-bold text-indigo-600 text-[11px] shrink-0">
                                Gr: {prog.grade}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="p-6 text-center text-xs text-slate-400 bg-slate-50 rounded-xl border border-slate-200/60">
                        No registered programs found.
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: DIGITAL QR PASS (Inside card) */}
                {backTab === 'qr' && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex-1 min-h-0 overflow-y-auto badge-scrollbar p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-center flex flex-col items-center justify-center space-y-2 my-1"
                  >
                    <div className="mx-auto w-28 h-28 bg-white p-2 rounded-xl shadow-xs flex items-center justify-center border border-slate-200 shrink-0">
                      <QRCodeSVG
                        svgString={qr_code_svg}
                        eventId={event.id}
                        studentId={participant.id}
                        value={publicUrl}
                        size={105}
                        className="w-full h-full"
                      />
                    </div>
                    <div className="text-[11px] font-mono text-slate-500">
                      Scan with camera to view live results
                    </div>
                    <button
                      onClick={handleCopyLink}
                      className="w-full py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs shrink-0"
                    >
                      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copied ? 'Link Copied!' : 'Copy Badge Pass Link'}</span>
                    </button>
                  </div>
                )}

                {/* Tap to flip hint (shrink-0) */}
                <div
                  onClick={() => setIsFlipped(false)}
                  className="shrink-0 py-1 text-center cursor-pointer"
                >
                  <span className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 transition-colors inline-flex items-center gap-1">
                    <RotateCcw className="w-3 h-3" />
                    <span>Tap anywhere to flip back to front</span>
                  </span>
                </div>
              </div>

              {/* Bottom Dual-Tone Wave Graphic on Reverse */}
              <div className="w-full overflow-hidden leading-none select-none pointer-events-none shrink-0">
                <svg
                  viewBox="0 0 400 55"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className="w-full h-14 block object-cover"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M0 32C80 12 160 45 240 22C310 3 360 16 400 12V55H0V32Z"
                    fill="url(#badgeWaveLightBack)"
                    opacity="0.35"
                  />
                  <path
                    d="M0 42C100 22 190 52 280 30C335 15 375 28 400 24V55H0V42Z"
                    fill="url(#badgeWaveDarkBack)"
                  />
                  <defs>
                    <linearGradient id="badgeWaveLightBack" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#818CF8" />
                      <stop offset="100%" stopColor="#4F46E5" />
                    </linearGradient>
                    <linearGradient id="badgeWaveDarkBack" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#4338CA" />
                      <stop offset="100%" stopColor="#1E1B4B" />
                    </linearGradient>
                  </defs>
                </svg>
              </div>
            </div>

          </div>
        </div>

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
