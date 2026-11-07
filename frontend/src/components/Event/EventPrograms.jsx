import React, { useState, useEffect, useMemo } from 'react';
import { eventProgramsAPI, eventStagesAPI, eventProgramTypesAPI, eventsAPI, markEntryAPI, eventAssignmentsAPI } from '../../services/api';
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
  Award,
  Sparkles,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Download,
  Copy,
  Check,
  FileSpreadsheet,
  ChevronLeft,
  ChevronRight,
  Layers,
  HelpCircle
} from 'lucide-react';
import Pagination from '../common/Pagination';

const DEFAULT_GRADE_RULES = [
  { name: 'A+', min_mark: 90, max_mark: 100, bonus_points: 3 },
  { name: 'A', min_mark: 80, max_mark: 89.99, bonus_points: 2 },
  { name: 'B+', min_mark: 70, max_mark: 79.99, bonus_points: 1 },
  { name: 'B', min_mark: 60, max_mark: 69.99, bonus_points: 0 },
];

const toDateTimeLocal = (value) => {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

const EventPrograms = ({ event, eventId, onRefresh, categories = [], readOnly = false }) => {
  const [programs, setPrograms] = useState([]);
  const [stages, setStages] = useState([]);
  const [programTypes, setProgramTypes] = useState(event?.program_types || []);
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
  const [programTypeFilter, setProgramTypeFilter] = useState('all'); // 'all', or any dynamic type code
  
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

  const displayCategories = useMemo(() => {
    const list = [...(categories || [])];
    if (!list.some((c) => (c.code || '').toLowerCase() === 'general')) {
      list.push({ code: 'general', name: 'General' });
    }
    return list;
  }, [categories]);

  const getProgramTypeObj = (typeCode) => {
    return programTypes.find((pt) => pt.code === typeCode) || null;
  };

  const getProgramTypeLabel = (prog) => {
    if (!prog) return 'Program';
    if (prog.program_type_display) return prog.program_type_display;
    const match = getProgramTypeObj(prog.program_type);
    if (match) return match.name;
    if (prog.program_type === 'stage') return 'Stage';
    if (prog.program_type === 'off_stage') return 'Off-Stage';
    return (prog.program_type || 'Stage').replace(/_/g, ' ');
  };

  const getProgramTypeBadgeStyle = (prog) => {
    if (!prog) return { backgroundColor: '#EEF2FF', color: '#4338CA', borderColor: '#C7D2FE' };
    const match = getProgramTypeObj(prog.program_type);
    if (match?.color) {
      return {
        backgroundColor: `${match.color}15`,
        color: match.color,
        borderColor: `${match.color}40`,
      };
    }
    if (prog.program_type === 'stage') {
      return { backgroundColor: '#EEF2FF', color: '#4338CA', borderColor: '#C7D2FE' };
    }
    return { backgroundColor: '#F0FDF4', color: '#15803D', borderColor: '#BBF7D0' };
  };

  useEffect(() => {
    const actualEventId = eventId || event?.id;
    if (!actualEventId) return;
    eventProgramTypesAPI.list(actualEventId)
      .then((res) => {
        const list = res.data?.results || res.data || [];
        if (Array.isArray(list) && list.length > 0) {
          setProgramTypes(list);
        } else if (event?.program_types) {
          setProgramTypes(event.program_types);
        }
      })
      .catch(() => {
        if (event?.program_types) setProgramTypes(event.program_types);
      });
  }, [eventId, event?.id, event?.program_types]);
  
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
    has_custom_points: false,
    first_place_points: '',
    second_place_points: '',
    third_place_points: '',
    participation_points: '',
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
        has_custom_points: Boolean(formData.has_custom_points),
        first_place_points: formData.has_custom_points && formData.first_place_points !== '' ? parseInt(formData.first_place_points, 10) : null,
        second_place_points: formData.has_custom_points && formData.second_place_points !== '' ? parseInt(formData.second_place_points, 10) : null,
        third_place_points: formData.has_custom_points && formData.third_place_points !== '' ? parseInt(formData.third_place_points, 10) : null,
        participation_points: formData.has_custom_points && formData.participation_points !== '' ? parseInt(formData.participation_points, 10) : null,
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
      has_custom_points: Boolean(program.has_custom_points),
      first_place_points: program.first_place_points !== null && program.first_place_points !== undefined ? String(program.first_place_points) : '',
      second_place_points: program.second_place_points !== null && program.second_place_points !== undefined ? String(program.second_place_points) : '',
      third_place_points: program.third_place_points !== null && program.third_place_points !== undefined ? String(program.third_place_points) : '',
      participation_points: program.participation_points !== null && program.participation_points !== undefined ? String(program.participation_points) : '',
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

  // Get event-configured default placement points for a category and format
  const getDefaultPlacementPoints = (category, isTeamBased) => {
    const cat = displayCategories.find(c => c.code === category);
    const isMixing = cat?.is_mixing || ['general', 'gen', 'gn', 'open'].includes((category || '').toLowerCase());
    if (isMixing) {
      if (isTeamBased) {
        return {
          first: event?.mix_group_first ?? 10,
          second: event?.mix_group_second ?? 6,
          third: event?.mix_group_third ?? 3,
        };
      }
      return {
        first: event?.mix_ind_first ?? 10,
        second: event?.mix_ind_second ?? 6,
        third: event?.mix_ind_third ?? 3,
      };
    }
    if (isTeamBased) {
      return {
        first: event?.std_group_first ?? 10,
        second: event?.std_group_second ?? 6,
        third: event?.std_group_third ?? 3,
      };
    }
    return {
      first: event?.std_ind_first ?? 5,
      second: event?.std_ind_second ?? 3,
      third: event?.std_ind_third ?? 1,
    };
  };

  // Get points system description based on category, team-based status, and custom override
  const getPointsSystemDescription = (category, isTeamBased, hasCustomPoints, custom1st, custom2nd, custom3rd) => {
    if (hasCustomPoints) {
      return `Custom Points: ${custom1st ?? 0}, ${custom2nd ?? 0}, ${custom3rd ?? 0} (Program Override)`;
    }
    const pts = getDefaultPlacementPoints(category, isTeamBased);
    return `Points: ${pts.first}, ${pts.second}, ${pts.third} (${isTeamBased ? 'Team-based' : 'Individual'})`;
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
      has_custom_points: false,
      first_place_points: '',
      second_place_points: '',
      third_place_points: '',
      participation_points: '',
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
    if ((category || '').toLowerCase() === 'general') return 'General';
    const cat = displayCategories.find(c => c.code === category);
    return cat ? cat.name : (category?.toUpperCase() || category);
  };

  const getCategoryBadge = (category) => {
    const cat = displayCategories.find(c => c.code === category);
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
              {readOnly ? 'Explore programs and assigned participants for ' : 'Manage programs for '}
              <span className="font-semibold text-gray-700">{event?.title}</span>
            </p>
          </div>
          {!readOnly && (
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
          )}
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
                {displayCategories.map(cat => (
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
                {programTypes.map(pt => (
                  <option key={pt.code} value={pt.code}>{pt.name}</option>
                ))}
                {programTypes.length === 0 && (
                  <>
                    <option value="stage">Stage</option>
                    <option value="off_stage">Off-Stage</option>
                  </>
                )}
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
                return displayCategories.map(cat => (
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-semibold text-gray-900">
                              {program.name}
                            </span>
                            {program.has_custom_points && (
                              <span
                                className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 shadow-2xs"
                                title={`Custom Points: 1st: ${program.first_place_points ?? 0}, 2nd: ${program.second_place_points ?? 0}, 3rd: ${program.third_place_points ?? 0}${program.participation_points ? `, Part: ${program.participation_points}` : ''}`}
                              >
                                <Award className="h-2.5 w-2.5 text-amber-600" />
                                <span>Points: {program.first_place_points ?? 0}, {program.second_place_points ?? 0}, {program.third_place_points ?? 0}</span>
                              </span>
                            )}
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
                            <span
                              className="inline-flex px-2 py-0.5 text-[11px] font-semibold rounded-full border shadow-2xs"
                              style={getProgramTypeBadgeStyle(program)}
                            >
                              {getProgramTypeLabel(program)}
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
                        {readOnly ? (
                          <button
                            type="button"
                            onClick={() => handleOpenViewProgram(program)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-colors shadow-2xs cursor-pointer"
                            title="View program details & participants"
                          >
                            <Eye className="h-3.5 w-3.5 text-indigo-600" />
                            <span>Participants</span>
                          </button>
                        ) : (
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
                        )}
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
                    <p className="font-bold text-gray-900 mt-0.5">{getProgramTypeLabel(selectedViewProgram)} Program</p>
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
                    <span className="text-gray-500 font-medium">Placement Points System</span>
                    {selectedViewProgram.has_custom_points ? (
                      <p className="font-bold text-amber-700 mt-0.5 flex items-center space-x-1.5 flex-wrap">
                        <Award className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                        <span>Custom Program Points: 1st: {selectedViewProgram.first_place_points ?? 0} pts, 2nd: {selectedViewProgram.second_place_points ?? 0} pts, 3rd: {selectedViewProgram.third_place_points ?? 0} pts</span>
                        {selectedViewProgram.participation_points !== null && selectedViewProgram.participation_points !== undefined && (
                          <span className="text-gray-500 font-normal"> (Beyond 3rd: {selectedViewProgram.participation_points} pts)</span>
                        )}
                      </p>
                    ) : (
                      <p className="font-bold text-gray-900 mt-0.5 flex items-center space-x-1.5">
                        <Award className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                        <span>Event Default ({getPointsSystemDescription(selectedViewProgram.category, selectedViewProgram.is_team_based)})</span>
                      </p>
                    )}
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
        {!readOnly && showAddModal && (
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
                      {displayCategories.map(cat => (
                        <option key={cat.code} value={cat.code}>{cat.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {getPointsSystemDescription(
                        formData.category,
                        formData.is_team_based,
                        formData.has_custom_points,
                        formData.first_place_points,
                        formData.second_place_points,
                        formData.third_place_points
                      )}
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
                      {programTypes.map(pt => (
                        <option key={pt.code} value={pt.code}>{pt.name}</option>
                      ))}
                      {programTypes.length === 0 && (
                        <>
                          <option value="stage">Stage</option>
                          <option value="off_stage">Off-Stage</option>
                        </>
                      )}
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
                          (Team-based programs use {event?.std_group_first ?? 10}, {event?.std_group_second ?? 6}, {event?.std_group_third ?? 3} points system by default)
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

                  {/* Custom Placement Points Override Section */}
                  <div className="md:col-span-2 rounded-xl border border-gray-200 bg-gray-50/70 p-4 space-y-3">
                    <div className="flex items-start">
                      <input
                        type="checkbox"
                        id="has_custom_points"
                        checked={formData.has_custom_points}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          const defaults = getDefaultPlacementPoints(formData.category, formData.is_team_based);
                          setFormData({
                            ...formData,
                            has_custom_points: checked,
                            first_place_points: checked && (formData.first_place_points === '' || formData.first_place_points === null) ? String(defaults.first) : formData.first_place_points,
                            second_place_points: checked && (formData.second_place_points === '' || formData.second_place_points === null) ? String(defaults.second) : formData.second_place_points,
                            third_place_points: checked && (formData.third_place_points === '' || formData.third_place_points === null) ? String(defaults.third) : formData.third_place_points,
                            participation_points: checked && (formData.participation_points === '' || formData.participation_points === null) ? String(event?.participation_points ?? 0) : formData.participation_points,
                          });
                        }}
                        className="mt-0.5 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                      />
                      <label htmlFor="has_custom_points" className="ml-2.5 block text-xs cursor-pointer select-none">
                        <span className="font-bold text-gray-900">Customize placement points for this program</span>
                        <span className="block text-[11px] text-gray-500 mt-0.5">
                          Override the event's default placement points and specify custom 1st, 2nd, and 3rd place points for this program only.
                        </span>
                      </label>
                    </div>

                    {formData.has_custom_points && (
                      <div className="pt-3 border-t border-gray-200 space-y-3">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                          <div className="bg-white p-3 rounded-xl border border-amber-200 shadow-2xs">
                            <label className="block text-[11px] font-bold text-amber-800 mb-1 flex items-center justify-between">
                              <span>1st Place</span>
                              <span className="text-[10px] text-amber-600 font-semibold">Gold</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              required={formData.has_custom_points}
                              value={formData.first_place_points}
                              onChange={(e) => setFormData({ ...formData, first_place_points: e.target.value })}
                              placeholder={String(getDefaultPlacementPoints(formData.category, formData.is_team_based).first)}
                              className="w-full px-2.5 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                            <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center justify-between">
                              <span>2nd Place</span>
                              <span className="text-[10px] text-slate-500 font-semibold">Silver</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              required={formData.has_custom_points}
                              value={formData.second_place_points}
                              onChange={(e) => setFormData({ ...formData, second_place_points: e.target.value })}
                              placeholder={String(getDefaultPlacementPoints(formData.category, formData.is_team_based).second)}
                              className="w-full px-2.5 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-orange-200 shadow-2xs">
                            <label className="block text-[11px] font-bold text-orange-800 mb-1 flex items-center justify-between">
                              <span>3rd Place</span>
                              <span className="text-[10px] text-orange-600 font-semibold">Bronze</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              required={formData.has_custom_points}
                              value={formData.third_place_points}
                              onChange={(e) => setFormData({ ...formData, third_place_points: e.target.value })}
                              placeholder={String(getDefaultPlacementPoints(formData.category, formData.is_team_based).third)}
                              className="w-full px-2.5 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>

                          <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                            <label className="block text-[11px] font-bold text-emerald-800 mb-1 flex items-center justify-between">
                              <span>Beyond 3rd</span>
                              <span className="text-[10px] text-emerald-600 font-semibold">Part.</span>
                            </label>
                            <input
                              type="number"
                              min="0"
                              value={formData.participation_points}
                              onChange={(e) => setFormData({ ...formData, participation_points: e.target.value })}
                              placeholder={String(event?.participation_points ?? 0)}
                              className="w-full px-2.5 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                          </div>
                        </div>
                        <p className="text-[11px] text-indigo-700 font-medium bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100 flex items-center gap-1.5">
                          <Sparkles className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                          <span>Results for this program will award these custom points everywhere (leaderboards, team totals, certificates, reports).</span>
                        </p>
                      </div>
                    )}
                  </div>

                  {event?.enable_grading_system && activeGradeRules.length > 0 && (
                    <div className="md:col-span-2 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                      <div className="mb-3">
                        <h3 className="text-xs font-bold text-gray-900">Grade Bonus Points</h3>
                        <p className="mt-1 text-[11px] text-gray-500">
                          Optional bonus point override for this program. Leave blank to use the event default bonus points. A value entered here is added on top of placement points.
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
                              placeholder={`Default (+${rule.bonus_points ?? 0} pts)`}
                              aria-label={`Bonus points for grade ${rule.name}`}
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
            categories={categories}
            programTypes={programTypes}
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

// Program Bulk Upload Modal Component with Issue Resolution Center
const normalizeProgramImportErrors = (errorData) => {
  if (Array.isArray(errorData?.structured_errors) && errorData.structured_errors.length > 0) {
    return errorData.structured_errors;
  }

  const rawList = Array.isArray(errorData?.details)
    ? errorData.details
    : Array.isArray(errorData?.errors)
      ? errorData.errors
      : [];

  return rawList.map((errString, idx) => {
    const str = String(errString || '');
    const rowMatch = str.match(/Row\s+(\d+):/i);
    const row = rowMatch ? parseInt(rowMatch[1], 10) : idx + 2;
    const body = str.replace(/^Row\s+\d+:\s*/i, '');

    let field = 'other';
    let field_label = 'Spreadsheet Data';
    let issue = 'Validation Error';
    let suggestion = '';

    if (/category/i.test(body)) {
      field = 'category';
      field_label = 'Category';
      issue = 'Invalid Category';
      suggestion = 'Check the Setup sheet for allowed categories.';
    } else if (/program type|type/i.test(body)) {
      field = 'type';
      field_label = 'Program Type';
      issue = 'Invalid Program Type';
      suggestion = 'Select an allowed program type for this event.';
    } else if (/mode/i.test(body)) {
      field = 'mode';
      field_label = 'Mode';
      issue = 'Invalid Mode';
      suggestion = 'Set mode to either Individual or Group.';
    } else if (/team size/i.test(body)) {
      field = 'team_size';
      field_label = 'Team Size';
      issue = 'Team Size Required';
      suggestion = 'Enter the number of students per team (e.g. 4, 6).';
    } else if (/max participants/i.test(body)) {
      field = 'max_participants';
      field_label = 'Max Participants';
      issue = 'Max Participants Required';
      suggestion = 'Enter the maximum number of solo participants (e.g. 20).';
    } else if (/duration/i.test(body)) {
      field = 'duration';
      field_label = 'Duration';
      issue = 'Invalid Duration';
      suggestion = 'Enter duration in whole minutes (e.g. 5, 10).';
    } else if (/duplicate|already exists/i.test(body)) {
      field = 'duplicate';
      field_label = 'Duplicate Program';
      issue = 'Duplicate Program Title';
      suggestion = 'Make each program title unique.';
    }

    return {
      row,
      program_name: '—',
      field,
      field_label,
      value: '',
      issue,
      reason: body || str,
      suggestion: suggestion || 'Check the Reference Template for correct format.'
    };
  });
};

const handleDownloadProgramIssuesCSV = (issues) => {
  if (!issues || issues.length === 0) return;
  const header = ['Row', 'Program Name', 'Field', 'Value in Spreadsheet', 'Issue', 'Reason', 'Suggestion'];
  const rows = issues.map((i) => [
    i.row,
    `"${(i.program_name || '').replace(/"/g, '""')}"`,
    `"${(i.field_label || i.field || '').replace(/"/g, '""')}"`,
    `"${(i.value || '').replace(/"/g, '""')}"`,
    `"${(i.issue || '').replace(/"/g, '""')}"`,
    `"${(i.reason || '').replace(/"/g, '""')}"`,
    `"${(i.suggestion || '').replace(/"/g, '""')}"`,
  ]);
  const csvContent = [header.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'program_bulk_upload_issues.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
};

const ProgramBulkUploadModal = ({ event, eventId, categories = [], programTypes = [], onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Issue Resolution Center controls
  const [issueFilter, setIssueFilter] = useState('all');
  const [issueSearch, setIssueSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedIssues, setCopiedIssues] = useState(false);
  const pageSize = 10;

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
      setUploadError(null);
    }
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
      setUploadError(null);
    }
  };

  const downloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const response = await eventsAPI.downloadProgramTemplate(eventId);
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const cleanTitle = (event?.title || 'event').replace(/[^a-zA-Z0-9_\-]/g, '_');
      a.download = `program_bulk_upload_template_${cleanTitle}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Error downloading template. Please try again.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const uploadSpreadsheetFile = async (fileToUpload) => {
    const target = fileToUpload || file;
    if (!target) return;

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', target);

      const response = await eventsAPI.bulkUploadPrograms(eventId, formData);
      setUploadResult(response.data);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error uploading programs:', error);
      const errorData = error.response?.data;
      const structured = normalizeProgramImportErrors(errorData);
      setUploadError({
        message: errorData?.message || errorData?.error || 'Validation failed for uploaded spreadsheet.',
        total_rows: errorData?.total_rows ?? null,
        valid_count: errorData?.valid_count ?? null,
        error_count: errorData?.error_count ?? structured.length,
        structured_errors: structured,
        details: Array.isArray(errorData?.details) ? errorData.details : [],
        suggestions: Array.isArray(errorData?.suggestions) ? errorData.suggestions : []
      });
      setCurrentPage(1);
      setIssueFilter('all');
      setIssueSearch('');
    } finally {
      setUploading(false);
    }
  };

  const handleUpload = (e) => {
    if (e) e.preventDefault();
    if (!file) return;
    uploadSpreadsheetFile(file);
  };

  const resetForm = () => {
    setFile(null);
    setUploadResult(null);
    setUploadError(null);
    setIssueFilter('all');
    setIssueSearch('');
    setCurrentPage(1);
  };

  const handleCopyIssues = (issues) => {
    if (!issues || issues.length === 0) return;
    const text = [
      `=== PROGRAM BULK UPLOAD ISSUES (${issues.length} detected) ===`,
      ...issues.map((item, idx) => 
        `#${idx + 1} [Row ${item.row}] ${item.program_name && item.program_name !== '—' ? `Program: "${item.program_name}" | ` : ''}${item.field_label} ("${item.value}"): ${item.reason}${item.suggestion ? ` -> Fix: ${item.suggestion}` : ''}`
      )
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopiedIssues(true);
    setTimeout(() => setCopiedIssues(false), 2000);
  };

  const structuredErrors = uploadError?.structured_errors || [];

  const counts = useMemo(() => {
    const c = { all: 0, category: 0, type: 0, mode: 0, duplicate: 0, other: 0 };
    if (!structuredErrors) return c;
    c.all = structuredErrors.length;
    structuredErrors.forEach((err) => {
      if (err.field === 'category') c.category += 1;
      else if (err.field === 'type') c.type += 1;
      else if (err.field === 'mode' || err.field === 'team_size' || err.field === 'max_participants') c.mode += 1;
      else if (err.field === 'duplicate') c.duplicate += 1;
      else c.other += 1;
    });
    return c;
  }, [structuredErrors]);

  const filteredIssues = useMemo(() => {
    if (!structuredErrors) return [];
    return structuredErrors.filter((err) => {
      if (issueFilter === 'category' && err.field !== 'category') return false;
      if (issueFilter === 'type' && err.field !== 'type') return false;
      if (issueFilter === 'mode' && !['mode', 'team_size', 'max_participants'].includes(err.field)) return false;
      if (issueFilter === 'duplicate' && err.field !== 'duplicate') return false;
      if (issueFilter === 'other' && ['category', 'type', 'mode', 'team_size', 'max_participants', 'duplicate'].includes(err.field)) return false;

      if (issueSearch.trim()) {
        const q = issueSearch.toLowerCase().trim();
        const inRow = String(err.row).includes(q) || `row ${err.row}`.includes(q);
        const inName = (err.program_name || '').toLowerCase().includes(q);
        const inVal = (err.value || '').toLowerCase().includes(q);
        const inReason = (err.reason || '').toLowerCase().includes(q);
        const inIssue = (err.issue || '').toLowerCase().includes(q);
        const inField = (err.field_label || '').toLowerCase().includes(q);
        return inRow || inName || inVal || inReason || inIssue || inField;
      }
      return true;
    });
  }, [structuredErrors, issueFilter, issueSearch]);

  const totalPages = Math.max(1, Math.ceil(filteredIssues.length / pageSize));
  const paginatedIssues = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredIssues.slice(start, start + pageSize);
  }, [filteredIssues, currentPage, pageSize]);

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 transition-all">
      <div 
        className={`w-full max-h-[92vh] flex flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl transition-all duration-200 overflow-hidden ${
          uploadError ? 'max-w-5xl' : uploadResult ? 'max-w-3xl' : 'max-w-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-100">
              Bulk Upload Programs
            </span>
            {uploadError && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                <AlertCircle className="h-3 w-3" />
                {uploadError.error_count || structuredErrors.length} Issue{(uploadError.error_count || structuredErrors.length) > 1 ? 's' : ''} Found
              </span>
            )}
            {uploadResult && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <CheckCircle2 className="h-3 w-3" />
                Completed
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
            aria-label="Close bulk upload modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1">
          {uploadError ? (
            /* =========================================================================
               ISSUE RESOLUTION CENTER (Validation Issues Detected)
               ========================================================================= */
            <div className="space-y-5">
              {/* Alert Banner */}
              <div className="rounded-xl border border-rose-200 bg-gradient-to-r from-rose-50 via-rose-50/60 to-white p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2.5 rounded-xl bg-rose-100 text-rose-600 shrink-0 mt-0.5">
                      <AlertTriangle className="h-6 w-6" />
                    </div>
                    <div>
                      <h4 className="text-base font-bold text-rose-950">
                        Spreadsheet Validation Blocked ({uploadError.error_count || structuredErrors.length} Issue{(uploadError.error_count || structuredErrors.length) > 1 ? 's' : ''})
                      </h4>
                      <p className="text-xs text-rose-800/90 mt-1 leading-relaxed">
                        No programs were imported so your event schedule remains clean and uncorrupted. Every row with an issue has been pinpointed below with the exact row number and required fix.
                      </p>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownloadProgramIssuesCSV(structuredErrors)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-rose-200 text-rose-700 hover:bg-rose-50 shadow-xs transition-colors"
                      title="Download errors as CSV to review side-by-side with Excel"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>Download Issues CSV</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyIssues(structuredErrors)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 shadow-xs transition-colors"
                      title="Copy issue summary to clipboard"
                    >
                      {copiedIssues ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copy Issues</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Metrics Summary Strip */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 border-t border-rose-200/70 pt-4 text-left">
                  <div className="rounded-lg bg-white/80 p-3 border border-rose-100">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Rows Evaluated</div>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">
                      {uploadError.total_rows || (structuredErrors.length + (uploadError.valid_count || 0))}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Total data rows in file</div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3 border border-emerald-200">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700">Valid Rows Ready</div>
                    <div className="text-xl font-bold text-emerald-700 mt-0.5">
                      {uploadError.valid_count ?? '—'}
                    </div>
                    <div className="text-[11px] text-emerald-600/80 mt-0.5">Will import once issues fixed</div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3 border border-rose-200">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-rose-700">Issues to Fix</div>
                    <div className="text-xl font-bold text-rose-700 mt-0.5">
                      {uploadError.error_count || structuredErrors.length}
                    </div>
                    <div className="text-[11px] text-rose-600/80 mt-0.5">Rows requiring attention</div>
                  </div>
                </div>
              </div>

              {/* Filter Tabs & Search Bar */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Category Filter Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none text-xs">
                    <button
                      type="button"
                      onClick={() => { setIssueFilter('all'); setCurrentPage(1); }}
                      className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                        issueFilter === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      <span>All Issues</span>
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                        issueFilter === 'all' ? 'bg-slate-700 text-white' : 'bg-slate-200 text-slate-700'
                      }`}>{counts.all}</span>
                    </button>

                    {counts.category > 0 && (
                      <button
                        type="button"
                        onClick={() => { setIssueFilter('category'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                          issueFilter === 'category'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'
                        }`}
                      >
                        <Layers className="h-3 w-3" />
                        <span>Category</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          issueFilter === 'category' ? 'bg-sky-800 text-white' : 'bg-sky-200 text-sky-800'
                        }`}>{counts.category}</span>
                      </button>
                    )}

                    {counts.type > 0 && (
                      <button
                        type="button"
                        onClick={() => { setIssueFilter('type'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                          issueFilter === 'type'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                        }`}
                      >
                        <MapPin className="h-3 w-3" />
                        <span>Program Type</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          issueFilter === 'type' ? 'bg-purple-800 text-white' : 'bg-purple-200 text-purple-800'
                        }`}>{counts.type}</span>
                      </button>
                    )}

                    {counts.mode > 0 && (
                      <button
                        type="button"
                        onClick={() => { setIssueFilter('mode'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                          issueFilter === 'mode'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        }`}
                      >
                        <Users className="h-3 w-3" />
                        <span>Mode / Limits</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          issueFilter === 'mode' ? 'bg-amber-800 text-white' : 'bg-amber-200 text-amber-800'
                        }`}>{counts.mode}</span>
                      </button>
                    )}

                    {counts.duplicate > 0 && (
                      <button
                        type="button"
                        onClick={() => { setIssueFilter('duplicate'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                          issueFilter === 'duplicate'
                            ? 'bg-rose-600 text-white shadow-xs'
                            : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        }`}
                      >
                        <Copy className="h-3 w-3" />
                        <span>Duplicates</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          issueFilter === 'duplicate' ? 'bg-rose-800 text-white' : 'bg-rose-200 text-rose-800'
                        }`}>{counts.duplicate}</span>
                      </button>
                    )}

                    {counts.other > 0 && (
                      <button
                        type="button"
                        onClick={() => { setIssueFilter('other'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                          issueFilter === 'other'
                            ? 'bg-slate-700 text-white shadow-xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        <span>Other</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          issueFilter === 'other' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-800'
                        }`}>{counts.other}</span>
                      </button>
                    )}
                  </div>

                  {/* Search Filter Input */}
                  <div className="relative shrink-0 sm:w-64">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={issueSearch}
                      onChange={(e) => { setIssueSearch(e.target.value); setCurrentPage(1); }}
                      placeholder="Search issue by row, name..."
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Issues Table */}
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[10px]">
                          <th className="py-2.5 px-3 w-16 text-center">Row</th>
                          <th className="py-2.5 px-3 w-40">Program Name</th>
                          <th className="py-2.5 px-3 w-32">Field</th>
                          <th className="py-2.5 px-3 w-36">Value in File</th>
                          <th className="py-2.5 px-4">Reason & Actionable Fix</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-slate-700">
                        {paginatedIssues.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              No issues match your active filter.
                            </td>
                          </tr>
                        ) : (
                          paginatedIssues.map((issue, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                              {/* Row Number */}
                              <td className="py-2.5 px-3 text-center align-top">
                                <span className="inline-flex items-center justify-center font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                  #{issue.row}
                                </span>
                              </td>

                              {/* Program Name */}
                              <td className="py-2.5 px-3 align-top">
                                <div className="font-semibold text-slate-900 truncate max-w-[150px]" title={issue.program_name}>
                                  {issue.program_name || '—'}
                                </div>
                              </td>

                              {/* Field */}
                              <td className="py-2.5 px-3 align-top">
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                  {issue.field_label || issue.field}
                                </span>
                              </td>

                              {/* Value Entered in Excel */}
                              <td className="py-2.5 px-3 align-top">
                                {issue.value !== undefined && issue.value !== null && String(issue.value).trim() !== '' ? (
                                  <code 
                                    className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200 block truncate max-w-[140px]" 
                                    title={String(issue.value)}
                                  >
                                    "{issue.value}"
                                  </code>
                                ) : (
                                  <span className="text-[11px] italic text-slate-400">
                                    (empty cell)
                                  </span>
                                )}
                              </td>

                              {/* Reason & Fix */}
                              <td className="py-2.5 px-4 align-top">
                                <div className="font-semibold text-slate-900 text-xs">
                                  {issue.issue || issue.reason}
                                </div>
                                {issue.reason && issue.issue && issue.reason !== issue.issue && (
                                  <div className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                                    {issue.reason}
                                  </div>
                                )}
                                {issue.suggestion && (
                                  <div className="mt-1 inline-flex items-start gap-1 text-[11px] font-medium text-indigo-700 bg-indigo-50/80 px-2 py-1 rounded border border-indigo-100">
                                    <span className="shrink-0">💡</span>
                                    <span><strong>Fix:</strong> {issue.suggestion}</span>
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination Footer */}
                  {filteredIssues.length > pageSize && (
                    <div className="flex items-center justify-between px-4 py-2.5 bg-slate-50/80 border-t border-slate-200 text-xs text-slate-600">
                      <div>
                        Showing <strong>{(currentPage - 1) * pageSize + 1}</strong> to{' '}
                        <strong>{Math.min(currentPage * pageSize, filteredIssues.length)}</strong> of{' '}
                        <strong>{filteredIssues.length}</strong> issues
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className="px-2.5 py-1 rounded border border-slate-200 bg-white font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <ChevronLeft className="h-3 w-3" />
                          <span>Prev</span>
                        </button>
                        <span className="px-2 py-1 font-semibold text-slate-700">
                          {currentPage} / {totalPages}
                        </span>
                        <button
                          type="button"
                          onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                          disabled={currentPage === totalPages}
                          className="px-2.5 py-1 rounded border border-slate-200 bg-white font-medium hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
                        >
                          <span>Next</span>
                          <ChevronRight className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggestions strip */}
              {uploadError.suggestions && uploadError.suggestions.length > 0 && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs text-indigo-900">
                  <div className="font-bold flex items-center gap-1.5 mb-1 text-indigo-950">
                    <Sparkles className="h-3.5 w-3.5 text-indigo-600" />
                    <span>How to proceed:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-indigo-800">
                    {uploadError.suggestions.map((sug, i) => (
                      <li key={i}>{sug}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={downloadTemplate}
                  disabled={downloadingTemplate}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download Reference Template</span>
                </button>

                <div className="flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={resetForm}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Back to Upload
                  </button>

                  <label className="inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm cursor-pointer transition-colors">
                    <Upload className="h-3.5 w-3.5" />
                    <span>Upload Corrected File</span>
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      className="hidden"
                      onChange={(e) => {
                        const selected = e.target.files[0];
                        if (selected) {
                          setFile(selected);
                          setUploadError(null);
                          uploadSpreadsheetFile(selected);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : uploadResult ? (
            /* =========================================================================
               SUCCESS SCREEN (Programs Imported Successfully)
               ========================================================================= */
            <div className="space-y-5 py-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3 shadow-xs">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-bold text-emerald-950">Programs Imported Successfully!</h4>
                <p className="mt-1 text-xs text-emerald-800">
                  {uploadResult.message || `Successfully processed ${uploadResult.summary?.successful_creations || 0} programs.`}
                </p>

                {/* Stats Bar */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-2.5 border-t border-emerald-200/60 pt-4 text-left">
                  <div className="rounded-lg bg-white/80 p-3 border border-emerald-100">
                    <div className="text-[11px] font-semibold text-emerald-700">Total Evaluated</div>
                    <div className="text-lg font-bold text-slate-900 mt-0.5">
                      {uploadResult.summary?.total_processed || (uploadResult.programs?.length || 0)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3 border border-emerald-100">
                    <div className="text-[11px] font-semibold text-emerald-700">Successfully Created</div>
                    <div className="text-lg font-bold text-emerald-700 mt-0.5">
                      {uploadResult.summary?.successful_creations || (uploadResult.programs?.length || 0)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3 border border-emerald-100 col-span-2 sm:col-span-1">
                    <div className="text-[11px] font-semibold text-slate-500">Skipped (Existing)</div>
                    <div className="text-lg font-bold text-slate-700 mt-0.5">
                      {uploadResult.summary?.skipped_creations || (uploadResult.skipped?.length || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Created Programs Preview List */}
              {uploadResult.programs && uploadResult.programs.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                  <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-800 flex items-center justify-between">
                    <span>Imported Programs List</span>
                    <span className="text-slate-500 font-normal">{uploadResult.programs.length} programs</span>
                  </div>
                  <div className="max-h-60 overflow-y-auto divide-y divide-slate-100 text-xs">
                    {uploadResult.programs.map((prog, i) => (
                      <div key={i} className="px-4 py-2.5 flex items-center justify-between hover:bg-slate-50/60 transition-colors">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-400 text-[11px]">#{i + 1}</span>
                          <span className="font-semibold text-slate-900">{prog.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                            {prog.category || 'General'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                            {prog.is_team_based ? 'Group' : 'Individual'}
                          </span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-100">
                            {prog.program_type_name || prog.program_type || 'Event'}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Skipped Programs if any */}
              {uploadResult.skipped && uploadResult.skipped.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-900">
                  <div className="font-bold mb-1 flex items-center gap-1 text-amber-950">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                    <span>Skipped Programs ({uploadResult.skipped.length}):</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-amber-800">
                    {uploadResult.skipped.map((item, idx) => (
                      <li key={idx}>
                        <strong>{item.name}</strong>: {item.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Upload another file
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-sm transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* =========================================================================
               INITIAL UPLOAD SCREEN (Template Download & File Drag/Drop)
               ========================================================================= */
            <div className="space-y-5">
              {/* Step 1: Download Template */}
              <div className="rounded-xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 via-white to-indigo-50/40 p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-indigo-100/80 text-indigo-700 shrink-0 mt-0.5">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Step 1: Download Reference Excel Template</h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Pre-configured with dropdowns for your categories and event program types. Includes a complete <strong>Example</strong> sheet with sample solo and group competitions!
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={downloadTemplate}
                    disabled={downloadingTemplate}
                    className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                  >
                    {downloadingTemplate ? (
                      <>
                        <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                        Generating...
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5" />
                        Download Template
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Spreadsheet Column Reference */}
              <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5 text-xs">
                <div className="font-semibold text-slate-800 mb-1.5 flex items-center justify-between">
                  <span>Spreadsheet Columns & Field Rules</span>
                  <span className="text-[11px] font-normal text-slate-500">Mode-specific rules apply</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                    <div className="font-bold text-indigo-600 flex items-center gap-1">
                      <Check className="h-3 w-3" /> Core Required Columns
                    </div>
                    <p className="text-slate-600 mt-0.5">
                      <strong>Name</strong>, <strong>Category</strong>, <strong>Type</strong>, <strong>Mode</strong> (Individual / Group), and <strong>Duration Minutes</strong>.
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                    <div className="font-semibold text-slate-700">Mode-Specific Columns</div>
                    <p className="text-slate-500 mt-0.5">
                      Individual needs <strong>Max Participants</strong>. Group needs <strong>Team Size</strong>. (Max Sub-Teams and Judges are optional).
                    </p>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-indigo-700 bg-indigo-50/60 rounded px-2.5 py-1.5 border border-indigo-100 flex items-center gap-1.5">
                  <span>💡</span>
                  <span>General category programs can be entered directly by selecting "General" in the Category column!</span>
                </div>
              </div>

              {/* Step 2: Upload File */}
              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Step 2: Select Spreadsheet or CSV File
                  </label>
                  
                  <div 
                    className={`relative border-2 border-dashed rounded-xl p-6 transition-colors bg-slate-50/40 text-center ${
                      dragActive ? 'border-indigo-500 bg-indigo-50/60' : 'border-slate-300 hover:border-indigo-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="program-file-upload-dialog"
                    />
                    {file ? (
                      <div className="flex items-center justify-center gap-3">
                        <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
                          <FileSpreadsheet className="h-6 w-6" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-semibold text-slate-900 truncate max-w-xs">{file.name}</p>
                          <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB • Click or drag to change file</p>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="mx-auto h-8 w-8 text-slate-400" />
                        <p className="text-sm font-medium text-slate-700">Click or drag & drop to choose file</p>
                        <p className="text-xs text-slate-400">Supported formats: Excel (.xlsx, .xls) and CSV (.csv)</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Action Buttons */}
                <div className="flex justify-end items-center gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={uploading || !file}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors flex items-center gap-2"
                  >
                    {uploading ? (
                      <>
                        <div className="animate-spin w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full" />
                        Processing spreadsheet...
                      </>
                    ) : (
                      <>
                        <Upload className="h-3.5 w-3.5" />
                        Upload & Validate Programs
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EventPrograms; 
