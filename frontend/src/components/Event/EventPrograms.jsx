import React, { useState, useEffect } from 'react';
import { eventProgramsAPI, eventStagesAPI, eventsAPI, markEntryAPI, eventAssignmentsAPI } from '../../services/api';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Clock, 
  MapPin, 
  Users, 
  Upload,
  Calendar,
  CheckCircle,
  XCircle,
  Filter,
  Eye,
  MoreVertical,
  X,
  Award
} from 'lucide-react';
import Pagination from '../common/Pagination';

const DEFAULT_GRADE_RULES = [
  { name: 'A+', min_mark: 90, max_mark: 100 },
  { name: 'A', min_mark: 80, max_mark: 89.99 },
  { name: 'B+', min_mark: 70, max_mark: 79.99 },
  { name: 'B', min_mark: 60, max_mark: 69.99 },
];

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const EventPrograms = ({ event, eventId, onRefresh, categories = [] }) => {
  const [programs, setPrograms] = useState([]);
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [showProgramBulkUpload, setShowProgramBulkUpload] = useState(false);
  const [selectedViewProgram, setSelectedViewProgram] = useState(null);
  
  // 3-dots menu & Assigned Students state
  const [openMenuId, setOpenMenuId] = useState(null);
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [loadingAssignedStudents, setLoadingAssignedStudents] = useState(false);
  
  // Filter and sort states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('start_time');
  
  // Add program type filter state
  const [programTypeFilter, setProgramTypeFilter] = useState('all'); // 'all', 'stage', 'off_stage'
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState({
    hs: 0,
    hss: 0,
    general: 0,
    total: 0
  });
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'general',
    venue: '',
    stage_id: '',
    max_participants: '',
    is_team_based: false,
    team_size: '',
    max_teams_per_school: '1',
    start_time: '',
    duration_minutes_per_entry: '5',
    program_type: 'stage', // new field
    grading_points: {},
    num_judges: event?.num_judges ? String(event.num_judges) : '3',
  });
  const activeGradeRules = Array.isArray(event?.grading_rules) && event.grading_rules.length > 0
    ? event.grading_rules
    : DEFAULT_GRADE_RULES;

  // Click outside to close 3-dots menu
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openMenuId && !e.target.closest('.relative')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenuId]);

  useEffect(() => {
    fetchPrograms();
  }, [eventId, categoryFilter, statusFilter, sortBy, currentPage, pageSize, searchTerm, programTypeFilter]);

  useEffect(() => {
    const actualEventId = eventId || event?.id;
    if (!actualEventId) return;
    eventStagesAPI.list(actualEventId, { page_size: 500 })
      .then((response) => setStages(response.data.results || response.data || []))
      .catch(() => setStages([]));
  }, [eventId, event?.id]);

  const fetchPrograms = async () => {
    try {
      setLoading(true);
      const actualEventId = eventId || event?.id;
      
      // Build query parameters
      const params = new URLSearchParams();
      if (categoryFilter !== 'all') {
        params.append('category', categoryFilter);
      }
      if (statusFilter !== 'all') {
        params.append('status', statusFilter);
      }
      if (searchTerm) {
        params.append('search', searchTerm);
      }
      if (programTypeFilter !== 'all') {
        params.append('program_type', programTypeFilter);
      }
      params.append('ordering', sortBy);
      params.append('page', currentPage);
      params.append('page_size', pageSize);
      
      const response = await eventProgramsAPI.getPrograms(actualEventId, params.toString());
      
      // Handle paginated response
      if (response.data.results) {
        // Paginated response
        setPrograms(response.data.results);
        setTotalCount(response.data.count || 0);
        setTotalPages(response.data.total_pages || Math.ceil((response.data.count || 0) / pageSize));
        
        // Set category counts if available
        if (response.data.category_counts) {
          setCategoryCounts(response.data.category_counts);
        }
      } else {
        // Non-paginated response (fallback)
        const programsData = Array.isArray(response.data) ? response.data : [];
        setPrograms(programsData);
        setTotalCount(programsData.length);
        setTotalPages(1);
      }
    } catch (error) {
      console.error('Error fetching programs:', error);
      setPrograms([]); // Set to empty array on error
      setTotalCount(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };



  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  const handlePageSizeChange = (newPageSize) => {
    setPageSize(newPageSize);
    setCurrentPage(1); // Reset to first page when changing page size
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Client-side validation
    if (!formData.is_team_based && (!formData.max_participants || formData.max_participants <= 0)) {
      alert('Total Participants in Each Team is required for individual programs. Please enter a positive number.');
      return;
    }
    
    if (formData.is_team_based && (!formData.max_teams_per_school || formData.max_teams_per_school <= 0)) {
      alert('Teams allowed per team or group is required for team-based programs. Please enter a positive number.');
      return;
    }

    if (formData.is_team_based && (!formData.team_size || formData.team_size <= 0)) {
      alert('Team Size (Members per Sub-Team) is required for team-based programs. Please enter a positive number.');
      return;
    }
    if (!formData.duration_minutes_per_entry || Number(formData.duration_minutes_per_entry) < 1) {
      alert('Duration per participant or group must be at least 1 minute.');
      return;
    }
    if (formData.start_time && !formData.stage_id) {
      alert('Select a stage before scheduling this program.');
      return;
    }
    
    try {
      const actualEventId = eventId || event?.id;
      
      const programData = {
        ...formData,
        num_judges: formData.num_judges ? parseInt(formData.num_judges, 10) : (event?.num_judges || 3),
        stage_id: formData.stage_id ? Number(formData.stage_id) : null,
        max_participants: formData.is_team_based ? null : parseInt(formData.max_participants) || null,
        team_size: formData.is_team_based ? parseInt(formData.team_size) || null : null,
        max_teams_per_school: formData.is_team_based ? parseInt(formData.max_teams_per_school) || 1 : 1,
        start_time: formData.start_time || null,
        duration_minutes_per_entry: parseInt(formData.duration_minutes_per_entry, 10),
        program_type: formData.program_type || 'stage',
        grading_points: Object.fromEntries(
          Object.entries(formData.grading_points || {})
            .filter(([grade]) => activeGradeRules.some((rule) => rule.name === grade))
            .filter(([, points]) => points !== '' && points !== null && points !== undefined)
            .map(([grade, points]) => [grade, parseInt(points, 10)])
        ),
      };

      if (editingProgram) {
        await eventProgramsAPI.updateProgram(actualEventId, editingProgram.id, programData);
        alert('Program updated successfully!');
      } else {
        await eventProgramsAPI.createProgram(actualEventId, programData);
        alert('Program created successfully!');
      }

      setShowAddModal(false);
      setEditingProgram(null);
      resetForm();
      fetchPrograms();
    } catch (error) {
      console.error('Error saving program:', error);
      const details = error.response?.data;
      const message = details && typeof details === 'object'
        ? Object.entries(details)
            .map(([field, value]) => `${field.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : value}`)
            .join('\n')
        : (details?.detail || error.message || 'Please try again.');
      alert(`Unable to save program.\n${message}`);
    }
  };

  const handleEdit = (program) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      description: program.description || '',
      category: program.category || 'general',
      venue: program.venue || '',
      stage_id: program.stage?.id || '',
      max_participants: program.max_participants || '',
      is_team_based: program.is_team_based,
      team_size: program.team_size || '',
      max_teams_per_school: program.max_teams_per_school || '1',
      start_time: toDateTimeLocal(program.start_time),
      duration_minutes_per_entry: program.duration_minutes_per_entry || '5',
      program_type: program.program_type || 'stage',
      grading_points: program.grading_points || {},
      num_judges: String(program.num_judges || program.effective_num_judges || event?.num_judges || 3),
    });
    setShowAddModal(true);
  };

  // Open Program View Drawer & Load Assigned Students
  const handleOpenViewProgram = async (program) => {
    setOpenMenuId(null);
    setSelectedViewProgram(program);
    setLoadingAssignedStudents(true);
    setAssignedStudents([]);

    try {
      const actualEventId = eventId || event?.id;
      const res = await markEntryAPI.getParticipants(actualEventId, program.id);
      let participants = res.data || [];

      if (!participants || participants.length === 0) {
        try {
          const assgRes = await eventAssignmentsAPI.getProgramAssignments(actualEventId, program.id);
          participants = assgRes.data || [];
        } catch (err) {
          console.log('Fallback assignments fetch error:', err);
        }
      }

      setAssignedStudents(participants);
    } catch (error) {
      console.error('Error loading assigned students:', error);
      setAssignedStudents([]);
    } finally {
      setLoadingAssignedStudents(false);
    }
  };

  // Handle category change
  const handleCategoryChange = (category) => {
    const newFormData = { ...formData, category };
    setFormData(newFormData);
  };

  // Team-based is now available for all categories
  const isTeamBasedDisabled = false;

  // Get points system description based on category and team-based status
  const getPointsSystemDescription = (category, isTeamBased) => {
    if (isTeamBased) {
      return "Points: 10, 6, 3 (Team-based)";
    }
    const cat = categories.find(c => c.code === category);
    if (cat && cat.is_mixing) {
      return "Points: 10, 6, 3 (Individual)";
    }
    if (category === 'general') {
      return "Points: 10, 6, 3 (Individual)";
    }
    return "Points: 5, 3, 1 (Individual)";
  };

  const handleDelete = async (programId) => {
    if (window.confirm('Are you sure you want to delete this program?')) {
      try {
        const actualEventId = eventId || event?.id;
        await eventProgramsAPI.deleteProgram(actualEventId, programId);
        alert('Program deleted successfully!');
        fetchPrograms();
      } catch (error) {
        console.error('Error deleting program:', error);
        alert('Error deleting program. Please try again.');
      }
    }
  };

  const handleMarkFinished = async (programId, isFinished) => {
    try {
      const actualEventId = eventId || event?.id;
      const endpoint = isFinished ? 'mark_finished' : 'mark_unfinished';
      await eventProgramsAPI.markProgramFinished(actualEventId, programId, endpoint);
      alert(`Program ${isFinished ? 'marked as finished' : 'marked as not finished'} successfully!`);
      fetchPrograms();
    } catch (error) {
      console.error('Error updating program status:', error);
      alert('Error updating program status. Please try again.');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      category: 'general',
      venue: '',
      stage_id: '',
      max_participants: '',
      is_team_based: false,
      team_size: '',
      max_teams_per_school: '1',
      start_time: '',
      duration_minutes_per_entry: '5',
      program_type: 'stage',
      grading_points: {},
      num_judges: event?.num_judges ? String(event.num_judges) : '3',
    });
  };

  // Filter programs by program_type on the frontend (in addition to backend filters)
  const filteredPrograms = programs.filter((program) => {
    if (programTypeFilter === 'all') return true;
    return program.program_type === programTypeFilter;
  });

  // Handle search - reset to first page when searching
  const handleSearch = (value) => {
    setSearchTerm(value);
    setCurrentPage(1);
  };

  const getCategoryDisplay = (category) => {
    const cat = categories.find(c => c.code === category);
    return cat ? cat.name : (category?.toUpperCase() || category);
  };

  const getCategoryBadge = (category) => {
    const cat = categories.find(c => c.code === category);
    if (category === 'hs') return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    if (category === 'hss') return 'bg-green-100 text-green-800 border-green-200';
    if (category === 'general' || (cat && cat.is_mixing)) return 'bg-purple-100 text-purple-800 border-purple-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusDisplay = (program) => {
    if (program.is_finished) return 'Finished';
    if (!program.start_time) return 'Upcoming';
    
    const now = new Date();
    const startTime = new Date(program.start_time);
    
    if (isNaN(startTime.getTime())) return 'Upcoming';
    if (now < startTime) return 'Upcoming';
    
    if (program.end_time) {
      const endTime = new Date(program.end_time);
      if (!isNaN(endTime.getTime())) {
        if (now >= startTime && now <= endTime) return 'Ongoing';
        if (now > endTime) return 'Past';
      }
    }
    
    return 'Ongoing';
  };

  const getStatusColor = (status) => {
    const colors = {
      'Upcoming': 'bg-indigo-100 text-indigo-800',
      'Ongoing': 'bg-green-100 text-green-800',
      'Finished': 'bg-gray-100 text-gray-800',
      'Past': 'bg-yellow-100 text-yellow-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const formatDateTime = (dateTimeString) => {
    if (!dateTimeString) return '-';
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Calculate category-wise program counts
  const getCategoryCounts = () => {
    return categoryCounts;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-2 sm:px-6 lg:px-8 py-3 sm:py-6">
        {/* Compact Header & Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 bg-white p-3.5 sm:p-4 rounded-xl border border-gray-200 shadow-sm">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900">Event Programs</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage programs for <span className="font-semibold text-gray-700">{event?.title}</span>
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowProgramBulkUpload(true)}
              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Upload className="h-3.5 w-3.5" />
              <span>Bulk Upload</span>
            </button>
            <button
              onClick={() => {setShowAddModal(true); setEditingProgram(null); resetForm();}}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Program</span>
            </button>
          </div>
        </div>

        {/* Minimal 1-Line Filters Bar */}
        <div className="bg-white p-3 rounded-xl border border-gray-200 shadow-sm mb-4 space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0 w-full">
              {/* Search */}
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search programs..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Category Filter */}
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.code} value={cat.code}>{cat.name}</option>
                ))}
              </select>

              {/* Type Filter */}
              <select
                value={programTypeFilter}
                onChange={e => setProgramTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Types</option>
                <option value="stage">Stage</option>
                <option value="off_stage">Off-Stage</option>
              </select>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="finished">Finished</option>
              </select>

              {/* Sort By */}
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="start_time">Sort: Start Time</option>
                <option value="name">Sort: Name</option>
                <option value="category">Sort: Category</option>
                <option value="created_at">Sort: Created Date</option>
              </select>
            </div>

            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setStatusFilter('all');
                setSortBy('start_time');
                setProgramTypeFilter('all');
              }}
              className="text-xs font-medium text-gray-500 hover:text-indigo-600 px-2 py-1 transition-colors"
            >
              Clear Filters
            </button>
          </div>

          {/* Micro Summary Pill Row */}
          <div className="flex items-center justify-between pt-1 border-t border-gray-100 text-[11px] text-gray-500">
            <span>
              Showing <strong className="text-gray-700">{filteredPrograms.length}</strong> of <strong className="text-gray-700">{totalCount}</strong> programs
            </span>
            <div className="flex items-center space-x-3">
              {(() => {
                const counts = getCategoryCounts();
                return categories.map(cat => (
                  <span key={cat.code} className="flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                    <span>{cat.name}: <strong className="text-gray-700">{counts[cat.code] || 0}</strong></span>
                  </span>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Programs Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="overflow-x-auto min-h-[220px] pb-24">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Program
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Participants
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPrograms.map((program, index) => {
                  const status = getStatusDisplay(program);
                  const isLastRows = filteredPrograms.length > 1 && index >= filteredPrograms.length - 2;

                  return (
                    <tr key={program.id} className="hover:bg-gray-50/80 transition-colors">
                      {/* Program Name & Description */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-semibold text-gray-900">
                            {program.name}
                          </div>
                          {program.description && (
                            <div className="text-xs text-gray-500 truncate max-w-xs mt-0.5">
                              {program.description}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getCategoryBadge(program.category)}`}>
                          {getCategoryDisplay(program.category)}
                        </span>
                      </td>

                      {/* Type */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div>
                            <span className={`inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full border ${program.program_type === 'stage' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
                              {program.program_type === 'stage' ? 'Stage' : 'Off-Stage'}
                            </span>
                          </div>
                          <div className="text-xs text-gray-500 font-medium flex items-center">
                            <Users className="h-3 w-3 mr-1 text-gray-400" />
                            {program.is_team_based ? (
                              <span>Team {program.team_size && `(${program.team_size})`}</span>
                            ) : (
                              <span>Individual</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Participants */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-gray-900">
                            {program.participants_count || 0} / {program.total_max_participants || (program.max_participants ? program.max_participants * (program.total_teams || 1) : '∞')}
                          </div>
                          <div className="text-[10px] text-gray-500 font-medium" title={program.limit_description}>
                            {program.max_participants ? `${program.max_participants} per team` : 'participants'}
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2.5 py-0.5 text-xs font-semibold rounded-full ${getStatusColor(status)}`}>
                          {status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="relative inline-block text-left">
                          <button
                            onClick={() => setOpenMenuId(openMenuId === program.id ? null : program.id)}
                            className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            title="Program Actions"
                          >
                            <MoreVertical className="h-4 w-4" />
                          </button>

                          {openMenuId === program.id && (
                            <div className={`absolute right-0 w-48 rounded-xl bg-white border border-gray-200 shadow-xl z-50 py-1 font-medium text-xs divide-y divide-gray-100 text-left animate-in fade-in duration-100 ${
                              isLastRows ? 'bottom-full mb-1 origin-bottom-right' : 'top-full mt-1 origin-top-right'
                            }`}>
                              <button
                                onClick={() => handleOpenViewProgram(program)}
                                className="w-full text-left px-3.5 py-2.5 text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                              >
                                <Eye className="h-3.5 w-3.5 text-indigo-600" />
                                <span>Open Program</span>
                              </button>

                              <button
                                onClick={() => { setOpenMenuId(null); handleEdit(program); }}
                                className="w-full text-left px-3.5 py-2.5 text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                              >
                                <Edit className="h-3.5 w-3.5 text-indigo-600" />
                                <span>Edit Program</span>
                              </button>

                              <button
                                onClick={() => { setOpenMenuId(null); handleMarkFinished(program.id, !program.is_finished); }}
                                className="w-full text-left px-3.5 py-2.5 text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                              >
                                {program.is_finished ? (
                                  <>
                                    <XCircle className="h-3.5 w-3.5 text-amber-600" />
                                    <span>Mark as Not Complete</span>
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
                                    <span>Mark Event Complete</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Empty State */}
          {filteredPrograms.length === 0 && (
            <div className="text-center py-12">
              <Calendar className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No programs found</h3>
              <p className="text-gray-500 mb-4">
                {totalCount === 0
                  ? 'Get started by creating your first program for this event.'
                  : 'Try adjusting your filter criteria'
                }
              </p>
              <button
                onClick={() => {setShowAddModal(true); setEditingProgram(null); resetForm();}}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {totalCount === 0 ? 'Create First Program' : 'Add Program'}
              </button>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            pageSize={pageSize}
            totalCount={totalCount}
          />
        )}

        {/* Open Program Details Slide-Over Drawer */}
        {selectedViewProgram && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50 overflow-hidden">
            <div className="w-full max-w-xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col transition-transform duration-300 transform translate-x-0">
              
              {/* Drawer Header */}
              <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <div className="flex items-center space-x-2">
                    <h2 className="text-lg font-bold text-gray-900">{selectedViewProgram.name}</h2>
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${getCategoryBadge(selectedViewProgram.category)}`}>
                      {getCategoryDisplay(selectedViewProgram.category)}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5">Program Overview & Assigned Participants</p>
                </div>
                <button
                  onClick={() => setSelectedViewProgram(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Body */}
              <div className="p-6 flex-1 space-y-6 overflow-y-auto text-xs text-gray-700">
                {/* Program Details Overview */}
                <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                  <div>
                    <span className="text-gray-500 font-medium">Category</span>
                    <p className="font-bold text-gray-900 mt-0.5">{getCategoryDisplay(selectedViewProgram.category)}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Program Type</span>
                    <p className="font-bold text-gray-900 mt-0.5">{selectedViewProgram.program_type === 'stage' ? 'Stage Program' : 'Off-Stage Program'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Participant Format</span>
                    <p className="font-bold text-gray-900 mt-0.5">{selectedViewProgram.is_team_based ? 'Group / Team Event' : 'Single / Individual Event'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Venue</span>
                    <p className="font-bold text-gray-900 mt-0.5">{selectedViewProgram.venue || 'Not specified'}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 font-medium">Number of Judges</span>
                    <p className="font-bold text-gray-900 mt-0.5 flex items-center space-x-1">
                      <Award className="h-3.5 w-3.5 text-amber-600" />
                      <span>{selectedViewProgram.effective_num_judges || selectedViewProgram.num_judges || event?.num_judges || 3} {(selectedViewProgram.effective_num_judges || selectedViewProgram.num_judges || event?.num_judges || 3) === 1 ? 'Judge' : 'Judges'}</span>
                    </p>
                  </div>
                  <div className="col-span-2 pt-2 border-t border-gray-200/60">
                    <span className="text-gray-500 font-medium">Schedule</span>
                    <p className="font-bold text-gray-900 mt-0.5 flex items-center space-x-1.5">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      <span>{selectedViewProgram.start_time ? formatDateTime(selectedViewProgram.start_time) : 'Not scheduled'}</span>
                    </p>
                  </div>
                </div>

                {/* Assigned Participants List Section */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-gray-900 flex items-center space-x-2">
                      <Users className="h-4 w-4 text-indigo-600" />
                      <span>Assigned Participants ({assignedStudents.length})</span>
                    </h3>
                  </div>

                  {loadingAssignedStudents ? (
                    <div className="py-12 text-center text-xs text-gray-400">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600 mx-auto mb-2"></div>
                      <span>Loading assigned participants...</span>
                    </div>
                  ) : assignedStudents.length > 0 ? (
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">
                          <tr>
                            <th className="px-4 py-2.5 w-24">Chest #</th>
                            <th className="px-4 py-2.5">Participant Name</th>
                            <th className="px-4 py-2.5">Team</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 bg-white">
                          {assignedStudents.map((std, i) => (
                            <tr key={std.id || i} className="hover:bg-gray-50/60 transition-colors">
                              <td className="px-4 py-2.5 font-bold text-indigo-700">
                                {std.chest_number || std.student_details?.chest_number || '#'}
                              </td>
                              <td className="px-4 py-2.5 font-semibold text-gray-900">
                                {std.participant_name || std.student_name || std.name || std.student_details?.name || 'Participant'}
                              </td>
                              <td className="px-4 py-2.5 font-medium text-gray-600">
                                {std.team_name || std.team?.name || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="py-8 text-center bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-400">
                      No participants assigned to this program yet.
                    </div>
                  )}
                </div>
              </div>

              {/* Drawer Footer */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 flex justify-end">
                <button
                  onClick={() => setSelectedViewProgram(null)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl hover:bg-gray-300 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Program Right-Side Slide-Over Drawer */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50 overflow-hidden">
            <div className="w-full max-w-xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col transition-transform duration-300 transform translate-x-0">
              
              {/* Drawer Header */}
              <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
                <h2 className="text-lg font-bold text-gray-900">
                  {editingProgram ? `Edit Program: ${editingProgram.name}` : 'Add New Program'}
                </h2>
                <button
                  onClick={() => {setShowAddModal(false); setEditingProgram(null); resetForm();}}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Drawer Body Form */}
              <form onSubmit={handleSubmit} className="p-6 flex-1 space-y-4 overflow-y-auto">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Program Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Category *</label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="">Select Category</option>
                      {categories.map(cat => (
                        <option key={cat.code} value={cat.code}>{cat.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {getPointsSystemDescription(formData.category, formData.is_team_based)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Type *</label>
                    <select
                      name="program_type"
                      value={formData.program_type}
                      onChange={e => setFormData({ ...formData, program_type: e.target.value })}
                      required
                      className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="stage">Stage</option>
                      <option value="off_stage">Off-Stage</option>
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-gray-700">Number of Judges *</label>
                      <span className="text-[10px] text-gray-400 font-medium">Default: {event?.num_judges || 3}</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[1, 2, 3, 4].map((count) => {
                        const isSelected = String(formData.num_judges) === String(count);
                        return (
                          <button
                            key={count}
                            type="button"
                            onClick={() => setFormData({ ...formData, num_judges: String(count) })}
                            className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                              isSelected
                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                                : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            {count} {count === 1 ? 'Judge' : 'Judges'}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Stage / Location</label>
                    <select
                      value={formData.stage_id}
                      onChange={(e) => {
                        const stage = stages.find((item) => item.id === Number(e.target.value));
                        setFormData({
                          ...formData,
                          stage_id: e.target.value,
                          venue: stage ? stage.display_name : formData.venue,
                        });
                      }}
                      className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    >
                      <option value="">Custom venue / Not assigned</option>
                      {stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.number} — {stage.display_name}</option>)}
                    </select>
                  </div>

                  {!formData.stage_id && <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Custom Venue</label>
                    <input type="text" value={formData.venue} onChange={(e) => setFormData({...formData, venue: e.target.value})} placeholder="Enter a location" className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium" />
                  </div>}

                  {!formData.is_team_based && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1">
                        Total Participants in Each Team *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={formData.max_participants}
                        onChange={(e) => setFormData({...formData, max_participants: e.target.value})}
                        className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                        placeholder="e.g., 3"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Schedule Date &amp; Start Time</label>
                    <input
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                      min={event?.start_date ? `${event.start_date}T00:00` : undefined}
                      max={event?.end_date ? `${event.end_date}T23:59` : undefined}
                      className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Minutes per {formData.is_team_based ? 'Group' : 'Participant'} *
                    </label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.duration_minutes_per_entry}
                      onChange={(e) => setFormData({...formData, duration_minutes_per_entry: e.target.value})}
                      className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                    <p className="mt-1 text-[11px] text-gray-500">The end time is calculated from entries × duration.</p>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-semibold text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows="2"
                      className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <div className="flex items-center">
                      <input
                        type="checkbox"
                        id="is_team_based"
                        checked={formData.is_team_based}
                        onChange={(e) => {
                          const isTeamBased = e.target.checked;
                          setFormData({ 
                            ...formData, 
                            is_team_based: isTeamBased,
                            max_participants: isTeamBased ? '' : formData.max_participants,
                            team_size: isTeamBased ? formData.team_size : ''
                          });
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        disabled={isTeamBasedDisabled}
                      />
                      <label htmlFor="is_team_based" className="ml-2 block text-xs text-gray-900 font-medium">
                        Team-based program
                        <span className="block text-[11px] text-gray-500 mt-0.5">
                          (Team-based programs use 10, 6, 3 points system)
                        </span>
                      </label>
                    </div>
                  </div>

                  {formData.is_team_based && (
                    <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                      <div>
                        <label className="block text-xs font-semibold text-gray-800 mb-1">
                          Teams Allowed per Team or Group *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={formData.max_teams_per_school}
                          onChange={(e) => setFormData({...formData, max_teams_per_school: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-xs"
                          placeholder="e.g., 2"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-gray-800 mb-1">
                          Team Size (Members per Sub-Team) *
                        </label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={formData.team_size}
                          onChange={(e) => setFormData({...formData, team_size: e.target.value})}
                          className="w-full px-3 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-xs"
                          placeholder="e.g., 3"
                        />
                      </div>
                    </div>
                  )}

                  {event?.enable_grading_system && activeGradeRules.length > 0 && (
                    <div className="md:col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                      <div className="mb-3">
                        <h3 className="text-xs font-bold text-gray-900">Grade Points</h3>
                        <p className="mt-1 text-[11px] text-gray-500">
                          Optional absolute points for this program. Leave blank to use the event placement points. A value entered here replaces the placement points; it is not added as a bonus.
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {activeGradeRules.map((rule, index) => (
                          <label key={`${rule.name}-${index}`} className="rounded-lg border border-gray-200 bg-white p-3">
                            <span className="flex items-center justify-between gap-2 text-xs font-semibold text-gray-800">
                              <span>{rule.name}</span>
                              <span className="text-[10px] font-medium text-gray-500">{rule.min_mark}%–{rule.max_mark}%</span>
                            </span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={formData.grading_points?.[rule.name] ?? ''}
                              onChange={(e) => setFormData({
                                ...formData,
                                grading_points: {
                                  ...(formData.grading_points || {}),
                                  [rule.name]: e.target.value,
                                },
                              })}
                              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              placeholder="Use placement points"
                              aria-label={`Absolute points for grade ${rule.name}`}
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Drawer Footer Controls */}
                <div className="pt-6 border-t border-gray-200 flex items-center justify-between sticky bottom-0 bg-white py-3">
                  {editingProgram ? (
                    <button
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        handleDelete(editingProgram.id);
                      }}
                      className="px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-bold rounded-xl border border-red-200 transition-colors inline-flex items-center space-x-1.5"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-red-600" />
                      <span>Delete Program</span>
                    </button>
                  ) : <div />}

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => {setShowAddModal(false); setEditingProgram(null); resetForm();}}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 text-xs font-semibold transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 text-xs font-bold shadow-2xs transition-colors"
                    >
                      {editingProgram ? 'Save Changes' : 'Create Program'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Program Bulk Upload Modal */}
        {showProgramBulkUpload && (
          <ProgramBulkUploadModal
            event={event}
            eventId={eventId || event?.id}
            onClose={() => setShowProgramBulkUpload(false)}
            onSuccess={() => {
              fetchPrograms();
              setShowProgramBulkUpload(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

// Program Bulk Upload Modal Component
const ProgramBulkUploadModal = ({ event, eventId, onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files && files[0]) {
      setFile(files[0]);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const downloadTemplate = async () => {
    try {
      const response = await eventsAPI.downloadProgramTemplate(eventId);
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${event.title}_programs_template.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Error downloading template. Please try again.');
    }
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadResults(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await eventsAPI.bulkUploadPrograms(eventId, formData);
      setUploadResults(response.data);
      
      if (response.data.success) {
        setTimeout(() => {
          onSuccess();
        }, 3000);
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      setUploadResults({
        success: false,
        error: error.response?.data?.error || 'Upload failed',
        details: error.response?.data?.details || [],
        suggestions: error.response?.data?.suggestions || []
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Bulk Upload Programs</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ×
          </button>
        </div>

        <div className="space-y-4">
          {/* Template Download */}
          <div className="bg-indigo-50 p-4 rounded-lg">
            <h3 className="font-medium text-indigo-800 mb-2">Step 1: Download Template</h3>
            <p className="text-sm text-indigo-600 mb-3">
              Download the Excel template with sample data and instructions for creating multiple programs. 
              <strong>Note: General category programs should be created manually, not via bulk upload.</strong>
            </p>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m0 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Template
            </button>
          </div>

          {/* File Upload */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <h3 className="font-medium text-gray-800 mb-2">Step 2: Upload Your File</h3>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive 
                  ? 'border-indigo-500 bg-indigo-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-gray-600 mb-2">
                Drag and drop your Excel file here, or click to select
              </p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
                id="program-file-upload"
              />
              <label
                htmlFor="program-file-upload"
                className="cursor-pointer bg-gray-200 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Select File
              </label>
              {file && (
                <p className="text-sm text-green-600 mt-2">
                  Selected: {file.name}
                </p>
              )}
            </div>
          </div>

          {/* Upload Results */}
          {uploadResults && (
            <div className={`p-4 rounded-lg ${
              uploadResults.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <h3 className={`font-medium mb-2 ${
                uploadResults.success ? 'text-green-800' : 'text-red-800'
              }`}>
                Upload Results
              </h3>
              
              {uploadResults.success ? (
                <div className="text-green-700">
                  <p className="mb-2">{uploadResults.message}</p>
                  {uploadResults.summary && (
                    <div className="text-sm">
                      <p>Total Processed: {uploadResults.summary.total_processed}</p>
                      <p>Successfully Created: {uploadResults.summary.successful_creations}</p>
                      <p>Skipped: {uploadResults.summary.skipped_creations}</p>
                    </div>
                  )}
                  {uploadResults.skipped && uploadResults.skipped.length > 0 && (
                    <div className="mt-3">
                      <p className="font-medium">Skipped Programs:</p>
                      <ul className="text-sm mt-1">
                        {uploadResults.skipped.map((item, index) => (
                          <li key={index} className="text-orange-600">
                            {item.name}: {item.reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-red-700">
                  <p className="mb-2">{uploadResults.error}</p>
                  {uploadResults.details && uploadResults.details.length > 0 && (
                    <div className="text-sm">
                      <p className="font-medium">Details:</p>
                      <ul className="mt-1">
                        {uploadResults.details.map((detail, index) => (
                          <li key={index}>• {detail}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {uploadResults.suggestions && uploadResults.suggestions.length > 0 && (
                    <div className="text-sm mt-2">
                      <p className="font-medium">Suggestions:</p>
                      <ul className="mt-1">
                        {uploadResults.suggestions.map((suggestion, index) => (
                          <li key={index}>• {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={!file || uploading}
              className={`px-4 py-2 rounded-lg text-white transition-colors ${
                !file || uploading
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
            >
              {uploading ? 'Uploading...' : 'Upload Programs'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventPrograms; 
