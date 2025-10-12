import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const token = localStorage.getItem('access_token');
  const userRole = localStorage.getItem('user_role');

  // Check if user is authenticated
  if (!token || token === 'undefined' || token === '') {
    return <Navigate to="/login" replace />;
  }

  // Check if user has required role
  if (requiredRole && userRole !== requiredRole) {
    // Redirect based on user's actual role
    switch (userRole) {
      case 'admin':
        return <Navigate to="/admin" replace />;
      case 'team_manager':
        return <Navigate to="/team-manager" replace />;
      case 'event_manager':
        return <Navigate to="/user/dashboard" replace />;
      case 'student':
        // Student role shouldn't have access to protected routes
        // Clear auth and redirect to login
        localStorage.clear();
        return <Navigate to="/login" replace />;
      default:
        // Unknown role - clear auth and redirect to login
        localStorage.clear();
        return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute; 