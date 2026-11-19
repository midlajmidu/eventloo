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
    } else if (userRole !== 'super_admin') {
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

          {/* Brand Logo - On mobile screen: shown on the right side of the hamburger button (lg:hidden); on desktop: shown if no vertical sidebar is mounted */}
          <div
            className={`items-center gap-2 shrink-0 ${
              typeof setSidebarOpen === 'function' ? 'flex lg:hidden' : 'flex'
            }`}
          >
            <Link
              to={
                isTeamManager
                  ? '/team-manager'
                  : userRole === 'event_manager'
                  ? '/user/dashboard'
                  : '/admin'
              }
              className="flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
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

        {/* Right section: Clean */}
        <div className="flex items-center space-x-3 shrink-0" />
      </div>
    </header>
  );
};

export default TopNavbar;