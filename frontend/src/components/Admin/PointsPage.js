import React, { useState, useEffect } from 'react';
import { pointsAPI, studentsAPI, teamsAPI } from '../../services/api';

const PointsPage = () => {
  const [activeTab, setActiveTab] = useState('leaderboard');
  const [leaderboard, setLeaderboard] = useState({ teams: [], students: [] });
  const [pointsRecords, setPointsRecords] = useState([]);
  const [students, setStudents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAwardModal, setShowAwardModal] = useState(false);
  const [showGlobalPointsModal, setShowGlobalPointsModal] = useState(false);
  const [showEventBreakdownModal, setShowEventBreakdownModal] = useState(false);
  const [selectedTeamBreakdown, setSelectedTeamBreakdown] = useState(null);
  const [showStudentDetailsModal, setShowStudentDetailsModal] = useState(false);
  const [selectedStudentDetails, setSelectedStudentDetails] = useState(null);
  const [showTeamDetailsModal, setShowTeamDetailsModal] = useState(false);
  const [selectedTeamDetails, setSelectedTeamDetails] = useState(null);
  const [globalPointsData, setGlobalPointsData] = useState(null);
  const [recalculatingPoints, setRecalculatingPoints] = useState(false);
  const [awardForm, setAwardForm] = useState({
    recipientType: 'team',
    recipientId: '',
    points: '',
    reason: '',
    description: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [leaderboardRes, recordsRes, studentsRes, teamsRes] = await Promise.all([
        pointsAPI.getLeaderboard(),
        pointsAPI.getPointsRecords(),
        studentsAPI.getStudents(),
        teamsAPI.getTeams(),
      ]);

      setLeaderboard(leaderboardRes.data);
      setPointsRecords(recordsRes.data.results || recordsRes.data);
      setStudents(studentsRes.data.results || studentsRes.data);
      setTeams(teamsRes.data.results || teamsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCalculateGlobalPoints = async () => {
    try {
      setLoading(true);
      const response = await pointsAPI.calculateGlobalPoints();
      setGlobalPointsData(response.data);
      setShowGlobalPointsModal(true);
    } catch (error) {
      console.error('Error calculating global points:', error);
      alert('Error calculating global points. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRecalculateGlobalPoints = async () => {
    if (!window.confirm('Are you sure you want to recalculate and update global points? This will replace the current point totals.')) {
      return;
    }

    try {
      setRecalculatingPoints(true);
      const response = await pointsAPI.recalculateGlobalPoints();
      alert(`Global points recalculated successfully!\nTeams updated: ${response.data.teams_updated}\nStudents updated: ${response.data.students_updated}`);
      fetchData(); // Refresh the data
    } catch (error) {
      console.error('Error recalculating global points:', error);
      alert('Error recalculating global points. Please try again.');
    } finally {
      setRecalculatingPoints(false);
    }
  };

  const handleAwardPoints = async (e) => {
    e.preventDefault();
    try {
      await pointsAPI.awardManualPoints({
        team: awardForm.recipientType === 'team' ? awardForm.recipientId : null,
        student: awardForm.recipientType === 'student' ? awardForm.recipientId : null,
        points: parseInt(awardForm.points),
        reason: awardForm.reason,
        description: awardForm.description,
      });

      setShowAwardModal(false);
      resetAwardForm();
      fetchData();
      alert('Points awarded successfully!');
    } catch (error) {
      console.error('Error awarding points:', error);
      alert('Error awarding points. Please try again.');
    }
  };

  const resetAwardForm = () => {
    setAwardForm({
      recipientType: 'team',
      recipientId: '',
      points: '',
      reason: '',
      description: '',
    });
  };

  const handleTeamPointsClick = async (team) => {
    setSelectedTeamBreakdown(team);
    setShowEventBreakdownModal(true);
    
    try {
      console.log('Team object for breakdown:', team);
      console.log('Available teams:', teams);
      
      // Simple approach: use the first team that matches the name
      const matchingTeam = teams.find(t => t.name === team.name);
      
      if (!matchingTeam) {
        throw new Error(`Team "${team.name}" not found in teams list`);
      }
      
      console.log('Found matching team:', matchingTeam);
      
      const response = await teamsAPI.getComprehensiveDetails(matchingTeam.id);
      console.log('Team details response:', response.data);
      setSelectedTeamBreakdown(prev => ({ ...prev, details: response.data }));
      
    } catch (error) {
      console.error('Error fetching team points breakdown:', error);
      
      // Show a more user-friendly error message
      let errorMessage = 'Failed to load team details. ';
      
      if (error.message.includes('not found')) {
        errorMessage += 'Team not found in database.';
      } else if (error.message.includes('Network Error')) {
        errorMessage += 'Please check if the server is running.';
      } else if (error.response?.status === 404) {
        errorMessage += 'Team details not found.';
      } else if (error.response?.status === 401) {
        errorMessage += 'Please log in again.';
      } else {
        errorMessage += error.message;
      }
      
      alert(errorMessage);
      setShowEventBreakdownModal(false);
    }
  };

  const handleTeamClick = async (team) => {
    try {
      const response = await teamsAPI.getComprehensiveDetails(team.id);
      setSelectedTeamDetails(response.data);
      setShowTeamDetailsModal(true);
    } catch (error) {
      console.error('Error fetching team details:', error);
      alert('Failed to load team details');
    }
  };

  const handleStudentClick = async (student) => {
    try {
      const response = await pointsAPI.getStudentDetails(student.id);
      setSelectedStudentDetails(response.data);
      setShowStudentDetailsModal(true);
    } catch (error) {
      console.error('Error fetching student details:', error);
      alert('Failed to load student details');
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPointTypeColor = (pointType) => {
    const colors = {
      event_winner: 'bg-yellow-100 text-yellow-800',
      event_runner_up: 'bg-gray-100 text-gray-800',
      event_participation: 'bg-blue-100 text-blue-800',
      manual_bonus: 'bg-green-100 text-green-800',
      manual_penalty: 'bg-red-100 text-red-800',
      achievement: 'bg-purple-100 text-purple-800',
    };
    return colors[pointType] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Global Points Management</h1>
          <p className="text-gray-600 mt-1">Manage global points calculated from event performance percentages</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowAwardModal(true)}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Award Manual Points
          </button>
        </div>
      </div>

      {/* Global Points Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mr-3">
            <span className="text-white text-lg">ℹ️</span>
          </div>
          <div>
            <h3 className="font-semibold text-blue-900 mb-2">Global Points Calculation Logic</h3>
            <p className="text-blue-800 text-sm mb-2">
              Global points are calculated based on each team's/student's performance percentage in individual events:
            </p>
            <ul className="text-blue-800 text-sm space-y-1 ml-4">
              <li>• For each event, total all points earned by all teams/students</li>
              <li>• Calculate each team's/student's percentage of that total</li>
              <li>• Sum up percentages across all events to get global points</li>
              <li>• Example: Team gets 100 points out of 370 total = 27.03% for that event</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            {[
              { id: 'leaderboard', name: 'Global Leaderboard', icon: '🏆' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-6 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="mr-2">{tab.icon}</span>
                {tab.name}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Team Leaderboard */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2">🏆</span>
                Team Global Leaderboard
              </h2>
              <p className="text-gray-600 text-sm mt-1">Based on percentage performance across all events</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {leaderboard.teams.map((team, index) => (
                  <div
                    key={team.name}
                    onClick={() => handleTeamClick(team)}
                    className={`flex items-center justify-between p-4 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors ${
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 border-2 border-yellow-200 hover:from-yellow-100 hover:to-yellow-200'
                        : index === 1
                        ? 'bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-200 hover:from-gray-100 hover:to-gray-200'
                        : index === 2
                        ? 'bg-gradient-to-r from-orange-50 to-orange-100 border-2 border-orange-200 hover:from-orange-100 hover:to-orange-200'
                        : 'bg-gray-50'
                    }`}
                    title="Click to view comprehensive team details"
                  >
                    <div className="flex items-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0
                          ? 'bg-yellow-500 text-white'
                          : index === 1
                          ? 'bg-gray-500 text-white'
                          : index === 2
                          ? 'bg-orange-500 text-white'
                          : 'bg-blue-500 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="ml-3">
                        <h3 className="font-semibold text-gray-900">{team.name}</h3>
                        <p className="text-sm text-gray-500">
                          {team.members} members • {team.events_participated} events
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTeamPointsClick(team);
                        }}
                        className="text-2xl font-bold text-blue-600 hover:text-blue-800 transition-colors hover:scale-105 transform duration-200 cursor-pointer"
                        title="Click to see points breakdown by events"
                      >
                        {team.points}% 🔍
                      </button>
                      <div className="text-xs text-gray-500">global points</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Student Leaderboard */}
          <div className="bg-white rounded-lg shadow-md">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900 flex items-center">
                <span className="mr-2">⭐</span>
                Top Students Global Leaderboard
              </h2>
              <p className="text-gray-600 text-sm mt-1">Individual program performance across all events (team programs excluded)</p>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                {leaderboard.students.slice(0, 10).map((student, index) => (
                  <div
                    key={student.student_id}
                    onClick={() => handleStudentClick(student)}
                    className={`flex items-center justify-between p-3 rounded-lg cursor-pointer hover:bg-gray-100 transition-colors ${
                      index === 0
                        ? 'bg-gradient-to-r from-yellow-50 to-yellow-100 hover:from-yellow-100 hover:to-yellow-200'
                        : index === 1
                        ? 'bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200'
                        : index === 2
                        ? 'bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200'
                        : 'bg-gray-50'
                    }`}
                    title="Click to view detailed performance breakdown"
                  >
                    <div className="flex items-center">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                        index === 0
                          ? 'bg-yellow-500 text-white'
                          : index === 1
                          ? 'bg-gray-500 text-white'
                          : index === 2
                          ? 'bg-orange-500 text-white'
                          : 'bg-blue-500 text-white'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="ml-3">
                        <h3 className="font-medium text-gray-900">{student.name}</h3>
                        <p className="text-xs text-gray-500">
                          {student.student_id} • {student.category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <button className="text-lg font-bold text-blue-600 hover:text-blue-800 transition-colors">
                        {student.points}%
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}



      {/* Global Points Calculation Modal */}
      {showGlobalPointsModal && globalPointsData && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Global Points Calculation Preview</h2>
              <button
                onClick={() => setShowGlobalPointsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Teams Preview */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Teams Global Points</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {globalPointsData.teams
                    .sort((a, b) => b.global_points - a.global_points)
                    .map((team, index) => (
                    <div key={team.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{team.name}</span>
                        <span className="text-sm text-gray-500 ml-2">({team.events_participated} events)</span>
                      </div>
                      <span className="font-bold text-blue-600">{team.global_points}%</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Students Preview */}
              <div>
                <h3 className="text-lg font-semibold mb-3">Students Global Points</h3>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {globalPointsData.students
                    .sort((a, b) => b.global_points - a.global_points)
                    .slice(0, 10)
                    .map((student, index) => (
                    <div key={student.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                      <div>
                        <span className="font-medium">{student.name}</span>
                        <span className="text-sm text-gray-500 ml-2">({student.events_participated} events)</span>
                      </div>
                      <span className="font-bold text-blue-600">{student.global_points}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setShowGlobalPointsModal(false)}
                className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowGlobalPointsModal(false);
                  handleRecalculateGlobalPoints();
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Apply These Points
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Award Points Modal */}
      {showAwardModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Award Manual Points</h2>
              <button
                onClick={() => {setShowAwardModal(false); resetAwardForm();}}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAwardPoints} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Recipient Type</label>
                <select
                  value={awardForm.recipientType}
                  onChange={(e) => setAwardForm({...awardForm, recipientType: e.target.value, recipientId: ''})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="team">Team</option>
                  <option value="student">Student</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {awardForm.recipientType === 'team' ? 'Select Team' : 'Select Student'}
                </label>
                <select
                  required
                  value={awardForm.recipientId}
                  onChange={(e) => setAwardForm({...awardForm, recipientId: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose {awardForm.recipientType}</option>
                  {awardForm.recipientType === 'team'
                    ? teams.map((team) => (
                        <option key={team.id} value={team.id}>
                          {team.name}
                        </option>
                      ))
                    : students.map((student) => {
                        // Use proper name resolution instead of display_name
                        const studentName = student.get_full_name ? student.get_full_name() : 
                          `${student.first_name || ''} ${student.last_name || ''}`.trim() || 
                          student.name || 
                          `Student ${student.student_id}` || 
                          'Unknown Student';
                        
                        return (
                          <option key={student.id} value={student.id}>
                            {studentName} ({student.student_id})
                          </option>
                        );
                      })
                  }
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Points</label>
                <input
                  type="number"
                  required
                  value={awardForm.points}
                  onChange={(e) => setAwardForm({...awardForm, points: e.target.value})}
                  placeholder="Enter points (positive or negative)"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Use negative numbers for penalties</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
                <input
                  type="text"
                  required
                  value={awardForm.reason}
                  onChange={(e) => setAwardForm({...awardForm, reason: e.target.value})}
                  placeholder="e.g., Bonus for exceptional performance"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description (Optional)</label>
                <textarea
                  value={awardForm.description}
                  onChange={(e) => setAwardForm({...awardForm, description: e.target.value})}
                  placeholder="Additional details..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => {setShowAwardModal(false); resetAwardForm();}}
                  className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Award Points
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

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
                    <h3 className="font-semibold text-blue-900">Total Global Points: {selectedTeamBreakdown.points}%</h3>
                    <p className="text-blue-700 text-sm">
                      Participated in {selectedTeamBreakdown.events_participated} events
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-blue-600">Members: {selectedTeamBreakdown.members}</p>
                  </div>
                </div>
              </div>
            </div>

            {selectedTeamBreakdown.event_breakdown && selectedTeamBreakdown.event_breakdown.length > 0 ? (
              <div>
                <h3 className="text-lg font-semibold mb-3">Event Contributions</h3>
                <div className="space-y-3">
                  {selectedTeamBreakdown.event_breakdown.map((event, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium text-gray-900">{event.event_name}</h4>
                        <span className="text-sm text-gray-500">
                          {event.event_points} / {event.total_event_points} points
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${(event.event_points / event.total_event_points) * 100}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-blue-600 text-lg">
                          {event.percentage.toFixed(2)}%
                        </span>
                      </div>
                      <div className="mt-2 text-sm text-gray-600">
                        <span className="font-medium">Calculation:</span> {event.event_points} ÷ {event.total_event_points} × 100 = {event.percentage.toFixed(2)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-400 text-6xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Event Data Available</h3>
                <p className="text-gray-500">
                  This team hasn't participated in any events with results yet.
                </p>
              </div>
            )}

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

      {/* Student Details Modal */}
      {showStudentDetailsModal && selectedStudentDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-6xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Student Performance Breakdown</h2>
              <button
                onClick={() => setShowStudentDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Student Info Header */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mr-4">
                    {selectedStudentDetails.student_name?.charAt(0) || 'S'}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedStudentDetails.student_name}</h3>
                    <p className="text-gray-600">
                      {selectedStudentDetails.student_code} • {selectedStudentDetails.category} • 
                      Grade {selectedStudentDetails.grade}{selectedStudentDetails.section ? ` • Section ${selectedStudentDetails.section}` : ''}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{selectedStudentDetails.total_points}</div>
                  <div className="text-sm text-blue-600">Total Points</div>
                </div>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600">{selectedStudentDetails.events_participated}</div>
                <div className="text-sm text-green-800">Events Participated</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="text-2xl font-bold text-purple-600">{selectedStudentDetails.programs_participated}</div>
                <div className="text-sm text-purple-800">Programs Participated</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">{selectedStudentDetails.programs_won}</div>
                <div className="text-sm text-yellow-800">Programs Won</div>
              </div>
              <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                <div className="text-2xl font-bold text-indigo-600">{Math.round(selectedStudentDetails.win_rate || 0)}%</div>
                <div className="text-sm text-indigo-800">Win Rate</div>
              </div>
            </div>

            {/* Team Memberships */}
            {selectedStudentDetails.team_memberships && selectedStudentDetails.team_memberships.length > 0 && (
              <div className="mb-6">
                <h4 className="text-lg font-semibold text-gray-900 mb-3">Team Memberships</h4>
                <div className="space-y-2">
                  {selectedStudentDetails.team_memberships.map((team) => (
                    <div key={team.team_id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                      <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3">
                        {team.team_name?.charAt(0) || 'T'}
                      </div>
                      <div>
                        <div className="font-medium text-gray-900">{team.team_name}</div>
                        <div className="text-sm text-gray-500">Team Member</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Event Performance Breakdown */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-3">Event Performance Breakdown (Individual Programs Only)</h4>
              {selectedStudentDetails.event_breakdown && selectedStudentDetails.event_breakdown.length > 0 ? (
                <div className="space-y-4">
                  {selectedStudentDetails.event_breakdown.map((event) => (
                    <div key={event.event_id} className="border border-gray-200 rounded-lg p-4">
                      {/* Event Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 text-lg">{event.event_name}</h5>
                          <p className="text-sm text-gray-500 mt-1">
                            {event.event_type?.toUpperCase()} • {event.programs_participated} individual programs • {event.programs_won} wins
                          </p>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-bold text-gray-900 text-lg">+{event.total_points}</div>
                          <div className="text-sm text-gray-500">event points</div>
                        </div>
                      </div>

                      {/* Program Results */}
                      {event.programs && event.programs.length > 0 && (
                        <div className="space-y-2">
                          {event.programs.map((result) => (
                            <div key={result.program_id} className="p-3 bg-gray-50 rounded-lg">
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <div className="flex items-center">
                                    <div className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs font-medium mr-2">
                                      {result.position || 'N/A'}
                                    </div>
                                    <div>
                                      <div className="font-medium text-gray-900">{result.program_name}</div>
                                      <div className="text-xs text-gray-500">
                                        {result.category?.toUpperCase()} • Individual • 
                                        Chest #{result.chest_number || 'N/A'}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="text-right">
                                  <div className="font-bold text-green-700">+{result.points_earned}</div>
                                  <div className="text-xs text-gray-500">points</div>
                                  
                                  {/* Individual Marks */}
                                  {result.total_marks && (
                                    <div className="text-xs text-gray-600 mt-1">
                                      <div className="flex space-x-2">
                                        {result.judge1_marks && (
                                          <span>J1: {result.judge1_marks}</span>
                                        )}
                                        {result.judge2_marks && (
                                          <span>J2: {result.judge2_marks}</span>
                                        )}
                                        {result.judge3_marks && (
                                          <span>J3: {result.judge3_marks}</span>
                                        )}
                                      </div>
                                      <div className="font-medium text-gray-700">
                                        Total: {result.total_marks} | Avg: {result.average_marks}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-2">📋</div>
                  <p className="text-gray-500">No individual program participation data available</p>
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowStudentDetailsModal(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Team Points Breakdown Modal */}
      {showEventBreakdownModal && selectedTeamBreakdown && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Points Breakdown - {selectedTeamBreakdown.name}</h2>
              <button
                onClick={() => setShowEventBreakdownModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Team Summary */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div 
                  className="flex items-center cursor-pointer hover:bg-blue-100 p-2 rounded-lg transition-colors"
                  onClick={() => handleTeamClick(selectedTeamBreakdown)}
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-full flex items-center justify-center text-white text-lg font-bold mr-3">
                    {selectedTeamBreakdown.name?.charAt(0) || 'T'}
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 hover:text-blue-700">{selectedTeamBreakdown.name}</h3>
                    <p className="text-gray-600">
                      {selectedTeamBreakdown.members} members • {selectedTeamBreakdown.events_participated} events participated
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{selectedTeamBreakdown.points}%</div>
                  <div className="text-sm text-blue-600">Global Points</div>
                </div>
              </div>
            </div>

            {/* Points Breakdown Content */}
            {selectedTeamBreakdown.details ? (
              <div>
                {/* Simple Event Breakdown */}
                <div className="mb-6">
                  <h4 className="text-lg font-semibold text-gray-900 mb-4">Points from Events</h4>
                  {selectedTeamBreakdown.details.event_breakdown && selectedTeamBreakdown.details.event_breakdown.length > 0 ? (
                    <div className="space-y-3">
                      {selectedTeamBreakdown.details.event_breakdown.map((event) => {
                        // Calculate percentage contribution to global points
                        const percentageContribution = selectedTeamBreakdown.details.total_points > 0 
                          ? ((event.total_points / selectedTeamBreakdown.details.total_points) * 100).toFixed(1)
                          : 0;
                        
                        // Calculate event percentage (team points vs total event points)
                        const eventPercentage = event.total_event_points > 0 
                          ? ((event.total_points / event.total_event_points) * 100).toFixed(2)
                          : 0;
                        
                        return (
                          <div key={event.event_id} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                            {/* Event Header */}
                            <div className="flex justify-between items-start mb-3">
                              <div className="flex items-center">
                                <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
                                  <span className="text-blue-600 font-semibold text-sm">
                                    {event.event_name?.charAt(0) || 'E'}
                                  </span>
                                </div>
                                <div>
                                  <h5 className="font-medium text-gray-900">{event.event_name}</h5>
                                  <p className="text-sm text-gray-500">
                                    {event.programs_participated} programs • {event.programs_won} wins
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            {/* Global Points Calculation Breakdown */}
                            <div className="bg-white rounded-lg p-3 border border-gray-200">
                              <div className="grid grid-cols-2 gap-4">
                                {/* Team Performance in Event */}
                                <div className="text-center">
                                  <div className="text-lg font-bold text-green-600">+{event.total_points}</div>
                                  <div className="text-sm text-gray-600">Team Points</div>
                                  <div className="text-xs text-gray-500">
                                    out of {event.total_event_points || 'N/A'} total event points
                                  </div>
                                </div>
                                
                                {/* Event Percentage */}
                                <div className="text-center">
                                  <div className="text-lg font-bold text-blue-600">{eventPercentage}%</div>
                                  <div className="text-sm text-gray-600">Event Performance</div>
                                  <div className="text-xs text-gray-500">
                                    {event.total_points} ÷ {event.total_event_points || 'N/A'} × 100
                                  </div>
                                </div>
                              </div>
                              
                              {/* Global Points Contribution */}
                              <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                                <div className="text-sm font-medium text-gray-700">
                                  Contributes {percentageContribution}% to Global Points
                                </div>
                                <div className="text-xs text-gray-500">
                                  ({eventPercentage}% event performance added to global total)
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <div className="text-gray-400 text-4xl mb-2">📊</div>
                      <p className="text-gray-500">No event participation data available</p>
                    </div>
                  )}
                </div>

                {/* Global Points Calculation Explanation */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-4 mb-6">
                  <div className="mb-3">
                    <h4 className="font-semibold text-gray-900 mb-2">🏆 Global Points Calculation</h4>
                    <p className="text-sm text-gray-600">
                      Global points are calculated based on each team's performance percentage in individual events:
                    </p>
                    <ul className="text-xs text-gray-600 mt-2 space-y-1">
                      <li>• For each event, total all points earned by all teams</li>
                      <li>• Calculate each team's percentage of that total</li>
                      <li>• Sum up percentages across all events to get global points</li>
                      <li>• Example: Team gets 100 points out of 370 total = 27.03% for that event</li>
                    </ul>
                  </div>
                </div>

                {/* Total Summary */}
                <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h4 className="font-semibold text-gray-900">Total Points Earned</h4>
                      <p className="text-sm text-gray-600">From all events combined</p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-green-600">{selectedTeamBreakdown.details.total_points}</div>
                      <div className="text-sm text-green-600">total points</div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowEventBreakdownModal(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <div>
                {/* Fallback: Show basic team info */}
                <div className="text-center py-8">
                  <div className="text-gray-400 text-4xl mb-4">🏆</div>
                  <h4 className="font-semibold text-gray-900 mb-2">{selectedTeamBreakdown.name}</h4>
                  <p className="text-gray-600 mb-4">
                    Global Points: {selectedTeamBreakdown.points}%
                  </p>
                  <p className="text-sm text-gray-500">
                    {selectedTeamBreakdown.members} members • {selectedTeamBreakdown.events_participated} events
                  </p>
                </div>
                
                <div className="flex justify-end space-x-3">
                  <button
                    onClick={() => setShowEventBreakdownModal(false)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Team Summary Modal */}
      {showTeamDetailsModal && selectedTeamDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-screen overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Team Summary</h2>
              <button
                onClick={() => setShowTeamDetailsModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Team Header */}
            <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-6 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-16 h-16 bg-blue-500 rounded-full flex items-center justify-center text-white text-2xl font-bold mr-4">
                    {selectedTeamDetails.team_name?.charAt(0) || 'T'}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">{selectedTeamDetails.team_name}</h3>
                    <p className="text-gray-600">{selectedTeamDetails.description || 'No description'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-blue-600">{selectedTeamDetails.total_points}</div>
                  <div className="text-sm text-blue-600">Total Points</div>
                </div>
              </div>
            </div>

            {/* Key Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <div className="text-2xl font-bold text-blue-600">{selectedTeamDetails.events_participated}</div>
                <div className="text-sm text-blue-800">Events</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                <div className="text-2xl font-bold text-green-600">{selectedTeamDetails.programs_participated}</div>
                <div className="text-sm text-green-800">Programs</div>
              </div>
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <div className="text-2xl font-bold text-yellow-600">{selectedTeamDetails.programs_won}</div>
                <div className="text-sm text-yellow-800">Wins</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                <div className="text-2xl font-bold text-purple-600">{selectedTeamDetails.total_members}</div>
                <div className="text-sm text-purple-800">Members</div>
              </div>
            </div>

            {/* Team Members */}
            <div className="mb-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedTeamDetails.team_members && selectedTeamDetails.team_members.map((member) => (
                  <div key={member.student_id} className="p-4 bg-gray-50 rounded-lg border">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center">
                        <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium mr-3">
                          {member.student_name?.charAt(0) || 'S'}
                        </div>
                        <div>
                          <div className="font-medium text-gray-900">{member.student_name}</div>
                          <div className="text-sm text-gray-500">
                            {member.student_code} • {member.category} • Grade {member.grade}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-blue-700 text-lg">+{member.total_points_earned}</div>
                        <div className="text-sm text-blue-600">{member.programs_participated} programs</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Event Summary */}
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Event Performance</h4>
              {selectedTeamDetails.event_breakdown && selectedTeamDetails.event_breakdown.length > 0 ? (
                <div className="space-y-4">
                  {selectedTeamDetails.event_breakdown.map((event) => (
                    <div key={event.event_id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex justify-between items-center">
                        <div>
                          <h5 className="font-medium text-gray-900">{event.event_name}</h5>
                          <p className="text-sm text-gray-500">
                            {event.programs_participated} programs • {event.programs_won} wins
                          </p>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-gray-900 text-lg">+{event.total_points}</div>
                          <div className="text-sm text-gray-500">points</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  No event participation data
                </div>
              )}
            </div>

            <div className="flex justify-end mt-6">
              <button
                onClick={() => setShowTeamDetailsModal(false)}
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

export default PointsPage; 