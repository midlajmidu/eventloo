import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  Home,
  Calendar,
  Users,
  GraduationCap,
  Trophy,
  Settings,
  BarChart3,
  BookOpen,
  Sparkles
} from 'lucide-react';
import EventlooLogo from '../common/EventlooLogo';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();

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
          <nav className="flex-1 px-3 py-5 space-y-0.5">
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

          {/* Bottom section */}
          <div className="p-6 border-t border-gray-200">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-1">Version 1.0.0</div>
              <div className="text-xs text-gray-400">© 2025 Eventloo. All rights reserved.</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar; 
