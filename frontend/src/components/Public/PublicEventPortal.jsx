import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Trophy,
  Award,
  Calendar,
  MapPin,
  Search,
  Share2,
  Copy,
  Check,
  ChevronRight,
  Clock,
  Sparkles,
  QrCode,
  Layers,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  GraduationCap,
  Target,
  BarChart3,
  Rocket,
  ShieldCheck,
  Flame
} from 'lucide-react';
import { publicEventAPI } from '../../services/api';

const PublicEventPortal = () => {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Active view tab: 'results' | 'points' | 'schedule'
  const [activeTab, setActiveTab] = useState('results');

  // Results tab filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState(null);

  // Schedule tab filter
  const [selectedStageId, setSelectedStageId] = useState('all');

  // Copy URL state
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  useEffect(() => {
    fetchPortalData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await publicEventAPI.getPublicPortal(eventId);
      setData(res.data);
      // Auto-select first published program if available
      const published = (res.data?.programs || []).filter(p => p.is_published);
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
  const categories = data?.categories || [];
  const programs = data?.programs || [];
  const teamStandings = data?.team_standings || [];
  const stages = data?.stages || [];

  // Filter programs by category & search
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchSearch = !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [programs, selectedCategory, searchTerm]);

  // Selected program details
  const activeProgram = useMemo(() => {
    if (!selectedProgramId) return filteredPrograms[0] || null;
    return programs.find(p => p.id === selectedProgramId) || filteredPrograms[0] || null;
  }, [programs, selectedProgramId, filteredPrograms]);

  // Schedule programs
  const schedulePrograms = useMemo(() => {
    return programs.filter(p => {
      if (selectedStageId === 'all') return p.start_time || p.stage_name;
      return p.stage_name === selectedStageId || p.venue === selectedStageId;
    });
  }, [programs, selectedStageId]);

  const formatDate = (isoString) => {
    if (!isoString) return 'TBD';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const formatTime = (isoString) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    } catch {
      return '';
    }
  };

  const publishedCount = useMemo(() => {
    return programs.filter((p) => p.is_published).length;
  }, [programs]);

  const scrollToSection = (tabName) => {
    setActiveTab(tabName);
    setTimeout(() => {
      const el = document.getElementById('live-results-center');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-600 rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Loading live event results...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 max-w-md w-full text-center space-y-3 shadow-2xs">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Event Portal Unavailable</h2>
          <p className="text-xs text-slate-500">{error || 'This event could not be found or is not open for public viewing.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] text-slate-800 flex flex-col">
      
      {/* ========================================================================= */}
      {/* 1. TOP BRANDING HEADER (SCHOOL LOGO + EVENT NAME + EVENTLOO LOGO ONLY)    */}
      {/* ========================================================================= */}
      <header className="bg-white/95 backdrop-blur-md border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
          {/* Top Left: School Logo & Event Name */}
          <div className="flex items-center gap-3 min-w-0">
            {event.school_logo ? (
              <img
                src={event.school_logo}
                alt={event.school_name || 'School Logo'}
                className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain bg-slate-50 border border-slate-200/80 p-0.5 shrink-0 shadow-2xs"
              />
            ) : (
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold text-sm sm:text-base flex items-center justify-center shrink-0 shadow-2xs">
                {(event.school_name || 'E').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <span className="text-[10px] sm:text-[11px] font-semibold uppercase tracking-wider text-slate-400 block truncate leading-tight">
                {event.school_name || 'Campus Event'}
              </span>
              <h1 className="text-sm sm:text-base md:text-lg font-bold text-slate-900 truncate leading-snug">
                {event.title}
              </h1>
            </div>
          </div>

          {/* Right Side: Eventloo Brand Logo ONLY (Share & QR removed from header as requested) */}
          <a
            href="/"
            title="Powered by Eventloo"
            className="flex items-center hover:opacity-90 transition-opacity pl-0.5 shrink-0"
          >
            <img
              src="/eventloo-loop-logo.svg"
              alt="Eventloo"
              className="h-5 sm:h-6 w-auto object-contain"
            />
          </a>
        </div>
      </header>

      {/* ========================================================================= */}
      {/* 2. HERO LANDING SECTION (SKY/CLOUD AESTHETIC, BIG TITLE, PILL BUTTONS)    */}
      {/* ========================================================================= */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#c6e2ff] via-[#e5f1ff] to-[#f8fafc] pt-14 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6">
        {/* Atmospheric soft clouds / light diffusion */}
        <div className="absolute inset-0 pointer-events-none opacity-50">
          <div className="absolute -top-20 left-1/4 w-96 h-96 bg-white/70 rounded-full blur-3xl" />
          <div className="absolute top-1/3 -right-20 w-80 h-80 bg-white/60 rounded-full blur-2xl" />
          <div className="absolute -bottom-10 left-1/3 w-[500px] h-48 bg-white/80 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto text-center space-y-5">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-white/85 backdrop-blur-md border border-white/80 text-indigo-700 text-xs font-semibold shadow-xs">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Official Live Event Portal</span>
            <span className="text-slate-300">·</span>
            <span className="text-slate-600">{event.school_name || 'Campus Fest'}</span>
          </div>

          {/* Headline with Gold Trophy Motif */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 tracking-tight leading-[1.14]">
            {event.title} <span className="inline-block hover:scale-110 transition-transform">🏆</span>
          </h1>

          {/* Subtitle / Description */}
          <p className="text-sm sm:text-base text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
            {event.description ||
              `A grand grassroots gathering celebrating student talent, literary arts, and cultural competition connecting units across campus stages.`}
          </p>

          {/* Metadata Pills (College name, Date, Venue) */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-3 text-xs text-slate-700 font-medium pt-1">
            <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-3.5 py-1.5 rounded-full border border-white/70 shadow-2xs">
              <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="font-semibold text-slate-900">{event.school_name || 'Campus'}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-3.5 py-1.5 rounded-full border border-white/70 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span>{formatDate(event.start_date)} {event.end_date && event.end_date !== event.start_date ? `– ${formatDate(event.end_date)}` : ''}</span>
            </div>
            {event.venue && (
              <div className="flex items-center gap-1.5 bg-white/80 backdrop-blur-xs px-3.5 py-1.5 rounded-full border border-white/70 shadow-2xs">
                <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <span>{event.venue}</span>
              </div>
            )}
          </div>

          {/* Hero Action Buttons (Pill buttons matching Image 1) */}
          <div className="pt-3 flex flex-wrap items-center justify-center gap-3">
            {/* Primary Pill Button */}
            <button
              onClick={() => scrollToSection('results')}
              className="px-6 py-3 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-blue-500/25 hover:shadow-lg hover:shadow-blue-500/35 transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <span>Explore Results & Standings</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {/* Secondary Pill Button */}
            <button
              onClick={() => scrollToSection('schedule')}
              className="px-5 py-3 rounded-full bg-white/95 hover:bg-white text-slate-800 font-semibold text-xs sm:text-sm border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Clock className="w-4 h-4 text-indigo-600" />
              <span>Stage Schedule</span>
            </button>

            {/* Tertiary Pill Button */}
            <button
              onClick={() => scrollToSection('points')}
              className="px-5 py-3 rounded-full bg-white/95 hover:bg-white text-slate-800 font-semibold text-xs sm:text-sm border border-slate-200/80 shadow-xs hover:shadow-sm transition-all flex items-center gap-2 cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Award className="w-4 h-4 text-amber-500" />
              <span>Team Leaderboard</span>
            </button>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 3. IMPACT METRICS & ABOUT SECTION (OUR MISSION & ABOUT EVENTLOO VALUES)   */}
      {/* ========================================================================= */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
        {/* Centered Pill */}
        <div className="text-center">
          <span className="inline-block px-4 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold tracking-wide">
            Our Impact
          </span>
        </div>

        {/* Horizontal Stat Metrics Separated by Dots (Matches Image 2) */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 sm:gap-x-10 gap-y-3 text-center">
          <div className="text-slate-900 font-bold text-sm sm:text-lg">
            <span>{programs.length}+ Competitions</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 hidden sm:inline-block" />
          <div className="text-slate-900 font-bold text-sm sm:text-lg">
            <span>{teamStandings.length} Registered Teams</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 hidden sm:inline-block" />
          <div className="text-slate-900 font-bold text-sm sm:text-lg">
            <span>{stages.length || 'Campus'} Festival Stages</span>
          </div>
          <span className="w-1.5 h-1.5 rounded-full bg-slate-300 hidden sm:inline-block" />
          <div className="text-slate-900 font-bold text-sm sm:text-lg">
            <span>{publishedCount} Published Results</span>
          </div>
        </div>

        {/* Two-Column Grid: Our Mission vs About Eventloo (Matches Image 2) */}
        <div className="mt-14 sm:mt-16 grid grid-cols-1 md:grid-cols-2 gap-10 lg:gap-16 items-start">
          {/* Left Column: Our Mission */}
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Our mission
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed font-normal">
              {event.description ||
                `To discover, nurture, and elevate creative talent through a structured grassroots festival ecosystem that empowers students in literature, arts, media, culture, and leadership, providing opportunities for progression from campus stages to state and national platforms.`}
            </p>
            <div className="pt-2 flex flex-col gap-2 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Organized by <strong className="text-slate-800">{event.school_name || 'Organizing Institution'}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>Venue: <strong className="text-slate-800">{event.venue || 'Campus Main Ground'}</strong></span>
              </div>
            </div>
          </div>

          {/* Right Column: About Eventloo / Our Values */}
          <div className="space-y-4">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              Our values
            </h2>

            <div className="space-y-4 pt-1">
              {/* Value 1 */}
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Target className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Grassroots Literary & Arts Ecosystem
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    To build a modern digital fest ecosystem where every participant's voice and talent has the opportunity to grow from campus to global platforms.
                  </p>
                </div>
              </div>

              {/* Value 2 */}
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <BarChart3 className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Fair, Real-Time Live Scoring
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    To preserve transparency and intellectual excellence by empowering communities with verified multi-judge mark conversions and live points standings.
                  </p>
                </div>
              </div>

              {/* Value 3 */}
              <div className="flex items-start gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Rocket className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Instant Stage Scheduling & Verified Credentials
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                    To create a seamless fest operation with automated stage management, chest number allocations, and verified digital certificates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ========================================================================= */}
      {/* 4. LIVE RESULTS & STANDINGS CENTER                                        */}
      {/* ========================================================================= */}
      <main id="live-results-center" className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full space-y-6">
        
        {/* Section Header */}
        <div className="text-center space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Live Results & Timetable</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Festival Results & Leaderboard
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
            Browse verified program winners, live house points standings, and stage schedules below.
          </p>
        </div>

        {/* Modern Pill Switcher Tabs */}
        <div className="flex items-center justify-center">
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 shadow-2xs">
            <button
              onClick={() => setActiveTab('results')}
              className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'results'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Trophy className="w-3.5 h-3.5" />
              <span>Program Results</span>
            </button>

            <button
              onClick={() => setActiveTab('points')}
              className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'points'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Award className="w-3.5 h-3.5" />
              <span>Points Table</span>
            </button>

            <button
              onClick={() => setActiveTab('schedule')}
              className={`py-2 px-4 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 cursor-pointer ${
                activeTab === 'schedule'
                  ? 'bg-white text-indigo-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Schedule</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: RESULTS EXPLORER (CATEGORY -> PROGRAM -> 1st/2nd/3rd)              */}
        {/* ========================================================================= */}
        {activeTab === 'results' && (
          <div className="space-y-4">
            
            {/* Category Selector Pills */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3 sm:p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Step 1: Select Category
                </span>
                <span className="text-xs text-slate-400 font-normal">
                  {filteredPrograms.length} programs available
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => { setSelectedCategory('all'); setSelectedProgramId(null); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    selectedCategory === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  All Categories
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.code}
                    onClick={() => { setSelectedCategory(cat.code); setSelectedProgramId(null); }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      selectedCategory === cat.code
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Program Selection and Results View (Two Columns on Desktop) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              
              {/* Left Column: Programs List (5 cols) */}
              <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 p-3 sm:p-4 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Step 2: Choose Program
                  </span>
                </div>

                {/* Search Box */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search program..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white"
                  />
                </div>

                {/* Programs Scroll List */}
                <div className="max-h-[500px] overflow-y-auto space-y-1.5 pr-1">
                  {filteredPrograms.length > 0 ? (
                    filteredPrograms.map((p) => {
                      const isSelected = activeProgram?.id === p.id;
                      return (
                        <div
                          key={p.id}
                          onClick={() => setSelectedProgramId(p.id)}
                          className={`p-3 rounded-lg border transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50/50 shadow-2xs'
                              : 'border-slate-200/70 hover:border-slate-300 hover:bg-slate-50'
                          }`}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {p.category}
                              </span>
                              <span className="text-xs font-semibold text-slate-900 truncate">
                                {p.name}
                              </span>
                            </div>
                            <span className="text-[11px] text-slate-400 block mt-0.5">
                              {p.venue || (p.is_stage ? 'Stage Program' : 'Off-Stage')}
                            </span>
                          </div>

                          <div className="shrink-0 text-right">
                            {p.is_published ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Published
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                                Pending
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="py-8 text-center text-xs text-slate-400">
                      No programs match the selected category.
                    </div>
                  )}
                </div>
              </div>

              {/* Right Column: Selected Program Results Details (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {activeProgram ? (
                  <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
                    
                    {/* Program Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700">
                            {activeProgram.category_name || activeProgram.category}
                          </span>
                          <span className="text-[11px] text-slate-400 font-normal">
                            {activeProgram.venue ? `Venue: ${activeProgram.venue}` : ''}
                          </span>
                        </div>
                        <h3 className="text-base sm:text-lg font-bold text-slate-900">
                          {activeProgram.name}
                        </h3>
                      </div>

                      <div className="shrink-0">
                        {activeProgram.is_published ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                            Official Results Published
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Clock className="w-3.5 h-3.5 text-amber-600" />
                            Results Under Evaluation
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Published Winners Podium (1st, 2nd, 3rd) */}
                    {activeProgram.is_published ? (
                      activeProgram.results && activeProgram.results.length > 0 ? (
                        <div className="space-y-2.5">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block mb-1">
                            Winners & Rankings
                          </span>

                          {activeProgram.results.map((res, index) => {
                            const isFirst = res.position === 1;
                            const isSecond = res.position === 2;
                            const isThird = res.position === 3;

                            return (
                              <div
                                key={index}
                                className={`p-3.5 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                                  isFirst
                                    ? 'bg-amber-50/40 border-amber-200/80'
                                    : isSecond
                                    ? 'bg-slate-50 border-slate-200/80'
                                    : isThird
                                    ? 'bg-orange-50/30 border-orange-200/80'
                                    : 'bg-white border-slate-100'
                                }`}
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  {/* Position Badge */}
                                  <div
                                    className={`w-9 h-9 rounded-xl font-black text-sm flex items-center justify-center shrink-0 ${
                                      isFirst
                                        ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                        : isSecond
                                        ? 'bg-slate-200 text-slate-800'
                                        : isThird
                                        ? 'bg-orange-100 text-orange-800'
                                        : 'bg-slate-100 text-slate-600'
                                    }`}
                                  >
                                    {res.position ? `#${res.position}` : '-'}
                                  </div>

                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-bold text-slate-900 truncate">
                                        {res.student_name}
                                      </span>
                                      {res.chest_number && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 shrink-0">
                                          #{res.chest_number}
                                        </span>
                                      )}
                                    </div>
                                    <span className="text-xs text-slate-500 block truncate mt-0.5">
                                      {res.team_name}
                                    </span>
                                  </div>
                                </div>

                                {/* Grade & Points */}
                                <div className="text-right shrink-0 flex items-center gap-2">
                                  {res.grade && res.grade !== '-' && (
                                    <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                                      Grade {res.grade}
                                    </span>
                                  )}
                                  <span className="text-sm font-black text-slate-900 block">
                                    {res.points} pts
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-8 text-center text-xs text-slate-400">
                          Results published, but no participant rankings recorded yet.
                        </div>
                      )
                    ) : (
                      /* Not published yet notice */
                      <div className="py-12 px-6 rounded-xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50">
                        <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                        <h4 className="text-sm font-bold text-slate-800">
                          Results Are Being Finalized
                        </h4>
                        <p className="text-xs text-slate-500 max-w-sm mx-auto">
                          Marks and positions for this program are currently being verified by the judging committee and will appear here immediately upon publishing.
                        </p>
                      </div>
                    )}

                  </div>
                ) : (
                  <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center text-xs text-slate-400 shadow-2xs">
                    Select a program from the list to view its published results.
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: POINTS TABLE (LIVE TEAM STANDINGS)                                 */}
        {/* ========================================================================= */}
        {activeTab === 'points' && (
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Official Team Leaderboard</h3>
                <p className="text-xs text-slate-500">Live points calculated from verified and published program results.</p>
              </div>
              <span className="text-xs text-slate-400 font-medium">
                {teamStandings.length} Teams Competing
              </span>
            </div>

            {teamStandings.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      <th className="py-2.5 px-3">Rank</th>
                      <th className="py-2.5 px-3">Team / House</th>
                      <th className="py-2.5 px-3 text-center">1st</th>
                      <th className="py-2.5 px-3 text-center">2nd</th>
                      <th className="py-2.5 px-3 text-center">3rd</th>
                      <th className="py-2.5 px-3 text-right">Total Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {teamStandings.map((team, idx) => {
                      const rank = team.rank || idx + 1;
                      return (
                        <tr key={team.team_id || idx} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-3">
                            <span className={`w-6 h-6 rounded-lg text-xs font-bold inline-flex items-center justify-center ${
                              rank === 1 ? 'bg-amber-100 text-amber-800 border border-amber-300 font-black' :
                              rank === 2 ? 'bg-slate-200 text-slate-800' :
                              rank === 3 ? 'bg-orange-100 text-orange-800' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              #{rank}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <span className="font-bold text-slate-900 block">{team.team_name}</span>
                            <span className="text-[10px] text-slate-400">{team.programs_won} first-place victories</span>
                          </td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-700">{team.first_places || 0}</td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-700">{team.second_places || 0}</td>
                          <td className="py-3 px-3 text-center font-semibold text-slate-700">{team.third_places || 0}</td>
                          <td className="py-3 px-3 text-right">
                            <span className="text-sm font-black text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200/60 inline-block">
                              {team.total_points} pts
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-12 text-center text-xs text-slate-400">
                Points will calculate automatically once marks and results are published.
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SCHEDULE & TIMETABLE                                              */}
        {/* ========================================================================= */}
        {activeTab === 'schedule' && (
          <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3 border-b border-slate-100">
              <div>
                <h3 className="text-base font-bold text-slate-900">Event Timetable & Stage Schedule</h3>
                <p className="text-xs text-slate-500">Live order of events and stage allocations.</p>
              </div>

              {/* Stage Filter */}
              {stages.length > 0 && (
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  <button
                    onClick={() => setSelectedStageId('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                      selectedStageId === 'all'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    All Stages
                  </button>
                  {stages.map((stg) => (
                    <button
                      key={stg.id}
                      onClick={() => setSelectedStageId(stg.name)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                        selectedStageId === stg.name
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {stg.name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {event.is_schedule_published ? (
              schedulePrograms.length > 0 ? (
                <div className="space-y-2">
                  {schedulePrograms.map((prog) => (
                    <div
                      key={prog.id}
                      className="p-3 rounded-lg border border-slate-100 hover:bg-slate-50 transition-colors flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="text-center w-16 shrink-0 py-1 px-1.5 rounded bg-slate-100 text-slate-700">
                          <span className="font-bold block leading-tight text-[11px]">
                            {formatTime(prog.start_time) || 'TBD'}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">{prog.name}</span>
                          <span className="text-[11px] text-slate-400 block truncate">
                            {prog.category_name} · {prog.stage_name || prog.venue || 'Campus Venue'}
                          </span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        {prog.is_published ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Completed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Scheduled
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-slate-400">
                  No programs found for the selected stage.
                </div>
              )
            ) : (
              <div className="py-12 px-6 rounded-xl border border-dashed border-slate-200 text-center space-y-2 bg-slate-50/50">
                <Clock className="w-8 h-8 text-slate-300 mx-auto" />
                <h4 className="text-sm font-bold text-slate-800">
                  Schedule Not Published Yet
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  The event coordinators are organizing the stage timings. The schedule will be made live here shortly.
                </p>
              </div>
            )}
          </div>
        )}

      </main>

      {/* ========================================================================= */}
      {/* 4. MODAL: QR PASS FOR LIVE EVENT PORTAL                                  */}
      {/* ========================================================================= */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 p-6 max-w-sm w-full text-center space-y-4 shadow-xl">
            <div>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 block">
                Instant Mobile Scan
              </span>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Scan for Live Results
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Scan with your phone camera to view {event.title} live results and standings.
              </p>
            </div>

            {/* QR SVG */}
            <div className="w-44 h-44 mx-auto p-3 bg-white rounded-xl border border-slate-200 shadow-2xs flex items-center justify-center">
              {data?.qr_code_svg ? (
                <div
                  dangerouslySetInnerHTML={{ __html: data.qr_code_svg }}
                  className="w-full h-full flex items-center justify-center"
                />
              ) : (
                <div className="text-xs text-slate-400">Generating QR...</div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-2 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Link Copied' : 'Copy Page Link'}</span>
              </button>
              <button
                onClick={() => setShowQrModal(false)}
                className="py-2 px-4 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="py-8 px-4 text-xs text-slate-500 border-t border-slate-200/80 bg-white">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <img
              src="/eventloo-loop-logo.svg"
              alt="Eventloo"
              className="h-5 w-auto object-contain"
            />
            <span className="text-slate-300">·</span>
            <span className="text-slate-500">The Modern Festival & Arts Management OS</span>
          </div>

          <div className="flex items-center gap-4 text-xs font-semibold text-slate-600">
            <button
              onClick={() => setShowQrModal(true)}
              className="hover:text-indigo-600 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5" />
              <span>QR Mobile Pass</span>
            </button>
            <button
              onClick={handleCopy}
              className="hover:text-indigo-600 flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
              <span>{copied ? 'Link Copied!' : 'Share Event'}</span>
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};

export default PublicEventPortal;
