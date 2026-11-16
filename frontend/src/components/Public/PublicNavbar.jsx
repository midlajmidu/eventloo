import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Home, 
  Trophy, 
  BarChart2, 
  Calendar, 
  ShieldCheck, 
  Settings, 
  Menu, 
  X, 
  Sparkles,
  QrCode
} from 'lucide-react';
import EventlooLogo from '../common/EventlooLogo';

/**
 * PublicNavbar — Universal Illustrated Header for All Public Portal Routes
 * Inspired by the Enchanted Knowledge Festival art direction.
 */
const PublicNavbar = ({ eventId, eventData, onOpenScanner }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if admin is authenticated to show settings shortcut
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token') || localStorage.getItem('access_token');
    const role = localStorage.getItem('user_role');
    if (token && (role === 'admin' || role === 'super_admin' || !role)) {
      setIsAdmin(true);
    }
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 35) {
        setScrolled(true);
      } else {
        setScrolled(false);
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile drawer when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const navLinks = [
    {
      num: '01',
      name: 'Home',
      path: `/events/${eventId}/public`,
      exact: true,
      icon: Home,
    },
    {
      num: '02',
      name: 'Results',
      path: `/events/${eventId}/public/results`,
      icon: Trophy,
    },
    {
      num: '03',
      name: 'Points Table',
      path: `/events/${eventId}/public/points`,
      icon: BarChart2,
    },
    {
      num: '04',
      name: 'Schedule',
      path: `/events/${eventId}/public/schedule`,
      icon: Calendar,
    },
    {
      num: '05',
      name: 'Verify Badge',
      path: `/events/${eventId}/public/verify`,
      icon: ShieldCheck,
      isAction: true,
    },
  ];

  const isCurrentActive = (item) => {
    if (item.exact) {
      return (
        location.pathname === item.path ||
        location.pathname === `/public/events/${eventId}` ||
        location.pathname === `/events/${eventId}/public/`
      );
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'bg-[#090817]/90 backdrop-blur-md border-b border-amber-500/20 py-3 shadow-[0_12px_30px_rgba(0,0,0,0.65)]'
            : 'bg-gradient-to-b from-[#090817]/80 via-[#090817]/40 to-transparent py-4 sm:py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left Brand Identity */}
          <Link
            to={`/events/${eventId}/public`}
            className="group flex items-center space-x-3 text-white transition-opacity hover:opacity-90"
          >
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-500 to-indigo-600 p-[1.5px] shadow-[0_0_15px_rgba(245,158,11,0.4)]">
                <div className="w-full h-full bg-[#0F0D22] rounded-[7px] flex items-center justify-center">
                  <EventlooLogo size="sm" variant="white" showText={false} />
                </div>
              </div>
              <span className="font-editorial text-lg sm:text-xl font-bold tracking-tight text-white group-hover:text-amber-200 transition-colors">
                Eventloo
              </span>
            </div>

            <span className="hidden sm:inline-block text-amber-400/40 font-light">|</span>

            <span className="hidden md:inline-block font-cinzel text-[11px] uppercase tracking-[0.2em] text-amber-200/80">
              Official Festival Portal
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-1 sm:space-x-3">
            {navLinks.map((item) => {
              const active = isCurrentActive(item);
              return (
                <Link
                  key={item.num}
                  to={item.path}
                  className={`relative px-3.5 py-1.5 text-xs sm:text-[13px] font-medium tracking-wide transition-all duration-200 rounded-full flex items-center space-x-1.5 ${
                    active
                      ? 'text-amber-300 font-semibold'
                      : 'text-slate-200 hover:text-amber-200 hover:bg-white/5'
                  }`}
                >
                  <span>{item.name}</span>
                  {active && (
                    <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-gradient-to-r from-amber-400 via-yellow-200 to-amber-500 rounded-full shadow-[0_0_8px_#F59E0B]" />
                  )}
                </Link>
              );
            })}

            {/* Admin Settings Link Pill (If authorized) */}
            {isAdmin && (
              <Link
                to={`/events/${eventId}/settings`}
                className="ml-2 inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300 hover:text-amber-200 transition-colors shadow-sm"
              >
                <Settings className="w-3.5 h-3.5 animate-spin-slow" />
                <span>Settings</span>
              </Link>
            )}
          </nav>

          {/* Mobile Right Controls: Hamburger */}
          <div className="flex items-center space-x-2 lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="w-10 h-10 rounded-full bg-gradient-to-tr from-amber-500 to-indigo-600 p-[1.5px] shadow-[0_0_15px_rgba(245,158,11,0.35)] flex items-center justify-center active:scale-95 transition-transform"
              aria-label="Open navigation menu"
            >
              <div className="w-full h-full bg-[#120F2B] rounded-full flex items-center justify-center text-amber-200">
                <Menu className="w-5 h-5" />
              </div>
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Animated Slide-out Drawer (Inspired by Reference Menu Image 5) */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop Blur */}
          <div
            className="fixed inset-0 bg-black/70 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileMenuOpen(false)}
          />

          {/* Illustrated Menu Card */}
          <div className="relative w-full max-w-xs sm:max-w-sm h-full bg-gradient-to-b from-[#1E1B4B] via-[#2E1065] to-[#0F172A] border-l border-amber-500/30 p-6 flex flex-col justify-between shadow-2xl z-10 overflow-y-auto">
            {/* Top Close Button & Title */}
            <div>
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-amber-400/20">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-twinkle" />
                  <span className="font-cinzel text-xs uppercase tracking-widest text-amber-300 font-bold">
                    Festival Directory
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-8 h-8 rounded-full bg-amber-500 text-[#1E1B4B] flex items-center justify-center font-bold shadow-[0_0_12px_#F59E0B] hover:scale-105 active:scale-95 transition-transform"
                  aria-label="Close menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Numbered Menu Links */}
              <div className="space-y-4">
                {navLinks.map((item) => {
                  const active = isCurrentActive(item);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.num}
                      to={item.path}
                      onClick={() => setMobileMenuOpen(false)}
                      className={`group flex items-center space-x-4 p-3 rounded-xl transition-all duration-200 ${
                        active
                          ? 'bg-amber-400/15 border border-amber-400/40 text-amber-200 shadow-[0_0_15px_rgba(245,158,11,0.2)]'
                          : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <span className="font-mono text-xs font-bold text-amber-400/70 group-hover:text-amber-300">
                        {item.num}
                      </span>
                      <Icon className={`w-4 h-4 ${active ? 'text-amber-300' : 'text-slate-400 group-hover:text-amber-300'}`} />
                      <span className="font-cinzel text-sm uppercase tracking-wider font-bold">
                        {item.name}
                      </span>
                    </Link>
                  );
                })}

                {/* Scan Button Action in Menu */}
                {onOpenScanner && (
                  <button
                    type="button"
                    onClick={() => {
                      setMobileMenuOpen(false);
                      onOpenScanner();
                    }}
                    className="w-full mt-2 flex items-center space-x-4 p-3 rounded-xl bg-gradient-to-r from-amber-500/20 to-violet-500/20 border border-amber-400/30 text-amber-200 text-left transition-all hover:scale-[1.02]"
                  >
                    <span className="font-mono text-xs font-bold text-amber-400/70">✦</span>
                    <QrCode className="w-4 h-4 text-amber-300" />
                    <span className="font-cinzel text-sm uppercase tracking-wider font-bold">
                      Open Camera Scanner
                    </span>
                  </button>
                )}

                {/* Admin Settings Shortcut */}
                {isAdmin && (
                  <Link
                    to={`/events/${eventId}/settings`}
                    onClick={() => setMobileMenuOpen(false)}
                    className="flex items-center space-x-4 p-3 rounded-xl text-amber-300 hover:bg-amber-500/10 border border-amber-500/20 transition-all"
                  >
                    <span className="font-mono text-xs font-bold text-amber-400/70">⚙</span>
                    <Settings className="w-4 h-4 text-amber-300" />
                    <span className="font-cinzel text-sm uppercase tracking-wider font-bold">
                      Event Settings
                    </span>
                  </Link>
                )}
              </div>
            </div>

            {/* Bottom Footer in Menu Drawer */}
            <div className="pt-6 border-t border-amber-400/20 text-center">
              <p className="font-editorial text-xs text-amber-200/70 italic">
                {eventData?.name || 'Enchanted Knowledge Festival'}
              </p>
              <p className="text-[10px] text-slate-400 mt-1">
                Powered by Eventloo Platform
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default PublicNavbar;

