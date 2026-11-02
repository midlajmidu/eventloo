import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2, Users, Calendar, ShieldCheck, AlertCircle, CheckCircle2,
  Clock, Plus, Search, Trash2, Pencil, Eye, LogOut, ChevronRight, ChevronLeft,
  X, Lock, Mail, Phone, MapPin, Activity, Server, HardDrive, Shield,
  RefreshCw, Sparkles, PauseCircle, PlayCircle, Layers, Globe, Filter,
  KeyRound, UserPlus, Check, AlertTriangle, ArrowUpRight
} from 'lucide-react';
import { superAdminAPI, authAPI } from '../../services/api';
import EventlooLogo from '../common/EventlooLogo';

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

const Modal = ({ title, subtitle, onClose, children, danger = false, maxWidth = 'max-w-2xl' }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
    <div className={`max-h-[92vh] w-full ${maxWidth} overflow-y-auto rounded-3xl bg-white shadow-2xl border border-slate-100`}>
      <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
        <div>
          <h2 className={`text-xl font-bold ${danger ? 'text-rose-700' : 'text-slate-900'}`}>{title}</h2>
          {subtitle && <p className="mt-1 text-xs text-slate-500 font-normal">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="p-6">{children}</div>
    </div>
  </div>
);

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview'); // overview | schools | admins | events | system
  const [stats, setStats] = useState({});
  const [schools, setSchools] = useState([]);
  const [allAdmins, setAllAdmins] = useState([]);
  const [allEvents, setAllEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Search & Filtering
  const [query, setQuery] = useState('');
  const [schoolStatusFilter, setSchoolStatusFilter] = useState('all'); // all | active | suspended
  const [page, setPage] = useState(1);
  const [schoolCount, setSchoolCount] = useState(0);
  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(schoolCount / pageSize));

  // Modals state
  const [modal, setModal] = useState(null); // 'create' | 'edit' | 'admins' | 'events' | 'delete' | 'suspend_confirm'
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [schoolEvents, setSchoolEvents] = useState([]);
  const [schoolAdminsList, setSchoolAdminsList] = useState([]);
  const [loadingModalData, setLoadingModalData] = useState(false);

  // Forms
  const [form, setForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState({
    name: '', code: '', email: '', phone: '', address: '',
    max_events: '', max_users: '', max_students: '',
  });
  const [adminForm, setAdminForm] = useState({ name: '', email: '', password: '' });
  const [resetPwdForm, setResetPwdForm] = useState({ adminId: null, adminName: '', password: '' });
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [saving, setSaving] = useState(false);

  // Load telemetry data
  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      const [dashRes, schoolsRes] = await Promise.all([
        superAdminAPI.dashboard(),
        superAdminAPI.schools({ page, page_size: pageSize, search: query.trim() || undefined }),
      ]);
      setStats(dashRes.data || {});
      setSchools(schoolsRes.data.results || schoolsRes.data || []);
      setSchoolCount(schoolsRes.data.count ?? schoolsRes.data.length ?? 0);

      // Optional async loads for cross-tenant overview tabs
      superAdminAPI.allAdmins().then(res => setAllAdmins(res.data || [])).catch(() => {});
      superAdminAPI.allEvents().then(res => setAllEvents(res.data || [])).catch(() => {});
    } catch (err) {
      setError('Could not refresh platform telemetry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [page, query]);

  const showNotification = (msg, isErr = false) => {
    if (isErr) {
      setError(msg);
      setTimeout(() => setError(''), 5000);
    } else {
      setSuccess(msg);
      setTimeout(() => setSuccess(''), 4000);
    }
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } catch (_) {}
    localStorage.clear();
    sessionStorage.clear();
    navigate('/super-admin/login', { replace: true });
  };

  // Open School Admins Modal
  const openSchoolAdmins = async (school) => {
    setSelectedSchool(school);
    setModal('admins');
    setLoadingModalData(true);
    setAdminForm({ name: '', email: '', password: '' });
    setResetPwdForm({ adminId: null, adminName: '', password: '' });
    try {
      const res = await superAdminAPI.admins(school.id);
      setSchoolAdminsList(res.data || []);
    } catch (err) {
      showNotification('Failed to load school administrators', true);
    } finally {
      setLoadingModalData(false);
    }
  };

  // Open School Events Modal
  const openSchoolEvents = async (school) => {
    setSelectedSchool(school);
    setModal('events');
    setLoadingModalData(true);
    try {
      const res = await superAdminAPI.schoolEvents(school.id);
      setSchoolEvents(res.data || []);
    } catch (err) {
      showNotification('Failed to load events for this school', true);
    } finally {
      setLoadingModalData(false);
    }
  };

  // Open Edit School Modal
  const openEditSchool = (school) => {
    setSelectedSchool(school);
    setEditForm({
      name: school.name,
      code: school.code,
      email: school.email || '',
      phone: school.phone || '',
      address: school.address || '',
      max_events: school.max_events ?? '',
      max_users: school.max_users ?? '',
      max_students: school.max_students ?? '',
    });
    setModal('edit');
  };

  // Toggle Suspend / Activate School
  const handleToggleSuspend = async (school) => {
    const nextStatus = school.status === 'active' ? 'suspended' : 'active';
    try {
      await superAdminAPI.updateSchool(school.id, { status: nextStatus });
      showNotification(`${school.name} is now ${nextStatus.toUpperCase()}.`);
      loadDashboardData();
    } catch (err) {
      showNotification(formatApiError(err.response?.data, 'Failed to update organization status'), true);
    }
  };

  // Create Organization Submit
  const handleCreateSchool = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await superAdminAPI.createSchool(normalizeSchoolPayload(form));
      showNotification(`Organization "${form.name}" was registered successfully.`);
      setForm(emptyForm);
      setModal(null);
      loadDashboardData();
    } catch (err) {
      showNotification(formatApiError(err.response?.data, 'Failed to create organization'), true);
    } finally {
      setSaving(false);
    }
  };

  // Update School Submit
  const handleUpdateSchool = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await superAdminAPI.updateSchool(selectedSchool.id, normalizeSchoolPayload(editForm));
      showNotification(`Updated ${editForm.name} successfully.`);
      setModal(null);
      loadDashboardData();
    } catch (err) {
      showNotification(formatApiError(err.response?.data, 'Failed to update organization'), true);
    } finally {
      setSaving(false);
    }
  };

  // Create Admin Inside School
  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!adminForm.name || !adminForm.email || !adminForm.password) {
      showNotification('Please fill in name, email and password', true);
      return;
    }
    setSaving(true);
    try {
      await superAdminAPI.createAdmin(selectedSchool.id, adminForm);
      showNotification(`Administrator added to ${selectedSchool.name}.`);
      setAdminForm({ name: '', email: '', password: '' });
      const res = await superAdminAPI.admins(selectedSchool.id);
      setSchoolAdminsList(res.data || []);
      loadDashboardData();
    } catch (err) {
      showNotification(formatApiError(err.response?.data, 'Failed to add administrator'), true);
    } finally {
      setSaving(false);
    }
  };

  // Reset Admin Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!resetPwdForm.password) {
      showNotification('Please provide a new password', true);
      return;
    }
    setSaving(true);
    try {
      await superAdminAPI.resetAdminPassword(selectedSchool.id, {
        admin_id: resetPwdForm.adminId,
        password: resetPwdForm.password,
      });
      showNotification(`Password reset for ${resetPwdForm.adminName}.`);
      setResetPwdForm({ adminId: null, adminName: '', password: '' });
    } catch (err) {
      showNotification(formatApiError(err.response?.data, 'Failed to reset password'), true);
    } finally {
      setSaving(false);
    }
  };

  // Delete School
  const handleDeleteSchool = async (e) => {
    e.preventDefault();
    if (deleteConfirmation !== selectedSchool?.name) {
      showNotification('Please type the exact organization name to confirm deletion', true);
      return;
    }
    setSaving(true);
    try {
      await superAdminAPI.deleteSchool(selectedSchool.id, deleteConfirmation);
      showNotification(`${selectedSchool.name} and all associated data have been permanently deleted.`);
      setModal(null);
      setSelectedSchool(null);
      setDeleteConfirmation('');
      loadDashboardData();
    } catch (err) {
      showNotification(formatApiError(err.response?.data, 'Failed to delete organization'), true);
    } finally {
      setSaving(false);
    }
  };

  // Filtered Schools
  const filteredSchools = schools.filter(s => {
    if (schoolStatusFilter === 'active') return s.status === 'active';
    if (schoolStatusFilter === 'suspended') return s.status === 'suspended';
    return true;
  });

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 font-sans antialiased overflow-hidden">
      
      {/* ============================================================== */}
      {/* SIDEBAR NAVIGATION (EVENT MANAGER PORTAL AESTHETIC)             */}
      {/* ============================================================== */}
      <aside className="hidden lg:flex w-72 flex-col bg-slate-900 border-r border-slate-800 select-none">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3 px-6 h-20 border-b border-slate-800/80 bg-slate-950/40">
          <EventlooLogo variant="full" size="md" />
        </div>

        {/* Super Admin Badge Banner */}
        <div className="px-5 py-3.5 mx-4 mt-4 rounded-xl bg-gradient-to-r from-indigo-950/70 to-slate-800/60 border border-indigo-500/20 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-indigo-400 shrink-0">
            <ShieldCheck className="h-4 w-4" />
          </div>
          <div className="overflow-hidden">
            <div className="text-xs font-bold text-white tracking-wide truncate">Control Plane</div>
            <div className="text-[10px] text-indigo-300/80 font-medium truncate">Root Infrastructure</div>
          </div>
        </div>

        {/* Nav Links */}
        <nav className="flex-1 px-4 py-5 space-y-1.5 overflow-y-auto">
          <div className="px-3 mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Platform Management
          </div>

          {[
            { id: 'overview', label: 'Overview & Monitor', icon: Activity, count: null },
            { id: 'schools', label: 'Organizations & Schools', icon: Building2, count: stats.schools },
            { id: 'admins', label: 'School Administrators', icon: Users, count: stats.school_admins },
            { id: 'events', label: 'Global Events Monitor', icon: Calendar, count: stats.events },
            { id: 'security', label: 'Security & Health', icon: Shield, count: null },
          ].map(item => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 ${
                  active
                    ? 'bg-indigo-600 text-white font-semibold shadow-lg shadow-indigo-600/20'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${active ? 'text-white' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.count !== null && item.count !== undefined && (
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    active ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Footer Admin Profile & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between p-2 rounded-xl bg-slate-800/50 border border-slate-700/50">
            <div className="flex items-center gap-2.5 overflow-hidden">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white font-bold text-xs shrink-0 shadow-sm">
                SA
              </div>
              <div className="truncate">
                <div className="text-xs font-semibold text-white truncate">Super Admin</div>
                <div className="text-[10px] text-slate-400 truncate">superadmin@eventloo.in</div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleLogout}
              className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ============================================================== */}
      {/* MAIN VIEW AREA                                                 */}
      {/* ============================================================== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Top Navbar */}
        <header className="h-16 px-6 bg-white border-b border-slate-200/80 flex items-center justify-between shrink-0 shadow-2xs">
          <div className="flex items-center gap-4">
            <div className="lg:hidden">
              <EventlooLogo variant="icon" size="sm" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 capitalize flex items-center gap-2">
                {activeTab === 'overview' && 'Platform Overview & Live Telemetry'}
                {activeTab === 'schools' && 'Tenant Organizations & Schools'}
                {activeTab === 'admins' && 'Platform Administrators Directory'}
                {activeTab === 'events' && 'Global Multi-Tenant Events Monitor'}
                {activeTab === 'security' && 'Security Audits & Infrastructure Health'}
              </h1>
              <p className="text-[11px] text-slate-500 hidden sm:block">
                Master control suite for multi-tenant organizations, school admins & global competitions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Live Operational Status Badge */}
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/80 text-[11px] font-semibold text-emerald-700">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
              </span>
              <span>Live • AWS ap-south-1</span>
            </div>

            {/* Refresh Button */}
            <button
              type="button"
              onClick={loadDashboardData}
              disabled={refreshing}
              className="p-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-colors"
              title="Refresh Telemetry"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {/* Register School Button */}
            <button
              type="button"
              onClick={() => { setForm(emptyForm); setModal('create'); }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20 active:scale-95"
            >
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">New Organization</span>
            </button>
          </div>
        </header>

        {/* Global Feedback Banner */}
        {error && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-2.5 flex items-center justify-between text-xs text-rose-800 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{error}</span>
            </div>
            <button type="button" onClick={() => setError('')}><X className="h-4 w-4 text-rose-500" /></button>
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-2.5 flex items-center justify-between text-xs text-emerald-800 animate-in fade-in duration-150">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{success}</span>
            </div>
            <button type="button" onClick={() => setSuccess('')}><X className="h-4 w-4 text-emerald-500" /></button>
          </div>
        )}

        {/* Scrollable Main Content */}
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* ============================================================== */}
          {/* TAB 1: OVERVIEW & TELEMETRY                                    */}
          {/* ============================================================== */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* 4 Hero KPI Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                
                {/* Total Organizations */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Organizations</span>
                    <div className="h-9 w-9 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                      <Building2 className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3 text-3xl font-extrabold text-slate-900">{stats.schools ?? 0}</div>
                  <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                    <span className="text-emerald-600 font-bold">{stats.active_schools ?? 0} Active</span>
                    <span>•</span>
                    <span className="text-amber-600 font-bold">{stats.suspended_schools ?? 0} Suspended</span>
                  </div>
                </div>

                {/* Total School Admins */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">School Admins</span>
                    <div className="h-9 w-9 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center font-bold">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3 text-3xl font-extrabold text-slate-900">{stats.school_admins ?? 0}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <ShieldCheck className="h-3.5 w-3.5 text-indigo-600" />
                    <span>Isolated tenant credentials</span>
                  </div>
                </div>

                {/* Total Global Events */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Global Events</span>
                    <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Calendar className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3 text-3xl font-extrabold text-slate-900">{stats.events ?? 0}</div>
                  <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-emerald-600 font-bold">{stats.active_events ?? 0} Ongoing / Published</span>
                  </div>
                </div>

                {/* Total Students Enrolled */}
                <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs hover:border-indigo-300 transition-all">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Student Roster</span>
                    <div className="h-9 w-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
                      <Layers className="h-5 w-5" />
                    </div>
                  </div>
                  <div className="mt-3 text-3xl font-extrabold text-slate-900">{stats.students ?? 0}</div>
                  <div className="mt-2 text-xs text-slate-500">Across all registered schools</div>
                </div>
              </div>

              {/* Server & Infrastructure Health Card */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-xl border border-slate-700/60 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-[11px] font-semibold text-indigo-300">
                    <Server className="h-3.5 w-3.5" />
                    <span>Single-Container Architecture Active</span>
                  </div>
                  <h3 className="text-xl font-bold tracking-tight">Lightsail Ubuntu 22.04 LTS Telemetry</h3>
                  <p className="text-xs text-slate-300 max-w-xl">
                    React 18 + Gunicorn + Nginx managed by Supervisor. Persistent data saved under <code className="text-indigo-300 font-mono">/app/data/db.sqlite3</code>.
                  </p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 shrink-0">
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Database</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1">SQLite 3 (Mounted)</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">SSL Certificate</div>
                    <div className="text-xs font-bold text-emerald-400 mt-1">Let's Encrypt TLS</div>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-center col-span-2 sm:col-span-1">
                    <div className="text-[10px] text-slate-400 uppercase font-bold">Domain</div>
                    <div className="text-xs font-bold text-indigo-300 mt-1">app.eventloo.in</div>
                  </div>
                </div>
              </div>

              {/* 2-Column Split: Recent Organizations & Recent Events */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                
                {/* Recent Organizations */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Tenant Organizations</h4>
                      <p className="text-xs text-slate-500">Recently registered schools and institutions</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('schools')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      View All <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {stats.recent_schools?.length ? (
                      stats.recent_schools.map(s => (
                        <div key={s.id} className="py-3 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-xl transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                              {s.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{s.name}</div>
                              <div className="text-[11px] text-slate-400 font-mono">{s.code}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              s.status === 'active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                            }`}>
                              {s.status.toUpperCase()}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {s.event_count || 0} events
                            </span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-400">No organizations registered yet.</div>
                    )}
                  </div>
                </div>

                {/* Recent Events Across Platform */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Recent Global Events</h4>
                      <p className="text-xs text-slate-500">Events scheduled or ongoing across organizations</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('events')}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                    >
                      View All <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100">
                    {stats.recent_events?.length ? (
                      stats.recent_events.map(e => (
                        <div key={e.id} className="py-3 flex items-center justify-between hover:bg-slate-50/60 px-2 rounded-xl transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs">
                              <Calendar className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">{e.name}</div>
                              <div className="text-[11px] text-indigo-600 font-medium">{e.school_name}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              e.status === 'published' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                              e.status === 'ongoing' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {e.status}
                            </span>
                            <span className="text-[11px] text-slate-500">{e.teams_count || 0} teams</span>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-400">No events created yet.</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: ORGANIZATIONS & SCHOOLS                                 */}
          {/* ============================================================== */}
          {activeTab === 'schools' && (
            <div className="space-y-6">
              
              {/* Controls Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-white border border-slate-200/80 shadow-xs">
                
                {/* Search Bar */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search schools by name, code, email..."
                    className="w-full h-10 pl-10 pr-4 text-xs rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none transition-all"
                  />
                  {query && (
                    <button type="button" onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-2">
                  {[
                    { id: 'all', label: 'All Organizations' },
                    { id: 'active', label: 'Active' },
                    { id: 'suspended', label: 'Suspended' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSchoolStatusFilter(tab.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        schoolStatusFilter === tab.id
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Schools Table */}
              <div className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3.5 px-4">Organization</th>
                        <th className="py-3.5 px-4">Status</th>
                        <th className="py-3.5 px-4">Quota & Usage</th>
                        <th className="py-3.5 px-4">Contact</th>
                        <th className="py-3.5 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {filteredSchools.length ? (
                        filteredSchools.map((school) => (
                          <tr key={school.id} className="hover:bg-slate-50/80 transition-colors">
                            
                            {/* Organization Name & Code */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-700 font-extrabold text-sm shrink-0">
                                  {school.name.charAt(0)}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 text-sm">{school.name}</div>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">code: {school.code}</div>
                                </div>
                              </div>
                            </td>

                            {/* Status */}
                            <td className="py-4 px-4">
                              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                school.status === 'active'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-amber-50 text-amber-700 border border-amber-200'
                              }`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${school.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                {school.status.toUpperCase()}
                              </span>
                            </td>

                            {/* Quota & Usage */}
                            <td className="py-4 px-4">
                              <div className="space-y-1 text-[11px]">
                                <div className="flex items-center gap-2">
                                  <Calendar className="h-3 w-3 text-slate-400" />
                                  <span>Events: {usageLabel(school.event_count || 0, school.max_events)}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <Users className="h-3 w-3 text-slate-400" />
                                  <span>Admins: {usageLabel(school.admin_count || 0, school.max_users)}</span>
                                </div>
                              </div>
                            </td>

                            {/* Contact Info */}
                            <td className="py-4 px-4">
                              <div className="space-y-0.5 text-[11px] text-slate-500">
                                {school.email && (
                                  <div className="flex items-center gap-1.5">
                                    <Mail className="h-3 w-3 text-slate-400" />
                                    <span>{school.email}</span>
                                  </div>
                                )}
                                {school.phone && (
                                  <div className="flex items-center gap-1.5">
                                    <Phone className="h-3 w-3 text-slate-400" />
                                    <span>{school.phone}</span>
                                  </div>
                                )}
                                {!school.email && !school.phone && <span className="text-slate-400">Not provided</span>}
                              </div>
                            </td>

                            {/* Action Buttons */}
                            <td className="py-4 px-4 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                
                                {/* Suspend / Activate Toggle */}
                                <button
                                  type="button"
                                  onClick={() => handleToggleSuspend(school)}
                                  className={`p-2 rounded-xl border text-xs font-semibold transition-colors ${
                                    school.status === 'active'
                                      ? 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                                      : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                  }`}
                                  title={school.status === 'active' ? 'Suspend Organization' : 'Activate Organization'}
                                >
                                  {school.status === 'active' ? <PauseCircle className="h-4 w-4" /> : <PlayCircle className="h-4 w-4" />}
                                </button>

                                {/* School Admins Button */}
                                <button
                                  type="button"
                                  onClick={() => openSchoolAdmins(school)}
                                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-colors"
                                  title="Manage Administrators"
                                >
                                  <Users className="h-4 w-4" />
                                </button>

                                {/* School Events Button */}
                                <button
                                  type="button"
                                  onClick={() => openSchoolEvents(school)}
                                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 transition-colors"
                                  title="View School Events"
                                >
                                  <Calendar className="h-4 w-4" />
                                </button>

                                {/* Edit School Button */}
                                <button
                                  type="button"
                                  onClick={() => openEditSchool(school)}
                                  className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-100 transition-colors"
                                  title="Edit Limits & Details"
                                >
                                  <Pencil className="h-4 w-4" />
                                </button>

                                {/* Delete School Button */}
                                <button
                                  type="button"
                                  onClick={() => { setSelectedSchool(school); setModal('delete'); setDeleteConfirmation(''); }}
                                  className="p-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 transition-colors"
                                  title="Delete Organization"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-12 text-center text-slate-400">
                            No organizations found matching your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                    <span className="text-xs text-slate-500">
                      Page {page} of {totalPages} ({schoolCount} organizations total)
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={page <= 1}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={page >= totalPages}
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        className="p-2 rounded-xl border border-slate-200 bg-white text-slate-600 disabled:opacity-40"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: PLATFORM ADMINISTRATORS DIRECTORY                       */}
          {/* ============================================================== */}
          {activeTab === 'admins' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Tenant Administrators Directory</h3>
                    <p className="text-xs text-slate-500">All registered school administrator accounts across organizations.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setForm(emptyForm); setModal('create'); }}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Create Administrator</span>
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">Administrator</th>
                        <th className="py-3 px-4">Organization</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Joined Date</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {allAdmins.length ? (
                        allAdmins.map(admin => (
                          <tr key={admin.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-bold text-slate-900">{admin.name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">{admin.email}</div>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700 font-semibold text-[11px]">
                                <Building2 className="h-3 w-3" />
                                {admin.school_name}
                              </span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                admin.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                              }`}>
                                {admin.is_active ? 'Active' : 'Disabled'}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                              {admin.date_joined ? new Date(admin.date_joined).toLocaleDateString() : 'N/A'}
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedSchool({ id: admin.school_id, name: admin.school_name });
                                  setResetPwdForm({ adminId: admin.id, adminName: admin.name, password: '' });
                                  setModal('admins');
                                }}
                                className="px-2.5 py-1 text-xs font-semibold rounded-lg border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                              >
                                Reset Password
                              </button>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-slate-400">
                            No administrators registered yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: GLOBAL EVENTS MONITOR                                  */}
          {/* ============================================================== */}
          {activeTab === 'events' && (
            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Multi-Tenant Events Monitor</h3>
                  <p className="text-xs text-slate-500">Live competitions, status, and stages across all participating institutions.</p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <th className="py-3 px-4">Event Name</th>
                        <th className="py-3 px-4">Organization</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Dates</th>
                        <th className="py-3 px-4">Teams</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                      {allEvents.length ? (
                        allEvents.map(event => (
                          <tr key={event.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-3.5 px-4 font-bold text-slate-900">
                              {event.name}
                            </td>
                            <td className="py-3.5 px-4">
                              <span className="text-indigo-600 font-semibold">{event.school_name}</span>
                            </td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                event.status === 'published' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                                event.status === 'ongoing' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                'bg-slate-100 text-slate-600'
                              }`}>
                                {event.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                              {event.start_date ? event.start_date : 'Flexible'}
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-slate-900">
                              {event.teams_count || 0} teams
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan="5" className="py-8 text-center text-slate-400">
                            No events currently scheduled.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: SECURITY & INFRASTRUCTURE                               */}
          {/* ============================================================== */}
          {activeTab === 'security' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Security Measures Card */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center font-bold">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Multi-Tenant Isolation Safeguards</h4>
                      <p className="text-xs text-slate-500">Zero-trust cryptographic isolation & quotas</p>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    {[
                      { title: 'Tenant Data Isolation', desc: 'Queries strictly scoped via School foreign keys with IDOR validation' },
                      { title: 'Session Cookie Hardening', desc: 'SameSite=Lax with Secure flags and HttpOnly JWT protection' },
                      { title: 'Reverse Proxy TLS Termination', desc: 'Let\'s Encrypt 2048-bit RSA with automated certbot renewal' },
                      { title: 'Brute-Force Rate Limiting', desc: 'Login endpoints guarded by LoginRateThrottle IP buckets' },
                      { title: 'Persistent Mount Verification', desc: 'Volumes eventloo_data and eventloo_media anchored to host' },
                    ].map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 p-3 rounded-xl bg-slate-50 border border-slate-100">
                        <Check className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <div className="text-xs font-bold text-slate-900">{item.title}</div>
                          <div className="text-[11px] text-slate-500">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Cloud Host Diagnostics Card */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                      <Server className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Host Server Specifications</h4>
                      <p className="text-xs text-slate-500">Amazon Lightsail Instance: eventloo</p>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2 text-xs">
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">Public IP</span>
                      <span className="font-mono font-bold text-slate-900">13.234.1.184</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">Region & Availability Zone</span>
                      <span className="font-semibold text-slate-900">ap-south-1a (Mumbai)</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">Operating System</span>
                      <span className="font-semibold text-slate-900">Ubuntu 22.04 LTS (Jammy)</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">Primary Domain</span>
                      <span className="font-mono font-bold text-indigo-600">app.eventloo.in</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-slate-100">
                      <span className="text-slate-500">DNS Nameservers</span>
                      <span className="font-mono text-slate-700">cosmos.dns-parking.com</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

        </main>
      </div>

      {/* ============================================================== */}
      {/* MODAL: CREATE ORGANIZATION                                     */}
      {/* ============================================================== */}
      {modal === 'create' && (
        <Modal
          title="Register New Organization"
          subtitle="Provision a tenant boundary with quotas and optional initial administrator."
          onClose={() => setModal(null)}
        >
          <form onSubmit={handleCreateSchool} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Name *</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => {
                    const name = e.target.value;
                    const code = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
                    setForm({ ...form, name, code: form.code || code });
                  }}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                  placeholder="Greenwood High School"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">URL Identifier Slug *</label>
                <input
                  type="text"
                  required
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })}
                  className="w-full h-10 px-3 text-xs font-mono rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                  placeholder="greenwood-high"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                  placeholder="admin@greenwood.edu"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Phone</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Campus Address</label>
                <textarea
                  rows="2"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none resize-none"
                  placeholder="123 Academic Way, City, State"
                />
              </div>
            </div>

            {/* Quotas */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-900 mb-2">Usage Quotas (Leave blank for unlimited)</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Max Events</label>
                  <input
                    type="number"
                    min="0"
                    value={form.max_events}
                    onChange={(e) => setForm({ ...form, max_events: e.target.value })}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 outline-none"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Max Users</label>
                  <input
                    type="number"
                    min="1"
                    value={form.max_users}
                    onChange={(e) => setForm({ ...form, max_users: e.target.value })}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 outline-none"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Max Students</label>
                  <input
                    type="number"
                    min="0"
                    value={form.max_students}
                    onChange={(e) => setForm({ ...form, max_students: e.target.value })}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 outline-none"
                    placeholder="Unlimited"
                  />
                </div>
              </div>
            </div>

            {/* Initial Admin */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-900 mb-1">Initial Administrator (Optional)</div>
              <p className="text-[11px] text-slate-500 mb-2">Deploy the first school administrator account immediately.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  value={form.admin_name}
                  onChange={(e) => setForm({ ...form, admin_name: e.target.value })}
                  className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 outline-none"
                  placeholder="Admin Name"
                />
                <input
                  type="email"
                  value={form.admin_email}
                  onChange={(e) => setForm({ ...form, admin_email: e.target.value })}
                  className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 outline-none"
                  placeholder="admin@school.com"
                />
                <input
                  type="password"
                  value={form.admin_password}
                  onChange={(e) => setForm({ ...form, admin_password: e.target.value })}
                  className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 outline-none"
                  placeholder="Initial Password"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
              >
                {saving ? 'Creating...' : 'Register Organization'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* MODAL: EDIT ORGANIZATION                                       */}
      {/* ============================================================== */}
      {modal === 'edit' && selectedSchool && (
        <Modal
          title={`Edit ${selectedSchool.name}`}
          subtitle="Update organization contact details and usage limits."
          onClose={() => setModal(null)}
        >
          <form onSubmit={handleUpdateSchool} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Organization Name</label>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">URL Identifier</label>
                <input
                  type="text"
                  required
                  value={editForm.code}
                  onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                  className="w-full h-10 px-3 text-xs font-mono rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editForm.phone}
                  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                  className="w-full h-10 px-3 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Address</label>
                <textarea
                  rows="2"
                  value={editForm.address}
                  onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                  className="w-full p-3 text-xs rounded-xl border border-slate-300 focus:border-indigo-500 outline-none resize-none"
                />
              </div>
            </div>

            {/* Quotas */}
            <div className="pt-3 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-900 mb-2">Usage Limits</div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Max Events</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.max_events}
                    onChange={(e) => setEditForm({ ...editForm, max_events: e.target.value })}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 outline-none"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Max Users</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.max_users}
                    onChange={(e) => setEditForm({ ...editForm, max_users: e.target.value })}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 outline-none"
                    placeholder="Unlimited"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Max Students</label>
                  <input
                    type="number"
                    min="0"
                    value={editForm.max_students}
                    onChange={(e) => setEditForm({ ...editForm, max_students: e.target.value })}
                    className="w-full h-9 px-2 text-xs rounded-lg border border-slate-200 outline-none"
                    placeholder="Unlimited"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* MODAL: SCHOOL ADMINISTRATORS                                   */}
      {/* ============================================================== */}
      {modal === 'admins' && selectedSchool && (
        <Modal
          title={`Administrators for ${selectedSchool.name}`}
          subtitle="Manage credentials, deploy staff, or reset forgotten passwords."
          onClose={() => setModal(null)}
          maxWidth="max-w-3xl"
        >
          <div className="space-y-6">
            
            {/* Existing Admins List */}
            <div>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">Existing School Admins</h3>
              {loadingModalData ? (
                <div className="py-6 text-center text-xs text-slate-400">Loading administrators...</div>
              ) : schoolAdminsList.length ? (
                <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
                  {schoolAdminsList.map(admin => (
                    <div key={admin.id} className="p-3.5 flex items-center justify-between bg-white hover:bg-slate-50">
                      <div>
                        <div className="text-xs font-bold text-slate-900">{admin.name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">{admin.email}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setResetPwdForm({ adminId: admin.id, adminName: admin.name, password: '' })}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold hover:bg-indigo-50 hover:text-indigo-600"
                      >
                        Reset Password
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 text-center text-xs text-slate-500">
                  No administrators currently assigned to this school.
                </div>
              )}
            </div>

            {/* Reset Password Form (if triggered) */}
            {resetPwdForm.adminId && (
              <form onSubmit={handleResetPassword} className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 space-y-3 animate-in fade-in">
                <div className="text-xs font-bold text-indigo-950 flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-indigo-600" />
                  <span>Reset Password for {resetPwdForm.adminName}</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="password"
                    required
                    value={resetPwdForm.password}
                    onChange={(e) => setResetPwdForm({ ...resetPwdForm, password: e.target.value })}
                    placeholder="Enter new strong password"
                    className="flex-1 h-9 px-3 text-xs bg-white rounded-lg border border-indigo-200 outline-none"
                  />
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-xs font-bold hover:bg-indigo-700"
                  >
                    Save Password
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetPwdForm({ adminId: null, adminName: '', password: '' })}
                    className="px-3 py-2 text-slate-500 text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* Add New Admin Form */}
            <form onSubmit={handleCreateAdmin} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-indigo-600" />
                <span>Add New Administrator to {selectedSchool.name}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={adminForm.name}
                  onChange={(e) => setAdminForm({ ...adminForm, name: e.target.value })}
                  placeholder="Full Name"
                  className="h-9 px-3 text-xs bg-white rounded-lg border border-slate-200 outline-none"
                />
                <input
                  type="email"
                  required
                  value={adminForm.email}
                  onChange={(e) => setAdminForm({ ...adminForm, email: e.target.value })}
                  placeholder="Admin Email"
                  className="h-9 px-3 text-xs bg-white rounded-lg border border-slate-200 outline-none"
                />
                <input
                  type="password"
                  required
                  value={adminForm.password}
                  onChange={(e) => setAdminForm({ ...adminForm, password: e.target.value })}
                  placeholder="Secure Password"
                  className="h-9 px-3 text-xs bg-white rounded-lg border border-slate-200 outline-none"
                />
              </div>
              <div className="flex justify-end pt-1">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700"
                >
                  Deploy Administrator
                </button>
              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* ============================================================== */}
      {/* MODAL: SCHOOL EVENTS INSIDE                                    */}
      {/* ============================================================== */}
      {modal === 'events' && selectedSchool && (
        <Modal
          title={`Events inside ${selectedSchool.name}`}
          subtitle="All festivals, sports meets, and competitions configured by this school."
          onClose={() => setModal(null)}
          maxWidth="max-w-3xl"
        >
          {loadingModalData ? (
            <div className="py-8 text-center text-xs text-slate-400">Loading events...</div>
          ) : schoolEvents.length ? (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
              {schoolEvents.map(ev => (
                <div key={ev.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
                      <Calendar className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">{ev.name}</div>
                      <div className="text-[11px] text-slate-400">
                        {ev.start_date ? `Starts: ${ev.start_date}` : 'Dates not announced'}
                        {ev.venue && ` • Venue: ${ev.venue}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-slate-600">{ev.teams_count || 0} teams</span>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      ev.status === 'published' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                      ev.status === 'ongoing' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {ev.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-xs text-slate-400 bg-slate-50 rounded-xl">
              This school has not created any events yet.
            </div>
          )}
        </Modal>
      )}

      {/* ============================================================== */}
      {/* MODAL: DELETE CONFIRMATION                                     */}
      {/* ============================================================== */}
      {modal === 'delete' && selectedSchool && (
        <Modal
          title={`Delete Organization "${selectedSchool.name}"?`}
          subtitle="This action permanently deletes this school, all its staff, events, teams, and student records."
          onClose={() => setModal(null)}
          danger
        >
          <form onSubmit={handleDeleteSchool} className="space-y-4">
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200/80 text-xs text-rose-800 space-y-2">
              <div className="font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-rose-600" />
                <span>Permanent Irreversible Action</span>
              </div>
              <p>
                To confirm deletion, please type the exact organization name below:
              </p>
              <div className="font-mono font-bold text-slate-900 select-all">{selectedSchool.name}</div>
            </div>

            <input
              type="text"
              required
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="Type exact organization name here"
              className="w-full h-10 px-3 text-xs rounded-xl border border-rose-300 focus:border-rose-500 outline-none"
            />

            <div className="flex justify-end gap-3 pt-3">
              <button
                type="button"
                onClick={() => setModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || deleteConfirmation !== selectedSchool.name}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-40"
              >
                {saving ? 'Deleting...' : 'Permanently Delete'}
              </button>
            </div>
          </form>
        </Modal>
      )}

    </div>
  );
};

export default SuperAdminDashboard;
