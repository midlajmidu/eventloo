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
    window.location.href = '/login';
  };

  return (
    <div className="bg-gradient-to-b from-gray-900 to-gray-800 text-white w-64 min-h-screen flex flex-col shadow-xl">
      {/* Logo */}
      <div className="flex items-center space-x-3 px-6 py-6 border-b border-gray-700">
        <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg overflow-hidden">
          <Sparkles className="h-8 w-8 text-gray-800" />
        </div>
        <div>
          <span className="text-xl font-bold text-white">Eventloo</span>
          <p className="text-xs text-gray-400">Team Manager Portal</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2">
        {navigation.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <NavLink
              key={item.name}
              to={item.href}
              className={`
                group flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 relative
                ${active 
                  ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg transform scale-105' 
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white hover:transform hover:scale-105'
                }
              `}
            >
              {active && (
                <div className="absolute left-0 w-1 h-8 bg-white rounded-r-full"></div>
              )}
              <item.icon className={`h-5 w-5 transition-transform duration-200 ${active ? 'scale-110' : 'group-hover:scale-110'}`} />
              <span className="font-medium">{item.name}</span>
              {active && (
                <div className="ml-auto">
                  <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                </div>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Info & Logout */}
      <div className="px-4 py-6 border-t border-gray-700">
        <div className="flex items-center space-x-3 px-4 py-3 bg-gray-800 rounded-xl mb-4">
          <div className="w-8 h-8 bg-gradient-to-r from-green-400 to-blue-500 rounded-full flex items-center justify-center">
            <User className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Team Manager</p>
            <p className="text-xs text-gray-400">Online</p>
          </div>
          <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
        </div>
        
        <button
          onClick={handleLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 text-gray-300 hover:bg-red-600 hover:text-white rounded-xl transition-all duration-200 group"
        >
          <LogOut className="h-5 w-5 group-hover:scale-110 transition-transform duration-200" />
          <span className="font-medium">Logout</span>
        </button>
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-700">
        <div className="text-center">
          <p className="text-xs text-gray-500">Team Manager Portal</p>
          <p className="text-xs text-gray-600 mt-1">v2.0</p>
        </div>
      </div>
    </div>
  );
};

export default TeamManagerSidebar; 