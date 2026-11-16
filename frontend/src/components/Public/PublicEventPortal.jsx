import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Calendar,
  MapPin,
  Sparkles,
  ArrowRight,
  QrCode,
  Share2,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { publicEventAPI } from '../../services/api';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import BadgeScannerModal from './BadgeScannerModal';
import {
  TwinklingStar,
  ShootingStar,
  PalaceMoonSilhouette,
  TravellerHeroArtwork,
  FloatingRibbon,
  AntiqueLantern,
  BooksFeatherInk,
  IslamicArchway,
  OrnateArchPlaque,
  StatCandidatesArt,
  StatInstitutionsArt,
  StatProgramsArt,
  StatAstrolabeArt,
  AntiqueHourglass,
  ExploreTrophyArt,
  ExploreFlagArt,
  ExploreCalendarArt,
  ExploreBadgeArt
} from './PublicArtwork';
import gsap from 'gsap';

const PublicEventPortal = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventData, setEventData] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // Parallax Scroll Tracking
  const [scrollY, setScrollY] = useState(0);

  // Countdown timer state
  const [timeLeft, setTimeLeft] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    isExpired: false
  });

  // Hero refs for GSAP animation
  const heroRef = useRef(null);
  const moonRef = useRef(null);
  const travellerRef = useRef(null);
  const titleRef = useRef(null);
  const parchmentRef = useRef(null);

  useEffect(() => {
    fetchPortalData();
  }, [eventId]);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await publicEventAPI.getPublicEventPortal(eventId);
      setEventData(res.data);
    } catch (err) {
      console.error('Error fetching public event portal:', err);
      if (err.response?.status === 403) {
        setError('This event public portal is currently private or disabled by the administrators.');
      } else {
        setError('Unable to load event details. Please verify the URL or try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  // Scroll listener for smooth 2.5D parallax
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // GSAP Entrance Animations once data is loaded
  useEffect(() => {
    if (!loading && eventData) {
      const ctx = gsap.context(() => {
        gsap.fromTo(
          '.gsap-fade-in',
          { opacity: 0, y: 30 },
          { opacity: 1, y: 0, duration: 1.1, stagger: 0.15, ease: 'power2.out' }
        );

        gsap.fromTo(
          '.gsap-title-reveal',
          { opacity: 0, scale: 0.9, y: 20 },
          { opacity: 1, scale: 1, y: 0, duration: 1.3, ease: 'back.out(1.4)', delay: 0.2 }
        );

        gsap.fromTo(
          '.gsap-parchment-reveal',
          { opacity: 0, y: 40 },
          { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out', delay: 0.4 }
        );
      });

      return () => ctx.revert();
    }
  }, [loading, eventData]);

  // Countdown Calculation
  useEffect(() => {
    if (!eventData?.start_date) return;

    const calculateTimeLeft = () => {
      const targetTime = new Date(eventData.start_date).getTime();
      const now = new Date().getTime();
      const difference = targetTime - now;

      if (difference <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ days, hours, minutes, seconds, isExpired: false });
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [eventData?.start_date]);

  // Formatted date string
  const formattedDateRange = useMemo(() => {
    if (!eventData?.start_date) return 'Festival Dates Upcoming';
    try {
      const start = new Date(eventData.start_date);
      const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      if (eventData.end_date) {
        const end = new Date(eventData.end_date);
        const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        return `${startStr} – ${endStr}`;
      }
      return `${startStr}, ${start.getFullYear()}`;
    } catch {
      return eventData.start_date;
    }
  }, [eventData?.start_date, eventData?.end_date]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2200);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090817] flex flex-col items-center justify-center text-center p-6 space-y-6">
        <div className="relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 p-[2px] animate-pulse">
            <div className="w-full h-full bg-[#120F2B] rounded-[14px] flex items-center justify-center">
              <RefreshCw className="w-7 h-7 text-amber-400 animate-spin" />
            </div>
          </div>
          <Sparkles className="absolute -top-2 -right-2 w-5 h-5 text-amber-300 animate-twinkle" />
        </div>
        <p className="font-cinzel text-sm uppercase tracking-widest text-amber-300">
          Entering the Enchanted Festival...
        </p>
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="min-h-screen bg-[#090817] flex flex-col items-center justify-center text-center p-6">
        <div className="max-w-md w-full bg-[#15122F] border border-amber-500/30 rounded-3xl p-8 shadow-2xl space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="font-cinzel text-lg font-bold text-white uppercase tracking-wider">
            Portal Unavailable
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed font-sans">
            {error || 'The requested event portal could not be found.'}
          </p>
          <button
            type="button"
            onClick={fetchPortalData}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-[#120F2B] hover:brightness-110 transition-all shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  const themeTitle = eventData?.public_theme_title || 'Paths of Knowledge';
  const eventTitle = eventData?.title || eventData?.name || 'GRAVITAS';
  const aboutText =
    eventData?.public_about_text ||
    eventData?.description ||
    `${eventTitle} is a multi-program festival that brings together curious minds, creative talents, and inspired teams to learn, compete, and showcase excellence in a spirit of knowledge, faith, and innovation.`;

  // Dynamic statistics
  const stats = [
    {
      id: 'candidates',
      value: eventData?.stats?.total_candidates ? `${eventData.stats.total_candidates}+` : '5k+',
      label: 'Candidates',
      ArtComponent: StatCandidatesArt
    },
    {
      id: 'institutions',
      value: eventData?.stats?.total_teams ? `${eventData.stats.total_teams}+` : '40+',
      label: 'Institutions',
      ArtComponent: StatInstitutionsArt
    },
    {
      id: 'programs',
      value: eventData?.stats?.total_programs ? `${eventData.stats.total_programs}+` : '520+',
      label: 'Programs',
      ArtComponent: StatProgramsArt
    },
    {
      id: 'states',
      value: eventData?.stats?.total_stages ? `${eventData.stats.total_stages}+` : '20+',
      label: 'Stages / States',
      ArtComponent: StatAstrolabeArt
    }
  ];

  return (
    <div className="min-h-screen bg-[#090817] text-white selection:bg-amber-500 selection:text-slate-950 overflow-x-hidden">
      {/* 1. Global Navigation Bar */}
      <PublicNavbar
        eventId={eventId}
        eventData={eventData}
        onOpenScanner={() => setIsScannerOpen(true)}
      />

      {/* 2. SCENE 01 — THE ENCHANTED OPENING (Hero Section) */}
      <section
        ref={heroRef}
        className="relative min-h-[92vh] sm:min-h-screen flex flex-col justify-between pt-24 pb-12 sm:pt-28 sm:pb-16 overflow-hidden bg-gradient-to-b from-[#080718] via-[#161233] to-[#241344]"
      >
        {/* Background Twinkling Stars */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <TwinklingStar className="top-[12%] left-[8%]" size={18} delay="0.2s" />
          <TwinklingStar className="top-[22%] left-[45%]" size={14} delay="1.1s" />
          <TwinklingStar className="top-[15%] right-[22%]" size={20} delay="0.7s" />
          <TwinklingStar className="top-[35%] right-[8%]" size={12} delay="1.8s" />
          <TwinklingStar className="top-[45%] left-[20%]" size={16} delay="2.4s" />
          <TwinklingStar className="top-[60%] right-[35%]" size={14} delay="0.5s" />
          <ShootingStar className="top-[18%] left-[28%]" />
        </div>

        {/* Parallax Layer 1: Palace & Moon in the Upper-Right */}
        <div
          ref={moonRef}
          className="absolute top-16 right-[-20px] sm:right-6 lg:right-16 w-[320px] sm:w-[460px] lg:w-[600px] pointer-events-none transition-transform duration-100 ease-out z-10"
          style={{ transform: `translateY(${scrollY * 0.18}px)` }}
        >
          <PalaceMoonSilhouette className="opacity-95" />
        </div>

        {/* Parallax Layer 2: Floating Silk Ribbon across the sky */}
        <div
          className="absolute top-12 left-4 sm:left-16 w-[280px] sm:w-[420px] lg:w-[500px] pointer-events-none z-10"
          style={{ transform: `translateY(${scrollY * -0.08}px)` }}
        >
          <FloatingRibbon className="opacity-90" />
        </div>

        {/* Central Content Area: Animated Theme Typography */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-20 w-full my-auto text-center sm:text-left">
          <div className="max-w-2xl space-y-4 pt-6 sm:pt-0">
            {/* Sparkle Tag */}
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-400/10 border border-amber-400/30 text-amber-300 text-[11px] font-cinzel uppercase tracking-[0.2em] gsap-fade-in shadow-[0_0_15px_rgba(245,158,11,0.2)]">
              <Sparkles className="w-3.5 h-3.5 animate-twinkle text-amber-300" />
              <span>{eventData?.school_name || 'Enchanted Knowledge Festival'}</span>
            </div>

            {/* Main Handwritten Theme Typography */}
            <div className="gsap-title-reveal pt-2 pb-1">
              <h1 className="font-brush text-5xl sm:text-7xl lg:text-8xl tracking-wide bg-gradient-to-r from-[#FFFBEB] via-[#FDE68A] to-[#F59E0B] bg-clip-text text-transparent drop-shadow-[0_4px_24px_rgba(245,158,11,0.45)] leading-tight">
                {themeTitle}
              </h1>
            </div>

            {/* Small Supporting Tagline */}
            <p className="font-cinzel text-xs sm:text-sm uppercase tracking-[0.35em] text-amber-200/90 font-semibold gsap-fade-in">
              EXPLORE &middot; CREATE &middot; COMPETE
            </p>
          </div>
        </div>

        {/* Parallax Layer 3: Foreground Traveller with Book of Knowledge (Bottom Left) */}
        <div
          ref={travellerRef}
          className="relative sm:absolute bottom-[-15px] left-2 sm:left-8 lg:left-16 w-[200px] sm:w-[280px] lg:w-[340px] pointer-events-none z-20 mx-auto sm:mx-0 transition-transform duration-100 ease-out"
          style={{ transform: `translateY(${scrollY * -0.12}px)` }}
        >
          <TravellerHeroArtwork />
        </div>

        {/* Seamless Landscape Bottom Dunes Wave Transition */}
        <div className="w-full h-16 bg-gradient-to-b from-transparent to-[#FDFBF7] absolute bottom-0 left-0 right-0 pointer-events-none z-20" />
      </section>

      {/* 3. SCENE 02 — EVENT IDENTITY: GRAVITAS (Parchment Panel) */}
      <section
        ref={parchmentRef}
        className="relative bg-[#FDFBF7] text-[#1E1B4B] py-16 sm:py-24 px-4 sm:px-6 lg:px-8 overflow-hidden z-30 shadow-[0_-15px_40px_rgba(0,0,0,0.25)] border-t-2 border-amber-300/60"
      >
        {/* Subtle Decorative Paper Texture Overlays */}
        <div className="absolute inset-0 opacity-[0.035] bg-[radial-gradient(#1E1B4B_1px,transparent_1px)] [background-size:16px_16px] pointer-events-none" />

        <div className="max-w-6xl mx-auto relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            {/* Left Flank: Antique Books, Scrolls, Feather & Ink */}
            <div className="lg:col-span-3 flex justify-center order-2 lg:order-1">
              <div className="w-56 sm:w-64 lg:w-full max-w-[280px] transform hover:scale-105 transition-transform duration-300">
                <BooksFeatherInk />
              </div>
            </div>

            {/* Central Event Identity Content */}
            <div className="lg:col-span-6 text-center space-y-4 order-1 lg:order-2 gsap-parchment-reveal">
              {/* Top Ornate Header Label */}
              <div className="flex items-center justify-center space-x-3 text-amber-800">
                <span className="w-8 sm:w-12 h-[1px] bg-gradient-to-r from-transparent to-amber-600" />
                <span className="font-cinzel text-xs sm:text-sm uppercase tracking-[0.25em] font-bold text-amber-900">
                  The Annual Festival
                </span>
                <span className="w-8 sm:w-12 h-[1px] bg-gradient-to-l from-transparent to-amber-600" />
              </div>

              {/* Massive Editorial Serif Event Title */}
              <h2 className="font-cinzel-dec text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-[#2E1065] drop-shadow-sm">
                {eventTitle}
              </h2>

              {/* Event Metadata: Dates & Venue */}
              <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 pt-2 text-xs sm:text-sm font-medium text-amber-950/80">
                <div className="flex items-center space-x-2 bg-amber-100/70 px-3.5 py-1.5 rounded-full border border-amber-300/60 shadow-xs">
                  <Calendar className="w-4 h-4 text-amber-800" />
                  <span>{formattedDateRange}</span>
                </div>

                {eventData?.venue && (
                  <div className="flex items-center space-x-2 bg-amber-100/70 px-3.5 py-1.5 rounded-full border border-amber-300/60 shadow-xs">
                    <MapPin className="w-4 h-4 text-amber-800" />
                    <span>{eventData.venue}</span>
                  </div>
                )}
              </div>

              {/* Share & Copy Link Shortcut */}
              <div className="pt-2 flex items-center justify-center space-x-3">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex items-center space-x-1.5 text-xs font-semibold text-amber-900 hover:text-amber-700 bg-amber-50 hover:bg-amber-100/80 px-3 py-1 rounded-full border border-amber-200 transition-colors"
                >
                  {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedLink ? 'Portal Link Copied!' : 'Share Festival Portal'}</span>
                </button>
              </div>
            </div>

            {/* Right Flank: Glowing Antique Moorish Lantern */}
            <div className="lg:col-span-3 flex justify-center order-3">
              <div className="w-28 sm:w-36 lg:w-44 transform hover:scale-105 transition-transform duration-300">
                <AntiqueLantern />
              </div>
            </div>

          </div>
        </div>

        {/* Bottom Parchment Curve Cut Transition */}
        <div className="w-full h-12 bg-gradient-to-b from-transparent to-[#16113A] absolute bottom-0 left-0 right-0 pointer-events-none" />
      </section>

      {/* 4. SCENE 03 — ABOUT THE EVENT: THE STORY OF KNOWLEDGE */}
      <section className="relative bg-gradient-to-b from-[#16113A] via-[#241344] to-[#16113A] py-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Background Islamic Cusped Archways */}
        <div className="absolute inset-0 flex justify-between pointer-events-none overflow-hidden">
          <IslamicArchway className="w-48 sm:w-64 -left-12 -top-10" />
          <IslamicArchway className="w-48 sm:w-64 -right-12 -top-10 transform scale-x-[-1]" />
        </div>

        <div className="max-w-3xl mx-auto text-center relative z-10 space-y-6">
          {/* Section Eyebrow */}
          <div className="flex items-center justify-center space-x-3">
            <span className="w-8 h-[1px] bg-amber-400/40" />
            <span className="font-cinzel text-xs uppercase tracking-[0.25em] text-amber-300 font-bold">
              ✦ About The Event ✦
            </span>
            <span className="w-8 h-[1px] bg-amber-400/40" />
          </div>

          {/* Editorial Serif Story Text */}
          <p className="font-editorial text-lg sm:text-2xl text-amber-100/90 leading-relaxed sm:leading-loose tracking-wide font-normal drop-shadow-sm px-4">
            &ldquo;{aboutText}&rdquo;
          </p>

          <div className="pt-2">
            <span className="font-brush text-2xl sm:text-3xl text-amber-300">
              — {eventData?.school_name || 'Eventloo'}
            </span>
          </div>
        </div>
      </section>

      {/* 5. SCENE 04 — FESTIVAL AT A GLANCE: EVENT STATISTICS */}
      <section className="relative bg-[#16113A] py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-10">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2 text-amber-400">
              <span className="font-cinzel text-xs uppercase tracking-[0.25em] font-bold">
                ✦ Festival At A Glance ✦
              </span>
            </div>
            <h3 className="font-cinzel text-2xl sm:text-3xl font-bold text-white tracking-wide">
              Celebration of Skill & Knowledge
            </h3>
          </div>

          {/* 4 Ornate Mihrab Arch Plaques */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {stats.map((stat) => {
              const Art = stat.ArtComponent;
              return (
                <OrnateArchPlaque key={stat.id} className="h-64 sm:h-72">
                  {/* Plaque Artwork Illustration */}
                  <div className="pt-2">
                    <Art size={58} />
                  </div>

                  {/* Number & Label */}
                  <div className="text-center space-y-1 pb-4">
                    <span className="block font-editorial text-3xl sm:text-4xl font-bold text-[#2E1065] tracking-tight">
                      {stat.value}
                    </span>
                    <span className="block font-cinzel text-xs uppercase tracking-widest font-bold text-amber-900/80">
                      {stat.label}
                    </span>
                  </div>
                </OrnateArchPlaque>
              );
            })}
          </div>
        </div>
      </section>

      {/* 6. SCENE 05 — THE FESTIVAL COUNTDOWN (Hourglass & Purple Cartouches) */}
      <section className="relative bg-gradient-to-b from-[#16113A] via-[#201037] to-[#130E29] py-20 px-4 sm:px-6 lg:px-8 border-y border-amber-500/20">
        <div className="max-w-5xl mx-auto space-y-10">
          {/* Header */}
          <div className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-3 text-amber-400">
              <span className="w-8 h-[1px] bg-amber-400/40" />
              <span className="font-cinzel text-xs uppercase tracking-[0.25em] font-bold">
                The Festival Begins In
              </span>
              <span className="w-8 h-[1px] bg-amber-400/40" />
            </div>
          </div>

          {/* Hourglass & Countdown Row */}
          <div className="flex flex-col md:flex-row items-center justify-center gap-8 lg:gap-14">
            {/* Antique Hourglass on the Left */}
            <div className="w-28 sm:w-36 shrink-0 transform hover:rotate-2 transition-transform duration-500">
              <AntiqueHourglass />
            </div>

            {/* 4 Royal Purple / Violet Ornate Cartouches with Gold Trim */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-5 w-full max-w-xl">
              {[
                { label: 'Days', value: timeLeft.days },
                { label: 'Hours', value: timeLeft.hours },
                { label: 'Minutes', value: timeLeft.minutes },
                { label: 'Seconds', value: timeLeft.seconds }
              ].map((item, idx) => (
                <div
                  key={item.label}
                  className="relative group p-[2px] rounded-2xl bg-gradient-to-b from-amber-400/60 via-amber-600/30 to-amber-700/60 shadow-[0_8px_25px_rgba(0,0,0,0.5)]"
                >
                  <div className="w-full h-full bg-gradient-to-b from-[#2E1065] to-[#170C36] rounded-[14px] p-4 sm:p-5 text-center flex flex-col items-center justify-center space-y-1 border border-amber-300/30 group-hover:border-amber-300/60 transition-colors">
                    <span className="font-cinzel text-3xl sm:text-4xl font-bold text-amber-300 tracking-tight drop-shadow-[0_2px_10px_rgba(245,158,11,0.35)]">
                      {String(item.value).padStart(2, '0')}
                    </span>
                    <span className="font-cinzel text-[10px] sm:text-[11px] uppercase tracking-widest text-amber-200/80 font-bold">
                      {item.label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 7. SCENE 06 — EXPLORE THE EVENT: 4 DEDICATED DESTINATION CARDS */}
      <section className="relative bg-[#130E29] py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto space-y-12">
          {/* Header */}
          <div className="text-center space-y-3">
            <div className="flex items-center justify-center space-x-3 text-amber-400">
              <span className="w-8 h-[1px] bg-amber-400/40" />
              <span className="font-cinzel text-xs uppercase tracking-[0.25em] font-bold">
                Explore The Event
              </span>
              <span className="w-8 h-[1px] bg-amber-400/40" />
            </div>
            <h3 className="font-cinzel text-2xl sm:text-4xl font-bold text-white tracking-wide">
              Dedicated Festival Portals
            </h3>
            <p className="text-xs sm:text-sm text-slate-300 max-w-lg mx-auto font-sans">
              Each portal is a dedicated independent experience for real-time scores, standings, schedules, and verified badges.
            </p>
          </div>

          {/* 4 Illustrated Destination Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Card 1: Live Results */}
            <Link
              to={`/events/${eventId}/public/results`}
              className="group relative rounded-3xl bg-gradient-to-b from-[#FFFDF7] via-[#FFF9ED] to-[#FEF3C7] p-6 text-[#1E1B4B] flex flex-col justify-between border-2 border-amber-300/70 shadow-[0_15px_35px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(245,158,11,0.25)]"
            >
              <div>
                <div className="w-full flex justify-center py-3 transform group-hover:scale-105 transition-transform duration-300">
                  <ExploreTrophyArt size={88} />
                </div>
                <h4 className="font-cinzel text-lg font-bold text-[#2E1065] text-center pt-2">
                  Live Results
                </h4>
                <p className="text-xs text-amber-950/80 text-center pt-2 leading-relaxed font-sans">
                  Track program results, winners, and grades in real time.
                </p>
              </div>

              <div className="pt-6 flex justify-center">
                <span className="w-10 h-10 rounded-full bg-[#2E1065] text-amber-300 flex items-center justify-center shadow-md group-hover:bg-[#431407] group-hover:scale-110 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 2: Team Points */}
            <Link
              to={`/events/${eventId}/public/points`}
              className="group relative rounded-3xl bg-gradient-to-b from-[#FFFDF7] via-[#FFF9ED] to-[#FEF3C7] p-6 text-[#1E1B4B] flex flex-col justify-between border-2 border-amber-300/70 shadow-[0_15px_35px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(245,158,11,0.25)]"
            >
              <div>
                <div className="w-full flex justify-center py-3 transform group-hover:scale-105 transition-transform duration-300">
                  <ExploreFlagArt size={88} />
                </div>
                <h4 className="font-cinzel text-lg font-bold text-[#2E1065] text-center pt-2">
                  Team Points
                </h4>
                <p className="text-xs text-amber-950/80 text-center pt-2 leading-relaxed font-sans">
                  Follow your team's overall championship performance and standings.
                </p>
              </div>

              <div className="pt-6 flex justify-center">
                <span className="w-10 h-10 rounded-full bg-[#2E1065] text-amber-300 flex items-center justify-center shadow-md group-hover:bg-[#431407] group-hover:scale-110 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 3: Event Schedule */}
            <Link
              to={`/events/${eventId}/public/schedule`}
              className="group relative rounded-3xl bg-gradient-to-b from-[#FFFDF7] via-[#FFF9ED] to-[#FEF3C7] p-6 text-[#1E1B4B] flex flex-col justify-between border-2 border-amber-300/70 shadow-[0_15px_35px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(245,158,11,0.25)]"
            >
              <div>
                <div className="w-full flex justify-center py-3 transform group-hover:scale-105 transition-transform duration-300">
                  <ExploreCalendarArt size={88} />
                </div>
                <h4 className="font-cinzel text-lg font-bold text-[#2E1065] text-center pt-2">
                  Event Schedule
                </h4>
                <p className="text-xs text-amber-950/80 text-center pt-2 leading-relaxed font-sans">
                  Check program timings, stages, venues, and live schedule updates.
                </p>
              </div>

              <div className="pt-6 flex justify-center">
                <span className="w-10 h-10 rounded-full bg-[#2E1065] text-amber-300 flex items-center justify-center shadow-md group-hover:bg-[#431407] group-hover:scale-110 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

            {/* Card 4: Verify Candidate */}
            <Link
              to={`/events/${eventId}/public/verify`}
              className="group relative rounded-3xl bg-gradient-to-b from-[#FFFDF7] via-[#FFF9ED] to-[#FEF3C7] p-6 text-[#1E1B4B] flex flex-col justify-between border-2 border-amber-300/70 shadow-[0_15px_35px_rgba(0,0,0,0.4)] transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_45px_rgba(245,158,11,0.25)]"
            >
              <div>
                <div className="w-full flex justify-center py-3 transform group-hover:scale-105 transition-transform duration-300">
                  <ExploreBadgeArt size={88} />
                </div>
                <h4 className="font-cinzel text-lg font-bold text-[#2E1065] text-center pt-2">
                  Verify Candidate
                </h4>
                <p className="text-xs text-amber-950/80 text-center pt-2 leading-relaxed font-sans">
                  Scan QR code or enter candidate ID to inspect digital participant badges.
                </p>
              </div>

              <div className="pt-6 flex justify-center">
                <span className="w-10 h-10 rounded-full bg-[#2E1065] text-amber-300 flex items-center justify-center shadow-md group-hover:bg-[#431407] group-hover:scale-110 transition-all">
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>

          </div>
        </div>
      </section>

      {/* 8. GLOBAL FOOTER */}
      <PublicFooter event={eventData} eventId={eventId} />

      {/* 9. Interactive Live Camera QR Scanner Modal */}
      {isScannerOpen && (
        <BadgeScannerModal
          eventId={eventId}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
};

export default PublicEventPortal;
