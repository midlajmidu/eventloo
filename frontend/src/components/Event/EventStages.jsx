import React, { useEffect, useMemo, useState } from 'react';
import {
  ExternalLink, MapPin, MoreVertical, Pencil, Plus, Search, Trash2, Users, X,
} from 'lucide-react';
import { eventStagesAPI } from '../../services/api';

const emptyForm = { number: '', name: '', capacity: '', map_link: '' };

const getErrorMessage = (error) => {
  const data = error?.response?.data;
  if (!data) return 'The request could not be completed.';
  if (typeof data === 'string') return data;
  if (data.detail) return data.detail;
  return Object.entries(data).map(([field, value]) => (
    `${field.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : value}`
  )).join(' ');
};

const EventStages = ({ eventId }) => {
  const [stages, setStages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [openMenu, setOpenMenu] = useState(null);

  const loadStages = async () => {
    setLoading(true);
    try {
      const response = await eventStagesAPI.list(eventId, { page_size: 500 });
      setStages(response.data.results || response.data || []);
      setError('');
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStages(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const closeMenu = () => setOpenMenu(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, []);

  const filteredStages = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return stages;
    return stages.filter((stage) => (
      String(stage.number).includes(needle)
      || stage.name.toLowerCase().includes(needle)
    ));
  }, [query, stages]);

  const openCreate = () => {
    const nextNumber = stages.reduce((highest, stage) => Math.max(highest, stage.number), 0) + 1;
    setEditing(null);
    setForm({ ...emptyForm, number: String(nextNumber) });
    setError('');
    setDrawerOpen(true);
  };

  const openEdit = (stage) => {
    setEditing(stage);
    setForm({
      number: String(stage.number),
      name: stage.name || '',
      capacity: stage.capacity ?? '',
      map_link: stage.map_link || '',
    });
    setOpenMenu(null);
    setError('');
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    if (saving) return;
    setDrawerOpen(false);
    setEditing(null);
    setForm(emptyForm);
    setError('');
  };

  const saveStage = async (event) => {
    event.preventDefault();
    const payload = {
      number: Number(form.number),
      name: form.name.trim(),
      capacity: form.capacity === '' ? null : Number(form.capacity),
      map_link: form.map_link.trim(),
    };
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (editing) await eventStagesAPI.update(eventId, editing.id, payload);
      else await eventStagesAPI.create(eventId, payload);
      setMessage(editing ? 'Stage updated successfully.' : 'Stage added successfully.');
      setDrawerOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await loadStages();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setSaving(false);
    }
  };

  const removeStage = async (stage) => {
    setOpenMenu(null);
    if (!window.confirm(`Delete ${stage.display_name}? Programs keep their printed venue name but will no longer be linked to this stage.`)) return;
    try {
      await eventStagesAPI.remove(eventId, stage.id);
      setMessage('Stage deleted successfully.');
      await loadStages();
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    }
  };

  return (
    <div className="min-h-[620px] bg-slate-50 p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Event setup</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Stages</h1>
          <p className="mt-1 text-sm text-slate-500">Manage event stages, halls, and locations.</p>
        </div>
        <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
          <Plus className="h-4 w-4" /> Add stage
        </button>
      </div>

      {message && <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{message}</div>}
      {error && !drawerOpen && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <label className="relative block max-w-md">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search stages" className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" />
          </label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
              <tr><th className="px-5 py-3 font-semibold">Stage number</th><th className="px-5 py-3 font-semibold">Stage name</th><th className="px-5 py-3 font-semibold">Capacity</th><th className="px-5 py-3 font-semibold">Programs</th><th className="px-5 py-3 font-semibold">Map link</th><th className="px-5 py-3 text-right font-semibold">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan="6" className="px-5 py-14 text-center text-slate-500">Loading stages…</td></tr> : filteredStages.length === 0 ? <tr><td colSpan="6" className="px-5 py-16 text-center"><MapPin className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 font-semibold text-slate-700">{query ? 'No matching stages' : 'No stages added'}</p><p className="mt-1 text-xs text-slate-500">{query ? 'Try a different search.' : 'Add your first stage or hall for this event.'}</p></td></tr> : filteredStages.map((stage) => (
                <tr key={stage.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4"><span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-indigo-50 px-2 font-bold text-indigo-700">{stage.number}</span></td>
                  <td className="px-5 py-4 font-semibold text-slate-900">{stage.name || `Stage ${stage.number}`}</td>
                  <td className="px-5 py-4 text-slate-600">{stage.capacity ? <span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-slate-400" />{stage.capacity}</span> : '—'}</td>
                  <td className="px-5 py-4 text-slate-600">{stage.program_count}</td>
                  <td className="px-5 py-4">{stage.map_link ? <a href={stage.map_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 font-medium text-indigo-600 hover:text-indigo-800">Open map <ExternalLink className="h-3.5 w-3.5" /></a> : <span className="text-slate-400">—</span>}</td>
                  <td className="relative px-5 py-4 text-right"><button onClick={(event) => { event.stopPropagation(); setOpenMenu(openMenu === stage.id ? null : stage.id); }} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100" aria-label={`Actions for ${stage.display_name}`}><MoreVertical className="h-4 w-4" /></button>{openMenu === stage.id && <div onClick={(event) => event.stopPropagation()} className="absolute right-5 top-12 z-10 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-xl"><button onClick={() => openEdit(stage)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"><Pencil className="h-4 w-4" /> Edit</button><button onClick={() => removeStage(stage)} className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"><Trash2 className="h-4 w-4" /> Delete</button></div>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {drawerOpen && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm"><div className="flex h-full w-full max-w-lg flex-col bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="text-xl font-bold text-slate-900">{editing ? 'Edit stage' : 'New stage'}</h2><p className="mt-1 text-sm text-slate-500">Add a stage, hall, or event location.</p></div><button type="button" onClick={closeDrawer} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><form onSubmit={saveStage} className="flex-1 space-y-5 overflow-y-auto p-6">
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Stage number <span className="text-red-500">*</span></span><input type="number" min="1" required value={form.number} onChange={(event) => setForm({ ...form, number: event.target.value })} placeholder="e.g. 1" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Stage name <span className="font-normal text-slate-400">(optional)</span></span><input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Main Stage or Seminar Hall" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Capacity <span className="font-normal text-slate-400">(optional)</span></span><input type="number" min="1" value={form.capacity} onChange={(event) => setForm({ ...form, capacity: event.target.value })} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Map link <span className="font-normal text-slate-400">(optional)</span></span><input type="url" value={form.map_link} onChange={(event) => setForm({ ...form, map_link: event.target.value })} placeholder="https://maps.google.com/…" className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="flex justify-end gap-3 border-t border-slate-100 pt-5"><button type="button" onClick={closeDrawer} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save stage'}</button></div>
      </form></div></div>}
    </div>
  );
};

export default EventStages;
