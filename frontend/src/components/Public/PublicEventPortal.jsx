import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import {
  Trophy,
  Users,
  Layers,
  Box,
  Calendar,
  MapPin,
  Search,
  Share2,
  Copy,
  Check,
  ChevronRight,
  ChevronLeft,
  Clock,
  Sparkles,
  QrCode,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Target,
  Flag,
  Activity,
  Menu,
  X,
  Award,
  ShieldCheck,
  BarChart3,
  Printer,
  GraduationCap,
  Mic,
  ChevronDown,
  Download,
} from 'lucide-react';
import { publicEventAPI } from '../../services/api';
import EventlooLogo from '../common/EventlooLogo';
import { downloadEventQrPoster } from '../../utils/qrPosterGenerator';

// Laurel Wreath Rank Badge for Positions 1, 2, 3
const LaurelRankBadge = ({ rank }) => {
  const isFirst = rank === 1;
  const isSecond = rank === 2;
  const isThird = rank === 3;

  // Colors: Gold for 1st, Silver for 2nd, Bronze for 3rd
  const strokeColor = isFirst
    ? '#d97706' // amber-600 gold
    : isSecond
    ? '#64748b' // slate-500 silver
    : isThird
    ? '#b45309' // amber-700 bronze
    : '#94a3b8';

  const fillColor = strokeColor;

  return (
    <div className="relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 shrink-0 select-none">
      <svg
        viewBox="0 0 54 48"
        className="w-10 h-10 sm:w-12 sm:h-12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Left Laurel Branch */}
        <g stroke={strokeColor} fill={fillColor}>
          {/* Main Curved Stem */}
          <path
            d="M 15 41 C 6 32 6 17 17 7"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          {/* Leaves along left stem */}
          <path d="M 15 40 C 10 42 7 39 7 36 C 7 34 11 36 15 40 Z" strokeWidth="0.5" />
          <path d="M 12 36 C 7 36 4 32 5 29 C 7 29 11 32 12 36 Z" strokeWidth="0.5" />
          <path d="M 9 30 C 4 29 2 24 4 21 C 6 22 9 26 9 30 Z" strokeWidth="0.5" />
          <path d="M 8 23 C 3 21 2 16 5 13 C 7 15 8 19 8 23 Z" strokeWidth="0.5" />
          <path d="M 9 16 C 5 13 6 8 9 6 C 10 9 10 13 9 16 Z" strokeWidth="0.5" />
          <path d="M 12 11 C 11 6 13 3 16 2 C 17 5 15 9 12 11 Z" strokeWidth="0.5" />
          <path d="M 17 7 C 18 4 21 3 22 5 C 21 7 19 8 17 7 Z" strokeWidth="0.5" />
        </g>

        {/* Right Laurel Branch */}
        <g stroke={strokeColor} fill={fillColor}>
          {/* Main Curved Stem */}
          <path
            d="M 39 41 C 48 32 48 17 37 7"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
          {/* Leaves along right stem */}
          <path d="M 39 40 C 44 42 47 39 47 36 C 47 34 43 36 39 40 Z" strokeWidth="0.5" />
          <path d="M 42 36 C 47 36 50 32 49 29 C 47 29 43 32 42 36 Z" strokeWidth="0.5" />
          <path d="M 45 30 C 50 29 52 24 50 21 C 48 22 45 26 45 30 Z" strokeWidth="0.5" />
          <path d="M 46 23 C 51 21 52 16 49 13 C 47 15 46 19 46 23 Z" strokeWidth="0.5" />
          <path d="M 45 16 C 49 13 48 8 45 6 C 44 9 44 13 45 16 Z" strokeWidth="0.5" />
          <path d="M 42 11 C 43 6 41 3 38 2 C 37 5 39 9 42 11 Z" strokeWidth="0.5" />
          <path d="M 37 7 C 36 4 33 3 32 5 C 33 7 35 8 37 7 Z" strokeWidth="0.5" />
        </g>

        {/* Centered Rank Number */}
        <text
          x="27"
          y="29"
          textAnchor="middle"
          fontSize="20"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, sans-serif"
          fill={fillColor}
        >
          {rank}
        </text>
      </svg>
    </div>
  );
};

