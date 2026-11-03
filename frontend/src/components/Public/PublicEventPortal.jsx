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
  BarChart3
} from 'lucide-react';
import { publicEventAPI } from '../../services/api';

/**
 * 4-Petal Green Clover Logo for Eventloo Brand
 */
const EventlooLogo = ({ onClick }) => (
  <div
    onClick={onClick}
    className="flex items-center gap-2.5 cursor-pointer select-none group"
    title="Eventloo Event Management Platform"
  >
    <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center shrink-0">
      <svg
        className="w-full h-full transform transition-transform group-hover:rotate-12 duration-300"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Four rounded petals forming modern clover */}
        <path
          d="M20 18C16.6 18 14 15.4 14 12C14 8.6 16.6 6 20 6C23.4 6 26 8.6 26 12C26 15.4 23.4 18 20 18Z"
          fill="#059669"
        />
        <path
          d="M22 20C22 16.6 24.6 14 28 14C31.4 14 34 16.6 34 20C34 23.4 31.4 26 28 26C24.6 26 22 23.4 22 20Z"
          fill="#10B981"
        />
        <path
          d="M20 22C23.4 22 26 24.6 26 28C26 31.4 23.4 34 20 34C16.6 34 14 31.4 14 28C14 24.6 16.6 22 20 22Z"
          fill="#047857"
        />
        <path
          d="M18 20C18 23.4 15.4 26 12 26C8.6 26 6 23.4 6 20C6 16.6 8.6 14 12 14C15.4 14 18 16.6 18 20Z"
          fill="#34D399"
        />
        <circle cx="20" cy="20" r="3.2" fill="#064E3B" />
      </svg>
    </div>
    <span className="font-extrabold text-lg sm:text-xl tracking-tight text-slate-900 leading-none">
      Event<span className="text-emerald-700 font-black">loo</span>
    </span>
  </div>
);

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
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState(null);

  // Schedule tab state
  const [selectedDate, setSelectedDate] = useState('all');
  const [selectedStageId, setSelectedStageId] = useState('all');

  // Modals & UI helpers
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

      // Auto-select first program
      const published = (res.data?.programs || []).filter((p) => p.is_published);
      if (published.length > 0) {
        setSelectedProgramId(published[0].id);
      } else if (res.data?.programs?.length > 0) {
        setSelectedProgramId(res.data.programs[0].id);
      }
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

  // Selected program details
  const activeProgram = useMemo(() => {
    if (!selectedProgramId) return filteredPrograms[0] || null;
    return programs.find((p) => p.id === selectedProgramId) || filteredPrograms[0] || null;
  }, [programs, selectedProgramId, filteredPrograms]);

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
          <div className="w-9 h-9 border-3 border-emerald-200 border-t-emerald-700 rounded-full animate-spin mx-auto" />
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition-colors shadow-2xs"
          >
            Go to Eventloo Home
          </a>
        </div>
      </div>
    );
  }

  const totalProgramsCount = stats.total_programs ?? programs.length;
  const totalTeamsCount = stats.total_teams ?? (teamStandings.length || 2);
  const totalPublishedResults =
    stats.published_results_count ?? programs.filter((p) => p.is_published).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 flex flex-col font-sans selection:bg-emerald-100 selection:text-emerald-900">
      
      {/* ========================================================================= */}
      {/* 1. TOP NAVBAR (EVENTLOO BRANDING + TAB LINKS + LIVE PORTAL CTA)           */}
      {/* ========================================================================= */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-40 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
          
          {/* Brand: Green Clover + Eventloo */}
          <EventlooLogo onClick={() => handleTabChange('home')} />

          {/* Desktop Nav Items */}
          <nav className="hidden md:flex items-center space-x-1 lg:space-x-2">
            {[
              { id: 'home', label: 'Home' },
              { id: 'about', label: 'About' },
              { id: 'programs', label: 'Programs' },
              { id: 'results', label: 'Results' },
              { id: 'points', label: 'Points' },
              { id: 'schedule', label: 'Schedule' },
            ].map((tab) => {
              const isActive =
                activeTab === tab.id ||
                (tab.id === 'results' && activeTab === 'programs') ||
                (tab.id === 'programs' && activeTab === 'programs');
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`px-3.5 py-1.5 text-xs lg:text-sm font-semibold transition-all rounded-lg cursor-pointer relative ${
                    isActive
                      ? 'text-emerald-800 font-bold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-3 right-3 h-0.5 bg-emerald-700 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* QR Pass Button */}
            <button
              onClick={() => setShowQrModal(true)}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-semibold"
              title="Show QR Code"
            >
              <QrCode className="w-4 h-4 text-emerald-700" />
              <span className="hidden lg:inline text-slate-700">QR Pass</span>
            </button>

            {/* Share / Copy Link */}
            <button
              onClick={handleCopy}
              className="p-2 sm:px-3 sm:py-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              title="Copy link"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span className="hidden sm:inline text-emerald-700">Copied</span>
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4 text-slate-600" />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>

            {/* Live Portal Button */}
            <button
              onClick={() => handleTabChange('results')}
              className="px-4 py-2 bg-emerald-800 hover:bg-emerald-900 text-white rounded-full transition-all text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-sm hover:shadow active:scale-95"
            >
              <span>Live Portal</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Nav Drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-200/80 bg-white px-4 py-3 space-y-1 shadow-lg animate-in slide-in-from-top-2">
            {[
              { id: 'home', label: 'Home' },
              { id: 'about', label: 'About' },
              { id: 'programs', label: 'Programs' },
              { id: 'results', label: 'Results' },
              { id: 'points', label: 'Points' },
              { id: 'schedule', label: 'Schedule' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`w-full text-left px-3 py-2 text-xs font-semibold rounded-lg ${
                  activeTab === tab.id
                    ? 'bg-emerald-50 text-emerald-800 font-bold'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {tab.label}
              </button>
            ))}
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
          
          {/* HERO SECTION WITH ORGANIC MINT GRADIENT & FESTIVAL CARD */}
          <section className="relative overflow-hidden pt-8 sm:pt-12 pb-14 sm:pb-20 bg-gradient-to-b from-emerald-50/70 via-teal-50/30 to-[#f8fafc]">
            {/* Subtle organic background curves */}
            <div className="absolute top-0 right-0 w-[550px] h-[550px] bg-gradient-to-br from-emerald-200/40 via-teal-200/20 to-transparent rounded-full blur-3xl pointer-events-none -mr-28 -mt-28" />
            <div className="absolute bottom-0 left-0 w-[450px] h-[450px] bg-gradient-to-tr from-emerald-100/30 via-slate-100/40 to-transparent rounded-full blur-3xl pointer-events-none -ml-24 -mb-24" />

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
                
                {/* Left Column: Festival Title, Date, Venue, CTAs */}
                <div className="lg:col-span-7 space-y-5">
                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/70 text-emerald-800 border border-emerald-200/60 text-[11px] font-bold uppercase tracking-[0.2em]">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{event.school_name ? `${event.school_name} FESTIVAL` : 'CAMPUS FESTIVAL'}</span>
                  </div>

                  <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.1]">
                    {event.title}
                  </h1>

                  <p className="text-base sm:text-lg text-slate-600 leading-relaxed max-w-xl">
                    {event.description ||
                      'A celebration of talent, creativity, and campus spirit bringing together students across disciplines.'}
                  </p>

                  {/* Dates & Venue pill */}
                  <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs sm:text-sm text-slate-700 font-medium pt-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{formatDateRange(event.start_date, event.end_date)}</span>
                    </div>
                    <span className="text-slate-300 hidden sm:inline">|</span>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
                      <span>{event.venue || 'Campus Main Grounds'}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-3">
                    <button
                      onClick={() => handleTabChange('results')}
                      className="px-6 py-3 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-sm rounded-full transition-all flex items-center gap-2 cursor-pointer shadow-sm hover:shadow-md active:scale-95"
                    >
                      <span>Explore Results</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleTabChange('schedule')}
                      className="px-6 py-3 bg-white hover:bg-slate-50 text-slate-800 font-semibold text-sm rounded-full border border-slate-200/90 transition-all cursor-pointer shadow-2xs hover:shadow-sm"
                    >
                      View Schedule
                    </button>
                  </div>
                </div>

                {/* Right Column: Festival Emblem Card (with School Logo or Vector Emblem) */}
                <div className="lg:col-span-5 flex justify-center lg:justify-end">
                  <div className="relative w-full max-w-sm sm:max-w-md aspect-4/3 sm:aspect-square rounded-3xl bg-gradient-to-br from-white via-emerald-50/50 to-teal-100/30 p-6 sm:p-8 border border-white/80 shadow-xl flex flex-col items-center justify-center text-center overflow-hidden">
                    
                    {/* Background artistic organic gradient blob */}
                    <div className="absolute -top-12 -right-12 w-48 h-48 bg-emerald-400/20 rounded-full blur-2xl" />
                    <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-teal-300/20 rounded-full blur-2xl" />

                    {event.school_logo ? (
                      <div className="space-y-4 relative z-10 flex flex-col items-center">
                        <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white p-3 border border-slate-200/70 shadow-sm flex items-center justify-center">
                          <img
                            src={event.school_logo}
                            alt={event.school_name || 'Event Logo'}
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <div>
                          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                            {event.title}
                          </h2>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 mt-1">
                            CAMPUS FESTIVAL
                          </p>
                        </div>
                      </div>
                    ) : (
                      /* Stylized vector leaf emblem from mockup */
                      <div className="space-y-4 relative z-10 flex flex-col items-center">
                        <div className="w-24 h-24 sm:w-28 sm:h-28 flex items-center justify-center">
                          <svg
                            viewBox="0 0 100 100"
                            className="w-full h-full drop-shadow-md"
                            fill="none"
                            xmlns="http://www.w3.org/2000/svg"
                          >
                            <path
                              d="M50 15 C70 15, 85 35, 80 65 C65 65, 55 55, 50 15 Z"
                              fill="#059669"
                            />
                            <path
                              d="M50 15 C30 25, 20 50, 35 80 C50 75, 55 60, 50 15 Z"
                              fill="#10B981"
                              opacity="0.85"
                            />
                            <path
                              d="M35 80 C50 85, 75 80, 80 65 C60 65, 45 75, 35 80 Z"
                              fill="#047857"
                            />
                          </svg>
                        </div>
                        <div>
                          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                            {event.title}
                          </h2>
                          <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700 mt-1">
                            CAMPUS FESTIVAL
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* STATS FLOATING CARD STRIP */}
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-10 relative z-20">
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-md p-6 sm:p-8">
              <div className="grid grid-cols-1 sm:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-slate-100 gap-6 sm:gap-0">
                
                {/* Stat 1: Programs */}
                <div className="flex flex-col items-center text-center space-y-2 py-2 sm:py-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Box className="w-5 h-5" />
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {totalProgramsCount}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Programs
                  </span>
                </div>

                {/* Stat 2: Teams */}
                <div className="flex flex-col items-center text-center space-y-2 py-2 sm:py-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Users className="w-5 h-5" />
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {totalTeamsCount}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Teams
                  </span>
                </div>

                {/* Stat 3: Results Published */}
                <div className="flex flex-col items-center text-center space-y-2 py-2 sm:py-0">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <span className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                    {totalPublishedResults}
                  </span>
                  <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Results Published
                  </span>
                </div>

              </div>
            </div>
          </div>

          {/* SECTION 1: ABOUT THE FESTIVAL (WHAT IS GRAVITAS?) */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-2xs">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
                
                <div className="lg:col-span-7 space-y-4">
                  <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                    About the Festival
                  </div>
                  <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-slate-900 tracking-tight">
                    What is {event.title}?
                  </h2>
                  <p className="text-slate-600 text-sm sm:text-base leading-relaxed">
                    {event.title} is {event.school_name || 'our campus'}&apos;s premier annual festival that
                    brings together students across disciplines to showcase talent, creativity, and
                    teamwork through a diverse range of cultural, artistic, and competitive events.
                  </p>
                  {event.description && (
                    <p className="text-slate-500 text-xs sm:text-sm leading-relaxed border-l-2 border-emerald-500 pl-4 py-1 italic">
                      &quot;{event.description}&quot;
                    </p>
                  )}
                  <div className="pt-2">
                    <button
                      onClick={() => handleTabChange('about')}
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                    >
                      <span>Read full festival details</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="lg:col-span-5 flex justify-center">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-200 shadow-md w-full aspect-4/3">
                    <img
                      src="/campus_festival_building.jpg"
                      alt={event.school_name || 'Campus'}
                      className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent flex items-end p-4">
                      <span className="text-xs font-semibold text-white/90">
                        {event.school_name || 'Campus Festival Hub'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* SECTION 2: ABOUT EVENTLOO (POWERING CAMPUS EVENTS WITH EVENTLOO) */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="space-y-6">
              
              <div className="max-w-2xl space-y-2">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  About Eventloo
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  Powering Campus Events with Eventloo
                </h2>
                <p className="text-slate-600 text-sm leading-relaxed">
                  Eventloo is a modern event management system designed for colleges, schools, and
                  organizations to plan, manage, and showcase events seamlessly.
                </p>
              </div>

              {/* 4 Feature Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Feature 1 */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md transition-shadow space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Event Management</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      End-to-end program scheduling, team allocations, and stage coordination.
                    </p>
                  </div>
                </div>

                {/* Feature 2 */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md transition-shadow space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <BarChart3 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Live Results</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Instant judge score computation, real-time publishing, and ranking feeds.
                    </p>
                  </div>
                </div>

                {/* Feature 3 */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md transition-shadow space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Team & Points</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Automated leaderboard calculation, grade points tracking, and trophy tallies.
                    </p>
                  </div>
                </div>

                {/* Feature 4 */}
                <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-2xs hover:shadow-md transition-shadow space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <QrCode className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Digital Access</h3>
                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      Quick QR pass sharing, participant verification, and instant mobile portal access.
                    </p>
                  </div>
                </div>

              </div>

            </div>
          </section>

          {/* SECTION 3: VISION & MISSION */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              {/* Vision Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-2xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Flag className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Our Vision</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  To make campus events more organized, transparent, and engaging through simple,
                  reliable, and state-of-the-art event technology.
                </p>
              </div>

              {/* Mission Card */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-2xs space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <h3 className="text-base font-bold text-slate-900">Our Mission</h3>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  To empower colleges, schools, and student communities with a unified platform for
                  planning, seamless participation, and instant public recognition.
                </p>
              </div>

            </div>
          </section>

          {/* SECTION 4: HOW IT WORKS (FROM REGISTRATION TO RESULTS) */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-3xl border border-slate-200/80 p-6 sm:p-10 shadow-2xs space-y-8">
              
              <div className="space-y-1">
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                  How It Works
                </div>
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  From Registration to Results
                </h2>
              </div>

              {/* 4 Steps with arrows */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative">
                
                {/* Step 1 */}
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Create Event</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Set up programs, teams, rules, and stages in seconds.
                  </p>
                </div>

                {/* Step 2 */}
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Layers className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Manage</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Handle registrations, student assignments, and participation.
                  </p>
                </div>

                {/* Step 3 */}
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Activity className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Track</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Monitor live stage flow, scoring, and points updates.
                  </p>
                </div>

                {/* Step 4 */}
                <div className="space-y-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                    <Trophy className="w-5 h-5" />
                  </div>
                  <h4 className="text-sm font-bold text-slate-900">Publish</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">
                    Share results, certificates, and rankings instantly with the campus.
                  </p>
                </div>

              </div>

            </div>
          </section>

          {/* SECTION 5: DARK EMERALD EXPLORE BANNER */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-950 text-white p-8 sm:p-14 text-center space-y-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/20 rounded-full blur-3xl pointer-events-none" />

              <div className="relative z-10 max-w-xl mx-auto space-y-3">
                <h3 className="text-2xl sm:text-4xl font-black tracking-tight">
                  Explore {event.title}
                </h3>
                <p className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed">
                  Check live results, points table, and the complete official program schedule.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3 pt-3">
                  <button
                    onClick={() => handleTabChange('results')}
                    className="px-6 py-2.5 bg-white hover:bg-slate-100 text-emerald-950 font-bold text-xs sm:text-sm rounded-full transition-all cursor-pointer shadow-sm active:scale-95"
                  >
                    View Results →
                  </button>
                  <button
                    onClick={() => handleTabChange('schedule')}
                    className="px-6 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/25 font-semibold text-xs sm:text-sm rounded-full transition-all cursor-pointer"
                  >
                    See Schedule
                  </button>
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
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
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
                    <Calendar className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span className="font-semibold text-slate-800">Event Dates:</span>
                    <span>{formatDateRange(event.start_date, event.end_date)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
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
          <div className="flex flex-wrap items-center justify-center gap-3 pt-4">
            <button
              onClick={() => handleTabChange('results')}
              className="px-6 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold text-xs sm:text-sm rounded-full transition-colors"
            >
              Explore Program Results →
            </button>
            <button
              onClick={() => handleTabChange('points')}
              className="px-6 py-2.5 bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 font-semibold text-xs sm:text-sm rounded-full transition-colors"
            >
              View Points Table
            </button>
          </div>

        </main>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB C: PROGRAMS & RESULTS TAB (2-COL LAYOUT WITH CATEGORY PILLS)           */}
      {/* ------------------------------------------------------------------------- */}
      {(activeTab === 'results' || activeTab === 'programs') && (
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full space-y-6">
          
          {/* Header Tag + Title */}
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              {event.title}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Program Results
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Official results and winners for all programs.
            </p>
          </div>

          {/* Category Filter Pills & Search Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Category Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 no-scrollbar">
              <button
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedCategory === 'all'
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                }`}
              >
                All Categories
              </button>
              {categories.map((cat) => {
                const isSelected = selectedCategory === cat.code;
                return (
                  <button
                    key={cat.code}
                    onClick={() => setSelectedCategory(cat.code)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-800 text-white font-bold shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                  >
                    {cat.name}
                  </button>
                );
              })}
            </div>

            {/* Search Input */}
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search programs..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-200/90 rounded-xl text-xs placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-600 transition-all shadow-2xs"
              />
            </div>
          </div>

          {/* 2-Column Layout: Left List + Right Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left Column: Programs List (4 cols) */}
            <div className="lg:col-span-5 xl:col-span-4 bg-white rounded-2xl border border-slate-200/80 p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Programs ({filteredPrograms.length})
                </span>
                <span className="text-[10px] text-slate-400 font-medium">Select to view</span>
              </div>

              {filteredPrograms.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Box className="w-8 h-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-medium text-slate-500">No programs match your filter</p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[600px] overflow-y-auto pr-1">
                  {filteredPrograms.map((p) => {
                    const isSelected = activeProgram?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => setSelectedProgramId(p.id)}
                        className={`w-full text-left p-3 rounded-xl transition-all cursor-pointer flex items-center justify-between gap-3 border ${
                          isSelected
                            ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs'
                            : 'bg-white hover:bg-slate-50/80 border-slate-100'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                              isSelected
                                ? 'bg-emerald-700 text-white'
                                : 'bg-slate-100 text-slate-500'
                            }`}
                          >
                            <Box className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h4
                              className={`text-xs sm:text-sm font-bold truncate ${
                                isSelected ? 'text-emerald-950' : 'text-slate-800'
                              }`}
                            >
                              {p.name}
                            </h4>
                            <span className="text-[10px] text-slate-400 block truncate font-medium">
                              {p.category_name || p.category}
                            </span>
                          </div>
                        </div>

                        {p.is_published ? (
                          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" title="Results Published" />
                        ) : (
                          <span className="w-2 h-2 rounded-full bg-slate-200 shrink-0" title="Pending" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right Column: Selected Program Detail View (7-8 cols) */}
            <div className="lg:col-span-7 xl:col-span-8 bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-7 shadow-2xs space-y-6">
              {activeProgram ? (
                <>
                  {/* Program Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-4 border-b border-slate-100">
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                        {activeProgram.category_name || activeProgram.category}
                      </span>
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight pt-1">
                        {activeProgram.name}
                      </h2>
                      {(activeProgram.venue || activeProgram.stage_name) && (
                        <p className="text-xs text-slate-500 flex items-center gap-1.5 pt-0.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          <span>{activeProgram.stage_name || activeProgram.venue}</span>
                          {activeProgram.start_time && (
                            <>
                              <span>·</span>
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              <span>{formatTimeSlot(activeProgram.start_time, activeProgram.end_time)}</span>
                            </>
                          )}
                        </p>
                      )}
                    </div>

                    {activeProgram.is_published ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 self-start">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Results Published</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-800 border border-amber-200 self-start">
                        <Clock className="w-3.5 h-3.5 text-amber-600" />
                        <span>In Progress / Scheduled</span>
                      </span>
                    )}
                  </div>

                  {/* Winners & Rankings */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Winners & Rankings
                    </h3>

                    {activeProgram.results && activeProgram.results.length > 0 ? (
                      <div className="space-y-2.5">
                        {activeProgram.results.map((res, idx) => {
                          const isGold = res.position === 1 || idx === 0;
                          const isSilver = res.position === 2 || idx === 1;
                          const isBronze = res.position === 3 || idx === 2;

                          return (
                            <div
                              key={idx}
                              className={`p-3.5 sm:p-4 rounded-xl border flex items-center justify-between gap-3 transition-colors ${
                                isGold
                                  ? 'bg-amber-50/50 border-amber-200/80 shadow-2xs'
                                  : isSilver
                                  ? 'bg-slate-50/60 border-slate-200/80'
                                  : isBronze
                                  ? 'bg-amber-50/20 border-amber-200/50'
                                  : 'bg-white border-slate-100'
                              }`}
                            >
                              <div className="flex items-center gap-3.5 min-w-0">
                                {/* Position badge */}
                                <div
                                  className={`w-9 h-9 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${
                                    isGold
                                      ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                      : isSilver
                                      ? 'bg-slate-100 text-slate-700 border border-slate-300'
                                      : isBronze
                                      ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                      : 'bg-slate-50 text-slate-600'
                                  }`}
                                >
                                  {res.position ? `#${res.position}` : `#${idx + 1}`}
                                </div>

                                <div className="min-w-0">
                                  <h4 className="text-sm font-bold text-slate-900 truncate">
                                    {res.student_name || 'Participant'}
                                  </h4>
                                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                    <span className="font-semibold uppercase tracking-wider text-slate-600">
                                      {res.team_name || 'General'}
                                    </span>
                                    {res.chest_number && (
                                      <>
                                        <span>·</span>
                                        <span className="text-slate-400">Chest #{res.chest_number}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Grade & Points pills */}
                              <div className="flex items-center gap-2 shrink-0">
                                {res.grade && res.grade !== '-' && (
                                  <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    Grade {res.grade}
                                  </span>
                                )}
                                <span className="px-3 py-1 rounded-lg text-xs font-black bg-slate-100 text-slate-800">
                                  {res.points} pts
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 p-8 text-center space-y-2">
                        <Clock className="w-8 h-8 text-slate-400 mx-auto" />
                        <h4 className="text-sm font-bold text-slate-700">Results Pending</h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Results have not been officially published for this program yet. Check back soon for live updates.
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-center py-16 space-y-3">
                  <Box className="w-10 h-10 text-slate-300 mx-auto" />
                  <p className="text-xs text-slate-500">Select a program on the left to view details</p>
                </div>
              )}
            </div>

          </div>

        </main>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB D: POINTS TABLE TAB (CLEAN STANDINGS TABLE LIKE MOCKUP)               */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'points' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full space-y-6">
          
          {/* Header */}
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              {event.title}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Points Table
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Team standings based on official published results.
            </p>
          </div>

          {/* Standings Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-200/80 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    <th className="py-3.5 px-4 w-16 text-center">#</th>
                    <th className="py-3.5 px-4">Team</th>
                    <th className="py-3.5 px-4 text-center">Programs</th>
                    <th className="py-3.5 px-4 text-center">Wins</th>
                    <th className="py-3.5 px-4 text-right">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs sm:text-sm">
                  {teamStandings.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="py-12 text-center text-slate-400">
                        No team scores recorded yet. Results will update automatically.
                      </td>
                    </tr>
                  ) : (
                    teamStandings.map((team, idx) => {
                      const isRank1 = team.rank === 1 || idx === 0;
                      const isRank2 = team.rank === 2 || idx === 1;
                      const isRank3 = team.rank === 3 || idx === 2;

                      return (
                        <tr
                          key={team.team_id || idx}
                          className={`hover:bg-slate-50/70 transition-colors ${
                            isRank1 ? 'bg-emerald-50/20' : ''
                          }`}
                        >
                          {/* Rank # */}
                          <td className="py-4 px-4 text-center">
                            <span
                              className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-black ${
                                isRank1
                                  ? 'bg-amber-100 text-amber-800'
                                  : isRank2
                                  ? 'bg-slate-100 text-slate-700'
                                  : isRank3
                                  ? 'bg-amber-50 text-amber-900'
                                  : 'text-slate-500'
                              }`}
                            >
                              {team.rank || idx + 1}
                            </span>
                          </td>

                          {/* Team Name */}
                          <td className="py-4 px-4">
                            <div className="font-bold text-slate-900 uppercase tracking-tight">
                              {team.team_name}
                            </div>
                          </td>

                          {/* Programs Count */}
                          <td className="py-4 px-4 text-center text-slate-600 font-semibold">
                            {team.programs_count ?? team.programs_won ?? 0}
                          </td>

                          {/* Wins (1st places) */}
                          <td className="py-4 px-4 text-center text-slate-600 font-semibold">
                            {team.first_places ?? team.programs_won ?? 0}
                          </td>

                          {/* Total Points */}
                          <td className="py-4 px-4 text-right">
                            <span className="font-black text-sm sm:text-base text-slate-900">
                              {team.total_points ?? 0}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </main>
      )}

      {/* ------------------------------------------------------------------------- */}
      {/* TAB E: SCHEDULE TAB (DATE SELECTOR RIBBON + TIMELINE TABLE LIKE MOCKUP)    */}
      {/* ------------------------------------------------------------------------- */}
      {activeTab === 'schedule' && (
        <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex-1 w-full space-y-6">
          
          {/* Header */}
          <div className="space-y-1">
            <div className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
              {event.title}
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              Program Schedule
            </h1>
            <p className="text-xs sm:text-sm text-slate-500">
              Complete program schedule for {event.title}.
            </p>
          </div>

          {/* Date Picker Ribbon */}
          {scheduleDates.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                onClick={() => setSelectedDate('all')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                  selectedDate === 'all'
                    ? 'bg-emerald-800 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
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
                    className={`px-4 py-2 rounded-xl text-xs transition-all shrink-0 cursor-pointer flex flex-col items-center min-w-[76px] ${
                      isSelected
                        ? 'bg-emerald-800 text-white font-bold shadow-2xs'
                        : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
                    }`}
                  >
                    <span className="font-bold">{item.labelMonth}</span>
                    <span className={`text-[10px] ${isSelected ? 'text-emerald-200' : 'text-slate-400'}`}>
                      {item.labelDay}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Schedule Table Card */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
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
          <div className="bg-white rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Official Event QR Pass
              </h3>
              <p className="text-xs text-slate-500">
                Scan with any smartphone camera to open live results and standings.
              </p>
            </div>

            {/* QR SVG */}
            <div className="w-48 h-48 mx-auto p-3 bg-white rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-center">
              {data?.qr_code_svg ? (
                <div
                  dangerouslySetInnerHTML={{ __html: data.qr_code_svg }}
                  className="w-full h-full flex items-center justify-center"
                />
              ) : (
                <div className="text-xs text-slate-400">Generating QR...</div>
              )}
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copied ? 'Link Copied' : 'Copy Page Link'}</span>
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
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
              <EventlooLogo onClick={() => handleTabChange('home')} />
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
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    Home
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange('programs')}
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    Programs & Results
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange('points')}
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    Points Table
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => handleTabChange('schedule')}
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
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
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    About Platform
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setShowQrModal(true)}
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
                  >
                    Digital QR Pass
                  </button>
                </li>
                <li>
                  <a
                    href="/"
                    className="hover:text-emerald-700 transition-colors cursor-pointer"
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
