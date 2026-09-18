import React, { useEffect, useState } from 'react';
import {
  AlertTriangle, Building2, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Eye,
  LogOut, Mail, MapPin, Pencil, Phone, Plus, Search, ShieldCheck,
  Trash2, UserPlus, Users, X,
} from 'lucide-react';
import { superAdminAPI } from '../../services/api';

const emptyForm = {
  name: '', code: '', email: '', phone: '', address: '',
  admin_name: '', admin_email: '', admin_password: '',
  max_events: '', max_users: '', max_students: '',
};

const quotaFields = ['max_events', 'max_users', 'max_students'];
const normalizeSchoolPayload = (values) => ({
  ...values,
  ...Object.fromEntries(quotaFields.map((field) => [
    field,
    values[field] === '' || values[field] === null || values[field] === undefined
      ? null
      : Number(values[field]),
  ])),
});
const usageLabel = (used, limit) => `${used} / ${limit === null || limit === undefined ? '∞' : limit}`;

const formatApiError = (detail, fallback) => {
  if (!detail) return fallback;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail)) return detail.join(' ');
  if (detail.error) return Array.isArray(detail.error) ? detail.error.join(' ') : detail.error;
  return Object.entries(detail)
    .map(([field, messages]) => `${field.replaceAll('_', ' ')}: ${Array.isArray(messages) ? messages.join(' ') : messages}`)
    .join(' ');
};

const Field = ({ label, hint, ...inputProps }) => (
  <label className="block">
    <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
    <input className="form-input w-full rounded-xl border-slate-300 bg-white px-3.5 py-2.5 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" {...inputProps} />
    {hint && <span className="mt-1.5 block text-xs text-slate-500">{hint}</span>}
  </label>
);

const QuotaFields = ({ values, onChange, creating = false }) => (
  <div className="sm:col-span-2">
    <div className="mb-3 border-t border-slate-100 pt-5">
      <h3 className="text-sm font-bold text-slate-900">Organization limits</h3>
      <p className="mt-1 text-xs text-slate-500">Leave a field blank for unlimited access. Limits are enforced by the server.</p>
    </div>
    <div className="grid gap-4 sm:grid-cols-3">
      <Field label="Maximum events" type="number" min="0" value={values.max_events} onChange={(event) => onChange('max_events', event.target.value)} placeholder="Unlimited" />
      <Field label="Maximum users" type="number" min={creating ? '1' : '0'} value={values.max_users} onChange={(event) => onChange('max_users', event.target.value)} placeholder="Unlimited" hint="Dashboard accounts" />
      <Field label="Maximum students" type="number" min="0" value={values.max_students} onChange={(event) => onChange('max_students', event.target.value)} placeholder="Unlimited" />
    </div>
  </div>
);

