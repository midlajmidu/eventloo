import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamManagerAPI, categoriesAPI, classesAPI } from '../../services/api';
import Pagination from '../common/Pagination';
import {
  Users,
  Search,
  Eye,
  UserPlus,
  GraduationCap,
  Mail,
  MapPin,
  Phone,
  Calendar,
  Award,
  AlertCircle,
  X,
  Target,
  ChevronRight,
  Filter
} from 'lucide-react';

const TeamStudents = () => {
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [categories, setCategories] = useState([]);
  const [classes, setClasses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedGrade, setSelectedGrade] = useState('all');
  const [selectedSection, setSelectedSection] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');

  // Modal
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Load team data
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;

      if (!teamId) {
        setError('No team profile active. Please sign in again.');
        return;
      }
      setSelectedTeam(teamData);

      // Load students and categories
      const [studentsRes, catRes, classRes] = await Promise.all([
        teamManagerAPI.getTeamStudents(teamId).catch((err) => {
          console.warn('Failed to load team students:', err);
          return { data: { students: [] } };
        }),
        categoriesAPI.list().catch((err) => {
          console.warn('Failed to load categories:', err);
          return { data: [] };
        }),
        classesAPI.list().catch((err) => {
          console.warn('Failed to load classes:', err);
          return { data: [] };
        }),
      ]);

      const rawStudents = studentsRes?.data;
      const studentList = Array.isArray(rawStudents)
        ? rawStudents
        : Array.isArray(rawStudents?.students)
          ? rawStudents.students
          : (rawStudents?.results || []);

      setStudents(studentList);
      const rawCats = catRes?.data?.results || catRes?.data || [];
      const standardCats = rawCats.filter(
        (c) =>
          !c.is_mixing &&
          !['general', 'gen', 'gn', 'open', 'open category'].includes((c.code || '').toLowerCase()) &&
          (c.name || '').toLowerCase() !== 'general' &&
          (c.name || '').toLowerCase() !== 'open'
      );
      setCategories(standardCats);
      setClasses(classRes?.data?.results || classRes?.data || []);
    } catch (err) {
      console.error('Error fetching student roster:', err);
      setError('Unable to load team students.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryDisplay = (code) => {
    if (!code) return 'General';
    const found = categories.find((c) => c.code?.toLowerCase() === code.toLowerCase());
    if (found?.name) return found.name;
    const map = {
      lp: 'Lower Primary',
      up: 'Upper Primary',
      hs: 'High School',
      hss: 'Higher Secondary',
      junior: 'Junior',
      senior: 'Senior',
      sub_junior: 'Sub-Junior',
      general: 'General',
    };
    return map[code.toLowerCase()] || code;
  };

  const getCategoryBadgeStyle = (_code) => {
    return 'bg-slate-100 text-slate-700 border-slate-200/80';
  };

  // Derive unique filter options from loaded students
  const availableGrades = useMemo(() => {
    return [...new Set(students.map((s) => s.grade).filter(Boolean))].sort((a, b) => {
      const na = parseInt(a, 10);
      const nb = parseInt(b, 10);
      if (!isNaN(na) && !isNaN(nb)) return na - nb;
      return String(a).localeCompare(String(b));
    });
  }, [students]);

  const availableSections = useMemo(() => {
    return [...new Set(students.map((s) => s.section).filter(Boolean))].sort();
  }, [students]);

  // Filtered dataset
  const filteredStudents = useMemo(() => {
    return students.filter((student) => {
      const q = searchTerm.trim().toLowerCase();
      const matchesSearch =
        !q ||
        student.name?.toLowerCase().includes(q) ||
        student.student_id?.toLowerCase().includes(q) ||
        student.email?.toLowerCase().includes(q);

      const matchesCategory =
        selectedCategory === 'all' ||
        student.category?.toLowerCase() === selectedCategory.toLowerCase();

      const matchesGrade =
        selectedGrade === 'all' ||
        String(student.grade).toLowerCase() === selectedGrade.toLowerCase();

      const matchesSection =
        selectedSection === 'all' ||
        String(student.section).toLowerCase() === selectedSection.toLowerCase();

      const matchesGender =
        selectedGender === 'all' ||
        String(student.gender).toLowerCase() === selectedGender.toLowerCase();

      return matchesSearch && matchesCategory && matchesGrade && matchesSection && matchesGender;
    });
  }, [students, searchTerm, selectedCategory, selectedGrade, selectedSection, selectedGender]);

  // Paginated slice
  const paginatedStudents = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredStudents.slice(startIndex, startIndex + pageSize);
  }, [filteredStudents, currentPage, pageSize]);

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedCategory('all');
    setSelectedGrade('all');
    setSelectedSection('all');
    setSelectedGender('all');
    setCurrentPage(1);
  };

  const handleViewStudent = (student) => {
    setSelectedStudent(student);
    setShowViewModal(true);
  };

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 mx-auto" />
          <p className="mt-3 text-sm font-medium text-slate-500">Loading student directory...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb] px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">Unable to load roster</h2>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <button
            type="button"
            onClick={fetchInitialData}
            className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const teamName = selectedTeam?.name || selectedTeam?.team_name || 'My Team';

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* ========================================================================= */}
        {/* 1. HEADER (Matches Admin StudentsPage) */}
        {/* ========================================================================= */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Directory
            </p>
            <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Team Students
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Enrolled student roster and categories for{' '}
              <span className="font-semibold text-slate-700">{teamName}</span>.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>{students.length} Members</span>
            </div>
            <button
              onClick={() => navigate('/team-manager/events')}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-2xs hover:bg-indigo-700 transition-colors"
            >
              <Target className="h-3.5 w-3.5" />
              <span>Assign in Events</span>
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. SEARCH & FILTER BAR (Clean minimal design matching Admin) */}
        {/* ========================================================================= */}
        <section className="mt-4 sm:mt-5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-[minmax(220px,2fr)_repeat(4,minmax(115px,1fr))_auto]">
            {/* Search Input */}
            <div className="col-span-2 sm:col-span-2 md:col-span-1 xl:col-auto relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                aria-label="Search students"
                placeholder="Search by name or student ID..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            {/* Category Dropdown */}
            <select
              aria-label="Filter by category"
              value={selectedCategory}
              onChange={(e) => {
                setSelectedCategory(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs sm:text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All categories</option>
              {categories
                .filter(
                  (c) =>
                    !c.is_mixing &&
                    !['general', 'gen', 'gn', 'open', 'open category'].includes((c.code || '').toLowerCase()) &&
                    (c.name || '').toLowerCase() !== 'general'
                )
                .map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.name}
                  </option>
                ))}
            </select>

            {/* Grade Dropdown */}
            <select
              aria-label="Filter by grade"
              value={selectedGrade}
              onChange={(e) => {
                setSelectedGrade(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs sm:text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All grades</option>
              {availableGrades.map((grade) => (
                <option key={grade} value={grade}>
                  Grade {grade}
                </option>
              ))}
            </select>

            {/* Section Dropdown */}
            <select
              aria-label="Filter by section"
              value={selectedSection}
              onChange={(e) => {
                setSelectedSection(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs sm:text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All sections</option>
              {availableSections.map((sec) => (
                <option key={sec} value={sec}>
                  Section {sec}
                </option>
              ))}
            </select>

            {/* Gender Dropdown */}
            <select
              aria-label="Filter by gender"
              value={selectedGender}
              onChange={(e) => {
                setSelectedGender(e.target.value);
                setCurrentPage(1);
              }}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-xs sm:text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All genders</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>

            {/* Clear Filters */}
            <button
              onClick={handleClearFilters}
              className="col-span-2 sm:col-span-1 md:col-span-1 xl:col-auto h-10 rounded-xl px-3 text-xs sm:text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700"
            >
              Clear
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. TABLE VIEW & MOBILE CARDS (Dual-View matching responsive design) */}
        {/* ========================================================================= */}
        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          {/* Table Header Row */}
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5 sm:py-3.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Student directory</p>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                {teamName}
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Showing {filteredStudents.length} of {students.length}
            </p>
          </div>

          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Student
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Student ID
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Gender
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Class
                  </th>
                  <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Category
                  </th>
                  <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedStudents.map((student) => {
                  const studentName = student.name || `Student ${student.student_id}`;
                  const studentInitial = studentName.charAt(0).toUpperCase() || 'S';

                  return (
                    <tr
                      key={student.id || student.student_id}
                      className="transition-colors hover:bg-indigo-50/30"
                    >
                      {/* Student info with avatar initial */}
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-xs font-bold text-indigo-600">
                            {studentInitial}
                          </div>
                          <div className="min-w-0">
                            <p className="max-w-[220px] truncate text-sm font-semibold text-slate-900">
                              {studentName}
                            </p>
                            <p className="max-w-[220px] truncate text-xs text-slate-400">
                              {student.email || 'No email registered'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Student ID */}
                      <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-slate-600">
                        {student.student_id || '—'}
                      </td>

                      {/* Gender */}
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm capitalize text-slate-600">
                        {student.gender || '—'}
                      </td>

                      {/* Class / Grade & Section */}
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600">
                        {student.grade ? `Grade ${student.grade}` : '—'}
                        {student.section ? ` · ${student.section}` : ''}
                      </td>

                      {/* Category Badge */}
                      <td className="whitespace-nowrap px-5 py-3.5">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${getCategoryBadgeStyle(
                            student.category
                          )}`}
                        >
                          {getCategoryDisplay(student.category)}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleViewStudent(student)}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-100"
                            title="View student profile"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>View</span>
                          </button>
                          <button
                            onClick={() => navigate('/team-manager/events')}
                            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
                            title="Assign to programs in events"
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

          {/* Mobile Native Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {paginatedStudents.map((student) => {
              const studentName = student.name || `Student ${student.student_id}`;
              const studentInitial = studentName.charAt(0).toUpperCase() || 'S';

              return (
                <div key={student.id || student.student_id} className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600">
                        {studentInitial}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{studentName}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                            {student.student_id || '—'}
                          </span>
                          {student.gender && (
                            <span className="text-[11px] capitalize text-slate-500">
                              · {student.gender}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`shrink-0 inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${getCategoryBadgeStyle(
                        student.category
                      )}`}
                    >
                      {getCategoryDisplay(student.category)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-2.5 text-xs text-slate-600">
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Class / Grade</span>
                      <p className="font-semibold text-slate-800 truncate mt-0.5">
                        {student.grade ? `Grade ${student.grade}` : '—'}
                        {student.section ? ` (${student.section})` : ''}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Contact</span>
                      <p className="font-semibold text-slate-800 truncate mt-0.5">
                        {student.phone_number || student.phone || student.email || '—'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleViewStudent(student)}
                      className="min-h-[40px] flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 active:bg-indigo-100 transition-colors"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Profile</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/team-manager/events')}
                      className="min-h-[40px] inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                      title="Assign in Events"
                    >
                      <UserPlus className="h-4 w-4" />
                      <span>Assign</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredStudents.length === 0 && (
            <div className="py-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <Users className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">No students found</h3>
              <p className="mt-1 text-sm text-slate-400">
                Try adjusting your search query or category filters.
              </p>
              <button
                onClick={handleClearFilters}
                className="mt-4 text-xs font-semibold text-indigo-600 hover:underline"
              >
                Clear all filters
              </button>
            </div>
          )}

          {/* Pagination */}
          {filteredStudents.length > 0 && (
            <div className="border-t border-slate-100 px-5 py-3">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredStudents.length / pageSize)}
                onPageChange={(page) => setCurrentPage(page)}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                totalCount={filteredStudents.length}
                className="text-slate-500"
              />
            </div>
          )}
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 4. STUDENT DETAILS MODAL */}
      {/* ========================================================================= */}
      {showViewModal && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-3 sm:p-4 backdrop-blur-xs">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-4 sm:p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 font-bold text-base">
                  {(selectedStudent.name || 'S').charAt(0).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">
                    {selectedStudent.name || 'Student Profile'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {selectedStudent.student_id ? `ID: ${selectedStudent.student_id}` : 'Team Member'} · {teamName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowViewModal(false)}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="mt-4 space-y-4">
              {/* Badges row */}
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getCategoryBadgeStyle(
                    selectedStudent.category
                  )}`}
                >
                  {getCategoryDisplay(selectedStudent.category)}
                </span>
                {selectedStudent.gender && selectedStudent.gender !== '—' && (
                  <span className="inline-flex capitalize text-xs text-slate-600 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200">
                    {selectedStudent.gender}
                  </span>
                )}
              </div>

              {/* Data Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl bg-slate-50 p-3.5 sm:p-4 border border-slate-100 text-xs">
                <div>
                  <span className="font-medium text-slate-400">Class & Grade</span>
                  <p className="mt-0.5 font-semibold text-slate-800">
                    {selectedStudent.grade ? `Grade ${selectedStudent.grade}` : '—'}
                    {selectedStudent.section ? ` · Section ${selectedStudent.section}` : ''}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-slate-400">Student ID</span>
                  <p className="mt-0.5 font-semibold font-mono text-slate-800">
                    {selectedStudent.student_id || '—'}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-slate-400">Email Address</span>
                  <p className="mt-0.5 font-medium text-slate-800 truncate">
                    {selectedStudent.email || '—'}
                  </p>
                </div>
                <div>
                  <span className="font-medium text-slate-400">Phone Number</span>
                  <p className="mt-0.5 font-medium text-slate-800">
                    {selectedStudent.phone_number || selectedStudent.phone || '—'}
                  </p>
                </div>
                {selectedStudent.address && (
                  <div className="sm:col-span-2 border-t border-slate-200/60 pt-2">
                    <span className="font-medium text-slate-400">Residential Address</span>
                    <p className="mt-0.5 text-slate-700 leading-relaxed">
                      {selectedStudent.address}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <button
                onClick={() => {
                  setShowViewModal(false);
                  navigate('/team-manager/events');
                }}
                className="text-xs font-semibold text-indigo-600 hover:underline flex items-center justify-center gap-1 min-h-[40px]"
              >
                <span>Event Program Assignments</span>
                <ChevronRight className="h-3 w-3" />
              </button>
              <button
                onClick={() => setShowViewModal(false)}
                className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-sm min-h-[40px]"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};

export default TeamStudents;