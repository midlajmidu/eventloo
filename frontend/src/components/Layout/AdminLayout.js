import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import TopNavbar from './TopNavbar';
import { authAPI } from '../../services/api';

const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [user, setUser] = useState(null);

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const userData = await authAPI.getUserProfile();
      setUser(userData);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
    }
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />
      
      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Top navbar */}
        <TopNavbar 
          sidebarOpen={sidebarOpen} 
          setSidebarOpen={setSidebarOpen}
          user={user}
        />
        
        {/* Page content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Outlet context={{ user }} />
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdminLayout; 