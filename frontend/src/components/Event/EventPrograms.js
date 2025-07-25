import React, { useState, useEffect } from 'react';
import { eventProgramsAPI, eventsAPI } from '../../services/api';
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
  Eye
} from 'lucide-react';
import Pagination from '../common/Pagination';

const EventPrograms = ({ event, eventId, onRefresh }) => {
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingProgram, setEditingProgram] = useState(null);
  const [showProgramBulkUpload, setShowProgramBulkUpload] = useState(false);
  
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
    max_participants: '',
    max_participants_per_team: '',
    is_team_based: false,
    team_size_min: '',
    team_size_max: '',
    start_time: '',
    end_time: '',
    program_type: 'stage', // new field
  });

  useEffect(() => {
    fetchPrograms();
  }, [eventId, categoryFilter, statusFilter, sortBy, currentPage, pageSize, searchTerm, programTypeFilter]);

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
    
    if (formData.is_team_based && (!formData.max_participants_per_team || formData.max_participants_per_team <= 0)) {
      alert('Max Participants Per Team is required for team-based programs. Please enter a positive number.');
      return;
    }
    
    try {
      const actualEventId = eventId || event?.id;
      
      const programData = {
        ...formData,
        max_participants: parseInt(formData.max_participants) || null,
        max_participants_per_team: parseInt(formData.max_participants_per_team) || null,
        team_size: formData.is_team_based ? parseInt(formData.team_size) || null : null,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        program_type: formData.program_type || 'stage',
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
      alert('Error saving program. Please try again.');
    }
  };

  const handleEdit = (program) => {
    setEditingProgram(program);
    setFormData({
      name: program.name,
      description: program.description || '',
              category: program.category || 'general',
      venue: program.venue || '',
      max_participants: program.max_participants || '',
      max_participants_per_team: program.max_participants_per_team || '',
      is_team_based: program.is_team_based,
      team_size: program.team_size || '',
      start_time: program.start_time || '',
      end_time: program.end_time || '',
      program_type: program.program_type || 'stage',
    });
    setShowAddModal(true);
  };

  // Handle category change - enforce team-based rules
  const handleCategoryChange = (category) => {
    const newFormData = { ...formData, category };
    
    // HS and HSS programs must be individual (not team-based)
    if (category === 'hs' || category === 'hss') {
      newFormData.is_team_based = false;
      newFormData.team_size = '';
      newFormData.max_participants_per_team = '';
    }
    
    setFormData(newFormData);
  };

  // Check if team-based option should be disabled
  const isTeamBasedDisabled = formData.category === 'hs' || formData.category === 'hss';

  // Get points system description based on category and team-based status
  const getPointsSystemDescription = (category, isTeamBased) => {
    if (category === 'hs' || category === 'hss') {
      return "Points: 5, 3, 1 (Individual only)";
    } else if (category === 'general') {
      return "Points: 10, 6, 3 (Individual & Team)";
    }
    return "Points: 5, 3, 1";
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
      max_participants: '',
      max_participants_per_team: '',
      is_team_based: false,
      team_size: '',
      start_time: '',
      end_time: '',
      program_type: 'stage',
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
    const categories = {
      'hs': 'High School',
      'hss': 'HSS',
      'general': 'General'
    };
    return categories[category] || category;
  };

  const getCategoryBadge = (category) => {
    const badges = {
      'hs': 'bg-blue-100 text-blue-800 border-blue-200',
      'hss': 'bg-green-100 text-green-800 border-green-200',
      'general': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return badges[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getStatusDisplay = (program) => {
    if (program.is_finished) return 'Finished';
    
    const now = new Date();
    const startTime = new Date(program.start_time);
    const endTime = new Date(program.end_time);
    
    if (now < startTime) return 'Upcoming';
    if (now >= startTime && now <= endTime) return 'Ongoing';
    return 'Past';
  };

  const getStatusColor = (status) => {
    const colors = {
      'Upcoming': 'bg-blue-100 text-blue-800',
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
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
              <h1 className="text-3xl font-bold text-gray-900">Event Programs</h1>
              <p className="text-gray-600 mt-2">
                Manage programs for {event?.title}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowProgramBulkUpload(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Upload className="h-5 w-5" />
                <span>Bulk Upload</span>
              </button>
              <button
                onClick={() => {setShowAddModal(true); setEditingProgram(null); resetForm();}}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Add Program</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-medium text-gray-900">Filters</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search programs..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                <option value="hs">High School</option>
                <option value="hss">HSS</option>
                <option value="general">General</option>
              </select>
            </div>

            {/* Program Type Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={programTypeFilter}
                onChange={e => setProgramTypeFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Types</option>
                <option value="stage">Stage</option>
                <option value="off_stage">Off-Stage</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="finished">Finished</option>
              </select>
            </div>

            {/* Sort By */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="start_time">Start Time</option>
                <option value="name">Name</option>
                <option value="category">Category</option>
                <option value="created_at">Created Date</option>
              </select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mt-4 bg-gray-50 px-4 py-3 rounded-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <span className="text-sm text-gray-600">
                  Showing {filteredPrograms.length} of {totalCount} programs
                  {searchTerm && ` (filtered by "${searchTerm}")`}
                </span>
                
                {/* Category-wise counts */}
                <div className="flex items-center gap-3 text-xs">
                  {(() => {
                    const counts = getCategoryCounts();
                    return (
                      <>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                          <span className="text-gray-600">HS: {counts.hs}</span>
                        </span>
                        <span className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                          <span className="text-gray-600">HSS: {counts.hss}</span>
                        </span>

                                                  <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                            <span className="text-gray-600">General: {counts.general}</span>
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-2 h-2 bg-gray-500 rounded-full"></span>
                            <span className="text-gray-600">Total: {counts.total}</span>
                          </span>
                      </>
                    );
                  })()}
                </div>
              </div>
              
              <button
                onClick={() => {
                  setSearchTerm('');
                  setCategoryFilter('all');
                  setStatusFilter('all');
                  setSortBy('start_time');
                  setProgramTypeFilter('all');
                }}
                className="text-blue-600 hover:text-blue-800 font-medium text-sm"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Programs Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Program
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category & Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Schedule & Venue
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Participants
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPrograms.map((program) => {
                  const status = getStatusDisplay(program);

                  return (
                    <tr key={program.id} className="hover:bg-gray-50 transition-colors">
                      {/* Program Name & Description */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {program.name}
                          </div>
                          {program.description && (
                            <div className="text-sm text-gray-500 truncate max-w-xs">
                              {program.description}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Category & Type */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getCategoryBadge(program.category)}`}>
                            {getCategoryDisplay(program.category)}
                          </span>
                          <div className="text-xs text-gray-500">
                            {program.is_team_based ? (
                              <span className="flex items-center">
                                <Users className="h-3 w-3 mr-1" />
                                Team
                                {program.team_size && 
                                  ` (${program.team_size} members)`
                                }
                              </span>
                            ) : (
                              <span className="flex items-center">
                                <Users className="h-3 w-3 mr-1" />
                                Individual
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-blue-600 font-medium">
                            {getPointsSystemDescription(program.category, program.is_team_based)}
                          </div>
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${program.program_type === 'stage' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-green-50 text-green-700 border-green-200'} ml-1`}>
                            {program.program_type === 'stage' ? 'Stage' : 'Off-Stage'}
                          </span>
                        </div>
                      </td>

                      {/* Schedule & Venue */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          {program.start_time && (
                            <div className="text-sm text-gray-900 flex items-center">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatDateTime(program.start_time)}
                            </div>
                          )}
                          {program.venue && (
                            <div className="text-xs text-gray-500 flex items-center">
                              <MapPin className="h-3 w-3 mr-1" />
                              {program.venue}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Participants */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="space-y-1">
                          <div className="text-sm text-gray-900">
                            {program.participants_count || 0}
                            {program.max_participants && ` / ${program.max_participants}`}
                          </div>
                          <div className="text-xs text-gray-500">
                            participants
                          </div>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(status)}`}>
                          {status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleEdit(program)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50 transition-colors"
                            title="Edit Program"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleMarkFinished(program.id, !program.is_finished)}
                            className={`p-1 rounded-md transition-colors ${program.is_finished 
                              ? 'text-yellow-600 hover:text-yellow-800 hover:bg-yellow-50' 
                              : 'text-green-600 hover:text-green-800 hover:bg-green-50'
                            }`}
                            title={program.is_finished ? 'Mark as Not Finished' : 'Mark as Finished'}
                          >
                            {program.is_finished ? <XCircle className="h-4 w-4" /> : <CheckCircle className="h-4 w-4" />}
                          </button>
                          <button
                            onClick={() => handleDelete(program.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded-md hover:bg-red-50 transition-colors"
                            title="Delete Program"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
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
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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

        {/* Add/Edit Program Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold">
                  {editingProgram ? 'Edit Program' : 'Add New Program'}
                </h2>
                <button
                  onClick={() => {setShowAddModal(false); setEditingProgram(null); resetForm();}}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Program Name *</label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                    <select
                      required
                      value={formData.category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="hs">High School</option>
                      <option value="hss">HSS</option>
                      <option value="general">General</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {getPointsSystemDescription(formData.category, formData.is_team_based)}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                    <select
                      name="program_type"
                      value={formData.program_type}
                      onChange={e => setFormData({ ...formData, program_type: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="stage">Stage</option>
                      <option value="off_stage">Off-Stage</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Venue</label>
                    <input
                      type="text"
                      value={formData.venue}
                      onChange={(e) => setFormData({...formData, venue: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {formData.is_team_based ? 'Max Participants Per Team' : 'Total Participants in Each Team *'}
                    </label>
                    <input
                      type="number"
                      min="1"
                      required={!formData.is_team_based}
                      value={formData.is_team_based ? formData.max_participants_per_team : formData.max_participants}
                      onChange={(e) => {
                        if (formData.is_team_based) {
                          setFormData({...formData, max_participants_per_team: e.target.value});
                        } else {
                          setFormData({...formData, max_participants: e.target.value});
                        }
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder={formData.is_team_based ? 
                        "e.g., 3 (each team can assign up to 3 students)" : 
                        "e.g., 3 (each team can assign 3 students, total = teams × 3)"
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.is_team_based ? 
                        "Maximum number of participants each team can assign to this program" :
                        "Number of participants each team can assign to this program (total participants = teams × this number) - REQUIRED"
                      }
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                    <input
                      type="datetime-local"
                      value={formData.start_time}
                      onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                    <input
                      type="datetime-local"
                      value={formData.end_time}
                      onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Program Type *</label>
                    <select
                      required
                      value={formData.program_type}
                      onChange={e => setFormData({...formData, program_type: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="stage">Stage</option>
                      <option value="off_stage">Off Stage</option>
                    </select>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows="3"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                            // Clear the other participant limit field when switching
                            max_participants: isTeamBased ? '' : formData.max_participants,
                            max_participants_per_team: isTeamBased ? formData.max_participants_per_team : ''
                          });
                        }}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        disabled={isTeamBasedDisabled}
                      />
                      <label htmlFor="is_team_based" className={`ml-2 block text-sm ${isTeamBasedDisabled ? 'text-gray-400' : 'text-gray-900'}`}>
                        Team-based program
                        {isTeamBasedDisabled && (
                          <span className="block text-xs text-gray-500 mt-1">
                            (Only available for General category - 10, 6, 3 points)
                          </span>
                        )}
                        {!isTeamBasedDisabled && formData.category === 'general' && (
                          <span className="block text-xs text-gray-500 mt-1">
                            (General category - 10, 6, 3 points for both individual and team)
                          </span>
                        )}
                      </label>
                    </div>
                  </div>
                </div>

                {formData.is_team_based && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Team Size *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={formData.team_size}
                      onChange={(e) => setFormData({...formData, team_size: e.target.value})}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter team size (e.g., 5)"
                    />
                    <p className="text-xs text-gray-500 mt-1">Number of members per team</p>
                  </div>
                )}

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={() => {setShowAddModal(false); setEditingProgram(null); resetForm();}}
                    className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    {editingProgram ? 'Update Program' : 'Create Program'}
                  </button>
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
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="font-medium text-blue-800 mb-2">Step 1: Download Template</h3>
            <p className="text-sm text-blue-600 mb-3">
              Download the Excel template with sample data and instructions for creating multiple programs. 
              <strong>Note: General category programs should be created manually, not via bulk upload.</strong>
            </p>
            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
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
                  ? 'border-blue-500 bg-blue-50' 
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
                  : 'bg-green-600 hover:bg-green-700'
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