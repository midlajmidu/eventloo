import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const token = localStorage.getItem('access_token');
  const userRole = localStorage.getItem('user_role');

  // Check if user is authenticated
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // Check if user has required role
  if (requiredRole && userRole !== requiredRole) {
    // Redirect based on user's actual role
    switch (userRole) {
      case 'admin':
        return <Navigate to="/admin/dashboard" replace />;
      case 'team_manager':
        return <Navigate to="/team-manager" replace />;
      case 'event_manager':
        return <Navigate to="/user/dashboard" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return children;
};

export default ProtectedRoute; 