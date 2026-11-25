import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import Login from './components/Login';
import AdminLayout from './components/Layout/AdminLayout';
import TeamManagerLayout from './components/Layout/TeamManagerLayout';
import ProtectedRoute from './components/ProtectedRoute';
import TeamProtectedRoute from './components/TeamProtectedRoute';

// Lazy-loaded pages for high-speed code-splitting & minimal initial bundle
const SuperAdminLogin = lazy(() => import('./components/SuperAdmin/SuperAdminLogin'));
const SuperAdminDashboard = lazy(() => import('./components/SuperAdmin/SuperAdminDashboard'));
const AdminDashboard = lazy(() => import('./components/AdminDashboard'));
const UserDashboard = lazy(() => import('./components/UserDashboard'));
const TeamManagerDashboard = lazy(() => import('./components/TeamManagerDashboard'));
const TeamLoginDashboard = lazy(() => import('./components/TeamLoginDashboard'));
const EventDashboard = lazy(() => import('./components/Event/EventDashboard'));
const EventTopPerformers = lazy(() => import('./components/Event/EventTopPerformers'));

// Admin Components
const EventsPage = lazy(() => import('./components/Admin/EventsPage'));
const StudentsPage = lazy(() => import('./components/Admin/StudentsPage'));
const TeamsPage = lazy(() => import('./components/Admin/TeamsPage'));
const PointsPage = lazy(() => import('./components/Admin/PointsPage'));
const AdminSettings = lazy(() => import('./components/Admin/AdminSettings'));
const DocsPage = lazy(() => import('./components/Admin/DocsPage'));
const UsersPage = lazy(() => import('./components/Admin/UsersPage'));

// Team Manager Components
const TeamAssignments = lazy(() => import('./components/TeamManager/TeamAssignments'));
const TeamManagerEvents = lazy(() => import('./components/TeamManager/TeamManagerEvents'));
const TeamManagerPoints = lazy(() => import('./components/TeamManager/TeamManagerPoints'));
const TeamEventDetail = lazy(() => import('./components/TeamManager/TeamEventDetail'));
const TeamStudents = lazy(() => import('./components/TeamManager/TeamStudents'));
const ProgramAssignmentPage = lazy(() => import('./components/TeamManager/ProgramAssignmentPage'));
const TeamEventDashboard = lazy(() => import('./components/TeamManager/TeamEventDashboard'));
const PublicParticipantBadge = lazy(() => import('./components/Public/PublicParticipantBadge'));
const ThemedPage = lazy(() => import('./components/Public/themes/ThemedPage'));
const JudgeEvaluationPortal = lazy(() => import('./components/Judge/JudgeEvaluationPortal'));

import './index.css';

const PageLoader = () => (
  <div className="flex min-h-[60vh] items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
  </div>
);

// Auth utility functions
const isAuthenticated = () => {
  return Boolean(localStorage.getItem('user_role'));
};

const getUserRole = () => {
  return localStorage.getItem('user_role');
};

