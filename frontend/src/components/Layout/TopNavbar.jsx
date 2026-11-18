import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import EventlooLogo from '../common/EventlooLogo';
import {
  Menu,
  Search,
  User,
  Settings,
  LogOut,
  ChevronDown,
  Plus,
  Calendar,
  Users,
  Trophy,
  Award,
  ClipboardList,
  Shield,
  FileText,
  Check,
  X,
  ExternalLink,
  Sparkles,
  Filter,
  Clock,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  UserPlus,
  GraduationCap,
  Upload,
  Radio,
} from 'lucide-react';
import { authAPI, schoolSettingsAPI } from '../../services/api';

const resolveLogoUrl = (rawLogo) => {
  if (!rawLogo || typeof rawLogo !== 'string') return null;
  const trimmed = rawLogo.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:')
  ) {
    return trimmed;
  }
  if (trimmed.startsWith('/')) {
    return trimmed;
  }
  return `/media/${trimmed}`;
};

const QUICK_ADD_ACTIONS = [
  {
    id: 'add-event',
    title: 'Create Event',
    description: 'Set up an arts fest, sports day or cultural meet',
    category: 'entities',
    tag: 'Events',
    path: '/admin/events?action=create',
    icon: Calendar,
    color: 'bg-purple-50 text-purple-600 border-purple-200 group-hover:bg-purple-600 group-hover:text-white',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  {
    id: 'add-student',
    title: 'Enroll Student',
    description: 'Register student participant with class & category',
    category: 'entities',
    tag: 'Students',
    path: '/admin/students?action=create',
    icon: GraduationCap,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'add-team',
    title: 'Register Team',
    description: 'Create school house, squad or sub-team',
    category: 'entities',
    tag: 'Teams',
    path: '/admin/teams?action=create',
    icon: Users,
    color: 'bg-blue-50 text-blue-600 border-blue-200 group-hover:bg-blue-600 group-hover:text-white',
    badgeColor: 'bg-blue-100 text-blue-700',
  },
  {
    id: 'add-program',
    title: 'New Program / Stage',
    description: 'Add stage or off-stage competition item',
    category: 'entities',
    tag: 'Programs',
    path: '/admin/events',
    icon: Trophy,
    color: 'bg-amber-50 text-amber-600 border-amber-200 group-hover:bg-amber-600 group-hover:text-white',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
  {
    id: 'add-user',
    title: 'Add Staff User',
    description: 'Provision event manager or judge account',
    category: 'operations',
    tag: 'Staff',
    path: '/admin/users?action=create',
    icon: Shield,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white',
    badgeColor: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'enter-scores',
    title: 'Score & Mark Entry',
    description: 'Tabulate judge marks, rankings & point tables',
    category: 'operations',
    tag: 'Scoring',
    path: '/admin/points',
    icon: Award,
    color: 'bg-rose-50 text-rose-600 border-rose-200 group-hover:bg-rose-600 group-hover:text-white',
    badgeColor: 'bg-rose-100 text-rose-700',
  },
  {
    id: 'bulk-upload',
    title: 'Bulk Student Upload',
    description: 'Import multiple students using Excel template',
    category: 'operations',
    tag: 'Upload',
    path: '/admin/students?action=upload',
    icon: Upload,
    color: 'bg-teal-50 text-teal-600 border-teal-200 group-hover:bg-teal-600 group-hover:text-white',
    badgeColor: 'bg-teal-100 text-teal-700',
  },
];

const TEAM_MANAGER_QUICK_ADD_ACTIONS = [
  {
    id: 'assign-student',
    title: 'Events & Assignments',
    description: 'Browse active festivals and assign team members per event',
    category: 'operations',
    tag: 'Events',
    path: '/team-manager/events',
    icon: Calendar,
    color: 'bg-indigo-50 text-indigo-600 border-indigo-200 group-hover:bg-indigo-600 group-hover:text-white',
    badgeColor: 'bg-indigo-100 text-indigo-700',
  },
  {
    id: 'view-students',
    title: 'My Students',
    description: 'Inspect assigned students and category details',
    category: 'entities',
    tag: 'Students',
    path: '/team-manager/students',
    icon: GraduationCap,
    color: 'bg-emerald-50 text-emerald-600 border-emerald-200 group-hover:bg-emerald-600 group-hover:text-white',
    badgeColor: 'bg-emerald-100 text-emerald-700',
  },
  {
    id: 'active-events',
    title: 'Browse Events & Schedules',
    description: 'Check active festivals, stages, and registration status',
    category: 'entities',
    tag: 'Events',
    path: '/team-manager/events',
    icon: Calendar,
    color: 'bg-purple-50 text-purple-600 border-purple-200 group-hover:bg-purple-600 group-hover:text-white',
    badgeColor: 'bg-purple-100 text-purple-700',
  },
  {
    id: 'team-points',
    title: 'Points & School Leaderboard',
    description: 'View live scoring, medals, and team percentage table',
    category: 'operations',
    tag: 'Points',
    path: '/team-manager/points',
    icon: Award,
    color: 'bg-amber-50 text-amber-600 border-amber-200 group-hover:bg-amber-600 group-hover:text-white',
    badgeColor: 'bg-amber-100 text-amber-700',
  },
];

const TopNavbar = ({ sidebarOpen, setSidebarOpen, user }) => {
  const navigate = useNavigate();

  const userRole = user?.role || localStorage.getItem('user_role') || 'admin';
  const isTeamManager = userRole === 'team_manager';

  const teamData = isTeamManager
    ? (user?.team || (() => {
      try {
        return JSON.parse(localStorage.getItem('team_data') || '{}');
      } catch {
        return {};
      }
    })())
    : null;

  const rawSchoolData = user?.school || (() => {
    try {
      return JSON.parse(localStorage.getItem('school_data') || '{}');
    } catch {
      return {};
    }
  })();

  const schoolData = rawSchoolData;

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
    } else if (!isTeamManager && userRole !== 'super_admin') {
      schoolSettingsAPI.get()
        .then((res) => {
          const fetchedLogo = res.data?.school_logo;
          if (fetchedLogo) {
            const fullUrl = resolveLogoUrl(fetchedLogo);
            setSchoolLogo(fullUrl);
            setLogoImgError(false);
            try {
              const current = JSON.parse(localStorage.getItem('school_data') || '{}');
              current.school_logo = fetchedLogo;
              current.logo = fetchedLogo;
              localStorage.setItem('school_data', JSON.stringify(current));
              localStorage.setItem('school_logo', fetchedLogo);
            } catch {
              // ignore
            }
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
  }, [user, userRole, isTeamManager]);

  const displayName = isTeamManager
    ? (teamData?.name || teamData?.team_name || 'Team Leader')
    : (user?.name || user?.email?.split('@')[0] || 'Admin');

  const displayRole = isTeamManager
    ? 'Team Leader'
    : (user?.role || 'Administrator');

  const avatarInitial = isTeamManager
    ? (displayName.charAt(0) || 'T').toUpperCase()
    : ((user?.email?.[0] || displayName.charAt(0) || 'A').toUpperCase());

  const activeQuickActions = isTeamManager ? TEAM_MANAGER_QUICK_ADD_ACTIONS : QUICK_ADD_ACTIONS;

  // Distinct states for separate popovers
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Tabs inside popovers
  const [quickAddTab, setQuickAddTab] = useState('all'); // 'all' | 'entities' | 'operations'
  const [quickAddQuery, setQuickAddQuery] = useState('');

  // Search state
  const [searchFocused, setSearchFocused] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  const quickAddRef = useRef(null);
  const dropdownRef = useRef(null);

  // Click outside and escape key handling
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (quickAddRef.current && !quickAddRef.current.contains(event.target)) {
        setQuickAddOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setQuickAddOpen(false);
        setDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Mutually exclusive toggles
  const toggleQuickAdd = () => {
    setQuickAddOpen((prev) => !prev);
    setDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev);
    setQuickAddOpen(false);
  };

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

  const handleGlobalSearchSubmit = (e) => {
    e.preventDefault();
    if (!globalSearch.trim()) return;
    if (isTeamManager) {
      navigate(`/team-manager/students?search=${encodeURIComponent(globalSearch.trim())}`);
    } else {
      navigate(`/admin/events?search=${encodeURIComponent(globalSearch.trim())}`);
    }
  };

  const handleQuickAddClick = (path) => {
    setQuickAddOpen(false);
    navigate(path);
  };

  const filteredQuickAddActions = activeQuickActions.filter((action) => {
    const matchesTab = quickAddTab === 'all' || action.category === quickAddTab;
    const matchesQuery =
      !quickAddQuery.trim() ||
      action.title.toLowerCase().includes(quickAddQuery.toLowerCase()) ||
      action.description.toLowerCase().includes(quickAddQuery.toLowerCase()) ||
      action.tag.toLowerCase().includes(quickAddQuery.toLowerCase());
    return matchesTab && matchesQuery;
  });

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40 backdrop-blur-lg bg-white/95">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Left section: Mobile menu + Brand Logo + Search Bar */}
        <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
          {typeof setSidebarOpen === 'function' ? (
            <button
              type="button"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-200 shrink-0"
              aria-label="Toggle sidebar menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          ) : null}

          {/* Brand Logo for Mobile (or when no sidebar is mounted like Event Manager Portal) */}
          <div className={`${typeof setSidebarOpen === 'function' ? 'lg:hidden' : 'flex'} items-center gap-2 shrink-0`}>
            <Link
              to={userRole === 'event_manager' ? '/user/dashboard' : isTeamManager ? '/team-manager' : '/admin'}
              className="flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              {schoolLogo && !logoImgError ? (
                <img
                  src={schoolLogo}
                  alt={schoolData?.name || 'School Logo'}
                  className="h-8 w-8 rounded-lg object-contain bg-slate-50 border border-slate-200/80 p-0.5"
                  onError={() => setLogoImgError(true)}
                />
              ) : null}
              <EventlooLogo variant="full" size="sm" />
            </Link>
          </div>

          {/* Search Bar */}
          <div className="hidden md:block">
            <form onSubmit={handleGlobalSearchSubmit}>
              <div className={`relative transition-all duration-200 ${searchFocused ? 'w-96' : 'w-80'}`}>
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search
                    className={`h-4 w-4 transition-colors duration-200 ${searchFocused ? 'text-indigo-600' : 'text-gray-400'
                      }`}
                  />
                </div>
                <input
                  type="text"
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Search events, teams, students..."
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-slate-50/70 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all duration-150 outline-none text-slate-800 placeholder:text-slate-400"
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                />
              </div>
            </form>
          </div>
        </div>

        {/* Right section: Quick Add + User Menu */}
        <div className="flex items-center space-x-3">
          {/* ========================================================================= */}
          {/* 1. QUICK ADD TAB / DROPDOWN */}
          {/* ========================================================================= */}
          <div className="relative" ref={quickAddRef}>
            <button
              onClick={toggleQuickAdd}
              className={`btn btn-sm hidden sm:inline-flex items-center gap-1.5 font-medium transition-all duration-200 rounded-xl px-3.5 py-2 shadow-sm ${quickAddOpen
                  ? 'bg-indigo-700 text-white ring-2 ring-indigo-300 ring-offset-1'
                  : 'btn-primary'
                }`}
              aria-expanded={quickAddOpen}
              aria-haspopup="true"
              title="Quick Add actions"
            >
              <Plus
                className={`h-4 w-4 transition-transform duration-200 ${quickAddOpen ? 'rotate-45' : ''
                  }`}
              />
              <span>Quick Add</span>
              <ChevronDown
                className={`h-3 w-3 ml-0.5 opacity-80 transition-transform duration-200 ${quickAddOpen ? 'rotate-180' : ''
                  }`}
              />
            </button>

            {/* Quick Add Popover Panel */}
            {quickAddOpen && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Popover Header */}
                <div className="p-4 bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/50 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-600 text-white flex items-center justify-center shadow-sm">
                        <Plus className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 text-sm">Quick Add</h3>
                        <p className="text-xs text-gray-500">Create new items & trigger actions</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[11px] font-semibold text-indigo-700 bg-indigo-100/70 rounded-full border border-indigo-200">
                      Shortcuts
                    </span>
                  </div>

                  {/* Search inside quick add */}
                  <div className="mt-3 relative">
                    <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={quickAddQuery}
                      onChange={(e) => setQuickAddQuery(e.target.value)}
                      placeholder="Filter actions (e.g. event, student)..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-200 rounded-lg focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-gray-400"
                      autoFocus
                    />
                    {quickAddQuery && (
                      <button
                        onClick={() => setQuickAddQuery('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Category Filter Tabs */}
                  <div className="flex items-center space-x-1.5 mt-2.5">
                    <button
                      onClick={() => setQuickAddTab('all')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${quickAddTab === 'all'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      All
                    </button>
                    <button
                      onClick={() => setQuickAddTab('entities')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${quickAddTab === 'entities'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      Entities
                    </button>
                    <button
                      onClick={() => setQuickAddTab('operations')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${quickAddTab === 'operations'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      Operations
                    </button>
                  </div>
                </div>

                {/* Actions List */}
                <div className="max-h-80 overflow-y-auto p-2 space-y-1 divide-y divide-gray-50">
                  {filteredQuickAddActions.length > 0 ? (
                    filteredQuickAddActions.map((action) => {
                      const IconComponent = action.icon;
                      return (
                        <button
                          key={action.id}
                          onClick={() => handleQuickAddClick(action.path)}
                          className="w-full group flex items-center justify-between p-2.5 rounded-xl hover:bg-indigo-50/60 transition-all duration-150 text-left border border-transparent hover:border-indigo-100"
                        >
                          <div className="flex items-center space-x-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-xl flex items-center justify-center border transition-all duration-200 shrink-0 ${action.color}`}
                            >
                              <IconComponent className="h-4 w-4" />
                            </div>
                            <div className="truncate">
                              <div className="flex items-center space-x-1.5">
                                <span className="text-xs font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                                  {action.title}
                                </span>
                                <span
                                  className={`px-1.5 py-0.5 text-[10px] font-medium rounded-md ${action.badgeColor}`}
                                >
                                  {action.tag}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-500 truncate mt-0.5">
                                {action.description}
                              </p>
                            </div>
                          </div>
                          <ArrowRight className="h-3.5 w-3.5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 ml-2" />
                        </button>
                      );
                    })
                  ) : (
                    <div className="p-6 text-center text-gray-500">
                      <Sparkles className="h-6 w-6 text-gray-300 mx-auto mb-2" />
                      <p className="text-xs font-medium">No actions matching "{quickAddQuery}"</p>
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="p-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                  <span className="flex items-center">
                    <Sparkles className="h-3 w-3 text-indigo-500 mr-1" />
                    Instant modal launch enabled
                  </span>
                  <button
                    onClick={() => {
                      setQuickAddOpen(false);
                      navigate('/admin/docs');
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                  >
                    Quick Guide
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* USER PROFILE MENU */}
          {/* ========================================================================= */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={toggleDropdown}
              className={`flex items-center space-x-2 p-1.5 sm:p-2 rounded-xl transition-all duration-200 ${dropdownOpen
                  ? 'bg-gray-100 ring-2 ring-gray-200'
                  : 'hover:bg-gray-50'
                }`}
              aria-label="User profile menu"
            >
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-xs shadow-sm overflow-hidden border border-slate-200/80 bg-white shrink-0">
                {schoolLogo && !logoImgError ? (
                  <img
                    src={schoolLogo}
                    alt={schoolData?.name || displayName || 'School Logo'}
                    className="w-full h-full object-contain p-0.5 bg-white"
                    onError={() => setLogoImgError(true)}
                  />
                ) : (
                  <span>{avatarInitial}</span>
                )}
              </div>
              <div className="hidden md:block text-left mr-1">
                <p className="text-xs font-semibold text-slate-800 truncate max-w-32">
                  {displayName}
                </p>
                <p className="text-[10px] text-slate-400 font-normal capitalize">
                  {displayRole}
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${dropdownOpen ? 'rotate-180' : ''
                  }`}
              />
            </button>

            {/* Dropdown menu */}
            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 text-white flex items-center justify-center font-bold text-sm shadow-sm overflow-hidden border border-slate-200/80 bg-white shrink-0">
                    {schoolLogo && !logoImgError ? (
                      <img
                        src={schoolLogo}
                        alt={schoolData?.name || displayName || 'School Logo'}
                        className="w-full h-full object-contain p-0.5 bg-white"
                        onError={() => setLogoImgError(true)}
                      />
                    ) : (
                      <span>{avatarInitial}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] text-gray-500 font-medium">Signed in as</p>
                    <p className="text-sm font-semibold text-gray-900 truncate">{displayName}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="inline-block px-2 py-0.5 text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-md capitalize">
                        {displayRole}
                      </span>
                      {schoolData?.code && (
                        <span className="inline-block px-1.5 py-0.5 text-[10px] font-medium text-slate-600 bg-slate-100 rounded">
                          {schoolData.code}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="py-1.5">
                  {isTeamManager ? (
                    <>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate('/team-manager/students');
                        }}
                        className="flex items-center w-full px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors duration-150"
                      >
                        <Users className="mr-3 h-4 w-4 text-gray-400" />
                        My Students
                      </button>

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate('/team-manager/events');
                        }}
                        className="flex items-center w-full px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors duration-150"
                      >
                        <Calendar className="mr-3 h-4 w-4 text-gray-400" />
                        Events & Assignments
                      </button>

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate('/team-manager/points');
                        }}
                        className="flex items-center w-full px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors duration-150"
                      >
                        <Trophy className="mr-3 h-4 w-4 text-gray-400" />
                        Points & Standings
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate('/admin/settings');
                        }}
                        className="flex items-center w-full px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors duration-150"
                      >
                        <User className="mr-3 h-4 w-4 text-gray-400" />
                        School Profile
                      </button>

                      <button
                        onClick={() => {
                          setDropdownOpen(false);
                          navigate('/admin/settings');
                        }}
                        className="flex items-center w-full px-4 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 hover:text-indigo-600 transition-colors duration-150"
                      >
                        <Settings className="mr-3 h-4 w-4 text-gray-400" />
                        System Settings
                      </button>
                    </>
                  )}
                </div>

                <div className="border-t border-gray-100 py-1.5 bg-gray-50/30">
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 transition-colors duration-150"
                  >
                    <LogOut className="mr-3 h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default TopNavbar;