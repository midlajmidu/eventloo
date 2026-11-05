import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Menu,
  Bell,
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
  CheckCheck,
  Trash2,
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

const DEFAULT_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'Cultural Fest 2026 Live',
    message: 'Stage 1 schedule is live. 12 programs scheduled for today.',
    time: '10 min ago',
    unread: true,
    category: 'events',
    link: '/admin/events',
    type: 'event',
  },
  {
    id: 'notif-2',
    title: 'New Team Registered',
    message: 'Team "Emerald Falcons" completed manager credentials setup.',
    time: '45 min ago',
    unread: true,
    category: 'events',
    link: '/admin/teams',
    type: 'team',
  },
  {
    id: 'notif-3',
    title: 'Official Results Published',
    message: 'Scores published for Senior Classical Dance & Solo Song.',
    time: '2 hours ago',
    unread: false,
    category: 'events',
    link: '/admin/points',
    type: 'result',
  },
  {
    id: 'notif-4',
    title: 'Student Roster Updated',
    message: 'Batch upload completed: 48 students enrolled across junior categories.',
    time: '5 hours ago',
    unread: false,
    category: 'system',
    link: '/admin/students',
    type: 'student',
  },
  {
    id: 'notif-5',
    title: 'System Security Audit',
    message: 'Scheduled data snapshot and session token rotation completed.',
    time: '1 day ago',
    unread: false,
    category: 'system',
    link: '/admin/settings',
    type: 'system',
  },
];

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
    id: 'view-roster',
    title: 'My Students Roster',
    description: 'Inspect assigned student roster and category details',
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
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Tabs inside popovers
  const [quickAddTab, setQuickAddTab] = useState('all'); // 'all' | 'entities' | 'operations'
  const [quickAddQuery, setQuickAddQuery] = useState('');
  const [notificationTab, setNotificationTab] = useState('all'); // 'all' | 'unread' | 'events' | 'system'

  // Search state
  const [searchFocused, setSearchFocused] = useState(false);
  const [globalSearch, setGlobalSearch] = useState('');

  // Notifications state with localStorage caching
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('eventloo_notifications');
      return saved ? JSON.parse(saved) : DEFAULT_NOTIFICATIONS;
    } catch {
      return DEFAULT_NOTIFICATIONS;
    }
  });

  const quickAddRef = useRef(null);
  const notificationRef = useRef(null);
  const dropdownRef = useRef(null);

  // Sync notifications to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('eventloo_notifications', JSON.stringify(notifications));
    } catch {
      // Ignore storage errors
    }
  }, [notifications]);

  // Click outside and escape key handling
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (quickAddRef.current && !quickAddRef.current.contains(event.target)) {
        setQuickAddOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setQuickAddOpen(false);
        setNotificationsOpen(false);
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
    setNotificationsOpen(false);
    setDropdownOpen(false);
  };

  const toggleNotifications = () => {
    setNotificationsOpen((prev) => !prev);
    setQuickAddOpen(false);
    setDropdownOpen(false);
  };

  const toggleDropdown = () => {
    setDropdownOpen((prev) => !prev);
    setQuickAddOpen(false);
    setNotificationsOpen(false);
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

  const markAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
  };

  const markNotificationRead = (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
  };

  const dismissNotification = (id, e) => {
    e.stopPropagation();
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const handleNotificationClick = (notification) => {
    markNotificationRead(notification.id);
    setNotificationsOpen(false);
    if (notification.link) {
      navigate(notification.link);
    }
  };

  // Filtered lists
  const unreadCount = notifications.filter((n) => n.unread).length;

  const filteredQuickAddActions = activeQuickActions.filter((action) => {
    const matchesTab = quickAddTab === 'all' || action.category === quickAddTab;
    const matchesQuery =
      !quickAddQuery.trim() ||
      action.title.toLowerCase().includes(quickAddQuery.toLowerCase()) ||
      action.description.toLowerCase().includes(quickAddQuery.toLowerCase()) ||
      action.tag.toLowerCase().includes(quickAddQuery.toLowerCase());
    return matchesTab && matchesQuery;
  });

  const filteredNotifications = notifications.filter((n) => {
    if (notificationTab === 'unread') return n.unread;
    if (notificationTab === 'events') return n.category === 'events';
    if (notificationTab === 'system') return n.category === 'system';
    return true; // 'all'
  });

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'event':
        return <Calendar className="h-4 w-4 text-purple-600" />;
      case 'team':
        return <Users className="h-4 w-4 text-blue-600" />;
      case 'result':
        return <Trophy className="h-4 w-4 text-amber-600" />;
      case 'student':
        return <GraduationCap className="h-4 w-4 text-emerald-600" />;
      default:
        return <Shield className="h-4 w-4 text-indigo-600" />;
    }
  };

  const getNotificationBadgeClass = (type) => {
    switch (type) {
      case 'event':
        return 'bg-purple-100 text-purple-700';
      case 'team':
        return 'bg-blue-100 text-blue-700';
      case 'result':
        return 'bg-amber-100 text-amber-700';
      case 'student':
        return 'bg-emerald-100 text-emerald-700';
      default:
        return 'bg-indigo-100 text-indigo-700';
    }
  };

  return (
    <header className="bg-white border-b border-gray-100 sticky top-0 z-40 backdrop-blur-lg bg-white/95">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6 lg:px-8">
        {/* Left section: Mobile menu + Search Bar */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="lg:hidden p-2 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors duration-200"
            aria-label="Toggle sidebar menu"
          >
            <Menu className="h-5 w-5" />
          </button>

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

        {/* Right section: Quick Add + Notifications + User Menu */}
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
          {/* 2. NOTIFICATIONS TAB / DROPDOWN */}
          {/* ========================================================================= */}
          <div className="relative" ref={notificationRef}>
            <button
              onClick={toggleNotifications}
              className={`p-2 rounded-xl relative transition-all duration-200 ${notificationsOpen
                  ? 'bg-indigo-50 text-indigo-600 ring-2 ring-indigo-200'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                }`}
              aria-label="Notifications"
              title="Notifications"
            >
              <Bell className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow-sm animate-pulse">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications Popover Panel */}
            {notificationsOpen && (
              <div className="absolute right-0 mt-2 w-[calc(100vw-1.5rem)] sm:w-96 max-w-sm bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                {/* Notification Header */}
                <div className="p-4 bg-gradient-to-r from-gray-50 via-white to-indigo-50/40 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <h3 className="font-semibold text-gray-900 text-sm">Notifications</h3>
                      {unreadCount > 0 ? (
                        <span className="px-2 py-0.5 text-xs font-semibold text-indigo-700 bg-indigo-100 rounded-full">
                          {unreadCount} new
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 text-[11px] font-medium text-emerald-700 bg-emerald-50 rounded-full border border-emerald-100 flex items-center">
                          <Check className="h-3 w-3 mr-0.5" /> Caught up
                        </span>
                      )}
                    </div>

                    <div className="flex items-center space-x-1">
                      {unreadCount > 0 && (
                        <button
                          onClick={markAllNotificationsRead}
                          className="p-1.5 text-xs text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-colors flex items-center"
                          title="Mark all as read"
                        >
                          <CheckCheck className="h-3.5 w-3.5 mr-1" />
                          <span className="hidden sm:inline text-[11px]">Mark read</span>
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button
                          onClick={clearAllNotifications}
                          className="p-1.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Clear all notifications"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Notification Category Tabs */}
                  <div className="flex items-center space-x-1.5 mt-3">
                    <button
                      onClick={() => setNotificationTab('all')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${notificationTab === 'all'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      All ({notifications.length})
                    </button>
                    <button
                      onClick={() => setNotificationTab('unread')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${notificationTab === 'unread'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      Unread ({unreadCount})
                    </button>
                    <button
                      onClick={() => setNotificationTab('events')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${notificationTab === 'events'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      Events
                    </button>
                    <button
                      onClick={() => setNotificationTab('system')}
                      className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${notificationTab === 'system'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'text-gray-600 hover:bg-gray-100'
                        }`}
                    >
                      System
                    </button>
                  </div>
                </div>

                {/* Notifications List */}
                <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                  {filteredNotifications.length > 0 ? (
                    filteredNotifications.map((notification) => (
                      <div
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`p-3.5 hover:bg-gray-50/80 cursor-pointer transition-all duration-150 flex items-start space-x-3 group relative ${notification.unread ? 'bg-indigo-50/30' : 'bg-white'
                          }`}
                      >
                        {/* Icon Pill */}
                        <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center shrink-0 mt-0.5 border border-gray-200/60 group-hover:scale-105 transition-transform">
                          {getNotificationIcon(notification.type)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors truncate">
                              {notification.title}
                            </span>
                            <span className="text-[10px] text-gray-400 shrink-0 ml-2">
                              {notification.time}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                            {notification.message}
                          </p>
                          <div className="flex items-center justify-between mt-1.5">
                            <span
                              className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${getNotificationBadgeClass(
                                notification.type
                              )}`}
                            >
                              {notification.category}
                            </span>
                            <span className="text-[11px] font-medium text-indigo-600 group-hover:underline flex items-center">
                              Open <ArrowRight className="h-3 w-3 ml-0.5" />
                            </span>
                          </div>
                        </div>

                        {/* Unread indicator or Dismiss button */}
                        <div className="flex flex-col items-center justify-between h-full pt-1 shrink-0">
                          {notification.unread && (
                            <span className="w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-indigo-200 mb-2"></span>
                          )}
                          <button
                            onClick={(e) => dismissNotification(notification.id, e)}
                            className="text-gray-300 hover:text-gray-600 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Dismiss notification"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="p-8 text-center">
                      <div className="w-12 h-12 rounded-2xl bg-gray-50 border border-gray-100 flex items-center justify-center mx-auto mb-3 text-gray-400">
                        <Bell className="h-6 w-6" />
                      </div>
                      <p className="text-xs font-semibold text-gray-800">No notifications</p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        {notificationTab === 'unread'
                          ? 'All notifications have been read.'
                          : 'No activity found in this category.'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Notification Footer */}
                <div className="p-2.5 bg-gray-50 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                  <span className="flex items-center">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block mr-1.5 animate-pulse"></span>
                    Live monitoring active
                  </span>
                  <button
                    onClick={() => {
                      setNotificationsOpen(false);
                      navigate('/admin/events');
                    }}
                    className="text-indigo-600 hover:text-indigo-800 font-medium hover:underline"
                  >
                    View All Events
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ========================================================================= */}
          {/* 3. USER PROFILE MENU */}
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