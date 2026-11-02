import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  Eye, 
  EyeOff, 
  AlertCircle, 
  KeyRound, 
  ArrowLeft,
  Server,
  Building2,
  CheckCircle2,
  Copy,
  Check
} from 'lucide-react';
import { superAdminAPI } from '../../services/api';
import EventlooLogo from '../common/EventlooLogo';

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', otp: '' });
  const [mfaSetup, setMfaSetup] = useState(null);
  const [showOtp, setShowOtp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
    if (error) setError('');
  };

  const copySecretKey = () => {
    if (mfaSetup?.secret) {
      navigator.clipboard.writeText(mfaSetup.secret);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const submit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (mfaSetup) {
        await superAdminAPI.confirmMfa(form);
        setMfaSetup(null);
      }
      await superAdminAPI.login(form);
      localStorage.clear();
      localStorage.setItem('user_role', 'super_admin');
      localStorage.setItem('access_type', 'super_admin');
      navigate('/super-admin', { replace: true });
    } catch (requestError) {
      const responseData = requestError.response?.data;
      if (responseData?.code === 'mfa_setup_required') {
        try {
          const { data } = await superAdminAPI.setupMfa(form);
          setMfaSetup(data);
          setShowOtp(true);
          setError('Add this secret key to your authenticator app, then enter the 6-digit code below.');
          return;
        } catch (setupError) {
          setError(setupError.response?.data?.error || 'Unable to start MFA setup.');
          return;
        }
      }
      if (responseData?.code === 'mfa_required') {
        setShowOtp(true);
        setError('Please enter the 6-digit authenticator code to proceed.');
        return;
      }
      setError(responseData?.error || responseData?.detail || 'Invalid super-admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex bg-white font-sans antialiased text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* ========================================================================= */}
      {/* 1. LEFT VISUAL / STORYTELLING PANEL (MATCHING MAIN LOGIN MODEL) */}
      {/* ========================================================================= */}
      <div className="hidden lg:flex lg:w-[54%] xl:w-[58%] relative flex-col justify-between overflow-hidden bg-gradient-to-b from-[#f3f7fd] via-[#ecf3fc] to-[#e4eefb] p-8 xl:p-12 select-none border-r border-slate-100">
        
        {/* Soft Organic Right Wave Divider */}
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
          <div className="flex items-center gap-3">
            <EventlooLogo size="md" />
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-100/80 border border-indigo-200/80 text-[11px] font-bold text-indigo-700 tracking-wide uppercase">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Control Plane
            </span>
          </div>

          <div className="mt-8 xl:mt-10">
            <h1 className="text-3xl sm:text-4xl xl:text-[44px] font-extrabold text-slate-900 tracking-tight leading-[1.14]">
              Platform Governance
              <span className="block text-indigo-600 mt-1">Tenant Infrastructure</span>
            </h1>
            <p className="mt-3.5 text-xs sm:text-sm text-slate-500 font-normal leading-relaxed max-w-md">
              Manage school institutions, allocate event & student quotas, oversee multi-campus festivals, and maintain system-wide security.
            </p>
          </div>
        </div>

        {/* Center Card: Feature Pills / Illustration */}
        <div className="relative z-10 my-4 flex-1 flex items-center justify-center">
          <div className="w-full max-w-xl space-y-4">
            
            <div className="rounded-2xl overflow-hidden shadow-2xl shadow-indigo-950/10 border border-white/80 bg-white/40 backdrop-blur-xs p-6 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200/60">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-500/20">
                    <Server className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-slate-900">Eventloo Core Engine</h3>
                    <p className="text-[11px] text-slate-500">Multi-tenant isolation & license manager</p>
                  </div>
                </div>
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-semibold">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Healthy
                </span>
              </div>

              {/* Security Metrics Grid */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="p-3 rounded-xl bg-white/70 border border-slate-100">
                  <div className="flex items-center gap-2 text-indigo-600 mb-1">
                    <Building2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold text-slate-700">Tenant Control</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">Create & provision school instances with automated admin seeding.</p>
                </div>

                <div className="p-3 rounded-xl bg-white/70 border border-slate-100">
                  <div className="flex items-center gap-2 text-indigo-600 mb-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span className="text-[11px] font-semibold text-slate-700">Quota Enforcer</span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-tight">Enforce strict candidate, event, and user licensing limits.</p>
                </div>
              </div>
            </div>

            {/* Micro Badge */}
            <div className="flex items-center justify-center gap-2 text-center">
              <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500 animate-ping" />
              <span className="text-[11px] text-slate-500 font-medium">
                Root Access Protected by Multi-Factor Authentication
              </span>
            </div>

          </div>
        </div>

        {/* Bottom Status / Badges */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-slate-500 font-medium pt-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            <span>Encrypted Session Management</span>
          </div>
          <span>Platform Version 2.4.0</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. RIGHT LOGIN CARD / FORM (MATCHING MAIN LOGIN MODEL) */}
      {/* ========================================================================= */}
      <div className="w-full lg:w-[46%] xl:w-[42%] flex flex-col justify-center items-center px-6 sm:px-12 xl:px-16 py-10 bg-white min-h-screen">
        <div className="w-full max-w-[390px] space-y-6">

          {/* Mobile Logo Only */}
          <div className="lg:hidden flex flex-col items-center text-center mb-2">
            <EventlooLogo size="lg" />
            <p className="text-xs text-slate-500 mt-2">Platform Super Administrator</p>
          </div>

          {/* Role Indicator Pill */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 text-xs font-semibold text-indigo-700">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <span>Super Admin Authentication</span>
          </div>

          {/* Title & Subtitle */}
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Platform Control
            </h2>
            <p className="text-xs text-slate-400 mt-1 font-normal">
              Enter master credentials to manage tenants and school licenses.
            </p>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="bg-rose-50 border border-rose-200/80 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-700 animate-in fade-in duration-200">
              <AlertCircle className="h-4 w-4 text-rose-500 shrink-0 mt-0.5" />
              <span className="leading-snug">{error}</span>
            </div>
          )}

          {/* MFA Setup QR/Key Box */}
          {mfaSetup && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-4 space-y-3 text-xs text-slate-700 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 text-indigo-900 font-bold">
                <KeyRound className="w-4 h-4 text-indigo-600" />
                <span>Authenticator Setup Required</span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Add this key to your TOTP authenticator app (Google Authenticator, 1Password, Authy):
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2.5 rounded-lg bg-white border border-indigo-200/80 font-mono text-[11px] select-all break-all text-slate-800">
                  {mfaSetup.secret}
                </code>
                <button
                  type="button"
                  onClick={copySecretKey}
                  className="p-2.5 rounded-lg bg-white border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-colors"
                  title="Copy Key"
                >
                  {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={submit} className="space-y-4">
            
            {/* Email Address */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Master email
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                  placeholder="superadmin@eventloo.com"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Master password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={form.password}
                  onChange={handleChange}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                  placeholder="Enter your master password"
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
            </div>

            {/* MFA OTP Code (if active or enabled) */}
            {(mfaSetup || showOtp) && (
              <div className="animate-in fade-in duration-200">
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  6-digit authenticator code
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-500 pointer-events-none" />
                  <input
                    type="text"
                    name="otp"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={form.otp}
                    onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                    className="h-11 w-full rounded-xl border border-indigo-300 bg-white pl-10 pr-3.5 text-xs font-mono tracking-widest text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                    placeholder="123456"
                    required
                  />
                </div>
              </div>
            )}

            {/* Optional toggle for OTP if not requested automatically */}
            {!mfaSetup && !showOtp && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowOtp(true)}
                  className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-700 hover:underline transition-colors"
                >
                  Enter authenticator code (MFA)
                </button>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="h-11 w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition-all shadow-md shadow-indigo-600/20 hover:shadow-indigo-600/30 active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  <span>Access Platform Dashboard</span>
                </>
              )}
            </button>

          </form>

          {/* Footer Back Link */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <Link
              to="/login"
              className="font-medium text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to School Login</span>
            </Link>

            <span className="text-[11px] text-slate-400 font-medium">
              System Admin
            </span>
          </div>

        </div>
      </div>

    </div>
  );
};

export default SuperAdminLogin;
