import React, { useEffect, useState } from 'react';
import {
  CheckCircle2, ChevronLeft, ChevronRight, Eye, Pencil, Plus, Search,
  ShieldCheck, Trash2, UserCog, Users, X,
} from 'lucide-react';
import { usersAPI } from '../../services/api';

const emptyForm = {
  name: '', email: '', role: 'event_manager', password: '', confirmPassword: '', is_active: true,
};

const apiError = (error) => {
  const data = error?.response?.data;
  if (!data) return 'The request could not be completed.';
  if (typeof data === 'string') return data;
  if (data.error) return Array.isArray(data.error) ? data.error.join(' ') : data.error;
  if (data.detail) return data.detail;
  return Object.entries(data).map(([field, value]) => {
    const message = Array.isArray(value) ? value.join(' ') : value;
    return `${field.replaceAll('_', ' ')}: ${message}`;
  }).join(' ');
};

const Modal = ({ title, subtitle, onClose, children }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
    <div className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div><h2 className="text-xl font-bold text-slate-900">{title}</h2>{subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}</div>
        <button type="button" onClick={onClose} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      {children}
    </div>
  </div>
);

const Input = ({ label, ...props }) => (
  <label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">{label}</span><input {...props} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
);

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [summary, setSummary] = useState({ total: 0, active: 0, inactive: 0 });
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  const load = async () => {
    setLoading(true);
    try {
      const [listResponse, summaryResponse] = await Promise.all([
        usersAPI.list({ page, page_size: pageSize, search: query.trim() || undefined, status: status || undefined }),
        usersAPI.summary(),
      ]);
      const data = listResponse.data;
      setUsers(data.results || data);
      setCount(data.count ?? data.length);
      setSummary(summaryResponse.data);
    } catch (requestError) {
      setError(apiError(requestError));
    } finally { setLoading(false); }
  };

  useEffect(() => {
    const timer = setTimeout(load, query ? 250 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query, status]);

  const close = () => { if (!saving) { setModal(null); setSelected(null); setError(''); } };
  const openCreate = () => { setForm(emptyForm); setError(''); setModal('create'); };
  const openView = (user) => { setSelected(user); setError(''); setModal('view'); };
  const openEdit = (user) => {
    setSelected(user);
    setForm({ name: user.name || '', email: user.email, role: user.role, password: '', confirmPassword: '', is_active: user.is_active });
    setError(''); setModal('edit');
  };

  const save = async (event) => {
    event.preventDefault();
    if (form.password !== form.confirmPassword) { setError('Passwords do not match.'); return; }
    const payload = { name: form.name.trim(), email: form.email.trim(), role: form.role, is_active: form.is_active };
    if (form.password) payload.password = form.password;
    setSaving(true); setError(''); setMessage('');
    try {
      if (modal === 'create') await usersAPI.create(payload);
      else await usersAPI.update(selected.id, payload);
      setMessage(modal === 'create' ? 'User created successfully.' : 'User updated successfully.');
      setModal(null); setSelected(null); setForm(emptyForm);
      await load();
    } catch (requestError) { setError(apiError(requestError)); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true); setError('');
    try {
      await usersAPI.remove(selected.id);
      setMessage('User deleted successfully.'); setModal(null); setSelected(null);
      if (users.length === 1 && page > 1) setPage((value) => value - 1); else await load();
    } catch (requestError) { setError(apiError(requestError)); }
    finally { setSaving(false); }
  };

  const roleLabel = (role) => role === 'admin' ? 'Admin' : 'Event Manager';
  const joined = (value) => value ? new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  return <div className="mx-auto max-w-7xl space-y-6 pb-10">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Organization</p><h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Users</h1><p className="mt-1 text-sm text-slate-500">Manage the people who can access this school dashboard.</p></div>
      <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"><Plus className="h-4 w-4" /> Add user</button>
    </div>

    {message && <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"><CheckCircle2 className="h-4 w-4" />{message}</div>}
    {error && !modal && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

    <div className="grid grid-cols-3 gap-3">
      {[["Total users", summary.total, Users], ["Active", summary.active, ShieldCheck], ["Inactive", summary.inactive, UserCog]].map(([label, value, Icon]) => <div key={label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="rounded-xl bg-indigo-50 p-2 text-indigo-600"><Icon className="h-4 w-4" /></span><div><p className="text-2xl font-bold text-slate-900">{value}</p><p className="text-xs font-medium text-slate-500">{label}</p></div></div></div>)}
    </div>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row">
        <label className="relative flex-1"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search by name or email" className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
        <select value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-indigo-500"><option value="">All statuses</option><option value="active">Active</option><option value="inactive">Inactive</option></select>
      </div>
      <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3 font-semibold">User</th><th className="px-5 py-3 font-semibold">Role</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 font-semibold">Joined</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr></thead><tbody className="divide-y divide-slate-100">
        {loading ? <tr><td colSpan="5" className="px-5 py-12 text-center text-slate-500">Loading users…</td></tr> : users.length === 0 ? <tr><td colSpan="5" className="px-5 py-14 text-center"><Users className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 font-semibold text-slate-700">No users found</p><p className="mt-1 text-xs text-slate-500">Add a dashboard user to get started.</p></td></tr> : users.map((user) => <tr key={user.id} className="hover:bg-slate-50/70"><td className="px-5 py-3.5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-bold text-indigo-600">{(user.name || user.email).charAt(0).toUpperCase()}</span><div><p className="font-semibold text-slate-900">{user.name || 'Unnamed user'} {user.id === currentUser.id && <span className="ml-1 text-xs font-medium text-indigo-600">You</span>}</p><p className="text-xs text-slate-500">{user.email}</p></div></div></td><td className="px-5 py-3.5"><span className="rounded-full bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{roleLabel(user.role)}</span></td><td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${user.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{user.is_active ? 'Active' : 'Inactive'}</span></td><td className="whitespace-nowrap px-5 py-3.5 text-slate-600">{joined(user.date_joined)}</td><td className="px-5 py-3.5 text-right"><div className="inline-flex gap-1"><button onClick={() => openView(user)} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" aria-label={`View ${user.name || user.email}`}><Eye className="h-4 w-4" /></button><button onClick={() => openEdit(user)} className="rounded-lg p-2 text-slate-500 hover:bg-indigo-50 hover:text-indigo-600" aria-label={`Edit ${user.name || user.email}`}><Pencil className="h-4 w-4" /></button></div></td></tr>)}
      </tbody></table></div>
      <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-5 py-3"><p className="text-xs text-slate-500">{count ? `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, count)} of ${count}` : 'No records'}</p><div className="flex items-center gap-2"><button disabled={page === 1 || loading} onClick={() => setPage((value) => value - 1)} className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span className="text-xs font-medium text-slate-600">{page} / {totalPages}</span><button disabled={page >= totalPages || loading} onClick={() => setPage((value) => value + 1)} className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-600 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div>
    </section>

    {(modal === 'create' || modal === 'edit') && <Modal title={modal === 'create' ? 'Add user' : 'Edit user'} subtitle={modal === 'create' ? 'Create a new school dashboard account.' : 'Update access and account details.'} onClose={close}><form onSubmit={save} className="space-y-4 p-6"><Input label="Full name" required value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Jane Smith" /><Input label="Email address" type="email" required value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="jane@school.com" /><label className="block"><span className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-slate-500">Role</span><select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-indigo-500"><option value="event_manager">Event Manager</option><option value="admin">Admin</option></select><span className="mt-1.5 block text-xs text-slate-500">Admins manage school settings and users. Event Managers manage events only.</span></label><div className="grid gap-4 sm:grid-cols-2"><Input label={modal === 'create' ? 'Password' : 'New password (optional)'} type="password" required={modal === 'create'} value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} autoComplete="new-password" /><Input label="Confirm password" type="password" required={Boolean(form.password)} value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} autoComplete="new-password" /></div>{modal === 'edit' && <label className="flex items-center justify-between rounded-xl border border-slate-200 p-3"><span><span className="block text-sm font-semibold text-slate-800">Active account</span><span className="block text-xs text-slate-500">Inactive users cannot sign in.</span></span><input type="checkbox" checked={form.is_active} onChange={(event) => setForm({ ...form, is_active: event.target.checked })} className="h-5 w-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" /></label>}{error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={close} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : modal === 'create' ? 'Create user' : 'Save changes'}</button></div></form></Modal>}

    {modal === 'view' && selected && <Modal title={selected.name || 'User details'} subtitle={selected.email} onClose={close}><div className="space-y-5 p-6"><div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Role</p><p className="mt-1 font-semibold text-slate-800">{roleLabel(selected.role)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Status</p><p className="mt-1 font-semibold text-slate-800">{selected.is_active ? 'Active' : 'Inactive'}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">Joined</p><p className="mt-1 font-semibold text-slate-800">{joined(selected.date_joined)}</p></div><div className="rounded-xl bg-slate-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-slate-400">MFA</p><p className="mt-1 font-semibold text-slate-800">{selected.mfa_enabled ? 'Enabled' : 'Not enabled'}</p></div></div>{error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="flex items-center gap-2 border-t border-slate-100 pt-5"><button onClick={() => openEdit(selected)} className="inline-flex items-center gap-2 rounded-xl bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"><Pencil className="h-4 w-4" /> Edit user</button>{selected.id !== currentUser.id && <button onClick={() => setModal('delete')} className="ml-auto inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button>}</div></div></Modal>}

    {modal === 'delete' && selected && <Modal title="Delete user?" subtitle="This action cannot be undone." onClose={close}><div className="space-y-5 p-6"><p className="text-sm leading-6 text-slate-600">Permanently delete <strong className="text-slate-900">{selected.name || selected.email}</strong>? They will immediately lose access to this school.</p>{error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button onClick={close} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={saving} onClick={remove} className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">{saving ? 'Deleting…' : 'Delete user'}</button></div></div></Modal>}
  </div>;
};

export default UsersPage;
