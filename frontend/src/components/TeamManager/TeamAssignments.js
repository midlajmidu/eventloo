import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  UserMinus, 
  AlertCircle,
  X,
  Users,
  Trophy,
  Search,
  Filter,
  Calendar,
  MapPin,
  Clock
} from 'lucide-react';
import { teamManagerAPI } from '../../services/api';
import Pagination from '../common/Pagination';

const TeamAssignments = () => {
  const [teams, setTeams] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(0);

  useEffect(() => {
    console.log('DEBUG: TeamAssignments component mounted');
    fetchData();
  }, [currentPage, pageSize]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Get team data from localStorage
      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;
      
      console.log('DEBUG: Team data from localStorage:', teamData);
      console.log('DEBUG: Team ID:', teamId);
      
      if (!teamId) {
        console.error('DEBUG: No team ID found in localStorage');
        alert('No team data found. Please login again.');
        return;
      }
      
      setSelectedTeam(teamId);
      
      // Build query parameters for programs pagination
      const programsParams = new URLSearchParams();
      programsParams.append('page', currentPage);
      programsParams.append('page_size', pageSize);
      
      console.log('DEBUG: About to fetch teams and events...');
      const [teamsRes, eventsRes] = await Promise.all([
        teamManagerAPI.getMyTeams(),
        teamManagerAPI.getTeamEvents(teamId)
      ]);

      console.log('DEBUG: Teams response:', teamsRes.data);
      console.log('DEBUG: Events response:', eventsRes.data);

      // Handle teams response
      if (teamsRes.data.results) {
        setTeams(teamsRes.data.results);
      } else {
        setTeams(teamsRes.data);
      }
      
      // Handle events response
      if (eventsRes.data.events) {
        setEvents(eventsRes.data.events);
      } else {
        setEvents(eventsRes.data);
      }
      
      console.log('DEBUG: Events count:', eventsRes.data.events?.length || eventsRes.data.length);
      
      // Fetch programs for all events and get team members from the first response
      const allPrograms = [];
      let teamMembersFromResponse = [];
      
      for (const event of eventsRes.data.events || eventsRes.data) {
        try {
          console.log('DEBUG: Fetching programs for event:', event.id);
          const programsResponse = await teamManagerAPI.getEventPrograms(teamId, event.id);
          console.log('DEBUG: Programs response for event', event.id, ':', programsResponse.data);
          
          // Handle both paginated and non-paginated responses
          let eventPrograms = [];
          let teamMembersFromProgramsResponse = [];
          
          if (programsResponse.data?.results) {
            // Paginated response - the results contain the full response structure
            const resultData = programsResponse.data.results;
            eventPrograms = resultData.programs || [];
            teamMembersFromProgramsResponse = resultData.team_members || [];
          } else {
            // Non-paginated response
            eventPrograms = programsResponse.data?.programs || [];
            teamMembersFromProgramsResponse = programsResponse.data?.team_members || [];
          }
          
          console.log('DEBUG: Team members in response:', teamMembersFromProgramsResponse.length);
          
          // Get team members from the first response (they should be the same for all events)
          if (teamMembersFromResponse.length === 0 && teamMembersFromProgramsResponse.length > 0) {
            teamMembersFromResponse = teamMembersFromProgramsResponse;
            console.log('DEBUG: Found team members in response:', teamMembersFromResponse.length);
            console.log('DEBUG: First 3 team members:', teamMembersFromResponse.slice(0, 3));
          }
          
          // Add event info to each program
          eventPrograms.forEach(program => {
            program.event_id = event.id;
            program.event_title = event.title;
          });
          allPrograms.push(...eventPrograms);
        } catch (err) {
          console.warn(`Failed to fetch programs for event ${event.id}:`, err);
        }
      }
      
      // Set team members from the programs response
      console.log('DEBUG: Setting team members:', teamMembersFromResponse.length);
      setTeamMembers(teamMembersFromResponse);
      
      setPrograms(allPrograms);
      setTotalCount(allPrograms.length);
      setTotalPages(Math.ceil(allPrograms.length / pageSize));
      
      // Get assignments from programs
      const allAssignments = [];
      allPrograms.forEach(program => {
        if (program.assigned_students && program.assigned_students.length > 0) {
          program.assigned_students.forEach(student => {
            const assignment = {
              id: `${program.id}-${student.student_id}`,
              program_id: program.id,
              program_name: program.name,
              program_category: program.category,
              event_id: null, // API doesn't provide event_id in program data
              event_title: null, // API doesn't provide event_title in program data
              student_id: student.student_id,
              student_name: student.name,
              student_category: null // API doesn't provide student category for assignments
            };
            allAssignments.push(assignment);
          });
        }
      });
      setAssignments(allAssignments);
      

      
    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Error loading data. Please try again.');
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

  const handleAssignStudents = async () => {
    if (!selectedProgram || selectedStudents.length === 0 || !selectedTeam) return;

    // For team-based programs, validate team requirements
    if (selectedProgram.is_team_based) {
      if (selectedProgram.team_size && selectedStudents.length !== selectedProgram.team_size) {
        alert(`This program requires exactly ${selectedProgram.team_size} team members. You selected ${selectedStudents.length}.`);
        return;
      }
      
      // Check if team is already assigned to this program
      const existingAssignments = getAssignmentsForProgram(selectedProgram.id);
      if (existingAssignments.length > 0) {
        alert('Your team is already assigned to this program. Remove existing assignments first.');
        return;
      }
    } else {
      // For individual programs, validate participant limit per team
      if (selectedProgram.max_participants) {
        const currentAssignments = getAssignmentsForProgram(selectedProgram.id);
        const currentCount = currentAssignments.length;
        const newCount = selectedStudents.length;
        
        if (currentCount + newCount > selectedProgram.max_participants) {
          alert(`Cannot assign students. This would exceed the maximum participants limit (${selectedProgram.max_participants}). Current: ${currentCount}, New: ${newCount}`);
          return;
        }
      }
      
      // Individual programs can only assign one student at a time
      if (selectedStudents.length !== 1) {
        alert('Individual programs can only assign one student at a time.');
        return;
      }
    }

    try {
      setSubmitting(true);
      
      // For team-based programs, assign all students together
      if (selectedProgram.is_team_based) {
        try {
          await teamManagerAPI.assignStudentsToProgram(
            selectedTeam, 
            selectedProgram.event_id, 
            selectedProgram.id, 
            selectedStudents
          );
          alert(`Successfully assigned ${selectedStudents.length} team members to ${selectedProgram.name}`);
        } catch (err) {
          alert(`Error assigning team: ${err.message}`);
        }
      } else {
        // For individual programs, assign each student individually
        const results = [];
        for (const studentId of selectedStudents) {
          try {
            await teamManagerAPI.assignStudentToProgram(
              selectedTeam, 
              selectedProgram.event_id, 
              selectedProgram.id, 
              studentId
            );
            results.push({ studentId, success: true });
          } catch (err) {
            results.push({ studentId, success: false, error: err.message });
          }
        }
        
        const successCount = results.filter(r => r.success).length;
        const failedCount = results.filter(r => !r.success).length;
        
        if (successCount > 0) {
          alert(`Successfully assigned ${successCount} students to ${selectedProgram.name}`);
        }
        
        if (failedCount > 0) {
          alert(`${failedCount} assignments failed. Please try again.`);
        }
      }
      
      setShowAssignModal(false);
      setSelectedProgram(null);
      setSelectedStudents([]);
      fetchData();
    } catch (error) {
      console.error('Error assigning students:', error);
      alert('Error assigning students. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveAssignment = async (assignment) => {
    if (!window.confirm('Are you sure you want to remove this assignment?')) return;

    try {
      await teamManagerAPI.removeStudentFromProgram(
        selectedTeam,
        assignment.event_id,
        assignment.program_id,
        assignment.student_id
      );
      alert('Assignment removed successfully');
      fetchData();
    } catch (error) {
      console.error('Error removing assignment:', error);
      alert('Error removing assignment. Please try again.');
    }
  };

  const getAvailableStudents = () => {
    if (!selectedProgram) return [];

    // Get students that match the program category and are not already assigned
    const assignedStudentIds = new Set();
    assignments.forEach(assignment => {
      if (assignment.program_id === selectedProgram.id) {
        assignedStudentIds.add(assignment.student_id);
      }
    });

    const availableStudents = teamMembers.filter(student => {
      // For general programs, show all students
      // For category-specific programs, only show students matching that category
      const categoryMatch = selectedProgram.category?.toLowerCase() === 'general' || 
                           student.category?.toLowerCase() === selectedProgram.category?.toLowerCase();
      const notAssigned = !assignedStudentIds.has(student.student_id);
      
      return categoryMatch && notAssigned;
    });

    return availableStudents;
  };

  const getCategoryColor = (category) => {
    switch (category?.toLowerCase()) {
      case 'hs': return 'bg-blue-100 text-blue-800';
      case 'hss': return 'bg-purple-100 text-purple-800';
      case 'primary': return 'bg-green-100 text-green-800';
      case 'general': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getCategoryDisplay = (category) => {
    switch (category?.toLowerCase()) {
      case 'hs': return 'High School';
      case 'hss': return 'Higher Secondary';
      case 'primary': return 'Primary';
      case 'general': return 'General';
      default: return category?.toUpperCase() || 'Unknown';
    }
  };

  const getAssignmentsForProgram = (programId) => {
    return assignments.filter(assignment => assignment.program_id === programId);
  };

  const getCategoryCounts = () => {
    const counts = {};
    teamMembers.forEach(student => {
      const category = student.category?.toLowerCase() || 'unknown';
      counts[category] = (counts[category] || 0) + 1;
    });
    return counts;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-2">Team Assignments</h1>
              <p className="text-gray-600 text-lg">
                Manage program assignments for your team members
              </p>
            </div>
            <div className="bg-white rounded-lg px-4 py-2 shadow-sm border border-gray-200">
              <div className="flex items-center space-x-2">
                <Users className="h-5 w-5 text-blue-500" />
                <span className="text-sm font-medium text-gray-700">{teamMembers.length} Team Members</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Users className="h-6 w-6 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Members</p>
                <p className="text-2xl font-bold text-gray-900">{teamMembers.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-green-100 rounded-lg">
                <Trophy className="h-6 w-6 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Programs</p>
                <p className="text-2xl font-bold text-gray-900">{programs.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-purple-100 rounded-lg">
                <UserPlus className="h-6 w-6 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Assignments</p>
                <p className="text-2xl font-bold text-gray-900">{assignments.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <Calendar className="h-6 w-6 text-yellow-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Events</p>
                <p className="text-2xl font-bold text-gray-900">{events.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Team Members Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Team Members</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teamMembers.map((member) => (
              <div key={member.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium text-gray-900">{member.name}</h3>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(member.category)}`}>
                    {getCategoryDisplay(member.category)}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>ID: {member.student_id}</p>
                  <p>Grade: {member.grade}</p>
                  {member.section && <p>Section: {member.section}</p>}
                  <p>Chest Code: {member.chest_code}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Programs Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Available Programs</h2>
            <button
              onClick={() => setShowAssignModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <UserPlus className="h-4 w-4" />
              <span>Assign Students</span>
            </button>
          </div>

          {programs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {programs.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((program) => {
                const programAssignments = getAssignmentsForProgram(program.id);
                const availableStudents = teamMembers.filter(student => {
                  // For general programs (general category), show all students
                  // For category-specific programs, only show students matching that category
                                      const categoryMatch = program.category?.toLowerCase() === 'general' ||  
                                       student.category?.toLowerCase() === program.category?.toLowerCase();
                  const notAssigned = !programAssignments.some(assignment => assignment.student_id === student.student_id);
                  return categoryMatch && notAssigned;
                });

                return (
                  <div key={program.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-gray-900">{program.name}</h3>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(program.category)}`}>
                        {getCategoryDisplay(program.category)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <p>Event: {program.event_title}</p>
                      <p>Type: {program.is_team_based ? 'Team-Based' : 'Individual'}</p>
                      {program.is_team_based ? (
                        <div>
                          <p>Team Size: {program.team_size || 'Not set'} members</p>
                          <p>Status: {programAssignments.length > 0 ? 'Assigned' : 'Available'}</p>
                        </div>
                      ) : (
                        <div>
                          <p>Assigned: {program.assigned_count}/{program.max_participants || '∞'}</p>
                          <p>Available: {program.available_slots}</p>
                        </div>
                      )}
                    </div>

                    {/* Assigned Students */}
                    {programAssignments.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Assigned Students:</h4>
                        <div className="space-y-1">
                          {programAssignments.map((assignment) => (
                            <div key={assignment.id} className="flex items-center justify-between bg-gray-50 rounded px-2 py-1">
                              <span className="text-sm text-gray-600">{assignment.student_name}</span>
                              <button
                                onClick={() => handleRemoveAssignment(assignment)}
                                className="text-red-600 hover:text-red-800 text-xs"
                              >
                                <UserMinus className="h-3 w-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assignment Actions */}
                    <div className="flex items-center justify-between">
                      <button
                        onClick={() => {
                          setSelectedProgram(program);
                          setShowAssignModal(true);
                        }}
                        disabled={availableStudents.length === 0}
                        className={`flex items-center space-x-1 text-sm ${
                          availableStudents.length > 0 
                            ? 'text-blue-600 hover:text-blue-800' 
                            : 'text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <UserPlus className="h-4 w-4" />
                        <span>Assign ({availableStudents.length} available)</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Trophy className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>No programs available</p>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
                pageSize={pageSize}
                totalCount={totalCount}
              />
            </div>
          )}
        </div>

        {/* Assignment Modal */}
        {showAssignModal && selectedProgram && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Assign Students to {selectedProgram.name}
                </h3>
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedProgram(null);
                    setSelectedStudents([]);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">
                  Select students to assign to this program. Only students matching the program category ({getCategoryDisplay(selectedProgram.category)}) are shown.
                </p>
                {selectedProgram.is_team_based && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-blue-800 font-medium mb-1">Team-Based Program Requirements:</p>
                    <ul className="text-sm text-blue-700 space-y-1">
                      <li>• All selected team members will participate together</li>
                      <li>• Team size: {selectedProgram.team_size || 'Not set'} members (exact requirement)</li>
                      <li>• Only one team assignment per program</li>
                    </ul>
                  </div>
                )}
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto">
                {getAvailableStudents().map((student) => (
                  <label key={student.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={selectedStudents.includes(student.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedStudents([...selectedStudents, student.id]);
                        } else {
                          setSelectedStudents(selectedStudents.filter(id => id !== student.id));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">{student.name}</p>
                      <p className="text-xs text-gray-600">
                        {student.student_id} • Grade {student.grade} • {student.section}
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              {getAvailableStudents().length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                  <p>No available students for this program</p>
                </div>
              )}

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setShowAssignModal(false);
                    setSelectedProgram(null);
                    setSelectedStudents([]);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignStudents}
                  disabled={selectedStudents.length === 0 || submitting}
                  className={`px-4 py-2 rounded-lg flex items-center space-x-2 ${
                    selectedStudents.length === 0 || submitting
                      ? 'bg-gray-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {submitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Assigning...</span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      <span>Assign {selectedStudents.length} Students</span>
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

export default TeamAssignments;
