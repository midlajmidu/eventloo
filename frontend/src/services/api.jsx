import axios from 'axios';
import { getApiBaseUrl, getApiBaseUrlWithApi, createSafeApiUrl, debugApiConfig, getApiTimeout } from '../utils/apiUtils';

// Use the safe API base URL with /api included
const API_BASE_URL = getApiBaseUrlWithApi();

// Debug logging to help identify URL issues
debugApiConfig();

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  // Add timeout and additional settings for Chrome compatibility
  timeout: getApiTimeout(),
  withCredentials: true,
});

// Create a separate axios instance for report downloads (no auth)
const reportApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
  },
  timeout: getApiTimeout(),
  withCredentials: true,
});


// Handle 401 on reportApi by refreshing token once, then retrying
reportApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/token/refresh/')) {
      originalRequest._retry = true;
      try {
          await axios.post(
            `${API_BASE_URL}token/refresh/`, {}, {
              withCredentials: true,
              headers: { 'X-Requested-With': 'XMLHttpRequest' },
            }
          );
          return reportApi(originalRequest);
      } catch (refreshError) {
          // Clear and redirect to login on refresh failure
          const loginPath = localStorage.getItem('user_role') === 'super_admin' ? '/super-admin/login' : '/login';
          localStorage.removeItem('access_token');
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_role');
          localStorage.removeItem('user');
          if (window.location.pathname !== loginPath) {
            window.location.href = loginPath;
          }
          return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);


// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestPath = String(originalRequest?.url || '');
    const isAuthenticationRequest = [
      'token/',
      'team-manager/login/',
      'super-admin/login/',
      'mfa/setup/',
      'mfa/confirm/',
      'super-admin/mfa/',
    ].some((path) => requestPath.includes(path));
    
    // Prevent infinite loops by checking if this is already a retry
    if (
      error.response?.status === 401
      && !originalRequest._retry
      && !requestPath.includes('token/refresh/')
      && !isAuthenticationRequest
    ) {
      originalRequest._retry = true;
      
      try {
          // Use a fresh axios instance to avoid interceptors
          await axios.post(
            `${API_BASE_URL}token/refresh/`, {}, {
              withCredentials: true,
              headers: { 'X-Requested-With': 'XMLHttpRequest' },
            }
          );
          
          return api(originalRequest);
      } catch (refreshError) {
          // Clear all auth data
          const loginPath = localStorage.getItem('user_role') === 'super_admin' ? '/super-admin/login' : '/login';
          localStorage.removeItem('access_token');
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_role');
          localStorage.removeItem('user');
          
          // Only redirect if not already on login page
          if (window.location.pathname !== loginPath) {
            window.location.href = loginPath;
          }
          return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('token/', {
    email: credentials.email,
    password: credentials.password,
    ...(credentials.school_code ? { school_code: credentials.school_code } : {}),
    ...(credentials.otp ? { otp: credentials.otp } : {}),
  }),
  setupMfa: (credentials) => api.post('mfa/setup/', credentials),
  confirmMfa: (credentials) => api.post('mfa/confirm/', credentials),
  teamManagerLogin: (credentials) => api.post('team-manager/login/', credentials),
  logout: async () => {
    try {
      await api.post('logout/', {});
    } catch (_) {
      // Local cleanup still happens when the token is expired or already revoked.
    }
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user');
    localStorage.removeItem('team_data');
    localStorage.removeItem('access_type');
    localStorage.removeItem('team_welcome_message');
    localStorage.removeItem('school_data');
    sessionStorage.clear();
  },
  refreshToken: () => api.post('token/refresh/', {}),
  getProfile: () => api.get('profile/'),
  getUserProfile: () => api.get('profile/'),
  // Utility function to clear auth state
  clearAuthState: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user');
    localStorage.removeItem('team_data');
    localStorage.removeItem('access_type');
    localStorage.removeItem('team_welcome_message');
    localStorage.removeItem('school_data');
    sessionStorage.clear();
  },
};

