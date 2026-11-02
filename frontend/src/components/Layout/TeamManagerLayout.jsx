import React, { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import TeamManagerSidebar from './TeamManagerSidebar';
import TopNavbar from './TopNavbar';

const TeamManagerLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [teamUser, setTeamUser] = useState(null);

  useEffect(() => {
    try {
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const schoolData = JSON.parse(localStorage.getItem('school_data') || '{}');
      const teamName = teamData.name || teamData.team_name || 'Team Leader';
      setTeamUser({
        name: teamName,
        role: 'team_manager',
        email: teamData.team_username ? `${teamData.team_username}@team.eventloo` : `${teamName.toLowerCase().replace(/\s+/g, '_')}@team.eventloo`,
        team: teamData,
        school: schoolData,
      });
    } catch {
      // Fallback if parsing fails
    }
  }, []);

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <TeamManagerSidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      {/* Main content column */}
      <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
        {/* Top navbar */}
        <TopNavbar
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          user={teamUser}
        />

        {/* Page content */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#f7f8fb]">
          <Outlet context={{ user: teamUser }} />
        </main>
      </div>
    </div>
  );
};

export default TeamManagerLayout;
