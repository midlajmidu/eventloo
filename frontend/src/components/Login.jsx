import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, AlertCircle, Users, User, ShieldCheck, X, KeyRound, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';
import { authAPI } from '../services/api';
import EventlooLogo from './common/EventlooLogo';

const Login = () => {
  const location = useLocation();
  const [loginType, setLoginType] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') === 'team' ? 'team' : 'user';
  });
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    team_username: '',
    team_password: '',
    otp: '',
  });
  const [mfaSetup, setMfaSetup] = useState(null);
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotNotice, setForgotNotice] = useState(false);
  const [registerNotice, setRegisterNotice] = useState(false);
  const navigate = useNavigate();
  const hasNavigated = useRef(false);

  // In-place Forgot Password state (replaces popup with dedicated in-card view)
  const [viewMode, setViewMode] = useState('login'); // 'login' | 'forgot_password'
  const [forgotStep, setForgotStep] = useState(1);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotOtp, setForgotOtp] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotShowPassword, setForgotShowPassword] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [countdown, setCountdown] = useState(0);

  useEffect(() => {
    let timer;
    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const handleRequestForgotOtp = async (e) => {
    if (e) e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    const emailToUse = (forgotEmail || formData.email || '').trim().toLowerCase();
    if (!emailToUse) {
      setForgotError('Please enter your email address.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await authAPI.requestForgotPasswordOtp(emailToUse);
      setForgotEmail(emailToUse);
      setForgotStep(2);
      setCountdown(60);
      setForgotSuccess(res.data?.message || 'Verification code sent to your email.');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to send verification code. Please check your email address.';
      setForgotError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setForgotLoading(false);
    }
  };

  const handleVerifyAndResetPassword = async (e) => {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');
    if (!forgotOtp || forgotOtp.trim().length !== 6) {
      setForgotError('Please enter a valid 6-digit verification code.');
      return;
    }
    if (!forgotNewPassword) {
      setForgotError('Please enter a new password.');
      return;
    }
    if (forgotNewPassword.length < 8) {
      setForgotError('Password must be at least 8 characters long.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotError('Passwords do not match.');
      return;
    }
    setForgotLoading(true);
    try {
      const res = await authAPI.verifyAndResetPassword({
        email: forgotEmail,
        otp: forgotOtp.trim(),
        new_password: forgotNewPassword,
      });
      setForgotSuccess(res.data?.message || 'Password reset successfully!');
      setFormData((prev) => ({
        ...prev,
        email: forgotEmail,
        password: forgotNewPassword,
      }));
      setTimeout(() => {
        setViewMode('login');
        setForgotStep(1);
        setForgotOtp('');
        setForgotNewPassword('');
        setForgotConfirmPassword('');
      }, 1500);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to reset password. Please check your verification code.';
      setForgotError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setForgotLoading(false);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('tab') === 'team') {
      setLoginType('team');
    } else if (params.get('tab') === 'user') {
      setLoginType('user');
    }
  }, [location.search]);

  // Check if user is already authenticated (only on mount)
  useEffect(() => {
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
        localStorage.clear();
        hasNavigated.current = false;
      }
    }
  }, [navigate, location.pathname]);

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
  });

  const getRedirectPath = () => {
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

        if (data.user) {
          localStorage.removeItem('team_data');
          localStorage.removeItem('team_welcome_message');
          localStorage.setItem('user', JSON.stringify(data.user));
          localStorage.setItem('user_role', data.user.role);
          localStorage.setItem('school_data', JSON.stringify(data.user.school));

          const redirectPath = getRedirectPath();
          if (redirectPath) {
            navigate(redirectPath, { replace: true });
            return;
          }

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
        });

        localStorage.removeItem('user');
        localStorage.setItem('user_role', 'team_manager');
        localStorage.setItem('access_type', data.access_type || 'team_manager');
        localStorage.setItem('team_welcome_message', data.message || '');
        
        if (data.team) {
          localStorage.setItem('team_data', JSON.stringify(data.team));
        }
        if (data.school) localStorage.setItem('school_data', JSON.stringify(data.school));

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
        ? Object.values(responseData).flat().find((value) => typeof value === 'string')
        : null;
      const errorMessage = responseData?.error ||
                          responseData?.detail ||
                          responseData?.message ||
                          validationMessage ||
                          'Login failed. Please check your credentials.';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white font-sans antialiased text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* ========================================================================= */}
      {/* 1. LEFT VISUAL / STORYTELLING PANEL (MATCHING REFERENCE DESIGN) */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex lg:w-[54%] xl:w-[58%] relative flex-col justify-between overflow-hidden bg-gradient-to-b from-[#f3f7fd] via-[#ecf3fc] to-[#e4eefb] p-8 xl:p-12 select-none border-r border-slate-100">
        
        {/* Soft Organic Right Wave Divider (Smooth transition into white form panel) */}
        <svg
          className="absolute top-0 right-0 h-full w-12 xl:w-16 pointer-events-none text-white fill-current translate-x-px"
          viewBox="0 0 100 1000"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path d="M0,0 C35,220 85,320 45,550 C10,750 85,870 100,1000 L100,0 Z" />
        </svg>

        {/* Top Section: Brand & Headline */}
        <div className="relative z-10 max-w-xl">
          <EventlooLogo size="md" />

          <div className="mt-8 xl:mt-10">
            <h1 className="text-3xl sm:text-4xl xl:text-[44px] font-extrabold text-slate-900 tracking-tight leading-[1.14]">
              Smarter Festivals
              <span className="block text-indigo-600 mt-1">Unforgettable Moments</span>
            </h1>
            <p className="mt-3.5 text-xs sm:text-sm text-slate-500 font-normal leading-relaxed max-w-md">
              Streamline candidate registrations, track real-time scores, manage team entries, and coordinate school festivals with zero friction.
            </p>
          </div>
        </div>

        {/* Center Illustration: Generated Event Check-In Queue Artwork */}
        <div className="relative z-10 my-4 flex-1 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-2xl overflow-hidden shadow-2xl shadow-indigo-950/10 border border-white/80 bg-white/40 backdrop-blur-xs transition-all duration-300 hover:shadow-indigo-900/15">
            <img
              src="/event-checkin-illustration.jpg"
              alt="Students checking into school festival with mobile tickets"
              className="w-full h-auto object-cover object-center transform transition-transform duration-700 hover:scale-[1.01]"
              loading="eager"
            />
          </div>
        </div>

        {/* Bottom Status / Badges */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-500 font-medium pt-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live Festival Scoring & Team Roster Management</span>
          </div>
          <span>Trusted by Leading Schools</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. RIGHT LOGIN CARD / FORM (MINIMAL, CLEAN, PROFESSIONAL) */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[46%] xl:w-[42%] flex flex-col justify-center items-center px-6 sm:px-12 xl:px-16 py-10 bg-white min-h-screen">
        <div className="w-full max-w-[390px] space-y-6">

          {/* Mobile Logo Only */}
          <div className="lg:hidden flex flex-col items-center text-center mb-2">
            <EventlooLogo size="lg" />
            <p className="text-xs text-slate-500 mt-2">School Event & Festival Management</p>
          </div>

          {viewMode === 'forgot_password' ? (
            /* ========================================================================= */
            /* IN-PLACE FORGOT PASSWORD & OTP RESET (MATCHING USER MOCKUP - NO POPUP)    */
            /* ========================================================================= */
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* Mail / Security Icon Badge (Matching Reference Screenshot) */}
              <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
                {forgotStep === 1 ? <Mail className="w-5 h-5 text-indigo-600" /> : <KeyRound className="w-5 h-5 text-indigo-600" />}
              </div>

              {/* Title & Subtitle */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  {forgotStep === 1 ? 'Reset Password' : 'Verify Security Code'}
                </h2>
                <p className="text-xs text-slate-500 mt-1.5 font-normal leading-relaxed">
                  {forgotStep === 1
                    ? 'Enter your email to receive a 6-digit verification code.'
                    : (
                      <>
                        Enter the 6-digit code sent to <span className="font-semibold text-slate-700">{forgotEmail}</span> and your new password.
                      </>
                    )}
                </p>
              </div>

              {/* Error Banner */}
              {forgotError && (
                <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in duration-150">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{forgotError}</span>
                </div>
              )}

              {/* Success Banner */}
              {forgotSuccess && (
                <div className="bg-emerald-50 border border-emerald-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-emerald-700 animate-in fade-in duration-150">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span className="leading-snug">{forgotSuccess}</span>
                </div>
              )}

              {/* Step 1: Request OTP Form */}
              {forgotStep === 1 ? (
                <form onSubmit={handleRequestForgotOtp} className="space-y-5">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      Account Email
                    </label>
                    <input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => {
                        setForgotEmail(e.target.value);
                        if (forgotError) setForgotError('');
                      }}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                      placeholder="admin@example.com"
                      autoComplete="email"
                      required
                      autoFocus
                    />
                  </div>

                  <div className="pt-1">
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="h-11 w-full rounded-xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-semibold text-xs tracking-wide shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {forgotLoading ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>Sending code...</span>
                        </>
                      ) : (
                        <span>Send Verification OTP</span>
                      )}
                    </button>
                  </div>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('login');
                        setForgotError('');
                        setForgotSuccess('');
                      }}
                      className="inline-flex items-center justify-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Back to Login
                    </button>
                  </div>
                </form>
              ) : (
                /* Step 2: OTP Entry + New Password Form (In-place) */
                <form onSubmit={handleVerifyAndResetPassword} className="space-y-4">
                  {/* OTP Code Entry */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        Verification Code
                      </label>
                      <button
                        type="button"
                        disabled={countdown > 0 || forgotLoading}
                        onClick={handleRequestForgotOtp}
                        className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 disabled:text-slate-400 disabled:cursor-not-allowed inline-flex items-center gap-1 transition-colors"
                      >
                        {countdown > 0 ? (
                          `Resend code in ${countdown}s`
                        ) : (
                          <>
                            <RefreshCw className="w-3 h-3" />
                            Resend Code
                          </>
                        )}
                      </button>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={6}
                        value={forgotOtp}
                        onChange={(e) => {
                          setForgotOtp(e.target.value.replace(/\D/g, '').slice(0, 6));
                          if (forgotError) setForgotError('');
                        }}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-center text-base font-mono tracking-[0.4em] font-bold text-slate-900 placeholder:tracking-normal placeholder:font-normal placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                        placeholder="000000"
                        autoComplete="one-time-code"
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  {/* New Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type={forgotShowPassword ? 'text' : 'password'}
                        value={forgotNewPassword}
                        onChange={(e) => {
                          setForgotNewPassword(e.target.value);
                          if (forgotError) setForgotError('');
                        }}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                        placeholder="Minimum 8 characters"
                        autoComplete="new-password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setForgotShowPassword(!forgotShowPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                        aria-label={forgotShowPassword ? 'Hide password' : 'Show password'}
                      >
                        {forgotShowPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                      <input
                        type={forgotShowPassword ? 'text' : 'password'}
                        value={forgotConfirmPassword}
                        onChange={(e) => {
                          setForgotConfirmPassword(e.target.value);
                          if (forgotError) setForgotError('');
                        }}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                        placeholder="Re-enter new password"
                        autoComplete="new-password"
                        required
                      />
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={forgotLoading}
                      className="h-11 w-full rounded-xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-semibold text-xs tracking-wide shadow-xs hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {forgotLoading ? (
                        <>
                          <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                          <span>Resetting password...</span>
                        </>
                      ) : (
                        <span>Reset Password & Sign In</span>
                      )}
                    </button>
                  </div>

                  {/* Navigation Links */}
                  <div className="flex items-center justify-between pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotStep(1);
                        setForgotOtp('');
                        setForgotError('');
                        setForgotSuccess('');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                      Change Email
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('login');
                        setForgotStep(1);
                        setForgotOtp('');
                        setForgotError('');
                        setForgotSuccess('');
                      }}
                      className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
                    >
                      Back to Login
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            /* ========================================================================= */
            /* STANDARD LOGIN CARD                                                       */
            /* ========================================================================= */
            <>
              {/* Title & Subtitle */}
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                  Welcome Back
                </h2>
                <p className="text-xs text-slate-400 mt-1 font-normal">
                  {loginType === 'user'
                    ? 'Sign in to manage your festival, programs and scores.'
                    : 'Sign in to access your team entries and candidate roster.'}
                </p>
              </div>

              {/* Role Segmented Pill Switcher */}
              <div className="flex bg-slate-100/80 p-1 rounded-xl gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('user');
                    setError('');
                    setForgotNotice(false);
                  }}
                  className={`flex-1 flex items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    loginType === 'user'
                      ? 'bg-white text-indigo-600 shadow-2xs ring-1 ring-slate-200/50'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <User className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                  Event / Admin
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setLoginType('team');
                    setError('');
                    setForgotNotice(false);
                  }}
                  className={`flex-1 flex items-center justify-center py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-200 ${
                    loginType === 'team'
                      ? 'bg-white text-indigo-600 shadow-2xs ring-1 ring-slate-200/50'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 mr-1.5 text-indigo-500" />
                  Team Leader
                </button>
              </div>

              {/* Error Banner */}
              {error && (
                <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in duration-200">
                  <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              )}

              {/* Main Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {loginType === 'user' ? (
                  <>
                    {/* Email Address */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Email address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          type="email"
                          name="email"
                          value={formData.email}
                          onChange={handleChange}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                          placeholder="Enter your email address"
                          autoComplete="email"
                          required
                        />
                      </div>
                    </div>

                    {/* Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="password"
                          value={formData.password}
                          onChange={handleChange}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                          placeholder="Enter your password"
                          autoComplete="current-password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Forgot Password Link */}
                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setForgotEmail(formData.email || '');
                            setForgotStep(1);
                            setForgotError('');
                            setForgotSuccess('');
                            setViewMode('forgot_password');
                          }}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                    </div>

                    {/* MFA / 2FA Block */}
                    {(showOtp || mfaSetup) && (
                      <div className="space-y-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs">
                        <div className="flex items-start gap-2.5">
                          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900">Authenticator verification</p>
                            {mfaSetup && (
                              <>
                                <p className="mt-1 text-[11px] text-slate-600">
                                  Add this key into your authenticator app:
                                </p>
                                <code className="mt-1.5 block break-all rounded-md bg-white border border-indigo-100 px-2.5 py-1 text-[11px] text-indigo-700 font-mono">
                                  {mfaSetup.secret}
                                </code>
                              </>
                            )}
                          </div>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                            6-digit verification code
                          </label>
                          <input
                            type="text"
                            name="otp"
                            value={formData.otp}
                            onChange={handleChange}
                            className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none"
                            placeholder="000000"
                            inputMode="numeric"
                            autoComplete="one-time-code"
                            pattern="[0-9]{6}"
                            maxLength={6}
                            required
                          />
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {/* Team Leader Username */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Team Leader Username
                      </label>
                      <div className="relative">
                        <Users className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          type="text"
                          name="team_username"
                          value={formData.team_username}
                          onChange={handleChange}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                          placeholder="Enter team leader username"
                          autoCapitalize="none"
                          required
                        />
                      </div>
                    </div>

                    {/* Team Leader Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Team Leader Password
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          name="team_password"
                          value={formData.team_password}
                          onChange={handleChange}
                          className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                          placeholder="Enter password"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>

                      {/* Forgot Password Link for Team Leader */}
                      <div className="flex justify-end mt-2">
                        <button
                          type="button"
                          onClick={() => setForgotNotice((prev) => !prev)}
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                        >
                          Forgot password?
                        </button>
                      </div>
                    </div>
                  </>
                )}

                {/* Inline Forgot Password Notice */}
                {forgotNotice && (
                  <div className="rounded-xl border border-indigo-100 bg-indigo-50/90 p-3 text-xs text-indigo-900 animate-in fade-in duration-150">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] leading-relaxed">
                        <strong>Need a password reset?</strong> Please contact your School Administrator or Festival Coordinator to update your credentials.
                      </p>
                      <button
                        type="button"
                        onClick={() => setForgotNotice(false)}
                        className="text-indigo-400 hover:text-indigo-700 p-0.5"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Primary Submit Button */}
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="h-11 w-full rounded-xl bg-indigo-500 hover:bg-indigo-600 active:bg-indigo-700 text-white font-semibold text-xs tracking-wide shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                        <span>Signing in...</span>
                      </>
                    ) : (
                      <span>{loginType === 'user' ? 'Login' : 'Login as Team Leader'}</span>
                    )}
                  </button>
                </div>
              </form>

              {/* Registration & Cross-Role Switcher */}
              <div className="space-y-4 pt-1 text-center">
                <p className="text-xs text-slate-500">
                  Don't have an account?{' '}
                  <button
                    type="button"
                    onClick={() => setRegisterNotice((prev) => !prev)}
                    className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline"
                  >
                    Register
                  </button>
                </p>

                {registerNotice && (
                  <div className="rounded-xl border border-slate-200 bg-slate-50/90 p-3 text-[11px] text-slate-600 text-left animate-in fade-in duration-150">
                    <div className="flex items-start justify-between gap-2">
                      <p className="leading-relaxed">
                        School & team accounts are provisioned by your festival administrator. Contact your coordinator for onboarding.
                      </p>
                      <button
                        type="button"
                        onClick={() => setRegisterNotice(false)}
                        className="text-slate-400 hover:text-slate-600 p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                )}

                {/* Cross-role link with arrow */}
                <div className="pt-3 border-t border-slate-100">
                  {loginType === 'user' ? (
                    <p className="text-xs text-slate-500">
                      Are you a Team Leader?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setLoginType('team');
                          setError('');
                          setForgotNotice(false);
                          setRegisterNotice(false);
                        }}
                        className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        Login here →
                      </button>
                    </p>
                  ) : (
                    <p className="text-xs text-slate-500">
                      Are you an Event Admin?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setLoginType('user');
                          setError('');
                          setForgotNotice(false);
                          setRegisterNotice(false);
                        }}
                        className="font-semibold text-indigo-600 hover:text-indigo-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        Login here →
                      </button>
                    </p>
                  )}
                </div>
              </div>
            </>
          )}

        </div>
      </div>

    </div>
  );
};

export default Login;
