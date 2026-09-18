import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Users,
  Calendar,
  Trophy,
  ClipboardList,
  Settings,
  User,
  LogOut,
  Sparkles
} from 'lucide-react';
import EventlooLogo from '../common/EventlooLogo';

const TeamManagerSidebar = () => {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/team-manager', icon: Home, exact: true },
    { name: 'My Students', href: '/team-manager/students', icon: Users },
    { name: 'Events', href: '/team-manager/events', icon: Calendar },
    { name: 'Assignments', href: '/team-manager/assignments', icon: ClipboardList },
    { name: 'Points & Rankings', href: '/team-manager/points', icon: Trophy },
    { name: 'Team Profile', href: '/team-manager/profile', icon: User },
    { name: 'Settings', href: '/team-manager/settings', icon: Settings },
  ];

  const isActive = (href, exact = false) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('team_data');
    localStorage.removeItem('access_type');
    localStorage.removeItem('team_welcome_message');
    window.location.href = '/login';
  };

  return (
    <div className="bg-white border-r border-gray-200 text-gray-900 w-64 min-h-screen flex flex-col">
      {/* Logo */}
      <div className="flex items-center h-20 px-6 border-b border-gray-200">
        <EventlooLogo variant="full" size="md" showSubtitle />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-8 space-y-1">
        {navigation.map((item) => {
          const active = isActive(item.href, item.exact);
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={`
                flex items-center px-4 py-3 rounded-lg font-medium transition-all duration-200
                ${active
                  ? 'bg-blue-50 text-blue-600 border-l-4 border-blue-600 rounded-l-none'
                  : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }
              `}
            >
              <Icon className={`h-5 w-5 mr-3 transition-colors duration-200 ${active ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-900'
                }`} />
              <span className="font-semibold text-sm">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="px-4 py-6 border-t border-gray-200 bg-gray-50">
        <div className="flex items-center space-x-3 px-4 py-3 bg-white border border-gray-200 rounded-lg mb-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">Team Manager</p>
            <p className="text-xs text-gray-500 font-medium">Status: Online</p>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center px-4 py-2 bg-white text-red-600 hover:bg-red-50 border border-gray-200 rounded-lg font-semibold text-sm transition-all duration-200"
        >
          Logout
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200">
        <div className="text-center">
          <p className="text-xs text-gray-400">Team Manager Portal v2.0</p>
        </div>
      </div>
    </div>
  );
};

export default TeamManagerSidebar; 