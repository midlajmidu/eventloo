import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { teamManagerAPI, categoriesAPI } from '../../services/api';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  ArrowLeft,
  Trophy,
  UserPlus,
  AlertCircle,
  X,
  Target,
  CheckCircle2,
  Search,
  Filter,
  Tag,
  Check,
  RotateCcw,
  UserCheck,
  Crown,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

const TeamEventDetail = ({ eventId: propEventId, embedded = false }) => {
  const { eventId: paramEventId } = useParams();
  const eventId = propEventId || paramEventId;
  const navigate = useNavigate();
  const [eventData, setEventData] = useState(null);
  const [programs, setPrograms] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTeam, setSelectedTeam] = useState(null);
  const [assigningStudent, setAssigningStudent] = useState(null);
  const [removingAssignment, setRemovingAssignment] = useState(null);

  // Filter states
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');

  const isDeadlinePassed = useMemo(() => {
    if (!eventData?.registration_deadline) return false;
    return new Date(eventData.registration_deadline) < new Date();
  }, [eventData?.registration_deadline]);

  const registrationLocked = useMemo(() => {
    if (!eventData) return false;
    if (eventData.status === 'completed' || eventData.status === 'archived') return true;
    return Boolean(isDeadlinePassed);
  }, [eventData, isDeadlinePassed]);

  // Quick assign slide-over drawer states
  const [activeModalProgram, setActiveModalProgram] = useState(null);
  const [modalSelectedStudent, setModalSelectedStudent] = useState('');
  const [modalSelectedStudents, setModalSelectedStudents] = useState([]);
  const [modalSelectedLeader, setModalSelectedLeader] = useState(null);
  const [modalSelectedSubTeam, setModalSelectedSubTeam] = useState(1);
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [modalStudentSearch, setModalStudentSearch] = useState('');
  const [drawerGradeFilter, setDrawerGradeFilter] = useState('all');
  const [drawerSectionFilter, setDrawerSectionFilter] = useState('all');
  const [drawerGenderFilter, setDrawerGenderFilter] = useState('all');
  const [drawerHideLimitReached, setDrawerHideLimitReached] = useState(false);

  const openAssignDrawer = (program) => {
    setActiveModalProgram(program);
    setModalSelectedStudent('');
    setModalSelectedStudents([]);
    setModalSelectedLeader(null);
    setModalStudentSearch('');
    setDrawerGradeFilter('all');
    setDrawerSectionFilter('all');
    setDrawerGenderFilter('all');
    setDrawerHideLimitReached(false);

    if (program.is_team_based) {
      const assigned = program.assigned_students || [];
      const teamSize = program.team_size || program.per_team_limit || 4;
      const subTeamsMap = {};
      assigned.forEach((st) => {
        const sub = st.sub_team_number || 1;
        subTeamsMap[sub] = (subTeamsMap[sub] || 0) + 1;
      });
      const maxSubTeams = Math.max(
        1,
        program.max_teams_per_school || Math.floor((program.per_team_limit || teamSize) / teamSize) || 1
      );
      let targetSubTeam = 1;
      for (let s = 1; s <= maxSubTeams; s++) {
        if ((subTeamsMap[s] || 0) < teamSize) {
          targetSubTeam = s;
          break;
        }
      }
      setModalSelectedSubTeam(targetSubTeam);
    } else {
      setModalSelectedSubTeam(1);
    }
  };

  const closeAssignDrawer = () => {
    setActiveModalProgram(null);
    setModalSelectedStudent('');
    setModalSelectedStudents([]);
    setModalSelectedLeader(null);
    setModalSelectedSubTeam(1);
    setModalStudentSearch('');
    setDrawerGradeFilter('all');
    setDrawerSectionFilter('all');
    setDrawerGenderFilter('all');
    setDrawerHideLimitReached(false);
  };

  const handleClearDrawerFilters = () => {
    setModalStudentSearch('');
    setDrawerGradeFilter('all');
    setDrawerSectionFilter('all');
    setDrawerGenderFilter('all');
    setDrawerHideLimitReached(false);
  };

  // Close drawer on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && activeModalProgram) {
        closeAssignDrawer();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeModalProgram]);

  useEffect(() => {
    fetchEventData();
  }, [eventId]);

  const fetchEventData = async () => {
    try {
      setLoading(true);

      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      if (!teamData || (!teamData.id && !teamData.team_id)) {
        setError('No team data found. Please login again.');
        return;
      }

      const teamId = teamData.id || teamData.team_id;
      setSelectedTeam({ ...teamData, id: teamId });

      const [response, catRes] = await Promise.all([
        teamManagerAPI.getEventPrograms(teamId, eventId),
        categoriesAPI.list().catch((err) => {
          console.warn('Failed to load categories:', err);
          return { data: [] };
        })
      ]);

      const catList = catRes?.data?.results || catRes?.data || [];
      setCategories(Array.isArray(catList) ? catList : []);

      if (response.data) {
        if (response.data.results) {
          const resultData = response.data.results;
          setEventData(resultData.event);
          setPrograms(resultData.programs || []);
          setTeamMembers(resultData.team_members || []);
        } else {
          setEventData(response.data.event);
          setPrograms(response.data.programs || []);
          setTeamMembers(response.data.team_members || []);
        }
      }
    } catch (err) {
      console.error('Error fetching event data:', err);
      setError('Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignStudent = async (programId, studentId) => {
    if (!studentId) return;
    const member = teamMembers.find((m) => m.id === studentId);
    if (member && activeModalProgram) {
      if (!isCategoryAllowedForProgram(member.category, activeModalProgram.category)) {
        alert(`${member.name} is not eligible for the ${getCategoryDisplay(activeModalProgram.category)} category.`);
        return;
      }
      const limitCheck = checkStudentLimitForProgram(member, activeModalProgram);
      if (limitCheck.reached) {
        alert(limitCheck.reason || `${member.name} has reached the participation limit for this program.`);
        return;
      }
    }
    try {
      setAssigningStudent({ programId, studentId });

      await teamManagerAPI.assignStudentToProgram(
        selectedTeam.id,
        eventId,
        programId,
        studentId
      );

      closeAssignDrawer();
      await fetchEventData();
    } catch (err) {
      console.error('Error assigning student:', err);
      alert(err.response?.data?.error || err.response?.data?.message || err.response?.data?.detail || 'Failed to assign student');
    } finally {
      setAssigningStudent(null);
    }
  };

  const handleAssignTeam = async (programId, studentIds, subTeamNumber, leaderId) => {
    if (!studentIds || studentIds.length === 0) return;
    if (activeModalProgram && Array.isArray(studentIds)) {
      for (const sId of studentIds) {
        const member = teamMembers.find((m) => m.id === sId);
        if (member) {
          const limitCheck = checkStudentLimitForProgram(member, activeModalProgram);
          if (limitCheck.reached) {
            alert(limitCheck.reason || `${member.name} has reached the participation limit.`);
            return;
          }
        }
      }
    }
    try {
      setAssigningStudent({ programId, studentId: 'team' });
      await teamManagerAPI.assignStudentsToProgram(
        selectedTeam.id,
        eventId,
        programId,
        studentIds,
        subTeamNumber,
        leaderId
      );
      closeAssignDrawer();
      await fetchEventData();
    } catch (err) {
      console.error('Error assigning team:', err);
      alert(err.response?.data?.error || err.response?.data?.message || err.response?.data?.detail || 'Failed to assign team');
    } finally {
      setAssigningStudent(null);
    }
  };

  const handleRemoveAssignment = async (assignmentId, isTeam = false, teamName = '') => {
    const confirmMessage = isTeam
      ? `Are you sure you want to remove ${teamName || 'this team'} and all its members from this program?`
      : 'Are you sure you want to remove this student from the program?';
    if (!window.confirm(confirmMessage)) return;
    try {
      setRemovingAssignment(assignmentId);
      await teamManagerAPI.removeAssignmentById(selectedTeam.id, assignmentId);
      await fetchEventData();
    } catch (err) {
      console.error('Error removing assignment:', err);
      alert(err.response?.data?.error || 'Failed to remove assignment');
    } finally {
      setRemovingAssignment(null);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'published':
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'ongoing':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'completed':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'draft':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getCategoryDisplay = (code) => {
    if (!code) return 'General';
    const found = categories.find(
      (c) => c.code?.toLowerCase() === code.toLowerCase() || c.name?.toLowerCase() === code.toLowerCase()
    );
    if (found?.name) return found.name;
    const map = {
      lp: 'Lower Primary',
      up: 'Upper Primary',
      hs: 'High School',
      hss: 'Higher Secondary',
      junior: 'Junior',
      senior: 'Senior',
      general: 'General',
    };
    return map[code.toLowerCase()] || code.toUpperCase();
  };

  const getCategoryBadge = (_category) => {
    return 'bg-slate-100 text-slate-700 border-slate-200/80';
  };

  // Available distinct categories in this event with counts
  const eventCategories = useMemo(() => {
    const counts = {};
    programs.forEach((p) => {
      const code = (p.category || 'general').toLowerCase();
      counts[code] = (counts[code] || 0) + 1;
    });

    const list = [];
    const processedCodes = new Set();

    // From school categories that are present in this event
    categories.forEach((cat) => {
      const codeLower = (cat.code || '').toLowerCase();
      const nameLower = (cat.name || '').toLowerCase();
      let count = 0;
      if (counts[codeLower]) {
        count += counts[codeLower];
        processedCodes.add(codeLower);
      }
      if (nameLower !== codeLower && counts[nameLower]) {
        count += counts[nameLower];
        processedCodes.add(nameLower);
      }
      if (count > 0) {
        list.push({
          code: cat.code,
          name: cat.name,
          count
        });
      }
    });

    // Any remaining categories in programs not in official categories list
    Object.keys(counts).forEach((code) => {
      if (!processedCodes.has(code)) {
        list.push({
          code: code,
          name: getCategoryDisplay(code),
          count: counts[code]
        });
      }
    });

    return list;
  }, [programs, categories]);

  // Available distinct grades & sections for drawer filtering
  const availableGrades = useMemo(() => {
    const grades = new Set();
    teamMembers.forEach((m) => {
      if (m.grade !== null && m.grade !== undefined && m.grade !== '') {
        grades.add(String(m.grade));
      }
    });
    return Array.from(grades).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [teamMembers]);

  const availableSections = useMemo(() => {
    const sections = new Set();
    teamMembers.forEach((m) => {
      if (m.section) {
        sections.add(String(m.section).trim().toUpperCase());
      }
    });
    return Array.from(sections).sort();
  }, [teamMembers]);

  // Check if a student's category is allowed for a program
  const isCategoryAllowedForProgram = (studentCategory, programCategory) => {
    if (!programCategory) return true;
    const progCatLower = (programCategory || '').trim().toLowerCase();
    if (['general', 'gen', 'gn', 'open'].includes(progCatLower)) {
      return true;
    }
    const stuCatLower = (studentCategory || '').trim().toLowerCase();
    if (!stuCatLower) return false;

    if (stuCatLower === progCatLower) return true;

    const matchedCat = categories.find(
      (c) =>
        c.code?.toLowerCase() === progCatLower ||
        c.name?.toLowerCase() === progCatLower
    );

    if (matchedCat) {
      if (
        matchedCat.code?.toLowerCase() === stuCatLower ||
        matchedCat.name?.toLowerCase() === stuCatLower
      ) {
        return true;
      }
      if (matchedCat.is_mixing) {
        const mixedCodes = (matchedCat.mixed_category_codes || []).map((c) => c.toLowerCase());
        const mixedIds = matchedCat.mixed_category_ids || [];
        const mixedCats = categories.filter(
          (c) => mixedIds.includes(c.id) || mixedCodes.includes(c.code?.toLowerCase())
        );
        const allAllowed = new Set([
          matchedCat.code?.toLowerCase(),
          matchedCat.name?.toLowerCase(),
          ...mixedCodes,
          ...mixedCats.map((c) => c.code?.toLowerCase()),
          ...mixedCats.map((c) => c.name?.toLowerCase()),
        ]);
        return allAllowed.has(stuCatLower);
      }
    }

    return false;
  };

  // Helper to determine if a program is General or Mixed category
  const isProgramGeneralOrMixed = (program) => {
    if (!program) return false;
    const cat = (program.category || '').trim().toLowerCase();
    if (['general', 'gen', 'gn', 'open', 'open category'].includes(cat)) {
      return true;
    }
    const matched = categories.find(
      (c) => c.code?.toLowerCase() === cat || c.name?.toLowerCase() === cat
    );
    return Boolean(matched?.is_mixing);
  };

  // Get student's single, group, onstage, offstage, and total program participation counts in this event
  const getStudentProgramStats = (member) => {
    if (!member) {
      return {
        singleCount: 0,
        groupCount: 0,
        onstageCount: 0,
        offstageCount: 0,
        totalCount: 0,
        byType: {},
      };
    }

    let sc = 0;
    let gc = 0;
    let onstage = 0;
    let offstage = 0;
    const byType = {};

    programs.forEach((prog) => {
      const isAssigned = (prog.assigned_students || []).some(
        (s) => s.id === member.id || s.student_id === member.student_id
      );
      if (isAssigned) {
        if (!isProgramGeneralOrMixed(prog)) {
          if (prog.is_team_based) {
            gc += 1;
          } else {
            sc += 1;
          }
          const pTypeRaw = prog.program_type || 'stage';
          const normType = pTypeRaw.toLowerCase().replace(/[\s-]/g, '_');
          byType[normType] = (byType[normType] || 0) + 1;

          if (normType === 'stage' || normType === 'onstage' || normType === 'on_stage') {
            onstage += 1;
          } else if (normType === 'off_stage' || normType === 'offstage') {
            offstage += 1;
          }
        }
      }
    });

    return {
      singleCount: sc,
      groupCount: gc,
      onstageCount: onstage,
      offstageCount: offstage,
      totalCount: sc + gc,
      byType,
    };
  };

  // Get student's category limits from eventData
  const getStudentCategoryLimits = (categoryCode) => {
    if (!eventData) return null;
    const catLimitsMap = eventData.category_participation_limits || {};
    const norm = (categoryCode || '').trim().toLowerCase();

    let limits = catLimitsMap[categoryCode] || null;
    if (!limits && norm) {
      for (const [k, v] of Object.entries(catLimitsMap)) {
        if (k.trim().toLowerCase() === norm) {
          limits = v;
          break;
        }
      }
    }

    const maxSingle = limits?.max_single !== undefined ? limits.max_single : (eventData.max_single_programs_per_student || 0);
    const maxGroup = limits?.max_group !== undefined ? limits.max_group : (eventData.max_group_programs_per_student || 0);
    const maxTotal = limits?.max_total !== undefined ? limits.max_total : 0;
    const maxOnstage = limits?.max_onstage !== undefined ? limits.max_onstage : 0;
    const maxOffstage = limits?.max_offstage !== undefined ? limits.max_offstage : 0;
    const typeLimits = limits?.type_limits || {};

    return {
      maxTotal: Number(maxTotal) || 0,
      maxOnstage: Number(maxOnstage) || 0,
      maxOffstage: Number(maxOffstage) || 0,
      maxSingle: Number(maxSingle) || 0,
      maxGroup: Number(maxGroup) || 0,
      typeLimits,
    };
  };

  // Check whether a student has reached any participation limit for this program in this event
  const checkStudentLimitForProgram = (member, program) => {
    if (!member || !program || !eventData) return { reached: false };
    // General and combined/mixing programs are unlimited!
    if (isProgramGeneralOrMixed(program)) return { reached: false };

    const limits = getStudentCategoryLimits(member.category);
    if (!limits) return { reached: false };

    const stats = getStudentProgramStats(member);
    const isTeam = Boolean(program.is_team_based);
    const pTypeRaw = program.program_type || 'stage';
    const normType = pTypeRaw.toLowerCase().replace(/[\s-]/g, '_');

    // 1. Total Limit
    if (limits.maxTotal > 0 && stats.totalCount >= limits.maxTotal) {
      return {
        reached: true,
        limitType: 'total',
        reason: `${member.name} has reached the total limit of ${limits.maxTotal} programs.`,
      };
    }

    // 2. Dynamic Program Type Limit (supports ANY custom type, with fallback to onstage/offstage)
    let dynamicTypeLimit = 0;
    if (limits.typeLimits && limits.typeLimits[normType] !== undefined) {
      dynamicTypeLimit = Number(limits.typeLimits[normType]) || 0;
    } else if (normType === 'stage' || normType === 'onstage' || normType === 'on_stage') {
      dynamicTypeLimit = limits.maxOnstage;
    } else if (normType === 'off_stage' || normType === 'offstage') {
      dynamicTypeLimit = limits.maxOffstage;
    }

    const currentTypeCount = stats.byType[normType] || 0;
    if (dynamicTypeLimit > 0 && currentTypeCount >= dynamicTypeLimit) {
      const typeDisplayName = program.program_type_display || program.program_type || normType;
      return {
        reached: true,
        limitType: normType,
        reason: `${member.name} has reached the ${typeDisplayName} limit of ${dynamicTypeLimit} programs.`,
      };
    }

    // 3. Single Limit
    if (!isTeam && limits.maxSingle > 0 && stats.singleCount >= limits.maxSingle) {
      return {
        reached: true,
        limitType: 'single',
        reason: `${member.name} has reached the single events limit of ${limits.maxSingle} programs.`,
      };
    }

    // 4. Group Limit
    if (isTeam && limits.maxGroup > 0 && stats.groupCount >= limits.maxGroup) {
      return {
        reached: true,
        limitType: 'group',
        reason: `${member.name} has reached the group events limit of ${limits.maxGroup} programs.`,
      };
    }

    return { reached: false };
  };

  // Legacy boolean helper
  const isStudentLimitReached = (member, program) => {
    return checkStudentLimitForProgram(member, program).reached;
  };

  // Count how many programs each student is currently enrolled in
  const studentParticipationCounts = useMemo(() => {
    const counts = {};
    programs.forEach((prog) => {
      (prog.assigned_students || []).forEach((st) => {
        const id = st.id || st.student_id;
        if (id) {
          counts[id] = (counts[id] || 0) + 1;
        }
      });
    });
    return counts;
  }, [programs]);

  // Filtered programs based on category, search, slot status, and type
  const filteredPrograms = useMemo(() => {
    return programs.filter((program) => {
      // 1. Category filter
      if (selectedCategoryFilter !== 'all') {
        const progCat = (program.category || '').toLowerCase();
        const targetCat = selectedCategoryFilter.toLowerCase();
        const matched =
          progCat === targetCat ||
          categories.find((c) => c.code.toLowerCase() === targetCat)?.name.toLowerCase() === progCat ||
          categories.find((c) => c.name.toLowerCase() === targetCat)?.code.toLowerCase() === progCat;
        if (!matched) return false;
      }

      // 2. Search query filter
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        const matchesName = program.name?.toLowerCase().includes(q);
        const matchesDesc = program.description?.toLowerCase().includes(q);
        const catName = getCategoryDisplay(program.category).toLowerCase();
        const matchesCat = catName.includes(q) || (program.category || '').toLowerCase().includes(q);
        if (!matchesName && !matchesDesc && !matchesCat) return false;
      }

      // 3. Status filter
      const assignedList = program.assigned_students || [];
      const maxAllowed = program.per_team_limit || (program.is_team_based ? 4 : 1);
      const isFull = program.available_slots === 0 || assignedList.length >= maxAllowed;

      if (statusFilter === 'vacant' && isFull) return false;
      if (statusFilter === 'filled' && !isFull) return false;

      // 4. Type filter
      if (typeFilter === 'team' && !program.is_team_based) return false;
      if (typeFilter === 'individual' && program.is_team_based) return false;

      return true;
    });
  }, [programs, selectedCategoryFilter, searchTerm, statusFilter, typeFilter, categories]);

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 mx-auto" />
          <p className="mt-3 text-sm font-medium text-slate-500">Loading festival details...</p>
        </div>
      </div>
    );
  }

  if (error || !eventData) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb] px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">{error || 'Event not found'}</h2>
          <button
            type="button"
            onClick={() => navigate('/team-manager/events')}
            className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            ← Back to Events
          </button>
        </div>
      </div>
    );
  }

  const renderAssignedMembers = (program) => {
    const assignedList = program.assigned_students || [];
    if (assignedList.length === 0) {
      return <span className="text-xs text-slate-400 italic">No students assigned</span>;
    }

    if (!program.is_team_based) {
      return (
        <div className="flex flex-wrap gap-1.5 max-w-xs">
          {assignedList.map((st) => (
            <span
              key={st.id || st.student_id || st.assignment_id}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-800"
            >
              <span className="truncate max-w-[100px]">{st.name}</span>
              {!registrationLocked && (
                <button
                  type="button"
                  onClick={() => handleRemoveAssignment(st.assignment_id, false, st.name)}
                  disabled={removingAssignment === st.assignment_id}
                  className="text-slate-400 hover:text-rose-600 transition-colors p-0.5"
                  title="Remove student"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </span>
          ))}
        </div>
      );
    }

    // Team-based program: group by sub_team_number
    const subTeamsMap = {};
    assignedList.forEach((st) => {
      const subNum = st.sub_team_number || 1;
      if (!subTeamsMap[subNum]) subTeamsMap[subNum] = [];
      subTeamsMap[subNum].push(st);
    });

    const subTeamNumbers = Object.keys(subTeamsMap).map(Number).sort((a, b) => a - b);

    return (
      <div className="flex flex-col gap-1.5 max-w-xs">
        {subTeamNumbers.map((subNum) => {
          const members = subTeamsMap[subNum];
          const leader = members.find((m) => m.is_leader) || members[0];
          const teamLabel = leader ? `${leader.name} & Team` : `Team ${subNum}`;
          const isExpanded = expandedTeamId === `${program.id}-${subNum}`;
          const toggleExpand = () => {
            setExpandedTeamId(isExpanded ? null : `${program.id}-${subNum}`);
          };

          return (
            <div
              key={subNum}
              className="rounded-lg border border-indigo-200/80 bg-indigo-50/60 p-1.5 transition-colors"
            >
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={toggleExpand}
                  className="inline-flex items-center gap-1 text-left text-xs font-semibold text-slate-800 hover:text-indigo-600 transition-colors truncate flex-1"
                  title="Click to view all team members"
                >
                  <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <span className="truncate max-w-[130px]">{teamLabel}</span>
                  <span className="rounded-full bg-indigo-100 px-1.5 py-0.2 text-[10px] font-medium text-indigo-700 shrink-0">
                    {members.length} {members.length === 1 ? 'member' : 'members'}
                  </span>
                  {isExpanded ? (
                    <ChevronUp className="h-3 w-3 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronDown className="h-3 w-3 text-slate-400 shrink-0" />
                  )}
                </button>

                {!registrationLocked && leader?.assignment_id && (
                  <button
                    type="button"
                    onClick={() => handleRemoveAssignment(leader.assignment_id, true, teamLabel)}
                    disabled={removingAssignment === leader.assignment_id}
                    className="rounded p-0.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition-colors shrink-0"
                    title={`Remove ${teamLabel}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              {/* Expandable Member List */}
              {isExpanded && (
                <div className="mt-1.5 border-t border-indigo-100 pt-1.5 flex flex-wrap gap-1">
                  {members.map((m) => (
                    <span
                      key={m.id || m.student_id}
                      className="inline-flex items-center gap-1 rounded bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-700 border border-slate-200/60 shadow-2xs"
                    >
                      {m.is_leader && <Crown className="h-2.5 w-2.5 text-amber-500 shrink-0" />}
                      <span className="truncate max-w-[90px]">{m.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className={embedded ? 'p-3 sm:p-5' : 'min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8'}>
      <div className={embedded ? 'w-full' : 'mx-auto max-w-7xl'}>
        {/* ========================================================================= */}
        {/* 1. BACK NAVIGATION & HEADER (Only shown in non-embedded mode) */}
        {/* ========================================================================= */}
        {!embedded && (
          <>
            <div className="mb-4">
              <button
                onClick={() => navigate('/team-manager/events')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                <span>Back to Events</span>
              </button>
            </div>

            <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
                  Event Details & Roster
                </p>
                <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                  {eventData.title}
                </h1>
                <p className="text-xs text-slate-400 mt-1 font-normal">
                  {eventData.description || 'Program items and allocated team roster.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusBadge(
                    eventData.status
                  )}`}
                >
                  {eventData.status || 'Active'}
                </span>
                {selectedTeam && (
                  <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs">
                    <Users className="h-3.5 w-3.5 text-indigo-600" />
                    <span>{selectedTeam.name}</span>
                  </div>
                )}
              </div>
            </header>
          </>
        )}

        {/* Notices */}
        {isDeadlinePassed && (
          <div className="mt-4 flex items-center gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-xs font-medium text-rose-800">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>
              Registration deadline has passed ({new Date(eventData.registration_deadline).toLocaleDateString()}). Team entries are now locked.
            </span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* 2. EVENT METRICS BAR */}
        {/* ========================================================================= */}
        <section className="mt-4 sm:mt-5 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
              <Calendar className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">
                {eventData.start_date ? new Date(eventData.start_date).toLocaleDateString() : 'TBA'}
                {eventData.end_date && eventData.end_date !== eventData.start_date && (
                  <> – {new Date(eventData.end_date).toLocaleDateString()}</>
                )}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Date & Schedule</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
              <Clock className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">{eventData.start_time || 'Schedule Announced'}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Timing</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-semibold text-slate-900">{eventData.venue || 'Campus Venue TBA'}</p>
              <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Location</p>
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. CATEGORY TABS & FILTER BAR */}
        {/* ========================================================================= */}
        <section className="mt-6 space-y-3">
          {/* Category Tabs Pill Bar */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-4 px-4 sm:mx-0 sm:px-0">
            <button
              type="button"
              onClick={() => setSelectedCategoryFilter('all')}
              className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategoryFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/20'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
              }`}
            >
              <span>All Categories</span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                  selectedCategoryFilter === 'all'
                    ? 'bg-white/20 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {programs.length}
              </span>
            </button>

            {eventCategories.map((cat) => {
              const isSelected = selectedCategoryFilter.toLowerCase() === cat.code.toLowerCase();
              return (
                <button
                  key={cat.code}
                  type="button"
                  onClick={() => setSelectedCategoryFilter(cat.code)}
                  className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all ${
                    isSelected
                      ? 'bg-indigo-600 text-white shadow-sm ring-2 ring-indigo-600/20'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 shadow-2xs'
                  }`}
                >
                  <Tag className="h-3 w-3 opacity-60" />
                  <span>{cat.name}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                      isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {cat.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Search & Secondary Filter Controls */}
          <div className="rounded-2xl border border-slate-200/80 bg-white p-3 shadow-xs">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-[1fr_200px_170px_150px_auto]">
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  placeholder="Search programs by name, code or description..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>

              {/* Category Dropdown */}
              <select
                value={selectedCategoryFilter}
                onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All Categories ({programs.length})</option>
                {eventCategories.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name} ({c.count})
                  </option>
                ))}
              </select>

              {/* Status Select */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All Slots</option>
                <option value="vacant">Needs Assignment</option>
                <option value="filled">Fully Assigned</option>
              </select>

              {/* Type Select */}
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
              >
                <option value="all">All Types</option>
                <option value="individual">Individual</option>
                <option value="team">Team Programs</option>
              </select>

              {/* Clear button */}
              {(selectedCategoryFilter !== 'all' || searchTerm || statusFilter !== 'all' || typeFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCategoryFilter('all');
                    setSearchTerm('');
                    setStatusFilter('all');
                    setTypeFilter('all');
                  }}
                  className="h-10 rounded-xl px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700 sm:col-span-2 lg:col-span-1"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 4. PROGRAMS TABLE */}
        {/* ========================================================================= */}
        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Programs & Assignments</p>
              {selectedCategoryFilter !== 'all' && (
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-100">
                  {getCategoryDisplay(selectedCategoryFilter)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Showing {filteredPrograms.length} of {programs.length} programs
            </p>
          </div>

          {programs.length === 0 ? (
            <div className="py-16 text-center">
              <Trophy className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">No programs available</p>
              <p className="mt-1 text-sm text-slate-400">This event does not have any active programs yet.</p>
            </div>
          ) : filteredPrograms.length === 0 ? (
            <div className="py-16 text-center">
              <Filter className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">No matching programs found</p>
              <p className="mt-1 text-sm text-slate-400">Try selecting a different category or clearing search filters.</p>
              <button
                type="button"
                onClick={() => {
                  setSelectedCategoryFilter('all');
                  setSearchTerm('');
                  setStatusFilter('all');
                  setTypeFilter('all');
                }}
                className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
              >
                Reset All Filters
              </button>
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-50/80">
                    <tr>
                      {['Program', 'Category', 'Type & Limits', 'Assigned Members', 'Slots'].map((label) => (
                        <th
                          key={label}
                          className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                        >
                          {label}
                        </th>
                      ))}
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredPrograms.map((program) => {
                      const assignedList = program.assigned_students || [];
                      const maxAllowed = program.per_team_limit || (program.is_team_based ? 4 : 1);
                      const isFull = program.available_slots === 0 || assignedList.length >= maxAllowed;

                      return (
                        <tr key={program.id} className="transition hover:bg-indigo-50/30">
                          {/* Program Name */}
                          <td className="px-5 py-3.5">
                            <div>
                              <p className="font-semibold text-slate-900 text-sm max-w-[220px] truncate">
                                {program.name}
                              </p>
                              {program.description && (
                                <p className="text-xs text-slate-400 max-w-[220px] truncate">
                                  {program.description}
                                </p>
                              )}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${getCategoryBadge(
                                program.category
                              )}`}
                            >
                              {getCategoryDisplay(program.category)}
                            </span>
                          </td>

                          {/* Type & Limits */}
                          <td className="whitespace-nowrap px-5 py-3.5 text-xs text-slate-600">
                            <div>{program.is_team_based ? 'Team' : 'Individual'}</div>
                            <div className="text-[11px] text-slate-400">Limit: {maxAllowed} per team</div>
                          </td>

                          {/* Assigned Members */}
                          <td className="px-5 py-3.5">
                            {renderAssignedMembers(program)}
                          </td>

                          {/* Slots */}
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <span
                              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
                                isFull
                                  ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                                  : 'border-indigo-100 bg-indigo-50 text-indigo-700'
                              }`}
                            >
                              {assignedList.length} / {maxAllowed} slots
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <button
                              type="button"
                              onClick={() => openAssignDrawer(program)}
                              disabled={isFull || registrationLocked}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                                isFull || registrationLocked
                                  ? 'border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                                  : 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700'
                              }`}
                            >
                              <UserPlus className="h-3.5 w-3.5" />
                              <span>{isFull ? 'Full' : program.is_team_based ? 'Assign Team' : 'Assign'}</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredPrograms.map((program) => {
                  const assignedList = program.assigned_students || [];
                  const maxAllowed = program.per_team_limit || (program.is_team_based ? 4 : 1);
                  const isFull = program.available_slots === 0 || assignedList.length >= maxAllowed;

                  return (
                    <article key={program.id} className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors">
                      {/* Top Header: Title, Category & Slots */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 text-sm leading-snug">
                            {program.name}
                          </p>
                          {program.description && (
                            <p className="text-xs text-slate-400 line-clamp-2 mt-0.5">
                              {program.description}
                            </p>
                          )}
                          <div className="flex flex-wrap items-center gap-1.5 mt-2">
                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${getCategoryBadge(
                                program.category
                              )}`}
                            >
                              {getCategoryDisplay(program.category)}
                            </span>
                            <span className="text-[11px] text-slate-500 font-medium">
                              {program.is_team_based ? 'Team' : 'Individual'} · Limit {maxAllowed}
                            </span>
                          </div>
                        </div>

                        <span
                          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold shrink-0 ${
                            isFull
                              ? 'border-emerald-100 bg-emerald-50 text-emerald-700'
                              : 'border-indigo-100 bg-indigo-50 text-indigo-700'
                          }`}
                        >
                          {assignedList.length}/{maxAllowed} slots
                        </span>
                      </div>

                      {/* Assigned Students */}
                      <div className="space-y-1.5 bg-slate-50/70 p-3 rounded-xl border border-slate-100">
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                          {program.is_team_based ? 'Assigned Teams & Members' : 'Assigned Students'} ({assignedList.length})
                        </div>
                        {renderAssignedMembers(program)}
                      </div>

                      {/* Action Button */}
                      <div>
                        <button
                          type="button"
                          onClick={() => openAssignDrawer(program)}
                          disabled={isFull || registrationLocked}
                          className={`w-full inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors min-h-[42px] ${
                            isFull || registrationLocked
                              ? 'border border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed'
                              : 'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700'
                          }`}
                        >
                          <UserPlus className="h-4 w-4" />
                          <span>
                            {registrationLocked
                              ? 'Registration Closed'
                              : isFull
                                ? 'All Slots Filled'
                                : program.is_team_based
                                  ? 'Assign Team'
                                  : 'Assign Student'}
                          </span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>

      {/* ========================================================================= */}
      {/* 5. RIGHT-SIDE SLIDE-OVER DRAWER (ASSIGN STUDENT) */}
      {/* ========================================================================= */}
      {activeModalProgram && (() => {
        const progCat = (activeModalProgram.category || '').toLowerCase();
        const progCatDisplay = getCategoryDisplay(activeModalProgram.category);
        const assignedIds = new Set(
          (activeModalProgram.assigned_students || []).map((s) => s.id || s.student_id)
        );
        const isTeam = Boolean(activeModalProgram.is_team_based);
        const teamSize = activeModalProgram.team_size || (isTeam ? 4 : 1);
        const maxSubTeams = Math.max(
          1,
          activeModalProgram.max_teams_per_school ||
            Math.floor((activeModalProgram.per_team_limit || teamSize) / teamSize) ||
            1
        );
        const maxAllowed = activeModalProgram.per_team_limit || (isTeam ? teamSize * maxSubTeams : 1);
        const currentAssignedCount = (activeModalProgram.assigned_students || []).length;
        const slotsRemaining = Math.max(0, maxAllowed - currentAssignedCount);

        // Sub teams map for this program
        const subTeamsMap = {};
        (activeModalProgram.assigned_students || []).forEach((st) => {
          const sub = st.sub_team_number || 1;
          if (!subTeamsMap[sub]) subTeamsMap[sub] = [];
          subTeamsMap[sub].push(st);
        });

        const activeSubTeamMembers = subTeamsMap[modalSelectedSubTeam] || [];
        const isCurrentSubTeamFull = isTeam && activeSubTeamMembers.length >= teamSize;
        const neededForCurrentSubTeam = isTeam ? Math.max(0, teamSize - activeSubTeamMembers.length) : 1;

        const isProgramGeneral = isProgramGeneralOrMixed(activeModalProgram);
        const applicableLimit = isProgramGeneral
          ? 0
          : (isTeam
              ? eventData?.max_group_programs_per_student
              : eventData?.max_single_programs_per_student);
        const isUnlimited = isProgramGeneral || !applicableLimit || applicableLimit <= 0;

        // ONLY list students whose category is ALLOWED for this program!
        // Other students cannot be assigned and are excluded.
        const allowedCategoryMembers = teamMembers.filter((m) => {
          if (assignedIds.has(m.id) || assignedIds.has(m.student_id)) {
            return false;
          }
          return isCategoryAllowedForProgram(m.category, activeModalProgram.category);
        });

        const filteredCandidates = allowedCategoryMembers.filter((m) => {
          // Check limit
          const isLimitReached = isStudentLimitReached(m, activeModalProgram);

          if (drawerHideLimitReached && isLimitReached) {
            return false;
          }

          // Search query
          if (modalStudentSearch.trim()) {
            const q = modalStudentSearch.trim().toLowerCase();
            const nameMatch = m.name?.toLowerCase().includes(q);
            const idMatch = m.student_id?.toLowerCase().includes(q);
            const gradeMatch = m.grade ? `grade ${m.grade}`.toLowerCase().includes(q) || `class ${m.grade}`.toLowerCase().includes(q) || String(m.grade).toLowerCase().includes(q) : false;
            const secMatch = m.section ? `sec ${m.section}`.toLowerCase().includes(q) || `section ${m.section}`.toLowerCase().includes(q) || String(m.section).toLowerCase().includes(q) : false;
            if (!nameMatch && !idMatch && !gradeMatch && !secMatch) {
              return false;
            }
          }

          // Grade / Class Filter
          if (drawerGradeFilter !== 'all') {
            if (String(m.grade || '') !== drawerGradeFilter) {
              return false;
            }
          }

          // Section Filter
          if (drawerSectionFilter !== 'all') {
            if (String(m.section || '').trim().toUpperCase() !== drawerSectionFilter.toUpperCase()) {
              return false;
            }
          }

          // Gender Filter
          if (drawerGenderFilter !== 'all') {
            const mGen = (m.gender || '').toLowerCase();
            if (mGen !== drawerGenderFilter.toLowerCase()) {
              return false;
            }
          }

          return true;
        }).sort((a, b) => {
          const statsA = getStudentProgramStats(a);
          const statsB = getStudentProgramStats(b);
          const limitReachedA = isStudentLimitReached(a, activeModalProgram);
          const limitReachedB = isStudentLimitReached(b, activeModalProgram);

          // Available students first, limit-reached students last
          if (!limitReachedA && limitReachedB) return -1;
          if (limitReachedA && !limitReachedB) return 1;

          // Then by total program count ascending (give chance to students with fewer programs)
          if (statsA.totalCount !== statsB.totalCount) return statsA.totalCount - statsB.totalCount;

          return (a.name || '').localeCompare(b.name || '');
        });

        const availableStudentsCount = allowedCategoryMembers.filter((m) => {
          return !isStudentLimitReached(m, activeModalProgram);
        }).length;

        const limitReachedCount = allowedCategoryMembers.length - availableStudentsCount;

        const isAnyFilterActive =
          Boolean(modalStudentSearch.trim()) ||
          drawerGradeFilter !== 'all' ||
          drawerSectionFilter !== 'all' ||
          drawerGenderFilter !== 'all' ||
          drawerHideLimitReached;

        const selectedStudentData = teamMembers.find((m) => m.id === modalSelectedStudent);
        const isSelectedStudentLimitReached = selectedStudentData
          ? isStudentLimitReached(selectedStudentData, activeModalProgram)
          : false;

        // Quick auto-select helper for team
        const handleAutoSelectTeam = () => {
          const availableList = filteredCandidates.filter((m) => {
            return !isStudentLimitReached(m, activeModalProgram);
          });
          const picked = availableList.slice(0, neededForCurrentSubTeam);
          const pickedIds = picked.map((m) => m.id);
          setModalSelectedStudents(pickedIds);
          if (pickedIds.length > 0) {
            setModalSelectedLeader(pickedIds[0]);
          }
        };

        const handleToggleCandidate = (memberId) => {
          if (modalSelectedStudents.includes(memberId)) {
            const next = modalSelectedStudents.filter((id) => id !== memberId);
            setModalSelectedStudents(next);
            if (modalSelectedLeader === memberId) {
              setModalSelectedLeader(next[0] || null);
            }
          } else {
            if (modalSelectedStudents.length >= neededForCurrentSubTeam) {
              return;
            }
            const next = [...modalSelectedStudents, memberId];
            setModalSelectedStudents(next);
            if (!modalSelectedLeader) {
              setModalSelectedLeader(memberId);
            }
          }
        };

        const selectedLeaderObj = isTeam
          ? teamMembers.find((m) => m.id === modalSelectedLeader) ||
            teamMembers.find((m) => m.id === modalSelectedStudents[0])
          : null;
        const teamDisplayName = selectedLeaderObj
          ? `${selectedLeaderObj.name} & Team`
          : 'Team';

        return (
          <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
            {/* Backdrop with smooth blur */}
            <div
              className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
              onClick={closeAssignDrawer}
              aria-hidden="true"
            />

            {/* Right Slide-over container */}
            <div className="fixed inset-y-0 right-0 flex max-w-full pl-0 sm:pl-10">
              <div className="w-screen max-w-xl md:max-w-2xl bg-white shadow-2xl flex flex-col h-full transform transition ease-in-out duration-300 animate-in slide-in-from-right">
                
                {/* 1. Drawer Header */}
                <div className="border-b border-slate-100 px-5 py-4 bg-slate-50/70 shrink-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600 mb-1">
                        {progCatDisplay} · {isTeam ? `Team Program (${teamSize} members required)` : 'Single Program'} · {activeModalProgram.program_type_display || (activeModalProgram.program_type ? activeModalProgram.program_type.replace(/_/g, ' ') : 'Stage')} · {currentAssignedCount}/{maxAllowed} Slots
                      </p>
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
                        {isTeam ? `Assign Team to ${activeModalProgram.name}` : `Assign Student to ${activeModalProgram.name}`}
                      </h2>
                      {activeModalProgram.description && (
                        <p className="text-xs text-slate-500 line-clamp-1 mt-0.5">
                          {activeModalProgram.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={closeAssignDrawer}
                      aria-label="Close drawer"
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200/60 hover:text-slate-700 transition-colors shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Sub-Team Tabs (if multi sub-team program) */}
                {isTeam && maxSubTeams > 1 && (
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-5 py-2 overflow-x-auto shrink-0">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider shrink-0 mr-1">
                      Sub-Team:
                    </span>
                    {Array.from({ length: maxSubTeams }, (_, i) => i + 1).map((sNum) => {
                      const existing = subTeamsMap[sNum] || [];
                      const leader = existing.find((m) => m.is_leader) || existing[0];
                      const isFull = existing.length >= teamSize;
                      const isActive = modalSelectedSubTeam === sNum;

                      return (
                        <button
                          key={sNum}
                          type="button"
                          onClick={() => {
                            setModalSelectedSubTeam(sNum);
                            setModalSelectedStudents([]);
                            setModalSelectedLeader(null);
                          }}
                          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold transition-all shrink-0 ${
                            isActive
                              ? 'bg-indigo-600 text-white shadow-xs ring-1 ring-indigo-600/30'
                              : isFull
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-white text-slate-700 border border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <span>Sub-Team {sNum}</span>
                          {isFull ? (
                            <span className="text-[10px] font-normal opacity-90 truncate max-w-[90px]">
                              ({leader?.name} & Team)
                            </span>
                          ) : (
                            <span className="text-[10px] font-normal opacity-75">
                              ({existing.length}/{teamSize})
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Sub-team Full Warning */}
                {isTeam && isCurrentSubTeamFull && (
                  <div className="mx-5 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                    <div className="flex items-center gap-2 font-semibold">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        Sub-Team {modalSelectedSubTeam} is already fully assigned ({subTeamsMap[modalSelectedSubTeam]?.find(m => m.is_leader)?.name || 'Leader'} & Team).
                      </span>
                    </div>
                    <p className="mt-1 text-[11px] text-emerald-700">
                      To reassign this team, please remove the existing team from the programs list first.
                    </p>
                  </div>
                )}

                {/* 2. Search & Filtering Toolbar */}
                <div className="border-b border-slate-100 bg-white px-5 py-3 space-y-2.5 shrink-0 shadow-2xs">
                  {/* Search input */}
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                    <input
                      type="search"
                      placeholder={`Search ${progCatDisplay} students by name, ID, class...`}
                      value={modalStudentSearch}
                      onChange={(e) => setModalStudentSearch(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-9 text-xs text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-100"
                    />
                    {modalStudentSearch && (
                      <button
                        type="button"
                        onClick={() => setModalStudentSearch('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>

                  {/* Filter Selects Grid */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <select
                        value={drawerGradeFilter}
                        onChange={(e) => setDrawerGradeFilter(e.target.value)}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2 text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                      >
                        <option value="all">All Classes</option>
                        {availableGrades.map((g) => (
                          <option key={g} value={g}>
                            Class {g}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={drawerSectionFilter}
                        onChange={(e) => setDrawerSectionFilter(e.target.value)}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2 text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                      >
                        <option value="all">All Sections</option>
                        {availableSections.map((s) => (
                          <option key={s} value={s}>
                            Section {s}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <select
                        value={drawerGenderFilter}
                        onChange={(e) => setDrawerGenderFilter(e.target.value)}
                        className="h-8 w-full rounded-lg border border-slate-200 bg-slate-50/80 px-2 text-[11px] font-medium text-slate-700 outline-none focus:border-indigo-400 focus:bg-white"
                      >
                        <option value="all">All Genders</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                  </div>

                  {/* Count indicator & quick actions */}
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-0.5 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px]">
                        Showing <strong className="text-slate-800">{filteredCandidates.length}</strong> eligible students
                      </span>
                      {!isUnlimited && limitReachedCount > 0 && (
                        <button
                          type="button"
                          onClick={() => setDrawerHideLimitReached((prev) => !prev)}
                          className={`text-[10px] font-medium px-2 py-0.5 rounded transition-colors ${
                            drawerHideLimitReached
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          }`}
                        >
                          {drawerHideLimitReached ? 'Available only' : `Hide limit reached (${limitReachedCount})`}
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {isTeam && !isCurrentSubTeamFull && (
                        <button
                          type="button"
                          onClick={handleAutoSelectTeam}
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-50 border border-indigo-200 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors"
                          title={`Quickly select the first ${neededForCurrentSubTeam} available students`}
                        >
                          <span>Select {neededForCurrentSubTeam} Members</span>
                        </button>
                      )}

                      {isAnyFilterActive && (
                        <button
                          type="button"
                          onClick={handleClearDrawerFilters}
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-rose-600 transition-colors"
                        >
                          <RotateCcw className="h-3 w-3" />
                          <span>Reset</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 3. Candidate Students List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-slate-50/50">
                  {filteredCandidates.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white p-8 text-center">
                      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400 mb-2.5">
                        <Users className="h-5 w-5" />
                      </div>
                      <h4 className="text-xs font-semibold text-slate-800">
                        {allowedCategoryMembers.length === 0
                          ? `No ${progCatDisplay} students in your team`
                          : 'No eligible students match current filters'}
                      </h4>
                      <p className="mt-1 text-[11px] text-slate-400 max-w-xs mx-auto">
                        {allowedCategoryMembers.length === 0
                          ? `Only students in the ${progCatDisplay} category are permitted to participate in this program.`
                          : 'Try clearing your search query or filter options to see all available candidates.'}
                      </p>
                      {isAnyFilterActive && (
                        <button
                          type="button"
                          onClick={handleClearDrawerFilters}
                          className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                        >
                          <RotateCcw className="h-3 w-3 text-slate-400" />
                          <span>Clear filters</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredCandidates.map((member) => {
                      const stats = getStudentProgramStats(member);
                      const limitCheck = checkStudentLimitForProgram(member, activeModalProgram);
                      const isLimitReached = limitCheck.reached;
                      const isSelected = isTeam
                        ? modalSelectedStudents.includes(member.id)
                        : modalSelectedStudent === member.id;
                      const isLeader = isTeam && (modalSelectedLeader || modalSelectedStudents[0]) === member.id;

                      const initials = (member.name || 'S')
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((n) => n[0].toUpperCase())
                        .join('');

                      return (
                        <article
                          key={member.id}
                          onClick={() => {
                            if (isLimitReached) return;
                            if (isTeam) {
                              if (isCurrentSubTeamFull) return;
                              handleToggleCandidate(member.id);
                            } else {
                              setModalSelectedStudent(member.id);
                            }
                          }}
                          className={`group relative flex items-center gap-3 rounded-xl p-2.5 sm:p-3 border transition-all ${
                            isLimitReached || (isTeam && isCurrentSubTeamFull)
                              ? 'border-slate-200/60 bg-slate-100/60 opacity-60 cursor-not-allowed select-none'
                              : isSelected
                                ? 'border-indigo-600 bg-indigo-50/70 shadow-2xs ring-1 ring-indigo-600/30 cursor-pointer'
                                : 'border-slate-200/80 bg-white hover:border-indigo-200 hover:bg-slate-50/70 cursor-pointer shadow-2xs'
                          }`}
                        >
                          {/* Selection indicator */}
                          {isTeam ? (
                            <input
                              type="checkbox"
                              disabled={isLimitReached || isCurrentSubTeamFull || (!isSelected && modalSelectedStudents.length >= neededForCurrentSubTeam)}
                              checked={isSelected}
                              onChange={() => {
                                if (!isLimitReached && !isCurrentSubTeamFull) {
                                  handleToggleCandidate(member.id);
                                }
                              }}
                              className={`h-4 w-4 rounded ${
                                isLimitReached || isCurrentSubTeamFull
                                  ? 'border-slate-300 text-slate-300 cursor-not-allowed'
                                  : 'border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer'
                              }`}
                            />
                          ) : (
                            <input
                              type="radio"
                              name="modalStudentSelection"
                              disabled={isLimitReached}
                              checked={isSelected}
                              onChange={() => {
                                if (!isLimitReached) {
                                  setModalSelectedStudent(member.id);
                                }
                              }}
                              className={`h-4 w-4 rounded-full ${
                                isLimitReached
                                  ? 'border-slate-300 text-slate-300 cursor-not-allowed'
                                  : 'border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer'
                              }`}
                            />
                          )}

                          {/* Student Avatar */}
                          <div
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs transition-colors ${
                              isLimitReached
                                ? 'bg-slate-200 text-slate-500'
                                : isSelected
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-indigo-50 text-indigo-700'
                            }`}
                          >
                            {initials}
                          </div>

                          {/* Student Details */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <span className={`font-medium text-xs truncate ${
                                isLimitReached ? 'text-slate-500' : 'text-slate-900 group-hover:text-indigo-600'
                              }`}>
                                {member.name}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">
                                #{member.student_id}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {member.grade ? `Class ${member.grade}${member.section ? `-${member.section.toUpperCase()}` : ''}` : 'Student'}
                              {member.gender ? ` · ${member.gender}` : ''}
                              {(() => {
                                const lim = getStudentCategoryLimits(member.category);
                                const parts = [];
                                if (lim?.maxTotal > 0) parts.push(`Tot: ${stats.totalCount}/${lim.maxTotal}`);
                                else parts.push(`Tot: ${stats.totalCount}`);
                                if (lim?.maxOnstage > 0) parts.push(`Stage: ${stats.onstageCount}/${lim.maxOnstage}`);
                                if (lim?.maxOffstage > 0) parts.push(`Off: ${stats.offstageCount}/${lim.maxOffstage}`);
                                return ` · ${parts.join(' · ')}`;
                              })()}
                            </p>
                          </div>

                          {/* Status Badge & Leader selector */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            {isLimitReached ? (
                              <span
                                className="text-[10px] font-semibold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded cursor-help"
                                title={limitCheck.reason || 'Participation limit reached'}
                              >
                                {limitCheck.limitType ? `${limitCheck.limitType.toUpperCase()} LIMIT` : 'Limit Reached'}
                              </span>
                            ) : isSelected ? (
                              isTeam ? (
                                isLeader ? (
                                  <span className="inline-flex items-center gap-1 rounded bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 border border-amber-300">
                                    <Crown className="h-3 w-3 text-amber-600" /> Leader
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setModalSelectedLeader(member.id);
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-medium text-indigo-600 hover:text-indigo-800 bg-white border border-indigo-200 px-2 py-0.5 rounded hover:bg-indigo-50 transition-colors"
                                    title="Set this student as the team leader"
                                  >
                                    <Crown className="h-2.5 w-2.5 text-slate-400" />
                                    <span>Make Leader</span>
                                  </button>
                                )
                              ) : (
                                <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                  Selected
                                </span>
                              )
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  )}
                </div>

                {/* 4. Selected Team / Student Preview Strip */}
                {isTeam ? (
                  modalSelectedStudents.length > 0 && (
                    <div className="border-t border-indigo-100 bg-indigo-50/90 px-5 py-3 shrink-0 animate-in fade-in">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="flex items-center gap-2">
                          <Crown className="h-4 w-4 text-amber-500 shrink-0" />
                          <p className="text-xs font-bold text-slate-900 truncate">
                            Team:{' '}
                            <span className="text-indigo-700">{teamDisplayName}</span>
                          </p>
                          <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                            {modalSelectedStudents.length}/{neededForCurrentSubTeam} selected
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setModalSelectedStudents([]);
                            setModalSelectedLeader(null);
                          }}
                          className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline shrink-0"
                        >
                          Clear
                        </button>
                      </div>

                      {/* Chips of selected students */}
                      <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                        {modalSelectedStudents.map((sId) => {
                          const m = teamMembers.find((tm) => tm.id === sId);
                          if (!m) return null;
                          const isLeader = (modalSelectedLeader || modalSelectedStudents[0]) === sId;
                          return (
                            <span
                              key={sId}
                              className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-medium shadow-2xs ${
                                isLeader
                                  ? 'border-amber-300 bg-amber-50 text-amber-900 ring-1 ring-amber-300/60'
                                  : 'border-slate-200 bg-white text-slate-800'
                              }`}
                            >
                              {isLeader && <Crown className="h-3 w-3 text-amber-600 shrink-0" />}
                              <span>{m.name}</span>
                              {isLeader && (
                                <span className="text-[9px] font-bold text-amber-700 uppercase">Leader</span>
                              )}
                              <button
                                type="button"
                                onClick={() => handleToggleCandidate(sId)}
                                className="text-slate-400 hover:text-rose-600 ml-0.5 p-0.5"
                                title="Remove member"
                              >
                                <X className="h-3 w-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  )
                ) : (
                  selectedStudentData && (
                    <div
                      className={`border-t px-5 py-2.5 flex items-center justify-between gap-3 shrink-0 animate-in fade-in ${
                        isSelectedStudentLimitReached ? 'border-rose-200 bg-rose-50' : 'border-indigo-100 bg-indigo-50/90'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <div
                          className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs ${
                            isSelectedStudentLimitReached ? 'bg-rose-600 text-white' : 'bg-indigo-600 text-white'
                          }`}
                        >
                          {isSelectedStudentLimitReached ? (
                            <AlertCircle className="h-3.5 w-3.5" />
                          ) : (
                            <Check className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-xs font-semibold truncate ${
                              isSelectedStudentLimitReached ? 'text-rose-950' : 'text-indigo-950'
                            }`}
                          >
                            {isSelectedStudentLimitReached ? 'Cannot Assign: Limit Reached for ' : 'Ready to assign: '}
                            <span className="font-bold">{selectedStudentData.name}</span>
                          </p>
                          <p
                            className={`text-[11px] truncate ${
                              isSelectedStudentLimitReached ? 'text-rose-700' : 'text-indigo-700'
                            }`}
                          >
                            ID: #{selectedStudentData.student_id} · {getCategoryDisplay(selectedStudentData.category)}
                            {selectedStudentData.grade
                              ? ` · Class ${selectedStudentData.grade}${
                                  selectedStudentData.section ? `-${selectedStudentData.section.toUpperCase()}` : ''
                                }`
                              : ''}
                            {!isUnlimited &&
                              ` · Enrolled in ${getStudentProgramStats(selectedStudentData).singleCount}/${applicableLimit} programs`}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalSelectedStudent('')}
                        className={`text-xs font-medium underline shrink-0 ${
                          isSelectedStudentLimitReached
                            ? 'text-rose-700 hover:text-rose-900'
                            : 'text-indigo-600 hover:text-indigo-800'
                        }`}
                      >
                        Deselect
                      </button>
                    </div>
                  )
                )}

                {/* 5. Sticky Drawer Footer */}
                <div className="border-t border-slate-200/80 bg-white px-5 py-3.5 flex items-center justify-between gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={closeAssignDrawer}
                    className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors"
                  >
                    Cancel
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (isTeam) {
                        handleAssignTeam(
                          activeModalProgram.id,
                          modalSelectedStudents,
                          modalSelectedSubTeam,
                          modalSelectedLeader
                        );
                      } else {
                        handleAssignStudent(activeModalProgram.id, modalSelectedStudent);
                      }
                    }}
                    disabled={
                      assigningStudent ||
                      (isTeam
                        ? isCurrentSubTeamFull || modalSelectedStudents.length !== neededForCurrentSubTeam
                        : !modalSelectedStudent || isSelectedStudentLimitReached)
                    }
                    className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {isTeam ? <Users className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                    <span>
                      {assigningStudent
                        ? isTeam
                          ? 'Assigning Team...'
                          : 'Assigning Student...'
                        : isTeam
                          ? isCurrentSubTeamFull
                            ? `Sub-Team ${modalSelectedSubTeam} Full`
                            : modalSelectedStudents.length === neededForCurrentSubTeam
                              ? `Confirm & Assign ${teamDisplayName} (${neededForCurrentSubTeam} Members)`
                              : `Select ${neededForCurrentSubTeam - modalSelectedStudents.length} More Member${
                                  neededForCurrentSubTeam - modalSelectedStudents.length === 1 ? '' : 's'
                                }`
                          : isSelectedStudentLimitReached
                            ? 'Limit Reached for Student'
                            : modalSelectedStudent
                              ? 'Confirm & Assign Student'
                              : 'Select a Student to Assign'}
                    </span>
                  </button>
                </div>

              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default TeamEventDetail;
