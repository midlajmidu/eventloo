import React from 'react';
import { Outlet } from 'react-router-dom';
import TeamManagerSidebar from './TeamManagerSidebar';
import TopNavbar from './TopNavbar';

const TeamManagerLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top Navigation */}
      <TopNavbar />
      
      <div className="flex">
        {/* Sidebar */}
        <TeamManagerSidebar />
        
        {/* Main Content */}
        <main className="flex-1 ml-64">
          <div className="p-6">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default TeamManagerLayout; 