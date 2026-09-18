import React, { useState, useEffect } from 'react';
import { 
  BarChart2, 
  CheckCircle, 
  X, 
  AlertCircle,
  Search,
  Plus,
  Users,
  Crown,
  UserMinus,
  UserPlus,
  BookOpen
} from 'lucide-react';
import { 
  eventProgramsAPI, 
  studentsAPI, 
  eventAssignmentsAPI, 
  teamsAPI,
  teamManagerAPI
} from '../../services/api';

const EventAssignments = ({ event, eventId, categories = [] }) => {
  const [programs, setPrograms] = useState([]);
  const [teams, setTeams] = useState([]);
  const [students, setStudents] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Selection States
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedTeamId, setSelectedTeamId] = useState('');
  
  // Drawer States
  const [activeDrawerProgram, setActiveDrawerProgram] = useState(null);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [drawerSubTeam, setDrawerSubTeam] = useState(1);
  const [drawerError, setDrawerError] = useState('');

  // Drawer Pagination States
  const [availablePage, setAvailablePage] = useState(1);
  const [assignedPage, setAssignedPage] = useState(1);
  const AVAILABLE_PAGE_SIZE = 5;
  const ASSIGNED_SUBTEAM_PAGE_SIZE = 2;
  const ASSIGNED_INDIVIDUAL_PAGE_SIZE = 5;
  
  // UI Indicators
  const [savingStatus, setSavingStatus] = useState('All changes saved');
  const [showInsights, setShowInsights] = useState(false);
  const [message, setMessage] = useState('');

  const [teamSpecificStudents, setTeamSpecificStudents] = useState([]);

  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    if (selectedTeamId) {
      loadTeamStudents(selectedTeamId);
    } else {
      setTeamSpecificStudents([]);
    }
  }, [selectedTeamId]);

  const loadTeamStudents = async (teamId) => {
    try {
      const res = await teamManagerAPI.getTeamStudents(teamId);
      const list = res.data?.students || (Array.isArray(res.data) ? res.data : []);
      setTeamSpecificStudents(list);
    } catch (err) {
      console.error('Error loading team students:', err);
    }
  };

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      const [programsRes, teamsRes, studentsRes, assignmentsRes] = await Promise.all([
        eventProgramsAPI.getPrograms(eventId, 'page_size=500'),
        teamsAPI.getTeams({ event: eventId }),
        studentsAPI.getStudents({ page_size: 1000 }),
        eventAssignmentsAPI.getEventAssignments(eventId)
      ]);

      const progs = Array.isArray(programsRes.data) ? programsRes.data : (programsRes.data.results || []);
      const tms = Array.isArray(teamsRes.data) ? teamsRes.data : (teamsRes.data.results || []);
      const stds = Array.isArray(studentsRes.data) ? studentsRes.data : (studentsRes.data.results || []);
      const assgs = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : (assignmentsRes.data.results || []);

      setPrograms(progs);
      setTeams(tms);
      setStudents(stds);
      setAssignments(assgs);
    } catch (error) {
      console.error('Error fetching registration data:', error);
      setMessage('Error loading registration data');
    } finally {
      setLoading(false);
    }
  };

  const reloadAssignments = async () => {
    try {
      const assignmentsRes = await eventAssignmentsAPI.getEventAssignments(eventId);
      const assgs = Array.isArray(assignmentsRes.data) ? assignmentsRes.data : (assignmentsRes.data.results || []);
      setAssignments(assgs);
    } catch (err) {
      console.error('Error reloading assignments:', err);
    }
  };

  // Assign a student to a program (with optional sub-team)
  const handleAssignStudent = async (programId, studentId, subTeamNum = 1) => {
    if (!selectedTeamId || !studentId) return;

    setSavingStatus('Saving changes...');
    setDrawerError('');
    try {
      await teamManagerAPI.assignStudentsToProgram(selectedTeamId, eventId, programId, [studentId], subTeamNum);
      await reloadAssignments();
      setSavingStatus('All changes saved');
    } catch (error) {
      console.error('Error assigning student:', error);
      const errMsg = error.response?.data?.error || 'Failed to assign student';
      setDrawerError(errMsg);
      setMessage(errMsg);
      setSavingStatus('Save failed');
      setTimeout(() => setMessage(''), 4000);
    }
  };

  // Set sub-team leader
  const handleSetLeader = async (programId, studentId, subTeamNum = 1) => {
    if (!selectedTeamId || !studentId) return;

    setSavingStatus('Updating leader...');
    setDrawerError('');
    try {
      await teamManagerAPI.setSubTeamLeader(selectedTeamId, eventId, programId, studentId, subTeamNum);
      await reloadAssignments();
      setSavingStatus('All changes saved');
    } catch (error) {
      console.error('Error setting leader:', error);
      const errMsg = error.response?.data?.error || 'Failed to update leader';
      setDrawerError(errMsg);
      setMessage(errMsg);
      setSavingStatus('Save failed');
      setTimeout(() => setMessage(''), 4000);
    }
  };

  // Remove / unassign a student from a program
  const handleRemoveAssignment = async (programId, studentId) => {
    if (!selectedTeamId || !studentId) return;

    setSavingStatus('Saving changes...');
    setDrawerError('');
    try {
      await teamManagerAPI.removeStudentFromProgram(selectedTeamId, eventId, programId, studentId);
      await reloadAssignments();
      setSavingStatus('All changes saved');
    } catch (error) {
      console.error('Error removing assignment:', error);
      const errMsg = error.response?.data?.error || 'Failed to remove assignment';
      setDrawerError(errMsg);
      setMessage(errMsg);
      setSavingStatus('Save failed');
      setTimeout(() => setMessage(''), 4000);
    }
  };

  // Categories list
  const categoryOptions = categories.length > 0 ? categories.map(cat => ({
    code: cat.code,
    name: cat.name || cat.code.toUpperCase()
  })) : [
    { code: 'junior', name: 'Junior Category' },
    { code: 'hs', name: 'High School (HS)' },
    { code: 'hss', name: 'Higher Secondary (HSS)' },
    { code: 'general', name: 'General Category-A (CAT-A)' },
  ];

  // Helper functions for team and category matching
  const getStudentTeamId = (s) => {
    if (!s) return null;
    if (typeof s.team === 'object' && s.team !== null) return s.team.id;
    if (typeof s.team_details === 'object' && s.team_details !== null) return s.team_details.id;
    return s.team_id || s.team;
  };

  const isGeneralCategory = (cat) => {
    if (!cat) return true;
    const c = String(cat).toLowerCase();
    if (c === 'general' || c === 'gen' || c === 'general_a' || c === 'cat-a' || c === 'all' || c === 'a' || c === 'general category-a (cat-a)') {
      return true;
    }
    if (Array.isArray(categories) && categories.length > 0) {
      const match = categories.find(item => item.code && item.code.toLowerCase() === c);
      if (match && (match.is_mixing || match.is_general)) {
        return true;
      }
    }
    return false;
  };

  // Selected Team Object
  const currentTeam = teams.find(t => t.id === parseInt(selectedTeamId, 10));

  // Team members belonging to the selected team (combining direct API and global students)
  const teamMembers = (() => {
    if (!selectedTeamId) return [];
    
    const memberMap = new Map();

    // 1. Add students from team-specific endpoint
    teamSpecificStudents.forEach(s => {
      if (s && s.id) {
        memberMap.set(s.id, {
          ...s,
          name: s.name || s.display_name || `${s.first_name || ''} ${s.last_name || ''}`,
          student_id: s.student_id || s.code || '',
          chest_number: s.chest_number || s.chest_no || ''
        });
      }
    });

    // 2. Add matching students from global list
    students.forEach(s => {
      if (!s || !s.id) return;
      const sTeamId = getStudentTeamId(s);
      if (sTeamId && parseInt(sTeamId, 10) === parseInt(selectedTeamId, 10)) {
        if (!memberMap.has(s.id)) {
          memberMap.set(s.id, s);
        }
      }
    });

    return Array.from(memberMap.values());
  })();

  // Filtered Programs for selected Category
  const filteredPrograms = programs.filter(p => {
    if (!selectedCategory) return true;
    if (isGeneralCategory(selectedCategory)) {
      return isGeneralCategory(p.category);
    }
    return p.category === selectedCategory;
  });

  // Get assignments for a specific program and the selected team
  const getAssignmentsForProgramAndTeam = (programId) => {
    return assignments.filter(a => {
      const matchProg = a.program_id === programId || a.program === programId || a.program_details?.id === programId;
      const aTeamId = typeof a.team === 'object' && a.team !== null ? a.team.id : (a.team_id || a.team || a.team_details?.id);
      const matchTeam = aTeamId && parseInt(aTeamId, 10) === parseInt(selectedTeamId, 10);
      return matchProg && matchTeam;
    });
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600 mx-auto mb-3"></div>
        <p className="text-sm text-gray-500 font-medium">Loading Registrations...</p>
      </div>
    );
  }

  const isSelectionIncomplete = !selectedCategory || !selectedTeamId;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Top Header Card Box */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Assignments & Registrations</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Assign participants to competitions for <span className="font-semibold text-gray-700">{event?.title || 'this Event'}</span>
          </p>
        </div>

        <button
          onClick={() => setShowInsights(!showInsights)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors inline-flex items-center space-x-2 self-start sm:self-auto cursor-pointer"
        >
          <BarChart2 className="w-4 h-4" />
          <span>Insights</span>
        </button>
      </div>

      {/* Message Banner */}
      {message && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs font-semibold flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <span>{message}</span>
        </div>
      )}

      {/* Insights Drawer / Modal */}
      {showInsights && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <div className="flex justify-between items-center">
            <h3 className="text-sm font-bold text-amber-900 flex items-center space-x-2">
              <BarChart2 className="w-4 h-4 text-amber-600" />
              <span>Registration Insights Overview</span>
            </h3>
            <button onClick={() => setShowInsights(false)} className="text-amber-700 hover:text-amber-900 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-white p-3.5 rounded-xl border border-amber-200">
              <div className="text-gray-500 font-medium">Total Competitions</div>
              <div className="text-lg font-extrabold text-gray-900">{programs.length}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-amber-200">
              <div className="text-gray-500 font-medium">Total Registered Teams</div>
              <div className="text-lg font-extrabold text-gray-900">{teams.length}</div>
            </div>
            <div className="bg-white p-3.5 rounded-xl border border-amber-200">
              <div className="text-gray-500 font-medium">Total Active Assignments</div>
              <div className="text-lg font-extrabold text-emerald-700">{assignments.length}</div>
            </div>
          </div>
        </div>
      )}

      {isSelectionIncomplete ? (
        /* SCREENSHOT 1 STATE: Centered Selection Card Container */
        <div className="bg-white border border-gray-100 rounded-3xl p-12 shadow-2xs text-center min-h-[420px] flex items-center justify-center">
          <div className="max-w-md w-full mx-auto space-y-6">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Registrations</h2>
              <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
                Select category and team to manage participant assignments.
              </p>
            </div>

            <div className="space-y-3 text-left">
              {/* Category Dropdown */}
              <div className="relative">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-4 py-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-2xl appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs font-medium cursor-pointer"
                >
                  <option value="">Select Category</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat.code} value={cat.code}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Team Dropdown */}
              <div className="relative">
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  className="w-full px-4 py-3 text-sm text-gray-700 bg-white border border-gray-200 rounded-2xl appearance-none focus:outline-none focus:ring-2 focus:ring-amber-500 shadow-2xs font-medium cursor-pointer"
                >
                  <option value="">Select Team / Sector</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="text-xs text-gray-400 pt-2">
              Select both category and team above to view competition assignments table.
            </div>
          </div>
        </div>
      ) : (
        /* SCREENSHOT 2 STATE: Active Table View */
        <div className="bg-white border border-gray-100 rounded-3xl p-6 shadow-2xs space-y-6">
          {/* Top Controls Filter Row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-gray-50/70 p-3.5 rounded-2xl border border-gray-200/80">
            <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
              {/* Category Select */}
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs cursor-pointer"
              >
                <option value="">Select Category</option>
                {categoryOptions.map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.name}
                  </option>
                ))}
              </select>

              {/* Team Select */}
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs cursor-pointer"
              >
                <option value="">Select Team</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Status indicator */}
            <div className="flex items-center space-x-2 text-xs font-semibold text-emerald-700 bg-emerald-50/80 px-3 py-1.5 rounded-xl border border-emerald-200">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>{savingStatus}</span>
            </div>
          </div>

          {/* Clean Competitions Table */}
          <div className="overflow-hidden rounded-2xl border border-gray-100">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100">
                <thead className="bg-gray-50/70">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-700">
                      Competition
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-700">
                      Type
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-700">
                      Gender
                    </th>
                    <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-700">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredPrograms.length > 0 ? (
                    filteredPrograms.map((program) => {
                      const progAssignments = getAssignmentsForProgramAndTeam(program.id);
                      const isAssigned = progAssignments.length > 0;

                      return (
                        <tr key={program.id} className="hover:bg-indigo-50/40 transition-colors">
                          {/* Competition Info */}
                          <td className="px-6 py-4">
                            <div className="font-bold text-gray-900 text-xs sm:text-sm">
                              {program.name}
                              {program.team_size && program.team_size > 1 && (
                                <span className="text-gray-400 font-normal text-xs ml-1.5">
                                  ({program.team_size} members / team)
                                </span>
                              )}
                            </div>
                            {program.description && (
                              <div className="text-[11px] text-gray-400 mt-0.5">{program.description}</div>
                            )}
                          </td>

                          {/* Competition Type */}
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                              {program.is_team_based ? 'Group' : 'Individual'}
                            </span>
                          </td>

                          {/* Competition Gender */}
                          <td className="px-6 py-4 text-xs font-medium text-gray-700 capitalize whitespace-nowrap">
                            {program.gender || 'Male'}
                          </td>

                          {/* Action Column */}
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <button
                              onClick={() => {
                                setActiveDrawerProgram(program);
                                setDrawerSearch('');
                                setDrawerSubTeam(1);
                              }}
                              className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs inline-flex items-center space-x-1.5 cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isAssigned ? 'Manage Assignments' : 'Assign Members'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-6 py-12 text-center text-gray-400 text-xs">
                        No competitions found for this category.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Right-Side Slide-Over Member Assignment Drawer Modal */}
      {activeDrawerProgram && (() => {
        const drawerAssignments = getAssignmentsForProgramAndTeam(activeDrawerProgram.id);
        const drawerCategoryObj = categoryOptions.find(c => c.code === selectedCategory);
        const categoryLabel = drawerCategoryObj ? drawerCategoryObj.name : (selectedCategory?.toUpperCase() || 'Category');
        const isTeamProgram = activeDrawerProgram.is_team_based;
        const teamSize = activeDrawerProgram.team_size || 1;

        const teamsFromField = activeDrawerProgram.max_teams_per_school || 1;
        const teamsFromCap = (activeDrawerProgram.team_size && (activeDrawerProgram.max_participants_per_team || activeDrawerProgram.max_participants)) 
          ? Math.floor((activeDrawerProgram.max_participants_per_team || activeDrawerProgram.max_participants) / activeDrawerProgram.team_size) 
          : 1;
        const totalSubTeams = isTeamProgram ? Math.max(teamsFromField, teamsFromCap, 1) : 1;

        const maxLimit = !isTeamProgram ? activeDrawerProgram.max_participants : null;
        const isIndividualLimitReached = !isTeamProgram && maxLimit && drawerAssignments.length >= maxLimit;

        // Filter available team members for search (excluding already assigned members)
        const filteredDrawerMembers = teamMembers.filter(m => {
          // Exclude students who are already assigned to this competition
          const isAssigned = drawerAssignments.some(a => {
            const aStudentId = typeof a.student === 'object' && a.student !== null ? a.student.id : (a.student_id || a.student || a.student_details?.id);
            return aStudentId && parseInt(aStudentId, 10) === parseInt(m.id, 10);
          });
          if (isAssigned) return false;

          // Category check: General competitions allow students of any category to participate
          const progCat = activeDrawerProgram?.category;
          if (progCat && !isGeneralCategory(progCat)) {
            if (m.category && m.category.toLowerCase() !== progCat.toLowerCase()) {
              return false;
            }
          }

          if (!drawerSearch) return true;
          const searchLower = drawerSearch.toLowerCase();
          const mName = (m.get_full_name ? m.get_full_name() : (m.name || m.display_name || `${m.first_name || ''} ${m.last_name || ''}`)).toLowerCase();
          const mChest = (m.chest_number || m.chest_no || '').toString();
          const mCode = (m.code_letter || '').toLowerCase();
          return mName.includes(searchLower) || mChest.includes(searchLower) || mCode.includes(searchLower);
        });

        // Drawer Pagination calculations
        const totalAvailablePages = Math.ceil(filteredDrawerMembers.length / AVAILABLE_PAGE_SIZE) || 1;
        const paginatedAvailableMembers = filteredDrawerMembers.slice(
          (availablePage - 1) * AVAILABLE_PAGE_SIZE,
          availablePage * AVAILABLE_PAGE_SIZE
        );

        const totalAssignedIndividualPages = Math.ceil(drawerAssignments.length / ASSIGNED_INDIVIDUAL_PAGE_SIZE) || 1;
        const paginatedIndividualAssignments = drawerAssignments.slice(
          (assignedPage - 1) * ASSIGNED_INDIVIDUAL_PAGE_SIZE,
          assignedPage * ASSIGNED_INDIVIDUAL_PAGE_SIZE
        );

        const totalSubTeamPages = Math.ceil(totalSubTeams / ASSIGNED_SUBTEAM_PAGE_SIZE) || 1;
        const paginatedSubTeamNumbers = Array.from({ length: totalSubTeams })
          .map((_, idx) => idx + 1)
          .slice(
            (assignedPage - 1) * ASSIGNED_SUBTEAM_PAGE_SIZE,
            assignedPage * ASSIGNED_SUBTEAM_PAGE_SIZE
          );

        return (
          <div className="fixed inset-0 bg-black/35 backdrop-blur-xs flex justify-end z-50 overflow-hidden">
            <div className="w-full max-w-lg bg-white h-full shadow-2xl overflow-y-auto flex flex-col transition-transform duration-300 transform translate-x-0">
              
              {/* Modal Header */}
              <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div>
                  <h2 className="text-base font-bold text-gray-900 tracking-tight flex items-center space-x-2">
                    <BookOpen className="w-4 h-4 text-slate-700" />
                    <span>{activeDrawerProgram.name}</span>
                  </h2>
                  <div className="flex items-center space-x-2 text-xs text-gray-500 mt-1 font-medium">
                    <span className="font-semibold text-gray-800 bg-gray-100 px-2 py-0.5 rounded-md border border-gray-200/80">
                      {currentTeam?.name || 'Selected Team'}
                    </span>
                    <span>•</span>
                    <span>{categoryLabel}</span>
                    <span>•</span>
                    <span className="text-gray-600">
                      {isTeamProgram ? `Team (${totalSubTeams} Sub-Teams)` : `Individual (${maxLimit ? `Limit: ${maxLimit}` : 'Unlimited'})`}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setActiveDrawerProgram(null)}
                  className="p-1.5 text-gray-400 hover:text-gray-700 rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body Container */}
              <div className="p-4 sm:p-5 flex-1 overflow-y-auto space-y-5 bg-gray-50/40">

                {/* Drawer Alert Banner */}
                {drawerError && (
                  <div className="p-3 bg-red-50 border border-red-200/80 rounded-xl flex items-center justify-between text-xs text-red-800 font-semibold animate-in fade-in duration-200">
                    <div className="flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                      <span>{drawerError}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => setDrawerError('')}
                      className="p-1 hover:bg-red-100 rounded-md transition-colors text-red-500 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* SECTION 1: CURRENTLY ASSIGNED MEMBERS */}
                <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-2xs space-y-3">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-2.5">
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center space-x-1.5">
                      <Users className="w-3.5 h-3.5 text-slate-700" />
                      <span>Assigned Members</span>
                    </h3>
                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-gray-100 text-gray-700 border border-gray-200/80">
                      {drawerAssignments.length} {maxLimit ? `/ ${maxLimit} Max` : 'Total'}
                    </span>
                  </div>

                  {drawerAssignments.length === 0 ? (
                    <div className="py-5 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                      No members assigned to this competition yet.
                    </div>
                  ) : (
                    isTeamProgram ? (
                      /* Grouped by Sub-Teams for Team Events */
                      <div className="space-y-3">
                        {paginatedSubTeamNumbers.map((subNum) => {
                          const subMembers = drawerAssignments.filter(a => (a.sub_team_number ?? a.sub_team ?? 1) === subNum);
                          const hasLeader = subMembers.some(m => m.is_leader);

                          return (
                            <div key={subNum} className="border border-gray-200/80 rounded-2xl p-3 bg-white space-y-2.5 shadow-2xs">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-2">
                                  <span className="px-2.5 py-0.5 text-xs font-bold bg-indigo-600 text-white rounded-md">
                                    Sub-Team {subNum}
                                  </span>
                                  {hasLeader && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 rounded-md flex items-center space-x-1">
                                      <Crown className="w-3 h-3 text-amber-600 fill-amber-500" />
                                      <span>Leader Set</span>
                                    </span>
                                  )}
                                </div>
                                <span className="text-xs font-semibold text-gray-500">
                                  {subMembers.length} / {teamSize} Members
                                </span>
                              </div>

                              {subMembers.length === 0 ? (
                                <div className="text-[11px] text-gray-400 italic py-2 text-center">
                                  No members in Sub-Team {subNum}
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {subMembers.map(assignment => {
                                    const studentId = assignment.student || assignment.student_id || assignment.student_details?.id;
                                    const studentObj = students.find(s => s.id === studentId);
                                    const studentName = assignment.student_name || assignment.student_details?.name || studentObj?.name || (studentObj?.first_name ? `${studentObj.first_name} ${studentObj.last_name || ''}`.trim() : '') || 'Assigned Student';
                                    const chestNo = assignment.chest_number || assignment.student_details?.chest_number || studentObj?.chest_number;
                                    const isLeader = assignment.is_leader || studentObj?.is_leader;

                                    return (
                                      <div key={assignment.id} className="p-2.5 bg-gray-50/60 rounded-xl border border-gray-200/60 flex items-center justify-between text-xs hover:border-gray-300 transition-colors">
                                        <div className="flex items-center space-x-2">
                                          <span className="font-bold text-gray-900">{studentName}</span>
                                          {chestNo && <span className="text-[11px] text-gray-500 font-medium">(#{chestNo})</span>}
                                          {isLeader && (
                                            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-indigo-600 text-white rounded flex items-center space-x-0.5">
                                              <Crown className="w-2.5 h-2.5 text-amber-400 fill-amber-400" />
                                              <span>LEADER</span>
                                            </span>
                                          )}
                                        </div>

                                        <div className="flex items-center space-x-1.5">
                                          {!isLeader ? (
                                            <button
                                              type="button"
                                              onClick={() => handleSetLeader(activeDrawerProgram.id, studentId, subNum)}
                                              className="px-2 py-1 text-[10px] font-semibold text-gray-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg border border-gray-200 hover:border-amber-200 transition-colors flex items-center space-x-1 cursor-pointer"
                                            >
                                              <Crown className="w-3 h-3 text-gray-400" />
                                              <span>Make Leader</span>
                                            </button>
                                          ) : null}

                                          <button
                                            type="button"
                                            onClick={() => handleRemoveAssignment(activeDrawerProgram.id, studentId)}
                                            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                            title="Remove"
                                          >
                                            <UserMinus className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Sub-Teams Pagination Controls */}
                        {totalSubTeamPages > 1 && (
                          <div className="flex items-center justify-between pt-1.5 text-xs text-gray-500 font-medium">
                            <span>Sub-Teams {(assignedPage - 1) * ASSIGNED_SUBTEAM_PAGE_SIZE + 1} - {Math.min(assignedPage * ASSIGNED_SUBTEAM_PAGE_SIZE, totalSubTeams)} of {totalSubTeams}</span>
                            <div className="flex items-center space-x-1.5">
                              <button
                                type="button"
                                disabled={assignedPage === 1}
                                onClick={() => setAssignedPage(p => p - 1)}
                                className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                disabled={assignedPage >= totalSubTeamPages}
                                onClick={() => setAssignedPage(p => p + 1)}
                                className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : (
                      /* Flat List for Single/Individual Events */
                      <div className="space-y-2">
                        {paginatedIndividualAssignments.map(assignment => {
                          const studentId = assignment.student || assignment.student_id || assignment.student_details?.id;
                          const studentObj = students.find(s => s.id === studentId);
                          const studentName = assignment.student_name || assignment.student_details?.name || studentObj?.name || (studentObj?.first_name ? `${studentObj.first_name} ${studentObj.last_name || ''}`.trim() : '') || 'Assigned Student';
                          const chestNo = assignment.chest_number || assignment.student_details?.chest_number || studentObj?.chest_number;

                          return (
                            <div key={assignment.id} className="p-2.5 bg-gray-50/60 rounded-xl border border-gray-200/60 flex items-center justify-between text-xs">
                              <div>
                                <div className="font-bold text-gray-900">{studentName}</div>
                                {chestNo && <div className="text-[11px] text-gray-500 font-medium mt-0.5">Chest #{chestNo}</div>}
                              </div>

                              <button
                                type="button"
                                onClick={() => handleRemoveAssignment(activeDrawerProgram.id, studentId)}
                                className="px-2.5 py-1 text-xs font-semibold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg border border-red-200 transition-colors inline-flex items-center space-x-1 cursor-pointer"
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                                <span>Remove</span>
                              </button>
                            </div>
                          );
                        })}

                        {/* Individual Assigned Pagination Controls */}
                        {totalAssignedIndividualPages > 1 && (
                          <div className="flex items-center justify-between pt-1.5 text-xs text-gray-500 font-medium">
                            <span>Page {assignedPage} of {totalAssignedIndividualPages}</span>
                            <div className="flex items-center space-x-1.5">
                              <button
                                type="button"
                                disabled={assignedPage === 1}
                                onClick={() => setAssignedPage(p => p - 1)}
                                className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                              >
                                Previous
                              </button>
                              <button
                                type="button"
                                disabled={assignedPage >= totalAssignedIndividualPages}
                                onClick={() => setAssignedPage(p => p + 1)}
                                className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  )}
                </div>

                {/* SECTION 2: AVAILABLE TEAM MEMBERS TO ASSIGN */}
                <div className="bg-white rounded-2xl p-4 border border-gray-200/80 shadow-2xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-2.5">
                    <h3 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center space-x-1.5">
                      <UserPlus className="w-3.5 h-3.5 text-slate-700" />
                      <span>Available Team Members ({filteredDrawerMembers.length})</span>
                    </h3>

                    {isTeamProgram && (
                      /* Target Sub-Team Selector Bar */
                      <div className="flex items-center space-x-1 bg-gray-100/80 p-0.5 rounded-lg border border-gray-200/60">
                        <span className="text-[10px] font-semibold text-gray-500 px-1">Target:</span>
                        {Array.from({ length: totalSubTeams }).map((_, idx) => {
                          const subNum = idx + 1;
                          const isSel = drawerSubTeam === subNum;
                          return (
                            <button
                              key={subNum}
                              type="button"
                              onClick={() => {
                                setDrawerSubTeam(subNum);
                                setAvailablePage(1);
                              }}
                              className={`px-2 py-0.5 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                                isSel ? 'bg-indigo-600 text-white shadow-2xs' : 'bg-white text-gray-700 hover:bg-gray-50'
                              }`}
                            >
                              Sub-Team {subNum}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Minimal Compact Search Bar */}
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search student name or chest number..."
                      value={drawerSearch}
                      onChange={(e) => {
                        setDrawerSearch(e.target.value);
                        setAvailablePage(1);
                      }}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900 font-medium"
                    />
                    <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  </div>

                  {/* Available Members List */}
                  <div className="space-y-2">
                    {paginatedAvailableMembers.length > 0 ? (
                      paginatedAvailableMembers.map((student) => {
                        const currentSubTeamCount = isTeamProgram
                          ? drawerAssignments.filter(a => (a.sub_team_number ?? a.sub_team ?? 1) === drawerSubTeam).length
                          : 0;
                        const isSubTeamFull = isTeamProgram && teamSize > 0 && currentSubTeamCount >= teamSize;

                        // Find alternative sub-team if selected sub-team is full
                        let altSubTeam = null;
                        if (isTeamProgram && isSubTeamFull) {
                          for (let sNum = 1; sNum <= totalSubTeams; sNum++) {
                            const count = drawerAssignments.filter(a => (a.sub_team_number ?? a.sub_team ?? 1) === sNum).length;
                            if (count < teamSize) {
                              altSubTeam = sNum;
                              break;
                            }
                          }
                        }

                        const chestNo = student.chest_number || student.chest_no;
                        const studentName = student.get_full_name 
                          ? student.get_full_name() 
                          : (student.name || student.display_name || `${student.first_name || ''} ${student.last_name || ''}`.trim() || `Student #${student.id}`);
                        const initialLetter = studentName.charAt(0).toUpperCase() || 'S';

                        return (
                          <div
                            key={student.id}
                            className="p-3 rounded-xl border border-gray-200/80 bg-white hover:border-gray-300 flex items-center justify-between transition-colors shadow-2xs gap-3"
                          >
                            <div className="flex items-center space-x-3 min-w-0">
                              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-800 flex items-center justify-center font-extrabold text-xs shrink-0 border border-slate-200/60">
                                {initialLetter}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-gray-900 truncate">
                                  {studentName}
                                </div>
                                <div className="text-[11px] text-gray-500 font-medium flex items-center space-x-1.5 mt-0.5">
                                  {chestNo && <span className="font-semibold text-slate-700">#{chestNo}</span>}
                                  {chestNo && <span>•</span>}
                                  <span>Cat: {student.category?.toUpperCase() || 'General'}</span>
                                  {student.grade && <span>• Class {student.grade}</span>}
                                </div>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isSubTeamFull ? (
                                altSubTeam ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setDrawerSubTeam(altSubTeam);
                                      handleAssignStudent(activeDrawerProgram.id, student.id, altSubTeam);
                                    }}
                                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs inline-flex items-center space-x-1 cursor-pointer"
                                  >
                                    <UserPlus className="w-3.5 h-3.5" />
                                    <span>Assign to Sub-{altSubTeam}</span>
                                  </button>
                                ) : (
                                  <div className="px-2.5 py-1.5 bg-gray-100 text-gray-500 border border-gray-200 text-xs font-semibold rounded-xl inline-flex items-center space-x-1">
                                    <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
                                    <span>Sub-Teams Full</span>
                                  </div>
                                )
                              ) : isIndividualLimitReached ? (
                                <div className="px-2.5 py-1.5 bg-gray-100 text-gray-500 border border-gray-200 text-xs font-semibold rounded-xl inline-flex items-center space-x-1">
                                  <AlertCircle className="w-3.5 h-3.5 text-gray-400" />
                                  <span>Limit Reached ({maxLimit})</span>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleAssignStudent(activeDrawerProgram.id, student.id, isTeamProgram ? drawerSubTeam : 1)}
                                  className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-2xs inline-flex items-center space-x-1 cursor-pointer"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  <span>{isTeamProgram ? `Assign to Sub-${drawerSubTeam}` : 'Assign'}</span>
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-6 text-center text-xs text-gray-400 bg-gray-50/50 border border-gray-200/60 rounded-xl">
                        {drawerSearch 
                          ? 'No matching students found.'
                          : `No students registered under ${currentTeam?.name || 'this team'}.`
                        }
                      </div>
                    )}
                  </div>

                  {/* Available Members Pagination Controls */}
                  {totalAvailablePages > 1 && (
                    <div className="flex items-center justify-between pt-2 border-t border-gray-100 text-xs text-gray-500 font-medium">
                      <span>Page {availablePage} of {totalAvailablePages} ({filteredDrawerMembers.length} students)</span>
                      <div className="flex items-center space-x-1.5">
                        <button
                          type="button"
                          disabled={availablePage === 1}
                          onClick={() => setAvailablePage(p => p - 1)}
                          className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                        >
                          Previous
                        </button>
                        <button
                          type="button"
                          disabled={availablePage >= totalAvailablePages}
                          onClick={() => setAvailablePage(p => p + 1)}
                          className="px-2.5 py-1 bg-white border border-gray-200 rounded-lg text-xs font-semibold hover:bg-gray-50 disabled:opacity-40 cursor-pointer shadow-2xs"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>

              </div>

              {/* Modal Footer */}
              <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between sticky bottom-0 z-10">
                <span className="text-xs text-gray-400 font-medium">
                  All changes saved automatically
                </span>
                <button
                  type="button"
                  onClick={() => setActiveDrawerProgram(null)}
                  className="px-5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Done
                </button>
              </div>

            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default EventAssignments;
