import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Check,
  CheckCircle2,
  FolderPlus,
  HelpCircle,
  Layers,
  MapPin,
  MoreVertical,
  Palette,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Tag,
  Tags,
  Trash2,
  X,
} from 'lucide-react';
import { eventProgramTypesAPI } from '../../services/api';

const COLOR_PRESETS = [
  { name: 'Indigo', value: '#4F46E5' },
  { name: 'Emerald', value: '#10B981' },
  { name: 'Amber', value: '#F59E0B' },
  { name: 'Rose', value: '#F43F5E' },
  { name: 'Sky', value: '#0EA5E9' },
  { name: 'Purple', value: '#8B5CF6' },
  { name: 'Teal', value: '#14B8A6' },
  { name: 'Orange', value: '#F97316' },
];

const emptyForm = {
  code: '',
  name: '',
  description: '',
  is_stage_based: true,
  color: '#4F46E5',
  display_order: 0,
};

const getErrorMessage = (error) => {
  const data = error?.response?.data;
  if (!data) return 'The request could not be completed.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  if (data.error) return data.error;
  return Object.entries(data).map(([field, value]) => (
    `${field.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : value}`
  )).join(' ');
};

const slugify = (text) => {
  return (text || '')
    .toString()
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_')
    .replace(/[^\w_]+/g, '');
};

const normalizeColor = (col) => {
  if (!col) return '#4F46E5';
  if (col.startsWith('#') || col.startsWith('rgb')) return col;
  const named = {
    indigo: '#4F46E5',
    emerald: '#10B981',
    amber: '#F59E0B',
    rose: '#F43F5E',
    sky: '#0EA5E9',
    blue: '#3B82F6',
    purple: '#8B5CF6',
    teal: '#14B8A6',
    orange: '#F97316',
    green: '#10B981',
    red: '#EF4444',
  };
  return named[col.toLowerCase()] || '#4F46E5';
};

