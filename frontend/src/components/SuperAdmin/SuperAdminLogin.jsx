import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { superAdminAPI } from '../../services/api';

const SuperAdminLogin = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '', otp: '' });
  const [mfaSetup, setMfaSetup] = useState(null);
  const [showOtp, setShowOtp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      if (requestError.response?.data?.code === 'mfa_setup_required') {
        try {
          const { data } = await superAdminAPI.setupMfa(form);
          setMfaSetup(data);
          setShowOtp(true);
          setError('Add this key to your authenticator app, then enter its 6-digit code.');
          return;
        } catch (setupError) {
          setError(setupError.response?.data?.error || 'Unable to start MFA setup.');
          return;
        }
      }
      setError(requestError.response?.data?.error || 'Invalid super-admin credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl space-y-6">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-indigo-600 p-3"><ShieldCheck className="h-8 w-8 text-white" /></div>
          <div><h1 className="text-2xl font-bold text-slate-900">Super Admin</h1><p className="text-sm text-slate-500">Eventloo platform control</p></div>
        </div>
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div><label className="form-label">Email</label><input className="form-input" type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
        <div><label className="form-label">Password</label><input className="form-input" type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
        {mfaSetup && <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-slate-700"><p className="font-semibold">Authenticator setup key</p><code className="mt-2 block break-all rounded-lg bg-white p-3 select-all">{mfaSetup.secret}</code><p className="mt-2 text-xs text-slate-500">Keep this key private. Add it to Google Authenticator, 1Password, Authy, or another TOTP app.</p></div>}
        {(mfaSetup || showOtp) && <div><label className="form-label">Authenticator code</label><input className="form-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength="6" required value={form.otp} onChange={(e) => setForm({ ...form, otp: e.target.value.replace(/\D/g, '').slice(0, 6) })} /></div>}
        {!mfaSetup && !showOtp && <button type="button" className="block w-full text-center text-sm font-medium text-indigo-600" onClick={() => setShowOtp(true)}>Use authenticator code</button>}
        <button className="btn btn-primary w-full" disabled={loading}>{loading ? 'Signing in…' : 'Sign in securely'}</button>
        <a className="block text-center text-sm text-slate-500 hover:text-indigo-600" href="/login">School login</a>
      </form>
    </div>
  );
};

export default SuperAdminLogin;
