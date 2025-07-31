import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/common/ErrorBoundary';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import UserDashboard from './components/UserDashboard';
import TeamManagerDashboard from './components/TeamManagerDashboard';
import TeamLoginDashboard from './components/TeamLoginDashboard';
import EventDashboard from './components/Event/EventDashboard';
import EventTopPerformers from './components/Event/EventTopPerformers';
import AdminLayout from './components/Layout/AdminLayout';
import TeamManagerLayout from './components/Layout/TeamManagerLayout';
import ProtectedRoute from './components/ProtectedRoute';
import TeamProtectedRoute from './components/TeamProtectedRoute';
import DebugBackend from './components/DebugBackend';
import BackendTest from './components/BackendTest';

// Admin Components
import EventsPage from './components/Admin/EventsPage';
import StudentsPage from './components/Admin/StudentsPage';
import TeamsPage from './components/Admin/TeamsPage';
import PointsPage from './components/Admin/PointsPage';
import AdminSettings from './components/Admin/AdminSettings';

// Team Manager Components
import TeamAssignments from './components/TeamManager/TeamAssignments';
import TeamManagerEvents from './components/TeamManager/TeamManagerEvents';
import TeamManagerPoints from './components/TeamManager/TeamManagerPoints';
import TeamEventDetail from './components/TeamManager/TeamEventDetail';
import TeamStudents from './components/TeamManager/TeamStudents';
import ProgramAssignmentPage from './components/TeamManager/ProgramAssignmentPage';

import './index.css';

// Auth utility functions
const isAuthenticated = () => {
  return localStorage.getItem('access_token') !== null;
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
    default:
      return '/login';
  }
};

function App() {
  return (
    <ErrorBoundary>
      <Router>
        <div className="App">
          <DebugBackend />
          <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/test" element={<BackendTest />} />

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
            <Route path="students" element={<TeamStudents />} />
            <Route path="events" element={<TeamManagerEvents />} />
            <Route path="events/:eventId" element={<TeamEventDetail />} />
            <Route path="events/:eventId/programs/:programId/assign" element={<ProgramAssignmentPage />} />
            <Route path="assignments" element={<TeamAssignments />} />
            <Route path="points" element={<TeamManagerPoints />} />
            <Route path="profile" element={<div className="text-center py-20">Team Profile - Coming Soon!</div>} />
            <Route path="settings" element={<div className="text-center py-20">Settings Page - Coming Soon!</div>} />
          </Route>

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
              <ProtectedRoute requiredRole="admin">
                <EventDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Event Top Performers Route */}
          <Route 
            path="/events/:eventId/top-performers" 
            element={
              <ProtectedRoute requiredRole="admin">
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
      </div>
    </Router>
    </ErrorBoundary>
  );
}

export default App; 