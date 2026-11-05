import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { authAPI, teamManagerAPI } from '../services/api';

const destinationFor = (role) => ({
  admin: '/admin',
  event_manager: '/user/dashboard',
  super_admin: '/super-admin',
  team_manager: '/team-manager/dashboard',
}[role] || '/login');

const ProtectedRoute = ({ children, requiredRole = null, allowedRoles = null }) => {
  const [state, setState] = useState({ loading: true, role: null, valid: false });

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        let role = null;
        const currentStoredRole = localStorage.getItem('user_role');
        const teamDataRaw = localStorage.getItem('team_data');
        const isTeamManagerExpected = requiredRole === 'team_manager' || (allowedRoles && allowedRoles.includes('team_manager'));

        if ((isTeamManagerExpected || currentStoredRole === 'team_manager') && teamDataRaw) {
          try {
            const team = JSON.parse(teamDataRaw);
            if (team?.id) {
              await teamManagerAPI.getTeamProfile(team.id);
              role = 'team_manager';
            }
          } catch {
            // If team profile check fails, fallback to general auth profile
          }
        }

        if (!role) {
          const response = await authAPI.getProfile();
          role = response.data?.role;
        }

        if (active) {
          setState({ loading: false, role, valid: Boolean(role) });
        }
      } catch (_) {
        if (active) setState({ loading: false, role: null, valid: false });
      }
    };
    verify();
    return () => { active = false; };
  }, [requiredRole, allowedRoles]);

  if (state.loading) {
    return <div className="min-h-screen bg-slate-50" aria-busy="true" />;
  }
  if (!state.valid) {
    if (requiredRole === 'super_admin') return <Navigate to="/super-admin/login" replace />;
    if (requiredRole === 'team_manager' || localStorage.getItem('user_role') === 'team_manager') {
      return <Navigate to="/login?tab=team" replace />;
    }
    return <Navigate to="/login" replace />;
  }
  if (allowedRoles && !allowedRoles.includes(state.role)) {
    return <Navigate to={destinationFor(state.role)} replace />;
  }
  if (requiredRole && state.role !== requiredRole) {
    return <Navigate to={destinationFor(state.role)} replace />;
  }
  return children;
};

export default ProtectedRoute; 