const getDefaultRoute = () => {
  const role = getUserRole();
  switch (role) {
    case 'admin':
      return '/admin';
    case 'team_manager':
      return '/team-manager';
    case 'event_manager':
      return '/user/dashboard';
    case 'super_admin':
      return '/super-admin';
    default:
      return '/login';
  }
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="App">
          <Suspense fallback={<PageLoader />}>
            <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/team-manager/login" element={<Navigate to="/login?tab=team" replace />} />
          <Route path="/super-admin/login" element={<SuperAdminLogin />} />
          {/* Public Themed Event Experience Routes */}
          <Route path="/events/:eventId/public" element={<ThemedPage page="landing" />} />
          <Route path="/public/events/:eventId" element={<ThemedPage page="landing" />} />
          <Route path="/events/:eventId/public/results" element={<ThemedPage page="results" />} />
          <Route path="/public/events/:eventId/results" element={<ThemedPage page="results" />} />
          <Route path="/events/:eventId/public/points" element={<ThemedPage page="standings" />} />
          <Route path="/public/events/:eventId/points" element={<ThemedPage page="standings" />} />
          <Route path="/events/:eventId/public/standings" element={<ThemedPage page="standings" />} />
          <Route path="/public/events/:eventId/standings" element={<ThemedPage page="standings" />} />
          <Route path="/events/:eventId/public/schedule" element={<ThemedPage page="schedule" />} />
          <Route path="/public/events/:eventId/schedule" element={<ThemedPage page="schedule" />} />
          <Route path="/events/:eventId/public/verify" element={<ThemedPage page="verify" />} />
          <Route path="/public/events/:eventId/verify" element={<ThemedPage page="verify" />} />
          <Route path="/events/:eventId/badge/:studentId" element={<PublicParticipantBadge />} />
          <Route path="/public/events/:eventId/participants/:studentId" element={<PublicParticipantBadge />} />
          <Route path="/public/events/:eventId/badges/:chestOrStudentId" element={<PublicParticipantBadge />} />
          <Route path="/judge/eval/:token" element={<Suspense fallback={<PageLoader />}><JudgeEvaluationPortal /></Suspense>} />
          <Route path="/public/judge/:token" element={<Suspense fallback={<PageLoader />}><JudgeEvaluationPortal /></Suspense>} />
          <Route
            path="/super-admin"
            element={
              <ProtectedRoute requiredRole="super_admin">
                <SuperAdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* Protected Admin Routes */}
          <Route 
            path="/admin/*" 
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="students" element={<StudentsPage />} />
            <Route path="teams" element={<TeamsPage />} />
            <Route path="points" element={<PointsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="docs" element={<DocsPage />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Team Login Dashboard Routes */}
          <Route 
            path="/team-manager/dashboard" 
            element={
              <TeamProtectedRoute>
                <TeamLoginDashboard />
              </TeamProtectedRoute>
            } 
          />
          <Route 
            path="/team-manager/dashboard/events/:eventId/programs/:programId/assign" 
            element={
              <TeamProtectedRoute>
                <ProgramAssignmentPage />
              </TeamProtectedRoute>
            } 
          />

          {/* Protected Team Manager Routes */}
          <Route 
            path="/team-manager/*" 
            element={
              <ProtectedRoute requiredRole="team_manager">
                <TeamManagerLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<TeamManagerDashboard />} />
            <Route path="dashboard" element={<TeamManagerDashboard />} />
            <Route path="students" element={<TeamStudents />} />
            <Route path="events" element={<TeamManagerEvents />} />
            <Route path="events/:eventId" element={<Navigate to="portal" replace />} />
            <Route path="events/:eventId/programs/:programId/assign" element={<ProgramAssignmentPage />} />
            <Route path="assignments" element={<Navigate to="/team-manager/events" replace />} />
            <Route path="points" element={<TeamManagerPoints />} />
            <Route path="profile" element={<Navigate to="/team-manager" replace />} />
            <Route path="settings" element={<Navigate to="/team-manager" replace />} />
          </Route>

          {/* Dedicated Team Event Portal (Dedicated Separate Window Experience) */}
          <Route 
            path="/team-manager/events/:eventId/portal" 
            element={
              <ProtectedRoute requiredRole="team_manager">
                <TeamEventDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Protected User Routes */}
          <Route 
            path="/user/dashboard" 
            element={
              <ProtectedRoute requiredRole="event_manager">
                <UserDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Event Dashboard Route */}
          <Route 
            path="/events/:eventId/dashboard" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'event_manager']}>
                <EventDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Event Top Performers Route */}
          <Route 
            path="/events/:eventId/top-performers" 
            element={
              <ProtectedRoute allowedRoles={['admin', 'event_manager']}>
                <div className="min-h-screen bg-gray-50">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <EventTopPerformers />
                  </div>
                </div>
              </ProtectedRoute>
            } 
          />

          {/* Default Route */}
          <Route 
            path="/" 
            element={
              isAuthenticated() ? (
                <Navigate to={getDefaultRoute()} replace />
              ) : (
                <Navigate to="/login" replace />
              )
            } 
          />

          {/* Catch-all Route */}
          <Route 
            path="*" 
            element={<Navigate to="/" replace />} 
          />
        </Routes>
        </Suspense>
      </div>
    </Router>
    </ErrorBoundary>
  );
}

export default App; 
