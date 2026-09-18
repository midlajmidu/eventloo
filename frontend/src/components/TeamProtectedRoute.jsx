import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { teamManagerAPI } from '../services/api';

const TeamProtectedRoute = ({ children }) => {
  const [state, setState] = useState('checking');

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        const team = JSON.parse(localStorage.getItem('team_data') || 'null');
        if (!team?.id) throw new Error('Missing team session metadata');
        await teamManagerAPI.getTeamProfile(team.id);
        if (active) setState('valid');
      } catch (_) {
        if (active) setState('invalid');
      }
    };
    verify();
    return () => { active = false; };
  }, []);

  if (state === 'checking') {
    return <div className="min-h-screen bg-slate-50" aria-busy="true" />;
  }
  if (state === 'invalid') return <Navigate to="/login" replace />;
  return children;
};

export default TeamProtectedRoute; 
