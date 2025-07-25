import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamManagerAPI, eventsAPI } from '../../services/api';
import { 
  Calendar, 
  MapPin, 
  Clock, 
  Users, 
  Search, 
  Filter,
  Trophy,
  Star,
  ChevronRight,
  Target,
  Activity,
  Award,
  UserPlus,
  UserMinus
} from 'lucide-react';

const TeamManagerEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [myTeams, setMyTeams] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [eventPrograms, setEventPrograms] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get team data from localStorage - use the correct key
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;
      
      // Try to get team ID from token if not in localStorage
      let payload = null;
      if (!teamId) {
        const accessToken = localStorage.getItem('access');
        if (accessToken) {
          try {
            payload = JSON.parse(atob(accessToken.split('.')[1]));
            if (payload.team_id) {
              setSelectedTeam(payload.team_id);
            }
          } catch (e) {
            console.log('Error parsing token:', e);
          }
        }
        
        if (!teamId && !payload?.team_id) {
          setError('No team data found. Please login again.');
          return;
        }
      } else {
        setSelectedTeam(teamId);
      }
      
      const finalTeamId = teamId || payload?.team_id;
      
      const [teamsResponse, eventsResponse, studentsResponse] = await Promise.all([
        teamManagerAPI.getMyTeams(),
        teamManagerAPI.getTeamEvents(finalTeamId),
        teamManagerAPI.getTeamStudents(finalTeamId)
      ]);
      
      // Ensure arrays are properly set
      const teamsData = Array.isArray(teamsResponse.data) ? teamsResponse.data : (teamsResponse.data?.results || []);
      const eventsData = Array.isArray(eventsResponse.data?.events) ? eventsResponse.data.events : (eventsResponse.data?.results || []);
      const studentsData = Array.isArray(studentsResponse.data?.students) ? studentsResponse.data.students : (studentsResponse.data?.results || []);
      
      setMyTeams(teamsData);
      setEvents(eventsData);
      setTeamMembers(studentsData);
      
      // Fetch programs for each event
      const programsData = {};
      
      for (const event of eventsData) {
        try {
          const programsResponse = await teamManagerAPI.getEventPrograms(finalTeamId, event.id);
          // Handle both paginated and non-paginated responses
          let programsDataForEvent = [];
          if (programsResponse.data?.results) {
            // Paginated response - the results contain the full response structure
            programsDataForEvent = programsResponse.data.results.programs || [];
          } else {
            // Non-paginated response
            programsDataForEvent = programsResponse.data?.programs || [];
          }
          programsData[event.id] = programsDataForEvent;
        } catch (err) {
          console.warn(`Failed to fetch programs for event ${event.id}:`, err);
          programsData[event.id] = [];
        }
      }
      
      setEventPrograms(programsData);
      
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load events');
      // Set empty arrays on error
      setEvents([]);
      setMyTeams([]);
      setTeamMembers([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    // Ensure status is a string
    const statusStr = typeof status === 'string' ? status : 'draft';
    
    switch (statusStr) {
      case 'upcoming': return 'bg-blue-100 text-blue-800';
      case 'ongoing': return 'bg-green-100 text-green-800';
      case 'completed': return 'bg-gray-100 text-gray-800';
      case 'published': return 'bg-green-100 text-green-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeIcon = (type) => {
    switch (type) {
      case 'sports': return Trophy;
      case 'cultural': return Star;
      case 'academic': return Target;
      default: return Activity;
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

  const filteredEvents = (Array.isArray(events) ? events : []).filter(event => {
    const matchesSearch = event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || event.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const handleEventClick = (eventId) => {
    navigate(`/team-manager/events/${eventId}`);
  };

  const handleAssignStudent = async (eventId, programId, studentId) => {
    if (!selectedTeam) return;
    
    try {
      await teamManagerAPI.assignStudentToProgram(selectedTeam, eventId, programId, studentId);
      // Refresh programs for this event
      const programsResponse = await teamManagerAPI.getEventPrograms(selectedTeam, eventId);
      // Handle both paginated and non-paginated responses
      let programsDataForEvent = [];
      if (programsResponse.data?.results) {
        // Paginated response - the results contain the full response structure
        programsDataForEvent = programsResponse.data.results.programs || [];
      } else {
        // Non-paginated response
        programsDataForEvent = programsResponse.data?.programs || [];
      }
      setEventPrograms(prev => ({
        ...prev,
        [eventId]: programsDataForEvent
      }));
    } catch (err) {
      console.error('Error assigning student:', err);
      alert('Failed to assign student to program');
    }
  };

  const handleRemoveStudent = async (eventId, programId, studentId) => {
    if (!selectedTeam) return;
    
    try {
      await teamManagerAPI.removeStudentFromProgram(selectedTeam, eventId, programId, studentId);
      // Refresh programs for this event
      const programsResponse = await teamManagerAPI.getEventPrograms(selectedTeam, eventId);
      // Handle both paginated and non-paginated responses
      let programsDataForEvent = [];
      if (programsResponse.data?.results) {
        // Paginated response - the results contain the full response structure
        programsDataForEvent = programsResponse.data.results.programs || [];
      } else {
        // Non-paginated response
        programsDataForEvent = programsResponse.data?.programs || [];
      }
      setEventPrograms(prev => ({
        ...prev,
        [eventId]: programsDataForEvent
      }));
    } catch (err) {
      console.error('Error removing student:', err);
      alert('Failed to remove student from program');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading events...</p>
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
              <h1 className="text-4xl font-bold text-gray-900 mb-2">My Events</h1>
              <p className="text-gray-600 text-lg">
                Events where your teams are participating
              </p>
            </div>
            <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">{teamMembers.length} Team Members</span>
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search events..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Status</option>
                  <option value="upcoming">Upcoming</option>
                  <option value="ongoing">Ongoing</option>
                  <option value="completed">Completed</option>
                </select>
                <button className="px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2">
                  <Filter className="h-5 w-5" />
                  <span>Filter</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Events Grid */}
        {filteredEvents.length > 0 ? (
          <div className="space-y-6">
            {filteredEvents.map((event) => {
              const IconComponent = getEventTypeIcon(event.event_type);
              const eventProgramsList = eventPrograms[event.id] || [];
              const totalPrograms = eventProgramsList.length;
              const assignedPrograms = eventProgramsList.filter(p => p.assigned_count > 0).length;
              
              return (
                <div 
                  key={event.id} 
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300"
                >
                  {/* Event Header */}
                  <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 relative overflow-hidden">
                    <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                      <div className="text-white text-center">
                        <IconComponent className="h-8 w-8 mx-auto mb-2" />
                        <h3 className="text-lg font-semibold">{event.title}</h3>
                      </div>
                    </div>
                    <div className="absolute top-4 right-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(event.status)}`}>
                        {typeof event.status === 'string' ? event.status : 'Draft'}
                      </span>
                    </div>
                  </div>

                  {/* Event Content */}
                  <div className="p-6">
                    <div className="space-y-3">
                      <div className="flex items-center text-sm text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        <span>{new Date(event.start_date).toLocaleDateString()}</span>
                        {event.end_date && event.end_date !== event.start_date && (
                          <span> - {new Date(event.end_date).toLocaleDateString()}</span>
                        )}
                      </div>

                      <div className="flex items-center text-sm text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        <span>{event.start_time || 'TBA'}</span>
                      </div>

                      {event.venue && (
                        <div className="flex items-center text-sm text-gray-600">
                          <MapPin className="h-4 w-4 mr-2" />
                          <span>{event.venue}</span>
                        </div>
                      )}

                      <div className="flex items-center text-sm text-gray-600">
                        <Users className="h-4 w-4 mr-2" />
                        <span>{teamMembers.length} team members available</span>
                      </div>
                    </div>

                    {event.description && (
                      <p className="text-gray-700 text-sm mt-4 line-clamp-2">
                        {event.description}
                      </p>
                    )}

                    {/* Programs Section */}
                    <div className="mt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-900">Programs ({totalPrograms})</h4>
                        <div className="flex items-center space-x-4">
                          <span className="text-sm text-gray-600">
                            {assignedPrograms} programs with assignments
                          </span>
                          <button 
                            onClick={() => handleEventClick(event.id)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                          >
                            <span>View Details</span>
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {/* Programs Grid */}
                      {eventProgramsList.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {eventProgramsList.slice(0, 6).map((program) => (
                            <div key={program.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex items-center justify-between mb-2">
                                <h5 className="font-medium text-gray-900">{program.name}</h5>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(program.category)}`}>
                                  {program.category?.toUpperCase()}
                                </span>
                              </div>
                              
                              <div className="text-sm text-gray-600 mb-3">
                                <p>Type: {program.program_type}</p>
                                <p>Assigned: {program.assigned_count}/{program.max_participants || '∞'}</p>
                                <p>Available: {program.available_slots}</p>
                              </div>

                              {/* Assignment Actions */}
                              <div className="flex items-center justify-between">
                                <button
                                  onClick={() => {
                                    // Show assignment modal or navigate to assignment page
                                    navigate(`/team-manager/events/${event.id}?program=${program.id}`);
                                  }}
                                  className="flex items-center space-x-1 text-blue-600 hover:text-blue-800 text-sm"
                                >
                                  <UserPlus className="h-4 w-4" />
                                  <span>Assign</span>
                                </button>
                                
                                {program.assigned_students && program.assigned_students.length > 0 && (
                                  <button
                                    onClick={() => {
                                      // Show remove assignment modal
                                      navigate(`/team-manager/events/${event.id}?program=${program.id}&action=remove`);
                                    }}
                                    className="flex items-center space-x-1 text-red-600 hover:text-red-800 text-sm"
                                  >
                                    <UserMinus className="h-4 w-4" />
                                    <span>Remove</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Trophy className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                          <p>No programs available for this event</p>
                        </div>
                      )}

                      {eventProgramsList.length > 6 && (
                        <div className="mt-4 text-center">
                          <button 
                            onClick={() => handleEventClick(event.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            View all {eventProgramsList.length} programs →
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
              <Calendar className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Events Found</h3>
              <p className="text-gray-600 mb-6">
                {searchTerm || filterStatus !== 'all' 
                  ? 'Try adjusting your search criteria' 
                  : 'No events available for your teams yet'
                }
              </p>
              {(searchTerm || filterStatus !== 'all') && (
                <button 
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('all');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {filteredEvents.length > 0 && (
          <div className="mt-8">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Summary</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-blue-600">{filteredEvents.length}</p>
                  <p className="text-sm text-gray-600">Total Events</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <Activity className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-green-600">
                    {filteredEvents.filter(e => e.status === 'ongoing').length}
                  </p>
                  <p className="text-sm text-gray-600">Active Now</p>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg">
                  <Users className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-purple-600">{teamMembers.length}</p>
                  <p className="text-sm text-gray-600">Team Members</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <Trophy className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
                  <p className="text-2xl font-bold text-yellow-600">
                    {Object.values(eventPrograms).flat().length}
                  </p>
                  <p className="text-sm text-gray-600">Total Programs</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamManagerEvents; 