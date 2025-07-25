import React, { useState, useEffect } from 'react';
import { teamsAPI, eventsAPI } from '../../services/api';
import { 
  Users, 
  Plus, 
  Search, 
  RefreshCw, 
  AlertCircle,
  Key,
  Settings,
  X,
  Filter,
  Trash2,
  Calendar,
  Award,
  User,
  Target
} from 'lucide-react';
import Pagination from '../common/Pagination';

const TeamsPage = () => {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [regeneratingCredentials, setRegeneratingCredentials] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: ''
  });
  const [events, setEvents] = useState([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    description: ''
  });
  const [deleting, setDeleting] = useState(false);
  const [teamDetails, setTeamDetails] = useState(null);
  const [loadingTeamDetails, setLoadingTeamDetails] = useState(false);
  const [teamCredentials, setTeamCredentials] = useState(null);
  const [loadingCredentials, setLoadingCredentials] = useState(false);

  
  // Management filters
  const [managementFilters, setManagementFilters] = useState({
    searchTerm: '',
    category: '',
    grade: '',
    section: '',
    event: '',
    program: ''
  });

  // Active tab in management modal
  const [activeTab, setActiveTab] = useState('members');

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchData();
  }, [currentPage, pageSize, searchTerm]);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoadingEvents(true);
      const response = await eventsAPI.getEvents();
      setEvents(response.data.results || response.data || []);
    } catch (err) {
      console.error('Error fetching events:', err);
    } finally {
      setLoadingEvents(false);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const teamsResponse = await teamsAPI.getTeams({
        page: currentPage,
        page_size: pageSize,
        search: searchTerm
      });
      
      let teamsData = [];
      if (teamsResponse.data.results) {
        teamsData = teamsResponse.data.results;
        setTotalCount(teamsResponse.data.count || 0);
      } else {
        teamsData = Array.isArray(teamsResponse.data) ? teamsResponse.data : [];
        setTotalCount(Array.isArray(teamsResponse.data) ? teamsResponse.data.length : 0);
      }

      // Get global points data for teams
      try {
        const { dashboardAPI } = await import('../../services/api');
        const dashboardResponse = await dashboardAPI.getAdminSummary();
        const globalPointsData = dashboardResponse.data.pointsByTeam || [];
        
        // Merge global points with team data
        const teamsWithGlobalPoints = teamsData.map(team => {
          const globalTeamData = globalPointsData.find(gp => gp.id === team.id);
          return {
            ...team,
            global_points: globalTeamData ? globalTeamData.points : null
          };
        });
        
        setTeams(teamsWithGlobalPoints);
      } catch (globalPointsError) {
        console.log('Could not fetch global points, using team data as is');
        setTeams(teamsData);
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
      setTeams([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!createFormData.name) {
      alert('Please fill in the team name');
      return;
    }

    try {
      setCreating(true);
      const teamData = {
        name: createFormData.name,
        description: createFormData.description
      };

      // Teams are no longer linked to events, so remove event_id
      await teamsAPI.createTeam(teamData);
      setShowCreateModal(false);
      setCreateFormData({
        name: '',
        description: ''
      });
      fetchData();
      alert('Team created successfully!');
    } catch (err) {
      console.error('Error creating team:', err);
      alert('Failed to create team. Please try again.');
    } finally {
      setCreating(false);
    }
  };

  const viewCredentials = async (team) => {
    console.log('DEBUG: viewCredentials called for team:', team);
    setSelectedTeam(team);
    setShowCredentialsModal(true);
    setLoadingCredentials(true);
    
    try {
      console.log('DEBUG: Calling teamsAPI.getCredentials with team ID:', team.id);
      const response = await teamsAPI.getCredentials(team.id);
      console.log('DEBUG: Credentials response:', response.data);
      setTeamCredentials(response.data);
    } catch (err) {
      console.error('Error fetching credentials:', err);
      console.error('Error details:', err.response?.data);
      alert('Failed to load team credentials');
    } finally {
      setLoadingCredentials(false);
    }
  };

  const regenerateCredentials = async (teamId) => {
    try {
      setRegeneratingCredentials(prev => ({ ...prev, [teamId]: true }));
      const response = await teamsAPI.regenerateCredentials(teamId);
      
      // Update the team in the local state
      setTeams(prevTeams => 
        prevTeams.map(team => 
          team.id === teamId 
            ? { ...team, team_credentials: response.data }
            : team
        )
      );
      
      // Update credentials in modal if open
      if (showCredentialsModal && selectedTeam && selectedTeam.id === teamId) {
        setTeamCredentials(response.data);
      }
      
      alert('Credentials regenerated successfully!');
    } catch (err) {
      console.error('Error regenerating credentials:', err);
      alert('Failed to regenerate credentials');
    } finally {
      setRegeneratingCredentials(prev => ({ ...prev, [teamId]: false }));
    }
  };

  const handleManage = async (team) => {
    setSelectedTeam(team);
    setShowManageModal(true);
    setLoadingTeamDetails(true);
    
    try {
      const response = await teamsAPI.getComprehensiveDetails(team.id);
      console.log('Team details response:', response.data);
      setTeamDetails(response.data);
    } catch (err) {
      console.error('Error fetching team details:', err);
      alert('Failed to load team details');
    } finally {
      setLoadingTeamDetails(false);
    }
  };

  const handleEditTeam = (team) => {
    setSelectedTeam(team);
    setEditFormData({
      name: team.name,
      description: team.description || ''
    });
    setShowEditTeamModal(true);
  };

  const handleSaveTeam = async () => {
    try {
      await teamsAPI.updateTeam(selectedTeam.id, editFormData);
      setShowEditTeamModal(false);
      fetchData();
      alert('Team updated successfully!');
    } catch (error) {
      console.error('Error updating team:', error);
      alert('Failed to update team');
    }
  };

  const handleRemoveMember = async (studentId) => {
    try {
      await teamsAPI.removeMember(selectedTeam.id, { student_id: studentId });
      fetchData();
      // Refresh team details
      const response = await teamsAPI.getComprehensiveDetails(selectedTeam.id);
      setTeamDetails(response.data);
      alert('Member removed successfully!');
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Failed to remove member');
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam) return;

    try {
      setDeleting(true);
      await teamsAPI.deleteTeam(selectedTeam.id);
      setShowDeleteConfirmModal(false);
      setSelectedTeam(null);
      fetchData();
      alert('Team deleted successfully!');
    } catch (err) {
      console.error('Error deleting team:', err);
      alert('Failed to delete team. Please try again.');
    } finally {
      setDeleting(false);
    }
  };

  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    team.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Filter functions for management modal
  const filteredMembers = (() => {
    const members = teamDetails?.team_members;
    if (!Array.isArray(members)) {
      console.log('team_members is not an array:', members);
      return [];
    }
    return members.filter(member => {
      const matchesSearch = !managementFilters.searchTerm || 
        member.student_name?.toLowerCase().includes(managementFilters.searchTerm.toLowerCase()) ||
        member.student_code?.toLowerCase().includes(managementFilters.searchTerm.toLowerCase());
      const matchesCategory = !managementFilters.category || member.category === managementFilters.category;
      const matchesGrade = !managementFilters.grade || member.grade?.toString() === managementFilters.grade;
      const matchesSection = !managementFilters.section || member.section === managementFilters.section;
      return matchesSearch && matchesCategory && matchesGrade && matchesSection;
    });
  })();

  const filteredEvents = (() => {
    const events = teamDetails?.event_breakdown;
    if (!Array.isArray(events)) {
      console.log('event_breakdown is not an array:', events);
      return [];
    }
    return events.filter(event => {
      const matchesSearch = !managementFilters.searchTerm || 
        event.event_name?.toLowerCase().includes(managementFilters.searchTerm.toLowerCase());
      return matchesSearch;
    });
  })();

  const filteredPrograms = (() => {
    const events = teamDetails?.event_breakdown;
    if (!Array.isArray(events)) {
      console.log('event_breakdown is not an array:', events);
      return [];
    }
    
    // Flatten all programs from all events
    const allPrograms = events.flatMap(event => 
      event.programs?.map(program => ({
        ...program,
        event_name: event.event_name,
        event_id: event.event_id
      })) || []
    );
    
    return allPrograms.filter(program => {
      const matchesSearch = !managementFilters.searchTerm || 
        program.program_name?.toLowerCase().includes(managementFilters.searchTerm.toLowerCase());
      const matchesEvent = !managementFilters.event || program.event_name === managementFilters.event;
      const matchesProgram = !managementFilters.program || program.program_name === managementFilters.program;
      return matchesSearch && matchesEvent && matchesProgram;
    });
  })();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading teams...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Teams Management</h1>
              <p className="text-gray-600 mt-2">
                Manage teams and their login credentials
              </p>
            </div>
            <button 
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
            >
              <Plus className="h-5 w-5" />
              <span>Create Team</span>
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mb-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                placeholder="Search teams..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* Teams Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTeams.map((team) => (
            <div key={team.id} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Team Header */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-blue-100 p-2 rounded-full">
                      <Users className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{team.name}</h3>
                      <p className="text-sm text-gray-600">Participates in all events</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600">{team.member_count} members</p>
                  </div>
                </div>
              </div>

              {/* Team Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <button 
                      onClick={() => handleManage(team)}
                      className="text-sm text-blue-600 hover:text-blue-800 flex items-center space-x-1"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Manage</span>
                    </button>
                    <button 
                      onClick={() => viewCredentials(team)}
                      className="text-sm text-green-600 hover:text-green-800 flex items-center space-x-1"
                    >
                      <Key className="h-4 w-4" />
                      <span>Credentials</span>
                    </button>
                    <button 
                      onClick={() => {
                        setSelectedTeam(team);
                        setShowDeleteConfirmModal(true);
                      }}
                      className="text-sm text-red-600 hover:text-red-800 flex items-center space-x-1"
                    >
                      <Trash2 className="h-4 w-4" />
                      <span>Delete</span>
                    </button>
                  </div>
                  <button 
                    onClick={() => handleEditTeam(team)}
                    className="text-sm text-gray-600 hover:text-gray-800 flex items-center space-x-1"
                  >
                    <Settings className="h-4 w-4" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredTeams.length === 0 && (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No teams found</p>
          </div>
        )}
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Create New Team</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                  placeholder="Optional team description..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                >
                  {creating ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Manage Team Modal */}
      {showManageModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Manage Team - {selectedTeam.name}</h3>
                <button 
                  onClick={() => setShowManageModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {loadingTeamDetails ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Loading team details...</p>
              </div>
            ) : !teamDetails ? (
              <div className="p-6 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-gray-600">Failed to load team details</p>
              </div>
            ) : (
              <div className="p-6">
                {/* Tabs */}
                <div className="flex space-x-1 mb-6 border-b border-gray-200">
                  <button
                    onClick={() => setActiveTab('members')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === 'members'
                        ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Users className="h-4 w-4 inline mr-2" />
                    Members ({Array.isArray(teamDetails?.team_members) ? teamDetails.team_members.length : 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('events')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === 'events'
                        ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Events ({Array.isArray(teamDetails?.event_breakdown) ? teamDetails.event_breakdown.length : 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('programs')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === 'programs'
                        ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-700'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <Target className="h-4 w-4 inline mr-2" />
                    Programs ({(() => {
                      const events = teamDetails?.event_breakdown;
                      if (!Array.isArray(events)) return 0;
                      return events.reduce((total, event) => total + (event.programs?.length || 0), 0);
                    })()})
                  </button>
                </div>

                {/* Filters */}
                <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="relative flex-1">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={managementFilters.searchTerm}
                        onChange={(e) => setManagementFilters({...managementFilters, searchTerm: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    
                    {activeTab === 'members' && (
                      <>
                        <select
                          value={managementFilters.category}
                          onChange={(e) => setManagementFilters({...managementFilters, category: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Categories</option>
                          <option value="hs">High School</option>
                          <option value="hss">Higher Secondary</option>
                        </select>
                        <select
                          value={managementFilters.grade}
                          onChange={(e) => setManagementFilters({...managementFilters, grade: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Grades</option>
                          <option value="9">Grade 9</option>
                          <option value="10">Grade 10</option>
                          <option value="11">Grade 11</option>
                          <option value="12">Grade 12</option>
                        </select>
                        <select
                          value={managementFilters.section}
                          onChange={(e) => setManagementFilters({...managementFilters, section: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Sections</option>
                          <option value="A">Section A</option>
                          <option value="B">Section B</option>
                          <option value="C">Section C</option>
                        </select>
                      </>
                    )}
                    
                    {activeTab === 'programs' && (
                      <>
                        <select
                          value={managementFilters.event}
                          onChange={(e) => setManagementFilters({...managementFilters, event: e.target.value})}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">All Events</option>
                          {Array.isArray(teamDetails?.event_breakdown) ? teamDetails.event_breakdown.map(event => (
                            <option key={event.event_id} value={event.event_name}>{event.event_name}</option>
                          )) : []}
                        </select>
                      </>
                    )}
                  </div>
                </div>

                {/* Tab Content */}
                {activeTab === 'members' && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredMembers.map((member) => (
                      <div key={member.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {member.student_name?.split(' ').map(n => n[0]).join('') || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{member.student_name}</p>
                            <p className="text-sm text-gray-600">
                              {member.student_code} • Grade {member.grade} • {member.category}
                              {member.section && ` • ${member.section}`}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleRemoveMember(member.student_id)}
                          className="px-3 py-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-md text-sm transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    {filteredMembers.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Users className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p>No members found</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'events' && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredEvents.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-green-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{event.event_name}</p>
                            <p className="text-sm text-gray-600">
                              {event.programs_participated} programs • {event.programs_won} wins
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-green-600">{event.total_points || 0} pts</p>
                          <p className="text-xs text-gray-500">{event.win_rate?.toFixed(1) || 0}% win rate</p>
                        </div>
                      </div>
                    ))}
                    {filteredEvents.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p>No events found</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'programs' && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredPrograms.map((program) => (
                      <div key={program.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-purple-100 rounded-full flex items-center justify-center">
                            <Target className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{program.program_name}</p>
                            <p className="text-sm text-gray-600">
                              {program.event_name} • {program.category} • {program.total_students} students
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-purple-600">{program.team_points_earned || 0} pts</p>
                          <p className="text-xs text-gray-500">{program.team_position || 'N/A'}</p>
                        </div>
                      </div>
                    ))}
                    {filteredPrograms.length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        <Target className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                        <p>No programs found</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Edit Team Modal */}
      {showEditTeamModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Edit Team - {selectedTeam.name}</h3>
                <button 
                  onClick={() => setShowEditTeamModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Team Number
                  </label>
                  <input
                    type="text"
                    value={selectedTeam.team_number || 'Not assigned'}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-50 font-mono text-center"
                  />
                  <p className="text-xs text-gray-500 mt-1">Auto-assigned sequential number</p>
                </div>
                {selectedTeam.team_credentials && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-gray-900 mb-3">Team Credentials</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={selectedTeam.team_credentials.username}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">
                          Password
                        </label>
                        <input
                          type="text"
                          value={selectedTeam.team_credentials.password}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3 pt-6">
                <button
                  onClick={() => setShowEditTeamModal(false)}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTeam}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Credentials Modal */}
      {showCredentialsModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Team Credentials - {selectedTeam.name}</h3>
                <button 
                  onClick={() => setShowCredentialsModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {loadingCredentials ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Loading credentials...</p>
                </div>
              ) : teamCredentials ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-medium text-blue-900 mb-3">Login Information</h4>
                    <p className="text-sm text-blue-700 mb-4">
                      Use these credentials to login as this team in the Team Login section.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">
                          Team Username
                        </label>
                        <input
                          type="text"
                          value={teamCredentials.username}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-blue-300 rounded-md bg-white font-mono text-blue-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-blue-700 mb-1">
                          Team Password
                        </label>
                        <input
                          type="text"
                          value={teamCredentials.password}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-blue-300 rounded-md bg-white font-mono text-blue-900"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <h4 className="font-medium text-gray-900 mb-2">Team Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Team ID:</span>
                        <span className="font-medium">{teamCredentials.team_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Created:</span>
                        <span className="font-medium">{new Date(teamCredentials.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => regenerateCredentials(selectedTeam.id)}
                      disabled={regeneratingCredentials[selectedTeam.id]}
                      className="px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 text-sm"
                    >
                      {regeneratingCredentials[selectedTeam.id] ? 'Regenerating...' : 'Regenerate Credentials'}
                    </button>
                    <button
                      onClick={() => setShowCredentialsModal(false)}
                      className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                  <p>Failed to load credentials</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Confirm Deletion</h3>
              <button 
                onClick={() => setShowDeleteConfirmModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-gray-700 mb-4">
              Are you sure you want to delete team "{selectedTeam.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTeam}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete Team'}
              </button>
            </div>
          </div>
        </div>
      )}
      <Pagination
        currentPage={currentPage}
        totalPages={Math.ceil(totalCount / pageSize)}
        totalCount={totalCount}
        pageSize={pageSize}
        onPageChange={setCurrentPage}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCurrentPage(1);
        }}
      />
    </div>
  );
};

export default TeamsPage; 