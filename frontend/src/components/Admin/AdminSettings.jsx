import React, { useState, useEffect, useRef } from 'react';
import {
  Building2,
  GraduationCap,
  Layers,
  Download,
  Upload,
  Check,
  AlertCircle,
  Lock,
  RefreshCw,
  Sparkles,
  Pencil,
  Trash2,
  Plus,
  X,
  CheckCircle2,
  Trophy,
  ShieldCheck,
  KeyRound,
  Eye,
  EyeOff,
  Mail,
} from 'lucide-react';
import { schoolSettingsAPI, categoriesAPI, classesAPI, authAPI } from '../../services/api';

const AdminSettings = () => {
  // 1st tab is School Settings as requested
  const [tab, setTab] = useState('schoolDetails');
  const [toast, setToast] = useState(null);

  // Security & Password OTP state
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
  const [pwdCurrent, setPwdCurrent] = useState('');
  const [pwdOtp, setPwdOtp] = useState('');
  const [pwdNew, setPwdNew] = useState('');
  const [pwdConfirm, setPwdConfirm] = useState('');
  const [pwdShowCurrent, setPwdShowCurrent] = useState(false);
  const [pwdShowNew, setPwdShowNew] = useState(false);
  const [pwdLoading, setPwdLoading] = useState(false);
  const [pwdOtpSent, setPwdOtpSent] = useState(false);
  const [pwdOtpCountdown, setPwdOtpCountdown] = useState(0);
  const [pwdError, setPwdError] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState('');

  useEffect(() => {
    let timer;
    if (pwdOtpCountdown > 0) {
      timer = setInterval(() => {
        setPwdOtpCountdown((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [pwdOtpCountdown]);

  const handleRequestPasswordOtp = async () => {
    setPwdError('');
    setPwdSuccess('');
    setPwdLoading(true);
    try {
      const res = await authAPI.requestSettingsPasswordOtp();
      setPwdOtpSent(true);
      setPwdOtpCountdown(60);
      setPwdSuccess(res.data?.message || 'Verification code sent to your email.');
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to send verification code. Please try again.';
      setPwdError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setPwdLoading(false);
    }
  };

  const handleChangePasswordWithOtp = async (e) => {
    e.preventDefault();
    setPwdError('');
    setPwdSuccess('');
    if (!pwdCurrent) {
      setPwdError('Please enter your current password.');
      return;
    }
    if (!pwdOtp || pwdOtp.trim().length !== 6) {
      setPwdError('Please enter the 6-digit verification code sent to your email.');
      return;
    }
    if (!pwdNew) {
      setPwdError('Please enter your new password.');
      return;
    }
    if (pwdNew.length < 8) {
      setPwdError('New password must be at least 8 characters long.');
      return;
    }
    if (pwdNew !== pwdConfirm) {
      setPwdError('New password and confirmation do not match.');
      return;
    }
    setPwdLoading(true);
    try {
      const res = await authAPI.changeSettingsPasswordWithOtp({
        current_password: pwdCurrent,
        otp: pwdOtp.trim(),
        new_password: pwdNew,
      });
      setPwdSuccess(res.data?.message || 'Password updated successfully!');
      setPwdCurrent('');
      setPwdOtp('');
      setPwdNew('');
      setPwdConfirm('');
      setPwdOtpSent(false);
    } catch (err) {
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to update password. Please check your verification code and password.';
      setPwdError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setPwdLoading(false);
    }
  };

  // School details state
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileInputRef = useRef();
  const backupFileInputRef = useRef();

  // Classes state
  const [classes, setClasses] = useState([]);
  const [classForm, setClassForm] = useState({ name: '', code: '' });
  const [editingClassId, setEditingClassId] = useState(null);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    code: '',
    is_mixing: false,
    classes: [],
    mixed_categories: [],
  });
  const [editingCategoryId, setEditingCategoryId] = useState(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  useEffect(() => {
    if (tab === 'schoolDetails') {
      fetchSchoolSettings();
    } else if (tab === 'classes') {
      fetchClasses();
    } else if (tab === 'categories') {
      fetchCategories();
      fetchClasses();
    }
  }, [tab]);

  // Hide toast after 4 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchSchoolSettings = async () => {
    setLoading(true);
    try {
      const res = await schoolSettingsAPI.get();
      setSchool(res.data);
      setLogoPreview(res.data.school_logo || null);
      if (res.data?.school_logo) {
        try {
          const stored = JSON.parse(localStorage.getItem('school_data') || '{}');
          stored.school_logo = res.data.school_logo;
          stored.logo = res.data.school_logo;
          stored.name = res.data.school_name || stored.name;
          localStorage.setItem('school_data', JSON.stringify(stored));
          localStorage.setItem('school_logo', res.data.school_logo);
          window.dispatchEvent(new CustomEvent('eventloo_school_updated', { detail: { school_logo: res.data.school_logo } }));
        } catch {
          // ignore
        }
      }
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to load school settings.' });
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    setLoadingConfig(true);
    try {
      const res = await classesAPI.list();
      setClasses(res.data.results || res.data || []);
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to load classes.' });
    } finally {
      setLoadingConfig(false);
    }
  };

  const fetchCategories = async () => {
    setLoadingConfig(true);
    try {
      const res = await categoriesAPI.list();
      setCategories(res.data.results || res.data || []);
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to load categories.' });
    } finally {
      setLoadingConfig(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setSchool((prev) => ({ ...prev, [name]: value }));
  };

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoPreview(URL.createObjectURL(file));
      setSchool((prev) => ({ ...prev, school_logo: file }));
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      let data;
      if (school.school_logo instanceof File) {
        data = new FormData();
        Object.entries(school).forEach(([key, value]) => {
          if (key === 'school_logo' && value instanceof File) {
            data.append(key, value);
          } else if (value !== undefined && value !== null) {
            data.append(key, value);
          }
        });
      } else {
        data = { ...school };
      }
      await schoolSettingsAPI.update(data);
      setToast({ type: 'success', message: 'School details updated successfully.' });
      fetchSchoolSettings();
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to update school details.' });
    } finally {
      setSaving(false);
    }
  };

  // Class CRUD Handlers
  const handleClassSubmit = async (e) => {
    e.preventDefault();
    if (!classForm.name.trim() || !classForm.code.trim()) {
      setToast({ type: 'error', message: 'Please fill out class name and unique code.' });
      return;
    }
    setSaving(true);
    try {
      if (editingClassId) {
        await classesAPI.update(editingClassId, classForm);
        setToast({ type: 'success', message: 'Class updated successfully.' });
      } else {
        await classesAPI.create(classForm);
        setToast({ type: 'success', message: 'Class created successfully.' });
      }
      setClassForm({ name: '', code: '' });
      setEditingClassId(null);
      fetchClasses();
    } catch (err) {
      const msg = err.response?.data?.code?.[0] || 'Failed to save class. Code must be unique.';
      setToast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleEditClass = (cls) => {
    setClassForm({ name: cls.name, code: cls.code });
    setEditingClassId(cls.id);
  };

  const handleDeleteClass = async (id) => {
    if (!window.confirm('Are you sure you want to delete this class? This may affect student records.')) return;
    try {
      await classesAPI.delete(id);
      setToast({ type: 'success', message: 'Class deleted successfully.' });
      fetchClasses();
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to delete class.' });
    }
  };

  // Category CRUD Handlers
  const handleCategorySubmit = async (e) => {
    e.preventDefault();
    if (!categoryForm.name.trim() || !categoryForm.code.trim()) {
      setToast({ type: 'error', message: 'Please fill out category name and unique code.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: categoryForm.name,
        code: categoryForm.code,
        is_mixing: categoryForm.is_mixing,
        classes: categoryForm.classes,
        mixed_categories: categoryForm.is_mixing ? categoryForm.mixed_categories : [],
      };

      if (editingCategoryId) {
        await categoriesAPI.update(editingCategoryId, payload);
        setToast({ type: 'success', message: 'Category updated successfully.' });
      } else {
        await categoriesAPI.create(payload);
        setToast({ type: 'success', message: 'Category created successfully.' });
      }
      setCategoryForm({ name: '', code: '', is_mixing: false, classes: [], mixed_categories: [] });
      setEditingCategoryId(null);
      fetchCategories();
    } catch (err) {
      const msg = err.response?.data?.code?.[0] || 'Failed to save category. Code must be unique.';
      setToast({ type: 'error', message: msg });
    } finally {
      setSaving(false);
    }
  };

  const handleEditCategory = (cat) => {
    setCategoryForm({
      name: cat.name,
      code: cat.code,
      is_mixing: cat.is_mixing || false,
      classes: cat.class_ids || [],
      mixed_categories: cat.mixed_category_ids || [],
    });
    setEditingCategoryId(cat.id);
  };

  const handleMixedCategoryCheck = (catId) => {
    setCategoryForm((prev) => {
      const currentCats = [...(prev.mixed_categories || [])];
      const index = currentCats.indexOf(catId);
      if (index > -1) {
        currentCats.splice(index, 1);
      } else {
        currentCats.push(catId);
      }
      return { ...prev, mixed_categories: currentCats };
    });
  };

  const handleDeleteCategory = async (id) => {
    if (!window.confirm('Are you sure you want to delete this category? This may affect event programs.')) return;
    try {
      await categoriesAPI.delete(id);
      setToast({ type: 'success', message: 'Category deleted successfully.' });
      fetchCategories();
    } catch (err) {
      setToast({ type: 'error', message: 'Failed to delete category.' });
    }
  };

  const handleClassCheck = (classId) => {
    setCategoryForm((prev) => {
      const currentClasses = [...prev.classes];
      const index = currentClasses.indexOf(classId);
      if (index > -1) {
        currentClasses.splice(index, 1);
      } else {
        currentClasses.push(classId);
      }
      return { ...prev, classes: currentClasses };
    });
  };

  // Download & Import Backup Handlers
  const handleDownloadBackup = async () => {
    try {
      setToast({ type: 'info', message: 'Generating school backup...' });
      const res = await schoolSettingsAPI.exportBackup();
      const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      const schoolCode = school?.school_code || 'school';
      link.setAttribute('download', `Eventloo_Backup_${schoolCode}_${new Date().toISOString().slice(0, 10)}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      setToast({ type: 'success', message: 'School backup downloaded successfully.' });
    } catch (err) {
      console.error('Download backup failed:', err);
      setToast({ type: 'error', message: 'Failed to download school backup.' });
    }
  };

  const handleImportBackup = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setSaving(true);
      setToast({ type: 'info', message: 'Importing backup...' });
      const formData = new FormData();
      formData.append('backup_file', file);
      const res = await schoolSettingsAPI.importBackup(formData);
      setToast({ type: 'success', message: res.data.message || 'Backup imported successfully.' });
      fetchSchoolSettings();
      fetchClasses();
      fetchCategories();
    } catch (err) {
      console.error('Import backup failed:', err);
      const errorMsg = err.response?.data?.error || 'Failed to import backup file. Ensure it is a valid Eventloo JSON backup.';
      setToast({ type: 'error', message: errorMsg });
    } finally {
      setSaving(false);
      if (backupFileInputRef.current) backupFileInputRef.current.value = '';
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        
        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
              <Sparkles className="h-3 w-3" />
              Configuration
            </div>
            <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Global Settings</h1>
            <p className="text-xs text-slate-500 mt-0.5 font-normal">
              Manage school identity, classes, categories, and tenant data backups.
            </p>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs sm:p-6">
          
          {/* Tabs Navigation in the requested order:
              1. School Settings
              2. Manage Classes
              3. Manage Categories
              4. Import / Export
          */}
          <div className="mb-8 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
            <button
              type="button"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition-all ${
                tab === 'schoolDetails'
                  ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setTab('schoolDetails')}
            >
              <Building2 className="w-4 h-4" />
              <span>School Settings</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition-all ${
                tab === 'classes'
                  ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setTab('classes')}
            >
              <GraduationCap className="w-4 h-4" />
              <span>Manage Classes</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition-all ${
                tab === 'categories'
                  ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setTab('categories')}
            >
              <Layers className="w-4 h-4" />
              <span>Manage Categories</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition-all ${
                tab === 'importExport'
                  ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setTab('importExport')}
            >
              <Download className="w-4 h-4" />
              <span>Import / Export</span>
            </button>
            <button
              type="button"
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-xs sm:text-sm font-medium transition-all ${
                tab === 'security'
                  ? 'bg-white text-indigo-700 shadow-2xs font-semibold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              onClick={() => setTab('security')}
            >
              <KeyRound className="w-4 h-4" />
              <span>Security & Password</span>
            </button>
          </div>

          {/* ============================================================== */}
          {/* TAB 1: SCHOOL SETTINGS                                         */}
          {/* ============================================================== */}
          {tab === 'schoolDetails' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">School & Organization Settings</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Update your school name, contact information, branding, and view your tenant unique identifier.
                </p>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
                </div>
              ) : (
                <form onSubmit={handleSave} className="space-y-6">
                  
                  {/* Row 1: School Name (Editable) & Unique ID (Non-editable) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    
                    {/* School Name - EDITABLE */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          School / Organization Name <span className="text-rose-500">*</span>
                        </label>
                        <span className="text-[11px] text-emerald-600 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-100">
                          Editable
                        </span>
                      </div>
                      <input
                        type="text"
                        name="school_name"
                        value={school?.school_name || ''}
                        onChange={handleInputChange}
                        required
                        placeholder="e.g. Springfield High School"
                        className="w-full px-3.5 py-2.5 text-sm font-medium text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-2xs"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Display name shown across event portals, leaderboards, and PDF certificates.
                      </p>
                    </div>

                    {/* Organization Unique ID / Code - READ ONLY & DISABLED */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                          Organization Code / Unique Identifier
                        </label>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200/80 px-2.5 py-0.5 rounded-full">
                          <Lock className="w-3 h-3 text-amber-600" />
                          System Managed • Read Only
                        </span>
                      </div>
                      <div className="relative">
                        <input
                          type="text"
                          value={school?.school_code || ''}
                          readOnly
                          disabled
                          aria-readonly="true"
                          className="w-full px-3.5 py-2.5 font-mono text-sm font-bold text-slate-700 bg-slate-100/90 border border-slate-200 rounded-xl cursor-not-allowed select-all"
                          title="This unique identifier was set when the organization was created and cannot be edited."
                        />
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                          <Lock className="w-4 h-4" />
                        </div>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        Assigned unique tenant identifier for this school. Cannot be typed or edited.
                      </p>
                    </div>

                  </div>

                  {/* Row 2: Address */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      School Address
                    </label>
                    <textarea
                      name="school_address"
                      rows={2}
                      value={school?.school_address || ''}
                      onChange={handleInputChange}
                      placeholder="Street address, city, state, postal code"
                      className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-2xs"
                    />
                  </div>

                  {/* Row 3: Phone & Email */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Official Phone
                      </label>
                      <input
                        type="text"
                        name="school_phone"
                        value={school?.school_phone || ''}
                        onChange={handleInputChange}
                        placeholder="+91 98765 43210"
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-2xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                        Official Email
                      </label>
                      <input
                        type="email"
                        name="school_email"
                        value={school?.school_email || ''}
                        onChange={handleInputChange}
                        placeholder="admin@school.edu"
                        className="w-full px-3.5 py-2.5 text-sm text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all shadow-2xs"
                      />
                    </div>
                  </div>

                  {/* Row 4: Branding Colors & Logo */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 rounded-2xl bg-slate-50 border border-slate-200/80">
                    
                    {/* Logo Upload */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        School Emblem / Logo
                      </label>
                      <div className="flex items-center gap-4">
                        {logoPreview ? (
                          <div className="h-16 w-16 rounded-xl border border-slate-200 bg-white p-1 flex items-center justify-center shrink-0 shadow-2xs overflow-hidden">
                            <img
                              src={logoPreview}
                              alt="School Logo Preview"
                              className="max-h-full max-w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="h-16 w-16 rounded-xl border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-400 shrink-0">
                            <Building2 className="w-6 h-6" />
                          </div>
                        )}
                        <div className="flex-1">
                          <input
                            type="file"
                            accept="image/*"
                            ref={fileInputRef}
                            onChange={handleLogoChange}
                            className="block w-full text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
                          />
                          <p className="mt-1 text-[11px] text-slate-400">PNG or JPG. Recommended transparent background.</p>
                        </div>
                      </div>
                    </div>

                    {/* Primary Color */}
                    <div>
                      <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                        Primary Theme Color
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          type="color"
                          name="primary_color"
                          value={school?.primary_color || '#4f46e5'}
                          onChange={handleInputChange}
                          className="h-10 w-12 rounded-lg border border-slate-300 p-0.5 cursor-pointer bg-white"
                        />
                        <input
                          type="text"
                          name="primary_color"
                          value={school?.primary_color || '#4f46e5'}
                          onChange={handleInputChange}
                          className="w-32 px-3 py-2 font-mono text-xs font-bold text-slate-800 bg-white border border-slate-300 rounded-lg uppercase"
                        />
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">Used for navigation accents and certificates.</p>
                    </div>

                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm hover:shadow-md transition-all disabled:opacity-50"
                    >
                      {saving ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Saving Changes...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          <span>Save School Settings</span>
                        </>
                      )}
                    </button>
                  </div>

                </form>
              )}
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: MANAGE CLASSES                                          */}
          {/* ============================================================== */}
          {tab === 'classes' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Manage Student Classes</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Define student grades, batches, and academic divisions (e.g. Grade 1, Grade 2, Class 10A).
                  </p>
                </div>
              </div>

              {/* Form Card */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  {editingClassId ? <Pencil className="w-3.5 h-3.5 text-indigo-600" /> : <Plus className="w-3.5 h-3.5 text-indigo-600" />}
                  <span>{editingClassId ? 'Edit Class Details' : 'Add New Class'}</span>
                </h4>
                <form onSubmit={handleClassSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Class / Grade Name *</label>
                      <input
                        type="text"
                        value={classForm.name}
                        onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                        required
                        placeholder="e.g. Grade 10"
                        className="w-full px-3.5 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Unique Class Code *</label>
                      <input
                        type="text"
                        value={classForm.code}
                        onChange={(e) => setClassForm({ ...classForm, code: e.target.value })}
                        required
                        placeholder="e.g. G10"
                        className="w-full px-3.5 py-2 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all uppercase"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : (editingClassId ? 'Update Class' : 'Add Class')}
                    </button>
                    {editingClassId && (
                      <button
                        type="button"
                        onClick={() => {
                          setClassForm({ name: '', code: '' });
                          setEditingClassId(null);
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Classes Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">All Registered Classes</h4>
                {loadingConfig ? (
                  <div className="text-slate-500 text-xs py-4">Loading classes...</div>
                ) : classes.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                    No classes configured yet. Add your school grades or divisions above.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Class Name</th>
                          <th className="px-4 py-3 text-left">Unique Code</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-xs">
                        {classes.map((cls) => (
                          <tr key={cls.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="px-4 py-3 font-semibold text-slate-800">{cls.name}</td>
                            <td className="px-4 py-3 font-mono text-slate-600">{cls.code}</td>
                            <td className="px-4 py-3 text-right space-x-2">
                              <button
                                type="button"
                                onClick={() => handleEditClass(cls)}
                                className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold p-1 hover:bg-indigo-50 rounded-lg transition-colors"
                                title="Edit Class"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                                <span>Edit</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteClass(cls.id)}
                                className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold p-1 hover:bg-rose-50 rounded-lg transition-colors"
                                title="Delete Class"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Delete</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: MANAGE CATEGORIES                                       */}
          {/* ============================================================== */}
          {tab === 'categories' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Manage Competition Categories</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure categories (e.g. Sub Junior, Junior, Senior) and link student classes or general mixing rules.
                </p>
              </div>

              {/* Form Card */}
              <div className="bg-slate-50/80 p-5 rounded-2xl border border-slate-200/80">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 mb-3 flex items-center gap-1.5">
                  {editingCategoryId ? <Pencil className="w-3.5 h-3.5 text-indigo-600" /> : <Plus className="w-3.5 h-3.5 text-indigo-600" />}
                  <span>{editingCategoryId ? 'Edit Category Details' : 'Add New Category'}</span>
                </h4>
                <form onSubmit={handleCategorySubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Category Name *</label>
                      <input
                        type="text"
                        value={categoryForm.name}
                        onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                        required
                        placeholder="e.g. Junior"
                        className="w-full px-3.5 py-2 text-xs text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Unique Category Code *</label>
                      <input
                        type="text"
                        value={categoryForm.code}
                        onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                        required
                        placeholder="e.g. JR"
                        className="w-full px-3.5 py-2 text-xs font-mono text-slate-900 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 transition-all uppercase"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-white border border-slate-200">
                    <input
                      type="checkbox"
                      id="is_mixing"
                      checked={categoryForm.is_mixing}
                      onChange={(e) => setCategoryForm({ ...categoryForm, is_mixing: e.target.checked })}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-100 h-4 w-4"
                    />
                    <label htmlFor="is_mixing" className="text-xs font-medium text-slate-700 select-none cursor-pointer">
                      Is mixing / general category (open to multiple student categories or teams)
                    </label>
                  </div>

                  {categoryForm.is_mixing && (
                    <div className="space-y-2">
                      <label className="block text-xs font-semibold text-slate-700">
                        Select Categories to Mix (Leave unchecked to mix all)
                      </label>
                      {categories.length === 0 ? (
                        <div className="text-slate-500 text-xs italic">No other categories available.</div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-white rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                          {categories
                            .filter((c) => !c.is_mixing && c.id !== editingCategoryId)
                            .map((cat) => (
                              <div key={cat.id} className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  id={`mix-cat-${cat.id}`}
                                  checked={categoryForm.mixed_categories?.includes(cat.id)}
                                  onChange={() => handleMixedCategoryCheck(cat.id)}
                                  className="rounded border-slate-300 text-indigo-600 h-4 w-4"
                                />
                                <label htmlFor={`mix-cat-${cat.id}`} className="text-xs text-slate-700 truncate cursor-pointer select-none">
                                  {cat.name}
                                </label>
                              </div>
                            ))}
                        </div>
                      )}
                    </div>
                  )}

                  {!categoryForm.is_mixing && (
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                        Assign Classes to this Category
                      </label>
                      {classes.length === 0 ? (
                        <div className="text-slate-500 text-xs italic p-3 bg-white rounded-xl border border-slate-200">
                          Please add classes in the "Manage Classes" tab first.
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-white rounded-xl border border-slate-200 max-h-40 overflow-y-auto">
                          {classes.map((cls) => (
                            <div key={cls.id} className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                id={`cls-${cls.id}`}
                                checked={categoryForm.classes.includes(cls.id)}
                                onChange={() => handleClassCheck(cls.id)}
                                className="rounded border-slate-300 text-indigo-600 h-4 w-4"
                              />
                              <label htmlFor={`cls-${cls.id}`} className="text-xs text-slate-700 truncate cursor-pointer select-none">
                                {cls.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-xs transition-colors disabled:opacity-50"
                    >
                      {saving ? 'Saving...' : (editingCategoryId ? 'Update Category' : 'Add Category')}
                    </button>
                    {editingCategoryId && (
                      <button
                        type="button"
                        onClick={() => {
                          setCategoryForm({ name: '', code: '', is_mixing: false, classes: [], mixed_categories: [] });
                          setEditingCategoryId(null);
                        }}
                        className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-xl text-xs font-semibold transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>
              </div>

              {/* Categories Table */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">All Configured Categories</h4>
                {loadingConfig ? (
                  <div className="text-slate-500 text-xs py-4">Loading categories...</div>
                ) : categories.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-400">
                    No categories configured yet. Create competition categories above.
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200/80 shadow-2xs">
                    <table className="min-w-full divide-y divide-slate-200">
                      <thead className="bg-slate-50/70 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                        <tr>
                          <th className="px-4 py-3 text-left">Category Name</th>
                          <th className="px-4 py-3 text-left">Unique Code</th>
                          <th className="px-4 py-3 text-left">Type</th>
                          <th className="px-4 py-3 text-left">Assigned Classes</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white text-xs">
                        {categories.map((cat) => {
                          const catClasses = classes.filter((cls) => cat.class_ids?.includes(cls.id)).map((c) => c.name);
                          return (
                            <tr key={cat.id} className="hover:bg-slate-50/80 transition-colors">
                              <td className="px-4 py-3 font-semibold text-slate-800">{cat.name}</td>
                              <td className="px-4 py-3 font-mono text-slate-600">{cat.code}</td>
                              <td className="px-4 py-3">
                                {cat.is_mixing ? (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-violet-50 text-violet-700 font-semibold border border-violet-200">
                                    Mixing / General
                                  </span>
                                ) : (
                                  <span className="px-2.5 py-0.5 rounded-full text-[11px] bg-indigo-50 text-indigo-700 font-semibold border border-indigo-200">
                                    Standard
                                  </span>
                                )}
                              </td>
                              <td className="px-4 py-3 text-slate-600 max-w-xs truncate">
                                {cat.is_mixing ? (
                                  cat.mixed_category_ids && cat.mixed_category_ids.length > 0 ? (
                                    `Mixed: ${categories.filter((c) => cat.mixed_category_ids.includes(c.id)).map((c) => c.name).join(', ')}`
                                  ) : (
                                    'All Categories (Mixed)'
                                  )
                                ) : (
                                  catClasses.join(', ') || 'No classes assigned'
                                )}
                              </td>
                              <td className="px-4 py-3 text-right space-x-2">
                                <button
                                  type="button"
                                  onClick={() => handleEditCategory(cat)}
                                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold p-1 hover:bg-indigo-50 rounded-lg transition-colors"
                                  title="Edit Category"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                  <span>Edit</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-semibold p-1 hover:bg-rose-50 rounded-lg transition-colors"
                                  title="Delete Category"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>Delete</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: IMPORT / EXPORT                                         */}
          {/* ============================================================== */}
          {tab === 'importExport' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Tenant Data Backup & Restore</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Export school configuration, classes, and categories as a secure JSON backup, or restore from an existing backup.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Export Card */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-5 hover:border-indigo-300 transition-colors">
                  <div className="space-y-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center font-bold">
                      <Download className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Export School Backup</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Download a complete JSON snapshot containing your school settings, classes, categories, and structure.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-600 space-y-1.5 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>School details, branding colors & logo path</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Student classes & unique codes</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Competition categories & class assignments</span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleDownloadBackup}
                    disabled={saving}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs shadow-sm hover:shadow transition-all disabled:opacity-50"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Backup (JSON)</span>
                  </button>
                </div>

                {/* Import Card */}
                <div className="p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between space-y-5 hover:border-violet-300 transition-colors">
                  <div className="space-y-3">
                    <div className="h-10 w-10 rounded-xl bg-violet-50 border border-violet-100 text-violet-600 flex items-center justify-center font-bold">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900">Restore / Import Backup</h4>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        Restore school settings, classes, and categories from a previously saved Eventloo JSON backup file.
                      </p>
                    </div>
                    <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200/70 text-[11px] text-amber-800 space-y-1.5">
                      <div className="font-semibold flex items-center gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Safe Restore Safeguards:</span>
                      </div>
                      <div>• Existing events, points, and results are preserved.</div>
                      <div>• Missing classes and categories will be created automatically.</div>
                    </div>
                  </div>

                  <div>
                    <input
                      type="file"
                      ref={backupFileInputRef}
                      onChange={handleImportBackup}
                      accept=".json,application/json"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => backupFileInputRef.current?.click()}
                      disabled={saving}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-xs shadow-sm hover:shadow transition-all disabled:opacity-50"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{saving ? 'Importing File...' : 'Select & Import Backup File'}</span>
                    </button>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: SECURITY & PASSWORD (OTP VERIFIED)                     */}
          {/* ============================================================== */}
          {tab === 'security' && (
            <div className="space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-base font-bold text-slate-900">Account Security & Password Settings</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Change your administrator password securely using two-step email OTP verification.
                </p>
              </div>

              {/* Delivery Notice Card */}
              <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50/80 to-blue-50/60 p-4 sm:p-5 flex items-start gap-3.5">
                <div className="p-2 rounded-xl bg-indigo-600 text-white shrink-0 mt-0.5 shadow-sm">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="text-xs sm:text-sm font-bold text-slate-900">
                    Two-Step OTP Security Active
                  </h4>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                    To safeguard administrative access, password updates require an authorization code sent directly to your registered email address:{' '}
                    <strong className="text-indigo-950 font-semibold">{currentUser.email || 'your registered email'}</strong>.
                  </p>
                  <div className="mt-2.5 flex items-center gap-2 text-[11px] text-indigo-700 font-medium">
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Sender: <strong>Eventloo Security (noreply@eventloo.in)</strong></span>
                  </div>
                </div>
              </div>

              {/* Error & Success Banners */}
              {pwdError && (
                <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-3.5 text-xs text-rose-800 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{pwdError}</div>
                </div>
              )}

              {pwdSuccess && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50/90 p-3.5 text-xs text-emerald-800 flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="leading-relaxed font-medium">{pwdSuccess}</div>
                </div>
              )}

              {/* Password Change Form Card */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-7 shadow-2xs">
                <form onSubmit={handleChangePasswordWithOtp} className="space-y-5 max-w-xl">
                  
                  {/* Current Password Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Current Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={pwdShowCurrent ? 'text' : 'password'}
                        value={pwdCurrent}
                        onChange={(e) => setPwdCurrent(e.target.value)}
                        placeholder="Enter your current password"
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setPwdShowCurrent(!pwdShowCurrent)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {pwdShowCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* OTP Verification Field & Request Button */}
                  <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-800">
                          6-Digit Email Verification Code (OTP)
                        </label>
                        <p className="text-[11px] text-slate-500">
                          {pwdOtpSent ? 'Code sent to your email. Valid for 5 minutes.' : 'Click request to receive your 6-digit code.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleRequestPasswordOtp}
                        disabled={pwdLoading || pwdOtpCountdown > 0}
                        className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-bold shadow-2xs transition-all disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      >
                        {pwdLoading && !pwdOtpSent ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Sending...</span>
                          </>
                        ) : pwdOtpCountdown > 0 ? (
                          <span>Resend in {pwdOtpCountdown}s</span>
                        ) : (
                          <>
                            <Mail className="w-3.5 h-3.5" />
                            <span>{pwdOtpSent ? 'Resend OTP' : 'Request OTP Code'}</span>
                          </>
                        )}
                      </button>
                    </div>

                    <input
                      type="text"
                      value={pwdOtp}
                      onChange={(e) => setPwdOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
                      placeholder="0 0 0 0 0 0"
                      maxLength={6}
                      className="h-11 w-full rounded-xl border border-slate-200 bg-white text-center font-mono text-base tracking-[8px] font-bold text-indigo-700 placeholder:text-slate-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all shadow-2xs"
                      required
                    />
                  </div>

                  {/* New Password Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={pwdShowNew ? 'text' : 'password'}
                        value={pwdNew}
                        onChange={(e) => setPwdNew(e.target.value)}
                        placeholder="At least 8 characters"
                        minLength={8}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setPwdShowNew(!pwdShowNew)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                      >
                        {pwdShowNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  {/* Confirm New Password Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Confirm New Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                      <input
                        type={pwdShowNew ? 'text' : 'password'}
                        value={pwdConfirm}
                        onChange={(e) => setPwdConfirm(e.target.value)}
                        placeholder="Re-enter new password"
                        minLength={8}
                        className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-50/70 outline-none transition-all"
                        required
                      />
                    </div>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={pwdLoading}
                      className="h-11 w-full sm:w-auto px-8 rounded-xl bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold text-xs tracking-wide shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {pwdLoading ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          <span>Updating Password...</span>
                        </>
                      ) : (
                        <>
                          <KeyRound className="w-4 h-4" />
                          <span>Verify OTP & Update Password</span>
                        </>
                      )}
                    </button>
                  </div>

                </form>
              </div>

            </div>
          )}

          {/* Toast Notification */}
          {toast && (
            <div
              className={`mt-6 p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between animate-in fade-in duration-150 ${
                toast.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : toast.type === 'info'
                  ? 'bg-indigo-50 text-indigo-800 border border-indigo-200'
                  : 'bg-rose-50 text-rose-800 border border-rose-200'
              }`}
            >
              <div className="flex items-center gap-2">
                {toast.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{toast.message}</span>
              </div>
              <button
                type="button"
                onClick={() => setToast(null)}
                className="text-slate-400 hover:text-slate-600 p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

        </section>
      </div>
    </main>
  );
};

export default AdminSettings;
