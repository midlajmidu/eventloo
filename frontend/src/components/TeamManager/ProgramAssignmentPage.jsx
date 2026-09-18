import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { teamManagerAPI, categoriesAPI } from '../../services/api';
import {
  ArrowLeft,
  Users,
  UserPlus,
  UserMinus,
  Search,
  CheckCircle,
  XCircle,
  BookOpen,
  Crown
} from 'lucide-react';

const ProgramAssignmentPage = () => {
  const { eventId, programId } = useParams();
  const navigate = useNavigate();

  // State management
  const [program, setProgram] = useState(null);
  const [event, setEvent] = useState(null);
  const [teamMembers, setTeamMembers] = useState([]);
  const [assignedStudents, setAssignedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [removing, setRemoving] = useState(false);

  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [classFilter, setClassFilter] = useState('all');
  const [showAssignedOnly, setShowAssignedOnly] = useState(false);
  const [categories, setCategories] = useState([]);

  // Success/error messages
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  const [selectedSubTeam, setSelectedSubTeam] = useState(1);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  useEffect(() => {
    loadProgramData();
    fetchCategories();
  }, [eventId, programId]);

  const fetchCategories = async () => {
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data.results || res.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const loadProgramData = async () => {
    if (!eventId || !programId) return;

    setLoading(true);
    try {
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;

      if (!teamId) {
        setMessage('No team data found. Please login again.');
        setMessageType('error');
        return;
      }

      const response = await teamManagerAPI.getEventPrograms(teamId, eventId);

      let programsData = [];
      let teamMembersData = [];
      let eventData = null;

      if (response.data?.results) {
        const resultData = response.data.results;
        programsData = resultData.programs || [];
        teamMembersData = resultData.team_members || [];
        eventData = resultData.event;
      } else {
        programsData = response.data.programs || [];
        teamMembersData = response.data.team_members || [];
        eventData = response.data.event;
      }

      const programData = programsData.find(p => p.id === parseInt(programId));
      if (!programData) {
        setMessage('Program not found');
        setMessageType('error');
        return;
      }

      setProgram(programData);
      setEvent(eventData);
      setTeamMembers(teamMembersData);
      setAssignedStudents(programData.assigned_students || []);

    } catch (err) {
      console.error('Error loading program data:', err);
      setMessage('Failed to load program data');
      setMessageType('error');
    } finally {
      setLoading(false);
    }
  };

  const assignStudent = async (studentId) => {
    if (!program || !event) return;

    setAssigning(true);
    try {
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;

      await teamManagerAPI.assignStudentToProgram(teamId, event.id, program.id, studentId);
      await loadProgramData();

      setMessage('Student assigned successfully!');
      setMessageType('success');

      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);

    } catch (err) {
      console.error('Error assigning student:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to assign student';
      setMessage(errorMessage);
      setMessageType('error');

      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    } finally {
      setAssigning(false);
    }
  };

  const assignStudentsToSubTeam = async () => {
    if (!program || !event || selectedStudentIds.length === 0) return;

    const requiredSize = program.team_size || 1;
    if (selectedStudentIds.length !== requiredSize) {
      alert(`Please select exactly ${requiredSize} students for Sub-Team ${selectedSubTeam}.`);
      return;
    }

    setAssigning(true);
    try {
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;

      await teamManagerAPI.assignStudentsToProgram(teamId, event.id, program.id, selectedStudentIds, selectedSubTeam);
      await loadProgramData();
      setSelectedStudentIds([]);

      setMessage(`Sub-Team ${selectedSubTeam} assigned successfully!`);
      setMessageType('success');

      // Auto advance to next unfilled sub-team if available
      const teamsFromField = program.max_teams_per_school || 1;
      const teamsFromCap = (program.team_size && (program.max_participants_per_team || program.max_participants))
        ? Math.floor((program.max_participants_per_team || program.max_participants) / program.team_size)
        : 1;
      const totalTeams = Math.max(teamsFromField, teamsFromCap, 1);

      if (selectedSubTeam < totalTeams) {
        setSelectedSubTeam(selectedSubTeam + 1);
      }

      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);

    } catch (err) {
      console.error('Error assigning sub-team:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to assign sub-team';
      setMessage(errorMessage);
      setMessageType('error');

      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    } finally {
      setAssigning(false);
    }
  };

  const handleSetLeader = async (studentId, subTeamNumber) => {
    if (!program || !event) return;

    try {
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;

      await teamManagerAPI.setSubTeamLeader(teamId, event.id, program.id, studentId, subTeamNumber);
      await loadProgramData();

      setMessage(`Sub-Team ${subTeamNumber} leader updated!`);
      setMessageType('success');

      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    } catch (err) {
      console.error('Error setting leader:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to update leader';
      setMessage(errorMessage);
      setMessageType('error');

      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    }
  };

  const removeStudent = async (studentId) => {
    if (!program || !event) return;

    setRemoving(true);
    try {
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;

      await teamManagerAPI.removeStudentFromProgram(teamId, event.id, program.id, studentId);
      await loadProgramData();

      setMessage('Student removed successfully!');
      setMessageType('success');

      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);

    } catch (err) {
      console.error('Error removing student:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || 'Failed to remove student';
      setMessage(errorMessage);
      setMessageType('error');

      setTimeout(() => {
        setMessage('');
        setMessageType('');
      }, 3000);
    } finally {
      setRemoving(false);
    }
  };

  const isGeneralCategory = (catCode) => {
    if (!catCode) return true;
    const lower = catCode.toLowerCase();
    if (lower === 'general' || lower === 'gn' || lower.startsWith('gn-') || lower.startsWith('gn') || lower.startsWith('gen')) {
      return true;
    }
    const cat = categories.find(c => c.code?.toLowerCase() === lower);
    if (cat && cat.is_mixing) {
      return true;
    }
    return false;
  };

  const getFilteredStudents = () => {
    let filtered = [...teamMembers];
    const isGeneral = isGeneralCategory(program?.category);

    if (!isGeneral && program?.category) {
      filtered = filtered.filter(student =>
        student.category && student.category.toLowerCase() === program.category.toLowerCase()
      );
    } else if (categoryFilter !== 'all') {
      filtered = filtered.filter(student =>
        student.category && student.category.toLowerCase() === categoryFilter.toLowerCase()
      );
    }

    if (classFilter !== 'all') {
      filtered = filtered.filter(student =>
        student.grade !== undefined && student.grade !== null && String(student.grade) === String(classFilter)
      );
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(student =>
        (student.name && student.name.toLowerCase().includes(term)) ||
        (student.student_id && student.student_id.toLowerCase().includes(term))
      );
    }

    if (showAssignedOnly) {
      filtered = filtered.filter(student =>
        assignedStudents.some(assigned => assigned.id === student.id)
      );
    } else {
      filtered = filtered.filter(student =>
        !assignedStudents.some(assigned => assigned.id === student.id)
      );
    }

    return filtered;
  };

  const isStudentAssigned = (studentId) => {
    return assignedStudents.some(student => student.id === studentId);
  };

  const canAssignMore = () => {
    if (!program) return false;
    const limit = program.is_team_based ?
      (program.max_participants_per_team || program.max_participants) :
      program.max_participants;

    if (!limit || limit <= 0) return true;
    return assignedStudents.length < limit;
  };

  const getCategoryBadgeClass = (category) => {
    const cat = category?.toLowerCase();
    if (cat === 'hs') return 'bg-blue-50 text-blue-700 border-blue-200';
    if (cat === 'hss') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (cat === 'up') return 'bg-purple-50 text-purple-700 border-purple-200';
    if (cat === 'lp' || cat === 'primary') return 'bg-amber-50 text-amber-700 border-amber-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const availableClasses = Array.from(
    new Set(
      teamMembers
        .filter(s => !program?.category || program.category === 'general' || s.category?.toLowerCase() === program.category?.toLowerCase())
        .map(s => s.grade)
        .filter(Boolean)
    )
  ).sort();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3"></div>
          <p className="text-gray-500 text-sm">Loading program assignment...</p>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-xl shadow-sm border border-gray-200">
          <BookOpen className="h-12 w-12 text-red-500 mx-auto mb-3" />
          <p className="text-gray-800 font-semibold mb-3">Program not found</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const filteredStudents = getFilteredStudents();
  const maxLimit = program.is_team_based ?
    (program.max_participants_per_team || program.max_participants) :
    program.max_participants;

  const isCategorySpecific = program?.category && !isGeneralCategory(program.category);

  // Calculate total allowed sub-teams for this program
  const teamsFromField = program.max_teams_per_school || 1;
  const teamsFromCap = (program.team_size && (program.max_participants_per_team || program.max_participants))
    ? Math.floor((program.max_participants_per_team || program.max_participants) / program.team_size)
    : 1;
  const totalSubTeams = program.is_team_based ? Math.max(teamsFromField, teamsFromCap, 1) : 1;
  const teamSize = program.is_team_based ? (program.team_size || 1) : 1;

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                const currentPath = window.location.pathname;
                if (currentPath.includes('/team-manager/dashboard/')) {
                  navigate(`/team-manager/dashboard?event=${eventId}`);
                } else {
                  navigate(`/team-manager/events/${eventId}`);
                }
              }}
              className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors border border-gray-200 cursor-pointer"
              title="Back to Programs"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-xl font-bold text-gray-900">{program.name}</h1>
                <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getCategoryBadgeClass(program.category)}`}>
                  {program.category?.toUpperCase()}
                </span>
                <span className="px-2 py-0.5 text-xs font-medium bg-gray-100 text-gray-600 rounded-full border border-gray-200">
                  {program.is_team_based ? `Team (${totalSubTeams} Sub-Teams × ${teamSize} members)` : 'Individual'}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Total Allowed: <span className="font-medium text-gray-700">{maxLimit}</span> • Assigned: <span className="font-medium text-blue-600">{assignedStudents.length}</span> / {maxLimit}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className={`px-3 py-1.5 rounded-lg text-xs font-medium border flex items-center space-x-1.5 ${canAssignMore() ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}>
              <Users className="h-3.5 w-3.5" />
              <span>{assignedStudents.length} / {maxLimit} Slots Filled</span>
            </div>
          </div>
        </div>

        {/* Notifications */}
        {message && (
          <div className={`p-3 rounded-lg text-sm flex items-center space-x-2 ${messageType === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
              : 'bg-red-50 border border-red-200 text-red-800'
            }`}>
            {messageType === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-red-600" />}
            <span>{message}</span>
          </div>
        )}

        {/* 1. Sub-Team Group Cards Section (For Team-Based Programs) */}
        {program.is_team_based && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center space-x-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  <span>Team / Sub-Team Group Assignments ({totalSubTeams} Teams allowed)</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Each sub-team requires exactly <strong className="text-gray-700">{teamSize} members</strong>. Select a team to assign or manage leaders.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: totalSubTeams }).map((_, idx) => {
                const subTeamNum = idx + 1;
                const members = assignedStudents.filter(s => (s.sub_team_number || 1) === subTeamNum);
                const isFull = members.length >= teamSize;
                const isActive = selectedSubTeam === subTeamNum;
                const hasLeader = members.some(m => m.is_leader);

                return (
                  <div
                    key={subTeamNum}
                    className={`bg-white rounded-2xl border transition-all ${isActive ? 'border-blue-500 shadow-md ring-2 ring-blue-100' : 'border-gray-200 shadow-2xs'
                      }`}
                  >
                    {/* Sub-Team Card Header */}
                    <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 rounded-t-2xl">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${isActive ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-100 text-gray-800 border-gray-200'
                          }`}>
                          Sub-Team {subTeamNum}
                        </span>
                        {hasLeader && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 rounded-full flex items-center space-x-1">
                            <Crown className="w-3 h-3 text-amber-600" />
                            <span>Leader Set</span>
                          </span>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${isFull ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-blue-50 text-blue-800 border-blue-200'
                          }`}>
                          {members.length} / {teamSize} Members
                        </span>

                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSubTeam(subTeamNum);
                            setSelectedStudentIds([]);
                          }}
                          className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${isActive ? 'bg-blue-50 text-blue-700 border-blue-200 font-bold' : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-200'
                            }`}
                        >
                          {isActive ? 'Active Target' : 'Select Target'}
                        </button>
                      </div>
                    </div>

                    {/* Sub-Team Member List */}
                    <div className="p-4 space-y-3">
                      {members.length === 0 ? (
                        <div className="py-6 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                          No members assigned to Sub-Team {subTeamNum} yet.
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {members.map(member => (
                            <div
                              key={member.id}
                              className={`p-3 rounded-xl border flex items-center justify-between gap-3 ${member.is_leader ? 'bg-amber-50/50 border-amber-200' : 'bg-gray-50/70 border-gray-200'
                                }`}
                            >
                              <div className="flex items-center space-x-3">
                                <div>
                                  <div className="font-bold text-xs text-gray-900 flex items-center space-x-1.5">
                                    <span>{member.name}</span>
                                    {member.is_leader && (
                                      <span className="px-1.5 py-0.5 text-[9px] font-extrabold bg-amber-500 text-white rounded flex items-center space-x-0.5">
                                        <Crown className="w-2.5 h-2.5" />
                                        <span>LEADER</span>
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-gray-500 flex items-center space-x-2 mt-0.5">
                                    <span>ID: {member.student_id}</span>
                                    {member.chest_number && (
                                      <span className="text-blue-600 font-semibold">Chest #: {member.chest_number}</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center space-x-2">
                                {/* Leader Designation Button */}
                                {!member.is_leader ? (
                                  <button
                                    type="button"
                                    onClick={() => handleSetLeader(member.id, subTeamNum)}
                                    className="px-2 py-1 text-[11px] font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors flex items-center space-x-1 cursor-pointer"
                                    title="Set as Group Leader"
                                  >
                                    <Crown className="w-3 h-3 text-amber-600" />
                                    <span>Make Leader</span>
                                  </button>
                                ) : (
                                  <span className="px-2 py-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 rounded-lg flex items-center space-x-1">
                                    <Crown className="w-3 h-3 text-amber-600 fill-amber-500" />
                                    <span>Leader</span>
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => removeStudent(member.id)}
                                  disabled={removing}
                                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Remove Member"
                                >
                                  <UserMinus className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 2. Individual Program Assigned List (Only for Single/Individual Programs) */}
        {!program.is_team_based && assignedStudents.length > 0 && !showAssignedOnly && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="px-4 py-3 bg-emerald-50/50 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600 mr-1.5" />
                Assigned Students ({assignedStudents.length})
              </h2>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Student ID</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Class</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {assignedStudents.map((student) => (
                    <tr key={student.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-xs text-gray-900">{student.name}</div>
                        {student.chest_number && (
                          <div className="text-[10px] text-blue-600 font-medium">Chest #: {student.chest_number}</div>
                        )}
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{student.student_id}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600 font-medium">{student.grade || '-'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">
                        <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getCategoryBadgeClass(student.category)}`}>
                          {student.category?.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 whitespace-nowrap text-right">
                        <button
                          onClick={() => removeStudent(student.id)}
                          disabled={removing}
                          className="px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors disabled:opacity-50 inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <UserMinus className="h-3 w-3" />
                          <span>Remove</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 3. Available Students Search & Selection Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden space-y-3 p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-gray-100 pb-3">
            <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider flex items-center">
              <Users className="h-3.5 w-3.5 text-gray-500 mr-1.5" />
              {showAssignedOnly ? 'Assigned Students' : 'Available Students'} ({filteredStudents.length})
            </h2>

            {program.is_team_based && !showAssignedOnly && (
              <div className="flex items-center space-x-3">
                {/* Active Sub-Team Selector Pills */}
                <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-xl border border-gray-200">
                  <span className="text-[11px] font-bold text-gray-500 px-2">Assign Target:</span>
                  {Array.from({ length: totalSubTeams }).map((_, idx) => {
                    const subNum = idx + 1;
                    const subCount = assignedStudents.filter(s => (s.sub_team_number || 1) === subNum).length;
                    const isSelected = selectedSubTeam === subNum;

                    return (
                      <button
                        key={subNum}
                        type="button"
                        onClick={() => {
                          setSelectedSubTeam(subNum);
                          setSelectedStudentIds([]);
                        }}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all border cursor-pointer ${isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                          }`}
                      >
                        Sub-Team {subNum} ({subCount}/{teamSize})
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={assignStudentsToSubTeam}
                  disabled={assigning || selectedStudentIds.length !== teamSize}
                  className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs flex items-center space-x-1 cursor-pointer"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                  <span>Assign to Sub-Team {selectedSubTeam}</span>
                </button>
              </div>
            )}
          </div>

          {/* Filters Bar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search student by name or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Classes</option>
              {availableClasses.map(cls => (
                <option key={cls} value={cls}>Class {cls}</option>
              ))}
            </select>

            {!isCategorySpecific && (
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map(cat => (
                  <option key={cat.code} value={cat.code}>{cat.name}</option>
                ))}
              </select>
            )}

            <select
              value={showAssignedOnly ? 'assigned' : 'available'}
              onChange={(e) => setShowAssignedOnly(e.target.value === 'assigned')}
              className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="available">Available Students</option>
              <option value="assigned">Assigned Students</option>
            </select>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="text-center py-10">
              <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No students match your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {program.is_team_based && !showAssignedOnly && (
                      <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase w-10">Select</th>
                    )}
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Student Name</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Student ID</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Gender</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Class</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase">Category</th>
                    <th className="px-4 py-2.5 text-center text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {filteredStudents.map((student) => {
                    const assigned = isStudentAssigned(student.id);
                    const isSelected = selectedStudentIds.includes(student.id);

                    const toggleSelect = () => {
                      if (isSelected) {
                        setSelectedStudentIds(selectedStudentIds.filter(id => id !== student.id));
                      } else {
                        if (selectedStudentIds.length >= teamSize) {
                          alert(`You can only select exactly ${teamSize} students for Sub-Team ${selectedSubTeam}.`);
                          return;
                        }
                        setSelectedStudentIds([...selectedStudentIds, student.id]);
                      }
                    };

                    return (
                      <tr key={student.id} className={`hover:bg-gray-50/80 transition-colors ${isSelected ? 'bg-blue-50/50' : ''}`}>
                        {program.is_team_based && !showAssignedOnly && (
                          <td className="px-4 py-2.5 text-center">
                            <input
                              type="checkbox"
                              disabled={assigned}
                              checked={isSelected}
                              onChange={toggleSelect}
                              className="h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>
                        )}
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <div className="font-semibold text-xs text-gray-900">{student.name}</div>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-500">{student.student_id}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs capitalize text-gray-500">{student.gender || '-'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-xs text-gray-600 font-medium">{student.grade || '-'}</td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border ${getCategoryBadgeClass(student.category)}`}>
                            {student.category?.toUpperCase()}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-center">
                          {assigned ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Assigned
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-600">
                              Available
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap text-right">
                          {assigned ? (
                            <button
                              onClick={() => removeStudent(student.id)}
                              disabled={removing}
                              className="px-2.5 py-1 text-xs font-medium text-red-600 hover:text-red-700 hover:bg-red-50 rounded border border-red-200 transition-colors disabled:opacity-50 inline-flex items-center space-x-1 cursor-pointer"
                            >
                              <UserMinus className="h-3 w-3" />
                              <span>Remove</span>
                            </button>
                          ) : (
                            program.is_team_based ? (
                              <button
                                onClick={toggleSelect}
                                className={`px-2.5 py-1 text-xs font-medium rounded border transition-colors cursor-pointer ${isSelected ? 'bg-blue-600 text-white border-blue-600' : 'text-blue-600 hover:bg-blue-50 border-blue-200'
                                  }`}
                              >
                                {isSelected ? 'Selected' : 'Select'}
                              </button>
                            ) : (
                              <button
                                onClick={() => assignStudent(student.id)}
                                disabled={assigning || !canAssignMore()}
                                className="px-2.5 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded border border-blue-200 transition-colors disabled:opacity-50 inline-flex items-center space-x-1 cursor-pointer"
                              >
                                <UserPlus className="h-3 w-3" />
                                <span>Assign</span>
                              </button>
                            )
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default ProgramAssignmentPage;
