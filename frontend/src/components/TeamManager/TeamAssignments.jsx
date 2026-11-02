import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  UserPlus,
  AlertCircle,
  X,
  Users,
  Trophy,
  Search,
  Calendar,
  Target,
  CheckCircle2
} from 'lucide-react';
import { teamManagerAPI, categoriesAPI } from '../../services/api';
import Pagination from '../common/Pagination';

const TeamAssignments = () => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [selectedSubTeam, setSelectedSubTeam] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [categories, setCategories] = useState([]);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchData();
    fetchCategories();
  }, [currentPage, pageSize]);

  const fetchCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data?.results || res.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);

      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;

      if (!teamId) {
        console.error('No team ID found in localStorage');
        return;
      }

      setSelectedTeam(teamId);
      setTeams([teamData]);

      const [eventsRes] = await Promise.all([
        teamManagerAPI.getTeamEvents(teamId).catch(() => ({ data: { events: [] } }))
      ]);

      const eventsList = eventsRes.data?.events || eventsRes.data?.results || eventsRes.data || [];
      setEvents(eventsList);

      const allPrograms = [];
      let teamMembersFromResponse = [];

      for (const event of eventsList) {
        try {
          const programsResponse = await teamManagerAPI.getEventPrograms(teamId, event.id);
          let eventPrograms = [];
          let teamMembersFromProgramsResponse = [];

          if (programsResponse.data?.results) {
            const resultData = programsResponse.data.results;
            eventPrograms = resultData.programs || [];
            teamMembersFromProgramsResponse = resultData.team_members || [];
          } else {
            eventPrograms = programsResponse.data?.programs || [];
            teamMembersFromProgramsResponse = programsResponse.data?.team_members || [];
          }

          if (teamMembersFromResponse.length === 0 && teamMembersFromProgramsResponse.length > 0) {
            teamMembersFromResponse = teamMembersFromProgramsResponse;
          }

          eventPrograms.forEach((program) => {
            program.event_id = event.id;
            program.event_title = event.title;
          });
          allPrograms.push(...eventPrograms);
        } catch (err) {
          console.warn(`Failed to fetch programs for event ${event.id}:`, err);
        }
      }

      setTeamMembers(teamMembersFromResponse);
      setPrograms(allPrograms);
      setTotalCount(allPrograms.length);

      const allAssignments = [];
      allPrograms.forEach((program) => {
        if (program.assigned_students && program.assigned_students.length > 0) {
          program.assigned_students.forEach((student) => {
            const assignment = {
              id: `${program.id}-${student.student_id}`,
              program_id: program.id,
              program_name: program.name,
              program_category: program.category,
              event_id: program.event_id,
              event_title: program.event_title,
              student_id: student.student_id,
              student_name: student.name,
              student_db_id: student.id,
              chest_number: student.chest_number,
              sub_team_number: student.sub_team_number || 1,
              is_leader: student.is_leader || false,
            };
            allAssignments.push(assignment);
          });
        }
      });

      setAssignments(allAssignments);
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  };

  const getCategoryDisplay = (code) => {
    if (!code) return 'General';
    const found = categories.find((c) => c.code?.toLowerCase() === code.toLowerCase());
    return found?.name || code.toUpperCase();
  };

  const getCategoryBadge = (code) => {
    return 'bg-slate-100 text-slate-700 border-slate-200/80';
  };

  const getAssignmentsForProgram = (programId) => {
    return assignments.filter((a) => a.program_id === programId);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    if (!selectedProgram || selectedStudents.length === 0) {
      alert('Please select at least one student to assign.');
      return;
    }

    try {
      setSubmitting(true);
      if (selectedProgram.is_team_based) {
        await teamManagerAPI.assignStudentsToProgram(
          selectedTeam,
          selectedProgram.event_id,
          selectedProgram.id,
          selectedStudents,
          selectedSubTeam
        );
      } else {
        for (const studentId of selectedStudents) {
          await teamManagerAPI.assignStudentToProgram(
            selectedTeam,
            selectedProgram.event_id,
            selectedProgram.id,
            studentId
          );
        }
      }

      setShowAssignModal(false);
      setSelectedProgram(null);
      setSelectedStudents([]);
      setSelectedSubTeam(1);
      fetchData();
    } catch (err) {
      console.error('Assignment error:', err);
      alert('Failed to complete program assignment. Please check limits and student eligibility.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (assignment) => {
    if (!window.confirm(`Remove ${assignment.student_name} from ${assignment.program_name}?`)) return;

    try {
      await teamManagerAPI.removeStudentFromProgram(
        selectedTeam,
        assignment.event_id,
        assignment.program_id,
        assignment.student_db_id
      );
      fetchData();
    } catch (err) {
      console.error('Remove assignment error:', err);
      alert('Failed to remove assignment.');
    }
  };

  const filteredPrograms = programs.filter((p) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.name?.toLowerCase().includes(q) ||
      p.event_title?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q);
    const matchesCategory =
      selectedCategoryFilter === 'all' ||
      p.category?.toLowerCase() === selectedCategoryFilter.toLowerCase();
    return matchesSearch && matchesCategory;
  });

  const paginatedPrograms = filteredPrograms.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 mx-auto" />
          <p className="mt-3 text-sm font-medium text-slate-500">Loading assignments...</p>
        </div>
      </div>
    );
  }

  const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
  const teamName = teamData.name || teamData.team_name || 'My Team';

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* ========================================================================= */}
        {/* 1. HEADER */}
        {/* ========================================================================= */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Allocations
            </p>
            <h1 className="mt-1 text-xl font-bold tracking-tight text-slate-900">
              Program Assignments
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Assign roster students of <span className="font-semibold text-slate-700">{teamName}</span> into competitive stage items.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs">
              <Users className="h-3.5 w-3.5 text-indigo-600" />
              <span>{teamMembers.length} Members Available</span>
            </div>
            <button
              onClick={() => navigate('/team-manager/students')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs hover:border-indigo-200 hover:text-indigo-600 transition-colors"
            >
              <span>View Roster</span>
            </button>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. SUMMARY METRICS */}
        {/* ========================================================================= */}
        <section className="mt-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
              <Users className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold tracking-tight text-slate-900">{teamMembers.length}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Total Members</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
              <Trophy className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold tracking-tight text-slate-900">{programs.length}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Active Programs</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
              <Target className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold tracking-tight text-slate-900">{assignments.length}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Allocated Entries</p>
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl border border-slate-200/80 bg-white p-3 sm:p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xl font-bold tracking-tight text-slate-900">{events.length}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Festivals</p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. FILTER BAR */}
        {/* ========================================================================= */}
        <section className="mt-5 rounded-xl border border-slate-200/80 bg-white p-2.5 sm:p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_200px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search programs by title or event..."
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-1 focus:ring-indigo-100"
              />
            </div>

            <select
              value={selectedCategoryFilter}
              onChange={(e) => {
                setSelectedCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 rounded-lg border border-slate-200 bg-slate-50/70 px-3 text-xs text-slate-700 outline-none focus:border-indigo-300 focus:ring-1 focus:ring-indigo-100"
            >
              <option value="all">All categories</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>

            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategoryFilter('all');
                setCurrentPage(1);
              }}
              className="h-9 rounded-lg px-3 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-indigo-600"
            >
              Clear
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. TABLE VIEW (Matches Event Manager portal UI pattern) */}
        {/* ========================================================================= */}
        <section className="mt-4 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
            <p className="text-xs font-semibold text-slate-900">Program allocation directory</p>
            <p className="text-[11px] text-slate-400">{filteredPrograms.length} items</p>
          </div>

          {paginatedPrograms.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead className="bg-slate-50/60">
                  <tr>
                    {['Program', 'Category', 'Festival / Event', 'Slots / Capacity', 'Assigned Students'].map((label) => (
                      <th
                        key={label}
                        className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-400"
                      >
                        {label}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedPrograms.map((program) => {
                    const programAssignments = getAssignmentsForProgram(program.id);
                    const assignedCount = programAssignments.length;
                    const maxAllowed = program.is_team_based
                      ? (program.team_size || 4)
                      : (program.max_participants || 1);
                    const isFull = assignedCount >= maxAllowed;

                    return (
                      <tr key={program.id} className="transition hover:bg-indigo-50/30">
                        {/* Program Name & Type */}
                        <td className="px-4 py-3">
                          <div>
                            <p className="font-semibold text-slate-900 text-xs max-w-[240px] truncate">
                              {program.name}
                            </p>
                            <span className="text-[10px] text-slate-400 font-medium capitalize">
                              {program.is_team_based ? 'Group Team Event' : 'Individual Solo'}
                            </span>
                          </div>
                        </td>

                        {/* Category */}
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-md border px-2 py-0.5 text-[11px] font-medium ${getCategoryBadge(
                              program.category
                            )}`}
                          >
                            {getCategoryDisplay(program.category)}
                          </span>
                        </td>

                        {/* Festival / Event */}
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                            <span className="truncate max-w-[200px]">{program.event_title}</span>
                          </div>
                        </td>

                        {/* Capacity / Slots */}
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                                isFull
                                  ? 'border-slate-200 bg-slate-100 text-slate-600'
                                  : 'border-indigo-100 bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              {assignedCount} / {maxAllowed} slots
                            </span>
                            <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full rounded-full transition-all duration-300 ${
                                  isFull ? 'bg-slate-400' : 'bg-indigo-600'
                                }`}
                                style={{
                                  width: `${Math.min(100, (assignedCount / maxAllowed) * 100)}%`,
                                }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Assigned Students */}
                        <td className="px-4 py-3">
                          {programAssignments.length > 0 ? (
                            <div className="flex flex-wrap items-center gap-1 max-w-sm">
                              {programAssignments.map((a) => (
                                <span
                                  key={a.id}
                                  className="inline-flex items-center gap-1 rounded-md border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
                                >
                                  <span className="truncate max-w-[120px]">{a.student_name}</span>
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveAssignment(a)}
                                    className="text-slate-400 hover:text-rose-600 transition-colors p-0.5"
                                    title={`Remove ${a.student_name}`}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">No students assigned</span>
                          )}
                        </td>

                        {/* Action */}
                        <td className="whitespace-nowrap px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedProgram(program);
                              setSelectedStudents([]);
                              setShowAssignModal(true);
                            }}
                            disabled={isFull}
                            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                              isFull
                                ? 'border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                : 'bg-indigo-600 text-white shadow-2xs hover:bg-indigo-700'
                            }`}
                          >
                            <UserPlus className="h-3 w-3" />
                            <span>{isFull ? 'Full' : 'Assign'}</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-16 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100">
                <Trophy className="h-5 w-5 text-slate-400" />
              </div>
              <h3 className="mt-4 text-sm font-semibold text-slate-900">No programs match</h3>
              <p className="mt-1 text-sm text-slate-400">Try modifying your search or category filter.</p>
            </div>
          )}

          {/* Pagination */}
          {filteredPrograms.length > pageSize && (
            <div className="border-t border-slate-100 px-5 py-3">
              <Pagination
                currentPage={currentPage}
                totalPages={Math.ceil(filteredPrograms.length / pageSize)}
                onPageChange={(page) => setCurrentPage(page)}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                totalCount={filteredPrograms.length}
                className="text-slate-500"
              />
            </div>
          )}
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 5. ASSIGNMENT MODAL (Eventloo Indigo Theme) */}
      {/* ========================================================================= */}
      {/* ========================================================================= */}
      {/* 5. ASSIGNMENT MODAL (Eventloo Indigo Theme) */}
      {/* ========================================================================= */}
      {showAssignModal && selectedProgram && (() => {
        const programAssignments = getAssignmentsForProgram(selectedProgram.id);
        const assignedStudentIds = new Set(programAssignments.map((a) => a.student_id || a.student_db_id));
        
        // Only list students whose category is allowed for this program
        const isCatAllowed = (sCat, pCat) => {
          if (!pCat || pCat.toLowerCase() === 'all' || pCat.toLowerCase() === 'general') return true;
          if (!sCat) return false;
          return sCat.trim().toLowerCase() === pCat.trim().toLowerCase();
        };

        const eligibleMembers = teamMembers.filter((m) => {
          if (assignedStudentIds.has(m.id) || assignedStudentIds.has(m.student_id)) return false;
          return isCatAllowed(m.category, selectedProgram.category);
        });

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-xs">
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                <div className="min-w-0 pr-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600">
                    {getCategoryDisplay(selectedProgram.category)} · {selectedProgram.is_team_based ? 'Team' : 'Single'}
                  </p>
                  <h3 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                    Assign to {selectedProgram.name}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedProgram(null);
                    setSelectedStudents([]);
                  }}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleAssignSubmit} className="mt-3.5 space-y-3.5">
                <p className="text-xs text-slate-500">
                  Select eligible <span className="font-medium text-slate-700">{getCategoryDisplay(selectedProgram.category)}</span> students:
                </p>

                <div className="space-y-1.5 max-h-56 overflow-y-auto border border-slate-200/80 rounded-lg p-1.5 bg-slate-50/50">
                  {eligibleMembers.length > 0 ? (
                    eligibleMembers.map((student) => {
                      const sId = student.id || student.student_id;
                      const isSelected = selectedStudents.includes(sId);
                      return (
                        <label
                          key={sId}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-all border ${
                            isSelected
                              ? 'bg-indigo-50/70 border-indigo-200 shadow-2xs'
                              : 'bg-white border-transparent hover:border-slate-200'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type={selectedProgram.is_team_based ? 'checkbox' : 'radio'}
                              name="assignedStudent"
                              checked={isSelected}
                              onChange={(e) => {
                                if (selectedProgram.is_team_based) {
                                  if (e.target.checked) {
                                    setSelectedStudents((prev) => [...prev, sId]);
                                  } else {
                                    setSelectedStudents((prev) => prev.filter((id) => id !== sId));
                                  }
                                } else {
                                  setSelectedStudents([sId]);
                                }
                              }}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-slate-900 truncate">{student.name}</p>
                              <p className="text-[10px] text-slate-400 font-mono">#{student.student_id}</p>
                            </div>
                          </div>

                          <span className="text-[10px] font-medium text-slate-500 shrink-0">
                            {student.grade ? `Class ${student.grade}` : (student.category || 'General')}
                          </span>
                        </label>
                      );
                    })
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-6">
                      No eligible {getCategoryDisplay(selectedProgram.category)} students available.
                    </p>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t border-slate-100 pt-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAssignModal(false);
                      setSelectedProgram(null);
                      setSelectedStudents([]);
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || selectedStudents.length === 0}
                    className="px-3.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-medium hover:bg-indigo-700 disabled:opacity-50 shadow-2xs transition-colors"
                  >
                    {submitting ? 'Assigning...' : 'Confirm'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}
    </main>
  );
};

export default TeamAssignments;
