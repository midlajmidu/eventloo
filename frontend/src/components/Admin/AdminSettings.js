import React, { useState, useEffect, useRef } from 'react';
import { schoolSettingsAPI } from '../../services/api';

const AdminSettings = () => {
  const [tab, setTab] = useState('importExport');
  const [toast, setToast] = useState(null);

  // School details state
  const [school, setSchool] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [logoPreview, setLogoPreview] = useState(null);
  const fileInputRef = useRef();

  useEffect(() => {
    if (tab === 'schoolDetails') {
      fetchSchoolSettings();
    }
  }, [tab]);

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
    <div className="max-w-xl mx-auto p-8 bg-white rounded shadow mt-10">
      <h2 className="text-2xl font-bold mb-6">Admin Settings</h2>
      <div className="flex gap-4 mb-8 border-b pb-2">
        <button
          className={`px-4 py-2 rounded-t ${tab === 'importExport' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => setTab('importExport')}
        >
          Import/Export
        </button>
        <button
          className={`px-4 py-2 rounded-t ${tab === 'schoolDetails' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
          onClick={() => setTab('schoolDetails')}
        >
          School Details
        </button>
      </div>
      {tab === 'importExport' && (
        <div className="flex flex-col gap-4 mb-8">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            onClick={handleDownloadBackup}
          >
            Download Backup
          </button>
          <button
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
            onClick={handleImportBackup}
          >
            Import Backup
          </button>
        </div>
      )}
      {tab === 'schoolDetails' && (
        <div>
          <h3 className="text-xl font-semibold mb-4">School Details</h3>
          {loading ? (
            <div className="text-gray-500">Loading...</div>
          ) : (
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">School Name *</label>
                <input
                  type="text"
                  name="school_name"
                  value={school?.school_name || ''}
                  onChange={handleInputChange}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <textarea
                  name="school_address"
                  value={school?.school_address || ''}
                  onChange={handleInputChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    type="text"
                    name="school_phone"
                    value={school?.school_phone || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    type="email"
                    name="school_email"
                    value={school?.school_email || ''}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">School Logo</label>
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
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                />
              </div>
              <button
                type="submit"
                disabled={saving}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          )}
        </div>
      )}
      {toast && (
        <div className={`mt-6 p-3 rounded ${toast.type === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {toast.message}
        </div>
      )}
    </div>
  );
};

export default AdminSettings; 