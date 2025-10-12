import React, { useState, useEffect } from 'react';
import { eventPointsAPI, eventProgramsAPI } from '../../services/api';

const EventPoints = ({ event, eventId, onRefresh }) => {
  const [teamPoints, setTeamPoints] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [teamDetails, setTeamDetails] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedStudents, setExpandedStudents] = useState({});

  useEffect(() => {
    fetchData();
    
    // Listen for points updates from mark entry
    const handlePointsUpdate = (event) => {
      console.log('EventPoints: Received pointsUpdated event', event.detail);
      console.log('EventPoints: Current eventId:', eventId, 'Event detail eventId:', event.detail.eventId);
      
      if (event.detail.eventId === parseInt(eventId)) {
        console.log('EventPoints: Refreshing data due to points update');
        setRefreshing(true);
        fetchData().finally(() => {
          setRefreshing(false);
        });
      }
    };
    
    window.addEventListener('pointsUpdated', handlePointsUpdate);
    
    return () => {
      window.removeEventListener('pointsUpdated', handlePointsUpdate);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      console.log('EventPoints: Starting fetchData with eventId:', eventId);
      
      const [pointsRes, programsRes] = await Promise.all([
        eventPointsAPI.getEventTeamPoints(eventId),
        eventProgramsAPI.getPrograms(eventId, 'page_size=100'),
      ]);

      console.log('EventPoints: Raw points response:', pointsRes);
      console.log('EventPoints: Raw programs response:', programsRes);

      // Handle both old and new response structures
      const teamPointsData = pointsRes.data.results || pointsRes.data || [];
      const programsData = programsRes.data.results || programsRes.data || [];
      
      console.log('EventPoints: Processed team points data:', teamPointsData);
      console.log('EventPoints: Processed programs data:', programsData);
      
      setTeamPoints(teamPointsData);
      setPrograms(programsData);
    } catch (error) {
      console.error('EventPoints: Error fetching data:', error);
      console.error('EventPoints: Error details:', error.response?.data);
      console.error('EventPoints: Error status:', error.response?.status);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamDetails = async (teamId) => {
    try {
      const response = await eventPointsAPI.getTeamEventDetails(teamId, eventId);
      setTeamDetails(response.data);
    } catch (error) {
      console.error('Error fetching team details:', error);
    }
  };

  const handleTeamClick = (team) => {
    setSelectedTeam(team);
    fetchTeamDetails(team.team_id);
  };

  const getRankBadge = (rank) => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return `#${rank}`;
  };

  const getPointsColor = (points) => {
    if (points >= 200) return 'text-green-600';
    if (points >= 100) return 'text-blue-600';
    if (points >= 50) return 'text-yellow-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Event Points Overview</h2>
          <p className="text-gray-600 mt-1">Team points earned in {event.title}</p>
          {refreshing && (
            <div className="flex items-center mt-2 text-sm text-blue-600">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              Updating points...
            </div>
          )}
        </div>
        <button
          onClick={() => {
            setRefreshing(true);
            fetchData().finally(() => setRefreshing(false));
          }}
          disabled={refreshing}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          <div className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''} border-2 border-white border-t-transparent rounded-full`}></div>
          {refreshing ? 'Refreshing...' : 'Refresh Points'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Team Leaderboard */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Team Leaderboard</h3>
            <p className="text-sm text-gray-600 mt-1">Points earned in this event only</p>
          </div>

          <div className="p-6">
            {teamPoints.length === 0 ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">🏆</div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">No points recorded yet</h4>
                <p className="text-gray-500">Points will appear here as programs are completed and results are entered.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {teamPoints.map((team, index) => (
                  <div
                    key={team.team_id}
                    onClick={() => handleTeamClick(team)}
                    className={`p-4 rounded-lg border cursor-pointer transition-all hover:shadow-md ${
                      selectedTeam?.team_id === team.team_id 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="text-2xl mr-4">
                          {getRankBadge(index + 1)}
                        </div>
                        <div>
                          <h4 className="font-semibold text-gray-900">{team.team_name}</h4>
                          <p className="text-sm text-gray-500">
                            {team.programs_participated} programs • {team.programs_won} wins
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-2xl font-bold ${getPointsColor(team.total_points)}`}>
                          {team.total_points}
                        </div>
                        <div className="text-sm text-gray-500">points</div>
                      </div>
                    </div>

                    {team.recent_achievements && team.recent_achievements.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <div className="flex flex-wrap gap-2">
                          {team.recent_achievements.slice(0, 3).map((achievement, idx) => (
                            <span
                              key={idx}
                              className={`px-2 py-1 text-xs rounded-full ${
                                achievement.position === 1 ? 'bg-yellow-100 text-yellow-800' :
                                achievement.position === 2 ? 'bg-gray-100 text-gray-800' :
                                achievement.position === 3 ? 'bg-orange-100 text-orange-800' :
                                'bg-blue-100 text-blue-800'
                              }`}
                            >
                              {achievement.program_name} - {
                                achievement.position === 1 ? '1st' :
                                achievement.position === 2 ? '2nd' :
                                achievement.position === 3 ? '3rd' :
                                'Participated'
                              }
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Team Details Panel */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">
              {selectedTeam ? `${selectedTeam.team_name} Details` : 'Team Details'}
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {selectedTeam ? 'Performance breakdown for this event' : 'Select a team to view details'}
            </p>
          </div>

          <div className="p-6">
            {!selectedTeam ? (
              <div className="text-center py-12">
                <div className="text-gray-400 text-6xl mb-4">👆</div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">Select a team</h4>
                <p className="text-gray-500">Click on any team from the leaderboard to view detailed performance.</p>
              </div>
            ) : !teamDetails ? (
              <div className="flex justify-center items-center h-32">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Basic Team Info */}
                <div className="text-center py-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg">
                  <div className="text-4xl mb-4">🏆</div>
                  <h4 className="text-xl font-bold text-gray-900 mb-2">{selectedTeam.team_name}</h4>
                  <div className="text-3xl font-bold text-blue-600 mb-2">{teamDetails.total_points} Points</div>
                  <div className="text-sm text-gray-600">
                    {teamDetails.programs_participated} programs • {teamDetails.programs_won} wins
                  </div>
                </div>

                {/* Points Breakdown */}
                {teamDetails.program_results && teamDetails.program_results.length > 0 && (
                  <div>
                    <h5 className="text-lg font-semibold text-gray-900 mb-4">Points Breakdown</h5>
                    <div className="space-y-3">
                      {teamDetails.program_results.map((result, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <h6 className="font-semibold text-gray-900">{result.program_name}</h6>
                              <p className="text-sm text-gray-600">
                                {result.program_type} • {result.category?.toUpperCase() || 'N/A'}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className="text-lg font-bold text-blue-600">
                                {result.points_earned} pts
                              </div>
                              <div className="text-sm text-gray-500">
                                Position: {result.position || 'N/A'}
                              </div>
                            </div>
                          </div>
                          
                          {/* Student Breakdown */}
                          {result.students && result.students.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-gray-200">
                              <p className="text-sm font-medium text-gray-700 mb-2">Team Members:</p>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {result.students.map((student, studentIndex) => (
                                  <div key={studentIndex} className="flex items-center justify-between bg-white rounded px-3 py-2">
                                    <div>
                                      <p className="text-sm font-medium text-gray-900">{student.student_name}</p>
                                      <p className="text-xs text-gray-500">{student.student_code}</p>
                                    </div>
                                    <div className="text-right">
                                      <div className="text-sm font-medium text-gray-900">
                                        {student.total_marks ? `${student.total_marks.toFixed(2)}` : 'N/A'}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {student.average_marks ? `(${student.average_marks.toFixed(2)} avg)` : ''}
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Achievements */}
                {selectedTeam.recent_achievements && selectedTeam.recent_achievements.length > 0 && (
                  <div>
                    <h5 className="text-lg font-semibold text-gray-900 mb-4">Recent Achievements</h5>
                    <div className="space-y-2">
                      {selectedTeam.recent_achievements.map((achievement, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-50 rounded-lg p-3">
                          <div className="flex items-center">
                            <div className="text-2xl mr-3">
                              {achievement.position === 1 ? '🥇' : 
                               achievement.position === 2 ? '🥈' : 
                               achievement.position === 3 ? '🥉' : '🏅'}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">{achievement.program_name}</p>
                              <p className="text-sm text-gray-600">
                                {achievement.position === 1 ? '1st Place' :
                                 achievement.position === 2 ? '2nd Place' :
                                 achievement.position === 3 ? '3rd Place' : 'Participated'}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-green-600">
                              {achievement.points} pts
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Team Members Summary */}
                {teamDetails.team_members && teamDetails.team_members.length > 0 && (
                  <div>
                    <h5 className="text-lg font-semibold text-gray-900 mb-4">Team Members ({teamDetails.team_members.length})</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {teamDetails.team_members.map((member, index) => (
                        <div key={index} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-gray-900">{member.student_name}</p>
                              <p className="text-sm text-gray-600">{member.student_code}</p>
                              <p className="text-xs text-gray-500">{member.category}</p>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-medium text-gray-900">
                                {member.total_points_earned} pts
                              </div>
                              <div className="text-xs text-gray-500">
                                {member.programs_participated} programs
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventPoints; 