import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { authAPI, teamManagerAPI } from '../services/api';

const destinationFor = (role) => ({
  admin: '/admin',
  event_manager: '/user/dashboard',
  super_admin: '/super-admin',
  team_manager: '/team-manager/dashboard',
}[role] || '/login');

const ProtectedRoute = ({ children, requiredRole = null }) => {
  const [state, setState] = useState({ loading: true, role: null, valid: false });

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        let role;
        if (requiredRole === 'team_manager' && localStorage.getItem('team_data')) {
          const team = JSON.parse(localStorage.getItem('team_data'));
          await teamManagerAPI.getTeamProfile(team.id);
          role = 'team_manager';
        } else {
          const response = await authAPI.getProfile();
          role = response.data.role;
        }
        if (active) setState({ loading: false, role, valid: true });
      } catch (_) {
        if (active) setState({ loading: false, role: null, valid: false });
      }
    };
    verify();
    return () => { active = false; };
  }, [requiredRole]);

  if (state.loading) {
    return <div className="min-h-screen bg-slate-50" aria-busy="true" />;
  }
  if (!state.valid) {
    return <Navigate to={requiredRole === 'super_admin' ? '/super-admin/login' : '/login'} replace />;
  }
  if (requiredRole && state.role !== requiredRole) {
    return <Navigate to={destinationFor(state.role)} replace />;
  }
  return children;
};

export default ProtectedRoute; 