export const superAdminAPI = {
  login: (credentials) => api.post('super-admin/login/', credentials),
  setupMfa: (credentials) => api.post('super-admin/mfa/setup/', credentials),
  confirmMfa: (credentials) => api.post('super-admin/mfa/confirm/', credentials),
  dashboard: () => api.get('super-admin/dashboard/'),
  schools: (params = {}) => api.get('super-admin/schools/', { params }),
  createSchool: (data) => api.post('super-admin/schools/', data),
  updateSchool: (id, data) => api.patch(`super-admin/schools/${id}/`, data),
  deleteSchool: (id, confirmName) => api.delete(`super-admin/schools/${id}/`, {
    data: { confirm_name: confirmName },
  }),
  admins: (schoolId) => api.get(`super-admin/schools/${schoolId}/admins/`),
  createAdmin: (schoolId, data) => api.post(`super-admin/schools/${schoolId}/admins/`, data),
  resetAdminPassword: (schoolId, data) => api.post(
    `super-admin/schools/${schoolId}/reset-admin-password/`, data
  ),
  resetStaffMfa: (schoolId, data) => api.post(
    `super-admin/schools/${schoolId}/reset-staff-mfa/`, data
  ),
  schoolEvents: (schoolId) => api.get(`super-admin/schools/${schoolId}/events/`),
  allAdmins: () => api.get('super-admin/schools/all-admins/'),
  allEvents: () => api.get('super-admin/schools/all-events/'),
};

// Dashboard API
export const dashboardAPI = {
  // Get admin dashboard summary
  getAdminSummary: () => api.get('admin/dashboard/summary/'),
  
  // Get team manager dashboard
  getTeamManagerDashboard: () => api.get('team-manager/dashboard/'),
  getTeamManagerSummary: () => api.get('team-manager/dashboard/'),
};

export const usersAPI = {
  list: (params = {}) => api.get('users/', { params }),
  summary: () => api.get('users/summary/'),
  create: (data) => api.post('users/', data),
  update: (id, data) => api.patch(`users/${id}/`, data),
  remove: (id) => api.delete(`users/${id}/`),
};



