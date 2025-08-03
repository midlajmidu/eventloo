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
  },
  // Add timeout and additional settings for Chrome compatibility
  timeout: getApiTimeout(),
  withCredentials: false, // Disable credentials for CORS
});

// Create a separate axios instance for report downloads (no auth)
const reportApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: getApiTimeout(),
  withCredentials: false,
});

// Debug interceptor for report API
reportApi.interceptors.request.use(
  (config) => {
    console.log('📄 Making report request to:', config.url);
    console.log('📄 Full URL:', config.baseURL + config.url);
    return config;
  },
  (error) => {
    console.error('📄 Report request error:', error);
    return Promise.reject(error);
  }
);

// Debug interceptor to log all requests
api.interceptors.request.use(
  (config) => {
    console.log('🔧 Making request to:', config.url);
    console.log('🔧 Full URL:', config.baseURL + config.url);
    return config;
  },
  (error) => {
    console.error('🔧 Request error:', error);
    return Promise.reject(error);
  }
);

// Request interceptor to add auth token (updated to work with debug interceptor)
const authInterceptor = (config) => {
  const token = localStorage.getItem('access_token') || localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
};

// Add auth interceptor after debug interceptor
api.interceptors.request.use(authInterceptor, (error) => Promise.reject(error));

// Response interceptor to handle auth errors
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // Prevent infinite loops by checking if this is already a retry
    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url.includes('/token/refresh/')) {
      originalRequest._retry = true;
      
      const refreshToken = localStorage.getItem('refresh_token');
      if (refreshToken) {
        try {
          // Use a fresh axios instance to avoid interceptors
          const refreshResponse = await axios.post(`${API_BASE_URL}/token/refresh/`, {
            refresh: refreshToken
          });
          
          const { access } = refreshResponse.data;
          localStorage.setItem('access_token', access);
          localStorage.setItem('token', access); // Keep both for compatibility
          
          // Update the original request with new token
          originalRequest.headers.Authorization = `Bearer ${access}`;
          return api(originalRequest);
        } catch (refreshError) {
          console.log('Token refresh failed, redirecting to login');
          // Clear all auth data
          localStorage.removeItem('access_token');
          localStorage.removeItem('token');
          localStorage.removeItem('refresh_token');
          localStorage.removeItem('user_role');
          localStorage.removeItem('user');
          
          // Only redirect if not already on login page
          if (window.location.pathname !== '/login') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      } else {
        console.log('No refresh token found, redirecting to login');
        // Clear all auth data
        localStorage.removeItem('access_token');
        localStorage.removeItem('token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_role');
        localStorage.removeItem('user');
        
        // Only redirect if not already on login page
        if (window.location.pathname !== '/login') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (credentials) => api.post('/token/', credentials),
  teamManagerLogin: (credentials) => api.post('/team-manager/login/', credentials),
  logout: () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user');
    localStorage.removeItem('team_data');
    localStorage.removeItem('access_type');
    localStorage.removeItem('team_welcome_message');
    return Promise.resolve();
  },
  refreshToken: (refreshToken) => api.post('/token/refresh/', { refresh: refreshToken }),
  getProfile: () => api.get('/profile/'),
  getUserProfile: () => api.get('/profile/'),
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
  },
};

