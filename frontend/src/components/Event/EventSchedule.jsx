import React, { useEffect, useMemo, useState } from 'react';
import { 
  AlertTriangle, 
  Download, 
  FileSpreadsheet, 
  Pencil, 
  Search, 
  X,
  Eye,
  RefreshCw,
  ExternalLink,
  Calendar,
  FileText,
  Maximize2
} from 'lucide-react';
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

  // Top Tabs & Live PDF Preview States
  const [activeTab, setActiveTab] = useState('table'); // 'table' | 'preview'
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);

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

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  const loadPdfPreview = async () => {
    setLoadingPdf(true);
    setError('');
    try {
      const response = await eventScheduleAPI.export(eventId, 'pdf');
      const blob = new Blob([response.data], { type: 'application/pdf' });
      setPdfUrl((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      console.error('Error loading PDF preview:', err);
      setError('Unable to load live PDF schedule preview.');
    } finally {
      setLoadingPdf(false);
    }
  };

  const openPreviewModal = async () => {
    setPreviewModalOpen(true);
    if (!pdfUrl) {
      await loadPdfPreview();
    }
  };

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return programs;
    return programs.filter((program) => [
      program.name, program.category_display, program.stage?.display_name,
    ].some((value) => String(value || '').toLowerCase().includes(needle)));
  }, [programs, query]);

  const getSlots = (program) => {
    return Math.max(
      1,
      Number(
        program?.schedule_entry_count ||
        program?.participants_count ||
        program?.max_participants ||
        0
      )
    );
  };

  const calculateEndTime = (startTime, durationMinutes, program) => {
    if (!startTime) return '';
    const slots = getSlots(program);
    const duration = Number(durationMinutes || 5);
    const totalMinutes = slots * duration;
    const end = new Date(new Date(startTime).getTime() + totalMinutes * 60000);
    return toLocalInput(end);
  };

  const calculatedEnd = useMemo(() => {
    if (form.end_time) return new Date(form.end_time);
    if (form.start_time) {
      const slots = getSlots(editing);
      const duration = Number(form.duration_minutes_per_entry || 5);
      return new Date(new Date(form.start_time).getTime() + slots * duration * 60000);
    }
    return null;
  }, [editing, form.duration_minutes_per_entry, form.end_time, form.start_time]);

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
    const duration = Number(program.duration_minutes_per_entry || 5);
    const automaticEnd = program.start_time
      ? calculateEndTime(program.start_time, duration, program)
      : '';
    setEditing(program);
    setForm({
      stage_id: program.stage?.id || '',
      start_time: toLocalInput(program.start_time),
      end_time: toLocalInput(program.end_time || automaticEnd),
      duration_minutes_per_entry: duration,
    });
    setError('');
  };

  const handleStartTimeChange = (newStartTime) => {
    const autoEnd = calculateEndTime(newStartTime, form.duration_minutes_per_entry, editing);
    setForm((prev) => ({
      ...prev,
      start_time: newStartTime,
      end_time: autoEnd,
    }));
  };

  const handleDurationChange = (newDuration) => {
    const autoEnd = calculateEndTime(form.start_time, newDuration, editing);
    setForm((prev) => ({
      ...prev,
      duration_minutes_per_entry: newDuration,
      end_time: autoEnd,
    }));
  };

  const save = async (submitEvent, andPreview = false) => {
    submitEvent?.preventDefault?.();
    setSaving(true);
    setError('');
    try {
      const autoEnd = calculateEndTime(form.start_time, form.duration_minutes_per_entry, editing);
      const payloadEndTime = form.end_time ? form.end_time : (autoEnd || null);

      await eventScheduleAPI.update(eventId, editing.id, {
        stage_id: Number(form.stage_id),
        start_time: form.start_time,
        end_time: payloadEndTime,
        duration_minutes_per_entry: Number(form.duration_minutes_per_entry),
      });
      setEditing(null);
      await load();
      if (andPreview) {
        setActiveTab('preview');
        await loadPdfPreview();
      } else if (activeTab === 'preview') {
        await loadPdfPreview();
      }
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
      if (activeTab === 'preview') {
        await loadPdfPreview();
      }
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

  const slotsCount = editing ? getSlots(editing) : 1;
  const entryUnit = editing?.is_team_based ? (slotsCount === 1 ? 'group' : 'groups') : (slotsCount === 1 ? 'participant' : 'participants');

  return (
    <div className="min-h-[620px] bg-slate-50 p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Event operations</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">Schedule</h1>
          <p className="mt-1 text-sm text-slate-500">Assign every program to a stage, date, and start time.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeTab === 'preview' && (
            <button
              onClick={loadPdfPreview}
              disabled={loadingPdf}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs"
            >
              <RefreshCw className={`h-4 w-4 ${loadingPdf ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Refresh PDF</span>
            </button>
          )}
          <button
            onClick={() => {
              setActiveTab('preview');
              if (!pdfUrl) loadPdfPreview();
            }}
            className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-colors shadow-2xs ${
              activeTab === 'preview'
                ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Eye className="h-4 w-4" /> Live Preview
          </button>
          <button
            onClick={openPreviewModal}
            title="Open preview in a pop-up modal"
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <Maximize2 className="h-4 w-4 text-slate-500" />
            <span>Modal</span>
          </button>
          <button
            onClick={() => download('csv')}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
          >
            <FileSpreadsheet className="h-4 w-4" /> CSV
          </button>
          <button
            onClick={() => download('pdf')}
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 transition-colors"
          >
            <Download className="h-4 w-4" /> Export PDF
          </button>
        </div>
      </div>

      {/* Tabs Selector on Top */}
      <div className="mt-6 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setActiveTab('table')}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'table'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Calendar className="h-4 w-4" />
            <span>Schedule Table</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 font-semibold">
              {filtered.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('preview');
              if (!pdfUrl) loadPdfPreview();
            }}
            className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-bold border-b-2 transition-all ${
              activeTab === 'preview'
                ? 'border-indigo-600 text-indigo-600 bg-indigo-50/50 rounded-t-xl'
                : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
          >
            <Eye className="h-4 w-4" />
            <span>PDF Preview</span>
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] uppercase tracking-wider bg-indigo-100 text-indigo-700 font-bold">
              Print Ready
            </span>
          </button>
        </div>
      </div>

      {error && !editing && <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

      {activeTab === 'preview' ? (
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm p-4 sm:p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
              <p className="text-sm font-bold text-slate-900">
                Official Schedule Document Preview
              </p>
              <span className="text-xs text-slate-400">({event?.title || 'Event Schedule'})</span>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={openPreviewModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 transition-colors"
              >
                <Maximize2 className="h-3.5 w-3.5" />
                <span>Modal View</span>
              </button>
              {pdfUrl && (
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-indigo-600 hover:bg-slate-50 border border-slate-200 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Open Fullscreen</span>
                </a>
              )}
              <button
                onClick={loadPdfPreview}
                disabled={loadingPdf}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingPdf ? 'animate-spin' : ''}`} />
                <span>Refresh Live</span>
              </button>
              <button
                onClick={() => download('pdf')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-2xs"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Download</span>
              </button>
            </div>
          </div>

          <div className="w-full h-[760px] bg-slate-900/5 rounded-xl border border-slate-200 overflow-hidden relative">
            {loadingPdf ? (
              <div className="flex h-full w-full flex-col items-center justify-center space-y-3 bg-white">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                <p className="text-sm font-semibold text-slate-700">Generating live printable PDF schedule...</p>
                <p className="text-xs text-slate-400">Compiling stages, programs, and timelines</p>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=1&navpanes=0`}
                title="Schedule PDF Preview"
                className="h-full w-full border-0"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center space-y-3 bg-white text-center p-8">
                <FileText className="h-12 w-12 text-slate-300" />
                <p className="text-sm font-semibold text-slate-700">No PDF preview generated yet</p>
                <button
                  onClick={loadPdfPreview}
                  className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                >
                  Generate PDF Preview
                </button>
              </div>
            )}
          </div>
        </section>
      ) : (
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
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-950/45 backdrop-blur-sm">
          <div className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Edit schedule</h2>
                <p className="mt-1 text-sm text-slate-500">{editing.name}</p>
              </div>
              <button onClick={() => setEditing(null)} className="rounded-xl p-2 text-slate-400 hover:bg-slate-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={save} className="flex-1 space-y-5 overflow-y-auto p-6">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Stage *</span>
                <select
                  required
                  value={form.stage_id}
                  onChange={(inputEvent) => setForm({ ...form, stage_id: inputEvent.target.value })}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                >
                  <option value="">Select stage</option>
                  {stages.map((stage) => (
                    <option key={stage.id} value={stage.id}>{stage.number} — {stage.display_name}</option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Start date &amp; time *</span>
                <input
                  type="datetime-local"
                  required
                  min={event?.start_date ? `${event.start_date}T00:00` : undefined}
                  max={event?.end_date ? `${event.end_date}T23:59` : undefined}
                  value={form.start_time}
                  onChange={(inputEvent) => handleStartTimeChange(inputEvent.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">
                  Minutes per {editing.is_team_based ? 'group' : 'participant'} *
                </span>
                <input
                  type="number"
                  min="1"
                  required
                  value={form.duration_minutes_per_entry}
                  onChange={(inputEvent) => handleDurationChange(inputEvent.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
              </label>

              {/* Auto Duration Calculation Summary Box */}
              <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 p-3.5 text-xs text-indigo-900">
                <div className="flex items-center justify-between font-semibold">
                  <span>Auto-Calculated Total Duration:</span>
                  <span className="font-bold text-indigo-700">
                    {slotsCount} {entryUnit} × {form.duration_minutes_per_entry || 0} min = {slotsCount * Number(form.duration_minutes_per_entry || 0)} minutes
                  </span>
                </div>
                {calculatedEnd && (
                  <p className="mt-1.5 text-[11px] text-indigo-700">
                    Calculated Ending Time: <strong className="font-bold">{formatDateTime(calculatedEnd)}</strong>
                  </p>
                )}
              </div>

              <label className="block">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-semibold text-slate-700">Ending date &amp; time</span>
                  <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded">Optional</span>
                </div>
                <input
                  type="datetime-local"
                  min={form.start_time || (event?.start_date ? `${event.start_date}T00:00` : undefined)}
                  max={event?.end_date ? `${event.end_date}T23:59` : undefined}
                  value={form.end_time}
                  onChange={(inputEvent) => setForm({ ...form, end_time: inputEvent.target.value })}
                  placeholder="Auto-calculated if left blank"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100"
                />
                <span className="mt-1.5 block text-xs text-slate-400">
                  Optional. Defaults to Start Time + Calculated Duration ({slotsCount * Number(form.duration_minutes_per_entry || 0)} min). You can customize it if needed.
                </span>
              </label>

              {conflicts.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                  <div className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" /> Time conflict detected</div>
                  <p className="mt-1">{conflicts.length} program(s) overlap on this stage:</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5">
                    {conflicts.map((program) => <li key={program.id}>{program.name} — {formatDateTime(program.start_time)}</li>)}
                  </ul>
                  <p className="mt-2 italic">You can still save; this warning helps you resolve the clash.</p>
                </div>
              )}

              {error && <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

              <div className="flex items-center justify-between border-t border-slate-100 pt-5">
                <button
                  type="button"
                  disabled={saving || !editing.start_time}
                  onClick={clearSchedule}
                  className="text-sm font-semibold text-red-600 hover:text-red-700 disabled:opacity-40"
                >
                  Clear schedule
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={(e) => save(e, true)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 transition-colors shadow-2xs"
                  >
                    <Eye className="h-4 w-4" />
                    <span>Save &amp; Preview PDF</span>
                  </button>
                  <button
                    disabled={saving}
                    className="rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 shadow-2xs"
                  >
                    {saving ? 'Saving…' : 'Save schedule'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PDF Quick Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 sm:p-6 backdrop-blur-sm">
          <div className="flex h-[92vh] w-full max-w-5xl flex-col rounded-2xl bg-white shadow-2xl overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
              <div className="flex items-center space-x-2.5">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
                <h3 className="text-base font-bold text-slate-900">Schedule PDF Live Preview</h3>
                <span className="text-xs text-slate-500 font-medium">({event?.title || 'Event Schedule'})</span>
              </div>
              <div className="flex items-center space-x-2">
                {pdfUrl && (
                  <a
                    href={pdfUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-indigo-600 hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    <span>New Tab</span>
                  </a>
                )}
                <button
                  onClick={loadPdfPreview}
                  disabled={loadingPdf}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-600 hover:bg-indigo-50 border border-indigo-200 transition-colors"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingPdf ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button
                  onClick={() => download('pdf')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-2xs"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={() => setPreviewModalOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 ml-2"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 bg-slate-900/5 relative overflow-hidden">
              {loadingPdf ? (
                <div className="flex h-full w-full flex-col items-center justify-center space-y-3 bg-white">
                  <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600"></div>
                  <p className="text-sm font-semibold text-slate-700">Loading schedule PDF preview...</p>
                </div>
              ) : pdfUrl ? (
                <iframe
                  src={`${pdfUrl}#toolbar=1&navpanes=0`}
                  title="Schedule PDF Modal Preview"
                  className="h-full w-full border-0"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center space-y-3 bg-white text-center p-8">
                  <FileText className="h-12 w-12 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-700">No PDF preview available</p>
                  <button
                    onClick={loadPdfPreview}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                  >
                    Generate PDF Preview
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventSchedule;
