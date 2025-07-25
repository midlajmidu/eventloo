import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { teamManagerAPI } from '../../services/api';
import { 
  ArrowLeft, 
  Users, 
  UserPlus, 
  UserMinus, 
  Filter,
  Search,
  CheckCircle,
  XCircle,
  BookOpen,
  Target
} from 'lucide-react';

const ProgramAssignmentPage = () => {
  const { eventId, programId } = useParams();
  const navigate = useNavigate();
  
  // State management
  const [program, setProgram] = useState(null);
  const [event, setEvent] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  
  // Success/error messages
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  useEffect(() => {
    loadProgramData();
  }, [eventId, programId]);

  const loadProgramData = async () => {
    if (!eventId || !programId) return;
    
    setLoading(true);
    try {
      // Get team data from localStorage
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;
      
      if (!teamId) {
        setMessage('No team data found. Please login again.');
        setMessageType('error');
        return;
      }

      // Load program details and team members
      const response = await teamManagerAPI.getEventPrograms(teamId, eventId);
      
      // Handle both paginated and non-paginated responses
      let programsData = [];
      let teamMembersData = [];
      let eventData = null;
      
      if (response.data?.results) {
        // Paginated response - the results contain the full response structure
        const resultData = response.data.results;
        programsData = resultData.programs || [];
        teamMembersData = resultData.team_members || [];
        eventData = resultData.event;
      } else {
        // Non-paginated response
        programsData = response.data.programs || [];
        teamMembersData = response.data.team_members || [];
        eventData = response.data.event;
      }
      
      // Find the specific program
      const programData = programsData.find(p => p.id === parseInt(programId));
      if (!programData) {
        setMessage('Program not found');
        setMessageType('error');
        return;
      }
      
      setProgram(programData);
      setEvent(eventData);
      setTeamMembers(teamMembersData);
      setAssignedStudents(programData.assigned_students || []);
      
      // Set category filter based on program category
      if (programData.category) {
        setCategoryFilter(programData.category);
      }
      
    } catch (err) {
      console.error('Error loading program data:', err);
      setMessage('Failed to load program data');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const assignStudent = async (studentId) => {
    if (!program || !event) return;
    
    setAssigning(true);
    try {
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;
      
      await teamManagerAPI.assignStudentToProgram(teamId, event.id, program.id, studentId);
      
      // Refresh data
      await loadProgramData();
      
      setMessage('Student assigned successfully!');
      setMessageType('success');
      
      // Clear message after 3 seconds
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
      
    } catch (err) {
      console.error('Error assigning student:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to assign student';
      setMessage(errorMessage);
      setMessageType('error');
      
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    } finally {
      setAssigning(false);
    }
  };

  const removeStudent = async (studentId) => {
    if (!program || !event) return;
    
    setRemoving(true);
    try {
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;
      
      await teamManagerAPI.removeStudentFromProgram(teamId, event.id, program.id, studentId);
      
      // Refresh data
      await loadProgramData();
      
      setMessage('Student removed successfully!');
      setMessageType('success');
      
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
      
    } catch (err) {
      console.error('Error removing student:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to remove student';
      setMessage(errorMessage);
      setMessageType('error');
      
      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    } finally {
      setRemoving(false);
    }
  };

  const getFilteredStudents = () => {
    let filtered = teamMembers;

    // For category-specific programs, always filter by program category
            if (program?.category && program.category !== 'general') {
      filtered = filtered.filter(student => student.category === program.category);
    }

          // For 'general' programs, apply the UI filter if not 'all'
            if (program?.category === 'general' && categoryFilter !== 'all') {
      filtered = filtered.filter(student => student.category === categoryFilter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_id.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by assignment status
    if (showAssignedOnly) {
      filtered = filtered.filter(student => 
        assignedStudents.some(assigned => assigned.id === student.id)
      );
    } else {
      // For available students, exclude already assigned students
      filtered = filtered.filter(student => 
        !assignedStudents.some(assigned => assigned.id === student.id)
      );
    }

    return filtered;
  };

  const isStudentAssigned = (studentId) => {
    return assignedStudents.some(student => student.id === studentId);
  };

  const canAssignMore = () => {
    if (!program) return false;
    // For individual programs, max_participants represents participants per team
    // For team-based programs, use max_participants_per_team or max_participants
    const limit = program.is_team_based ? 
      (program.max_participants_per_team || program.max_participants) : 
      program.max_participants;
    return assignedStudents.length < limit;
  };

  const getCategoryDisplay = (category) => {
    const categories = {
      'hs': 'High School',
      'hss': 'HSS',
      'primary': 'Primary',
      'general': 'General'
    };
    return categories[category] || category;
  };

  const getCategoryColor = (category) => {
    const colors = {
      'hs': 'bg-blue-100 text-blue-800 border-blue-200',
      'hss': 'bg-green-100 text-green-800 border-green-200',
      'primary': 'bg-yellow-100 text-yellow-800 border-yellow-200',
      'general': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return colors[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading program details...</p>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg mb-4">Program not found</p>
          <button 
            onClick={() => navigate(-1)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const filteredStudents = getFilteredStudents();

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => {
                  // Check if we're in team login dashboard or team manager dashboard
                  const currentPath = window.location.pathname;
                  if (currentPath.includes('/team-manager/dashboard/')) {
                    // Team login dashboard - go back to team login dashboard with event selected
                    navigate(`/team-manager/dashboard?event=${eventId}`);
                  } else {
                    // Team manager dashboard - go back to event programs
                    navigate(`/team-manager/events/${eventId}`);
                  }
                }}
                className="flex items-center space-x-2 px-4 py-2 bg-white text-gray-700 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200"
              >
                <ArrowLeft className="h-4 w-4" />
                <span>Back to Programs</span>
              </button>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">{program.name}</h1>
                <p className="text-gray-600">Student Assignment</p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-blue-500" />
                  <span className="text-sm font-medium text-gray-700">
                    {assignedStudents.length} Assigned
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Success/Error Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            messageType === 'success' 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <div className="flex items-center">
              {messageType === 'success' ? (
                <CheckCircle className="h-5 w-5 mr-2" />
              ) : (
                <XCircle className="h-5 w-5 mr-2" />
              )}
              {message}
            </div>
          </div>
        )}

        {/* Program Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Program Details</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Category:</span> {getCategoryDisplay(program.category)}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Type:</span> {program.is_team_based ? 'Team' : 'Individual'}
                  </p>
                  {program.venue && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Venue:</span> {program.venue}
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Assignment Limits</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">
                      {program.is_team_based ? 'Per Team Limit:' : 'Participants per Team:'}
                    </span> {program.is_team_based ? 
                      (program.max_participants_per_team || program.max_participants) : 
                      program.max_participants
                    }
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Currently Assigned:</span> {assignedStudents.length}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Available Slots:</span> {
                      (program.is_team_based ? 
                        (program.max_participants_per_team || program.max_participants) : 
                        program.max_participants
                      ) - assignedStudents.length
                    }
                  </p>
                  {program.limit_description && (
                    <p className="text-sm text-blue-600 font-medium">
                      {program.limit_description}
                    </p>
                  )}
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Team Members</h3>
                <div className="space-y-2">
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Total Members:</span> {teamMembers.length}
                  </p>
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Eligible:</span> {filteredStudents.length}
                  </p>
                </div>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Status</h3>
                <div className="space-y-2">
                  <span className={`inline-flex px-3 py-1 text-sm font-medium rounded-full border ${getCategoryColor(program.category)}`}>
                    {program.category?.toUpperCase()}
                  </span>
                  {canAssignMore() ? (
                    <p className="text-sm text-green-600 font-medium">✓ Can assign more students</p>
                  ) : (
                    <p className="text-sm text-red-600 font-medium">✗ Team limit reached</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Filter className="h-5 w-5 mr-2" />
                Filters & Search
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search Students</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search by name or ID..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Class/Category</label>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  <option value="hs">High School</option>
                  <option value="hss">HSS</option>
                  <option value="primary">Primary</option>
                </select>
              </div>
              
              {/* Assignment Status Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Show</label>
                <select
                  value={showAssignedOnly ? 'assigned' : 'available'}
                  onChange={(e) => setShowAssignedOnly(e.target.value === 'assigned')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="available">Available Students</option>
                  <option value="assigned">Assigned Only</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Currently Assigned Students */}
        {assignedStudents.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <CheckCircle className="h-5 w-5 mr-2 text-green-500" />
                Currently Assigned Students ({assignedStudents.length})
              </h2>
              <p className="text-sm text-gray-600 mt-1">These students are already assigned to this program</p>
            </div>
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {assignedStudents.map((student) => (
                  <div key={student.id} className="border border-green-200 rounded-lg p-6 bg-green-50">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900">{student.name}</h3>
                        <p className="text-sm text-gray-600">ID: {student.student_id}</p>
                        {student.chest_number && (
                          <p className="text-sm text-blue-600 font-medium">Chest #: {student.chest_number}</p>
                        )}
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border mt-2 ${getCategoryColor(student.category)}`}>
                          {getCategoryDisplay(student.category)}
                        </span>
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                          <span className="text-sm text-green-600 font-medium">Assigned</span>
                          <button
                            onClick={() => removeStudent(student.id)}
                            disabled={removing}
                            className="flex items-center space-x-1 px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-red-200 transition-colors disabled:opacity-50"
                          >
                            <UserMinus className="h-4 w-4" />
                            <span>Remove</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    
                    {student.assigned_at && (
                      <div className="text-xs text-gray-500">
                        Assigned on: {new Date(student.assigned_at).toLocaleDateString()}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Available Students Grid */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                Available Students ({filteredStudents.length})
              </h2>
              {!canAssignMore() && (
                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 py-2 rounded-lg">
                  <p className="text-sm font-medium">Team limit reached for this program</p>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-6">
            {filteredStudents.length === 0 ? (
              <div className="text-center py-12">
                <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600">No students found matching your filters</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStudents.map((student) => {
                  const isAssigned = isStudentAssigned(student.id);
                  
                  return (
                    <div key={student.id} className={`border rounded-lg p-6 ${
                      isAssigned 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200 bg-white'
                    }`}>
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-gray-900">{student.name}</h3>
                          <p className="text-sm text-gray-600">ID: {student.student_id}</p>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border mt-2 ${getCategoryColor(student.category)}`}>
                            {getCategoryDisplay(student.category)}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-2">
                          {isAssigned ? (
                            <div className="flex items-center space-x-2">
                              <CheckCircle className="h-5 w-5 text-green-500" />
                              <span className="text-sm text-green-600 font-medium">Assigned</span>
                              <button
                                onClick={() => removeStudent(student.id)}
                                disabled={removing}
                                className="flex items-center space-x-1 px-3 py-1 text-sm text-red-600 hover:text-red-800 hover:bg-red-50 rounded border border-red-200 transition-colors disabled:opacity-50"
                              >
                                <UserMinus className="h-4 w-4" />
                                <span>Remove</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => assignStudent(student.id)}
                              disabled={assigning || !canAssignMore()}
                              className="flex items-center space-x-1 px-3 py-1 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded border border-blue-200 transition-colors disabled:opacity-50"
                            >
                              <UserPlus className="h-4 w-4" />
                              <span>Assign</span>
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {student.category && (
                        <div className="text-xs text-gray-500">
                          Eligible for {getCategoryDisplay(student.category)} programs
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgramAssignmentPage; 