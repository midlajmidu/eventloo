import React, { useState, useEffect } from 'react';
import { teamsAPI, eventsAPI, categoriesAPI, classesAPI } from '../../services/api';
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
  Target,
  Eye
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

  
  const [categories, setCategories] = useState([]);
  const [classes, setClasses] = useState([]);

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
    fetchCategories();
    fetchClasses();
  }, []);

  const fetchCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data.results || res.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await classesAPI.list();
      setClasses(res.data.results || res.data || []);
    } catch (err) {
      console.error('Error fetching classes:', err);
    }
  };

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
    setSelectedTeam(team);
    setShowCredentialsModal(true);
    setLoadingCredentials(true);
    
    try {
      const response = await teamsAPI.getCredentials(team.id);
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
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <p className="text-slate-600">{error}</p>
          <button 
            onClick={fetchData}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Organization</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Teams</h1><p className="mt-1 text-sm text-slate-500">Manage teams, members and portal credentials.</p></div>
          <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"><Plus className="h-4 w-4" /> Create team</button>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm"><div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" placeholder="Search teams" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100" /></div></section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><p className="text-sm font-semibold text-slate-900">Team directory</p><p className="text-xs text-slate-400">{totalCount} teams</p></div>
          <div className="overflow-x-auto"><table className="min-w-full"><thead className="bg-slate-50/80"><tr>{['Team', 'Members', 'Global score', 'Portal access'].map(label => <th key={label} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</th>)}<th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
            {filteredTeams.map(team => <tr key={team.id} className="transition hover:bg-indigo-50/30"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Users className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-900">{team.name}</p><p className="max-w-[280px] truncate text-xs text-slate-400">{team.description || 'Participates across all events'}</p></div></div></td><td className="px-5 py-3.5 text-sm text-slate-600">{team.member_count || 0}</td><td className="px-5 py-3.5 text-sm font-semibold text-indigo-600">{team.global_points ?? '—'}{team.global_points != null ? '%' : ''}</td><td className="px-5 py-3.5"><button onClick={() => viewCredentials(team)} className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-indigo-700"><Key className="h-3.5 w-3.5" /> Credentials</button></td><td className="px-5 py-3.5"><div className="flex justify-end gap-2"><button onClick={() => handleManage(team)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"><Eye className="h-3.5 w-3.5" /> View</button><button onClick={() => handleEditTeam(team)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700" title="Edit team"><Settings className="h-4 w-4" /></button><button onClick={() => { setSelectedTeam(team); setShowDeleteConfirmModal(true); }} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-100 hover:bg-red-50 hover:text-red-600" title="Delete team"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}
          </tbody></table></div>

          {filteredTeams.length === 0 && <div className="py-16 text-center"><Users className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-900">No teams found</p></div>}
          {filteredTeams.length > 0 && <div className="border-t border-slate-100 px-5 py-3"><Pagination currentPage={currentPage} totalPages={Math.ceil(totalCount / pageSize)} onPageChange={setCurrentPage} pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} totalCount={totalCount} /></div>}
        </section>
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Create New Team</h3>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={createFormData.name}
                  onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  value={createFormData.description}
                  onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  rows="3"
                  placeholder="Optional team description..."
                />
              </div>
              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50"
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
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Manage Team - {selectedTeam.name}</h3>
                <button 
                  onClick={() => setShowManageModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            
            {loadingTeamDetails ? (
              <div className="p-6 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-slate-600">Loading team details...</p>
              </div>
            ) : !teamDetails ? (
              <div className="p-6 text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <p className="text-slate-600">Failed to load team details</p>
              </div>
            ) : (
              <div className="p-6">
                {/* Tabs */}
                <div className="flex space-x-1 mb-6 border-b border-slate-200">
                  <button
                    onClick={() => setActiveTab('members')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === 'members'
                        ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-700'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Users className="h-4 w-4 inline mr-2" />
                    Members ({Array.isArray(teamDetails?.team_members) ? teamDetails.team_members.length : 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('events')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === 'events'
                        ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-700'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <Calendar className="h-4 w-4 inline mr-2" />
                    Events ({Array.isArray(teamDetails?.event_breakdown) ? teamDetails.event_breakdown.length : 0})
                  </button>
                  <button
                    onClick={() => setActiveTab('programs')}
                    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                      activeTab === 'programs'
                        ? 'bg-indigo-50 text-indigo-700 border-b-2 border-indigo-700'
                        : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
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
                <div className="mb-6 p-4 bg-slate-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="relative flex-1">
                      <Search className="h-4 w-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder={`Search ${activeTab}...`}
                        value={managementFilters.searchTerm}
                        onChange={(e) => setManagementFilters({...managementFilters, searchTerm: e.target.value})}
                        className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                    
                    {activeTab === 'members' && (
                      <>
                        <select
                          value={managementFilters.category}
                          onChange={(e) => setManagementFilters({...managementFilters, category: e.target.value, grade: ''})}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                        >
                          <option value="">All Categories</option>
                          {categories.filter(c => !c.is_mixing).map(cat => (
                            <option key={cat.code} value={cat.code}>{cat.name}</option>
                          ))}
                        </select>
                        <select
                          value={managementFilters.grade}
                          onChange={(e) => setManagementFilters({...managementFilters, grade: e.target.value})}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                        >
                          <option value="">All Grades</option>
                          {(() => {
                            const standardClasses = classes.filter(cls => {
                              if (!cls.category) return false;
                              const cat = categories.find(c => c.id === cls.category);
                              return cat && !cat.is_mixing;
                            });
                            return (managementFilters.category 
                              ? standardClasses.filter(cls => {
                                  const cat = categories.find(c => c.code === managementFilters.category);
                                  return cat && cat.class_ids?.includes(cls.id);
                                })
                              : standardClasses
                            ).map(cls => (
                              <option key={cls.code} value={cls.code}>{cls.name}</option>
                            ));
                          })()}
                        </select>
                        <select
                          value={managementFilters.section}
                          onChange={(e) => setManagementFilters({...managementFilters, section: e.target.value})}
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
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
                          className="px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
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
                      <div key={member.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <span className="text-indigo-600 font-semibold text-sm">
                              {member.student_name?.split(' ').map(n => n[0]).join('') || 'U'}
                            </span>
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{member.student_name}</p>
                            <p className="text-sm text-slate-600">
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
                      <div className="text-center py-8 text-slate-500">
                        <Users className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                        <p>No members found</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'events' && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredEvents.map((event) => (
                      <div key={event.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-indigo-100 rounded-full flex items-center justify-center">
                            <Calendar className="h-5 w-5 text-indigo-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{event.event_name}</p>
                            <p className="text-sm text-slate-600">
                              {event.programs_participated} programs • {event.programs_won} wins
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-indigo-600">{event.total_points || 0} pts</p>
                          <p className="text-xs text-slate-500">{event.win_rate?.toFixed(1) || 0}% win rate</p>
                        </div>
                      </div>
                    ))}
                    {filteredEvents.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <Calendar className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                        <p>No events found</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'programs' && (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {filteredPrograms.map((program) => (
                      <div key={program.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center space-x-3">
                          <div className="h-10 w-10 bg-violet-100 rounded-full flex items-center justify-center">
                            <Target className="h-5 w-5 text-violet-600" />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{program.program_name}</p>
                            <p className="text-sm text-slate-600">
                              {program.event_name} • {program.category} • {program.total_students} students
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-medium text-violet-600">{program.team_points_earned || 0} pts</p>
                          <p className="text-xs text-slate-500">{program.team_position || 'N/A'}</p>
                        </div>
                      </div>
                    ))}
                    {filteredPrograms.length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <Target className="h-12 w-12 text-slate-300 mx-auto mb-2" />
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
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Edit Team - {selectedTeam.name}</h3>
                <button 
                  onClick={() => setShowEditTeamModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Team Name
                  </label>
                  <input
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                    rows="3"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Team Number
                  </label>
                  <input
                    type="text"
                    value={selectedTeam.team_number || 'Not assigned'}
                    readOnly
                    className="w-full px-3 py-2 border border-slate-300 rounded-md bg-slate-50 font-mono text-center"
                  />
                  <p className="text-xs text-slate-500 mt-1">Auto-assigned sequential number</p>
                </div>
                {selectedTeam.team_credentials && (
                  <div className="border-t pt-4">
                    <h4 className="font-medium text-slate-900 mb-3">Team Credentials</h4>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Username
                        </label>
                        <input
                          type="text"
                          value={selectedTeam.team_credentials.username}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-slate-50 font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">
                          Password
                        </label>
                        <input
                          type="text"
                          value={selectedTeam.team_credentials.password}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-slate-300 rounded-md bg-slate-50 font-mono"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3 pt-6">
                <button
                  onClick={() => setShowEditTeamModal(false)}
                  className="px-4 py-2 text-slate-600 hover:text-slate-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveTeam}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
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
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="p-6 border-b border-slate-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold">Team Credentials - {selectedTeam.name}</h3>
                <button 
                  onClick={() => setShowCredentialsModal(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
            <div className="p-6">
              {loadingCredentials ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-slate-600">Loading credentials...</p>
                </div>
              ) : teamCredentials ? (
                <div className="space-y-4">
                  <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                    <h4 className="font-medium text-indigo-900 mb-3">Login Information</h4>
                    <p className="text-sm text-indigo-700 mb-4">
                      Use these credentials to login as this team in the Team Login section.
                    </p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-indigo-700 mb-1">
                          Team Username
                        </label>
                        <input
                          type="text"
                          value={teamCredentials.username}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-md bg-white font-mono text-indigo-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-indigo-700 mb-1">
                          Team Password
                        </label>
                        <input
                          type="text"
                          value={teamCredentials.password}
                          readOnly
                          className="w-full px-3 py-2 text-sm border border-indigo-300 rounded-md bg-white font-mono text-indigo-900"
                        />
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h4 className="font-medium text-slate-900 mb-2">Team Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Team ID:</span>
                        <span className="font-medium">{teamCredentials.team_id}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Created:</span>
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
                      className="px-4 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700 text-sm"
                    >
                      Close
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                  <p>Failed to load credentials</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmModal && selectedTeam && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Confirm Deletion</h3>
              <button 
                onClick={() => setShowDeleteConfirmModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-slate-700 mb-4">
              Are you sure you want to delete team "{selectedTeam.name}"? This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteConfirmModal(false)}
                className="px-4 py-2 text-slate-600 hover:text-slate-800"
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
    </main>
  );
};

export default TeamsPage; 