const EventProgramTypes = ({ eventId, event, onRefresh }) => {
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [autoSlug, setAutoSlug] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [openMenu, setOpenMenu] = useState(null);

  const actualEventId = eventId || event?.id;

  const loadTypes = async () => {
    if (!actualEventId) return;
    setLoading(true);
    try {
      const response = await eventProgramTypesAPI.list(actualEventId);
      const list = response.data?.results || response.data || [];
      setTypes(Array.isArray(list) ? list : []);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTypes();
  }, [actualEventId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const closeMenu = () => setOpenMenu(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const filteredTypes = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return types;
    return types.filter((t) => (
      t.name.toLowerCase().includes(needle) ||
      t.code.toLowerCase().includes(needle) ||
      (t.description && t.description.toLowerCase().includes(needle))
    ));
  }, [query, types]);

  const openCreate = () => {
    setEditing(null);
    const nextOrder = types.length > 0 ? Math.max(...types.map(t => t.display_order || 0)) + 1 : 0;
    setForm({
      ...emptyForm,
      color: COLOR_PRESETS[types.length % COLOR_PRESETS.length].value,
      display_order: nextOrder,
    });
    setAutoSlug(true);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (typeItem) => {
    setEditing(typeItem);
    setForm({
      code: typeItem.code,
      name: typeItem.name,
      description: typeItem.description || '',
      is_stage_based: Boolean(typeItem.is_stage_based),
      color: typeItem.color || '#4F46E5',
      display_order: typeItem.display_order || 0,
    });
    setAutoSlug(false);
    setOpenMenu(null);
    setError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setError('');
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && modalOpen && !saving) {
        closeModal();
      }
    };
    if (modalOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [modalOpen, saving]);

  const handleNameChange = (newName) => {
    if (autoSlug && !editing) {
      setForm((prev) => ({
        ...prev,
        name: newName,
        code: slugify(newName),
      }));
    } else {
      setForm((prev) => ({ ...prev, name: newName }));
    }
  };

  const saveType = async (e) => {
    e.preventDefault();
    const cleanCode = slugify(form.code);
    if (!cleanCode) {
      setError('Please provide a valid code for this program type.');
      return;
    }
    if (!form.name.trim()) {
      setError('Please provide a name for this program type.');
      return;
    }

    const payload = {
      code: cleanCode,
      name: form.name.trim(),
      description: form.description.trim(),
      is_stage_based: form.is_stage_based,
      color: form.color || '#4F46E5',
      display_order: Number(form.display_order) || 0,
    };

    setSaving(true);
    setError('');
    setMessage('');

    try {
      if (editing) {
        await eventProgramTypesAPI.patch(actualEventId, editing.id, payload);
        setMessage(`Program type "${payload.name}" updated successfully.`);
      } else {
        await eventProgramTypesAPI.create(actualEventId, payload);
        setMessage(`Program type "${payload.name}" created successfully.`);
      }
      closeModal();
      await loadTypes();
      if (onRefresh) onRefresh();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const removeType = async (typeItem) => {
    if (typeItem.programs_count > 0) {
      alert(
        `Cannot delete "${typeItem.name}" because it is currently assigned to ${typeItem.programs_count} program(s). Reassign those programs to another type first.`
      );
      return;
    }
    if (!window.confirm(`Are you sure you want to delete the program type "${typeItem.name}" (${typeItem.code})?`)) {
      return;
    }

    setDeletingId(typeItem.id);
    setError('');
    setMessage('');
    try {
      await eventProgramTypesAPI.remove(actualEventId, typeItem.id);
      setMessage(`Program type "${typeItem.name}" was deleted.`);
      await loadTypes();
      if (onRefresh) onRefresh();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="p-5 sm:p-6 lg:p-7 space-y-6 bg-slate-50/50 min-h-[620px]">
      {/* Header & Overview */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
              <Tags className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">Program Types</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 font-bold border border-indigo-100">
                  {types.length} Types
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 max-w-xl leading-relaxed">
                Define the competition categories for this event (Stage, Off-Stage, Sports, etc.). All filters, limits, and championship points adapt dynamically.
              </p>
            </div>
          </div>

          <button
            onClick={openCreate}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs hover:shadow transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add Program Type</span>
          </button>
        </div>

        {/* Global info callout */}
        <div className="mt-4 p-3.5 bg-gradient-to-r from-indigo-50/80 via-purple-50/40 to-indigo-50/60 border border-indigo-100/90 rounded-xl text-xs text-indigo-900 flex items-start gap-3">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-semibold text-indigo-950">Dynamic Event-wide Allocation</p>
            <p className="text-[11px] text-indigo-800/90 leading-relaxed">
              Every type configured here automatically updates your <strong>Add Program modal</strong>, <strong>Filters</strong>, <strong>Category Participation Limits</strong>, <strong>Excel/CSV Bulk Importer</strong>, and <strong>Category Championship Leaderboards</strong>.
            </p>
          </div>
        </div>
      </div>

      {/* Notifications */}
      {message && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-semibold text-emerald-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{message}</span>
          </div>
          <button onClick={() => setMessage('')} className="text-emerald-600 hover:text-emerald-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {error && !modalOpen && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError('')} className="text-rose-600 hover:text-rose-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Controls Bar: Search */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search types by name or code..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-10 pr-9 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium shadow-2xs transition-all"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200/80 text-slate-600 font-semibold shadow-2xs">
            Showing {filteredTypes.length} of {types.length} types
          </span>
        </div>
      </div>

      {/* Types Grid / Cards */}
      {loading ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-slate-200/70 shadow-2xs">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
          <p className="text-xs text-slate-500 font-medium">Loading program types...</p>
        </div>
      ) : filteredTypes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-12 text-center shadow-2xs">
          <Tag className="w-10 h-10 text-slate-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">No Program Types Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            {query ? 'No program types matched your search keyword.' : 'Get started by creating your first program type (e.g. Stage, Off-Stage, Sports).'}
          </p>
          {!query && (
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs"
            >
              <Plus className="w-4 h-4" />
              <span>Create Program Type</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filteredTypes.map((t) => {
            const isStage = t.is_stage_based;
            const typeColor = normalizeColor(t.color);

            return (
              <div
                key={t.id}
                className="bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs hover:shadow-md hover:border-slate-300 transition-all relative flex flex-col justify-between group"
              >
                <div>
                  {/* Top Row: Color indicator dot, Code badge & Action menu */}
                  <div className="flex items-center justify-between gap-2 mb-3.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <div
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-2xs ring-2 ring-slate-100"
                        style={{ backgroundColor: typeColor }}
                        title={`Color: ${typeColor}`}
                      />
                      <span className="font-mono text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200/60 truncate tracking-wide">
                        {t.code}
                      </span>
                    </div>

                    {/* Edit & Delete Action Buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => openEdit(t)}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 flex items-center justify-center transition-colors cursor-pointer"
                        title="Edit Type"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => removeType(t)}
                        disabled={deletingId === t.id}
                        className="w-7 h-7 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer disabled:opacity-50"
                        title={t.programs_count > 0 ? `${t.programs_count} programs assigned` : 'Delete Type'}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Title & Stage-based Pill */}
                  <div className="space-y-1.5 mb-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="text-base font-bold text-slate-900 tracking-tight capitalize truncate">
                        {t.name}
                      </h3>
                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border shrink-0 inline-flex items-center gap-1 ${
                          isStage
                            ? 'bg-purple-50 text-purple-700 border-purple-200/80'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isStage ? 'bg-purple-500' : 'bg-emerald-500'}`} />
                        <span>{isStage ? 'Stage-based' : 'Non-stage'}</span>
                      </span>
                    </div>

                    {/* Description with fixed min-height for uniform card heights */}
                    <div className="min-h-[38px] flex items-start">
                      {t.description ? (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {t.description}
                        </p>
                      ) : (
                        <p className="text-xs text-slate-400 italic">No description provided.</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Footer Metadata */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span className="flex items-center gap-1.5 text-slate-700">
                    <Layers className="w-3.5 h-3.5 text-slate-400" />
                    <span className="font-bold">{t.programs_count || 0}</span>
                    <span>programs</span>
                  </span>
                  <span className="text-[11px] font-medium text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/50">
                    Order: {t.display_order ?? 0}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add / Edit Slide-Over Drawer */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-slate-950/45 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
            onClick={closeModal}
          />

          <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 md:pl-10">
            <div className="w-screen max-w-lg bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
              {/* Sticky Header */}
              <div className="px-6 py-5 border-b border-slate-200 bg-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs shrink-0">
                    <Tags className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {editing ? `Edit "${editing.name}"` : 'Add Program Type'}
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {editing ? 'Update configuration and parameters for this type' : 'Create a new competition program type for this event'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Scrollable Form Body */}
              <form
                id="program-type-drawer-form"
                onSubmit={saveType}
                className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
              >
                {error && (
                  <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-semibold text-rose-800 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {/* Card 1: Identification */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Type Identification
                  </h4>

                  {/* Name */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Type Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Stage, Off-Stage, Sports, Literary"
                      value={form.name}
                      onChange={(e) => handleNameChange(e.target.value)}
                      className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-semibold shadow-2xs"
                    />
                  </div>

                  {/* Code */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold text-slate-700">
                        Type Code (Identifier) <span className="text-rose-500">*</span>
                      </label>
                      {!editing && (
                        <button
                          type="button"
                          onClick={() => setAutoSlug(!autoSlug)}
                          className="text-[11px] text-indigo-600 font-bold hover:underline cursor-pointer"
                        >
                          {autoSlug ? 'Customize Code' : 'Auto-generate from Name'}
                        </button>
                      )}
                    </div>
                    <input
                      type="text"
                      required
                      placeholder="e.g. stage, off_stage, sports"
                      value={form.code}
                      disabled={Boolean(editing)}
                      onChange={(e) => {
                        setAutoSlug(false);
                        setForm({ ...form, code: slugify(e.target.value) });
                      }}
                      className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-mono font-semibold shadow-2xs disabled:bg-slate-100 disabled:text-slate-500"
                    />
                    <p className="text-[11px] text-slate-400 mt-1.5">
                      {editing
                        ? 'Type code cannot be changed once created as existing programs and scores reference it.'
                        : 'Unique lowercase identifier stored in programs (e.g., stage, off_stage).'}
                    </p>
                  </div>
                </div>

                {/* Card 2: Scheduling & Physical Venue */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <label
                        htmlFor="is_stage_based_checkbox"
                        className="text-xs font-bold text-slate-900 block cursor-pointer"
                      >
                        Requires Stage / Physical Venue
                      </label>
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Live performances scheduled on designated stages, halls, or venues with live judging and stage timers.
                      </p>
                    </div>
                    <input
                      id="is_stage_based_checkbox"
                      type="checkbox"
                      checked={form.is_stage_based}
                      onChange={(e) => setForm({ ...form, is_stage_based: e.target.checked })}
                      className="w-5 h-5 text-indigo-600 focus:ring-indigo-500 border-slate-300 rounded-md cursor-pointer shrink-0 mt-0.5"
                    />
                  </div>
                </div>

                {/* Card 3: Color Palette & Visual Theme */}
                <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Palette className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Color Theme</span>
                    </label>
                    <span className="text-[11px] font-mono font-semibold text-slate-500">
                      {form.color || '#4F46E5'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="grid grid-cols-8 gap-2 flex-1">
                      {COLOR_PRESETS.map((p) => {
                        const isSelected = form.color?.toLowerCase() === p.value.toLowerCase();
                        return (
                          <button
                            key={p.value}
                            type="button"
                            onClick={() => setForm({ ...form, color: p.value })}
                            style={{ backgroundColor: p.value }}
                            className={`w-8 h-8 rounded-xl border-2 transition-all cursor-pointer flex items-center justify-center ${
                              isSelected
                                ? 'border-slate-900 scale-110 shadow-sm ring-2 ring-indigo-200'
                                : 'border-transparent hover:scale-105 opacity-90 hover:opacity-100'
                            }`}
                            title={p.name}
                          >
                            {isSelected && <Check className="w-4 h-4 text-white drop-shadow-sm" />}
                          </button>
                        );
                      })}
                    </div>
                    <div className="relative shrink-0">
                      <input
                        type="color"
                        value={form.color || '#4F46E5'}
                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                        className="w-9 h-9 rounded-xl border border-slate-200 cursor-pointer p-0.5 shadow-2xs"
                        title="Custom hex color"
                      />
                    </div>
                  </div>
                </div>

                {/* Card 4: Description & Order */}
                <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 space-y-4">
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                    Additional Details
                  </h4>

                  {/* Description */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Description <span className="text-slate-400 font-normal">(Optional)</span>
                    </label>
                    <textarea
                      rows={3}
                      placeholder="Optional details, guidelines, or criteria for this program type..."
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium resize-none shadow-2xs"
                    />
                  </div>

                  {/* Display Order */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Display Order
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={form.display_order}
                      onChange={(e) => setForm({ ...form, display_order: parseInt(e.target.value, 10) || 0 })}
                      className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 font-medium shadow-2xs"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Lower numbers appear first in program lists, filter pills, and navigation tabs.
                    </p>
                  </div>
                </div>
              </form>

              {/* Sticky Footer */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50/90 flex items-center justify-end gap-3 shrink-0">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="program-type-drawer-form"
                  disabled={saving}
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs hover:shadow transition-all cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>{editing ? 'Update Program Type' : 'Create Program Type'}</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventProgramTypes;
