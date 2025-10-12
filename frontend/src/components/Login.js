import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, Sparkles, AlertCircle, Users, User } from 'lucide-react';
import { authAPI } from '../services/api';

const Login = () => {
  const [loginType, setLoginType] = useState('user'); // 'user' or 'team'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    team_username: '',
    team_password: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const hasNavigated = useRef(false);

  // Check if user is already authenticated (only on mount)
  useEffect(() => {
    // Only run if we haven't navigated yet and we're on the login page
    if (hasNavigated.current || location.pathname !== '/login') {
      return;
    }

    const token = localStorage.getItem('access_token');
    if (token && token !== 'undefined' && token !== '') {
      const userRole = localStorage.getItem('user_role');
      hasNavigated.current = true;
      
      if (userRole === 'admin') {
        navigate('/admin', { replace: true });
      } else if (userRole === 'team_manager') {
        navigate('/team-manager', { replace: true });
      } else if (userRole === 'event_manager') {
        navigate('/user/dashboard', { replace: true });
      } else {
        // Unknown role - clear storage and stay on login
        localStorage.clear();
        hasNavigated.current = false;
      }
    }
  }, [navigate, location.pathname]); // Include dependencies

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  const getRedirectPath = () => {
    // Check if there's a stored redirect path
    const redirectPath = localStorage.getItem('redirectAfterLogin');
    if (redirectPath) {
      localStorage.removeItem('redirectAfterLogin');
      return redirectPath;
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (loginType === 'user') {
        // Regular user login
        const response = await authAPI.login(formData);
        
        localStorage.setItem('access_token', response.data.access);
        localStorage.setItem('refresh_token', response.data.refresh);
        localStorage.setItem('user_role', response.data.user.role);
        
        // Check for redirect path first
        const redirectPath = getRedirectPath();
        if (redirectPath) {
          navigate(redirectPath, { replace: true });
        } else {
        // Redirect based on role
        if (response.data.user.role === 'admin') {
          navigate('/admin', { replace: true });
        } else if (response.data.user.role === 'team_manager') {
          navigate('/team-manager', { replace: true });
        } else {
          navigate('/user/dashboard', { replace: true });
          }
        }
      } else {
        // Team manager login
        const response = await authAPI.teamManagerLogin({
          team_username: formData.team_username,
          team_password: formData.team_password
        });
        
        localStorage.setItem('team_data', JSON.stringify(response.data.team));
        localStorage.setItem('access_type', 'team_manager');
        localStorage.setItem('team_welcome_message', response.data.message);
        
        navigate('/team-manager/dashboard', { replace: true });
      }
    } catch (err) {
      if (err.response?.status === 401) {
        setError('Invalid credentials. Please check your email and password.');
      } else if (err.response?.status === 400) {
        setError('Please check your credentials format.');
      } else if (err.response?.status === 500) {
        setError('Server error. Please try again later.');
      } else if (err.code === 'NETWORK_ERROR' || err.message.includes('Network Error')) {
        setError('Network error. Please check your internet connection and try again.');
      } else if (err.message.includes('timeout')) {
        setError('Request timeout. Please try again.');
      } else {
        setError(`Something went wrong: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-lg">
            <Sparkles className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-gray-600">Sign in to your School Events account</p>
        </div>

        {/* Login Type Toggle */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          <button
            type="button"
            onClick={() => setLoginType('user')}
            className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              loginType === 'user'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <User className="w-4 h-4 mr-2" />
            User Login
          </button>
          <button
            type="button"
            onClick={() => setLoginType('team')}
            className={`flex-1 flex items-center justify-center py-2 px-4 rounded-md text-sm font-medium transition-all duration-200 ${
              loginType === 'team'
                ? 'bg-white text-blue-600 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-4 h-4 mr-2" />
            Team Login
          </button>
        </div>

        {/* Login Form */}
        <div className="card">
          <div className="card-body">
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center space-x-2 fade-in">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                  <span className="text-red-700 text-sm">{error}</span>
                </div>
              )}

              {loginType === 'user' ? (
                <>
                  <div>
                    <label className="form-label">Email Address</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Mail className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleChange}
                        className="form-input pl-10"
                        placeholder="Enter your email"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="form-input pl-10 pr-10"
                        placeholder="Enter your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="form-label">Team Username</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Users className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="team_username"
                        value={formData.team_username}
                        onChange={handleChange}
                        className="form-input pl-10"
                        placeholder="Enter team username"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="form-label">Team Password</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Lock className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        name="team_password"
                        value={formData.team_password}
                        onChange={handleChange}
                        className="form-input pl-10 pr-10"
                        placeholder="Enter team password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                      >
                        {showPassword ? (
                          <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </div>
                  </div>
                </>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full btn-lg"
              >
                {loading ? (
                  <div className="flex items-center justify-center">
                    <div className="loading-spinner h-5 w-5 mr-2"></div>
                    Signing in...
                  </div>
                ) : (
                  loginType === 'user' ? 'Sign In' : 'Team Login'
                )}
              </button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center">
          <p className="text-sm text-gray-500">
            Eventloo - School Event Management System
          </p>
          <p className="text-xs text-gray-400 mt-1">
            © 2025 Eventloo. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login; 