import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Users,
  Calendar,
  Trophy,
  Sparkles,
  Shield,
  GraduationCap,
  X,
  Settings,
  LogOut,
  ChevronUp
} from 'lucide-react';
import EventlooLogo from '../common/EventlooLogo';
import { schoolSettingsAPI, authAPI } from '../../services/api';

const resolveLogoUrl = (rawLogo) => {
  if (!rawLogo || typeof rawLogo !== 'string') return null;
  const trimmed = rawLogo.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  return `/media/${trimmed}`;
};

const TeamManagerSidebar = ({ isOpen = false, setIsOpen = () => { } }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const teamData = (() => {
    try {
      return JSON.parse(localStorage.getItem('team_data') || '{}');
    } catch {
      return {};
    }
  })();

  const schoolData = (() => {
    try {
      return JSON.parse(localStorage.getItem('school_data') || '{}');
    } catch {
      return {};
    }
  })();

  const [schoolLogo, setSchoolLogo] = useState(() => {
    const raw = schoolData?.school_logo || schoolData?.logo || localStorage.getItem('school_logo');
    return resolveLogoUrl(raw);
  });
  const [logoError, setLogoError] = useState(false);

  useEffect(() => {
    const raw = schoolData?.school_logo || schoolData?.logo || localStorage.getItem('school_logo');
    const resolved = resolveLogoUrl(raw);
    if (resolved) {
      setSchoolLogo(resolved);
      setLogoError(false);
    } else {
      schoolSettingsAPI.get()
        .then((res) => {
          const fetchedLogo = res.data?.school_logo;
          if (fetchedLogo) {
            const fullUrl = resolveLogoUrl(fetchedLogo);
            setSchoolLogo(fullUrl);
            setLogoError(false);
            try {
              const current = JSON.parse(localStorage.getItem('school_data') || '{}');
              current.school_logo = fetchedLogo;
              current.logo = fetchedLogo;
              localStorage.setItem('school_data', JSON.stringify(current));
              localStorage.setItem('school_logo', fetchedLogo);
            } catch (_) { }
          }
        })
        .catch(() => { });
    }

    const handleSchoolUpdated = (e) => {
      const newLogo = e?.detail?.school_logo || localStorage.getItem('school_logo');
      const resolvedNew = resolveLogoUrl(newLogo);
      if (resolvedNew) {
        setSchoolLogo(resolvedNew);
        setLogoError(false);
      }
    };

    window.addEventListener('eventloo_school_updated', handleSchoolUpdated);
    window.addEventListener('storage', handleSchoolUpdated);
    return () => {
      window.removeEventListener('eventloo_school_updated', handleSchoolUpdated);
      window.removeEventListener('storage', handleSchoolUpdated);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user_role');
      localStorage.removeItem('team_data');
      localStorage.removeItem('school_data');
      localStorage.removeItem('access_type');
      localStorage.removeItem('team_welcome_message');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const navigation = [
    { name: 'Dashboard', href: '/team-manager', icon: Home, exact: true },
    { name: 'My Students', href: '/team-manager/students', icon: Users },
    { name: 'Events', href: '/team-manager/events', icon: Calendar },
    { name: 'Points & Rankings', href: '/team-manager/points', icon: Trophy },
  ];

  const isActive = (href, exact = false) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const teamName = teamData.name || teamData.team_name || 'My Team';
  const teamInitial = teamName.charAt(0).toUpperCase() || 'T';

  return (
    <>
      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity lg:hidden z-40"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-slate-200/90 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 lg:z-30 flex flex-col ${isOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
      >
        {/* Logo area with mobile close button */}
        <div className="flex items-center justify-between h-20 px-6 border-b border-slate-100 shrink-0">
          <EventlooLogo variant="full" size="md" showSubtitle />
          <button
            onClick={() => setIsOpen(false)}
            className="lg:hidden p-2 -mr-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation links */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Team Workspace
          </div>
          {navigation.map((item) => {
            const active = isActive(item.href, item.exact);
            const Icon = item.icon;
            return (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={() => setIsOpen(false)}
                className={`flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${active
                    ? 'bg-indigo-50 text-indigo-700 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
              >
                <div className={`mr-2.5 p-0.5 rounded-md ${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>
                  <Icon className="h-4 w-4" strokeWidth={active ? 2.2 : 1.8} />
                </div>
                <span className="truncate">{item.name}</span>
                {active && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-600" />
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Bottom user profile & action section */}
        <div className="p-3 border-t border-slate-100 shrink-0 relative" ref={menuRef}>
          {/* Popover Menu with Settings & Logout */}
          {menuOpen && (
            <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl bg-white border border-slate-200/90 shadow-xl overflow-hidden p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-3 py-2 border-b border-slate-100 bg-slate-50/50">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Signed in as</p>
                <p className="text-xs font-semibold text-slate-900 truncate">{teamName}</p>
                <p className="text-[10px] text-indigo-600 font-medium truncate">
                  {teamData.team_username ? `@${teamData.team_username}` : 'Team Manager'} · {schoolData.code || 'Portal'}
                </p>
              </div>
              <div className="p-1 space-y-0.5">
                <button
                  onClick={() => {
                    setMenuOpen(false);
                    if (typeof setIsOpen === 'function') setIsOpen(false);
                    navigate('/team-manager');
                  }}
                  className="flex items-center w-full px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 rounded-lg transition-colors cursor-pointer"
                >
                  <Settings className="w-4 h-4 mr-2.5 text-slate-400" />
                  <span>Settings</span>
                </button>
                <button
                  onClick={handleLogout}
                  className="flex items-center w-full px-2.5 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4 mr-2.5 text-rose-500" />
                  <span>Logout</span>
                </button>
              </div>
            </div>
          )}

          {/* Profile trigger card */}
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className={`flex items-center space-x-3 w-full p-2 rounded-xl border transition-all text-left cursor-pointer ${
              menuOpen
                ? 'bg-indigo-50/70 border-indigo-200 shadow-xs'
                : 'bg-white border-slate-200/80 hover:bg-slate-50 hover:border-slate-300'
            }`}
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs overflow-hidden border border-slate-200/80 bg-white shrink-0">
              {schoolLogo && !logoError ? (
                <img
                  src={schoolLogo}
                  alt={schoolData?.name || 'School Logo'}
                  className="w-full h-full object-contain p-0.5 bg-white"
                  onError={() => setLogoError(true)}
                />
              ) : (
                <span>{teamInitial}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-slate-900 truncate">{teamName}</p>
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 ring-2 ring-emerald-100 shrink-0" title="Online" />
              </div>
              <p className="text-[10px] text-slate-400 font-medium truncate">
                {teamData.team_username ? `@${teamData.team_username}` : 'Team Leader'} · {schoolData.code || 'Portal'}
              </p>
            </div>
            <ChevronUp className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${menuOpen ? 'rotate-180 text-indigo-600' : ''}`} />
          </button>
        </div>
      </aside>
    </>
  );
};

export default TeamManagerSidebar;
