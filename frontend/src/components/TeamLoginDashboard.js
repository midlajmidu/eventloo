import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { teamManagerAPI, pointsAPI } from '../services/api';
import Pagination from './common/Pagination';
import { 
  Users, 
  Calendar, 
  Trophy, 
  TrendingUp, 
  Medal, 
  Target, 
  Activity, 
  ChevronRight,
  LogOut,
  User,
  Award,
  BookOpen,
  Eye,
  Plus,
  Sparkles
} from 'lucide-react';

const TeamLoginDashboard = () => {
  const [teamData, setTeamData] = useState(null);
  const [teamProfile, setTeamProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [students, setStudents] = useState([]);
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [studentPoints, setStudentPoints] = useState({});
  const [showPoints, setShowPoints] = useState(false);
  const [globalPointsData, setGlobalPointsData] = useState(null);
  
  // Filter states
  const [eventFilter, setEventFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Program assignment states
  const [selectedEventForPrograms, setSelectedEventForPrograms] = useState(null);
  const [programCategoryFilter, setProgramCategoryFilter] = useState('all');
  const [programSearchTerm, setProgramSearchTerm] = useState('');
  const [selectedCategoryForAssignment, setSelectedCategoryForAssignment] = useState('');
  const [selectedProgramForAssignment, setSelectedProgramForAssignment] = useState('');
  const [assigningStudent, setAssigningStudent] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // Pagination states for programs
  const [programCurrentPage, setProgramCurrentPage] = useState(1);
  const [programPageSize, setProgramPageSize] = useState(10);
  
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    loadTeamData();
  }, []);

  // Load events when team data is available
  useEffect(() => {
    if (teamData?.id) {
      loadEvents();
    }
  }, [teamData]);

  // Handle URL parameters for event selection
  useEffect(() => {
    if (teamData && location.search) {
      const urlParams = new URLSearchParams(location.search);
      const eventId = urlParams.get('event');
      
      if (eventId) {
        // Find the event in the events list
        const event = events.find(e => e.id === parseInt(eventId));
        if (event) {
          setSelectedEventForPrograms(event);
          setActiveSection('events');
          loadEventPrograms(event.id);
        }
      }
    }
  }, [teamData, location.search, events]);

  const loadTeamData = async () => {
    try {
      const teamDataStr = localStorage.getItem('team_data');
      const welcomeMessage = localStorage.getItem('team_welcome_message');
      
      if (!teamDataStr) {
        setError('No team data found. Please login again.');
        return;
      }

      const team = JSON.parse(teamDataStr);
      setTeamData(team);
      
      // Set welcome message
      if (welcomeMessage) {
        setTeamProfile({ welcomeMessage });
      }
      
      // Load global points data for the team
      await loadGlobalPointsData(team);
      
    } catch (err) {
      console.error('Error loading team data:', err);
      setError('Failed to load team data');
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    console.log('DEBUG: loadStudents called');
    console.log('DEBUG: teamData:', teamData);
    
    if (!teamData?.id) {
      console.error('DEBUG: No team data available');
      return;
    }
    
    setLoadingData(true);
    try {
      const response = await teamManagerAPI.getTeamStudents(teamData.id);
      console.log('DEBUG: Students API response:', response.data);
      
      // Handle both paginated and non-paginated responses
      let studentsData = [];
      if (response.data?.results) {
        // Paginated response
        studentsData = response.data.results;
        console.log('DEBUG: Students count (paginated):', studentsData.length);
      } else if (response.data?.students) {
        // Non-paginated response
        studentsData = response.data.students;
        console.log('DEBUG: Students count (non-paginated):', studentsData.length);
      }
      
      setStudents(studentsData);
      console.log('DEBUG: Students state set to:', studentsData);
    } catch (err) {
      console.error('DEBUG: Error loading students:', err);
      setStudents([]);
    } finally {
      setLoadingData(false);
    }
  };

  const loadEvents = async () => {
    if (!teamData?.id) return;
    
    setLoadingData(true);
    try {
      const response = await teamManagerAPI.getTeamEvents(teamData.id);
      setEvents(response.data.events || []);
    } catch (err) {
      console.error('Error loading events:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const loadGlobalPointsData = async (team) => {
    try {
      const response = await pointsAPI.getLeaderboard();
      const leaderboardData = response.data;
      
      // Find this team's global points from the leaderboard
      const teamGlobalData = leaderboardData.teams?.find(t => t.name === team.team_name);
      
      if (teamGlobalData) {
        setGlobalPointsData({
          global_points: teamGlobalData.points,
          events_participated: teamGlobalData.events_participated || 0
        });
      }
    } catch (err) {
      console.error('Error loading global points data:', err);
    }
  };

  const loadStudentPoints = async (eventId) => {
    if (!eventId) return;
    
    try {
      const response = await teamManagerAPI.getStudentPoints(eventId);
      const pointsData = {};
      
      // Create a map of student points by student ID
      response.data.results?.forEach(student => {
        pointsData[student.student_id] = student.total_points || 0;
      });
      
      setStudentPoints(pointsData);
    } catch (err) {
      console.error('Error loading student points:', err);
    }
  };

  const loadEventPrograms = async (eventId) => {
    if (!teamData?.id) return;
    
    setLoadingData(true);
    try {
      const response = await teamManagerAPI.getEventPrograms(teamData.id, eventId);
      console.log('DEBUG: loadEventPrograms response:', response.data);
      
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
        console.log('DEBUG: Programs count (paginated):', programsData.length);
        console.log('DEBUG: Team members count (paginated):', teamMembersData.length);
      } else {
        // Non-paginated response
        programsData = response.data.programs || [];
        teamMembersData = response.data.team_members || [];
        eventData = response.data.event;
        console.log('DEBUG: Programs count (non-paginated):', programsData.length);
        console.log('DEBUG: Team members count (non-paginated):', teamMembersData.length);
      }
      
      // Update both the programs state and the selectedEventForPrograms state
      setPrograms(programsData);
      setTeamMembers(teamMembersData);
      setSelectedEvent(eventData);
      
      // Update selectedEventForPrograms with fresh data
      if (selectedEventForPrograms && selectedEventForPrograms.id === eventId) {
        setSelectedEventForPrograms({
          ...selectedEventForPrograms,
          programs: programsData,
          ...eventData
        });
      }
      
      console.log('DEBUG: teamMembers state after set:', teamMembersData);
    } catch (err) {
      console.error('Error loading programs:', err);
    } finally {
      setLoadingData(false);
    }
  };

  const assignStudentToProgram = async (programId, studentId) => {
    if (!teamData?.id || !selectedEvent?.id) return;
    
    try {
      await teamManagerAPI.assignStudentToProgram(teamData.id, selectedEvent.id, programId, studentId);
      // Reload programs to show updated assignments
      await loadEventPrograms(selectedEvent.id);
    } catch (err) {
      console.error('Error assigning student:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      console.error('Error headers:', err.response?.headers);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to assign student';
      alert(errorMessage);
    }
  };

  const removeAssignment = async (assignmentId) => {
    if (!teamData?.id) return;
    
    try {
      await teamManagerAPI.removeAssignmentById(teamData.id, assignmentId);
      // Reload programs to show updated assignments
      await loadEventPrograms(selectedEvent.id);
    } catch (err) {
      console.error('Error removing assignment:', err);
      alert('Failed to remove assignment');
    }
  };

  const handleSectionChange = (section) => {
    console.log('DEBUG: handleSectionChange called with section:', section);
    setActiveSection(section);
    
    if (section === 'students') {
      console.log('DEBUG: Calling loadStudents from handleSectionChange');
      loadStudents();
    } else if (section === 'events') {
      loadEvents();
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('team_data');
    localStorage.removeItem('access_type');
    localStorage.removeItem('team_welcome_message');
    navigate('/login');
  };

  // Filter functions
  const getFilteredEvents = () => {
    let filtered = events;

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(event => 
        event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Event type filter
    if (eventFilter !== 'all') {
      filtered = filtered.filter(event => event.event_type === eventFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(event => event.status === statusFilter);
    }

    return filtered;
  };

  const getFilteredPrograms = (eventPrograms) => {
    if (!eventPrograms) return [];
    
    let filtered = eventPrograms;

    // Category filter
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(program => program.category === categoryFilter);
    }

    return filtered;
  };

  const getAllCategories = () => {
    const categories = new Set();
    events.forEach(event => {
      event.programs?.forEach(program => {
        categories.add(program.category);
      });
    });
    return Array.from(categories).sort();
  };

  const getAllEventTypes = () => {
    const types = new Set();
    events.forEach(event => {
      types.add(event.event_type);
    });
    return Array.from(types).sort();
  };

  const getAllStatuses = () => {
    const statuses = new Set();
    events.forEach(event => {
      statuses.add(event.status);
    });
    return Array.from(statuses).sort();
  };

  const clearFilters = () => {
    setEventFilter('all');
    setCategoryFilter('all');
    setStatusFilter('all');
    setSearchTerm('');
  };

  const clearProgramFilters = () => {
    setProgramCategoryFilter('all');
    setProgramSearchTerm('');
    setProgramCurrentPage(1);
  };

  const handleEventClick = async (event) => {
    setSelectedEventForPrograms(event);
    setActiveSection('event-programs');
    
    // Load students and event programs data
    await Promise.all([
      loadStudents(),
      loadEventPrograms(event.id)
    ]);
  };

  const assignStudentToProgramFromEvent = async (programId, studentId) => {
    if (!teamData?.id || !selectedEventForPrograms?.id) return;
    
    setAssigningStudent(true);
    try {
      const response = await teamManagerAPI.assignStudentToProgram(teamData.id, selectedEventForPrograms.id, programId, studentId);
      
      // Refresh the event programs data to get accurate slot counts
      await loadEventPrograms(selectedEventForPrograms.id);
      
      // Also refresh the events data to update the UI
      await loadEvents();
      
      // Reset the assignment dropdowns
      setSelectedCategoryForAssignment('');
      setSelectedProgramForAssignment('');
      
      // Show success message
      setSuccessMessage('Student assigned successfully!');
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000); // Hide after 3 seconds
    } catch (err) {
      console.error('Error assigning student:', err);
      console.error('Error response:', err.response?.data);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to assign student';
      alert(errorMessage);
    } finally {
      setAssigningStudent(false);
    }
  };

  const getProgramsByCategory = (category) => {
    if (!selectedEventForPrograms || !selectedEventForPrograms.programs) return [];
    return selectedEventForPrograms.programs.filter(program => program.category === category);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategoryForAssignment(category);
    setSelectedProgramForAssignment(''); // Reset program selection when category changes
  };

  const handleProgramAssignment = (studentId) => {
    if (studentId) {
      // Find the program ID from the selected value
      const select = document.querySelector('select');
      if (select && select.value) {
        const [programId] = select.value.split('-');
        assignStudentToProgramFromEvent(parseInt(programId), studentId);
      }
    }
  };

  const getFilteredProgramsForEvent = (event) => {
    if (!event || !event.programs) return [];
    
    let filtered = event.programs;

    // Search filter
    if (programSearchTerm) {
      filtered = filtered.filter(program => 
        program.name.toLowerCase().includes(programSearchTerm.toLowerCase()) ||
        program.description.toLowerCase().includes(programSearchTerm.toLowerCase())
      );
    }

    // Category filter
    if (programCategoryFilter !== 'all') {
      filtered = filtered.filter(program => program.category === programCategoryFilter);
    }

    return filtered;
  };

  const getProgramCategories = (event) => {
    if (!event || !event.programs) return [];
    const categories = new Set();
    event.programs.forEach(program => {
      categories.add(program.category);
    });
    return Array.from(categories).sort();
  };

  const removeAssignmentFromEvent = async (studentId, programId) => {
    if (!teamData?.id || !selectedEventForPrograms?.id) return;

    // Find the student name for confirmation
    const student = teamMembers.find(s => s.id === studentId);
    const program = selectedEventForPrograms.programs.find(p => p.id === programId);
    
    if (!student || !program) {
      alert('Error: Student or program not found');
      return;
    }

    // Show confirmation dialog
    const confirmed = window.confirm(
      `Are you sure you want to remove ${student.name} from the program "${program.name}"?`
    );

    if (!confirmed) return;

    try {
      await teamManagerAPI.removeStudentFromProgram(teamData.id, selectedEventForPrograms.id, programId, studentId);
      
      // Refresh the event programs data to get accurate slot counts
      await loadEventPrograms(selectedEventForPrograms.id);
      
      // Also refresh the events data to update the UI
      await loadEvents();
      
      // Show success message
      setSuccessMessage('Student removed successfully!');
      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000); // Hide after 3 seconds
    } catch (err) {
      console.error('Error removing student from program:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to remove student';
      alert(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading your team dashboard...</p>
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
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  const stats = [
    {
      title: 'Team Members',
      value: teamData?.member_count || 0,
      icon: Users,
      color: 'bg-gradient-to-r from-blue-500 to-blue-600',
      bgColor: 'bg-blue-50',
      textColor: 'text-blue-600'
    },
    {
      title: 'Global Points',
      value: globalPointsData?.global_points || teamData?.global_points || teamData?.points_earned || 0,
      icon: Trophy,
      color: 'bg-gradient-to-r from-yellow-500 to-yellow-600',
      bgColor: 'bg-yellow-50',
      textColor: 'text-yellow-600',
      subtitle: globalPointsData?.global_points ? `${globalPointsData.events_participated} events` : ''
    },
    {
      title: 'Team Number',
      value: teamData?.team_id || 'N/A',
      icon: Target,
      color: 'bg-gradient-to-r from-green-500 to-green-600',
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    }
  ];

  const renderDashboard = () => (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">{stat.title}</p>
                  <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                  {stat.subtitle && (
                    <p className="text-xs text-gray-500 mt-1">{stat.subtitle}</p>
                  )}
                </div>
                <div className={`${stat.bgColor} p-3 rounded-lg`}>
                  <stat.icon className={`h-6 w-6 ${stat.textColor}`} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Team Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <User className="h-5 w-5 mr-2" />
              Team Information
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Team Name:</span>
                <span className="font-semibold text-gray-900">{teamData?.team_name}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Team ID:</span>
                <span className="font-semibold text-gray-900">{teamData?.team_id}</span>
              </div>
              <div className="flex justify-between items-center py-3 border-b border-gray-100">
                <span className="text-gray-600">Members:</span>
                <span className="font-semibold text-gray-900">{teamData?.member_count}</span>
              </div>
              <div className="flex justify-between items-center py-3">
                <span className="text-gray-600">Global Points:</span>
                <span className="font-semibold text-gray-900">
                  {globalPointsData?.global_points || teamData?.global_points || teamData?.points_earned || 0}
                  {globalPointsData?.global_points && (
                    <span className="text-sm text-gray-500 ml-2">({globalPointsData.events_participated} events)</span>
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Award className="h-5 w-5 mr-2" />
              Quick Actions
            </h2>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <button 
                onClick={() => handleSectionChange('students')}
                className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <div className="flex items-center">
                  <Users className="h-5 w-5 text-blue-600 mr-3" />
                  <span className="font-medium text-gray-900">View Team Members</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
              
              <button 
                onClick={() => handleSectionChange('events')}
                className="w-full flex items-center justify-between p-4 bg-purple-50 rounded-lg hover:bg-purple-100 transition-colors"
              >
                <div className="flex items-center">
                  <Calendar className="h-5 w-5 text-purple-600 mr-3" />
                  <span className="font-medium text-gray-900">View Events</span>
                </div>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  const renderStudents = () => {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="h-5 w-5 mr-2" />
              Team Members ({students.length})
            </h2>
            <div className="flex items-center space-x-3">
              {/* Points Toggle */}
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Points:</label>
                <input
                  type="checkbox"
                  checked={showPoints}
                  onChange={(e) => {
                    setShowPoints(e.target.checked);
                    if (e.target.checked && events.length > 0) {
                      loadStudentPoints(events[0].id);
                    }
                  }}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
              
              {/* Event Selector for Points */}
              {showPoints && events.length > 0 && (
                <div className="flex items-center space-x-2">
                  <select
                    onChange={(e) => loadStudentPoints(e.target.value)}
                    className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {events.map(event => (
                      <option key={event.id} value={event.id}>{event.title}</option>
                    ))}
                  </select>
                </div>
              )}
              
              <button
                onClick={() => handleSectionChange('dashboard')}
                className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
              >
                ← Back
              </button>
            </div>
          </div>
        </div>
        <div className="p-4">
          {loadingData ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600 text-sm">Loading students...</p>
            </div>
          ) : students.length === 0 ? (
            <div className="text-center py-6">
              <Users className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">No students found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {students.map((student) => (
                <div key={student.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200 hover:bg-gray-100 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium text-gray-900 text-sm">{student.name}</h3>
                    {showPoints && (
                      <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                        {studentPoints[student.student_id] || 0} pts
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-gray-600">ID: {student.student_id}</p>
                    <p className="text-xs text-gray-600">Category: {student.category.toUpperCase()}</p>
                    <p className="text-xs text-gray-600">Grade: {student.grade}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEvents = () => {
    const filteredEvents = getFilteredEvents();
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Calendar className="h-5 w-5 mr-2" />
              Events ({filteredEvents.length})
            </h2>
            <button
              onClick={() => handleSectionChange('dashboard')}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Back to Dashboard
            </button>
          </div>
          
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-4">
            {/* Search */}
            <div>
              <input
                type="text"
                placeholder="Search events..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            {/* Event Type Filter */}
            <div>
              <select
                value={eventFilter}
                onChange={(e) => setEventFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Event Types</option>
                {getAllEventTypes().map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            
            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Statuses</option>
                {getAllStatuses().map(status => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </div>
            
            {/* Category Filter */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {getAllCategories().map(category => (
                  <option key={category} value={category}>{category.toUpperCase()}</option>
                ))}
              </select>
            </div>
            
            {/* Clear Filters */}
            <div>
              <button
                onClick={clearFilters}
                className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-6">
          {loadingData ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Loading events...</p>
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No events found</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredEvents.map((event) => {
                const filteredPrograms = getFilteredPrograms(event.programs);
                const hasMatchingPrograms = categoryFilter === 'all' || filteredPrograms.length > 0;
                
                if (categoryFilter !== 'all' && !hasMatchingPrograms) {
                  return null;
                }
                
                return (
                  <div key={event.id} className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow">
                    {/* Event Header */}
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-xl font-semibold text-gray-900">{event.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">{event.description}</p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs rounded-full ${
                          event.status === 'active' ? 'bg-green-100 text-green-800' :
                          event.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {event.status}
                        </span>
                        <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                          {event.event_type}
                        </span>
                      </div>
                    </div>
                    
                    {/* Event Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">{event.team_points}</p>
                        <p className="text-xs text-gray-600">Team Points</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">{event.total_programs}</p>
                        <p className="text-xs text-gray-600">Total Programs</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">{event.programs_assigned}</p>
                        <p className="text-xs text-gray-600">Assigned</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {event.total_programs - event.programs_assigned}
                        </p>
                        <p className="text-xs text-gray-600">Available</p>
                      </div>
                    </div>
                    
                    {/* Programs Section */}
                    {filteredPrograms.length > 0 && (
                      <div className="mb-4">
                        <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                          <BookOpen className="h-4 w-4 mr-2" />
                          Programs ({filteredPrograms.length})
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {filteredPrograms.map((program) => (
                            <div key={program.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-semibold text-gray-900">{program.name}</h5>
                                <span className={`px-2 py-1 text-xs rounded-full ${
                                  program.is_finished ? 'bg-red-100 text-red-800' :
                                  program.is_active ? 'bg-green-100 text-green-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {program.is_finished ? 'Finished' : program.is_active ? 'Active' : 'Inactive'}
                                </span>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{program.description}</p>
                              <div className="space-y-1 text-xs text-gray-600">
                                <p>Category: <span className="font-medium">{program.category.toUpperCase()}</span></p>
                                <p>Type: <span className="font-medium">{program.program_type || 'Individual'}</span></p>
                                <p>Slots: <span className="font-medium">{program.assigned_count}/{program.max_participants} per team</span></p>
                                <p>Available: <span className="font-medium">{program.available_slots}</span></p>
                              </div>
                              
                              {/* Assigned Students */}
                              {program.assigned_students.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-gray-200">
                                  <p className="text-xs font-medium text-gray-700 mb-1">Assigned Students:</p>
                                  <div className="space-y-1">
                                    {program.assigned_students.map((student) => (
                                      <div key={student.id} className="text-xs text-gray-600 flex items-center justify-between">
                                        <span>{student.name}</span>
                                        <span className="text-gray-500">({student.student_id})</span>
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
                    
                    {/* Action Buttons */}
                    <div className="flex space-x-3">
                      <button
                        onClick={() => handleEventClick(event)}
                        className="flex-1 flex items-center justify-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View & Assign Programs
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderEventPrograms = () => {
    if (!selectedEventForPrograms) return null;
    
    // Use the programs state instead of selectedEventForPrograms.programs
    const eventWithPrograms = {
      ...selectedEventForPrograms,
      programs: programs
    };
    
    const filteredPrograms = getFilteredProgramsForEvent(eventWithPrograms);
    const categories = getProgramCategories(eventWithPrograms);
    
    // Pagination logic
    const totalPrograms = filteredPrograms.length;
    const totalPages = Math.ceil(totalPrograms / programPageSize);
    const startIndex = (programCurrentPage - 1) * programPageSize;
    const endIndex = startIndex + programPageSize;
    const paginatedPrograms = filteredPrograms.slice(startIndex, endIndex);
    
    // Reset to first page if current page is out of bounds
    if (programCurrentPage > totalPages && totalPages > 0) {
      setProgramCurrentPage(1);
    }
    
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        {/* Success Message */}
        {showSuccessMessage && (
          <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-t-lg">
            <div className="flex items-center">
              <span className="text-green-600 mr-2">✓</span>
              <span className="text-sm">{successMessage}</span>
            </div>
          </div>
        )}
        
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <BookOpen className="h-5 w-5 mr-2" />
                Programs - {selectedEventForPrograms.title}
              </h2>
              <p className="text-sm text-gray-600">Assign your students to programs</p>
            </div>
            <button
              onClick={() => {
                setActiveSection('events');
                setSelectedEventForPrograms(null);
              }}
              className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
            >
              ← Back
            </button>
          </div>
          
          {/* Program Filters */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Search */}
            <div>
              <input
                type="text"
                placeholder="Search programs..."
                value={programSearchTerm}
                onChange={(e) => {
                  setProgramSearchTerm(e.target.value);
                  setProgramCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              />
            </div>
            
            {/* Category Filter */}
            <div>
              <select
                value={programCategoryFilter}
                onChange={(e) => {
                  setProgramCategoryFilter(e.target.value);
                  setProgramCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Categories</option>
                {categories.map(category => (
                  <option key={category} value={category}>{category.toUpperCase()}</option>
                ))}
              </select>
            </div>
            
            {/* Clear Filters */}
            <div>
              <button
                onClick={clearProgramFilters}
                className="w-full px-3 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>
        
        <div className="p-4">
          {loadingData ? (
            <div className="text-center py-6">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
              <p className="text-gray-600 text-sm">Loading programs...</p>
            </div>
          ) : filteredPrograms.length === 0 ? (
            <div className="text-center py-6">
              <BookOpen className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600 text-sm">No programs found for this event</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {paginatedPrograms.map((program) => (
                  <div 
                    key={program.id} 
                    className="border border-gray-200 rounded-lg p-4 cursor-pointer hover:shadow-md transition-shadow bg-gray-50"
                    onClick={() => navigate(`/team-manager/dashboard/events/${selectedEventForPrograms.id}/programs/${program.id}/assign`)}
                  >
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-gray-900 text-sm">{program.name}</h3>
                        <div className="flex space-x-1">
                          <span className={`px-2 py-1 text-xs rounded-full ${
                            program.is_finished ? 'bg-red-100 text-red-800' :
                            program.is_active ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {program.is_finished ? 'Finished' : program.is_active ? 'Active' : 'Inactive'}
                          </span>
                          <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                            {program.category.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <p className="text-xs text-gray-600 mb-2">{program.description}</p>
                    </div>
                    
                    <div className="space-y-2 text-xs text-gray-600">
                      <div className="flex justify-between">
                        <span>Type:</span>
                        <span className="font-medium">{program.is_team_based ? 'Team' : 'Individual'}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Assigned:</span>
                        <span className="font-medium text-blue-600">
                          {program.assigned_students?.length || 0}/{program.max_participants}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Limit:</span>
                        <span className="font-medium">
                          {program.is_team_based ? 
                            `${program.max_participants_per_team || program.max_participants} per team` :
                            `${program.max_participants} total`
                          }
                        </span>
                      </div>
                    </div>
                    
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <p className="text-xs text-blue-600 font-medium text-center">Click to manage assignments →</p>
                    </div>
                  </div>
                ))}
              </div>
            
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="mt-6 pt-6 border-t border-gray-200">
                <Pagination
                  currentPage={programCurrentPage}
                  totalPages={totalPages}
                  totalCount={totalPrograms}
                  pageSize={programPageSize}
                  onPageChange={setProgramCurrentPage}
                  onPageSizeChange={(newPageSize) => {
                    setProgramPageSize(newPageSize);
                    setProgramCurrentPage(1);
                  }}
                  showPageSizeSelector={true}
                />
              </div>
            )}
          </>
        )}
        </div>
      </div>
    );
  };

  const renderPrograms = () => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <BookOpen className="h-5 w-5 mr-2" />
              Programs - {selectedEvent?.title}
            </h2>
            <p className="text-sm text-gray-600">Assign your students to programs</p>
            <p className="text-xs text-blue-600 mt-1">
              💡 Each student will receive a unique chest number that remains the same across all programs in this event.
            </p>
          </div>
          <button
            onClick={() => {
              setActiveSection('event-programs');
            }}
            className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition-colors text-sm"
          >
            ← Back to Programs
          </button>
        </div>
      </div>
      <div className="p-4">
        {loadingData ? (
          <div className="text-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600 text-sm">Loading programs...</p>
          </div>
        ) : programs.length === 0 ? (
          <div className="text-center py-6">
            <BookOpen className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 text-sm">No programs found for this event</p>
          </div>
        ) : (
          <div className="space-y-4">
            {programs.map((program) => (
              <div key={program.id} className="border border-gray-200 rounded-lg p-4 bg-gray-50">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-sm">{program.name}</h3>
                    <p className="text-xs text-gray-600">{program.description}</p>
                  </div>
                  <div className="text-right text-xs text-gray-600">
                    <p>Category: {program.category.toUpperCase()}</p>
                    <p>Type: {program.is_team_based ? 'Team' : 'Individual'}</p>
                    <p className="text-blue-600 font-medium">
                      {program.assigned_count}/{program.per_team_limit} assigned
                    </p>
                  </div>
                </div>
                
                {/* Students Section */}
                <div className="border-t pt-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Assigned Students */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-900 mb-2 flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                        Assigned Students ({program.assigned_students.length})
                      </h4>
                      {program.assigned_students.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                          {program.assigned_students.map((student) => (
                            <div key={student.id} className="bg-white p-2 rounded border border-green-200 hover:bg-green-50 transition-colors">
                              <div className="flex items-center justify-between">
                                <div>
                                  <span className="text-xs font-medium text-gray-900">{student.name}</span>
                                  <p className="text-xs text-gray-500">{student.student_id}</p>
                                </div>
                                <button
                                  onClick={() => removeAssignment(student.id)}
                                  className="text-red-600 hover:text-red-800 text-xs px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                >
                                  Remove
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-3 rounded border border-dashed border-gray-300">
                          <p className="text-xs text-gray-500 text-center">No students assigned yet</p>
                        </div>
                      )}
                    </div>

                    {/* Available Students */}
                    <div>
                      <h4 className="text-xs font-medium text-gray-900 mb-2 flex items-center">
                        <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
                        Available Students ({teamMembers.length - program.assigned_students.length})
                      </h4>
                      {program.available_slots > 0 ? (
                        <div className="grid grid-cols-1 gap-2 max-h-32 overflow-y-auto">
                          {teamMembers
                            .filter(member => !program.assigned_students.some(assigned => assigned.id === member.id))
                            .map((member) => (
                              <div key={member.id} className="bg-white p-2 rounded border border-blue-200 hover:bg-blue-50 transition-colors cursor-pointer"
                                   onClick={() => assignStudentToProgram(program.id, member.id)}>
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="text-xs font-medium text-gray-900">{member.name}</span>
                                    <p className="text-xs text-gray-500">{member.student_id}</p>
                                  </div>
                                  <span className="text-blue-600 text-xs px-2 py-1 rounded bg-blue-100">
                                    Click to assign
                                  </span>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="bg-gray-50 p-3 rounded border border-dashed border-gray-300">
                          <p className="text-xs text-gray-500 text-center">No available slots</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">
                {teamData?.team_name || 'Team Dashboard'}
              </h1>
              <p className="text-gray-600 text-lg">
                {teamProfile?.welcomeMessage || 'Welcome to your team dashboard!'}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
                <div className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-green-500" />
                  <span className="text-sm font-medium text-gray-700">Team Online</span>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        {activeSection === 'dashboard' && renderDashboard()}
        {activeSection === 'students' && renderStudents()}
        {activeSection === 'events' && renderEvents()}
        {activeSection === 'event-programs' && renderEventPrograms()}
        {activeSection === 'programs' && renderPrograms()}

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-sm text-gray-500">
            © 2025 Eventloo. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TeamLoginDashboard; 