const Modal = ({ title, subtitle, onClose, children, danger = false }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
    <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white shadow-2xl">
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className={`text-xl font-bold ${danger ? 'text-red-700' : 'text-slate-900'}`}>{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close"><X className="h-5 w-5" /></button>
      </div>
      {children}
    </div>
  </div>
);

const SuperAdminDashboard = () => {
  const [stats, setStats] = useState({});
  const [schools, setSchools] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({
    name: '', code: '', email: '', phone: '', address: '',
    max_events: '', max_users: '', max_students: '',
  });
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [modal, setModal] = useState(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [page, setPage] = useState(1);
  const [schoolCount, setSchoolCount] = useState(0);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(schoolCount / pageSize));

  const load = async (pageNumber = page, search = query) => {
    const [statsResponse, schoolsResponse] = await Promise.all([
      superAdminAPI.dashboard(),
      superAdminAPI.schools({ page: pageNumber, page_size: pageSize, search: search.trim() || undefined }),
    ]);
    setStats(statsResponse.data);
    setSchools(schoolsResponse.data.results || schoolsResponse.data);
    setSchoolCount(schoolsResponse.data.count ?? schoolsResponse.data.length);
  };

  useEffect(() => {
    setLoadingSchools(true);
    const timer = setTimeout(() => {
      load(page, query)
        .catch(() => setError('Could not load platform data.'))
        .finally(() => setLoadingSchools(false));
    }, query ? 250 : 0);
    return () => clearTimeout(timer);
    // load uses the current page and query supplied above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, query]);

  const closeModal = () => {
    if (saving) return;
    setModal(null); setSelectedSchool(null); setDeleteConfirmation(''); setError('');
  };

  const openEdit = (school) => {
    setSelectedSchool(school);
    setEditForm({
      name: school.name, code: school.code, email: school.email || '',
      phone: school.phone || '', address: school.address || '',
      max_events: school.max_events ?? '', max_users: school.max_users ?? '',
      max_students: school.max_students ?? '',
    });
    setError(''); setModal('edit');
  };

  const openAdmin = (school) => {
    setSelectedSchool(school); setAdminForm({ name: '', email: '', password: '' }); setError(''); setModal('admin');
  };

  const openView = (school) => {
    setSelectedSchool(school); setError(''); setModal('view');
  };

  const runRequest = async (request, message, refreshPage = page) => {
    setSaving(true); setError(''); setSuccess('');
    try {
      await request();
      await load(refreshPage, query);
      setPage(refreshPage);
      setModal(null); setSelectedSchool(null); setDeleteConfirmation('');
      setSuccess(message);
      return true;
    } catch (requestError) {
      setError(formatApiError(requestError.response?.data, 'The request could not be completed.'));
      return false;
    } finally { setSaving(false); }
  };

  const createSchool = async (event) => {
    event.preventDefault();
    if (await runRequest(() => superAdminAPI.createSchool(normalizeSchoolPayload(form)), `${form.name} was created successfully.`)) setForm(emptyForm);
  };

  const updateSchool = (event) => {
    event.preventDefault();
    runRequest(() => superAdminAPI.updateSchool(selectedSchool.id, normalizeSchoolPayload(editForm)), `${editForm.name} was updated successfully.`);
  };

  const addAdministrator = (event) => {
    event.preventDefault();
    runRequest(() => superAdminAPI.createAdmin(selectedSchool.id, adminForm), `Administrator added to ${selectedSchool.name}.`);
  };

  const deleteSchool = (event) => {
    event.preventDefault();
    const refreshPage = schools.length === 1 && page > 1 ? page - 1 : page;
    runRequest(() => superAdminAPI.deleteSchool(selectedSchool.id, deleteConfirmation), `${selectedSchool.name} and all of its data were deleted.`, refreshPage);
  };

  const setStatus = (school) => {
    const nextStatus = school.status === 'active' ? 'suspended' : 'active';
    runRequest(() => superAdminAPI.updateSchool(school.id, { status: nextStatus }), `${school.name} is now ${nextStatus}.`);
  };

  const logout = () => { localStorage.clear(); window.location.href = '/super-admin/login'; };
  const cards = [
    ['Schools', stats.schools || 0, Building2, 'bg-indigo-50 text-indigo-600'],
    ['Active schools', stats.active_schools || 0, ShieldCheck, 'bg-emerald-50 text-emerald-600'],
    ['Administrators', stats.school_admins || 0, Users, 'bg-violet-50 text-violet-600'],
    ['Events', stats.events || 0, CalendarDays, 'bg-amber-50 text-amber-600'],
  ];

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-800 bg-slate-950 text-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
          <div className="flex items-center gap-3"><div className="rounded-xl bg-indigo-500 p-2.5"><ShieldCheck className="h-6 w-6" /></div><div><h1 className="text-xl font-bold">Eventloo Control Center</h1><p className="text-xs text-slate-400">Super administrator workspace</p></div></div>
          <button onClick={logout} className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white"><LogOut className="h-4 w-4" /> Logout</button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-7 p-5 sm:p-8">
        <div><p className="text-sm font-semibold uppercase tracking-wider text-indigo-600">Overview</p><h2 className="mt-1 text-3xl font-bold tracking-tight">School management</h2><p className="mt-1 text-slate-500">Create and manage isolated school workspaces from one place.</p></div>
        {success && <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-5 w-5" />{success}</div>}
        {error && !modal && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value, Icon, color]) => <div key={label} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm"><div className={`inline-flex rounded-xl p-2.5 ${color}`}><Icon className="h-5 w-5" /></div><div className="mt-4 text-3xl font-bold">{value}</div><div className="mt-1 text-sm text-slate-500">{label}</div></div>)}
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div><h3 className="text-lg font-bold">Schools</h3><p className="text-sm text-slate-500">{schoolCount} independent workspace{schoolCount === 1 ? '' : 's'}</p></div>
            <div className="flex flex-col gap-2 sm:flex-row"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search schools" className="w-full rounded-lg border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-indigo-500 focus:ring-indigo-500 sm:w-56" /></label><button onClick={() => { setForm(emptyForm); setError(''); setModal('create'); }} className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-indigo-700"><Plus className="h-4 w-4" /> Add school</button></div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 font-semibold">School</th><th className="px-5 py-3 font-semibold">Contact</th><th className="px-5 py-3 text-center font-semibold">Users / Limit</th><th className="px-5 py-3 text-center font-semibold">Students / Limit</th><th className="px-5 py-3 text-center font-semibold">Events / Limit</th><th className="px-5 py-3 font-semibold">Status</th><th className="px-5 py-3 text-right font-semibold">Action</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {loadingSchools ? <tr><td colSpan="7" className="px-5 py-10 text-center text-slate-500">Loading schools…</td></tr> : schools.length === 0 ? <tr><td colSpan="7" className="px-5 py-10 text-center"><Building2 className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 font-medium text-slate-700">No schools found</p></td></tr> : schools.map((school) => <tr key={school.id} className="hover:bg-slate-50/80">
                  <td className="whitespace-nowrap px-5 py-3.5"><div className="flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-50 font-bold text-indigo-600">{school.name.charAt(0).toUpperCase()}</div><div><p className="font-semibold text-slate-900">{school.name}</p><p className="font-mono text-xs text-slate-500">{school.code}</p></div></div></td>
                  <td className="max-w-[220px] px-5 py-3.5"><p className="truncate text-slate-700">{school.email || '—'}</p><p className="text-xs text-slate-500">{school.phone || 'No phone'}</p></td>
                  <td className="px-5 py-3.5 text-center font-medium">{usageLabel(school.user_count, school.max_users)}</td><td className="px-5 py-3.5 text-center font-medium">{usageLabel(school.student_count, school.max_students)}</td><td className="px-5 py-3.5 text-center font-medium">{usageLabel(school.event_count, school.max_events)}</td>
                  <td className="px-5 py-3.5"><span className={`rounded-full px-2.5 py-1 text-xs font-semibold capitalize ${school.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{school.status}</span></td>
                  <td className="px-5 py-3.5 text-right"><button onClick={() => openView(school)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700"><Eye className="h-3.5 w-3.5" /> View</button></td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-500">{schoolCount === 0 ? 'No records' : `Showing ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, schoolCount)} of ${schoolCount}`}</p>
            <div className="flex items-center gap-2"><button disabled={page <= 1 || loadingSchools} onClick={() => setPage((value) => value - 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /> Previous</button><span className="px-2 text-xs font-medium text-slate-600">Page {page} of {totalPages}</span><button disabled={page >= totalPages || loadingSchools} onClick={() => setPage((value) => value + 1)} className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40">Next <ChevronRight className="h-4 w-4" /></button></div>
          </div>
        </section>
      </main>

      {modal === 'view' && selectedSchool && <Modal title={selectedSchool.name} subtitle={`School code: ${selectedSchool.code}`} onClose={closeModal}><div className="space-y-5 p-6">
        <div className="grid grid-cols-3 divide-x rounded-xl border border-slate-200 bg-slate-50 py-4 text-center"><div><p className="text-xl font-bold">{usageLabel(selectedSchool.user_count, selectedSchool.max_users)}</p><p className="text-xs text-slate-500">Users / Limit</p></div><div><p className="text-xl font-bold">{usageLabel(selectedSchool.student_count, selectedSchool.max_students)}</p><p className="text-xs text-slate-500">Students / Limit</p></div><div><p className="text-xl font-bold">{usageLabel(selectedSchool.event_count, selectedSchool.max_events)}</p><p className="text-xs text-slate-500">Events / Limit</p></div></div>
        <dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email</dt><dd className="mt-1 flex items-center gap-2 text-slate-700"><Mail className="h-4 w-4" />{selectedSchool.email || 'Not provided'}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone</dt><dd className="mt-1 flex items-center gap-2 text-slate-700"><Phone className="h-4 w-4" />{selectedSchool.phone || 'Not provided'}</dd></div><div className="sm:col-span-2"><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Address</dt><dd className="mt-1 flex items-start gap-2 text-slate-700"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{selectedSchool.address || 'Not provided'}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Status</dt><dd className="mt-1 capitalize text-slate-700">{selectedSchool.status}</dd></div><div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">Created</dt><dd className="mt-1 text-slate-700">{new Date(selectedSchool.created_at).toLocaleDateString()}</dd></div></dl>
        <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-5"><button onClick={() => openEdit(selectedSchool)} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"><Pencil className="h-4 w-4" /> Edit</button><button onClick={() => openAdmin(selectedSchool)} className="inline-flex items-center gap-2 rounded-lg bg-indigo-50 px-3.5 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100"><UserPlus className="h-4 w-4" /> Add admin</button><button onClick={() => setStatus(selectedSchool)} className="rounded-lg px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100">{selectedSchool.status === 'active' ? 'Suspend school' : 'Activate school'}</button><button onClick={() => { setDeleteConfirmation(''); setError(''); setModal('delete'); }} className="ml-auto inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button></div>
      </div></Modal>}

      {modal === 'create' && <Modal title="Create a school" subtitle="Set up an independent workspace and its first administrator." onClose={closeModal}><form onSubmit={createSchool} className="grid gap-4 p-6 sm:grid-cols-2">{[['name','School name','text'],['code','School code','text'],['email','School email','email'],['phone','Phone','text'],['admin_name','Administrator name','text'],['admin_email','Administrator email','email'],['admin_password','Administrator password','password'],['address','Address','text']].map(([name,label,type]) => <Field key={name} label={label} type={type} required={!['email','phone','address'].includes(name)} value={form[name]} onChange={(event) => setForm({ ...form, [name]: event.target.value })} hint={name === 'code' ? 'Used on the school login page, for example: green-valley' : name === 'admin_password' ? 'Use at least 8 characters and avoid common passwords.' : null} />)}<QuotaFields creating values={form} onChange={(name, value) => setForm({ ...form, [name]: value })} />{error && <div className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="flex justify-end gap-3 border-t pt-5 sm:col-span-2"><button type="button" onClick={closeModal} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Creating…' : 'Create school'}</button></div></form></Modal>}

      {modal === 'edit' && selectedSchool && <Modal title={`Edit ${selectedSchool.name}`} subtitle="Changes are applied to the school workspace immediately." onClose={closeModal}><form onSubmit={updateSchool} className="grid gap-4 p-6 sm:grid-cols-2">{[['name','School name','text'],['code','School code','text'],['email','School email','email'],['phone','Phone','text'],['address','Address','text']].map(([name,label,type]) => <div key={name} className={name === 'address' ? 'sm:col-span-2' : ''}><Field label={label} type={type} required={['name','code'].includes(name)} value={editForm[name]} onChange={(event) => setEditForm({ ...editForm, [name]: event.target.value })} /></div>)}<QuotaFields values={editForm} onChange={(name, value) => setEditForm({ ...editForm, [name]: value })} />{error && <div className="sm:col-span-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="flex justify-end gap-3 border-t pt-5 sm:col-span-2"><button type="button" onClick={closeModal} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Saving…' : 'Save changes'}</button></div></form></Modal>}

      {modal === 'admin' && selectedSchool && <Modal title="Add administrator" subtitle={`Create another administrator for ${selectedSchool.name}.`} onClose={closeModal}><form onSubmit={addAdministrator} className="space-y-4 p-6"><Field label="Administrator name" required value={adminForm.name} onChange={(event) => setAdminForm({ ...adminForm, name: event.target.value })} /><Field label="Email address" type="email" required value={adminForm.email} onChange={(event) => setAdminForm({ ...adminForm, email: event.target.value })} /><Field label="Temporary password" type="password" required value={adminForm.password} onChange={(event) => setAdminForm({ ...adminForm, password: event.target.value })} hint="Use at least 8 characters and avoid common passwords." />{error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="flex justify-end gap-3 border-t pt-5"><button type="button" onClick={closeModal} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">{saving ? 'Creating…' : 'Create administrator'}</button></div></form></Modal>}

      {modal === 'delete' && selectedSchool && <Modal title={`Delete ${selectedSchool.name}?`} subtitle="This action cannot be undone." onClose={closeModal} danger><form onSubmit={deleteSchool} className="space-y-5 p-6"><div className="flex gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><AlertTriangle className="h-5 w-5 shrink-0" /><p>This permanently deletes the school workspace, including <strong>{selectedSchool.admin_count} administrators, {selectedSchool.student_count} students, {selectedSchool.event_count} events</strong>, teams, assignments, results, points and settings.</p></div><Field label={<>Type <strong>{selectedSchool.name}</strong> to confirm</>} autoComplete="off" required value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} />{error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</div>}<div className="flex justify-end gap-3 border-t pt-5"><button type="button" onClick={closeModal} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={saving || deleteConfirmation !== selectedSchool.name} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 className="h-4 w-4" />{saving ? 'Deleting…' : 'Delete permanently'}</button></div></form></Modal>}
    </div>
  );
};

export default SuperAdminDashboard;
