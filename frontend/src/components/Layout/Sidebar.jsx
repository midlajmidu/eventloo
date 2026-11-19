import React, { useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  Home,
  Calendar,
  Users,
  GraduationCap,
  Trophy,
  Settings,
  BarChart3,
  BookOpen,
  Sparkles,
  LogOut,
  ChevronUp
} from 'lucide-react';
import EventlooLogo from '../common/EventlooLogo';
import { authAPI, schoolSettingsAPI } from '../../services/api';

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
  const apiBase = import.meta.env.VITE_API_BASE_URL || '';
  const hostBase = apiBase.replace(/\/api\/?$/, '');
  return `${hostBase}/${trimmed.replace(/^\/+/, '')}`;
};

const Sidebar = ({ isOpen, setIsOpen, user }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const rawSchoolData = user?.school || (() => {
    try {
      return JSON.parse(localStorage.getItem('school_data') || '{}');
    } catch {
      return {};
    }
  })();

  const rawUser = user || (() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch {
      return {};
    }
  })();

  const [schoolLogo, setSchoolLogo] = useState(() => {
    const raw = rawSchoolData?.school_logo || rawSchoolData?.logo || localStorage.getItem('school_logo');
    return resolveLogoUrl(raw);
  });
  const [logoImgError, setLogoImgError] = useState(false);

  useEffect(() => {
    const raw = rawSchoolData?.school_logo || rawSchoolData?.logo || localStorage.getItem('school_logo');
    const resolved = resolveLogoUrl(raw);
    if (resolved) {
      setSchoolLogo(resolved);
      setLogoImgError(false);
    } else {
      schoolSettingsAPI.get()
        .then((res) => {
          const fetchedLogo = res.data?.school_logo;
          if (fetchedLogo) {
            const fullUrl = resolveLogoUrl(fetchedLogo);
            setSchoolLogo(fullUrl);
            setLogoImgError(false);
          }
        })
        .catch(() => {});
    }

    const handleSchoolUpdated = (e) => {
      const newLogo = e?.detail?.school_logo || localStorage.getItem('school_logo');
      const resolvedNew = resolveLogoUrl(newLogo);
      if (resolvedNew) {
        setSchoolLogo(resolvedNew);
        setLogoImgError(false);
      }
    };

    window.addEventListener('eventloo_school_updated', handleSchoolUpdated);
    window.addEventListener('storage', handleSchoolUpdated);
    return () => {
      window.removeEventListener('eventloo_school_updated', handleSchoolUpdated);
      window.removeEventListener('storage', handleSchoolUpdated);
    };
  }, [user]);

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

  const displayName = rawUser?.name || rawUser?.username || rawSchoolData?.name || 'School Admin';
  const displayRole = rawUser?.role === 'event_manager' ? 'Event Manager' : 'School Administrator';
  const avatarInitial = displayName.charAt(0).toUpperCase() || 'A';

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
    { name: 'Dashboard', href: '/admin/dashboard', icon: Home },
    { name: 'Events', href: '/admin/events', icon: Calendar },
    { name: 'Teams', href: '/admin/teams', icon: Users },
    { name: 'Students', href: '/admin/students', icon: GraduationCap },
    { name: 'Points', href: '/admin/points', icon: Trophy },
    { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'Documentation', href: '/admin/docs', icon: BookOpen },
    { name: 'Settings', href: '/admin/settings', icon: Settings },
  ];

  return (
    <>
      {/* Mobile sidebar overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-25 transition-opacity lg:hidden z-20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-30 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center h-20 px-6 border-b border-gray-200">
            <EventlooLogo variant="full" size="md" showSubtitle />
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-5 space-y-0.5 overflow-y-auto">
            <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Admin Workspace
            </div>
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-3 py-2 text-xs font-medium transition-all duration-150 rounded-lg ${isActive
                      ? 'bg-indigo-50 text-indigo-700 font-semibold'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  onClick={() => setIsOpen(false)}
                >
                  <Icon className={`h-4 w-4 mr-2.5 transition-colors duration-200 ${isActive ? 'text-indigo-600' : 'text-slate-400'
                    }`} />
                  <span>{item.name}</span>
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
                  <p className="text-xs font-semibold text-slate-900 truncate">{displayName}</p>
                  <p className="text-[10px] text-indigo-600 font-medium capitalize">{displayRole}</p>
                </div>
                <div className="p-1 space-y-0.5">
                  <button
                    onClick={() => {
                      setMenuOpen(false);
                      if (typeof setIsOpen === 'function') setIsOpen(false);
                      navigate('/admin/settings');
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
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-2xs overflow-hidden border border-slate-200/80 bg-white shrink-0">
                {schoolLogo && !logoImgError ? (
                  <img
                    src={schoolLogo}
                    alt="Logo"
                    className="w-full h-full object-contain p-0.5 bg-white"
                    onError={() => setLogoImgError(true)}
                  />
                ) : (
                  <span>{avatarInitial}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-900 truncate">{displayName}</p>
                <p className="text-[10px] text-slate-400 truncate capitalize">{displayRole}</p>
              </div>
              <ChevronUp className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${menuOpen ? 'rotate-180 text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar; 
