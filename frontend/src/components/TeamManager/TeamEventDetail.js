import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { teamManagerAPI } from '../../services/api';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  ArrowLeft,
  Trophy,
  UserPlus,
  UserMinus,
  CheckCircle,
  XCircle,
  AlertCircle,
  Plus,
  Minus
} from 'lucide-react';

const TeamEventDetail = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [eventData, setEventData] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [assigningStudent, setAssigningStudent] = useState(null);
  const [removingAssignment, setRemovingAssignment] = useState(null);

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      setLoading(true);
      
      // Get team data from localStorage
      const teamData = JSON.parse(localStorage.getItem('team_data'));
      if (!teamData) {
        setError('No team data found. Please login again.');
        return;
      }
      
      setSelectedTeam(teamData);
      
      // Fetch event programs and team members
      const response = await teamManagerAPI.getEventPrograms(teamData.id, eventId);
      
      if (response.data) {
        // Handle both paginated and non-paginated responses
        if (response.data.results) {
          // Paginated response - the results contain the full response structure
          const resultData = response.data.results;
          setEventData(resultData.event);
          setPrograms(resultData.programs || []);
          setTeamMembers(resultData.team_members || []);
        } else {
          // Non-paginated response
          setEventData(response.data.event);
          setPrograms(response.data.programs || []);
          setTeamMembers(response.data.team_members || []);
        }
      }
    } catch (err) {
      console.error('Error fetching event data:', err);
      setError('Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignStudent = async (programId, studentId) => {
    try {
      setAssigningStudent({ programId, studentId });
      
      await teamManagerAPI.assignStudentToProgram(
        selectedTeam.id, 
        eventId, 
        programId, 
        studentId
      );
      
      // Refresh data
      await fetchEventData();
      
      // Show success message
      alert('Student assigned successfully!');
    } catch (err) {
      console.error('Error assigning student:', err);
      alert(err.response?.data?.error || 'Failed to assign student');
    } finally {
      setAssigningStudent(null);
    }
  };

  const handleRemoveAssignment = async (assignmentId) => {
    try {
      setRemovingAssignment(assignmentId);
      
      await teamManagerAPI.removeAssignmentById(selectedTeam.id, assignmentId);
      
      // Refresh data
      await fetchEventData();
      
      // Show success message
      alert('Assignment removed successfully!');
    } catch (err) {
      console.error('Error removing assignment:', err);
      alert(err.response?.data?.error || 'Failed to remove assignment');
    } finally {
      setRemovingAssignment(null);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase()) {
      case 'hs': return 'bg-blue-100 text-blue-800';
      case 'hss': return 'bg-purple-100 text-purple-800';
      case 'primary': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading event details...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-4">{error}</p>
          <button 
            onClick={fetchEventData}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!eventData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Event not found</p>
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
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/team-manager/events')}
                className="p-2 bg-white rounded-lg shadow-sm border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{eventData.title}</h1>
                <p className="text-gray-600 mt-1">Event Details & Program Assignments</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(eventData.status)}`}>
                {eventData.status}
              </span>
              {selectedTeam && (
                <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium text-gray-700">{selectedTeam.name}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Event Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Event Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center space-x-3">
              <Calendar className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Date</p>
                <p className="font-medium">{new Date(eventData.start_date).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Clock className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Time</p>
                <p className="font-medium">TBA</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <MapPin className="h-5 w-5 text-gray-400" />
              <div>
                <p className="text-sm text-gray-500">Venue</p>
                <p className="font-medium">{eventData.venue || 'TBA'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Programs Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">Programs & Assignments</h2>
            <div className="text-sm text-gray-500">
              {programs.length} programs available
            </div>
          </div>

          {programs.length > 0 ? (
            <div className="space-y-6">
              {programs.map((program) => (
                <div key={program.id} className="border border-gray-200 rounded-lg p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{program.name}</h3>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(program.category)}`}>
                          {program.category?.toUpperCase()}
                        </span>
                        <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                          {program.program_type}
                        </span>
                      </div>
                      {program.description && (
                        <p className="text-gray-600 text-sm mb-3">{program.description}</p>
                      )}
                      <div className="flex items-center space-x-6 text-sm text-gray-500">
                        <span>Max: {program.max_participants || 'Unlimited'}</span>
                        <span>Per Team: {program.per_team_limit}</span>
                        <span>Available: {program.available_slots}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-blue-600">{program.assigned_count}</div>
                      <div className="text-sm text-gray-500">Assigned</div>
                    </div>
                  </div>

                  {/* Assigned Students */}
                  {program.assigned_students && program.assigned_students.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-2">Assigned Students:</h4>
                      <div className="flex flex-wrap gap-2">
                        {program.assigned_students.map((student) => (
                          <div key={student.id} className="flex items-center space-x-2 bg-green-50 border border-green-200 rounded-lg px-3 py-1">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-sm font-medium text-green-800">{student.name}</span>
                            <button
                              onClick={() => handleRemoveAssignment(student.id)}
                              disabled={removingAssignment === student.id}
                              className="text-red-500 hover:text-red-700 disabled:opacity-50"
                            >
                              <UserMinus className="h-3 w-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Assignment Section */}
                  {program.available_slots > 0 && (
                    <div className="border-t border-gray-200 pt-4">
                      <h4 className="text-sm font-medium text-gray-700 mb-3">Assign Team Members:</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {teamMembers
                          .filter(member => !program.assigned_students?.some(s => s.id === member.id))
                          .map((member) => (
                            <div key={member.id} className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                              <div className="flex-1">
                                <div className="text-sm font-medium text-gray-900">{member.name}</div>
                                <div className="text-xs text-gray-500">{member.student_id}</div>
                              </div>
                              <button
                                onClick={() => handleAssignStudent(program.id, member.id)}
                                disabled={assigningStudent?.programId === program.id && assigningStudent?.studentId === member.id}
                                className="ml-2 p-1 text-blue-600 hover:text-blue-800 disabled:opacity-50"
                              >
                                <UserPlus className="h-4 w-4" />
                              </button>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}

                  {program.available_slots === 0 && (
                    <div className="border-t border-gray-200 pt-4">
                      <div className="flex items-center space-x-2 text-orange-600">
                        <AlertCircle className="h-4 w-4" />
                        <span className="text-sm font-medium">No available slots for this program</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Programs Available</h3>
              <p className="text-gray-500">This event doesn't have any programs yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TeamEventDetail; 