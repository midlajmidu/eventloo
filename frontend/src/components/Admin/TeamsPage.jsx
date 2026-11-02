import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
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
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import Pagination from '../common/Pagination';

const TeamsPage = () => {
  const location = useLocation();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [regeneratingCredentials, setRegeneratingCredentials] = useState({});
  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'create' || params.get('create') === 'true') {
      setShowCreateModal(true);
    }
  }, [location.search]);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    description: '',
    team_username: '',
    team_password: '',
  });
  const [showCreatePassword, setShowCreatePassword] = useState(false);
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
    description: '',
    team_username: '',
    team_password: '',
  });
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [savingTeam, setSavingTeam] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [teamDetails, setTeamDetails] = useState(null);
  const [loadingTeamDetails, setLoadingTeamDetails] = useState(false);
  const [teamCredentials, setTeamCredentials] = useState(null);
  const [loadingCredentials, setLoadingCredentials] = useState(false);
  const [credForm, setCredForm] = useState({ username: '', password: '' });
  const [showCredPassword, setShowCredPassword] = useState(false);
  const [savingCredentials, setSavingCredentials] = useState(false);
  const [credentialsSuccess, setCredentialsSuccess] = useState('');
  const [copiedKey, setCopiedKey] = useState(false);

  
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
    if (!createFormData.name || !createFormData.name.trim()) {
      alert('Please fill in the team name');
      return;
    }

    try {
      setCreating(true);
      const teamData = {
        name: createFormData.name.trim(),
        description: createFormData.description.trim()
      };
      if (createFormData.team_username && createFormData.team_username.trim()) {
        teamData.team_username = createFormData.team_username.trim();
      }
      if (createFormData.team_password && createFormData.team_password.trim()) {
        teamData.team_password = createFormData.team_password.trim();
      }

      await teamsAPI.createTeam(teamData);
      setShowCreateModal(false);
      setCreateFormData({
        name: '',
        description: '',
        team_username: '',
        team_password: '',
      });
      fetchData();
      alert('Team and leader account created successfully!');
    } catch (err) {
      console.error('Error creating team:', err);
      const data = err.response?.data;
      const msg = data?.team_username || data?.team_password || data?.error || data?.detail || 'Failed to create team. Please try again.';
      alert(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally {
      setCreating(false);
    }
  };

  const viewCredentials = async (team) => {
    setSelectedTeam(team);
    setShowCredentialsModal(true);
    setLoadingCredentials(true);
    setCredentialsSuccess('');
    
    try {
      const response = await teamsAPI.getCredentials(team.id);
      setTeamCredentials(response.data);
      setCredForm({
        username: response.data.username || team.team_username || '',
        password: response.data.password || '',
      });
    } catch (err) {
      console.error('Error fetching credentials:', err);
      alert('Failed to load team credentials');
    } finally {
      setLoadingCredentials(false);
    }
  };

  const handleSaveCredentials = async () => {
    if (!selectedTeam) return;
    if (!credForm.username.trim()) {
      alert('Username cannot be empty');
      return;
    }

    try {
      setSavingCredentials(true);
      setCredentialsSuccess('');
      const payload = {
        username: credForm.username.trim(),
      };
      if (credForm.password.trim()) {
        payload.password = credForm.password.trim();
      }

      const response = await teamsAPI.setCredentials(selectedTeam.id, payload);
      setTeamCredentials(response.data);
      setCredentialsSuccess('Team leader credentials updated successfully!');
      
      // Update team in local state
      setTeams(prevTeams => 
        prevTeams.map(t => 
          t.id === selectedTeam.id 
            ? { ...t, team_username: response.data.username }
            : t
        )
      );
    } catch (err) {
      console.error('Error updating credentials:', err);
      const data = err.response?.data;
      const msg = data?.error || data?.username || data?.password || 'Failed to update credentials';
      alert(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally {
      setSavingCredentials(false);
    }
  };

  const handleCopyCredentials = () => {
    if (!teamCredentials) return;
    const text = `Team: ${teamCredentials.team_name}\nUsername: ${credForm.username || teamCredentials.username}\nPassword: ${credForm.password || teamCredentials.password || '(Current password)'}`;
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const regenerateCredentials = async (teamId) => {
    try {
      setRegeneratingCredentials(prev => ({ ...prev, [teamId]: true }));
      setCredentialsSuccess('');
      const response = await teamsAPI.regenerateCredentials(teamId);
      
      // Update the team in the local state
      setTeams(prevTeams => 
        prevTeams.map(team => 
          team.id === teamId 
            ? { ...team, team_username: response.data.username, team_credentials: response.data }
            : team
        )
      );
      
      // Update credentials in modal if open
      if (showCredentialsModal && selectedTeam && selectedTeam.id === teamId) {
        setTeamCredentials(response.data);
        setCredForm({
          username: response.data.username,
          password: response.data.password,
        });
        setCredentialsSuccess('New random credentials generated successfully!');
      }
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
      description: team.description || '',
      team_username: team.team_username || '',
      team_password: '',
    });
    setShowEditTeamModal(true);
  };

  const handleSaveTeam = async () => {
    if (!selectedTeam) return;
    try {
      setSavingTeam(true);
      const payload = {
        name: editFormData.name.trim(),
        description: editFormData.description.trim(),
      };
      if (editFormData.team_username.trim()) {
        payload.team_username = editFormData.team_username.trim();
      }
      if (editFormData.team_password.trim()) {
        payload.team_password = editFormData.team_password.trim();
      }
      await teamsAPI.updateTeam(selectedTeam.id, payload);
      setShowEditTeamModal(false);
      fetchData();
      alert('Team updated successfully!');
    } catch (error) {
      console.error('Error updating team:', error);
      const data = error.response?.data;
      const msg = data?.team_username || data?.team_password || data?.error || 'Failed to update team';
      alert(Array.isArray(msg) ? msg.join(' ') : msg);
    } finally {
      setSavingTeam(false);
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
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Organization</p>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Teams</h1>
            <p className="text-xs text-slate-400 mt-1 font-normal">Manage teams, members and portal credentials.</p>
          </div>
          <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-indigo-700">
            <Plus className="h-3.5 w-3.5" /> Create team
          </button>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm"><div className="relative max-w-xl"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="search" placeholder="Search teams" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100" /></div></section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><p className="text-sm font-semibold text-slate-900">Team directory</p><p className="text-xs text-slate-400">{totalCount} teams</p></div>
          <div className="overflow-x-auto"><table className="min-w-full"><thead className="bg-slate-50/80"><tr>{['Team', 'Members', 'Global score', 'Portal access'].map(label => <th key={label} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</th>)}<th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
            {filteredTeams.map(team => <tr key={team.id} className="transition hover:bg-indigo-50/30"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600"><Users className="h-4 w-4" /></div><div><p className="text-sm font-semibold text-slate-900">{team.name}</p><p className="max-w-[280px] truncate text-xs text-slate-400">{team.description || 'Participates across all events'}</p></div></div></td><td className="px-5 py-3.5 text-sm text-slate-600">{team.member_count || 0}</td><td className="px-5 py-3.5 text-sm font-semibold text-indigo-600">{team.global_points ?? '—'}{team.global_points != null ? '%' : ''}</td><td className="px-5 py-3.5"><div className="flex flex-col items-start gap-1">{team.team_username ? (<span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">@{team.team_username}</span>) : (<span className="text-[11px] text-slate-400 italic">No account</span>)}<button onClick={() => viewCredentials(team)} className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"><Key className="h-3 w-3" /> Manage Login</button></div></td><td className="px-5 py-3.5"><div className="flex justify-end gap-2"><button onClick={() => handleManage(team)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"><Eye className="h-3.5 w-3.5" /> View</button><button onClick={() => handleEditTeam(team)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700" title="Edit team"><Settings className="h-4 w-4" /></button><button onClick={() => { setSelectedTeam(team); setShowDeleteConfirmModal(true); }} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-100 hover:bg-red-50 hover:text-red-600" title="Delete team"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}
          </tbody></table></div>

          {filteredTeams.length === 0 && <div className="py-16 text-center"><Users className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-900">No teams found</p></div>}
          {filteredTeams.length > 0 && <div className="border-t border-slate-100 px-5 py-3"><Pagination currentPage={currentPage} totalPages={Math.ceil(totalCount / pageSize)} onPageChange={setCurrentPage} pageSize={pageSize} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} totalCount={totalCount} /></div>}
        </section>
      </div>

      {/* Create Team Slide-Over Drawer */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
            onClick={() => setShowCreateModal(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 md:pl-10">
            <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
              
              {/* Header */}
              <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Create New Team</h3>
                    <p className="text-xs text-slate-500">Configure team profile and team leader credentials.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Form Content */}
              <form id="create-team-drawer-form" onSubmit={handleCreateTeam} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-3.5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Team Information</h4>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Team Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={createFormData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        const autoUsername = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_') + '_leader';
                        setCreateFormData({
                          ...createFormData,
                          name,
                          team_username: (!createFormData.team_username || createFormData.team_username.endsWith('_leader')) ? autoUsername : createFormData.team_username
                        });
                      }}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                      placeholder="e.g. Phoenix, Red Warriors, Blue Hawks"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Description <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      value={createFormData.description}
                      onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                      rows="2"
                      placeholder="Optional team description..."
                    />
                  </div>
                </div>

                {/* Team Leader Login Credentials Section */}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center">
                        <Key className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                        Team Leader Login Account
                      </h4>
                      <p className="text-[11px] text-indigo-700 mt-0.5">Set credentials for the team leader dashboard</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const rand = Math.random().toString(36).slice(-6);
                        const base = createFormData.name ? createFormData.name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 5) : 'team';
                        setCreateFormData({
                          ...createFormData,
                          team_password: `${base}#${rand}!`
                        });
                      }}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-xs transition"
                    >
                      Suggest Password
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Team Leader Username
                    </label>
                    <input
                      type="text"
                      value={createFormData.team_username}
                      onChange={(e) => setCreateFormData({ ...createFormData, team_username: e.target.value })}
                      className="w-full px-3 py-2 text-sm font-mono border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                      placeholder="e.g. phoenix_leader"
                    />
                    <p className="text-[10px] text-slate-400 mt-1">Leave blank to auto-generate based on team name.</p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Team Leader Password
                    </label>
                    <div className="relative">
                      <input
                        type={showCreatePassword ? "text" : "password"}
                        value={createFormData.team_password}
                        onChange={(e) => setCreateFormData({ ...createFormData, team_password: e.target.value })}
                        className="w-full px-3 py-2 text-sm font-mono border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 pr-9"
                        placeholder="Enter secure password (min 6 chars)"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCreatePassword(!showCreatePassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showCreatePassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-1">Leave blank to auto-generate a secure random password.</p>
                  </div>
                </div>
              </form>

              {/* Sticky Footer */}
              <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="create-team-drawer-form"
                  disabled={creating}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {creating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Creating Team...</span>
                    </>
                  ) : (
                    <span>Create Team & Account</span>
                  )}
                </button>
              </div>

            </div>
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

      {/* Edit Team Slide-Over Drawer */}
      {showEditTeamModal && selectedTeam && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          <div 
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity animate-in fade-in duration-200" 
            onClick={() => setShowEditTeamModal(false)}
          />
          <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 md:pl-10">
            <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
              
              {/* Sticky Header */}
              <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900">Edit Team</h3>
                    <p className="text-xs text-slate-500">Update details & login account for {selectedTeam.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditTeamModal(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Scrollable Form Content */}
              <form 
                id="edit-team-drawer-form" 
                onSubmit={(e) => { e.preventDefault(); handleSaveTeam(); }}
                className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
              >
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Basic Team Details
                  </h4>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Team Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      placeholder="e.g. Phoenix Warriors"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={editFormData.description}
                      onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                      placeholder="Brief description or motto of the team..."
                      rows="3"
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Team Number
                    </label>
                    <input
                      type="text"
                      value={selectedTeam.team_number || 'Not assigned'}
                      readOnly
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-slate-100 text-slate-600 font-mono text-center cursor-not-allowed"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">Auto-assigned sequential team identifier.</p>
                  </div>
                </div>

                {/* Team Leader Login Credentials Section */}
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 flex items-center">
                        <Key className="h-3.5 w-3.5 mr-1.5 text-indigo-600" />
                        Team Leader Login Account
                      </h4>
                      <p className="text-[11px] text-indigo-700 mt-0.5">Manage credentials for the team leader dashboard</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
                        let pwd = '';
                        for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                        setEditFormData({ ...editFormData, team_password: pwd });
                      }}
                      className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 bg-white px-2.5 py-1 rounded-md border border-indigo-200 shadow-xs transition flex items-center gap-1"
                    >
                      <Sparkles className="h-3 w-3" /> Generate Password
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Leader Username
                    </label>
                    <input
                      type="text"
                      value={editFormData.team_username}
                      onChange={(e) => setEditFormData({ ...editFormData, team_username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                      placeholder="e.g. red_phoenix_lead"
                      className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Leader will use this username to log in to the portal.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Change Password
                    </label>
                    <div className="relative">
                      <input
                        type={showEditPassword ? 'text' : 'password'}
                        value={editFormData.team_password}
                        onChange={(e) => setEditFormData({ ...editFormData, team_password: e.target.value })}
                        placeholder="Leave blank to keep existing password"
                        className="w-full px-3 py-2 text-sm border border-indigo-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500 font-mono pr-9"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showEditPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1">
                      Only enter a password if you want to set a new one (min 6 characters).
                    </p>
                  </div>
                </div>
              </form>

              {/* Sticky Footer */}
              <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setShowEditTeamModal(false)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="edit-team-drawer-form"
                  disabled={savingTeam}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
                >
                  {savingTeam ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Team Credentials Modal */}
      {showCredentialsModal && selectedTeam && (
        <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
            <div className="p-6 border-b border-slate-200 bg-gradient-to-r from-slate-50 to-indigo-50/40">
              <div className="flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-sm">
                    <Key className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">Team Leader Account</h3>
                    <p className="text-xs text-slate-600">
                      Manage authentication credentials for <span className="font-semibold text-indigo-700">{selectedTeam.name}</span>
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowCredentialsModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-white/80 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-5">
              {credentialsSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center space-x-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span>{credentialsSuccess}</span>
                </div>
              )}

              {loadingCredentials ? (
                <div className="text-center py-10">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-slate-600 text-sm">Loading leader credentials...</p>
                </div>
              ) : teamCredentials ? (
                <div className="space-y-4">
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Team Leader Username
                      </label>
                      <input
                        type="text"
                        value={credForm.username}
                        onChange={(e) => setCredForm({ ...credForm, username: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, '') })}
                        placeholder="e.g. lead_dragons"
                        className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                      />
                      <p className="text-[11px] text-slate-500 mt-1">
                        Team leader signs in with this username at the login page.
                      </p>
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          Password {credForm.password ? '(New Password)' : '(Current Password)'}
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%';
                            let pwd = '';
                            for (let i = 0; i < 10; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length));
                            setCredForm({ ...credForm, password: pwd });
                          }}
                          className="text-[11px] font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                        >
                          <Sparkles className="h-3 w-3" /> Suggest Strong Password
                        </button>
                      </div>
                      <div className="relative">
                        <input
                          type={showCredPassword ? 'text' : 'password'}
                          value={credForm.password}
                          onChange={(e) => setCredForm({ ...credForm, password: e.target.value })}
                          placeholder={teamCredentials.password || 'Enter new password to update...'}
                          className="w-full px-3 py-2 pr-10 text-sm border border-slate-300 rounded-lg bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500"
                        />
                        <button
                          type="button"
                          onClick={() => setShowCredPassword(!showCredPassword)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                          {showCredPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-1">
                        {credForm.password 
                          ? 'This new password will be hashed and saved for the leader upon clicking Save.' 
                          : 'Leave blank to keep the current password unchanged.'}
                      </p>
                    </div>

                    <div className="pt-2 flex items-center justify-between border-t border-slate-200">
                      <button
                        type="button"
                        onClick={handleCopyCredentials}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        {copiedKey ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5 text-slate-500" />}
                        <span>{copiedKey ? 'Copied to Clipboard!' : 'Copy Login Details'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleSaveCredentials}
                        disabled={savingCredentials}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm disabled:opacity-50"
                      >
                        {savingCredentials ? (
                          <>
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white"></div>
                            <span>Saving...</span>
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>Save Credentials</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <button
                      onClick={() => regenerateCredentials(selectedTeam.id)}
                      disabled={regeneratingCredentials[selectedTeam.id]}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 disabled:opacity-50 transition-colors"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${regeneratingCredentials[selectedTeam.id] ? 'animate-spin' : ''}`} />
                      <span>{regeneratingCredentials[selectedTeam.id] ? 'Regenerating...' : 'Generate Random Credentials'}</span>
                    </button>

                    <button
                      onClick={() => setShowCredentialsModal(false)}
                      className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-800 text-xs font-medium transition-colors"
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500">
                  <AlertCircle className="h-10 w-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm">Failed to load credentials</p>
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
