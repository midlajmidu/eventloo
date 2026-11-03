import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
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
  X, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Check, 
  Phone, 
  Calendar, 
  ShieldCheck, 
  Sparkles,
  Filter,
  Copy,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  FileText,
  RefreshCw,
  ArrowRight
} from 'lucide-react';

const StudentsPage = () => {
  const location = useLocation();
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

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'create' || params.get('create') === 'true') {
      setShowAddModal(true);
    } else if (params.get('action') === 'upload' || params.get('upload') === 'true') {
      setShowBulkUploadModal(true);
    }
  }, [location.search]);
  const [formData, setFormData] = useState({
    name: '',
    gender: '',
    category: '',
    grade: '',
    section: '',
    team_id: '',
    email: '',
    phone_number: '',
    date_of_birth: '',
    address: '',
    guardian_name: '',
    guardian_phone: '',
  });
  const [submittingStudent, setSubmittingStudent] = useState(false);
  const [formError, setFormError] = useState(null);

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
    setSubmittingStudent(true);
    setFormError(null);
    try {
      // Prepare the data for submission with all model fields
      const studentData = {
        name: formData.name.trim(),
        gender: formData.gender,
        category: formData.category,
        grade: formData.grade,
        section: formData.section?.trim() || undefined,
        team_id: formData.team_id ? Number(formData.team_id) : undefined,
        email: formData.email?.trim() || undefined,
        phone_number: formData.phone_number?.trim() || undefined,
        date_of_birth: formData.date_of_birth || undefined,
        address: formData.address?.trim() || undefined,
        guardian_name: formData.guardian_name?.trim() || undefined,
        guardian_phone: formData.guardian_phone?.trim() || undefined,
      };

      const response = await studentsAPI.createStudent(studentData);
      const createdStudent = response?.data;

      // Safeguard: ensure team membership is confirmed if selected
      if (formData.team_id && createdStudent?.id) {
        try {
          await studentsAPI.assignToTeam(createdStudent.id, { team_id: formData.team_id });
        } catch (teamAssignErr) {
          console.warn('Post-creation team assign check:', teamAssignErr);
        }
      }
      
      setShowAddModal(false);
      resetForm();
      fetchStudents();
    } catch (error) {
      console.error('Error adding student:', error);
      let errorMessage = 'Failed to create student. Please verify the information entered.';
      if (error.response?.data) {
        const data = error.response.data;
        if (typeof data === 'string') {
          errorMessage = data;
        } else if (data.error) {
          errorMessage = data.error;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (typeof data === 'object') {
          errorMessage = Object.entries(data)
            .map(([field, errors]) => `${field.replace(/_/g, ' ')}: ${Array.isArray(errors) ? errors.join(', ') : errors}`)
            .join(' | ');
        }
      } else if (error.message) {
        errorMessage = `Network error: ${error.message}`;
      }
      setFormError(errorMessage);
    } finally {
      setSubmittingStudent(false);
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
      team_id: '',
      email: '',
      phone_number: '',
      date_of_birth: '',
      address: '',
      guardian_name: '',
      guardian_phone: '',
    });
    setFormError(null);
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
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Directory</p>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Students</h1>
            <p className="text-xs text-slate-400 mt-1 font-normal">Manage profiles, classes and team membership.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setShowBulkUploadModal(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-2xs transition hover:border-indigo-200 hover:text-indigo-700">
              <Upload className="h-3.5 w-3.5 text-slate-400" /> Bulk upload
            </button>
            <button onClick={() => setShowAddModal(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-indigo-700">
              <Plus className="h-3.5 w-3.5" /> Add student
            </button>
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[minmax(230px,2fr)_repeat(5,minmax(115px,1fr))_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Search students"
                placeholder="Search name, ID or class"
                value={searchTerm}
                onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
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
                          <div className="min-w-0">
                            <p className="max-w-[240px] truncate text-sm font-semibold text-slate-900">{studentName}</p>
                            {student.email ? (
                              <p className="max-w-[240px] truncate text-xs text-slate-400">{student.email}</p>
                            ) : null}
                          </div>
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

        {/* Add Student Slide-Over Drawer */}
        {showAddModal && (
          <AddStudentDrawer
            formData={formData}
            setFormData={setFormData}
            onClose={() => {
              setShowAddModal(false);
              setFormError(null);
            }}
            onSubmit={handleAddStudent}
            categories={categories}
            classes={classes}
            teams={teams}
            loading={submittingStudent}
            error={formError}
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
            }}
            categories={categories}
            classes={classes}
            teams={teams}
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
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Phone className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-600">Phone</p>
                  <p className="font-medium">{student.phone_number || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
                <Calendar className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-600">Date of Birth</p>
                  <p className="font-medium">{student.date_of_birth || 'Not provided'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg md:col-span-2">
                <ShieldCheck className="h-5 w-5 text-slate-500" />
                <div>
                  <p className="text-sm text-slate-600">Guardian Details</p>
                  <p className="font-medium">
                    {student.guardian_name ? (
                      <>
                        {student.guardian_name}
                        {student.guardian_phone && <span className="text-slate-500 font-normal"> ({student.guardian_phone})</span>}
                      </>
                    ) : (
                      'Not provided'
                    )}
                  </p>
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

// Add Student Slide-Over Drawer Component (Opens from the right side)
const AddStudentDrawer = ({
  formData,
  setFormData,
  onClose,
  onSubmit,
  categories,
  classes,
  teams = [],
  loading = false,
  error = null
}) => {
  // Listen for Escape key to close
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, []);

  // Get available grades based on category
  const getAvailableGrades = () => {
    if (!formData.category) {
      return classes.filter(cls => cls.is_active).map(cls => ({ value: cls.code, label: cls.name }));
    }
    const cat = categories.find(c => c.code === formData.category);
    if (!cat) return [];
    return classes
      .filter(cls => cat.class_ids?.includes(cls.id) && cls.is_active)
      .map(cls => ({ value: cls.code, label: cls.name }));
  };

  // Handle category change
  const handleCategoryChange = (category) => {
    setFormData((prev) => ({
      ...prev,
      category,
      grade: '' // Reset grade when category changes
    }));
  };

  // Handle grade change and auto-fill category if unselected
  const handleGradeChange = (grade) => {
    let newCategory = formData.category;
    if (!newCategory && grade) {
      const clsObj = classes.find(c => c.code === grade);
      if (clsObj) {
        const matchingCat = categories.find(cat => cat.class_ids?.includes(clsObj.id));
        if (matchingCat) newCategory = matchingCat.code;
      }
    }
    setFormData((prev) => ({
      ...prev,
      grade,
      category: newCategory
    }));
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-over Container */}
      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 md:pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
          
          {/* Header */}
          <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Add New Student</h3>
                <p className="text-xs text-slate-500">
                  Fill in academic details and optional student profile info.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close drawer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Inline Error Banner */}
          {error && (
            <div className="mx-6 mt-4 flex items-start gap-2.5 rounded-xl border border-rose-200 bg-rose-50/90 p-3.5 text-xs text-rose-800 shrink-0">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold text-rose-900">Please review the form</p>
                <p className="mt-0.5 text-rose-700 break-words">{error}</p>
              </div>
            </div>
          )}

          {/* Form Area */}
          <form id="add-student-drawer-form" onSubmit={onSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
            
            {/* Section 1: Basic Information */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-3.5">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Basic Information</h4>
                <span className="text-[11px] font-medium text-rose-500">* Required</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                  placeholder="e.g. Rahul Sharma"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <select
                  required
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition text-slate-800"
                >
                  <option value="">Select Gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Section 2: Academic & Team Assignment */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-3.5">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-4 w-4 text-indigo-600" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Academic & Team Assignment</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.category}
                    onChange={(e) => handleCategoryChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition text-slate-800"
                  >
                    <option value="">Select Category</option>
                    {categories.filter(c => c.is_active && !c.is_mixing).map(cat => (
                      <option key={cat.code} value={cat.code}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Class / Grade <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.grade}
                    onChange={(e) => handleGradeChange(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition text-slate-800"
                  >
                    <option value="">Select Class</option>
                    {getAvailableGrades().map(grade => (
                      <option key={grade.value} value={grade.value}>{grade.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Section <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                    placeholder="e.g. A, B, Science"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Assign Team <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <select
                    value={formData.team_id || ''}
                    onChange={(e) => setFormData({ ...formData, team_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition text-slate-800"
                  >
                    <option value="">No Team Assigned (Unassigned)</option>
                    {teams && teams.map(team => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Section 3: Contact Details (All Optional) */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Contact Details</h4>
                </div>
                <span className="text-[11px] font-medium text-slate-400">All Optional</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Email Address <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                    placeholder="e.g. student@school.edu"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Optional. Students do not require an email to participate.</p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Phone Number <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    maxLength={15}
                    value={formData.phone_number}
                    onChange={(e) => setFormData({ ...formData, phone_number: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                    placeholder="e.g. +91 9876543210"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">Max 15 digits.</p>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Residential Address <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                  placeholder="Enter home address..."
                />
              </div>
            </div>

            {/* Section 4: Personal & Guardian Details (All Optional) */}
            <div className="rounded-xl border border-slate-200/90 bg-slate-50/50 p-4 space-y-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-indigo-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Guardian & Personal Details</h4>
                </div>
                <span className="text-[11px] font-medium text-slate-400">All Optional</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Date of Birth <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={formData.date_of_birth}
                  onChange={(e) => setFormData({ ...formData, date_of_birth: e.target.value })}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Guardian Name <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={formData.guardian_name}
                    onChange={(e) => setFormData({ ...formData, guardian_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                    placeholder="e.g. Suresh Sharma"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Guardian Phone <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="tel"
                    maxLength={15}
                    value={formData.guardian_phone}
                    onChange={(e) => setFormData({ ...formData, guardian_phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300 outline-none transition"
                    placeholder="e.g. +91 9876543210"
                  />
                </div>
              </div>
            </div>

            {/* Section 5: Automated System Generation Card */}
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <div className="flex items-start gap-2.5">
                <Sparkles className="h-4 w-4 text-indigo-600 mt-0.5 shrink-0" />
                <div className="text-xs text-indigo-900 leading-relaxed">
                  <p className="font-semibold text-indigo-950">Automated System Setup</p>
                  <p className="mt-0.5 text-indigo-800/90">
                    A unique Student ID will be generated automatically upon saving (e.g. <span className="font-mono font-medium">STU2026...</span>). Total points start at 0. No dummy emails, passwords, or usernames are created for students.
                  </p>
                </div>
              </div>
            </div>

          </form>

          {/* Sticky Drawer Footer */}
          <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="add-student-drawer-form"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Adding Student...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Student</span>
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

// Backwards-compatibility alias
const AddStudentModal = AddStudentDrawer;

// Normalizes backend errors into structured error objects for the Issue Resolution Center
const normalizeImportErrors = (errorData) => {
  if (Array.isArray(errorData?.structured_errors) && errorData.structured_errors.length > 0) {
    return errorData.structured_errors;
  }

  const rawDetails = Array.isArray(errorData?.details) ? errorData.details : [];
  if (rawDetails.length === 0 && (errorData?.error || errorData?.message)) {
    return [{
      row: '—',
      student_name: '—',
      field: 'other',
      field_label: 'Upload Error',
      value: '',
      issue: 'Import Blocked',
      reason: errorData.message || errorData.error,
      suggestion: Array.isArray(errorData?.suggestions) && errorData.suggestions.length > 0
        ? errorData.suggestions.join('; ')
        : 'Please verify the file format and required fields, then re-upload.'
    }];
  }

  return rawDetails.map((detail, idx) => {
    const str = String(detail || '').trim();
    const rowMatch = str.match(/^Row\s+(\d+):\s*(.*)/i);
    const row = rowMatch ? parseInt(rowMatch[1], 10) : idx + 2;
    const rest = rowMatch ? rowMatch[2] : str;

    let field = 'other';
    let field_label = 'Other';
    let student_name = '—';
    let value = '';
    let issue = 'Validation Issue';
    let reason = rest;
    let suggestion = 'Check this row in your spreadsheet and correct the value.';

    if (/team/i.test(rest)) {
      field = 'team';
      field_label = 'Team Name';
      const teamMatch = rest.match(/team\s*["']([^"']+)["']/i);
      value = teamMatch ? teamMatch[1] : '';
      issue = value ? `Team "${value}" Not Found` : 'Team Name Issue';
      suggestion = 'Enter an existing team name from your school setup or leave blank.';
    } else if (/class|grade/i.test(rest)) {
      field = 'class';
      field_label = 'Class / Grade';
      const classMatch = rest.match(/class\s*["']([^"']+)["']/i);
      value = classMatch ? classMatch[1] : '';
      issue = value ? `Invalid Class "${value}"` : 'Class / Grade Issue';
      suggestion = 'Enter an existing active class name or code.';
    } else if (/name/i.test(rest) && !/guardian/i.test(rest)) {
      field = 'name';
      field_label = 'Student Name';
      issue = 'Missing Student Name';
      suggestion = 'Provide the student full name for this row.';
    } else if (/duplicate/i.test(rest)) {
      field = 'duplicate';
      field_label = 'Duplicate';
      issue = 'Duplicate Student';
      const nameMatch = rest.match(/Student\s*['"]([^'"]+)['"]/i);
      student_name = nameMatch ? nameMatch[1] : '—';
      suggestion = 'Remove duplicate entry or specify a distinct section.';
    } else if (/gender/i.test(rest)) {
      field = 'gender';
      field_label = 'Gender';
      issue = 'Invalid Gender';
      suggestion = 'Use Male, Female, or Other (or leave blank).';
    } else if (/phone/i.test(rest)) {
      field = 'phone';
      field_label = 'Phone Number';
      issue = 'Phone Format';
      suggestion = 'Provide a valid phone number up to 15 digits.';
    } else if (/date/i.test(rest) || /dob/i.test(rest)) {
      field = 'date_of_birth';
      field_label = 'Date of Birth';
      issue = 'Invalid Date';
      suggestion = 'Use YYYY-MM-DD format (e.g. 2012-05-15) or leave blank.';
    }

    return {
      row,
      student_name,
      field,
      field_label,
      value,
      issue,
      reason,
      suggestion,
    };
  });
};

// Exports errors to a downloadable CSV file
const handleDownloadIssuesCSV = (issues) => {
  if (!issues || issues.length === 0) return;
  const headers = ['Row Number', 'Student Name', 'Field Affected', 'Value in Sheet', 'Issue Title', 'Detailed Reason', 'Actionable Fix'];
  const rows = issues.map((item) => [
    item.row ?? '',
    item.student_name === '—' ? '' : (item.student_name ?? ''),
    item.field_label || item.field || '',
    item.value ?? '',
    item.issue ?? '',
    item.reason ?? '',
    item.suggestion ?? ''
  ]);

  const escapeCell = (val) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escapeCell).join(','),
    ...rows.map((row) => row.map(escapeCell).join(','))
  ].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `student_upload_issues_${new Date().toISOString().slice(0, 10)}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

// Student Bulk Upload Modal Component with Issue Resolution Center
const StudentBulkUploadModal = ({ onClose, onSuccess, categories = [], classes = [], teams = [] }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  // Issue Resolution Center controls
  const [issueFilter, setIssueFilter] = useState('all');
  const [issueSearch, setIssueSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [copiedIssues, setCopiedIssues] = useState(false);
  const [teamAssignmentSearch, setTeamAssignmentSearch] = useState('');
  const pageSize = 12;

  const uploadSpreadsheetFile = async (fileToUpload) => {
    const target = fileToUpload || file;
    if (!target) return;

    setUploading(true);
    setUploadError(null);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', target);

      const response = await studentsAPI.bulkUpload(formData);
      const data = response.data;
      setUploadResult(data);
      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      console.error('Error uploading students:', error);
      const errorData = error.response?.data;
      const structured = normalizeImportErrors(errorData);
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

  const handleFileUpload = (e) => {
    e.preventDefault();
    if (!file) return;
    uploadSpreadsheetFile(file);
  };

  const handleDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const response = await studentsAPI.downloadTemplate();
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

  const resetForm = () => {
    setFile(null);
    setUploadResult(null);
    setUploadError(null);
    setIssueFilter('all');
    setIssueSearch('');
    setCurrentPage(1);
  };

  // Copy issues summary to clipboard
  const handleCopyIssues = (issues) => {
    if (!issues || issues.length === 0) return;
    const text = [
      `=== STUDENT BULK UPLOAD ISSUES (${issues.length} detected) ===`,
      ...issues.map((item, idx) => 
        `#${idx + 1} [Row ${item.row}] ${item.student_name && item.student_name !== '—' ? `Student: ${item.student_name} | ` : ''}${item.field_label} ("${item.value}"): ${item.reason}${item.suggestion ? ` -> Fix: ${item.suggestion}` : ''}`
      )
    ].join('\n');
    navigator.clipboard.writeText(text);
    setCopiedIssues(true);
    setTimeout(() => setCopiedIssues(false), 2000);
  };

  const structuredErrors = uploadError?.structured_errors || [];

  // Issue counts by category
  const counts = useMemo(() => {
    const c = { all: 0, team: 0, class: 0, name: 0, duplicate: 0, other: 0 };
    if (!structuredErrors) return c;
    c.all = structuredErrors.length;
    structuredErrors.forEach((err) => {
      if (err.field === 'team') c.team += 1;
      else if (err.field === 'class' || err.field === 'category') c.class += 1;
      else if (err.field === 'name') c.name += 1;
      else if (err.field === 'duplicate') c.duplicate += 1;
      else c.other += 1;
    });
    return c;
  }, [structuredErrors]);

  // Filtered issues based on active tab and search query
  const filteredIssues = useMemo(() => {
    if (!structuredErrors) return [];
    return structuredErrors.filter((err) => {
      if (issueFilter === 'team' && err.field !== 'team') return false;
      if (issueFilter === 'class' && err.field !== 'class' && err.field !== 'category') return false;
      if (issueFilter === 'name' && err.field !== 'name') return false;
      if (issueFilter === 'duplicate' && err.field !== 'duplicate') return false;
      if (issueFilter === 'other' && ['team', 'class', 'category', 'name', 'duplicate'].includes(err.field)) return false;

      if (issueSearch.trim()) {
        const q = issueSearch.toLowerCase().trim();
        const inRow = String(err.row).includes(q) || `row ${err.row}`.includes(q);
        const inName = (err.student_name || '').toLowerCase().includes(q);
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

  // Filtered team assignments in success view
  const filteredAssignments = useMemo(() => {
    if (!uploadResult?.team_assignments) return [];
    if (!teamAssignmentSearch.trim()) return uploadResult.team_assignments;
    const q = teamAssignmentSearch.toLowerCase().trim();
    return uploadResult.team_assignments.filter((item) => 
      (item.student || '').toLowerCase().includes(q) ||
      (item.team || item.team_name || '').toLowerCase().includes(q)
    );
  }, [uploadResult?.team_assignments, teamAssignmentSearch]);

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
              Bulk Import
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
                        No students were imported so your roster remains clean and uncorrupted. Every row with an issue has been pinpointed below with the exact row number and required fix.
                      </p>
                    </div>
                  </div>

                  {/* Quick Action Buttons */}
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownloadIssuesCSV(structuredErrors)}
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

                    {counts.team > 0 && (
                      <button
                        type="button"
                        onClick={() => { setIssueFilter('team'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                          issueFilter === 'team'
                            ? 'bg-purple-600 text-white shadow-xs'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                        }`}
                      >
                        <Trophy className="h-3 w-3" />
                        <span>Team Issues</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          issueFilter === 'team' ? 'bg-purple-800 text-white' : 'bg-purple-200 text-purple-800'
                        }`}>{counts.team}</span>
                      </button>
                    )}

                    {counts.class > 0 && (
                      <button
                        type="button"
                        onClick={() => { setIssueFilter('class'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                          issueFilter === 'class'
                            ? 'bg-sky-600 text-white shadow-xs'
                            : 'bg-sky-50 text-sky-700 hover:bg-sky-100 border border-sky-200'
                        }`}
                      >
                        <GraduationCap className="h-3 w-3" />
                        <span>Class / Category</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          issueFilter === 'class' ? 'bg-sky-800 text-white' : 'bg-sky-200 text-sky-800'
                        }`}>{counts.class}</span>
                      </button>
                    )}

                    {counts.name > 0 && (
                      <button
                        type="button"
                        onClick={() => { setIssueFilter('name'); setCurrentPage(1); }}
                        className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 flex items-center gap-1.5 ${
                          issueFilter === 'name'
                            ? 'bg-amber-600 text-white shadow-xs'
                            : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        }`}
                      >
                        <User className="h-3 w-3" />
                        <span>Missing Name</span>
                        <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                          issueFilter === 'name' ? 'bg-amber-800 text-white' : 'bg-amber-200 text-amber-800'
                        }`}>{counts.name}</span>
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

                  {/* Search Input */}
                  <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search row #, student, value..."
                      value={issueSearch}
                      onChange={(e) => { setIssueSearch(e.target.value); setCurrentPage(1); }}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                    />
                    {issueSearch && (
                      <button
                        type="button"
                        onClick={() => setIssueSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Issues Table */}
                <div className="rounded-xl border border-slate-200 overflow-hidden shadow-xs bg-white">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                          <th className="py-2.5 px-3 w-24">Excel Row</th>
                          <th className="py-2.5 px-3 w-40">Student Name</th>
                          <th className="py-2.5 px-3 w-36">Field</th>
                          <th className="py-2.5 px-3 w-36">Value in File</th>
                          <th className="py-2.5 px-4">Reason & Action Required</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {paginatedIssues.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="py-8 text-center text-slate-500">
                              <AlertCircle className="h-6 w-6 text-slate-300 mx-auto mb-1.5" />
                              <div className="font-semibold text-slate-700">No issues match your filter</div>
                              <div className="text-[11px] text-slate-400 mt-0.5">Try clearing your search query or switching categories.</div>
                            </td>
                          </tr>
                        ) : (
                          paginatedIssues.map((issue, idx) => {
                            const isTeam = issue.field === 'team';
                            const isClass = issue.field === 'class' || issue.field === 'category';
                            const isName = issue.field === 'name';
                            const isDup = issue.field === 'duplicate';

                            const fieldBadgeClass = isTeam
                              ? 'bg-purple-50 text-purple-700 border-purple-200'
                              : isClass
                              ? 'bg-sky-50 text-sky-700 border-sky-200'
                              : isName
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : isDup
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-slate-100 text-slate-700 border-slate-200';

                            return (
                              <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                                {/* Row Number */}
                                <td className="py-2.5 px-3 align-top whitespace-nowrap">
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-[11px] px-2 py-0.5 rounded bg-slate-900 text-white shadow-2xs">
                                    Row {issue.row}
                                  </span>
                                </td>

                                {/* Student Name */}
                                <td className="py-2.5 px-3 align-top">
                                  {issue.student_name && issue.student_name !== '—' ? (
                                    <span className="font-semibold text-slate-900 block truncate max-w-[150px]" title={issue.student_name}>
                                      {issue.student_name}
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                      Missing Name
                                    </span>
                                  )}
                                </td>

                                {/* Field Affected */}
                                <td className="py-2.5 px-3 align-top whitespace-nowrap">
                                  <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${fieldBadgeClass}`}>
                                    {isTeam && <Trophy className="h-3 w-3 shrink-0" />}
                                    {isClass && <GraduationCap className="h-3 w-3 shrink-0" />}
                                    {isName && <User className="h-3 w-3 shrink-0" />}
                                    {isDup && <Copy className="h-3 w-3 shrink-0" />}
                                    <span>{issue.field_label || issue.field}</span>
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
                            );
                          })
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
                  onClick={handleDownloadTemplate}
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
               SUCCESS SCREEN (Roster Imported Successfully with Team Breakdown)
               ========================================================================= */
            <div className="space-y-5 py-2">
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3 shadow-xs">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-bold text-emerald-950">Roster Imported Successfully!</h4>
                <p className="mt-1 text-xs text-emerald-800">
                  {uploadResult.message || `Successfully processed ${uploadResult.summary?.successful_creations || 0} students.`}
                </p>

                {/* Stats Bar */}
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-2.5 border-t border-emerald-200/60 pt-4 text-left">
                  <div className="rounded-lg bg-white/80 p-3 border border-emerald-100">
                    <div className="text-[11px] font-semibold text-emerald-700">Total Evaluated</div>
                    <div className="text-xl font-bold text-slate-900 mt-0.5">{uploadResult.summary?.total_processed ?? 0}</div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3 border border-emerald-100">
                    <div className="text-[11px] font-semibold text-emerald-700">Created Students</div>
                    <div className="text-xl font-bold text-emerald-700 mt-0.5">{uploadResult.summary?.successful_creations ?? 0}</div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3 border border-emerald-100">
                    <div className="text-[11px] font-semibold text-indigo-700">Team Assigned</div>
                    <div className="text-xl font-bold text-indigo-700 mt-0.5">{uploadResult.summary?.team_assignments_processed ?? 0}</div>
                  </div>
                  <div className="rounded-lg bg-white/80 p-3 border border-emerald-100">
                    <div className="text-[11px] font-semibold text-slate-600">Unassigned</div>
                    <div className="text-xl font-bold text-slate-700 mt-0.5">{uploadResult.summary?.unassigned_team_count ?? 0}</div>
                  </div>
                </div>
              </div>

              {/* Team Distribution Breakdown */}
              {uploadResult.team_breakdown && Object.keys(uploadResult.team_breakdown).length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Trophy className="h-4 w-4 text-indigo-600" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-800">Team Distribution</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {Object.entries(uploadResult.team_breakdown).map(([tName, tCount], idx) => (
                      <div key={idx} className="p-2.5 rounded-lg bg-white border border-slate-200/80 shadow-2xs">
                        <div className="text-xs font-semibold text-slate-800 truncate" title={tName}>
                          {tName}
                        </div>
                        <div className="text-lg font-bold text-indigo-600 mt-0.5">
                          {tCount} <span className="text-[11px] font-normal text-slate-500">students</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Team Assignments Activity List */}
              {uploadResult.team_assignments && uploadResult.team_assignments.length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-indigo-600" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                        Assigned Students ({uploadResult.team_assignments.length})
                      </span>
                    </div>
                    {uploadResult.team_assignments.length > 8 && (
                      <input
                        type="text"
                        placeholder="Search assigned student or team..."
                        value={teamAssignmentSearch}
                        onChange={(e) => setTeamAssignmentSearch(e.target.value)}
                        className="text-xs px-2.5 py-1 rounded border border-slate-200 bg-white placeholder-slate-400 focus:outline-none"
                      />
                    )}
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1 text-xs">
                    {filteredAssignments.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 px-2.5 rounded bg-white border border-slate-100 shadow-2xs">
                        <span className="font-medium text-slate-800">{item.student}</span>
                        <span className="inline-flex items-center gap-1 font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded text-[11px] border border-indigo-100">
                          → {item.team_name || item.team}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Auto-matched Corrections */}
              {uploadResult.corrections && uploadResult.corrections.length > 0 && (
                <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
                  <span className="text-xs font-bold text-amber-900 block mb-1">Auto-matched values ({uploadResult.corrections.length}):</span>
                  <ul className="text-xs text-amber-800 space-y-0.5 list-disc list-inside">
                    {uploadResult.corrections.slice(0, 5).map((corr, idx) => (
                      <li key={idx}>{corr}</li>
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
                      <h4 className="text-sm font-bold text-slate-900">Step 1: Download School Excel Template</h4>
                      <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                        Pre-configured with dropdowns matching your school's classes and teams. Includes a complete <strong>Example</strong> sheet with sample rows!
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleDownloadTemplate}
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
                  <span>Spreadsheet Columns</span>
                  <span className="text-[11px] font-normal text-slate-500">Only 2 required fields</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                    <div className="font-bold text-indigo-600 flex items-center gap-1">
                      <Check className="h-3 w-3" /> name & class
                    </div>
                    <p className="text-slate-600 mt-0.5">Required. Student name and class/grade (e.g. 10, Grade 8).</p>
                  </div>
                  <div className="p-2 rounded-lg bg-white border border-slate-200/80">
                    <div className="font-semibold text-slate-700">section, gender & team</div>
                    <p className="text-slate-500 mt-0.5">Optional. Section (A, B), Gender (Male/Female), and Team name.</p>
                  </div>
                </div>
                <div className="mt-2 text-[11px] text-indigo-700 bg-indigo-50/60 rounded px-2.5 py-1.5 border border-indigo-100 flex items-center gap-1.5">
                  <span>💡</span>
                  <span>Category is automatically mapped from the student's class — no complex codes needed!</span>
                </div>
              </div>

              {/* Step 2: Upload File */}
              <form onSubmit={handleFileUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Step 2: Select Spreadsheet or CSV File
                  </label>
                  
                  <div className="relative border-2 border-dashed border-slate-300 rounded-xl p-6 hover:border-indigo-400 transition-colors bg-slate-50/40 text-center">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      onChange={(e) => {
                        setFile(e.target.files[0] || null);
                        setUploadError(null);
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      id="excel-file-upload"
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
                        <p className="text-xs text-slate-400">Supported formats: Excel (.xlsx, .xls) and CSV (.csv) up to 1,000+ students</p>
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
                        Upload & Validate Students
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

export default StudentsPage; 
