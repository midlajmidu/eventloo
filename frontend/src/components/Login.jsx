import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Users, User, Building2, ShieldCheck } from 'lucide-react';
import { authAPI } from '../services/api';
import EventlooLogo from './common/EventlooLogo';

const Login = () => {
  const [loginType, setLoginType] = useState('user'); // 'user' or 'team'
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    team_username: '',
    team_password: '',
    school_code: '',
    otp: '',
  });
  const [mfaSetup, setMfaSetup] = useState(null);
  const [showOtp, setShowOtp] = useState(false);
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

    const userRole = localStorage.getItem('user_role');
    if (userRole) {
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

  const schoolCredentials = () => ({
    email: formData.email,
    password: formData.password,
    school_code: formData.school_code,
  });

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
        if (mfaSetup) {
          await authAPI.confirmMfa({ ...schoolCredentials(), otp: formData.otp });
          setMfaSetup(null);
        }
        // Admin or Event Manager login
        const { data } = await authAPI.login({
          ...schoolCredentials(),
          otp: formData.otp,
        });

        // Authentication tokens are stored in secure HttpOnly cookies. Keep only
        // non-sensitive UI/session metadata in browser storage.
        if (data.user) {
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('user_role', data.user.role);
          localStorage.setItem('school_data', JSON.stringify(data.user.school));

          // Check for custom redirect path first
          const redirectPath = getRedirectPath();
          if (redirectPath) {
            navigate(redirectPath, { replace: true });
            return;
          }

          // Role-based navigation
          if (data.user.role === 'admin') {
            navigate('/admin', { replace: true });
          } else if (data.user.role === 'event_manager') {
            navigate('/user/dashboard', { replace: true });
          } else {
            navigate('/dashboard', { replace: true });
          }
        }
      } else {
        // Team Manager login
        const { data } = await authAPI.teamManagerLogin({
          team_username: formData.team_username,
          team_password: formData.team_password,
          school_code: formData.school_code,
        });

        // Tokens remain in HttpOnly cookies; these values are display/routing data.
        localStorage.setItem('user_role', 'team_manager');
        localStorage.setItem('access_type', data.access_type || 'team_manager');
        localStorage.setItem('team_welcome_message', data.message || '');
        
        if (data.team) {
          localStorage.setItem('team_data', JSON.stringify(data.team));
        }
        if (data.school) localStorage.setItem('school_data', JSON.stringify(data.school));

        // Check for custom redirect path first
        const redirectPath = getRedirectPath();
        if (redirectPath) {
          navigate(redirectPath, { replace: true });
          return;
        }

        navigate('/team-manager', { replace: true });
      }
    } catch (err) {
      const responseData = err.response?.data;
      if (loginType === 'user' && responseData?.code === 'mfa_setup_required') {
        try {
          const { data } = await authAPI.setupMfa(schoolCredentials());
          setMfaSetup(data);
          setShowOtp(true);
          setError('Set up your authenticator app, then enter the 6-digit code.');
          return;
        } catch (setupError) {
          setError(setupError.response?.data?.error || 'Unable to start authenticator setup.');
          return;
        }
      }
      if (loginType === 'user' && responseData?.code === 'mfa_required') {
        setShowOtp(true);
      }
      const validationMessage = responseData && typeof responseData === 'object'
        ? Object.values(responseData).flat().find(value => typeof value === 'string')
        : null;
      const errorMessage = responseData?.error ||
                          responseData?.detail ||
                          responseData?.message ||
                          validationMessage ||
                          'Login failed. Please check your school code and credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-50 flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        {/* Header */}
        <div className="text-center flex flex-col items-center">
          <div className="mb-4 transform hover:scale-105 transition-transform duration-300">
            <EventlooLogo variant="full" size="xl" showSubtitle />
          </div>
          <p className="text-gray-600 text-sm mt-1">Sign in to your event management account</p>
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

              <div>
                <label className="form-label">School Code</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Building2 className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    name="school_code"
                    value={formData.school_code}
                    onChange={handleChange}
                    className="form-input pl-10"
                    placeholder="Enter your school code"
                    autoCapitalize="none"
                    required
                  />
                </div>
              </div>

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

                  {(showOtp || mfaSetup) && (
                    <div className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
                      <div className="flex items-start gap-3">
                        <ShieldCheck className="mt-0.5 h-5 w-5 flex-shrink-0 text-indigo-600" />
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900">Authenticator verification</p>
                          {mfaSetup && (
                            <>
                              <p className="mt-1 text-xs text-gray-600">
                                Add this setup key to your authenticator app. Keep it private.
                              </p>
                              <code className="mt-2 block break-all rounded-md bg-white px-3 py-2 text-xs text-indigo-700">
                                {mfaSetup.secret}
                              </code>
                            </>
                          )}
                        </div>
                      </div>
                      <div>
                        <label className="form-label">6-digit authenticator code</label>
                        <input
                          type="text"
                          name="otp"
                          value={formData.otp}
                          onChange={handleChange}
                          className="form-input"
                          placeholder="000000"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          pattern="[0-9]{6}"
                          maxLength="6"
                          required
                        />
                      </div>
                    </div>
                  )}
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