const PublicEventPortal = () => {
  const { eventId } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Active view tab: 'home' | 'about' | 'programs' | 'results' | 'points' | 'schedule'
  const initialTab = searchParams.get('tab') || 'home';
  const [activeTab, setActiveTab] = useState(initialTab);

  // Results & Programs tab state
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');

  // Schedule tab state
  const [selectedDate, setSelectedDate] = useState('all');
  const [selectedStageId, setSelectedStageId] = useState('all');

  // Modals & UI helpers
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [downloadingQr, setDownloadingQr] = useState(false);
  const [expandedTeamId, setExpandedTeamId] = useState(null);

  useEffect(() => {
    fetchPortalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // Sync tab change with URL search param
  const handleTabChange = (tabKey) => {
    setActiveTab(tabKey);
    setMobileMenuOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setSearchParams(tabKey === 'home' ? {} : { tab: tabKey });
  };

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await publicEventAPI.getPublicPortal(eventId);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load public portal data:', err);
      setError(err?.response?.data?.error || 'Event details could not be loaded.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    const url = data?.public_url || window.location.href;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadQrPoster = async () => {
    try {
      setDownloadingQr(true);
      await downloadEventQrPoster({
        event: data?.event,
        portalData: data,
        publicUrl: data?.public_url || window.location.href,
        eventId,
        filename: `${(data?.event?.title || 'Festival').replace(/[^a-zA-Z0-9_-]/g, '_')}_Official_QR_Poster.png`
      });
    } catch (err) {
      console.error('Failed to download QR Poster PNG:', err);
      alert('Unable to generate QR Poster. Please try again.');
    } finally {
      setDownloadingQr(false);
    }
  };

  const event = data?.event;
  const stats = data?.stats || {};
  const categories = data?.categories || [];
  const programs = data?.programs || [];
  const teamStandings = data?.team_standings || [];
  const stages = data?.stages || [];

  // Filter programs by category & search
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchSearch =
        !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [programs, selectedCategory, searchTerm]);

  // Current category programs for 2-step selector
  const currentCategoryPrograms = useMemo(() => {
    if (!selectedCategory) return [];
    return programs.filter((p) => p.category === selectedCategory);
  }, [programs, selectedCategory]);

  // Selected program details: ONLY defined if user selected BOTH category AND program!
  const activeProgram = useMemo(() => {
    if (!selectedCategory || !selectedProgramId) return null;
    return programs.find((p) => String(p.id) === String(selectedProgramId)) || null;
  }, [programs, selectedCategory, selectedProgramId]);

  // Program index for watermark number
  const activeProgramIndex = useMemo(() => {
    if (!activeProgram) return 0;
    const idx = programs.findIndex((p) => p.id === activeProgram.id);
    return idx >= 0 ? idx : 0;
  }, [programs, activeProgram]);

  // Category switch handler: resets program selection so user must choose program next
  const handleCategoryChange = (catCode) => {
    setSelectedCategory(catCode);
    setSelectedProgramId('');
  };

  // Previous & next program selectors
  const handlePrevProgram = () => {
    if (currentCategoryPrograms.length <= 1) return;
    const currIdx = currentCategoryPrograms.findIndex((p) => String(p.id) === String(activeProgram?.id));
    const prevIdx = currIdx > 0 ? currIdx - 1 : currentCategoryPrograms.length - 1;
    setSelectedProgramId(String(currentCategoryPrograms[prevIdx].id));
  };

  const handleNextProgram = () => {
    if (currentCategoryPrograms.length <= 1) return;
    const currIdx = currentCategoryPrograms.findIndex((p) => String(p.id) === String(activeProgram?.id));
    const nextIdx = currIdx < currentCategoryPrograms.length - 1 ? currIdx + 1 : 0;
    setSelectedProgramId(String(currentCategoryPrograms[nextIdx].id));
  };

  // Helper to format stat values: REAL count from app + '+'
  const formatStatCount = (val) => {
    const num = Number(val);
    if (isNaN(num)) return '0+';
    return `${num}+`;
  };

  // Generate date list for Schedule ribbon
  const scheduleDates = useMemo(() => {
    const dateMap = new Map();

    // From event start & end dates
    if (event?.start_date) {
      try {
        const start = new Date(event.start_date);
        const end = event.end_date ? new Date(event.end_date) : new Date(start);
        const curr = new Date(start);
        while (curr <= end && dateMap.size < 14) {
          const iso = curr.toISOString().split('T')[0];
          const labelMonth = curr.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          const labelDay = curr.toLocaleDateString('en-US', { weekday: 'short' });
          dateMap.set(iso, { iso, labelMonth, labelDay });
          curr.setDate(curr.getDate() + 1);
        }
      } catch (e) {
        console.error('Date parsing error', e);
      }
    }

    // Also include any program start times
    programs.forEach((p) => {
      if (p.start_time) {
        try {
          const d = new Date(p.start_time);
          const iso = d.toISOString().split('T')[0];
          if (!dateMap.has(iso)) {
            const labelMonth = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const labelDay = d.toLocaleDateString('en-US', { weekday: 'short' });
            dateMap.set(iso, { iso, labelMonth, labelDay });
          }
        } catch {
          // ignore
        }
      }
    });

    return Array.from(dateMap.values());
  }, [event, programs]);

  // Filter schedule programs
  const schedulePrograms = useMemo(() => {
    return programs.filter((p) => {
      // Date filter
      if (selectedDate !== 'all') {
        if (!p.start_time) return false;
        const pDate = p.start_time.split('T')[0];
        if (pDate !== selectedDate) return false;
      }
      // Stage filter
      if (selectedStageId !== 'all') {
        if (p.stage_name !== selectedStageId && p.venue !== selectedStageId) return false;
      }
      return true;
    });
  }, [programs, selectedDate, selectedStageId]);

  // Helper date/time formatters
  const formatDateRange = (startIso, endIso) => {
    if (!startIso) return 'Dates To Be Announced';
    try {
      const s = new Date(startIso);
      const startFormatted = s.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      });
      if (!endIso) {
        return `${startFormatted}, ${s.getFullYear()}`;
      }
      const e = new Date(endIso);
      const endFormatted = e.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      return `${startFormatted} – ${endFormatted}`;
    } catch {
      return startIso;
    }
  };

  const formatTimeSlot = (startIso, endIso) => {
    if (!startIso) return 'Time TBA';
    try {
      const s = new Date(startIso);
      const sTime = s.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      if (!endIso) return sTime;
      const e = new Date(endIso);
      const eTime = e.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      return `${sTime} – ${eTime}`;
    } catch {
      return 'Time TBA';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-9 h-9 border-3 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs font-semibold text-slate-500 tracking-wide uppercase">
            Loading Official Event Portal...
          </p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 max-w-md w-full text-center space-y-4 shadow-sm">
          <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto border border-amber-200/60">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Event Portal Unavailable</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {error || 'This event could not be found or is not currently open for public viewing.'}
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition-colors shadow-2xs"
          >
            Go to Eventloo Home
          </a>
        </div>
      </div>
    );
  }

  const totalProgramsCount = stats.total_programs ?? programs.length;
  const totalTeamsCount = stats.total_teams ?? teamStandings.length;
  const totalPublishedResults =
    stats.published_results_count ?? programs.filter((p) => p.is_published).length;
  const totalParticipantsCount = stats.total_participants ?? 0;
  const totalStagesCount = stats.total_stages ?? stages.length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* Print Specific CSS to print only the Result Poster */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #result-poster-card, #result-poster-card * {
            visibility: visible !important;
          }
          #result-poster-card {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            max-width: 100% !important;
            border: 1px solid #cbd5e1 !important;
            box-shadow: none !important;
            padding: 32px !important;
            background: #ffffff !important;
          }
        }
      `}</style>

      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR (EVENTLOO BRANDING + CLEAN STREAMLINED TABS)                 */}
      {/* ========================================================================= */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Brand Logo */}
          <EventlooLogo size="sm" onClick={() => handleTabChange('home')} />

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {[
              { id: 'home', label: 'Home' },
              { id: 'results', label: 'Results' },
              { id: 'points', label: 'Points' },
              { id: 'schedule', label: 'Schedule' },
            ].map((tab) => {
              const isActive =
                activeTab === tab.id ||
                (tab.id === 'results' && activeTab === 'programs');
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3.5 py-1.5 text-xs lg:text-sm font-semibold transition-all rounded-lg cursor-pointer relative ${
                    isActive
                      ? 'text-indigo-600 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-indigo-600 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Header: Mobile menu toggle only */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200/80 bg-white/95 backdrop-blur-md px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2">
            {[
              { id: 'home', label: 'Home', icon: Sparkles },
              { id: 'results', label: 'Results', icon: Trophy },
              { id: 'points', label: 'Points Table', icon: BarChart3 },
              { id: 'schedule', label: 'Schedule', icon: Calendar },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive =
                activeTab === tab.id ||
                (tab.id === 'results' && activeTab === 'programs');
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`w-full text-left px-3.5 py-2.5 text-sm font-semibold rounded-xl flex items-center gap-3 transition-colors ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700 font-bold'
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </header>

      {/* ========================================================================= */}
      {/* 2. TAB CONTENT ROUTING                                                     */}
      {/* ========================================================================= */}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB A: HOME LANDING PAGE (HERO + STATS + ABOUT + POWERED + VISION + CTA)  */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'home' && (
        <main className="flex-1 space-y-12 sm:space-y-16 pb-16">
          
          {/* ========================================================================= */}
          {/* PRIMARY VIEWPORT: HERO SECTION + ANALYTICS STATS STRIP                    */}
          {/* ========================================================================= */}
          <div className="relative bg-gradient-to-b from-[#f3f7fd] via-[#ecf3fc] to-[#f8fafc] border-b border-slate-100">
            {/* Subtle organic background aura */}
            <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-gradient-to-br from-indigo-200/40 via-blue-200/25 to-transparent rounded-full blur-3xl pointer-events-none -mr-28 -mt-28" />
            <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-gradient-to-tr from-violet-100/40 via-indigo-100/30 to-transparent rounded-full blur-3xl pointer-events-none -ml-24 -mb-24" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 sm:pt-12 pb-6 sm:pb-8 relative z-10 space-y-6 sm:space-y-8">
              
              {/* HERO ROW: EVENT TITLE & INFO ON LEFT + ILLUSTRATION ON RIGHT */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 lg:gap-12 items-center">
                
                {/* Left Column: Festival Title, Date, Venue, CTAs */}
                <div className="lg:col-span-7 space-y-4 sm:space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 sm:px-3.5 sm:py-1.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 text-[10px] sm:text-[11px] font-bold uppercase tracking-[0.18em] shadow-2xs">
                    {event.school_logo ? (
                      <img
                        src={event.school_logo}
                        alt="Logo"
                        className="w-3.5 h-3.5 rounded-full object-contain shrink-0"
                      />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    )}
                    <span className="truncate">{event.school_name ? `${event.school_name} FESTIVAL` : 'OFFICIAL FESTIVAL PORTAL'}</span>
                  </div>

                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.15] sm:leading-[1.1] break-words">
                    Welcome to{' '}
                    <span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                      {event.title}
                    </span>
                  </h1>

                  <p className="text-sm sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                    {event.description ||
                      'The official live hub for program schedules, stage announcements, real-time judge scoring, and team championship standings.'}
                  </p>

                  {/* Dates & Venue info */}
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-3 sm:gap-x-4 text-xs sm:text-sm text-slate-700 font-medium pt-0.5">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span>{formatDateRange(event.start_date, event.end_date)}</span>
                    </div>
                    <span className="text-slate-300 hidden sm:inline">|</span>
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                      <span className="truncate max-w-[200px] sm:max-w-none">{event.venue || 'Campus Main Grounds'}</span>
                    </div>
                  </div>

                  {/* Action buttons: mobile-first balanced structure */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 pt-2">
                    <button
                      onClick={() => handleTabChange('results')}
                      className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-full transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm hover:shadow-md hover:shadow-indigo-600/20 active:scale-95"
                    >
                      <span>Explore Results</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <div className="grid grid-cols-2 gap-2.5 sm:flex sm:items-center sm:gap-3 w-full sm:w-auto">
                      <button
                        onClick={() => handleTabChange('points')}
                        className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm rounded-full border border-slate-200/90 transition-all cursor-pointer shadow-2xs hover:shadow-sm text-center justify-center"
                      >
                        Points Table
                      </button>
                      <button
                        onClick={() => handleTabChange('schedule')}
                        className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-xs sm:text-sm rounded-full border border-slate-200/90 transition-all cursor-pointer shadow-2xs hover:shadow-sm text-center justify-center"
                      >
                        View Schedule
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Column: Hero Visual Image (Hidden on mobile screens, shown on desktop) */}
                <div className="hidden lg:flex lg:col-span-5 justify-center lg:justify-end">
                  <div className="relative w-full max-w-md rounded-2xl sm:rounded-3xl overflow-hidden shadow-xl sm:shadow-2xl shadow-indigo-950/15 border border-white/90 bg-white/60 backdrop-blur-xs transition-all duration-300 hover:shadow-indigo-900/20 group">
                    
                    {/* Floating Live Badge (Top-Left) */}
                    <div className="absolute top-2.5 left-2.5 sm:top-3 sm:left-3 z-10">
                      <div className="inline-flex items-center gap-1.5 sm:gap-2 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-full bg-slate-900/80 backdrop-blur-md text-white border border-white/20 text-[10px] sm:text-[11px] font-semibold shadow-lg">
                        <span className="h-1.5 w-1.5 sm:h-2 sm:w-2 rounded-full bg-emerald-400 animate-pulse" />
                        <span>Live Festival Stage</span>
                      </div>
                    </div>

                    {/* Event Logo Badge if present (Top-Right) */}
                    {(event.logo || event.event_logo) ? (
                      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/90 backdrop-blur-md p-1 sm:p-1.5 border border-white/80 shadow-md flex items-center justify-center">
                          <img
                            src={event.logo || event.event_logo}
                            alt={event.title || 'Event Logo'}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      </div>
                    ) : event.school_logo ? (
                      <div className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 z-10">
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-white/90 backdrop-blur-md p-1 sm:p-1.5 border border-white/80 shadow-md flex items-center justify-center">
                          <img
                            src={event.school_logo}
                            alt={event.school_name || 'Logo'}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                      </div>
                    ) : null}

                    {/* Generated Illustration from Login Page - height constrained on mobile */}
                    <img
                      src="/event-checkin-illustration.jpg"
                      alt={`${event.title} Stage & Live Results`}
                      className="w-full h-44 sm:h-60 md:h-72 lg:h-[330px] object-cover object-center transform transition-transform duration-700 group-hover:scale-[1.02]"
                      loading="eager"
                    />

                    {/* Floating Bottom Card Strip */}
                    <div className="absolute bottom-2.5 left-2.5 right-2.5 sm:bottom-3 sm:left-3 sm:right-3 z-10 bg-white/95 backdrop-blur-md rounded-xl p-2.5 sm:p-3 border border-white/80 shadow-lg flex items-center justify-between gap-2">
                      <div className="min-w-0 pr-1">
                        <p className="text-xs font-bold text-slate-900 truncate">
                          {event.title}
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-indigo-600 font-semibold uppercase tracking-wider truncate">
                          {event.school_name || 'Campus Event'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 px-2 py-0.5 sm:py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] sm:text-[11px] font-bold">
                        <Trophy className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-indigo-600" />
                        <span>Official Portal</span>
                      </div>
                    </div>

                  </div>
                </div>

              </div>

              {/* STATS ANALYTICS CARD STRIP (EMBEDDED IN PRIMARY VIEWPORT SCREEN) */}
              <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-md p-3.5 sm:p-7">
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-0 sm:divide-x sm:divide-slate-100">
                  
                  {/* Stat 1: Programs */}
                  <div className="flex flex-col items-center text-center space-y-1 sm:space-y-1.5 p-2.5 sm:p-0 rounded-xl bg-slate-50/70 sm:bg-transparent border border-slate-100 sm:border-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Box className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {formatStatCount(totalProgramsCount)}
                    </span>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Programs
                    </span>
                  </div>

                  {/* Stat 2: Teams */}
                  <div className="flex flex-col items-center text-center space-y-1 sm:space-y-1.5 p-2.5 sm:p-0 rounded-xl bg-slate-50/70 sm:bg-transparent border border-slate-100 sm:border-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Users className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {formatStatCount(totalTeamsCount)}
                    </span>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Teams
                    </span>
                  </div>

                  {/* Stat 3: Participants */}
                  <div className="flex flex-col items-center text-center space-y-1 sm:space-y-1.5 p-2.5 sm:p-0 rounded-xl bg-slate-50/70 sm:bg-transparent border border-slate-100 sm:border-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <GraduationCap className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {formatStatCount(totalParticipantsCount)}
                    </span>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Participants
                    </span>
                  </div>

                  {/* Stat 4: Stages */}
                  <div className="flex flex-col items-center text-center space-y-1 sm:space-y-1.5 p-2.5 sm:p-0 rounded-xl bg-slate-50/70 sm:bg-transparent border border-slate-100 sm:border-0">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                      <Mic className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <span className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {formatStatCount(totalStagesCount)}
                    </span>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Stages
                    </span>
                  </div>

                  {/* Stat 5: Results Published */}
                  <div className="flex flex-col items-center text-center space-y-1 sm:space-y-1.5 p-2.5 sm:p-0 rounded-xl bg-indigo-50/60 sm:bg-transparent border border-indigo-100 sm:border-0 col-span-2 sm:col-span-1">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-100/80 text-indigo-700 flex items-center justify-center">
                      <Trophy className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600" />
                    </div>
                    <span className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight">
                      {formatStatCount(totalPublishedResults)}
                    </span>
                    <span className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider">
                      Results Published
                    </span>
                  </div>

                </div>
              </div>

              {/* Subtle Scroll Down Prompt for users who wish to explore Eventloo details */}
              <div className="flex flex-col items-center justify-center pt-1 pb-1 text-slate-400 select-none">
                <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Scroll to explore Eventloo
                </span>
                <ChevronDown className="w-4 h-4 animate-bounce text-indigo-500" />
              </div>

            </div>
          </div>

          {/* ========================================================================= */}
          {/* SECTION 1: ABOUT EVENTLOO (COMPREHENSIVE FULL-WIDTH CONTENT & FEATURES)   */}
          {/* ========================================================================= */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl border border-slate-200/90 p-6 sm:p-10 shadow-2xs space-y-8">
              
              {/* Header: Title, Subtitle, Comprehensive Intro */}
              <div className="space-y-3 max-w-4xl">
                <div className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>About Eventloo</span>
                </div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight">
                  The Complete Operating System for Campus Events & Festivals
                </h2>
                <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                  Eventloo is a state-of-the-art event management and live fest orchestration platform engineered specifically for schools, colleges, and educational institutions. From organizing multiple concurrent campus fests to automating conflict-free schedules, real-time judge scoring, and live championship standings, Eventloo replaces outdated manual spreadsheets with a unified, transparent digital ecosystem.
                </p>
              </div>

              {/* Full-Width Feature Cards Grid (No Photo, Content Everywhere) */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                
                {/* Feature 1: Multiple Event Management */}
                <div className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all space-y-3 group">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Multiple Event Management
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                      Configure and orchestrate multiple festivals, inter-collegiate tournaments, arts meets, and sports competitions concurrently under one school workspace with isolated rules, categories, and leaderboards.
                    </p>
                  </div>
                </div>

                {/* Feature 2: Conflict-Free Scheduling */}
                <div className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all space-y-3 group">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Smart Stage Scheduling
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                      Coordinate hundreds of programs across multiple physical stages and auditoriums. Intelligent clash-detection algorithms prevent double-booking participants across simultaneous events.
                    </p>
                  </div>
                </div>

                {/* Feature 3: Digital Judged Scoring */}
                <div className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all space-y-3 group">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Live Judge Scoring & Tabulation
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                      Judges enter criteria-based scores on tablets or mobile phones. Mark verification, penalty deductions, grade allocations (Grade A, B), and tie-breaker computations happen automatically.
                    </p>
                  </div>
                </div>

                {/* Feature 4: Live Team Championship Standings */}
                <div className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all space-y-3 group">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Automated Championship Points
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                      Every approved program score immediately updates team standings in real time. Campus leaderboards display live positions, gold/silver/bronze medals, and championship points instantly.
                    </p>
                  </div>
                </div>

                {/* Feature 5: Roster & Chest Number System */}
                <div className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all space-y-3 group">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Roster & Chest Numbering
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                      Automated chest number allocation, bulk participant registration, team manager delegation, and real-time student check-in verify legitimate participants and streamline event flow.
                    </p>
                  </div>
                </div>

                {/* Feature 6: Public Transparency & Digital Recognition */}
                <div className="bg-slate-50/70 hover:bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs hover:shadow-md transition-all space-y-3 group">
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      Public Portal & Digital Passes
                    </h3>
                    <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
                      Mobile-responsive live portal with instant winner declaration cards, official printable result posters, public QR access passes, and verifiable digital certificate generation.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 2: VISION & MISSION                                               */}
          {/* ========================================================================= */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              
              {/* Vision Card */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-2xs space-y-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Flag className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Our Vision</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  To establish Eventloo as the gold standard in educational event technology—making every school and college festival organized, highly transparent, and universally exciting for students and organizers alike.
                </p>
              </div>

              {/* Mission Card */}
              <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-8 shadow-2xs space-y-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">Our Mission</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  To eliminate administrative bottlenecks through intuitive software that empowers administrators, inspires student competitors, ensures fair judging, and delivers instant public celebration.
                </p>
              </div>

            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 3: HOW IT WORKS (END-TO-END WORKFLOW)                             */}
          {/* ========================================================================= */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-2xs space-y-8">
              
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
                  How It Works
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  From Event Creation to Live Winner Declaration
                </h2>
              </div>

              {/* 4 Steps Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                
                {/* Step 1 */}
                <div className="space-y-3 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
                    1
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Create & Configure</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Set up competition programs, categories, stages, teams, and point calculation rules in seconds.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="space-y-3 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
                    2
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Register & Assign</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Auto-generate unique chest numbers, import participant rosters, and delegate to team managers.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="space-y-3 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
                    3
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Stage & Score Live</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Coordinate live stage timelines while judges submit marks securely with automated tabulation.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="space-y-3 bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm">
                    4
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Publish & Celebrate</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Instantly broadcast official results, live team points table, and printable winner posters.
                  </p>
                </div>

              </div>

            </div>
          </section>

          {/* ========================================================================= */}
          {/* SECTION 4: EXPLORE BANNER (CRYSTAL CLEAR HIGH-CONTRAST BRAND INDIGO)       */}
          {/* ========================================================================= */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-800 text-white p-8 sm:p-14 text-center space-y-6 shadow-xl shadow-indigo-600/20 relative overflow-hidden border border-indigo-500/40">
              
              {/* Vibrant ambient lighting */}
              <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-violet-400/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-2xl mx-auto space-y-4">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/15 backdrop-blur-md text-white text-[11px] font-bold uppercase tracking-widest border border-white/20 shadow-sm">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Official Event Hub</span>
                </div>

                <h3 className="text-3xl sm:text-5xl font-black text-white tracking-tight drop-shadow-sm leading-tight">
                  Explore {event.title}
                </h3>
                
                <p className="text-sm sm:text-base text-indigo-100 font-medium max-w-lg mx-auto leading-relaxed">
                  Browse official program winner declarations, real-time championship points standings, and complete multi-stage schedules.
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 pt-2 w-full max-w-md mx-auto sm:max-w-none">
                  <button
                    onClick={() => handleTabChange('results')}
                    className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-50 text-indigo-700 font-extrabold text-sm rounded-full transition-all cursor-pointer shadow-lg hover:shadow-xl active:scale-95 text-center"
                  >
                    View Results →
                  </button>
                  <div className="grid grid-cols-2 gap-2.5 w-full sm:w-auto sm:flex sm:items-center sm:gap-3">
                    <button
                      onClick={() => handleTabChange('points')}
                      className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-900/40 hover:bg-indigo-900/60 text-white border border-white/30 font-bold text-xs sm:text-sm rounded-full transition-all cursor-pointer shadow-sm hover:border-white/50 text-center"
                    >
                      Points Table
                    </button>
                    <button
                      onClick={() => handleTabChange('schedule')}
                      className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-indigo-900/40 hover:bg-indigo-900/60 text-white border border-white/30 font-bold text-xs sm:text-sm rounded-full transition-all cursor-pointer shadow-sm hover:border-white/50 text-center"
                    >
                      See Schedule
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>

        </main>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB B: ABOUT TAB (COMPREHENSIVE FESTIVAL & EVENTLOO INFORMATION)           */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'about' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 flex-1 w-full space-y-10">
          
          <div className="space-y-2 text-center max-w-2xl mx-auto">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
              {event.school_name || 'Campus Event'}
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              About {event.title}
            </h1>
            <p className="text-slate-600 text-sm leading-relaxed">
              Official overview, festival vision, campus venue guidelines, and event platform.
            </p>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-2xs space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
              <div className="space-y-4">
                <h3 className="text-xl font-bold text-slate-900">Festival Overview</h3>
                <p className="text-slate-600 text-sm leading-relaxed">
                  {event.title} is an annual celebration organized at {event.school_name || 'campus'}. It offers a stage for students to compete, express their artistic talents, and represent their teams with pride.
                </p>
                <div className="space-y-2 text-xs text-slate-600 pt-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-slate-800">Event Dates:</span>
                    <span>{formatDateRange(event.start_date, event.end_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span className="font-semibold text-slate-800">Official Venue:</span>
                    <span>{event.venue || 'Campus Main Stage & Indoor Venues'}</span>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-sm aspect-4/3">
                <img
                  src="/campus_festival_building.jpg"
                  alt="Campus building"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* Quick jump to results / schedule */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 pt-4 w-full max-w-md mx-auto sm:max-w-none">
            <button
              onClick={() => handleTabChange('results')}
              className="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm rounded-full transition-colors cursor-pointer text-center"
            >
              Explore Program Results →
            </button>
            <button
              onClick={() => handleTabChange('points')}
              className="w-full sm:w-auto px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold text-xs sm:text-sm rounded-full transition-colors cursor-pointer text-center"
            >
              View Points Table
            </button>
          </div>

        </main>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB C: PROGRAMS & RESULTS TAB (2-COL LAYOUT WITH CATEGORY PILLS)           */}
      {/* ------------------------------------------------------------------------- */}
      {/* ------------------------------------------------------------------------- */}
      {/* TAB C: PROGRAMS & RESULTS (SIMPLE, NON-SCROLLABLE 2-STEP & POSTER CARD)   */}
      {/* ------------------------------------------------------------------------- */}
      {(activeTab === 'results' || activeTab === 'programs') && (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex-1 w-full space-y-5 sm:space-y-6">
          
          {/* Top Header: Trophy Squircle Icon + Title & Subtitle */}
          <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs flex items-center gap-3 sm:gap-4">
            {/* Subtle decorative background wave in Eventloo indigo palette */}
            <div className="absolute right-0 top-0 w-72 h-full bg-gradient-to-l from-indigo-50/60 via-indigo-50/20 to-transparent pointer-events-none rounded-r-3xl" />
            
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0 relative z-10">
              <Trophy className="w-5 h-5 sm:w-7 sm:h-7 text-indigo-600" />
            </div>
            <div className="relative z-10 min-w-0">
              <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                Program Results
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5 truncate">
                Official results and winners
              </p>
            </div>
          </div>

          {/* TWO-STEP DROPDOWN SELECTORS: CATEGORY & PROGRAM SIDE-BY-SIDE */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            
            {/* Dropdown 1: Category */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-600 mb-1.5">
                Category
              </label>
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full bg-white border border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 rounded-xl sm:rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-base font-semibold text-slate-900 appearance-none cursor-pointer transition-all pr-10 shadow-2xs"
                >
                  <option value="">Select Category</option>
                  {categories.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 sm:px-4 text-slate-500">
                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>

            {/* Dropdown 2: Program (Enabled once category is selected) */}
            <div>
              <label className="block text-xs sm:text-sm font-semibold text-slate-600 mb-1.5">
                Program
              </label>
              <div className="relative">
                <select
                  value={selectedProgramId}
                  onChange={(e) => setSelectedProgramId(e.target.value)}
                  disabled={!selectedCategory || currentCategoryPrograms.length === 0}
                  className={`w-full border rounded-xl sm:rounded-2xl px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs sm:text-base font-semibold appearance-none transition-all pr-10 shadow-2xs ${
                    !selectedCategory
                      ? 'bg-slate-50/80 border-slate-200 text-slate-400 cursor-not-allowed'
                      : currentCategoryPrograms.length === 0
                      ? 'bg-slate-50/80 border-slate-200 text-slate-400'
                      : 'bg-white border-slate-200 hover:border-slate-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/10 text-slate-900 cursor-pointer'
                  }`}
                >
                  <option value="">
                    {!selectedCategory
                      ? 'Select category first'
                      : currentCategoryPrograms.length === 0
                      ? 'No programs available'
                      : 'Select Program'}
                  </option>
                  {currentCategoryPrograms.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} {p.is_published ? ' ✓' : ''}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3.5 sm:px-4 text-slate-500">
                  <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
              </div>
            </div>

          </div>

          {/* RESULT AREA: ONLY SHOWN AFTER CHOOSING BOTH CATEGORY AND PROGRAM */}
          {activeProgram ? (
            <div className="space-y-4 animate-in fade-in duration-200">
              
              {/* Main Result Card */}
              <div
                id="result-card-container"
                className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-7 shadow-xs space-y-4 sm:space-y-5"
              >
                {/* Card Top: Event Title Overline, Program Name, Subtitle, and Published Badge */}
                <div className="flex items-start justify-between gap-3 sm:gap-4">
                  <div className="space-y-1 min-w-0 flex-1">
                    {/* Overline in Eventloo Brand Color (NOT green) */}
                    <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-indigo-600 block">
                      {event.title || 'GRAVITAS'}
                    </span>
                    <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight break-words">
                      {activeProgram.name}
                    </h2>
                    <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">
                      {activeProgram.category_name || activeProgram.category}
                      <span className="mx-1.5 sm:mx-2 text-slate-300">•</span>
                      {formatDateRange(event.start_date, event.end_date)}
                    </p>
                  </div>

                  {/* Status Badge in Eventloo Brand Color (NOT green) */}
                  <div className="shrink-0">
                    {activeProgram.is_published ? (
                      <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-indigo-50 border border-indigo-200/90 text-indigo-700 text-xs sm:text-sm font-bold shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                        <span>Published</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 text-xs sm:text-sm font-bold shadow-2xs">
                        <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                        <span>Pending</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Winner Ranking Rows */}
                {activeProgram.results && activeProgram.results.length > 0 ? (
                  <div className="space-y-2.5 sm:space-y-3 pt-1">
                    {activeProgram.results.map((res, idx) => {
                      const position = res.position || idx + 1;
                      const isFirst = position === 1;
                      const isSecond = position === 2;
                      const isThird = position === 3;

                      const rowStyle = isFirst
                        ? 'bg-indigo-50/40 border border-indigo-100/90'
                        : isSecond
                        ? 'bg-slate-50/80 border border-slate-200/80'
                        : isThird
                        ? 'bg-[#fffbf5] border border-amber-100/80'
                        : 'bg-white border border-slate-200/70';

                      return (
                        <div
                          key={idx}
                          className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-4 flex items-center justify-between gap-2 sm:gap-4 transition-all ${rowStyle}`}
                        >
                          {/* Left: Laurel Wreath Rank Badge + Participant Details */}
                          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
                            {position <= 3 ? (
                              <LaurelRankBadge rank={position} />
                            ) : (
                              <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
                                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 text-slate-600 font-extrabold text-xs sm:text-sm flex items-center justify-center">
                                  #{position}
                                </div>
                              </div>
                            )}

                            <div className="min-w-0 flex-1">
                              <h4 className="text-xs sm:text-base font-extrabold text-slate-900 truncate leading-snug">
                                {res.student_name || 'Participant'}
                              </h4>
                              <p className="text-[11px] sm:text-sm font-medium text-slate-500 mt-0.5 truncate">
                                {res.team_name}
                                {res.chest_number && (
                                  <>
                                    <span className="mx-1 text-slate-300">•</span>
                                    <span>#{res.chest_number}</span>
                                  </>
                                )}
                              </p>
                            </div>
                          </div>

                          {/* Right: Grade Pill + Vertical Divider + Points */}
                          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                            {res.grade && res.grade !== '-' && (
                              <span className="bg-indigo-100/70 text-indigo-700 font-bold px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg sm:rounded-xl text-[10px] sm:text-sm border border-indigo-200/60 shadow-2xs shrink-0">
                                {res.grade.startsWith('Grade') ? res.grade : `Grade ${res.grade}`}
                              </span>
                            )}

                            {/* Vertical Divider */}
                            <div className="w-px h-5 sm:h-6 bg-slate-200/90 shrink-0" />

                            {/* Points */}
                            <div className="min-w-[34px] sm:min-w-[44px] text-right shrink-0">
                              <span className="text-xs sm:text-base font-black text-slate-900 tracking-tight whitespace-nowrap">
                                {res.points || 0} pts
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-8 sm:py-10 text-center space-y-2 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 p-4">
                    <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 mx-auto" />
                    <h4 className="text-sm sm:text-base font-bold text-slate-800">
                      Results Under Evaluation
                    </h4>
                    <p className="text-xs text-slate-500 max-w-xs mx-auto">
                      Official scores for this program are being tabulated by judges. Please check back shortly.
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons: Print & Share */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-1">
                <div className="text-[11px] sm:text-xs text-slate-400 font-medium text-center sm:text-left">
                  Official Result · Generated by Eventloo
                </div>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
                  <button
                    onClick={() => window.print()}
                    className="w-full sm:w-auto px-3.5 py-2 sm:px-4 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Printer className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Print Result</span>
                  </button>
                  <button
                    onClick={handleCopy}
                    className="w-full sm:w-auto px-3.5 py-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Link Copied</span>
                      </>
                    ) : (
                      <>
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Share Result</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

            </div>
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/80 p-8 sm:p-12 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
                <Trophy className="w-6 h-6" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900">
                {!selectedCategory
                  ? 'Choose a Category'
                  : 'Choose a Program'}
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                {!selectedCategory
                  ? 'Select a category from the dropdown above to view the available programs.'
                  : 'Please select a program from the dropdown above to view the official results and winners.'}
              </p>
            </div>
          )}

        </main>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB D: POINTS TABLE TAB (MATCHING RESULTS CARD DESIGN IN OUR BRAND COLOR) */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'points' && (
        <main className="max-w-4xl mx-auto px-4 sm:px-6 py-4 sm:py-6 flex-1 w-full space-y-5 sm:space-y-6">
          
          {/* Top Header: Trophy / BarChart Squircle Icon + Title & Subtitle */}
          <div className="relative overflow-hidden bg-white/80 backdrop-blur-sm p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-2xs flex items-center gap-3 sm:gap-4">
            {/* Subtle decorative background wave in Eventloo indigo palette */}
            <div className="absolute right-0 top-0 w-72 h-full bg-gradient-to-l from-indigo-50/60 via-indigo-50/20 to-transparent pointer-events-none rounded-r-3xl" />
            
            <div className="w-11 h-11 sm:w-14 sm:h-14 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0 relative z-10">
              <Trophy className="w-5 h-5 sm:w-7 sm:h-7 text-indigo-600" />
            </div>
            <div className="relative z-10 min-w-0">
              <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-tight truncate">
                Points Table
              </h1>
              <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5 truncate">
                Official team championship standings and leaderboard
              </p>
            </div>
          </div>

          {/* Main Championship Standings Card (matching results card layout) */}
          <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 p-4 sm:p-7 shadow-xs space-y-4 sm:space-y-5 animate-in fade-in duration-200">
            
            {/* Card Top: Event Title Overline, Standings Headline, Subtitle, and Live Badge */}
            <div className="flex items-start justify-between gap-3 sm:gap-4">
              <div className="space-y-1 min-w-0 flex-1">
                {/* Overline in Eventloo Brand Color (NOT green) */}
                <span className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-indigo-600 block">
                  {event.title || 'GRAVITAS'}
                </span>
                <h2 className="text-xl sm:text-3xl font-black text-slate-900 tracking-tight leading-tight break-words">
                  Team Standings
                </h2>
                <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">
                  {teamStandings.length} Teams Competing
                  <span className="mx-1.5 sm:mx-2 text-slate-300">•</span>
                  Ranked by Total Points
                </p>
              </div>

              {/* Status Badge in Eventloo Brand Color (NOT green) */}
              <div className="shrink-0">
                <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2.5 py-1 sm:px-3.5 sm:py-1.5 rounded-xl bg-indigo-50 border border-indigo-200/90 text-indigo-700 text-xs sm:text-sm font-bold shadow-2xs">
                  <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-indigo-600" />
                  <span>Official Scores</span>
                </span>
              </div>
            </div>

            {/* Team Ranking Rows with Laurel Wreaths (Matching Reference Design) */}
            {teamStandings && teamStandings.length > 0 ? (
              <div className="space-y-2.5 sm:space-y-3 pt-1">
                {teamStandings.map((team, idx) => {
                  const position = team.rank || idx + 1;
                  const isFirst = position === 1;
                  const isSecond = position === 2;
                  const isThird = position === 3;

                  const rowStyle = isFirst
                    ? 'bg-indigo-50/40 border border-indigo-100/90'
                    : isSecond
                    ? 'bg-slate-50/80 border border-slate-200/80'
                    : isThird
                    ? 'bg-[#fffbf5] border border-amber-100/80'
                    : 'bg-white border border-slate-200/70';

                  const teamKey = team.team_id || idx;
                  const isExpanded = expandedTeamId === teamKey;
                  const hasBreakdown = team.program_results && team.program_results.length > 0;

                  return (
                    <div
                      key={teamKey}
                      className={`rounded-xl sm:rounded-2xl p-2.5 sm:p-4 transition-all ${rowStyle} ${hasBreakdown ? 'cursor-pointer' : ''}`}
                      onClick={() => hasBreakdown && setExpandedTeamId(isExpanded ? null : teamKey)}
                    >
                      <div className="flex items-center justify-between gap-2 sm:gap-4">
                        {/* Left: Laurel Wreath Rank Badge + Team Name & Stats */}
                        <div className="flex items-center gap-2 sm:gap-3.5 min-w-0 flex-1">
                          {position <= 3 ? (
                            <LaurelRankBadge rank={position} />
                          ) : (
                            <div className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0">
                              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 text-slate-600 font-extrabold text-xs sm:text-sm flex items-center justify-center">
                                #{position}
                              </div>
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-base font-extrabold text-slate-900 uppercase tracking-tight truncate leading-snug">
                              {team.team_name}
                            </h4>
                            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 mt-0.5 truncate">
                              {team.first_places > 0 ? `${team.first_places} ${team.first_places === 1 ? 'Win' : 'Wins'}` : 'Participant'}
                              {team.programs_count > 0 && ` • ${team.programs_count} Competed`}
                              {hasBreakdown && (
                                <span className="ml-1.5 text-indigo-600 font-bold hover:underline">
                                  {isExpanded ? 'Hide Breakdown ▲' : 'View Breakdown ▼'}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Right: Vertical Divider + Total Points */}
                        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                          <div className="w-px h-5 sm:h-6 bg-slate-200/90 shrink-0" />
                          <div className="min-w-[34px] sm:min-w-[48px] text-right shrink-0">
                            <span className="text-xs sm:text-base font-black text-slate-900 tracking-tight whitespace-nowrap">
                              {team.total_points ?? 0} pts
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Expandable Score Breakdown */}
                      {isExpanded && hasBreakdown && (
                        <div className="mt-3 pt-3 border-t border-slate-200/60 space-y-1.5 animate-in fade-in duration-150">
                          <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
                            Score Breakdown
                          </p>
                          <div className="grid grid-cols-1 gap-1.5">
                            {team.program_results.map((pr, pIdx) => (
                              <div key={pIdx} className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-white/80 border border-slate-200/60 shadow-2xs">
                                <span className="font-medium text-slate-700 truncate">
                                  {pr.program_name} {pr.participant_name ? `• ${pr.participant_name}` : ''}
                                </span>
                                <span className="font-bold text-indigo-700 shrink-0 ml-2">
                                  {pr.position ? `${pr.position === 1 ? '1st' : pr.position === 2 ? '2nd' : '3rd'} Place • ` : ''}+{pr.points_earned} pts
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="py-8 sm:py-10 text-center space-y-2 bg-slate-50/60 rounded-2xl border border-dashed border-slate-200 p-4">
                <Clock className="w-7 h-7 sm:w-8 sm:h-8 text-amber-500 mx-auto" />
                <h4 className="text-sm sm:text-base font-bold text-slate-800">
                  No Points Tabulated Yet
                </h4>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Team standings will automatically populate as program results are published.
                </p>
              </div>
            )}

          </div>

          {/* Action Buttons: Print & Share */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 pt-1">
            <div className="text-[11px] sm:text-xs text-slate-400 font-medium text-center sm:text-left">
              Official Points Standings · Generated by Eventloo
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <button
                onClick={() => window.print()}
                className="w-full sm:w-auto px-3.5 py-2 sm:px-4 sm:py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Printer className="w-3.5 h-3.5 text-indigo-600" />
                <span>Print Standings</span>
              </button>
              <button
                onClick={handleCopy}
                className="w-full sm:w-auto px-3.5 py-2 sm:px-4 sm:py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Link Copied</span>
                  </>
                ) : (
                  <>
                    <Share2 className="w-3.5 h-3.5" />
                    <span>Share Standings</span>
                  </>
                )}
              </button>
            </div>
          </div>

        </main>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB E: SCHEDULE TAB (DATE SELECTOR RIBBON + TIMELINE TABLE)                */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'schedule' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8 flex-1 w-full space-y-5 sm:space-y-6">
          
          {/* Header */}
          <div className="space-y-1">
            <div className="text-[10px] sm:text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">
              {event.title}
            </div>
            <h1 className="text-xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Program Schedule
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Complete program schedule for {event.title}.
            </p>
          </div>

          {/* Date Picker Ribbon with smooth mobile horizontal swipe */}
          {scheduleDates.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 no-scrollbar touch-pan-x">
              <button
                onClick={() => setSelectedDate('all')}
                className={`px-3.5 py-2 sm:px-4 sm:py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedDate === 'all'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80 shadow-2xs'
                }`}
              >
                All Days
              </button>
              {scheduleDates.map((item) => {
                const isSelected = selectedDate === item.iso;
                return (
                  <button
                    key={item.iso}
                    onClick={() => setSelectedDate(item.iso)}
                    className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs transition-all shrink-0 cursor-pointer flex flex-col items-center min-w-[64px] sm:min-w-[76px] ${
                      isSelected
                        ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80 shadow-2xs'
                    }`}
                  >
                    <span className="font-bold">{item.labelMonth}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                      {item.labelDay}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* MOBILE VIEW: SLEEK PROGRAM SCHEDULE CARDS */}
          <div className="block md:hidden space-y-3">
            {schedulePrograms.length === 0 ? (
              <div className="py-10 text-center text-slate-400 bg-white rounded-2xl border border-slate-200/80 p-6">
                No schedule entries found for the selected filter.
              </div>
            ) : (
              schedulePrograms.map((prog) => (
                <div
                  key={prog.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100/80 text-indigo-700 text-xs font-bold">
                      <Clock className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{formatTimeSlot(prog.start_time, prog.end_time)}</span>
                    </span>
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-medium">
                      <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                      <span className="truncate max-w-[120px]">{prog.stage_name || prog.venue || 'Main Stage'}</span>
                    </span>
                  </div>

                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 leading-snug">
                      {prog.name}
                    </h4>
                    <p className="text-xs font-semibold text-slate-500 mt-0.5">
                      {prog.category_name || prog.category}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* DESKTOP VIEW: CLEAN SCHEDULE TABLE CARD */}
          <div className="hidden md:block bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4 w-44">Time</th>
                    <th className="py-3.5 px-4">Program</th>
                    <th className="py-3.5 px-4">Category</th>
                    <th className="py-3.5 px-4">Venue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {schedulePrograms.length === 0 ? (
                    <tr>
                      <td colSpan="4" className="py-12 text-center text-slate-400">
                        No schedule entries found for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    schedulePrograms.map((prog) => (
                      <tr key={prog.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* Time */}
                        <td className="py-4 px-4 font-semibold text-slate-700 whitespace-nowrap">
                          {formatTimeSlot(prog.start_time, prog.end_time)}
                        </td>

                        {/* Program Name */}
                        <td className="py-4 px-4">
                          <span className="font-bold text-slate-900 block">
                            {prog.name}
                          </span>
                        </td>

                        {/* Category */}
                        <td className="py-4 px-4 text-slate-600 font-medium whitespace-nowrap">
                          {prog.category_name || prog.category}
                        </td>

                        {/* Venue */}
                        <td className="py-4 px-4 text-slate-600 whitespace-nowrap">
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs">
                            <MapPin className="w-3 h-3 text-slate-400" />
                            <span>{prog.stage_name || prog.venue || 'Main Stage'}</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      )}

      {/* ========================================================================= */}
      {/* 3. QR MODAL POPUP                                                         */}
      {/* ========================================================================= */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 sm:p-7 text-center shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 relative">
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

              {data?.qr_code_svg ? (
                <div
                  dangerouslySetInnerHTML={{ __html: data.qr_code_svg }}
                  className="w-full h-full flex items-center justify-center p-1.5"
                />
              ) : (
                <div className="text-xs text-slate-400">Generating QR...</div>
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

              <button
                onClick={() => setShowQrModal(false)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. FOOTER (BRANDING + LINKS + SOCIALS + COPYRIGHT)                         */}
      {/* ========================================================================= */}
      <footer className="bg-white border-t border-slate-200/80 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            
            {/* Col 1: Brand & Tagline */}
            <div className="md:col-span-5 space-y-3">
              <EventlooLogo size="sm" onClick={() => handleTabChange('home')} />
              <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
                A complete event management system designed for colleges, schools, and organizations to plan, track, and publish events seamlessly.
              </p>
            </div>

            {/* Col 2: Quick Links */}
            <div className="md:col-span-4 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Quick Links
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li>
                  <button
                    onClick={() => handleTabChange('home')}
                    className="hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange('programs')}
                    className="hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    Programs & Results
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange('points')}
                    className="hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    Points Table
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange('schedule')}
                    className="hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    Program Schedule
                  </button>
                </li>
              </ul>
            </div>

            {/* Col 3: Support */}
            <div className="md:col-span-3 space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-900">
                Platform
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-600">
                <li>
                  <button
                    onClick={() => handleTabChange('about')}
                    className="hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    About Platform
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    Digital QR Pass
                  </button>
                </li>
                <li>
                  <a
                    href="/"
                    className="hover:text-indigo-600 transition-colors cursor-pointer"
                  >
                    Host Your Event
                  </a>
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Copyright Bar */}
          <div className="pt-8 mt-8 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
            <p>© {new Date().getFullYear()} Eventloo. All rights reserved.</p>
            <p>Live Campus Event Management</p>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default PublicEventPortal;
