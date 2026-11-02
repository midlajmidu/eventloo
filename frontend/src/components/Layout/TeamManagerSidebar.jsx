import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  Calendar,
  Trophy,
  Sparkles,
  Shield,
  GraduationCap,
  X
} from 'lucide-react';
import EventlooLogo from '../common/EventlooLogo';

const TeamManagerSidebar = ({ isOpen = false, setIsOpen = () => { } }) => {
  const location = useLocation();

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

  const navigation = [
    { name: 'Dashboard', href: '/team-manager', icon: Home, exact: true },
    { name: 'My Students', href: '/team-manager/students', icon: Users },
    { name: 'Events & Roster', href: '/team-manager/events', icon: Calendar },
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

        {/* Team Identity card */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/70 shrink-0">
          <div className="flex items-center space-x-3 p-2.5 bg-white border border-slate-200/80 rounded-xl shadow-xs">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-600 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
              {teamInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-semibold text-slate-900 truncate">{teamName}</p>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 ring-2 ring-emerald-100 shrink-0" title="Online" />
              </div>
              <p className="text-xs text-slate-500 font-medium truncate">
                {teamData.team_username ? `@${teamData.team_username}` : 'Team Leader'} · {schoolData.code || 'Portal'}
              </p>
            </div>
          </div>
        </div>

        {/* Footer info */}
        <div className="px-6 py-3 border-t border-slate-100/80 text-center shrink-0">
          <p className="text-[11px] text-slate-400">Team Manager Portal v2.0</p>
        </div>
      </aside>
    </>
  );
};

export default TeamManagerSidebar;
