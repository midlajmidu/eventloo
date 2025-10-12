import React, { useState, useEffect } from 'react';
import { teamManagerAPI } from '../../services/api';
import { 
  Trophy, 
  Medal, 
  Star, 
  TrendingUp, 
  Users, 
  Target, 
  Award, 
  ChevronUp, 
  Eye,
  BarChart3,
  Activity
} from 'lucide-react';

const TeamManagerPoints = () => {
  const [myTeams, setMyTeams] = useState([]);
  const [leaderboard, setLeaderboard] = useState({ teams: [], students: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('teams');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [teamsResponse, leaderboardResponse] = await Promise.all([
        teamManagerAPI.getMyTeams(),
        teamManagerAPI.getLeaderboard()
      ]);
      
      setMyTeams(teamsResponse.data);
      setLeaderboard(leaderboardResponse.data);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load points data');
    } finally {
      setLoading(false);
    }
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Medal className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Medal className="h-5 w-5 text-orange-500" />;
    return <Star className="h-5 w-5 text-blue-500" />;
  };

  const getRankColor = (rank) => {
    if (rank === 1) return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    if (rank === 2) return 'bg-gray-100 text-gray-800 border-gray-200';
    if (rank === 3) return 'bg-orange-100 text-orange-800 border-orange-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  const myTeamRankings = myTeams.map(team => {
    const ranking = leaderboard.teams.findIndex(t => t.name === team.name) + 1;
    return { ...team, rank: ranking || leaderboard.teams.length + 1 };
  }).sort((a, b) => a.rank - b.rank);

  const totalPoints = myTeams.reduce((sum, team) => sum + (team.points_earned || 0), 0);
  const averageRank = myTeamRankings.length > 0 
    ? Math.round(myTeamRankings.reduce((sum, team) => sum + team.rank, 0) / myTeamRankings.length)
    : 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading points data...</p>
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
            onClick={fetchData}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Points & Rankings</h1>
              <p className="text-gray-600 text-lg">
                Track your teams' performance and see global standings
              </p>
            </div>
            <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium text-gray-700">{totalPoints} Total Points</span>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Total Points</p>
                <p className="text-3xl font-bold text-gray-900">{totalPoints}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-lg">
                <Trophy className="h-6 w-6 text-yellow-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600 font-medium">+12%</span>
              <span className="text-sm text-gray-500 ml-2">vs last week</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Average Rank</p>
                <p className="text-3xl font-bold text-gray-900">#{averageRank}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-lg">
                <BarChart3 className="h-6 w-6 text-blue-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <ChevronUp className="h-4 w-4 text-green-500 mr-1" />
              <span className="text-sm text-green-600 font-medium">+2 positions</span>
              <span className="text-sm text-gray-500 ml-2">this week</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Best Team</p>
                <p className="text-xl font-bold text-gray-900">
                  {myTeamRankings[0]?.name || 'N/A'}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-lg">
                <Medal className="h-6 w-6 text-green-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-sm text-gray-600">Rank #{myTeamRankings[0]?.rank || 'N/A'}</span>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Active Teams</p>
                <p className="text-3xl font-bold text-gray-900">{myTeams.length}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-lg">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
            </div>
            <div className="mt-4 flex items-center">
              <span className="text-sm text-gray-600">
                {myTeams.reduce((sum, team) => sum + team.member_count, 0)} total members
              </span>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* My Teams Performance */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  My Teams Performance
                </h2>
              </div>
              <div className="p-6">
                {myTeamRankings.length > 0 ? (
                  <div className="space-y-4">
                    {myTeamRankings.map((team, index) => (
                      <div key={team.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors">
                        <div className="flex items-center space-x-4">
                          <div className="relative">
                            <div className={`w-12 h-12 rounded-full flex items-center justify-center border-2 ${getRankColor(team.rank)}`}>
                              <span className="font-bold text-lg">#{team.rank}</span>
                            </div>
                            <div className="absolute -top-1 -right-1">
                              {getRankIcon(team.rank)}
                            </div>
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900">{team.name}</h3>
                            <p className="text-sm text-gray-600">{team.member_count} members</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center space-x-6">
                            <div>
                              <p className="text-2xl font-bold text-gray-900">{team.global_points || team.points_earned || 0}</p>
                              <p className="text-sm text-gray-600">{team.global_points ? 'global points' : 'points'}</p>
                            </div>
                            <div className="flex items-center space-x-2">
                              {index === 0 && team.rank <= 3 && (
                                <div className="flex items-center text-green-600">
                                  <TrendingUp className="h-4 w-4 mr-1" />
                                  <span className="text-sm font-medium">Top Performer</span>
                                </div>
                              )}
                              <button className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-200">
                                <Eye className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 text-lg">No teams assigned yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Global Leaderboard */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                    <Trophy className="h-5 w-5 mr-2" />
                    Global Leaderboard
                  </h2>
                  <div className="flex border border-gray-200 rounded-lg">
                    <button
                      onClick={() => setActiveTab('teams')}
                      className={`px-3 py-1 text-sm font-medium rounded-l-lg transition-colors ${
                        activeTab === 'teams' 
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Teams
                    </button>
                    <button
                      onClick={() => setActiveTab('students')}
                      className={`px-3 py-1 text-sm font-medium rounded-r-lg transition-colors ${
                        activeTab === 'students' 
                          ? 'bg-blue-600 text-white' 
                          : 'text-gray-600 hover:text-gray-900'
                      }`}
                    >
                      Students
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-3">
                  {activeTab === 'teams' ? (
                    leaderboard.teams.slice(0, 10).map((team, index) => {
                      const isMyTeam = myTeams.some(myTeam => myTeam.name === team.name);
                      
                      return (
                        <div 
                          key={team.name} 
                          className={`flex items-center justify-between p-3 rounded-lg transition-colors ${
                            isMyTeam ? 'bg-blue-50 border border-blue-200' : 'hover:bg-gray-50'
                          }`}
                        >
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
                            </div>
                            <div>
                              <p className={`font-medium text-sm ${isMyTeam ? 'text-blue-900' : 'text-gray-900'}`}>
                                {team.name}
                                {isMyTeam && <span className="ml-2 text-xs text-blue-600">(Your Team)</span>}
                              </p>
                              <p className="text-xs text-gray-500">{team.members} members</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-gray-900 text-sm">{team.points}</p>
                            <p className="text-xs text-gray-500">pts</p>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    leaderboard.students.slice(0, 10).map((student, index) => (
                      <div key={student.name} className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <div className="flex items-center space-x-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                            index === 0 ? 'bg-yellow-100 text-yellow-800' :
                            index === 1 ? 'bg-gray-100 text-gray-800' :
                            index === 2 ? 'bg-orange-100 text-orange-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{student.name}</p>
                            <p className="text-xs text-gray-500">{student.student_id}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-gray-900 text-sm">{student.points}</p>
                          <p className="text-xs text-gray-500">pts</p>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Insights */}
        <div className="mt-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Performance Insights
              </h2>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="text-center p-6 bg-green-50 rounded-lg">
                  <TrendingUp className="h-8 w-8 text-green-600 mx-auto mb-3" />
                  <p className="text-2xl font-bold text-green-600 mb-1">
                    {myTeamRankings.filter(team => team.rank <= 10).length}
                  </p>
                  <p className="text-sm text-gray-600">Teams in Top 10</p>
                </div>
                
                <div className="text-center p-6 bg-blue-50 rounded-lg">
                  <Target className="h-8 w-8 text-blue-600 mx-auto mb-3" />
                  <p className="text-2xl font-bold text-blue-600 mb-1">
                    {Math.round((totalPoints / myTeams.length) || 0)}
                  </p>
                  <p className="text-sm text-gray-600">Avg Points per Team</p>
                </div>
                
                <div className="text-center p-6 bg-purple-50 rounded-lg">
                  <Award className="h-8 w-8 text-purple-600 mx-auto mb-3" />
                  <p className="text-2xl font-bold text-purple-600 mb-1">
                    {myTeamRankings.filter(team => team.rank <= 3).length}
                  </p>
                  <p className="text-sm text-gray-600">Podium Finishes</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamManagerPoints; 