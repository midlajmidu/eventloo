import React, { useState, useEffect, useRef } from 'react';
import { schoolSettingsAPI, categoriesAPI, classesAPI } from '../../services/api';

const AdminSettings = () => {
  const [tab, setTab] = useState('importExport');
  const [toast, setToast] = useState(null);

  // School details state
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileInputRef = useRef();

  // Classes state
  const [classes, setClasses] = useState([]);
  const [classForm, setClassForm] = useState({ name: '', code: '' });
  const [editingClassId, setEditingClassId] = useState(null);

  // Categories state
  const [categories, setCategories] = useState([]);
  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', is_mixing: false, classes: [], mixed_categories: [] });
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

  // Hide toast after 3 seconds
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const fetchSchoolSettings = async () => {
    setLoading(true);
    try {
      const res = await schoolSettingsAPI.get();
      setSchool(res.data);
      setLogoPreview(res.data.school_logo || null);
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
      setClasses(res.data.results || res.data);
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
      setCategories(res.data.results || res.data);
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
    const file = e.target.files[0];
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
      setToast({ type: 'error', message: 'Please fill out all class fields.' });
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
    if (!window.confirm('Are you sure you want to delete this class? This may affect student registration.')) return;
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
      setToast({ type: 'error', message: 'Please fill out all category fields.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: categoryForm.name,
        code: categoryForm.code,
        is_mixing: categoryForm.is_mixing,
        classes: categoryForm.classes,
        mixed_categories: categoryForm.is_mixing ? categoryForm.mixed_categories : []
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
      mixed_categories: cat.mixed_category_ids || []
    });
    setEditingCategoryId(cat.id);
  };

  const handleMixedCategoryCheck = (catId) => {
    setCategoryForm(prev => {
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
    setCategoryForm(prev => {
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

  const handleDownloadBackup = async () => {
    if (window.electronAPI && window.electronAPI.exportBackup) {
      const result = await window.electronAPI.exportBackup();
      setToast({ type: result.success ? 'success' : 'error', message: result.message });
    }
  };

  const handleImportBackup = async () => {
    if (window.electronAPI && window.electronAPI.importBackup) {
      const result = await window.electronAPI.importBackup();
      setToast({ type: result.success ? 'success' : 'error', message: result.message });
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
    <div className="mx-auto max-w-6xl">
      <div className="mb-6"><p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Configuration</p><h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Global Settings</h1><p className="mt-1 text-sm text-slate-500">Manage school identity, data, classes and categories.</p></div>
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm sm:p-6">
      
      {/* Tabs */}
      <div className="mb-8 flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1">
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'importExport' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          onClick={() => setTab('importExport')}
        >
          Import/Export
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'schoolDetails' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          onClick={() => setTab('schoolDetails')}
        >
          School Details
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'classes' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          onClick={() => setTab('classes')}
        >
          Manage Classes
        </button>
        <button
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'categories' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
          onClick={() => setTab('categories')}
        >
          Manage Categories
        </button>
      </div>

      {/* Import/Export Tab */}
      {tab === 'importExport' && (
        <div className="flex flex-col gap-4 max-w-md">
          <button
            className="bg-indigo-600 text-white px-4 py-2.5 rounded hover:bg-indigo-700 transition-colors font-medium"
            onClick={handleDownloadBackup}
          >
            Download Backup
          </button>
          <button
            className="bg-indigo-600 text-white px-4 py-2.5 rounded hover:bg-indigo-700 transition-colors font-medium"
            onClick={handleImportBackup}
          >
            Import Backup
          </button>
        </div>
      )}

      {/* School Details Tab */}
      {tab === 'schoolDetails' && (
        <div>
          <h3 className="text-xl font-semibold mb-4 text-slate-800">School Details</h3>
          {loading ? (
            <div className="text-slate-500">Loading...</div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">School Name *</label>
                <input
                  type="text"
                  name="school_name"
                  value={school?.school_name || ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  name="school_address"
                  value={school?.school_address || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                  <input
                    type="text"
                    name="school_phone"
                    value={school?.school_phone || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="school_email"
                    value={school?.school_email || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">School Logo</label>
                {logoPreview && (
                  <img
                    src={logoPreview}
                    alt="School Logo Preview"
                    className="h-24 mb-2 rounded shadow border"
                    style={{ objectFit: 'contain', background: '#f9fafb' }}
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  ref={fileInputRef}
                  onChange={handleLogoChange}
                  className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Point Configuration Tab */}
      {false && tab === 'pointsConfig' && (
        <div>
          <h3 className="text-xl font-semibold mb-4 text-slate-800">Point Configuration</h3>
          {loading ? (
            <div className="text-slate-500">Loading points configuration...</div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Standard Category Individual */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-sm">
                  <h5 className="text-sm font-semibold text-slate-800 mb-3">Standard Category (Individual Event)</h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">1st Place</label>
                      <input
                        type="number"
                        name="std_ind_first"
                        value={school?.std_ind_first ?? 5}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">2nd Place</label>
                      <input
                        type="number"
                        name="std_ind_second"
                        value={school?.std_ind_second ?? 3}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">3rd Place</label>
                      <input
                        type="number"
                        name="std_ind_third"
                        value={school?.std_ind_third ?? 1}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Standard Category Group */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-sm">
                  <h5 className="text-sm font-semibold text-slate-800 mb-3">Standard Category (Group / Team Event)</h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">1st Place</label>
                      <input
                        type="number"
                        name="std_group_first"
                        value={school?.std_group_first ?? 10}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">2nd Place</label>
                      <input
                        type="number"
                        name="std_group_second"
                        value={school?.std_group_second ?? 6}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">3rd Place</label>
                      <input
                        type="number"
                        name="std_group_third"
                        value={school?.std_group_third ?? 3}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Mixed Category Individual */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-sm">
                  <h5 className="text-sm font-semibold text-slate-800 mb-3">Mixed/General Category (Individual Event)</h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">1st Place</label>
                      <input
                        type="number"
                        name="mix_ind_first"
                        value={school?.mix_ind_first ?? 10}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">2nd Place</label>
                      <input
                        type="number"
                        name="mix_ind_second"
                        value={school?.mix_ind_second ?? 6}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">3rd Place</label>
                      <input
                        type="number"
                        name="mix_ind_third"
                        value={school?.mix_ind_third ?? 3}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Mixed Category Group */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-sm">
                  <h5 className="text-sm font-semibold text-slate-800 mb-3">Mixed/General Category (Group / Team Event)</h5>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">1st Place</label>
                      <input
                        type="number"
                        name="mix_group_first"
                        value={school?.mix_group_first ?? 10}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">2nd Place</label>
                      <input
                        type="number"
                        name="mix_group_second"
                        value={school?.mix_group_second ?? 6}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-500 mb-1">3rd Place</label>
                      <input
                        type="number"
                        name="mix_group_third"
                        value={school?.mix_group_third ?? 3}
                        onChange={handleInputChange}
                        className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                      />
                    </div>
                  </div>
                </div>

                {/* Participation Points */}
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 shadow-sm">
                  <h5 className="text-sm font-semibold text-slate-800 mb-3">Participation Points</h5>
                  <div>
                    <label className="block text-xs text-slate-500 mb-1">Points awarded for standard participation</label>
                    <input
                      type="number"
                      name="participation_points"
                      value={school?.participation_points ?? 1}
                      onChange={handleInputChange}
                      className="w-24 px-3 py-1.5 border border-slate-300 rounded text-sm focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Classes Tab */}
      {tab === 'classes' && (
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded border">
            <h3 className="text-lg font-semibold mb-3 text-slate-800">{editingClassId ? 'Edit Class' : 'Add New Class'}</h3>
            <form onSubmit={handleClassSubmit} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Class Name *</label>
                  <input
                    type="text"
                    value={classForm.name}
                    onChange={(e) => setClassForm({ ...classForm, name: e.target.value })}
                    required
                    placeholder="e.g., Grade 1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unique Code *</label>
                  <input
                    type="text"
                    value={classForm.code}
                    onChange={(e) => setClassForm({ ...classForm, code: e.target.value })}
                    required
                    placeholder="e.g., G1"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
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
                    className="bg-slate-300 text-slate-700 px-4 py-2 rounded hover:bg-slate-400 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 text-slate-800">All Classes</h3>
            {loadingConfig ? (
              <div className="text-slate-500 text-sm">Loading classes...</div>
            ) : classes.length === 0 ? (
              <div className="text-slate-500 text-sm italic">No classes configured. Add your classes above.</div>
            ) : (
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Class Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Unique Code</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {classes.map((cls) => (
                      <tr key={cls.id}>
                        <td className="px-4 py-2 text-sm text-slate-800">{cls.name}</td>
                        <td className="px-4 py-2 text-sm text-slate-800 font-mono">{cls.code}</td>
                        <td className="px-4 py-2 text-sm text-right space-x-2">
                          <button
                            onClick={() => handleEditClass(cls)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDeleteClass(cls.id)}
                            className="text-red-600 hover:text-red-800 font-medium transition-colors"
                          >
                            Delete
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

      {/* Categories Tab */}
      {tab === 'categories' && (
        <div className="space-y-6">
          <div className="bg-slate-50 p-4 rounded border">
            <h3 className="text-lg font-semibold mb-3 text-slate-800">{editingCategoryId ? 'Edit Category' : 'Add New Category'}</h3>
            <form onSubmit={handleCategorySubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category Name *</label>
                  <input
                    type="text"
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    required
                    placeholder="e.g., Lower Primary"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Unique Code *</label>
                  <input
                    type="text"
                    value={categoryForm.code}
                    onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value })}
                    required
                    placeholder="e.g., lp"
                    className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-300"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_mixing"
                  checked={categoryForm.is_mixing}
                  onChange={(e) => setCategoryForm({ ...categoryForm, is_mixing: e.target.checked })}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-100 focus:border-indigo-300 h-4 w-4"
                />
                <label htmlFor="is_mixing" className="text-sm font-medium text-slate-700 select-none">
                  Is mixing / general category (open to student classes/teams)
                </label>
              </div>

              {categoryForm.is_mixing && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-700 mb-2">Select Categories to Mix (Leave empty to mix all)</label>
                  {categories.length === 0 ? (
                    <div className="text-slate-500 text-xs italic">No other categories available.</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-white rounded border max-h-40 overflow-y-auto">
                      {categories.filter(c => !c.is_mixing && c.id !== editingCategoryId).map((cat) => (
                        <div key={cat.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`mix-cat-${cat.id}`}
                            checked={categoryForm.mixed_categories?.includes(cat.id)}
                            onChange={() => handleMixedCategoryCheck(cat.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-100 focus:border-indigo-300 h-4 w-4"
                          />
                          <label htmlFor={`mix-cat-${cat.id}`} className="text-xs text-slate-700 truncate select-none cursor-pointer">
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
                  <label className="block text-xs font-medium text-slate-700 mb-2">Assign Classes to this Category</label>
                  {classes.length === 0 ? (
                    <div className="text-slate-500 text-xs italic">Please add classes in the "Manage Classes" tab first.</div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 p-3 bg-white rounded border max-h-40 overflow-y-auto">
                      {classes.map((cls) => (
                        <div key={cls.id} className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id={`cls-${cls.id}`}
                            checked={categoryForm.classes.includes(cls.id)}
                            onChange={() => handleClassCheck(cls.id)}
                            className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-100 focus:border-indigo-300 h-4 w-4"
                          />
                          <label htmlFor={`cls-${cls.id}`} className="text-xs text-slate-700 truncate select-none cursor-pointer">
                            {cls.name}
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium transition-colors"
                >
                  {saving ? 'Saving...' : (editingCategoryId ? 'Update Category' : 'Add Category')}
                </button>
                {editingCategoryId && (
                  <button
                    type="button"
                    onClick={() => {
                      setCategoryForm({ name: '', code: '', is_mixing: false, classes: [] });
                      setEditingCategoryId(null);
                    }}
                    className="bg-slate-300 text-slate-700 px-4 py-2 rounded hover:bg-slate-400 text-sm font-medium transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div>
            <h3 className="text-lg font-semibold mb-3 text-slate-800">All Categories</h3>
            {loadingConfig ? (
              <div className="text-slate-500 text-sm">Loading categories...</div>
            ) : categories.length === 0 ? (
              <div className="text-slate-500 text-sm italic">No categories configured. Create your categories above.</div>
            ) : (
              <div className="overflow-x-auto border rounded">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Category Name</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Unique Code</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Type</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600 uppercase">Assigned Classes</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white">
                    {categories.map((cat) => {
                      const catClasses = classes.filter(cls => cat.class_ids?.includes(cls.id)).map(c => c.name);
                      return (
                        <tr key={cat.id}>
                          <td className="px-4 py-2 text-sm text-slate-800 font-medium">{cat.name}</td>
                          <td className="px-4 py-2 text-sm text-slate-800 font-mono">{cat.code}</td>
                          <td className="px-4 py-2 text-sm text-slate-800">
                            {cat.is_mixing ? (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-violet-100 text-violet-800 font-medium border border-violet-200">Mixing / General</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-indigo-100 text-indigo-800 font-medium border border-indigo-200">Standard</span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-slate-600 max-w-xs truncate">
                            {cat.is_mixing ? (
                              cat.mixed_category_ids && cat.mixed_category_ids.length > 0 ? (
                                `Mixed: ${categories.filter(c => cat.mixed_category_ids.includes(c.id)).map(c => c.name).join(', ')}`
                              ) : (
                                'All Categories (Mixed)'
                              )
                            ) : (
                              catClasses.join(', ') || 'No classes assigned'
                            )}
                          </td>
                          <td className="px-4 py-2 text-sm text-right space-x-2">
                            <button
                              onClick={() => handleEditCategory(cat)}
                              className="text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeleteCategory(cat.id)}
                              className="text-red-600 hover:text-red-800 font-medium transition-colors"
                            >
                              Delete
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

      {/* Toast Notification */}
      {toast && (
        <div className={`mt-6 p-3 rounded text-sm font-medium ${toast.type === 'success' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' : 'bg-red-100 text-red-800 border border-red-200'}`}>
          {toast.message}
        </div>
      )}
      </section>
    </div>
    </main>
  );
};

export default AdminSettings;
