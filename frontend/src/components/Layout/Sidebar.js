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
  Sparkles
} from 'lucide-react';

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: Home },
    { name: 'Events', href: '/admin/events', icon: Calendar },
    { name: 'Teams', href: '/admin/teams', icon: Users },
    { name: 'Students', href: '/admin/students', icon: GraduationCap },
    { name: 'Points', href: '/admin/points', icon: Trophy },
    { name: 'Reports', href: '/admin/reports', icon: BarChart3 },
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
      <div className={`fixed inset-y-0 left-0 z-30 w-72 bg-white shadow-xl transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-center h-20 px-6 bg-gradient-to-r from-blue-600 to-indigo-600">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center mr-3 shadow-lg overflow-hidden">
                <Sparkles className="w-8 h-8 text-blue-600" />
              </div>
              <div className="text-white">
                <div className="text-xl font-bold">Eventloo</div>
                <div className="text-xs text-blue-100">School Event Management System</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-8 space-y-1">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={`nav-link ${isActive ? 'nav-link-active' : ''}`}
                  onClick={() => setIsOpen(false)}
                >
                  <item.icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                  <span className="font-medium">{item.name}</span>
                </NavLink>
              );
            })}
          </nav>

          {/* Bottom section */}
          <div className="p-6 border-t border-gray-100">
            <div className="text-center">
              <div className="text-xs text-gray-400 mb-2">Version 1.0.0</div>
              <div className="text-xs text-gray-500">© 2025 Eventloo. All rights reserved.</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar; 