// Dashboard API
export const dashboardAPI = {
  // Get admin dashboard summary
  getAdminSummary: () => api.get('/admin/dashboard/summary/'),
  
  // Get team manager dashboard
  getTeamManagerDashboard: () => api.get('/team-manager/dashboard/'),
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
    return api.get(`/events/?${queryParams.toString()}`);
  },
  
  // Get a specific event
  getEvent: (id) => api.get(`/events/${id}/`),
  
  // Create a new event
  createEvent: (data) => api.post('/events/', data),
  
  // Update an event
  updateEvent: (id, data) => api.put(`/events/${id}/`, data),
  
  // Delete an event
  deleteEvent: (id) => api.delete(`/events/${id}/`),
  
  // Get event analytics
  getEventAnalytics: (eventId) => api.get(`/events/${eventId}/analytics/`),
  
  // Get event programs
  getEventPrograms: (eventId, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    return api.get(`/events/${eventId}/programs/?${queryParams.toString()}`);
  },
  
  // Create event program
  createEventProgram: (eventId, data) => api.post(`/events/${eventId}/programs/`, data),
  
  // Get category-wise top performers for individual programs
  getCategoryTopPerformers: (eventId) => api.get(`/events/${eventId}/category_top_performers/`),
  
  // Download program template for bulk upload
  downloadProgramTemplate: (eventId) => 
    api.get(`/events/${eventId}/download_program_template/`, { responseType: 'blob' }),
  
  // Bulk upload programs
  bulkUploadPrograms: (eventId, formData) => 
    api.post(`/events/${eventId}/bulk_upload_programs/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    }),
  
  // Report generation methods (using non-authenticated API)
  
  
  generateProgramDetailsReport: (eventId) => 
    reportApi.get(`/events/${eventId}/reports/program-details/`, { responseType: 'blob' }),
  
  generateCompleteResultsReport: (eventId) => 
    reportApi.get(`/events/${eventId}/reports/complete-results/`, { responseType: 'blob' }),
  
  generateFirstPlaceReport: (eventId) => 
    reportApi.get(`/events/${eventId}/reports/first-place/`, { responseType: 'blob' }),
  
  generateSecondPlaceReport: (eventId) => 
    reportApi.get(`/events/${eventId}/reports/second-place/`, { responseType: 'blob' }),
  
  generateThirdPlaceReport: (eventId) => 
    reportApi.get(`/events/${eventId}/reports/third-place/`, { responseType: 'blob' }),
  
  generateAllResultsReport: (eventId) => 
    reportApi.get(`/events/${eventId}/reports/all-results/`, { responseType: 'blob' }),
  
    generateParticipantsTeamReport: (eventId) =>
    reportApi.get(`/events/${eventId}/reports/participants-team/`, { responseType: 'blob' }),
  
  generateEventBackup: (eventId) => 
    reportApi.get(`/events/${eventId}/reports/backup/`, { responseType: 'blob' }),
  
  generateAllEventsReport: () => 
    reportApi.get('/events/reports/all-events/', { responseType: 'blob' }),
  
  // Executable report generation methods
  generateProgramDetailsExecutable: (eventId) => 
    reportApi.get(`/events/${eventId}/reports/program-details-executable/`, { responseType: 'blob' }),
  
  generateCompleteResultsExecutable: (eventId) => 
    reportApi.get(`/events/${eventId}/reports/complete-results-executable/`, { responseType: 'blob' }),
  
    generateParticipantsTeamExecutable: (eventId) =>
    reportApi.get(`/events/${eventId}/reports/participants-team-executable/`, { responseType: 'blob' }),
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
    return api.get(`/programs/?${queryParams.toString()}`);
  },
  
  // Create a new program
  createProgram: (data) => api.post('/programs/', data),
  
  // Update a program
  updateProgram: (id, data) => api.put(`/programs/${id}/`, data),
  
  // Delete a program
  deleteProgram: (id) => api.delete(`/programs/${id}/`),
  
  // Get program assignments
  getProgramAssignments: (programId) => api.get(`/programs/${programId}/assignments/`),
  
  // Create program assignment
  createProgramAssignment: (programId, data) => api.post(`/programs/${programId}/assignments/`, data),
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
    return api.get(`/students/?${queryParams.toString()}`);
  },
  
  // Get a specific student
  getStudent: (id) => api.get(`/students/${id}/`),
  
  // Create a new student
  createStudent: (data) => api.post('/students/', data),
  
  // Update a student
  updateStudent: (id, data) => api.put(`/students/${id}/`, data),
  
  // Delete a student
  deleteStudent: (id) => api.delete(`/students/${id}/`),
  
  // Assign student to team
  assignToTeam: (studentId, data) => api.post(`/students/${studentId}/assign_to_team/`, data),
  
  // Remove student from team
  removeFromTeam: (studentId) => api.post(`/students/${studentId}/remove_from_team/`),
  
  // Get student's program assignments
  getProgramAssignments: (studentId) => api.get(`/students/${studentId}/program_assignments/`),
  
  // Get student's program results
  getProgramResults: (studentId) => api.get(`/students/${studentId}/program_results/`),
  
  // Get student's points history
  getPointsHistory: (studentId) => api.get(`/students/${studentId}/points_history/`),
  
  // Get student's participation history
  getStudentParticipationHistory: (studentId) => api.get(`/students/${studentId}/participation_history/`),
  
  // Bulk operations
  bulkCreateStudents: (data) => api.post('/students/bulk_create/', data),
  bulkUpdateStudents: (data) => api.post('/students/bulk_update/', data),
  bulkUpload: (formData) => api.post('/students/bulk_upload/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  }),
  
  // Download template
  downloadTemplate: () => api.get('/students/download_template/', { responseType: 'blob' }),
};

// Teams API
export const teamsAPI = {
  // Get all teams
  getTeams: (params = {}) => {
    const queryParams = new URLSearchParams();
    if (params.search) queryParams.append('search', params.search);
    if (params.event) queryParams.append('event', params.event);
    
    return api.get(`/teams/?${queryParams.toString()}`);
  },
  
  // Get a specific team
  getTeam: (id) => api.get(`/teams/${id}/`),
  
  // Create a new team
  createTeam: (data) => api.post('/teams/', data),
  
  // Update a team
  updateTeam: (id, data) => api.put(`/teams/${id}/`, data),
  
  // Delete a team
  deleteTeam: (id) => api.delete(`/teams/${id}/`),
  
  // Add member to team
  addMember: (teamId, data) => api.post(`/teams/${teamId}/add_member/`, data),
  
  // Remove member from team
  removeMember: (teamId, data) => api.post(`/teams/${teamId}/remove_member/`, data),
  
  // Get team credentials (admin only)
  getCredentials: (teamId) => api.get(`/teams/${teamId}/credentials/`),
  
  // Regenerate team credentials (admin only)
  regenerateCredentials: (teamId) => api.post(`/teams/${teamId}/regenerate_credentials/`),
  
  // Get comprehensive team details
  getComprehensiveDetails: (teamId) => api.get(`/teams/${teamId}/comprehensive_details/`),
  
  // Generate team list PDF
  generateTeamListPDF: (eventId, teamId) => api.get(`/events/${eventId}/teams/${teamId}/program-list-pdf/`, { responseType: 'blob' }),
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
    return api.get(`/points/?${queryParams.toString()}`);
  },
  
  // Get all points records (alias for getPoints)
  getPointsRecords: (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.keys(params).forEach(key => {
      if (params[key] !== undefined && params[key] !== '') {
        queryParams.append(key, params[key]);
      }
    });
    return api.get(`/points/?${queryParams.toString()}`);
  },
  
  // Create points record
  createPoints: (data) => api.post('/points/', data),
  
  // Update points record
  updatePoints: (id, data) => api.put(`/points/${id}/`, data),
  
  // Delete points record
  deletePoints: (id) => api.delete(`/points/${id}/`),
  
  // Get leaderboard with global points calculation
  getLeaderboard: () => api.get('/points/leaderboard/'),
  
  // Get student details
  getStudentDetails: (studentId) => api.get(`/points/${studentId}/student_details/`),
  
  // Calculate global points (returns calculation without saving)
  calculateGlobalPoints: () => api.post('/points/calculate_global_points/'),
  
  // Recalculate and update global points in database
  recalculateGlobalPoints: () => api.post('/points/recalculate_global_points/'),
  
  // Bulk award points
  bulkAwardPoints: (data) => api.post('/points/bulk_award/', data),
  
  // Award manual points
  awardManualPoints: (data) => api.post('/points/award_manual_points/', data),
};

// Team Manager API
export const teamManagerAPI = {
  // Get teams managed by the current team manager
  getMyTeams: () => api.get('/team-manager/my_teams/'),
  
  // Get available programs for team manager's teams
  getAvailablePrograms: (queryParams = '') => {
    const url = queryParams ? `/team-manager/available_programs/?${queryParams}` : '/team-manager/available_programs/';
    return api.get(url);
  },
  
  // Assign team members to a program
  assignToProgram: (data) => api.post('/team-manager/assign_to_program/', data),
  
  // Get all program assignments for team manager's teams
  getTeamAssignments: () => api.get('/team-manager/team_assignments/'),
  
  // Remove a program assignment
  removeAssignment: (assignmentId) => api.delete('/team-manager/remove_assignment/', { 
    data: { assignment_id: assignmentId } 
  }),
  
  // Get team manager dashboard data
  getDashboard: () => api.get('/team-manager/dashboard/'),
  
  // Get global points leaderboard for team manager's teams
  getLeaderboard: () => api.get('/team-manager/leaderboard/'),
  
  // New functions for team login dashboard
  // Get team's students
  getTeamStudents: (teamId) => api.get(`/team-manager/${teamId}/students/`),
  
  // Get team's events
  getTeamEvents: (teamId) => api.get(`/team-manager/${teamId}/events/`),
  
  // Get programs for a specific event
  getEventPrograms: (teamId, eventId) => {
    const url = `/team-manager/${teamId}/events/${eventId}/programs/`;
    console.log('DEBUG: Calling getEventPrograms with URL:', url);
    console.log('DEBUG: Full URL will be:', `${API_BASE_URL}${url}`);
    return api.get(url);
  },
  
  // Assign student to program
  assignStudentToProgram: (teamId, eventId, programId, studentId) => 
    api.post(`/team-manager/${teamId}/events/${eventId}/programs/${programId}/assign/`, { student_id: studentId }),
  
  // Assign multiple students to program (for team-based programs)
  assignStudentsToProgram: (teamId, eventId, programId, studentIds) => 
    api.post(`/team-manager/${teamId}/events/${eventId}/programs/${programId}/assign/`, { student_ids: studentIds }),
  
  // Remove assignment by assignment ID
  removeAssignmentById: (teamId, assignmentId) => 
    api.delete(`/team-manager/${teamId}/assignments/${assignmentId}/remove/`),
  
  // Remove student from program by student ID and program ID
  removeStudentFromProgram: (teamId, eventId, programId, studentId) => 
    api.delete(`/team-manager/${teamId}/events/${eventId}/programs/${programId}/students/${studentId}/remove/`),
  
  // Get team profile
  getTeamProfile: (teamId) => api.get(`/team-manager/profile/${teamId}/`),
  
  // Get student points for a specific event
  getStudentPoints: (eventId) => api.get(`/events/${eventId}/points/students/`),
};

// Legacy API exports for backward compatibility with existing Event components
export const eventProgramsAPI = {
  getPrograms: (eventId, queryParams = '') => {
    const url = queryParams ? `/events/${eventId}/programs/?${queryParams}` : `/events/${eventId}/programs/`;
    return api.get(url);
  },
  createProgram: (eventId, data) => {
    // Use direct route instead of nested route due to router issue
    return api.post(`/programs/`, { ...data, event: eventId });
  },
  updateProgram: (eventId, programId, data) => api.put(`/events/${eventId}/programs/${programId}/`, data),
  deleteProgram: (eventId, programId) => api.delete(`/events/${eventId}/programs/${programId}/`),
  getProgramDetails: (eventId, programId) => api.get(`/events/${eventId}/programs/${programId}/`),
  
  // Mark program as finished/unfinished
  markProgramFinished: (eventId, programId, action) => 
    api.post(`/events/${eventId}/programs/${programId}/${action}/`),
  
  // Get programs by category
  getProgramsByCategory: (eventId) => api.get(`/events/${eventId}/programs/by_category/`),
  
  // Get programs by time status
  getProgramsByTimeStatus: (eventId) => api.get(`/events/${eventId}/programs/by_time_status/`),
  
  // Get category counts
  getCategoryCounts: (eventId) => api.get(`/events/${eventId}/programs/category_counts/`),
};

// Event Assignments API
export const eventAssignmentsAPI = {
  // Get assignments for a specific program
  getProgramAssignments: (eventId, programId) => api.get(`/events/${eventId}/programs/${programId}/assignments/`),
  
  // Get all assignments for an event
  getEventAssignments: async (eventId) => {
    // First get all programs for the event
    const programsRes = await api.get(`/events/${eventId}/programs/?page_size=1000`);
    const programs = programsRes.data.results || programsRes.data;
    
    // Then get assignments for each program
    const allAssignments = [];
    for (const program of programs) {
      try {
        const assignmentsRes = await api.get(`/events/${eventId}/programs/${program.id}/assignments/`);
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
  assignStudents: (eventId, programId, data) => api.post(`/events/${eventId}/programs/${programId}/assignments/bulk_assign/`, data),
  
  // Assign all students in a category to a program
  assignAllCategory: (eventId, programId, category) => api.post(`/events/${eventId}/programs/${programId}/assignments/assign_all_category/`, { category }),
  
  // Remove a specific assignment
  deleteAssignment: (eventId, programId, assignmentId) => api.delete(`/events/${eventId}/programs/${programId}/assignments/${assignmentId}/`),
  
  // Get available students
  getAvailableStudents: (params) => api.get('/students/', { params }),
};

// Event Results API
export const eventResultsAPI = {
  getProgramResults: (programId) => api.get(`/programs/${programId}/results/`),
  enterResults: (programId, data) => api.post(`/programs/${programId}/results/`, data),
  updateResults: (programId, resultId, data) => api.put(`/programs/${programId}/results/${resultId}/`, data),
  generateResultsPDF: (programId) => api.get(`/programs/${programId}/results/pdf/`, { responseType: 'blob' }),
  generateBulkResultsPDF: (eventId) => api.get(`/events/${eventId}/results/bulk-pdf/`, { responseType: 'blob' }),
};

// Event Calling Sheet API
export const eventCallingSheetAPI = {
  getProgramParticipants: (programId) => api.get(`/programs/${programId}/participants/`),
  generateCallingSheet: (programId) => api.get(`/programs/${programId}/calling-sheet/`, { responseType: 'blob' }),
  generateFormattedCallingSheet: (programId) => api.get(`/programs/${programId}/formatted-calling-sheet/`, { responseType: 'blob' }),
  generateFormattedEvaluationSheet: (programId) => api.get(`/programs/${programId}/formatted-evaluation-sheet/`, { responseType: 'blob' }),
  generateBulkCallingSheets: (eventId) => api.get(`/events/${eventId}/calling-sheets/bulk/`, { responseType: 'blob' }),
  
  // Chest number search functionality
  searchByChestNumber: (eventId, chestNumber) => api.get(`/events/${eventId}/search_by_chest_number/?chest_number=${chestNumber}`),
  getEventChestNumbers: (eventId) => api.get(`/events/${eventId}/chest_numbers/`),
};

// Event Valuation Sheet API
export const eventValuationSheetAPI = {
  generateValuationSheet: (programId) => api.get(`/programs/${programId}/valuation-sheet/`, { responseType: 'blob' }),
  generateBulkValuationSheets: (eventId) => api.get(`/events/${eventId}/valuation-sheets/bulk/`, { responseType: 'blob' }),
};

// Event Points API
export const eventPointsAPI = {
  getEventTeamPoints: (eventId) => api.get(`/events/${eventId}/points/teams/`),
  getEventStudentPoints: (eventId) => api.get(`/events/${eventId}/points/students/`),
  getTeamEventDetails: (teamId, eventId) => api.get(`/teams/${teamId}/events/${eventId}/details/`),
};

// Event Certificates API
export const eventCertificatesAPI = {
  getProgramWinners: (programId) => api.get(`/programs/${programId}/winners/`),
  generateCertificate: (data) => api.post('/certificates/generate/', data, { responseType: 'blob' }),
  generateBulkCertificates: (data) => api.post('/certificates/bulk/', data, { responseType: 'blob' }),
  generateEventCertificates: (eventId) => api.get(`/events/${eventId}/certificates/`, { responseType: 'blob' }),
};

// Event Reports API
export const eventReportsAPI = {
  getEventAnalytics: (eventId) => api.get(`/events/${eventId}/analytics/`),
  generateReport: (eventId, reportType) => api.get(`/events/${eventId}/reports/${reportType}/`, { responseType: 'blob' }),
  exportEventData: (eventId, format) => api.get(`/events/${eventId}/export/${format}/`, { responseType: 'blob' }),
};

// Mark Entry and Results API
export const markEntryAPI = {
  // Get participants for mark entry
  getParticipants: (eventId, programId) =>
    api.get(`/events/${eventId}/programs/${programId}/results/mark_entry/`),
  
  // Bulk update marks
  bulkUpdateMarks: (eventId, programId, marksData) =>
    api.post(`/events/${eventId}/programs/${programId}/results/bulk_mark_entry/`, {
      marks: marksData
    }),
  
  // Get results summary
  getResultsSummary: (eventId, programId) =>
    api.get(`/events/${eventId}/programs/${programId}/results/results_summary/`),
  
  // Generate PDF report
  generatePDF: (eventId, programId) =>
    api.get(`/events/${eventId}/programs/${programId}/results/results_pdf/`, {
      responseType: 'blob'
    })
};

// Announcements API
export const announcementsAPI = {
  getAnnouncements: async (params = {}) => {
    const response = await api.get('/announcements/', { params });
    return response.data;
  },
  
  createAnnouncement: async (eventId, data) => {
    const response = await api.post(`/events/${eventId}/create_announcement/`, data);
    return response.data;
  },
};

// School Settings API
export const schoolSettingsAPI = {
  get: () => api.get('/schoolsettings/1/'),
  update: (data) => {
    if (data instanceof FormData) {
      return api.put('/schoolsettings/1/', data, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    }
    return api.put('/schoolsettings/1/', data);
  },
};

// Export default api instance for custom requests
export default api; 