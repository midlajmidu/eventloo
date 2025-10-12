import React, { useState, useEffect } from 'react';
import { teamManagerAPI, dashboardAPI } from '../services/api';
import { 
  Users, 
  Calendar, 
  Trophy, 
  TrendingUp, 
  Medal, 
  Target, 
  Activity, 
  ChevronRight
} from 'lucide-react';

const TeamManagerDashboard = () => {
  const [dashboardData, setDashboardData] = useState(null);
  const [myTeams, setMyTeams] = useState([]);
  const [leaderboard, setLeaderboard] = useState({ teams: [], students: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEventBreakdownModal, setShowEventBreakdownModal] = useState(false);
  const [selectedTeamBreakdown, setSelectedTeamBreakdown] = useState(null);

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      const [dashboardResponse, teamsResponse, leaderboardResponse] = await Promise.all([
        dashboardAPI.getTeamManagerSummary(),
        teamManagerAPI.getMyTeams(),
        teamManagerAPI.getLeaderboard()
      ]);
      
      setDashboardData(dashboardResponse.data);
      setMyTeams(teamsResponse.data);
      setLeaderboard(leaderboardResponse.data);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Activity className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-4">{error}</p>
          <button 
            onClick={fetchAllData}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: 'My Teams',
      value: myTeams.length,
      icon: Users,
      color: 'bg-gradient-to-r from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600',
      change: '+12%',
      changeType: 'positive'
    },
    {
      title: 'Total Students',
      value: myTeams.reduce((sum, team) => sum + team.member_count, 0),
      icon: Target,
      color: 'bg-gradient-to-r from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600',
      change: '+8%',
      changeType: 'positive'
    },
    {
      title: 'Active Events',
      value: dashboardData?.totalEvents || 0,
      icon: Calendar,
      color: 'bg-gradient-to-r from-purple-500 to-purple-600',
      bgColor: 'bg-purple-50',
      textColor: 'text-purple-600',
      change: '+5%',
      changeType: 'positive'
    },
    {
      title: 'Total Points',
      value: myTeams.reduce((sum, team) => sum + (team.global_points || team.points_earned || 0), 0),
      icon: Trophy,
      color: 'bg-gradient-to-r from-yellow-500 to-yellow-600',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
      change: '+15%',
      changeType: 'positive'
    }
  ];

  const topTeams = leaderboard.teams.slice(0, 5);
  const myTeamRankings = myTeams.map(team => {
    const ranking = leaderboard.teams.findIndex(t => t.name === team.name) + 1;
    return { ...team, rank: ranking || 'N/A' };
  });

  const handleTeamPointsClick = (team) => {
    setSelectedTeamBreakdown(team);
    setShowEventBreakdownModal(true);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Team Manager Portal</h1>
              <p className="text-gray-600 text-lg">
                Welcome back! Here's your teams' performance overview.
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">Online</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat, index) => (
            <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                  <div className={`${stat.bgColor} p-3 rounded-lg`}>
                    <stat.icon className={`h-6 w-6 ${stat.textColor}`} />
                  </div>
                </div>
                <div className="mt-4 flex items-center">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm text-green-600 font-medium">{stat.change}</span>
                  <span className="text-sm text-gray-500 ml-2">vs last month</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* My Teams */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <Users className="h-5 w-5 mr-2" />
                    My Teams
                  </h2>
                  <button className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center">
                    View All <ChevronRight className="h-4 w-4 ml-1" />
                  </button>
                </div>
              </div>
              <div className="p-6">
                {myTeamRankings.length > 0 ? (
                  <div className="space-y-4">
                    {myTeamRankings.map((team, index) => (
                      <div key={team.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <div className="bg-blue-100 p-3 rounded-full">
                              <Users className="h-5 w-5 text-blue-600" />
                            </div>
                            {team.rank <= 3 && (
                              <div className="absolute -top-1 -right-1">
                                {team.rank === 1 && <Medal className="h-4 w-4 text-yellow-500" />}
                                {team.rank === 2 && <Medal className="h-4 w-4 text-gray-400" />}
                                {team.rank === 3 && <Medal className="h-4 w-4 text-yellow-600" />}
                              </div>
                            )}
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{team.name}</h3>
                            <p className="text-sm text-gray-600">{team.member_count} members</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-4">
                            <div>
                              <button
                                onClick={() => handleTeamPointsClick(team)}
                                className="font-semibold text-gray-900 hover:text-blue-600 cursor-pointer transition-colors"
                                title="Click to view event breakdown"
                              >
                                {team.global_points || team.points_earned || 0} {team.global_points ? 'global pts' : 'pts'}
                              </button>
                              <p className="text-sm text-gray-600">Rank #{team.rank}</p>
                            </div>
                            <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200">
                              <Activity className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">No teams assigned yet</p>
                    <p className="text-gray-500 text-sm mt-2">Contact your administrator to get team assignments</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Global Leaderboard */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Trophy className="h-5 w-5 mr-2" />
                  Global Leaderboard
                </h2>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {topTeams.map((team, index) => (
                    <div key={team.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="relative">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {index + 1}
                          </div>
                          {index === 0 && <Medal className="absolute -top-1 -right-1 h-3 w-3 text-yellow-500" />}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-sm">{team.name}</p>
                          <p className="text-xs text-gray-500">{team.members} members</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-gray-900 text-sm">{team.points}</p>
                        <p className="text-xs text-gray-500">pts</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <button className="p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors group">
                  <div className="flex items-center space-x-3">
                    <Activity className="h-6 w-6 text-blue-600 group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">My Students</p>
                      <p className="text-sm text-gray-600">Manage team members</p>
                    </div>
                  </div>
                </button>
                
                <button className="p-4 bg-green-50 rounded-lg hover:bg-green-100 transition-colors group">
                  <div className="flex items-center space-x-3">
                    <Activity className="h-6 w-6 text-green-600 group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Assignments</p>
                      <p className="text-sm text-gray-600">Program assignments</p>
                    </div>
                  </div>
                </button>
                
                <button className="p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors group">
                  <div className="flex items-center space-x-3">
                    <Activity className="h-6 w-6 text-purple-600 group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Events</p>
                      <p className="text-sm text-gray-600">View active events</p>
                    </div>
                  </div>
                </button>
                
                <button className="p-4 bg-yellow-50 rounded-lg hover:bg-yellow-100 transition-colors group">
                  <div className="flex items-center space-x-3">
                    <Activity className="h-6 w-6 text-yellow-600 group-hover:scale-110 transition-transform" />
                    <div className="text-left">
                      <p className="font-medium text-gray-900">Points</p>
                      <p className="text-sm text-gray-600">Track performance</p>
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="mt-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Activity className="h-5 w-5 mr-2" />
                Recent Activity
              </h2>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {dashboardData?.recentActivities && dashboardData.recentActivities.length > 0 ? (
                  dashboardData.recentActivities.map((activity, index) => (
                    <div key={index} className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <div className="bg-green-100 p-2 rounded-full">
                        <Activity className="h-4 w-4 text-green-600" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-900">{activity.action}</p>
                        <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Activity className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600">No recent activities</p>
                    <p className="text-gray-500 text-sm mt-2">Activities will appear here as your teams participate in events</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Event Breakdown Modal */}
      {showEventBreakdownModal && selectedTeamBreakdown && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Event Breakdown for {selectedTeamBreakdown.name}</h2>
              <button
                onClick={() => setShowEventBreakdownModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-blue-900">Total Points: {selectedTeamBreakdown.points_earned || 0}</h3>
                    <p className="text-blue-700 text-sm">
                      Team Rank: #{selectedTeamBreakdown.rank}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-600">Members: {selectedTeamBreakdown.member_count}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-center py-8">
              <div className="text-gray-400 text-6xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">Event Breakdown Not Available</h3>
              <p className="text-gray-500">
                Detailed event breakdown is available in the Global Points section.
              </p>
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowEventBreakdownModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagerDashboard; 