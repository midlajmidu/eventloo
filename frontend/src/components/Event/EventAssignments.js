import React, { useState, useEffect } from 'react';
import { eventProgramsAPI, studentsAPI, eventAssignmentsAPI, teamsAPI } from '../../services/api';
import { 
  Users, 
  UserPlus, 
  Clock, 
  MapPin, 
  Search, 
  Filter,
  CheckCircle,
  XCircle,
  Calendar,
  Hash,
  Award,
  Target,
  FileText,
  Download,
  Eye
} from 'lucide-react';


const EventAssignments = ({ event, eventId, onRefresh }) => {
  const [programs, setPrograms] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  
  // Student filters
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    grade: ''
  });

  // Program filters
  const [programFilters, setProgramFilters] = useState({
    category: 'all', // 'all', 'hs', 'hss', 'general'
    isTeamBased: 'all', // 'all', 'true', 'false'
    search: ''
  });

  // Program count state (no pagination needed)
  const [programTotalCount, setProgramTotalCount] = useState(0);

  // Program Type Filter
  const [programTypeFilter, setProgramTypeFilter] = useState('all'); // 'all', 'stage', 'off_stage'


  // Team PDF modal state
  const [showTeamPDFModal, setShowTeamPDFModal] = useState(false);
  const [teams, setTeams] = useState([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Program details modal state
  const [showProgramDetailsModal, setShowProgramDetailsModal] = useState(false);
  const [selectedProgramForDetails, setSelectedProgramForDetails] = useState(null);

  useEffect(() => {
    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    filterStudents();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [students, filters, selectedProgram]);

  const fetchData = async () => {
    try {
      setLoading(true);
      

      
      // For assignment section, we want to see all programs, so let's fetch them all
      const [programsRes, studentsRes, assignmentsRes] = await Promise.all([
        eventProgramsAPI.getPrograms(eventId, 'page_size=1000'), // Fetch all programs
        studentsAPI.getStudents(),
        eventAssignmentsAPI.getEventAssignments(eventId),
      ]);
      
      // Handle programs response (now fetching all programs)
      const allPrograms = programsRes.data.results || programsRes.data;
      setPrograms(allPrograms);
      setProgramTotalCount(allPrograms.length);
      
      // Handle students response (no pagination needed for students in assignment view)
      setStudents(studentsRes.data.results || studentsRes.data);
      

      
      setAssignments(assignmentsRes.data || assignmentsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };



  const filterStudents = () => {
    let filtered = students.filter(student => {
      // Category filter
      if (filters.category && student.category !== filters.category) return false;
      
      // Grade filter
      if (filters.grade && student.grade !== filters.grade) return false;
      
      // Search filter
      if (filters.search) {
        const searchTerm = filters.search.toLowerCase();
        // Use proper name resolution for search
        const studentName = student.get_full_name ? student.get_full_name() : 
          `${student.first_name || ''} ${student.last_name || ''}`.trim() || 
          student.name || 
          `Student ${student.student_id}` || 
          'Unknown Student';
        const matchesName = studentName.toLowerCase().includes(searchTerm);
        const matchesId = student.student_id?.toLowerCase().includes(searchTerm);
        if (!matchesName && !matchesId) return false;
      }
      
      // Program category filter - STRICT FILTERING
      if (selectedProgram && selectedProgram.category) {
        // For non-general programs, only show students of matching category
        if (selectedProgram.category !== 'general' && student.category !== selectedProgram.category) {
          return false;
        }
      }
      
      return true;
    });

    // Remove already assigned students for this program
    if (selectedProgram) {
      const assignedStudentIds = assignments
        .filter(assignment => assignment.program_id === selectedProgram.id)
        .map(assignment => assignment.student_id);
      
      filtered = filtered.filter(student => !assignedStudentIds.includes(student.id));
    }

    setFilteredStudents(filtered);
  };

  const handleAssignStudents = async () => {
    if (!selectedProgram || selectedStudents.length === 0) return;

    // Validation: Check participant limit per team
    const currentAssignments = getAssignmentsForProgram(selectedProgram.id);
    if (selectedProgram.max_participants) {
      // Group assignments by team to check per-team limits
      const assignmentsByTeam = {};
      currentAssignments.forEach(assignment => {
        if (assignment.team_id) {
          if (!assignmentsByTeam[assignment.team_id]) {
            assignmentsByTeam[assignment.team_id] = [];
          }
          assignmentsByTeam[assignment.team_id].push(assignment);
        }
      });
      
      // Check if any team would exceed the limit
      const studentsByTeam = {};
      selectedStudents.forEach(studentId => {
        const student = students.find(s => s.id === studentId);
        if (student && student.team_id) {
          if (!studentsByTeam[student.team_id]) {
            studentsByTeam[student.team_id] = [];
          }
          studentsByTeam[student.team_id].push(student);
        }
      });
      
      const teamsExceedingLimit = [];
      Object.keys(studentsByTeam).forEach(teamId => {
        const currentTeamAssignments = assignmentsByTeam[teamId] || [];
        const newTeamStudents = studentsByTeam[teamId] || [];
        const teamName = students.find(s => s.team_id === parseInt(teamId))?.team_name || 'Unknown Team';
        
        if (currentTeamAssignments.length + newTeamStudents.length > selectedProgram.max_participants) {
          teamsExceedingLimit.push({
            teamName,
            current: currentTeamAssignments.length,
            trying: newTeamStudents.length,
            limit: selectedProgram.max_participants
          });
        }
      });
      
      if (teamsExceedingLimit.length > 0) {
        const errorMessage = teamsExceedingLimit.map(team => 
          `${team.teamName}: ${team.current} + ${team.trying} > ${team.limit}`
        ).join('\n');
        alert(`Cannot assign students. Teams would exceed participant limit:\n${errorMessage}`);
        return;
      }
    }

    try {
      const { eventAssignmentsAPI } = await import('../../services/api');
      await eventAssignmentsAPI.assignStudents(eventId, selectedProgram.id, {
        student_ids: selectedStudents
      });
      
      setShowAssignModal(false);
      setSelectedStudents([]);
      fetchData();
      if (onRefresh) onRefresh();
      alert('Students assigned successfully!');
    } catch (error) {
      console.error('Error assigning students:', error);
      alert(error.response?.data?.error || 'Failed to assign students');
    }
  };

  const handleAssignAllCategory = async (category) => {
    if (!selectedProgram) return;

    const categoryNames = {
      'hs': 'High School',
      'hss': 'Higher Secondary School',
              'general': 'General'
    };

    if (!window.confirm(`Are you sure you want to assign ALL ${categoryNames[category]} students to "${selectedProgram.name}"?`)) {
      return;
    }

    try {
      const { eventAssignmentsAPI } = await import('../../services/api');
      const response = await eventAssignmentsAPI.assignAllCategory(eventId, selectedProgram.id, category);
      
      alert(response.data.message);
      if (response.data.errors && response.data.errors.length > 0) {
        console.log('Assignment errors:', response.data.errors);
      }
      
      fetchData();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error assigning all category:', error);
      alert(error.response?.data?.error || 'Failed to assign all category students');
    }
  };

  const handleUnassignStudent = async (assignment) => {
    if (window.confirm('Are you sure you want to unassign this student?')) {
      try {
        await eventAssignmentsAPI.deleteAssignment(eventId, assignment.program_id, assignment.id);
        alert('Student unassigned successfully!');
        fetchData();
      } catch (error) {
        console.error('Error unassigning student:', error);
        alert('Error unassigning student. Please try again.');
      }
    }
  };

  const getAssignmentsForProgram = (programId) => {
    const filtered = assignments.filter(assignment => assignment.program === programId);
    return filtered;
  };

  const toggleStudentSelection = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const getCategoryDisplay = (category) => {
    const categories = {
      'hs': 'High School',
      'hss': 'HSS',
      'general': 'General'
    };
    return categories[category] || category;
  };

  const getCategoryColor = (category) => {
    const colors = {
      'hs': 'bg-blue-50 text-blue-700 border-blue-200',
      'hss': 'bg-green-50 text-green-700 border-green-200',
      'general': 'bg-purple-50 text-purple-700 border-purple-200'
    };
    return colors[category] || 'bg-gray-50 text-gray-700 border-gray-200';
  };

  const getStatusColor = (assignedCount, maxParticipants) => {
    if (!maxParticipants) return 'bg-blue-500';
    const percentage = (assignedCount / maxParticipants) * 100;
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  // Filter programs based on selected category and search
  const filterPrograms = (programs) => {
    return programs.filter(program => {
      // Category filter
      if (programFilters.category !== 'all' && program.category !== programFilters.category) {
        return false;
      }
      
      // Team-based filter
      if (programFilters.isTeamBased !== 'all') {
        const isTeamBased = programFilters.isTeamBased === 'true';
        if (program.is_team_based !== isTeamBased) {
          return false;
        }
      }
      
      // Search filter
      if (programFilters.search) {
        const searchLower = programFilters.search.toLowerCase();
        const matches = program.name.toLowerCase().includes(searchLower) ||
               program.description?.toLowerCase().includes(searchLower) ||
               program.venue?.toLowerCase().includes(searchLower);
        if (!matches) {
          return false;
        }
      }
      
      return true;
    });
  };

  // Filter programs by program_type
  const filteredPrograms = programs.filter((program) => {
    if (programTypeFilter === 'all') return true;
    return program.program_type === programTypeFilter;
  });

  // Team PDF functions
  const fetchTeams = async () => {
    try {
      const response = await teamsAPI.getTeams();
      setTeams(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching teams:', error);
      alert('Error fetching teams. Please try again.');
    }
  };

  const handleShowTeamPDFModal = async () => {
    setShowTeamPDFModal(true);
    await fetchTeams();
  };

  const handleGenerateTeamPDF = async () => {
    if (!selectedTeam) {
      alert('Please select a team first.');
      return;
    }

    try {
      setGeneratingPDF(true);
      const response = await teamsAPI.generateTeamListPDF(eventId, selectedTeam);
      
      // Create blob and download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Get team name for filename
      const team = teams.find(t => t.id === parseInt(selectedTeam));
      const filename = `${team?.name || 'team'}_program_list.pdf`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      setShowTeamPDFModal(false);
      setSelectedTeam('');
    } catch (error) {
      console.error('Error generating team PDF:', error);
      alert('Error generating team PDF. Please try again.');
    } finally {
      setGeneratingPDF(false);
    }
  };

  const handleShowProgramDetails = (program) => {
    setSelectedProgramForDetails(program);
    setShowProgramDetailsModal(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Program Assignments</h1>
            <p className="text-gray-600 mt-1">Assign students to programs for {event?.title}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="bg-white px-4 py-2 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-gray-600">{programTotalCount} programs</span>
              </div>
            </div>
            <div className="bg-white px-4 py-2 rounded-lg border border-gray-200">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-gray-600">{assignments.length} assignments</span>
              </div>
            </div>
            <button
              onClick={handleShowTeamPDFModal}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
              title="Generate Team List PDF"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Team List PDF</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search programs..."
                value={programFilters.search}
                onChange={(e) => {
                  setProgramFilters(prev => ({ ...prev, search: e.target.value }));
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Category Filter */}
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select
                value={programFilters.category}
                onChange={(e) => {
                  setProgramFilters(prev => ({ ...prev, category: e.target.value }));
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Categories</option>
                <option value="hs">High School</option>
                <option value="hss">HSS</option>
                <option value="general">General</option>
              </select>
            </div>
          </div>
          
          {/* Team-based Filter */}
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select
                value={programFilters.isTeamBased}
                onChange={(e) => {
                  setProgramFilters(prev => ({ ...prev, isTeamBased: e.target.value }));
                }}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Types</option>
                <option value="true">Team-based</option>
                <option value="false">Individual</option>
              </select>
            </div>
          </div>
          
          {/* Program Type Filter */}
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select
                value={programTypeFilter}
                onChange={e => setProgramTypeFilter(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none bg-white"
              >
                <option value="all">All Types</option>
                <option value="stage">Stage</option>
                <option value="off_stage">Off-Stage</option>
              </select>
            </div>
          </div>

        </div>
      </div>

      {/* Programs Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filterPrograms(filteredPrograms).map((program) => {
          const programAssignments = getAssignmentsForProgram(program.id);
          const assignedCount = programAssignments.length;
          const maxParticipants = program.max_participants;
          const progressPercentage = maxParticipants ? (assignedCount / maxParticipants) * 100 : 0;
          
          return (
            <div key={program.id} className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden">
              {/* Program Header */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm mb-1 truncate">{program.name}</h3>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getCategoryColor(program.category)}`}>
                        {getCategoryDisplay(program.category)}
                      </span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${program.is_team_based ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
                        {program.is_team_based ? 'Team' : 'Individual'}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedProgram(program);
                      setShowAssignModal(true);
                      setSelectedStudents([]);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-lg transition-colors"
                    title="Assign Students"
                  >
                    <UserPlus className="h-4 w-4" />
                  </button>
                </div>

                {/* Program Details */}
                <div className="space-y-1">
                  {program.start_time && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <Clock className="h-3 w-3" />
                      <span>{new Date(program.start_time).toLocaleString()}</span>
                    </div>
                  )}
                  {program.venue && (
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <MapPin className="h-3 w-3" />
                      <span className="truncate">{program.venue}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Assignment Progress */}
              <div className="p-4 border-b border-gray-100">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" />
                    <span className="text-sm font-medium text-gray-700">Assigned</span>
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    {assignedCount}{maxParticipants && ` (max ${maxParticipants}/team)`}
                  </div>
                </div>
                
                {maxParticipants && (
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className={`h-2 rounded-full transition-all duration-300 ${getStatusColor(assignedCount, maxParticipants)}`}
                      style={{ width: `${Math.min((assignedCount / maxParticipants) * 100, 100)}%` }}
                    ></div>
                  </div>
                )}
                
                {maxParticipants && (
                  <div className="mt-2 text-xs text-gray-500">
                    {assignedCount >= maxParticipants ? (
                      <span className="text-green-600 font-medium">✓ Teams at limit</span>
                    ) : assignedCount >= maxParticipants * 0.75 ? (
                      <span className="text-yellow-600 font-medium">⚠ Near team limits</span>
                    ) : (
                      <span>{assignedCount} participants assigned</span>
                    )}
                  </div>
                )}
              </div>

              {/* View Details Button */}
              <div className="p-4">
                        <button
                  onClick={() => handleShowProgramDetails(program)}
                  className="w-full bg-gray-50 hover:bg-gray-100 text-gray-700 px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  title="View program details and all assigned students"
                        >
                  <Eye className="h-4 w-4" />
                  View Details ({assignedCount} students)
                        </button>
              </div>
            </div>
          );
        })}
      </div>



      {/* Empty State */}
      {filterPrograms(filteredPrograms).length === 0 && (
        <div className="text-center py-12">
          <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md mx-auto">
            <div className="text-gray-400 text-5xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {programs.length === 0 ? 'No programs available' : 'No programs match your search'}
            </h3>
            <p className="text-gray-500 text-sm">
              {programs.length === 0 
                ? 'Please add programs first before assigning students.'
                : 'Try adjusting your search or filter criteria.'
              }
            </p>
          </div>
        </div>
      )}



      {/* Team PDF Modal */}
      {showTeamPDFModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full max-h-[90vh] flex flex-col shadow-2xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Generate Team List PDF</h2>
                  <p className="text-gray-600 mt-1">Select a team to generate their program list</p>
                </div>
                <button
                  onClick={() => {setShowTeamPDFModal(false); setSelectedTeam('');}}
                  className="text-gray-400 hover:text-gray-600 p-2"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden flex flex-col p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Team
                </label>
                <select
                  value={selectedTeam}
                  onChange={(e) => setSelectedTeam(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Choose a team...</option>
                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name} ({team.member_count} members)
                    </option>
                  ))}
                </select>
              </div>

              {selectedTeam && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <div className="text-blue-600 mt-0.5">ℹ️</div>
                    <div>
                      <p className="text-sm font-medium text-blue-800">PDF Contents</p>
                      <p className="text-xs text-blue-700 mt-1">
                        The PDF will include all programs assigned to this team, organized by category, 
                        with student names, IDs, classes, and program details.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {setShowTeamPDFModal(false); setSelectedTeam('');}}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateTeamPDF}
                  disabled={!selectedTeam || generatingPDF}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generatingPDF ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Generating...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      Generate PDF
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Assignment Modal */}
      {showAssignModal && selectedProgram && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Assign Students to {selectedProgram.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getCategoryColor(selectedProgram.category)}`}>
                      {getCategoryDisplay(selectedProgram.category)}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${selectedProgram.is_team_based ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
                      {selectedProgram.is_team_based ? 'Team' : 'Individual'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedStudents([]);
                    setSelectedProgram(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 p-2"
                  title="Close"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden flex flex-col p-6">
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Students to Assign
                </label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {filteredStudents.map((student) => (
                    <button
                      key={student.id}
                      onClick={() => toggleStudentSelection(student.id)}
                      className={`px-3 py-1 text-xs font-medium rounded-full border ${
                        selectedStudents.includes(student.id)
                          ? 'bg-blue-500 text-white border-transparent'
                          : 'bg-gray-200 text-gray-700 border-gray-300'
                      }`}
                      title={`${student.get_full_name ? student.get_full_name() : `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.name || `Student ${student.student_id}` || 'Unknown Student'} (${student.student_id})`}
                    >
                      {student.get_full_name ? student.get_full_name() : `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.name || `Student ${student.student_id}` || 'Unknown Student'}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-600">
                  {filteredStudents.length} students available for assignment.
                </p>
                  </div>
                  
              {selectedStudents.length > 0 && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <div className="flex items-start gap-2">
                    <div className="text-blue-600 mt-0.5">ℹ️</div>
                        <div>
                      <p className="text-sm font-medium text-blue-800">Selected Students</p>
                      <p className="text-xs text-blue-700 mt-1">
                        {selectedStudents.length} students selected for assignment to this program.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
            </div>
                  
            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedStudents([]);
                    setSelectedProgram(null);
                  }}
                  className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignStudents}
                  disabled={selectedStudents.length === 0 || generatingPDF}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {generatingPDF ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Assigning...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      Assign Students
                    </>
                  )}
                </button>
              </div>
                        </div>
                      </div>
                    </div>
                  )}

      {/* Program Details Modal */}
      {showProgramDetailsModal && selectedProgramForDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-start">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">{selectedProgramForDetails.name}</h2>
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getCategoryColor(selectedProgramForDetails.category)}`}>
                      {getCategoryDisplay(selectedProgramForDetails.category)}
                    </span>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${selectedProgramForDetails.is_team_based ? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-gray-50 text-gray-700 border border-gray-200'}`}>
                      {selectedProgramForDetails.is_team_based ? 'Team' : 'Individual'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setShowProgramDetailsModal(false)}
                  className="text-gray-400 hover:text-gray-600 p-2"
                  title="Close"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-hidden flex flex-col p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                  <p className="text-sm font-medium text-gray-700">Program Details</p>
                  <p className="text-gray-900 font-semibold">{selectedProgramForDetails.name}</p>
                  <p className="text-gray-500 text-sm mt-1">
                    <Clock className="h-4 w-4 inline-block mr-1" /> {new Date(selectedProgramForDetails.start_time).toLocaleString()}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    <MapPin className="h-4 w-4 inline-block mr-1" /> {selectedProgramForDetails.venue}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    <Users className="h-4 w-4 inline-block mr-1" /> {getCategoryDisplay(selectedProgramForDetails.category)}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    <Hash className="h-4 w-4 inline-block mr-1" /> {selectedProgramForDetails.is_team_based ? 'Team-based' : 'Individual'}
                  </p>
                  {selectedProgramForDetails.max_participants && (
                    <p className="text-gray-500 text-sm mt-1">
                      <Target className="h-4 w-4 inline-block mr-1" /> Max Participants: {selectedProgramForDetails.max_participants}
                    </p>
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-700">Assigned Students</p>
                  {getAssignmentsForProgram(selectedProgramForDetails.id).length === 0 ? (
                    <p className="text-gray-500 text-sm">No students assigned yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto pr-2">
                      {getAssignmentsForProgram(selectedProgramForDetails.id).map((assignment) => (
                        <div key={assignment.id} className="bg-gray-50 p-3 rounded-lg flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="text-gray-900 font-medium">{assignment.student_name}</p>
                              {assignment.team_name && (
                                <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                                  {assignment.team_name}
                              </span>
                              )}
                            </div>
                            <p className="text-gray-500 text-xs">{assignment.student_id}</p>
                            <p className="text-gray-500 text-xs">Class: {assignment.student_class}</p>
                          </div>
                          <button
                            onClick={() => handleUnassignStudent(assignment)}
                            className="text-red-600 hover:text-red-700 text-sm font-medium ml-2"
                            title="Unassign Student"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                  ))}
                </div>
                    )}
                  </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex gap-3 justify-end">
                  <button
                  onClick={() => setShowProgramDetailsModal(false)}
                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                  Close
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      
    </div>
  );
};

export default EventAssignments; 