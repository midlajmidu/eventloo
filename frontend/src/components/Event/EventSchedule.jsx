import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Download, FileSpreadsheet, Pencil, Search, X } from 'lucide-react';
import { eventProgramsAPI, eventScheduleAPI, eventStagesAPI } from '../../services/api';

const toLocalInput = (value) => {
  if (!value) return '';
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};

const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(new Date(value))
  : 'Not scheduled';

const getError = (error) => {
  const data = error?.response?.data;
  if (!data) return 'The schedule could not be saved.';
  if (data.detail) return data.detail;
  return Object.entries(data).map(([field, value]) => (
    `${field.replaceAll('_', ' ')}: ${Array.isArray(value) ? value.join(' ') : value}`
  )).join(' ');
};

const EventSchedule = ({ event, eventId }) => {
  const [programs, setPrograms] = useState([]);
  const [stages, setStages] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState({
    stage_id: '', start_time: '', end_time: '', duration_minutes_per_entry: 5,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [programResponse, stageResponse] = await Promise.all([
        eventProgramsAPI.getPrograms(eventId, 'page_size=1000&ordering=start_time'),
        eventStagesAPI.list(eventId, { page_size: 1000 }),
      ]);
      setPrograms(programResponse.data.results || programResponse.data || []);
      setStages(stageResponse.data.results || stageResponse.data || []);
      setError('');
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return programs;
    return programs.filter((program) => [
      program.name, program.category_display, program.stage?.display_name,
    ].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [programs, query]);

  const calculatedEnd = useMemo(
    () => (form.end_time ? new Date(form.end_time) : null),
    [form.end_time],
  );

  const conflicts = useMemo(() => {
    if (!editing || !form.stage_id || !form.start_time || !calculatedEnd) return [];
    const start = new Date(form.start_time);
    return programs.filter((program) => {
      if (program.id === editing.id || String(program.stage?.id) !== String(form.stage_id) || !program.start_time) return false;
      const otherStart = new Date(program.start_time);
      const otherEnd = program.end_time
        ? new Date(program.end_time)
        : new Date(otherStart.getTime() + Number(program.scheduled_duration_minutes || 0) * 60000);
      return otherStart < calculatedEnd && otherEnd > start;
    });
  }, [calculatedEnd, editing, form.stage_id, form.start_time, programs]);

  const openEditor = (program) => {
    const slots = Math.max(1, Number(program.schedule_entry_count || 0));
    const automaticEnd = program.start_time
      ? new Date(new Date(program.start_time).getTime()
        + slots * Number(program.duration_minutes_per_entry || 5) * 60000)
      : null;
    setEditing(program);
    setForm({
      stage_id: program.stage?.id || '',
      start_time: toLocalInput(program.start_time),
      end_time: toLocalInput(program.end_time || automaticEnd),
      duration_minutes_per_entry: program.duration_minutes_per_entry || 5,
    });
    setError('');
  };

  const save = async (submitEvent) => {
    submitEvent.preventDefault();
    setSaving(true);
    setError('');
    try {
      await eventScheduleAPI.update(eventId, editing.id, {
        stage_id: Number(form.stage_id),
        start_time: form.start_time,
        end_time: form.end_time,
        duration_minutes_per_entry: Number(form.duration_minutes_per_entry),
      });
      setEditing(null);
      await load();
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const clearSchedule = async () => {
    if (!window.confirm(`Clear the schedule for ${editing.name}?`)) return;
    setSaving(true);
    try {
      await eventScheduleAPI.update(eventId, editing.id, { start_time: null });
      setEditing(null);
      await load();
    } catch (requestError) {
      setError(getError(requestError));
    } finally {
      setSaving(false);
    }
  };

  const download = async (format) => {
    try {
      const response = await eventScheduleAPI.export(eventId, format);
      const url = URL.createObjectURL(response.data);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${event?.title || 'event'}-schedule.${format}`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(getError(requestError));
    }
  };

  return (
    <div className="min-h-[620px] bg-slate-50 p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Event operations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Schedule</h1>
          <p className="mt-1 text-sm text-slate-500">Assign every program to a stage, date, and start time.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => download('csv')} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"><FileSpreadsheet className="h-4 w-4" /> CSV</button>
          <button onClick={() => download('pdf')} className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700"><Download className="h-4 w-4" /> Export PDF</button>
        </div>
      </div>

      {error && !editing && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-4">
          <label className="relative block max-w-xl"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" /><input value={query} onChange={(inputEvent) => setQuery(inputEvent.target.value)} placeholder="Search programs, categories, or stages" className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500"><tr><th className="px-5 py-3">Program</th><th className="px-5 py-3">Type</th><th className="px-5 py-3">Entries</th><th className="px-5 py-3">Duration</th><th className="px-5 py-3">Stage</th><th className="px-5 py-3">Schedule</th><th className="px-5 py-3 text-right">Action</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? <tr><td colSpan="7" className="px-5 py-16 text-center text-slate-500">Loading schedule…</td></tr> : filtered.length === 0 ? <tr><td colSpan="7" className="px-5 py-16 text-center text-slate-500">No programs found.</td></tr> : filtered.map((program) => (
                <tr key={program.id} className="hover:bg-slate-50/70">
                  <td className="px-5 py-4"><p className="font-semibold text-slate-900">{program.name}</p><p className="mt-0.5 text-xs text-slate-500">{program.category_display}</p></td>
                  <td className="px-5 py-4 text-slate-600">{program.is_team_based ? 'Group' : 'Individual'}</td>
                  <td className="px-5 py-4"><span className="font-semibold text-slate-900">{program.schedule_entry_count}</span><span className="ml-1 text-slate-500">{program.schedule_entry_type}</span></td>
                  <td className="px-5 py-4 text-slate-600"><p>{program.duration_minutes_per_entry} min each</p><p className="text-xs text-slate-400">{program.scheduled_duration_minutes} min total</p></td>
                  <td className="px-5 py-4 text-slate-600">{program.stage?.display_name || <span className="text-slate-400">Not assigned</span>}</td>
                  <td className="px-5 py-4"><p className={program.start_time ? 'font-medium text-slate-800' : 'text-slate-400'}>{formatDateTime(program.start_time)}</p>{program.end_time && <p className="mt-0.5 text-xs text-slate-400">Ends {formatDateTime(program.end_time)}</p>}</td>
                  <td className="px-5 py-4 text-right"><button onClick={() => openEditor(program)} aria-label={`Edit schedule for ${program.name}`} className="rounded-lg p-2 text-indigo-600 hover:bg-indigo-50"><Pencil className="h-4 w-4" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {editing && <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm"><div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"><div className="flex items-start justify-between border-b border-slate-100 px-6 py-5"><div><h2 className="text-xl font-bold text-slate-900">Edit schedule</h2><p className="mt-1 text-sm text-slate-500">{editing.name}</p></div><button onClick={() => setEditing(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"><X className="h-5 w-5" /></button></div><form onSubmit={save} className="flex-1 space-y-5 overflow-y-auto p-6">
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Stage *</span><select required value={form.stage_id} onChange={(inputEvent) => setForm({ ...form, stage_id: inputEvent.target.value })} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"><option value="">Select stage</option>{stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.number} — {stage.display_name}</option>)}</select></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Start date &amp; time *</span><input type="datetime-local" required min={event?.start_date ? `${event.start_date}T00:00` : undefined} max={event?.end_date ? `${event.end_date}T23:59` : undefined} value={form.start_time} onChange={(inputEvent) => { const start = inputEvent.target.value; const slots = Math.max(1, Number(editing.schedule_entry_count || 0)); const end = start ? new Date(new Date(start).getTime() + slots * Number(form.duration_minutes_per_entry || 0) * 60000) : null; setForm({ ...form, start_time: start, end_time: toLocalInput(end) }); }} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Ending date &amp; time *</span><input type="datetime-local" required min={form.start_time || (event?.start_date ? `${event.start_date}T00:00` : undefined)} max={event?.end_date ? `${event.end_date}T23:59` : undefined} value={form.end_time} onChange={(inputEvent) => setForm({ ...form, end_time: inputEvent.target.value })} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /><span className="mt-1.5 block text-xs text-slate-500">Conflicts are checked for this complete start-to-end period.</span></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold text-slate-700">Minutes per {editing.is_team_based ? 'group' : 'participant'} *</span><input type="number" min="1" required value={form.duration_minutes_per_entry} onChange={(inputEvent) => { const duration = inputEvent.target.value; const slots = Math.max(1, Number(editing.schedule_entry_count || 0)); const end = form.start_time ? new Date(new Date(form.start_time).getTime() + slots * Number(duration || 0) * 60000) : null; setForm({ ...form, duration_minutes_per_entry: duration, end_time: toLocalInput(end) }); }} className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100" /><span className="mt-1.5 block text-xs text-slate-500">Suggested duration: {Math.max(1, Number(editing.schedule_entry_count || 0))} slot(s) × {form.duration_minutes_per_entry || 0} min = {Math.max(1, Number(editing.schedule_entry_count || 0)) * Number(form.duration_minutes_per_entry || 0)} minutes. {calculatedEnd && `Current ending time: ${formatDateTime(calculatedEnd)}.`}</span></label>
        {conflicts.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900"><div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Time conflict detected</div><p className="mt-1">{conflicts.length} program(s) overlap on this stage:</p><ul className="mt-2 list-disc space-y-1 pl-5">{conflicts.map((program) => <li key={program.id}>{program.name} — {formatDateTime(program.start_time)}</li>)}</ul><p className="mt-2 italic">You can still save; this warning helps you resolve the clash.</p></div>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        <div className="flex items-center justify-between border-t border-slate-100 pt-5"><button type="button" disabled={saving || !editing.start_time} onClick={clearSchedule} className="text-sm font-semibold text-red-600 disabled:opacity-40">Clear schedule</button><div className="flex gap-2"><button type="button" onClick={() => setEditing(null)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100">Cancel</button><button disabled={saving} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">{saving ? 'Saving…' : 'Save schedule'}</button></div></div>
      </form></div></div>}
    </div>
  );
};

export default EventSchedule;
