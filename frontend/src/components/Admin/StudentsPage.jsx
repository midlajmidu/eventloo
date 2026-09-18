import React, { useState, useEffect } from 'react';
import { studentsAPI, teamsAPI, categoriesAPI, classesAPI } from '../../services/api';
import Pagination from '../common/Pagination';
import { 
  Users, 
  Plus, 
  Search, 
  Eye, 
  UserPlus,
  GraduationCap,
  Mail,
  MapPin,
  User,
  Trophy,
  Upload,
  Trash2,
  X
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
  const [selectedGender, setSelectedGender] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showTeamAssignModal, setShowTeamAssignModal] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    category: '',
    grade: '',
    section: '',
    address: ''
  });

  const [categories, setCategories] = useState([]);
  const [classes, setClasses] = useState([]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // Add state for stream filter


  useEffect(() => {
    fetchTeams();
    fetchCategories();
    fetchClasses();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data.results || res.data);
    } catch (err) {
      console.error('Failed to fetch categories:', err);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await classesAPI.list();
      setClasses(res.data.results || res.data);
    } catch (err) {
      console.error('Failed to fetch classes:', err);
    }
  };

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
        gender: selectedGender,
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
      fetchStudents();
    }, 300);
    return () => clearTimeout(debounceTimer);
  }, [currentPage, pageSize, searchTerm, selectedCategory, selectedGrade, selectedSection, selectedGender, selectedTeam]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddStudent = async (e) => {
    e.preventDefault();
    try {
      // Prepare the data for submission
      const studentData = {
        name: formData.name,
        gender: formData.gender,
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
      gender: '',
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

  const getCategoryBadge = () => 'bg-indigo-50 text-indigo-700 border-indigo-100';

  const getCategoryDisplay = (category) => {
    const displays = {
      'hs': 'High School',
      'hss': 'Higher Secondary',
      'general': 'General'
    };
    return categories.find(item => item.code === category)?.name || displays[category] || category;
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
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Directory</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Students</h1>
            <p className="mt-1 text-sm text-slate-500">Manage profiles, classes and team membership.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowBulkUploadModal(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-indigo-200 hover:text-indigo-700">
              <Upload className="h-4 w-4" /> Bulk upload
            </button>
            <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700">
              <Plus className="h-4 w-4" /> Add student
            </button>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(230px,2fr)_repeat(5,minmax(115px,1fr))_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="search" aria-label="Search students" placeholder="Search name, ID or email" value={searchTerm} onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100" />
            </div>
            <select aria-label="Category" value={selectedCategory} onChange={(e) => { setSelectedCategory(e.target.value); setSelectedGrade(''); setCurrentPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100">
              <option value="">All categories</option>
              {categories.filter(c => !c.is_mixing).map(cat => <option key={cat.code} value={cat.code}>{cat.name}</option>)}
            </select>
            <select aria-label="Grade" value={selectedGrade} onChange={(e) => { setSelectedGrade(e.target.value); setCurrentPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100">
              <option value="">All grades</option>
              {classes.filter(cls => {
                const category = categories.find(item => item.id === cls.category);
                if (!category || category.is_mixing) return false;
                return !selectedCategory || categories.find(item => item.code === selectedCategory)?.class_ids?.includes(cls.id);
              }).map(cls => <option key={cls.code} value={cls.code}>{cls.name}</option>)}
            </select>
            <select aria-label="Section" value={selectedSection} onChange={(e) => { setSelectedSection(e.target.value); setCurrentPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100">
              <option value="">All sections</option>
              {sections.map(section => <option key={section} value={section}>{section}</option>)}
            </select>
            <select aria-label="Gender" value={selectedGender} onChange={(e) => { setSelectedGender(e.target.value); setCurrentPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100">
              <option value="">All genders</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
            <select aria-label="Team" value={selectedTeam} onChange={(e) => { setSelectedTeam(e.target.value); setCurrentPage(1); }} className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100">
              <option value="">All teams</option><option value="unassigned">Unassigned</option>
              {teams.map(team => <option key={team.id} value={team.id}>{team.name}</option>)}
            </select>
            <button onClick={() => { setSearchTerm(''); setSelectedCategory(''); setSelectedGrade(''); setSelectedSection(''); setSelectedGender(''); setSelectedTeam(''); }} className="h-10 rounded-xl px-3 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700">Clear</button>
          </div>
        </section>

        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <p className="text-sm font-semibold text-slate-900">Student directory</p>
            <p className="text-xs text-slate-400">{totalCount} students</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  {['Student', 'Student ID', 'Gender', 'Class', 'Category', 'Team'].map(label => <th key={label} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</th>)}
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {students.map((student) => {
                  const studentTeam = getStudentTeam(student);
                  const studentName = student.get_full_name ? student.get_full_name() : `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.name || `Student ${student.student_id}`;
                  return (
                    <tr key={student.id} className="transition hover:bg-indigo-50/30">
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-600">{studentName?.charAt(0)?.toUpperCase() || 'S'}</div>
                          <div className="min-w-0"><p className="max-w-[240px] truncate text-sm font-semibold text-slate-900">{studentName}</p><p className="max-w-[240px] truncate text-xs text-slate-400">{student.email || 'No email'}</p></div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-slate-600">{student.student_id}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm capitalize text-slate-600">{student.gender || '—'}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600">{student.grade || '—'}{student.section ? ` · ${student.section}` : ''}</td>
                      <td className="whitespace-nowrap px-5 py-3.5"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getCategoryBadge(student.category)}`}>{getCategoryDisplay(student.category)}</span></td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm font-medium text-slate-600">{studentTeam?.name || <span className="font-normal text-slate-400">Unassigned</span>}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleViewStudent(student)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-100" title="View student details"><Eye className="h-3.5 w-3.5" /> View</button>
                          <button onClick={() => handleAssignTeam(student)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700" title={studentTeam ? 'Change team' : 'Assign team'}><UserPlus className="h-4 w-4" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {students.length === 0 && (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100"><Users className="h-5 w-5 text-slate-400" /></div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">No students found</h3>
              <p className="mt-1 text-sm text-slate-400">Try changing the filters or add a new student.</p>
            </div>
          )}
          {students.length > 0 && <div className="border-t border-slate-100 px-5 py-3"><Pagination currentPage={currentPage} totalPages={Math.ceil(totalCount / pageSize)} onPageChange={handlePageChange} pageSize={pageSize} onPageSizeChange={handlePageSizeChange} totalCount={totalCount} className="text-slate-500" /></div>}
        </section>

        {/* Add Student Modal */}
        {showAddModal && (
          <AddStudentModal
            formData={formData}
            setFormData={setFormData}
            onClose={() => setShowAddModal(false)}
            onSubmit={handleAddStudent}
            categories={categories}
            classes={classes}
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
            categories={categories}
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
            categories={categories}
            classes={classes}
          />
        )}
      </div>
    </main>
  );
};

// Student Profile Modal Component
const StudentProfileModal = ({ student, team, onClose, onStudentDeleted, categories }) => {
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
    const cat = categories.find(c => c.code === category);
    const text = cat ? cat.name : (category?.toUpperCase() || 'N/A');
    
    let colorClass = 'bg-slate-100 text-slate-800 border-slate-200';
    if (category === 'hs') {
      colorClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    } else if (category === 'hss') {
      colorClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    } else if (category === 'general') {
      colorClass = 'bg-violet-100 text-violet-800 border-violet-200';
    } else if (cat && cat.is_mixing) {
      colorClass = 'bg-violet-100 text-violet-800 border-violet-200';
    } else {
      colorClass = 'bg-indigo-100 text-indigo-800 border-indigo-200';
    }
    
    return (
      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${colorClass}`}>
        {text}
      </span>
    );
  };

  const getPositionBadge = (position) => {
    if (!position) return null;
    
    const badges = {
      1: { text: '1st Place', class: 'bg-yellow-50 text-yellow-800 border-yellow-200' },
      2: { text: '2nd Place', class: 'bg-slate-50 text-slate-800 border-slate-200' },
      3: { text: '3rd Place', class: 'bg-orange-50 text-orange-800 border-orange-200' }
    };
    
    const badge = badges[position] || { 
      text: `#${position}`, 
      class: 'bg-indigo-100 text-indigo-800 border-indigo-200' 
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
    <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-slate-100 bg-white/95 p-5 backdrop-blur">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-50 text-lg font-bold text-indigo-700">
                {student.name?.[0] || student.first_name?.[0] || 'S'}
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">{student.get_full_name ? student.get_full_name() : `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.name || `Student ${student.student_id}` || 'Unknown Student'}</h2>
                <p className="mt-0.5 font-mono text-xs text-slate-400">{student.student_id}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                title="Delete Student"
              >
                <Trash2 className="h-5 w-5" />
              </button>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close student profile"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">{participationHistory.length}</div>
              <div className="text-sm text-indigo-800">Events Participated</div>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <div className="text-2xl font-bold text-indigo-600">{stats.totalPrograms}</div>
              <div className="text-sm text-indigo-800">Programs Participated</div>
            </div>
            <div className="text-center p-4 bg-violet-50 rounded-lg">
              <div className="text-2xl font-bold text-violet-600">{stats.totalPoints}</div>
              <div className="text-sm text-violet-800">Total Points</div>
            </div>
          </div>

          {/* Personal Information */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <User className="h-5 w-5" />
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Mail className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-600">Email</p>
                  <p className="font-medium">{student.email || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <GraduationCap className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-600">Grade & Section</p>
                  <p className="font-medium">Grade {student.grade} - {student.section}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <User className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-600">Category</p>
                  <div className="mt-1">
                    {getCategoryBadge(student.category)}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <User className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-600">Gender</p>
                  <p className="font-medium capitalize">{student.gender || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <MapPin className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-600">Address</p>
                  <p className="font-medium">{student.address || 'Not provided'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Team Information */}
          {team && (
            <div>
              <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Information
              </h3>
              <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-indigo-800">{team.name}</h4>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-indigo-600">Team Members</p>
                    <p className="font-semibold text-indigo-800">{team.members?.length || 0}</p>
                  </div>
                </div>
              </div>
            </div>
          )}



          {/* Events & Programs Participation */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Events & Programs Participation
            </h3>
            
            {loadingHistory ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                <p className="text-slate-500">Loading participants profile...</p>
              </div>
            ) : participationHistory.length > 0 ? (
              <div className="space-y-4">
                {participationHistory.map((eventData, index) => (
                  <div key={index} className="border border-slate-200 rounded-lg overflow-hidden">
                    {/* Event Header */}
                    <div className="bg-indigo-50 px-4 py-3 border-b border-slate-200">
                      <h4 className="font-semibold text-slate-900 text-lg">{eventData.event.title}</h4>
                    </div>
                    
                    {/* Programs List */}
                    <div className="p-4">
                      <div className="space-y-3">
                        {eventData.programs.map((program, programIndex) => (
                          <div key={programIndex} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                            <div className="flex-1">
                              <h5 className="font-medium text-slate-900">{program.name}</h5>
                              <p className="text-sm text-slate-600">
                                {program.category} • {program.venue || 'No venue'}
                              </p>
                              {program.chest_number && (
                                <p className="text-xs text-indigo-600">Chest #: {program.chest_number}</p>
                              )}
                            </div>
                            
                            {/* Results Section */}
                            <div className="text-right">
                              {program.result ? (
                                <div className="flex items-center gap-2">
                                  {getPositionBadge(program.result.position)}
                                  <span className="text-sm font-medium text-indigo-600">
                                    {program.result.points_earned || 0} pts
                                  </span>
                                </div>
                              ) : (
                                <span className="text-sm text-slate-500 bg-slate-100 px-2 py-1 rounded">
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
              <div className="text-center py-8 text-slate-500">
                <Trophy className="h-12 w-12 text-slate-300 mx-auto mb-2" />
                <p className="text-lg font-medium">No Events Participated</p>
                <p className="text-sm">This student hasn't participated in any events yet.</p>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Delete Student</h3>
                  <p className="text-sm text-slate-600">This action cannot be undone</p>
                </div>
              </div>
              
              <div className="mb-6">
                <p className="text-slate-700">
                  Are you sure you want to delete <strong>{student.get_full_name ? student.get_full_name() : `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.name || `Student ${student.student_id}` || 'Unknown Student'}</strong>?
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  This will permanently remove the student and all associated data including:
                </p>
                <ul className="text-sm text-slate-500 mt-1 ml-4 list-disc">
                  <li>Program assignments and results</li>
                  <li>Team membership</li>
                  <li>Points history</li>
                </ul>
              </div>
              
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-4 py-2 text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
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
    <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="p-6 border-b border-slate-200">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">Assign Team</h2>
              <p className="text-slate-600 mt-1">{student.get_full_name ? student.get_full_name() : `${student.first_name || ''} ${student.last_name || ''}`.trim() || student.name || `Student ${student.student_id}` || 'Unknown Student'}</p>
            </div>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close team assignment"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-4">
          {/* Current Team */}
          {currentTeam && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Current Team</label>
              <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-indigo-600 rounded-full flex items-center justify-center text-white font-medium text-sm">
                    {currentTeam.name?.[0]}
                  </div>
                  <div>
                    <h4 className="font-semibold text-indigo-800">{currentTeam.name}</h4>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Team Selection */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              {currentTeam ? 'Change to Team' : 'Select Team'}
            </label>
            <select
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
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
            <div className="pt-2 border-t border-slate-200">
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

        <div className="p-6 border-t border-slate-200 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={!selectedTeamId || loading}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {loading ? 'Assigning...' : (currentTeam ? 'Change Team' : 'Assign Team')}
          </button>
        </div>
      </div>
    </div>
  );
};

// Add Student Modal Component
const AddStudentModal = ({ formData, setFormData, onClose, onSubmit, categories, classes }) => {
  // Get available grades based on category
  const getAvailableGrades = () => {
    if (!formData.category) return [];
    const cat = categories.find(c => c.code === formData.category);
    if (!cat) return [];
    return classes
      .filter(cls => cat.class_ids?.includes(cls.id) && cls.is_active)
      .map(cls => ({ value: cls.code, label: cls.name }));
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
    <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Add New Student</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close add student"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Full Name *
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
              placeholder="Enter full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Category *
            </label>
            <select
              required
              value={formData.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
            >
              <option value="">Select Category</option>
              {categories.filter(c => c.is_active && !c.is_mixing).map(cat => (
                <option key={cat.code} value={cat.code}>{cat.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Gender *</label>
            <select required value={formData.gender} onChange={(e) => setFormData({...formData, gender: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none">
              <option value="">Select Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Grade *
            </label>
            <select
              required
              value={formData.grade}
              onChange={(e) => handleGradeChange(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
            >
              <option value="">Select Grade</option>
              {getAvailableGrades().map(grade => (
                <option key={grade.value} value={grade.value}>{grade.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Section
            </label>
            <input
              type="text"
              value={formData.section}
              onChange={(e) => setFormData({...formData, section: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
              placeholder="e.g., A, B, Science, Commerce"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Address
            </label>
            <textarea
              value={formData.address}
              onChange={(e) => setFormData({...formData, address: e.target.value})}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none"
              rows="2"
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
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
          `• ${a.student} → ${a.team_name || a.team} (${a.action.replace(/_/g, ' ')})`
        ).join('\n');
        
        message += `\n\nDetails:\n${assignmentDetails}`;
      }
      
      if (data.skipped && data.skipped.length > 0) {
        message += `\n\nSkipped: ${data.skipped.length} students`;
      }

      if (data.corrections && data.corrections.length > 0) {
        message += `\n\nMatched spelling differences:\n${data.corrections.map(item => `• ${item}`).join('\n')}`;
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
    <div className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div><p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600">Import</p><h3 className="mt-1 text-xl font-semibold text-slate-950">Bulk upload students</h3></div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close bulk upload"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Template Download Section */}
        <div className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-indigo-100 bg-indigo-50/70 p-4">
          <div>
            <h4 className="font-semibold text-slate-900">Excel template</h4>
            <p className="mt-1 text-xs text-slate-500">Prepared with your school data.</p>
          </div>
          <button
            onClick={handleDownloadTemplate}
            disabled={downloadingTemplate}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {downloadingTemplate ? (
              <>
                <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                Downloading...
              </>
            ) : (
              <>
                Download Excel Template
              </>
            )}
          </button>
        </div>
        
        {/* File Upload Form */}
        <form onSubmit={handleFileUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Select Excel file (.xlsx)
            </label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
              required
            />
            <p className="text-xs text-slate-500 mt-1">
              Supported formats: Excel (.xlsx, .xls). Recommended: use the downloaded .xlsx template.
            </p>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-700 bg-slate-200 rounded-lg hover:bg-slate-300 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {uploading ? (
                <>
                  <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full"></div>
                  Uploading...
                </>
              ) : (
                <>
                  Upload students
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