// Events API
export const eventsAPI = {
  // Generic get method for custom endpoints
  get: (url) => api.get(url),
  
  // Get all events
  getEvents: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    return api.get(`events/?${queryParams.toString()}`);
  },
  
  // Get a specific event
  getEvent: (id) => api.get(`events/${id}/`),
  
  // Create a new event
  createEvent: (data) => api.post('events/', data),
  
  // Update an event
  updateEvent: (id, data) => api.put(`events/${id}/`, data),
  
  // Delete an event
  deleteEvent: (id) => api.delete(`events/${id}/`),
  
  // Get event analytics
  getEventAnalytics: (eventId) => api.get(`events/${eventId}/analytics/`),
  
  // Get event programs
  getEventPrograms: (eventId, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    return api.get(`events/${eventId}/programs/?${queryParams.toString()}`);
  },
  
  // Create event program
  createEventProgram: (eventId, data) => api.post(`events/${eventId}/programs/`, data),
  
  // Get category-wise top performers for individual programs
  getCategoryTopPerformers: (eventId) => api.get(`events/${eventId}/category_top_performers/`),
  
  // Get top scorers with optional toggle filters (include_team_based, include_general_category, etc.)
  getTopScorers: (eventId, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== null) {
        queryParams.append(key, params[key]);
      }
    });
    return api.get(`events/${eventId}/top_scorers/?${queryParams.toString()}`);
  },
  
  // Download program template for bulk upload
  downloadProgramTemplate: (eventId) => 
    api.get(`events/${eventId}/download_program_template/`, { responseType: 'blob' }),
  
  // Bulk upload programs
  bulkUploadPrograms: (eventId, formData) => 
    api.post(`events/${eventId}/bulk_upload_programs/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  // Report generation methods (using non-authenticated API)
  
  
  generateProgramDetailsReport: (eventId) => 
    reportApi.get(`events/${eventId}/reports/program-details/`, { responseType: 'blob' }),
  
  generateCompleteResultsReport: (eventId) => 
    reportApi.get(`events/${eventId}/reports/complete-results/`, { responseType: 'blob' }),
  
  generateFirstPlaceReport: (eventId) => 
    reportApi.get(`events/${eventId}/reports/first-place/`, { responseType: 'blob' }),
  
  generateSecondPlaceReport: (eventId) => 
    reportApi.get(`events/${eventId}/reports/second-place/`, { responseType: 'blob' }),
  
  generateThirdPlaceReport: (eventId) => 
    reportApi.get(`events/${eventId}/reports/third-place/`, { responseType: 'blob' }),
  
  generateAllResultsReport: (eventId) => 
    reportApi.get(`events/${eventId}/reports/all-results/`, { responseType: 'blob' }),
  
    generateParticipantsTeamReport: (eventId) =>
    reportApi.get(`events/${eventId}/reports/participants-team/`, { responseType: 'blob' }),
  
  generateEventBackup: (eventId) => 
    reportApi.get(`events/${eventId}/reports/backup/`, { responseType: 'blob' }),
  
  generateAllEventsReport: () => 
    reportApi.get('events/reports/all-events/', { responseType: 'blob' }),
  
  // Executable report generation methods
  generateProgramDetailsExecutable: (eventId) => 
    reportApi.get(`events/${eventId}/reports/program-details-executable/`, { responseType: 'blob' }),
  
  generateCompleteResultsExecutable: (eventId) => 
    reportApi.get(`events/${eventId}/reports/complete-results-executable/`, { responseType: 'blob' }),
  
    generateParticipantsTeamExecutable: (eventId) =>
    reportApi.get(`events/${eventId}/reports/participants-team-executable/`, { responseType: 'blob' }),

  // Get chest numbers / assigned participants for an event
  getChestNumbers: (eventId) => api.get(`events/${eventId}/chest_numbers/`),
};

// Programs API
export const programsAPI = {
  // Get all programs
  getPrograms: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    return api.get(`programs/?${queryParams.toString()}`);
  },
  
  // Create a new program
  createProgram: (data) => api.post('programs/', data),
  
  // Update a program
  updateProgram: (id, data) => api.put(`programs/${id}/`, data),
  
  // Delete a program
  deleteProgram: (id) => api.delete(`programs/${id}/`),
  
  // Get program assignments
  getProgramAssignments: (programId) => api.get(`programs/${programId}/assignments/`),
  
  // Create program assignment
  createProgramAssignment: (programId, data) => api.post(`programs/${programId}/assignments/`, data),
};

// Students API
export const studentsAPI = {
  // Get all students
  getStudents: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    return api.get(`students/?${queryParams.toString()}`);
  },
  
  // Get a specific student
  getStudent: (id) => api.get(`students/${id}/`),
  
  // Create a new student
  createStudent: (data) => api.post('students/', data),
  
  // Update a student
  updateStudent: (id, data) => api.put(`students/${id}/`, data),
  
  // Delete a student
  deleteStudent: (id) => api.delete(`students/${id}/`),
  
  // Assign student to team
  assignToTeam: (studentId, data) => api.post(`students/${studentId}/assign_to_team/`, data),
  
  // Remove student from team
  removeFromTeam: (studentId) => api.post(`students/${studentId}/remove_from_team/`),
  
  // Get student's program assignments
  getProgramAssignments: (studentId) => api.get(`students/${studentId}/program_assignments/`),
  
  // Get student's program results
  getProgramResults: (studentId) => api.get(`students/${studentId}/program_results/`),
  
  // Get student's points history
  getPointsHistory: (studentId) => api.get(`students/${studentId}/points_history/`),
  
  // Get student's participation history
  getStudentParticipationHistory: (studentId) => api.get(`students/${studentId}/participation_history/`),
  
  // Bulk operations
  bulkCreateStudents: (data) => api.post('students/bulk_create/', data),
  bulkUpdateStudents: (data) => api.post('students/bulk_update/', data),
  bulkUpload: (formData) => api.post('students/bulk_upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  // Download template
  downloadTemplate: () => api.get('students/download_template/', { responseType: 'blob' }),
};

// Teams API
export const teamsAPI = {
  // Get all teams
  getTeams: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.event) queryParams.append('event', params.event);
    
    return api.get(`teams/?${queryParams.toString()}`);
  },
  
  // Get a specific team
  getTeam: (id) => api.get(`teams/${id}/`),
  
  // Create a new team
  createTeam: (data) => api.post('teams/', data),
  
  // Update a team
  updateTeam: (id, data) => api.put(`teams/${id}/`, data),
  
  // Delete a team
  deleteTeam: (id) => api.delete(`teams/${id}/`),
  
  // Add member to team
  addMember: (teamId, data) => api.post(`teams/${teamId}/add_member/`, data),
  
  // Remove member from team
  removeMember: (teamId, data) => api.post(`teams/${teamId}/remove_member/`, data),
  
  // Get team credentials (admin only)
  getCredentials: (teamId) => api.get(`teams/${teamId}/credentials/`),
  
  // Set custom team credentials (admin only)
  setCredentials: (teamId, data) => api.post(`teams/${teamId}/credentials/`, data),

  // Regenerate team credentials (admin only)
  regenerateCredentials: (teamId) => api.post(`teams/${teamId}/regenerate_credentials/`),
  
  // Get comprehensive team details
  getComprehensiveDetails: (teamId) => api.get(`teams/${teamId}/comprehensive_details/`),
  
  // Generate team list PDF
  generateTeamListPDF: (eventId, teamId) => api.get(`events/${eventId}/teams/${teamId}/program-list-pdf/`, { responseType: 'blob' }),
};

// Points API
export const pointsAPI = {
  // Get all points records
  getPoints: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    return api.get(`points/?${queryParams.toString()}`);
  },
  
  // Get all points records (alias for getPoints)
  getPointsRecords: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    return api.get(`points/?${queryParams.toString()}`);
  },
  
  // Get leaderboard with global points calculation
  getLeaderboard: () => api.get('points/leaderboard/'),
  
  // Get student details
  getStudentDetails: (studentId) => api.get(`points/${studentId}/student_details/`),
  
};

// Team Manager API
export const teamManagerAPI = {
  // Get teams managed by the current team manager
  getMyTeams: () => api.get('team-manager/my_teams/'),
  
  // Get available programs for team manager's teams
  getAvailablePrograms: (queryParams = '') => {
    const url = queryParams ? `team-manager/available_programs/?${queryParams}` : 'team-manager/available_programs/';
    return api.get(url);
  },
  
  // Assign team members to a program
  assignToProgram: (data) => api.post('team-manager/assign_to_program/', data),
  
  // Get all program assignments for team manager's teams
  getTeamAssignments: () => api.get('team-manager/team_assignments/'),
  
  // Remove a program assignment
  removeAssignment: (assignmentId) => api.delete('team-manager/remove_assignment/', { 
    data: { assignment_id: assignmentId } 
  }),
  
  // Get team manager dashboard data
  getDashboard: () => api.get('team-manager/dashboard/'),
  getTeamManagerSummary: () => api.get('team-manager/dashboard/'),
  
  // Get global points leaderboard for team manager's teams
  getLeaderboard: () => api.get('team-manager/leaderboard/'),
  
  // New functions for team login dashboard
  // Get team's students
  getTeamStudents: (teamId) => api.get(`team-manager/${teamId}/students/`),
  
  // Get team's events
  getTeamEvents: (teamId) => api.get(`team-manager/${teamId}/events/`),
  
  // Get programs for a specific event
  getEventPrograms: (teamId, eventId) => {
    const url = `team-manager/${teamId}/events/${eventId}/programs/`;
    return api.get(url);
  },
  
  // Assign student to program
  assignStudentToProgram: (teamId, eventId, programId, studentId) => 
    api.post(`team-manager/${teamId}/events/${eventId}/programs/${programId}/assign/`, { student_id: studentId }),
  
  // Assign multiple students to program (for team-based programs)
  assignStudentsToProgram: (teamId, eventId, programId, studentIds, subTeamNumber = 1, leaderId = null) => 
    api.post(`team-manager/${teamId}/events/${eventId}/programs/${programId}/assign/`, { 
      student_ids: studentIds,
      sub_team_number: subTeamNumber,
      ...(leaderId ? { leader_id: leaderId } : {})
    }),
  
  // Remove assignment by assignment ID
  removeAssignmentById: (teamId, assignmentId) => 
    api.delete(`team-manager/${teamId}/assignments/${assignmentId}/remove/`),
  
  // Remove student from program by student ID and program ID
  removeStudentFromProgram: (teamId, eventId, programId, studentId) => 
    api.delete(`team-manager/${teamId}/events/${eventId}/programs/${programId}/students/${studentId}/remove/`),
  
  // Set sub-team leader
  setSubTeamLeader: (teamId, eventId, programId, studentId, subTeamNumber = 1) =>
    api.post(`team-manager/${teamId}/events/${eventId}/programs/${programId}/set-leader/`, {
      student_id: studentId,
      sub_team_number: subTeamNumber
    }),
  
  // Get team profile
  getTeamProfile: (teamId) => api.get(`team-manager/profile/${teamId}/`),
  
  // Get student points for a specific event
  getStudentPoints: (eventId) => api.get(`events/${eventId}/points/students/`),
};

// Green Room Sign Export API
export const eventGreenRoomAPI = {
  generateGreenRoomSign: (eventId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return reportApi.get(`events/${eventId}/green-room-sign/?${queryString}`, { responseType: 'blob' });
  }
};

// Valuation Sheet Export API
export const eventValuationAPI = {
  generateValuationSheet: (eventId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return reportApi.get(`events/${eventId}/valuation-sheet/?${queryString}`, { responseType: 'blob' });
  }
};

// Call List Export API
export const eventCallListAPI = {
  generateCallList: (eventId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return reportApi.get(`events/${eventId}/call-list/?${queryString}`, { responseType: 'blob' });
  }
};


// Legacy API exports for backward compatibility with existing Event components
export const eventProgramsAPI = {
  getPrograms: (eventId, queryParams = '') => {
    const url = queryParams ? `events/${eventId}/programs/?${queryParams}` : `events/${eventId}/programs/`;
    return api.get(url);
  },
  createProgram: (eventId, data) => {
    // Use direct route instead of nested route due to router issue
    return api.post(`programs/`, { ...data, event: eventId });
  },
  updateProgram: (eventId, programId, data) => api.put(`events/${eventId}/programs/${programId}/`, data),
  deleteProgram: (eventId, programId) => api.delete(`events/${eventId}/programs/${programId}/`),
  getProgramDetails: (eventId, programId) => api.get(`events/${eventId}/programs/${programId}/`),
  
  // Mark program as finished/unfinished
  markProgramFinished: (eventId, programId, action) => 
    api.post(`events/${eventId}/programs/${programId}/${action}/`),
  
  // Get programs by category
  getProgramsByCategory: (eventId) => api.get(`events/${eventId}/programs/by_category/`),
  
  // Get programs by time status
  getProgramsByTimeStatus: (eventId) => api.get(`events/${eventId}/programs/by_time_status/`),
  
  // Get category counts
  getCategoryCounts: (eventId) => api.get(`events/${eventId}/programs/category_counts/`),

  // Get chest numbers / assigned participants for an event
  getChestNumbers: (eventId) => api.get(`events/${eventId}/chest_numbers/`),
};

export const eventStagesAPI = {
  list: (eventId, params = {}) => api.get(`events/${eventId}/stages/`, { params }),
  create: (eventId, data) => api.post(`events/${eventId}/stages/`, data),
  update: (eventId, stageId, data) => api.patch(`events/${eventId}/stages/${stageId}/`, data),
  remove: (eventId, stageId) => api.delete(`events/${eventId}/stages/${stageId}/`),
};

export const eventScheduleAPI = {
  update: (eventId, programId, data) => api.patch(
    `events/${eventId}/programs/${programId}/schedule/`, data
  ),
  export: (eventId, format) => api.get(
    `events/${eventId}/schedule-export/`, { params: { export_format: format }, responseType: 'blob' }
  ),
};

// Event Assignments API
export const eventAssignmentsAPI = {
  // Get assignments for a specific program
  getProgramAssignments: (eventId, programId) => api.get(`events/${eventId}/programs/${programId}/assignments/`),
  
  // Get all assignments for an event
  getEventAssignments: async (eventId) => {
    // First get all programs for the event
    const programsRes = await api.get(`events/${eventId}/programs/?page_size=1000`);
    const programs = programsRes.data.results || programsRes.data;
    
    // Then get assignments for each program
    const allAssignments = [];
    for (const program of programs) {
      try {
        const assignmentsRes = await api.get(`events/${eventId}/programs/${program.id}/assignments/`);
        const assignments = assignmentsRes.data.results || assignmentsRes.data;
        
        // Add program info to each assignment
        assignments.forEach(assignment => {
          assignment.program_id = program.id;
          assignment.program_name = program.name;
          assignment.program_category = program.category;
        });
        allAssignments.push(...assignments);
      } catch (error) {
        console.warn(`Failed to get assignments for program ${program.id}:`, error);
      }
    }
    
    return { data: allAssignments };
  },
  
  // Assign students to a program (bulk assignment)
  assignStudents: (eventId, programId, data) => api.post(`events/${eventId}/programs/${programId}/assignments/bulk_assign/`, data),
  
  // Assign all students in a category to a program
  assignAllCategory: (eventId, programId, category) => api.post(`events/${eventId}/programs/${programId}/assignments/assign_all_category/`, { category }),
  
  // Remove a specific assignment
  deleteAssignment: (eventId, programId, assignmentId) => api.delete(`events/${eventId}/programs/${programId}/assignments/${assignmentId}/`),
  
  // Get available students
  getAvailableStudents: (params) => api.get('students/', { params }),
};

// Event Results API
export const eventResultsAPI = {
  getProgramResults: (programId) => api.get(`programs/${programId}/results/`),
  enterResults: (programId, data) => api.post(`programs/${programId}/results/`, data),
  updateResults: (programId, resultId, data) => api.put(`programs/${programId}/results/${resultId}/`, data),
  generateResultsPDF: (programId) => api.get(`programs/${programId}/results/pdf/`, { responseType: 'blob' }),
  generateBulkResultsPDF: (eventId) => api.get(`events/${eventId}/results/bulk-pdf/`, { responseType: 'blob' }),
  toggleProgramPublish: (eventId, programId, isPublished) => api.post(`events/${eventId}/toggle_program_publish/`, { program_id: programId, is_published: isPublished }),
  publishAllResults: (eventId) => api.post(`events/${eventId}/publish_all_results/`),
};

// Event Calling Sheet API
export const eventCallingSheetAPI = {
  getProgramParticipants: (programId) => api.get(`programs/${programId}/participants/`),
  generateCallingSheet: (programId) => api.get(`programs/${programId}/calling-sheet/`, { responseType: 'blob' }),
  generateFormattedCallingSheet: (programId) => api.get(`programs/${programId}/formatted-calling-sheet/`, { responseType: 'blob' }),
  generateFormattedEvaluationSheet: (programId) => api.get(`programs/${programId}/formatted-evaluation-sheet/`, { responseType: 'blob' }),
  generateBulkCallingSheets: (eventId) => api.get(`events/${eventId}/calling-sheets/bulk/`, { responseType: 'blob' }),
  
  // Chest number search functionality
  searchByChestNumber: (eventId, chestNumber) => api.get(`events/${eventId}/search_by_chest_number/?chest_number=${chestNumber}`),
  getEventChestNumbers: (eventId) => api.get(`events/${eventId}/chest_numbers/`),
};

// Event Valuation Sheet API
export const eventValuationSheetAPI = {
  generateValuationSheet: (programId) => api.get(`programs/${programId}/valuation-sheet/`, { responseType: 'blob' }),
  generateBulkValuationSheets: (eventId) => api.get(`events/${eventId}/valuation-sheets/bulk/`, { responseType: 'blob' }),
};

// Event Points API
export const eventPointsAPI = {
  getEventTeamPoints: (eventId, publishedOnly = true) => api.get(`events/${eventId}/points_teams/?include_unpublished=${!publishedOnly}`),
  getEventStudentPoints: (eventId) => api.get(`events/${eventId}/points/students/`),
  getTeamEventDetails: (teamId, eventId) => api.get(`teams/${teamId}/events/${eventId}/details/`),
};

// Event Certificates API
export const eventCertificatesAPI = {
  getTemplates: (eventId) => api.get(`events/${eventId}/certificate-templates/`),
  updateTemplate: (eventId, certificateType, data) => api.put(
    `events/${eventId}/certificate-templates/${certificateType}/`,
    data,
    data instanceof FormData ? { headers: { 'Content-Type': 'multipart/form-data' } } : undefined
  ),
  resetTemplate: (eventId, certificateType) => api.delete(
    `events/${eventId}/certificate-templates/${certificateType}/`
  ),
  getPreviewData: (eventId, certificateType, programId = 'all') => api.get(
    `events/${eventId}/certificate-preview-data/`,
    { params: { certificate_type: certificateType, program_id: programId } }
  ),
  generateCertificates: (eventId, params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return reportApi.get(`events/${eventId}/certificates/?${queryString}`, { responseType: 'blob' });
  }
};

// Event Reports API
export const eventReportsAPI = {
  getEventAnalytics: (eventId) => api.get(`events/${eventId}/analytics/`),
  generateReport: (eventId, reportType) => api.get(`events/${eventId}/reports/${reportType}/`, { responseType: 'blob' }),
  exportEventData: (eventId, format) => api.get(`events/${eventId}/export/${format}/`, { responseType: 'blob' }),
};

// Mark Entry and Results API
export const markEntryAPI = {
  // Get participants for mark entry
  getParticipants: (eventId, programId) =>
    api.get(`events/${eventId}/programs/${programId}/results/mark_entry/`),
  
  // Bulk update marks
  bulkUpdateMarks: (eventId, programId, marksData, entryStatus = 'submitted', confirmPublishedEdit = false) =>
    api.post(`events/${eventId}/programs/${programId}/results/bulk_mark_entry/`, {
      marks: marksData,
      entry_status: entryStatus,
      confirm_published_edit: confirmPublishedEdit,
    }),
  
  // Get results summary
  getResultsSummary: (eventId, programId) =>
    api.get(`events/${eventId}/programs/${programId}/results/results_summary/`),
  
  // Generate PDF report
  generatePDF: (eventId, programId) =>
    api.get(`events/${eventId}/programs/${programId}/results/results_pdf/`, {
      responseType: 'blob'
    })
};

// Announcements API
export const announcementsAPI = {
  getAnnouncements: async (params = {}) => {
    const response = await api.get('announcements/', { params });
    return response.data;
  },
  
  createAnnouncement: async (eventId, data) => {
    const response = await api.post(`events/${eventId}/create_announcement/`, data);
    return response.data;
  },
};

// School Settings API
export const schoolSettingsAPI = {
  get: () => api.get('schoolsettings/1/'),
  update: (data) => {
    if (data instanceof FormData) {
      return api.put('schoolsettings/1/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put('schoolsettings/1/', data);
  },
};

// Categories API
export const categoriesAPI = {
  list: () => api.get('categories/'),
  create: (data) => api.post('categories/', data),
  update: (id, data) => api.put(`categories/${id}/`, data),
  delete: (id) => api.delete(`categories/${id}/`),
};

// Classes API
export const classesAPI = {
  list: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.category) queryParams.append('category', params.category);
    return api.get(`classes/?${queryParams.toString()}`);
  },
  create: (data) => api.post('classes/', data),
  update: (id, data) => api.put(`classes/${id}/`, data),
  delete: (id) => api.delete(`classes/${id}/`),
};

// Export default api instance for custom requests
export default api; 
