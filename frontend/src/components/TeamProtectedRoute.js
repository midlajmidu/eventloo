import React from 'react';
import { Navigate } from 'react-router-dom';

const TeamProtectedRoute = ({ children }) => {
  const teamData = localStorage.getItem('team_data');
  const accessType = localStorage.getItem('access_type');

  // Check if team is authenticated
  if (!teamData || accessType !== 'team_manager') {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default TeamProtectedRoute; 