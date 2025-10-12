import React, { useState, useEffect } from 'react';
import { studentsAPI, teamsAPI } from '../../services/api';
import Pagination from '../common/Pagination';
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Eye, 
  UserPlus,
  GraduationCap,
  Mail,
  MapPin,
  User,
  Trophy,
  Upload,
  Trash2
} from 'lucide-react';

const StudentsPage = () => {
  const [students, setStudents] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedGrade, setSelectedGrade] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showTeamAssignModal, setShowTeamAssignModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    grade: '',
    section: '',
    address: ''
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Add state for stream filter


  useEffect(() => {
    fetchStudents();
    fetchTeams();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Add effect to fetch students when page or pageSize changes
  useEffect(() => {
    fetchStudents();
  }, [currentPage, pageSize]);

  const fetchStudents = async () => {
    try {
      setLoading(true);
      const response = await studentsAPI.getStudents({
        page: currentPage,
        page_size: pageSize,
        search: searchTerm,
        category: selectedCategory,
        grade: selectedGrade,
        section: selectedSection,
        team: selectedTeam,
      });
      
      // Handle paginated response
      if (response?.data?.results) {
        setStudents(response.data.results);
        setTotalCount(response.data.count || 0);
      } else {
        // Fallback for non-paginated response
        const studentData = response?.data || [];
        setStudents(Array.isArray(studentData) ? studentData : []);
        setTotalCount(studentData.length || 0);
      }
    } catch (error) {
      console.error('Error fetching students:', error);
      setStudents([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeams = async () => {
    try {
      const response = await teamsAPI.getTeams();
      const teamData = response?.data?.results || response?.data || response || [];
      setTeams(Array.isArray(teamData) ? teamData : []);
    } catch (error) {
      console.error('Error fetching teams:', error);
      setTeams([]);
    }
  };

  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      setCurrentPage(1); // Reset to first page when filters change
      fetchStudents();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm, selectedCategory, selectedGrade, selectedSection, selectedTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      // Prepare the data for submission
      const studentData = {
        name: formData.name,
        category: formData.category,
        grade: formData.grade,
        section: formData.section,
        address: formData.address
      };

      // Add stream for HSS students (append to section or handle separately)
      if (formData.category === 'hss' && formData.stream) {
        studentData.section = formData.section ? `${formData.section} (${formData.stream})` : formData.stream;
      }

      await studentsAPI.createStudent(studentData);
      
      setShowAddModal(false);
      resetForm();
      fetchStudents();
      alert('Student added successfully!');
    } catch (error) {
      console.error('Error adding student:', error);
      console.error('Error response:', error.response);
      
      // Provide more specific error messages
      let errorMessage = 'Error adding student. Please check the form data.';
      
      if (error.response) {
        const status = error.response.status;
        const data = error.response.data;
        
        if (status === 400) {
          if (data?.student_id) {
            errorMessage = `Student ID Error: ${data.student_id}`;
          } else if (data?.name) {
            errorMessage = `Name Error: ${data.name}`;
          } else if (data?.category) {
            errorMessage = `Category Error: ${data.category}`;
          } else if (data?.grade) {
            errorMessage = `Grade Error: ${data.grade}`;
          } else if (typeof data === 'object') {
            errorMessage = 'Validation errors:\n' + Object.entries(data).map(([field, errors]) => 
              `${field}: ${Array.isArray(errors) ? errors.join(', ') : errors}`
            ).join('\n');
          } else {
            errorMessage = data?.detail || data?.error || 'Invalid form data. Please check all required fields.';
          }
        } else if (status === 403) {
          errorMessage = 'Permission denied. You do not have permission to create students.';
        } else if (status === 500) {
          errorMessage = 'Server error. Please try again later.';
        } else if (data?.error) {
          errorMessage = data.error;
        } else if (data?.detail) {
          errorMessage = data.detail;
        }
      } else if (error.message) {
        errorMessage = `Network error: ${error.message}`;
      }
      
      alert(errorMessage);
    }
  };

  const handleAssignToTeam = async (studentId, teamId, forceReassign = false) => {
    try {
      if (teamId === 'remove') {
        // Remove from current team
        await studentsAPI.removeFromTeam(studentId);
        fetchStudents();
        setShowTeamAssignModal(false);
        alert('Student removed from team successfully!');
        return;
      }
      
      const assignData = { team_id: teamId };
      if (forceReassign) {
        assignData.force_reassign = true;
      }
      
      await studentsAPI.assignToTeam(studentId, assignData);
      fetchStudents();
      setShowTeamAssignModal(false);
      alert('Student assigned to team successfully!');
    } catch (error) {
      console.error('Error assigning student to team:', error);
      
      // Check if it's a conflict error (409)
      if (error.response?.status === 409 && error.response?.data?.can_reassign) {
        const conflictData = error.response.data;
        const confirmMessage = `${conflictData.message}\n\nClick OK to proceed with reassignment, or Cancel to keep current assignment.`;
        
        if (window.confirm(confirmMessage)) {
          // User confirmed, retry with force_reassign
          return handleAssignToTeam(studentId, teamId, true);
        }
      } else {
        alert(error.response?.data?.error || 'Error assigning student to team.');
      }
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      category: '',
      grade: '',
      section: '',
      address: ''
    });
  };

  const handleViewStudent = (student) => {
    setSelectedStudent(student);
    setShowViewModal(true);
  };

  const handleAssignTeam = (student) => {
    setSelectedStudent(student);
    setShowTeamAssignModal(true);
  };

  // Get student's team info
  const getStudentTeam = (student) => {
    // First check if student has a direct team reference from the backend
    if (student.team) {
      return student.team;
    }
    
    // Check if student has team_id field and find the corresponding team
    if (student.team_id) {
      const team = teams.find(t => t.id === student.team_id);
      if (team) {
        return team;
      }
    }
    
    // Fallback: Check if student is in any team's members
    const foundTeam = teams.find(team => {
      // Check if student is in members array
      if (team.members && Array.isArray(team.members)) {
        return team.members.some(member => 
          member.id === student.id || 
          member.student_id === student.student_id ||
          member.user_id === student.id
        );
      }
      
      return false;
    });
    
    return foundTeam;
  };

  // Get unique sections from students
  const sections = [...new Set(students.map(s => s.section).filter(Boolean))];

  const getCategoryBadge = (category) => {
    const badges = {
      'hs': 'bg-blue-100 text-blue-800 border-blue-200',
      'hss': 'bg-green-100 text-green-800 border-green-200',
      'general': 'bg-purple-100 text-purple-800 border-purple-200'
    };
    return badges[category] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const getCategoryDisplay = (category) => {
    const displays = {
      'hs': 'High School',
      'hss': 'Higher Secondary',
      'general': 'General'
    };
    return displays[category] || category;
  };

  // Pagination handlers
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };
  const handlePageSizeChange = (size) => {
    setPageSize(size);
    setCurrentPage(1); // Reset to first page when page size changes
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
              <h1 className="text-3xl font-bold text-gray-900">Students Management</h1>
              <p className="text-gray-600 mt-2">
                Manage student profiles, assignments, and team memberships
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkUploadModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Upload className="h-5 w-5" />
                <span>Bulk Upload</span>
              </button>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 transition-colors"
              >
                <Plus className="h-5 w-5" />
                <span>Add Student</span>
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-7 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name, ID, or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Categories</option>
                <option value="hs">High School</option>
                <option value="hss">Higher Secondary</option>
                <option value="general">General</option>
              </select>
            </div>

            {/* Grade */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Grade</label>
              <select
                value={selectedGrade}
                onChange={(e) => setSelectedGrade(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Grades</option>
                <option value="8">Grade 8</option>
                <option value="9">Grade 9</option>
                <option value="10">Grade 10</option>
                <option value="plus_one_science">Plus One Science</option>
                <option value="plus_one_commerce">Plus One Commerce</option>
                <option value="plus_two_science">Plus Two Science</option>
                <option value="plus_two_commerce">Plus Two Commerce</option>
              </select>
            </div>

            {/* Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Section</label>
              <select
                value={selectedSection}
                onChange={(e) => setSelectedSection(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Sections</option>
                {sections.map(section => (
                  <option key={section} value={section}>{section}</option>
                ))}
              </select>
            </div>

            {/* Team */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Team</label>
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="">All Students</option>
                <option value="unassigned">Unassigned</option>
                {teams.map(team => (
                  <option key={team.id} value={team.id}>{team.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Results Summary */}
          <div className="mt-4 flex items-center justify-between text-sm text-gray-600 bg-gray-50 px-4 py-2 rounded-lg">
            <span>
              Showing {students.length} of {totalCount} students
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('');
                setSelectedGrade('');
                setSelectedSection('');
                setSelectedTeam('');
              }}
              className="text-blue-600 hover:text-blue-800 font-medium"
            >
              Clear Filters
            </button>
          </div>
        </div>

        {/* Students Table */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Student
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    ID & Grade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Category
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Team Assignment
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {students.map((student) => {
                  const studentTeam = getStudentTeam(student);
                  // Remove all captain-related logic
                  // Remove isTeamCaptain checks
                  // Remove any code that references team.captain
                  // Only show students as regular members
                  return (
                    <tr key={student.id} className="hover:bg-gray-50 transition-colors">
                      {/* Student Name & Photo */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                            <span className="text-blue-600 font-semibold text-sm">
                              {student.first_name?.[0]}{student.last_name?.[0]}
                            </span>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">
                              {student.get_full_name ? student.get_full_name() : `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.name || `Student ${student.student_id}` || 'Unknown Student'}
                            </div>
                            <div className="text-sm text-gray-500">
                              {student.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* ID & Grade */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{student.student_id}</div>
                        <div className="text-sm text-gray-500">Grade {student.grade} - {student.section}</div>
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getCategoryBadge(student.category)}`}>
                          {getCategoryDisplay(student.category)}
                        </span>
                      </td>

                      {/* Team Assignment */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {studentTeam ? (
                          <div className="flex items-center">
                            <div className="flex-1">
                              <div className="text-sm font-medium text-green-800 flex items-center">
                                {studentTeam.name}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500 italic">Not assigned</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => handleViewStudent(student)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-md hover:bg-blue-50 transition-colors"
                            title="View Details"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleAssignTeam(student)}
                            className="text-green-600 hover:text-green-900 p-1 rounded-md hover:bg-green-50 transition-colors"
                            title={studentTeam ? 'Change Team' : 'Assign Team'}
                          >
                            <UserPlus className="h-4 w-4" />
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
          {students.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-16 w-16 text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No students found</h3>
              <p className="text-gray-500 mb-4">
                {searchTerm || selectedCategory || selectedGrade || selectedSection || selectedTeam
                  ? 'Try adjusting your filter criteria'
                  : 'Add students to get started'
                }
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                Add First Student
              </button>
            </div>
          )}
        </div>

        {/* Pagination */}
        {students.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing <span className="font-medium">{students.length}</span> of <span className="font-medium">{totalCount}</span> students
            </div>
            <Pagination
              currentPage={currentPage}
              totalPages={Math.ceil(totalCount / pageSize)}
              onPageChange={handlePageChange}
              pageSize={pageSize}
              onPageSizeChange={handlePageSizeChange}
              totalCount={totalCount}
            />
          </div>
        )}

        {/* Add Student Modal */}
        {showAddModal && (
          <AddStudentModal
            formData={formData}
            setFormData={setFormData}
            onClose={() => setShowAddModal(false)}
            onSubmit={handleAddStudent}
          />
        )}

        {/* Student Profile Modal */}
        {showViewModal && selectedStudent && (
          <StudentProfileModal
            student={selectedStudent}
            team={getStudentTeam(selectedStudent)}
            onClose={() => setShowViewModal(false)}
            onStudentDeleted={(id) => {
              fetchStudents();
              setShowViewModal(false);
            }}
          />
        )}

        {/* Team Assignment Modal */}
        {showTeamAssignModal && selectedStudent && (
          <TeamAssignmentModal
            student={selectedStudent}
            teams={teams}
            currentTeam={getStudentTeam(selectedStudent)}
            onClose={() => setShowTeamAssignModal(false)}
            onAssign={handleAssignToTeam}
          />
        )}

        {/* Bulk Upload Modal */}
        {showBulkUploadModal && (
          <StudentBulkUploadModal
            onClose={() => setShowBulkUploadModal(false)}
            onSuccess={() => {
              fetchStudents();
              setShowBulkUploadModal(false);
            }}
          />
        )}
      </div>
    </div>
  );
};

// Student Profile Modal Component
const StudentProfileModal = ({ student, team, onClose, onStudentDeleted }) => {
  const [participationHistory, setParticipationHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Load participation history when modal opens
  useEffect(() => {
    const fetchParticipationHistory = async () => {
      if (!student?.id) return;
      
      try {
        setLoadingHistory(true);
        // Import the API dynamically to avoid circular dependencies
        const { studentsAPI } = await import('../../services/api');
        const response = await studentsAPI.getStudentParticipationHistory(student.id);
        setParticipationHistory(response.data || []);
      } catch (error) {
        console.error('Error fetching participation history:', error);
        setParticipationHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchParticipationHistory();
  }, [student?.id]);

  // Calculate stats from participation history
  const stats = {
    totalPrograms: participationHistory.reduce((sum, eventData) => sum + eventData.programs.length, 0),
    totalPoints: participationHistory.reduce((sum, eventData) => 
      sum + eventData.programs.reduce((pSum, p) => pSum + (p.result?.points_earned || 0), 0), 0),
    totalAchievements: participationHistory.reduce((sum, eventData) => 
      sum + eventData.programs.filter(p => p.result?.position && p.result.position <= 3).length, 0),
    completedPrograms: participationHistory.reduce((sum, eventData) => 
      sum + eventData.programs.filter(p => p.result).length, 0)
  };

  // Helper functions
  const getCategoryBadge = (category) => {
    const badges = {
      'hs': { text: 'High School', class: 'bg-blue-100 text-blue-800 border-blue-200' },
      'hss': { text: 'HSS', class: 'bg-green-100 text-green-800 border-green-200' },
      'general': { text: 'General', class: 'bg-purple-100 text-purple-800 border-purple-200' }
    };
    
    const badge = badges[category] || { text: category?.toUpperCase(), class: 'bg-gray-100 text-gray-800 border-gray-200' };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${badge.class}`}>
        {badge.text}
      </span>
    );
  };

  const getPositionBadge = (position) => {
    if (!position) return null;
    
    const badges = {
      1: { text: '🥇 1st', class: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
      2: { text: '🥈 2nd', class: 'bg-gray-100 text-gray-800 border-gray-200' },
      3: { text: '🥉 3rd', class: 'bg-orange-100 text-orange-800 border-orange-200' }
    };
    
    const badge = badges[position] || { 
      text: `#${position}`, 
      class: 'bg-blue-100 text-blue-800 border-blue-200' 
    };
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${badge.class}`}>
        {badge.text}
      </span>
    );
  };

  const handleDeleteStudent = async () => {
    if (!student?.id) return;
    
    setDeleting(true);
    try {
      const { studentsAPI } = await import('../../services/api');
      await studentsAPI.deleteStudent(student.id);
      
      // Call the callback to refresh the students list
      if (onStudentDeleted) {
        onStudentDeleted(student.id);
      }
      
      onClose();
      alert('Student deleted successfully!');
    } catch (error) {
      console.error('Error deleting student:', error);
      alert('Error deleting student. Please try again.');
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-t-lg">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="h-16 w-16 bg-white bg-opacity-20 rounded-full flex items-center justify-center text-white font-bold text-xl">
                {student.name?.[0] || student.first_name?.[0] || 'S'}
              </div>
              <div>
                <h2 className="text-2xl font-bold">{student.get_full_name ? student.get_full_name() : `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.name || `Student ${student.student_id}` || 'Unknown Student'}</h2>
                <p className="text-blue-100">Student ID: {student.student_id}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="text-red-200 hover:text-red-100 hover:bg-red-500 hover:bg-opacity-20 p-2 rounded-md transition-colors"
                title="Delete Student"
              >
                <Trash2 className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                className="text-white hover:text-gray-200 text-2xl p-1"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{participationHistory.length}</div>
              <div className="text-sm text-blue-800">Events Participated</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{stats.totalPrograms}</div>
              <div className="text-sm text-green-800">Programs Participated</div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">{stats.totalPoints}</div>
              <div className="text-sm text-purple-800">Total Points</div>
            </div>
          </div>

          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <Mail className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium">{student.email || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <GraduationCap className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Grade & Section</p>
                  <p className="font-medium">Grade {student.grade} - {student.section}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <User className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Category</p>
                  <div className="mt-1">
                    {getCategoryBadge(student.category)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <MapPin className="h-5 w-5 text-gray-500" />
                <div>
                  <p className="text-sm text-gray-600">Address</p>
                  <p className="font-medium">{student.address || 'Not provided'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Team Information */}
          {team && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Information
              </h3>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-green-800">{team.name}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-green-600">Team Members</p>
                    <p className="font-semibold text-green-800">{team.members?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}



          {/* Events & Programs Participation */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Events & Programs Participation
            </h3>
            
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-500">Loading participants profile...</p>
              </div>
            ) : participationHistory.length > 0 ? (
              <div className="space-y-4">
                {participationHistory.map((eventData, index) => (
                  <div key={index} className="border border-gray-200 rounded-lg overflow-hidden">
                    {/* Event Header */}
                    <div className="bg-blue-50 px-4 py-3 border-b border-gray-200">
                      <h4 className="font-semibold text-gray-900 text-lg">{eventData.event.title}</h4>
                    </div>
                    
                    {/* Programs List */}
                    <div className="p-4">
                      <div className="space-y-3">
                        {eventData.programs.map((program, programIndex) => (
                          <div key={programIndex} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                            <div className="flex-1">
                              <h5 className="font-medium text-gray-900">{program.name}</h5>
                              <p className="text-sm text-gray-600">
                                {program.category} • {program.venue || 'No venue'}
                              </p>
                              {program.chest_number && (
                                <p className="text-xs text-blue-600">Chest #: {program.chest_number}</p>
                              )}
                            </div>
                            
                            {/* Results Section */}
                            <div className="text-right">
                              {program.result ? (
                                <div className="flex items-center gap-2">
                                  {getPositionBadge(program.result.position)}
                                  <span className="text-sm font-medium text-green-600">
                                    {program.result.points_earned || 0} pts
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  Assigned
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <Trophy className="h-12 w-12 text-gray-300 mx-auto mb-2" />
                <p className="text-lg font-medium">No Events Participated</p>
                <p className="text-sm">This student hasn't participated in any events yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">Delete Student</h3>
                  <p className="text-sm text-gray-600">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-gray-700">
                  Are you sure you want to delete <strong>{student.get_full_name ? student.get_full_name() : `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.name || `Student ${student.student_id}` || 'Unknown Student'}</strong>?
                </p>
                <p className="text-sm text-gray-500 mt-2">
                  This will permanently remove the student and all associated data including:
                </p>
                <ul className="text-sm text-gray-500 mt-1 ml-4 list-disc">
                  <li>Program assignments and results</li>
                  <li>Team membership</li>
                  <li>Points history</li>
                </ul>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteStudent}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {deleting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4" />
                      Delete Student
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Team Assignment Modal Component
const TeamAssignmentModal = ({ student, teams, currentTeam, onClose, onAssign }) => {
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAssign = async () => {
    if (!selectedTeamId) return;
    
    setLoading(true);
    try {
      await onAssign(student.id, selectedTeamId);
    } catch (error) {
      console.error('Error assigning team:', error);
    } finally {
      setLoading(false);
    }
  };

  const availableTeams = teams.filter(team => 
    !currentTeam || team.id !== currentTeam.id
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Assign Team</h2>
              <p className="text-gray-600 mt-1">{student.get_full_name ? student.get_full_name() : `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.name || `Student ${student.student_id}` || 'Unknown Student'}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Current Team */}
          {currentTeam && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Current Team</label>
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-green-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                    {currentTeam.name?.[0]}
                  </div>
                  <div>
                    <h4 className="font-semibold text-green-800">{currentTeam.name}</h4>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {currentTeam ? 'Change to Team' : 'Select Team'}
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose a team...</option>
              {availableTeams.map(team => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>

          {/* Remove from team option */}
          {currentTeam && (
            <div className="pt-2 border-t border-gray-200">
              <button
                onClick={() => {
                  setSelectedTeamId('remove');
                }}
                className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                Remove from current team
              </button>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-gray-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedTeamId || loading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Assigning...' : (currentTeam ? 'Change Team' : 'Assign Team')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Add Student Modal Component
const AddStudentModal = ({ formData, setFormData, onClose, onSubmit }) => {
  // Get available grades based on category
  const getAvailableGrades = () => {
    if (formData.category === 'hs') {
      return [
        { value: '8', label: 'Grade 8' },
        { value: '9', label: 'Grade 9' },
        { value: '10', label: 'Grade 10' }
      ];
    } else if (formData.category === 'hss') {
      return [
        { value: 'plus_one_science', label: 'Plus One Science' },
        { value: 'plus_one_commerce', label: 'Plus One Commerce' },
        { value: 'plus_two_science', label: 'Plus Two Science' },
        { value: 'plus_two_commerce', label: 'Plus Two Commerce' }
      ];
    }
    return [];
  };

  // Handle category change
  const handleCategoryChange = (category) => {
    setFormData({
      ...formData, 
      category,
      grade: '' // Reset grade when category changes
    });
  };

  // Handle grade change
  const handleGradeChange = (grade) => {
    setFormData({
      ...formData,
      grade
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Add New Student</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ×
          </button>
        </div>
        
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="Enter full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Category *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Category</option>
              <option value="hs">High School</option>
              <option value="hss">Higher Secondary</option>
              <option value="general">General</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Grade *
            </label>
            <select
              required
              value={formData.grade}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select Grade</option>
              {getAvailableGrades().map(grade => (
                <option key={grade.value} value={grade.value}>{grade.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Section
            </label>
            <input
              type="text"
              value={formData.section}
              onChange={(e) => setFormData({...formData, section: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., A, B, Science, Commerce"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              rows="2"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Student
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Student Bulk Upload Modal Component
const StudentBulkUploadModal = ({ onClose, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const handleFileUpload = async (e) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const response = await studentsAPI.bulkUpload(formData);
      
      // Show detailed success message
      const data = response.data;
      let message = `Successfully uploaded ${data.summary.successful_creations} students!`;
      
      if (data.team_assignments && data.team_assignments.length > 0) {
        const successfulAssignments = data.team_assignments.filter(a => a.success).length;
        message += `\n\nTeam Assignments: ${successfulAssignments} successful`;
        
        // Show team assignment details
        const assignmentDetails = data.team_assignments.map(a => 
          `• ${a.student} → ${a.team} (${a.action.replace(/_/g, ' ')})`
        ).join('\n');
        
        message += `\n\nDetails:\n${assignmentDetails}`;
      }
      
      if (data.skipped && data.skipped.length > 0) {
        message += `\n\nSkipped: ${data.skipped.length} students`;
      }
      
      onSuccess();
      alert(message);
    } catch (error) {
      console.error('Error uploading students:', error);
      let errorMessage = 'Error uploading students.';
      
      if (error.response?.data?.details) {
        errorMessage += '\n\nDetails:\n' + error.response.data.details.join('\n');
      }
      
      if (error.response?.data?.suggestions) {
        errorMessage += '\n\nSuggestions:\n' + error.response.data.suggestions.join('\n');
      }
      
      alert(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const response = await studentsAPI.downloadTemplate();
      
      // Create blob and download
      const blob = new Blob([response.data], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'student_bulk_upload_template.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading template:', error);
      alert('Error downloading template. Please try again.');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-800">📚 Bulk Upload Students</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Instructions Section */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h4 className="font-semibold text-blue-800 mb-2">📋 Instructions</h4>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Download the Excel template below to get started</li>
            <li>• Fill in only: Name (full name), Category (hs/hss), Class, and Team (optional)</li>
            <li>• Student ID, email, and password will be auto-generated</li>
            <li>• Use proper class names: For HS use "8", "9", or "10", For HSS use "Plus One Science", etc.</li>
            <li>• Students will be automatically assigned to teams if team name is provided</li>
            <li>• Upload the completed Excel file using the form below</li>
          </ul>
        </div>

        {/* Template Download Section */}
        <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <h4 className="font-semibold text-green-800 mb-3">📥 Download Template</h4>
          <p className="text-sm text-green-700 mb-3">
            Get the Excel template with sample data, team assignments, and detailed instructions.
          </p>
          <button
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {downloadingTemplate ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Downloading...
              </>
            ) : (
              <>
                📄 Download Excel Template
              </>
            )}
          </button>
        </div>

        {/* Template Information */}
        <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
          <h4 className="font-semibold text-yellow-800 mb-2">📊 Template Information</h4>
          <div className="text-sm text-yellow-700 space-y-2">
            <p><strong>Required Fields:</strong> name, category, class</p>
            <p><strong>Optional Fields:</strong> team_name</p>
            <p><strong>Categories:</strong> hs (High School), hss (Higher Secondary)</p>
            <p><strong>Classes:</strong></p>
            <ul className="ml-4 space-y-1">
              <li>• <strong>HS:</strong> 8, 9, 10</li>
              <li>• <strong>HSS:</strong> Plus One Science, Plus One Commerce, Plus Two Science, Plus Two Commerce</li>
            </ul>
            <p><strong>Sample Teams:</strong> Phoenix Risers, Thunder Bolts, Ocean Waves</p>
            <p><strong>Auto-Generated:</strong> student_id, email, password (all auto-created)</p>
          </div>
        </div>
        
        {/* File Upload Form */}
        <form onSubmit={handleFileUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              📁 Select Excel File (.xlsx)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Supported formats: Excel (.xlsx, .xls). Template includes: Name, Category, Class, Team
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Uploading...
                </>
              ) : (
                <>
                  📤 Upload Students
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentsPage; 