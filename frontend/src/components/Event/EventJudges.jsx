import React, { useState, useEffect, useMemo } from 'react';
import { 
  Scale, 
  Plus, 
  Edit, 
  Trash2, 
  Mail, 
  Phone, 
  Copy, 
  Check, 
  QrCode, 
  Send, 
  RefreshCw, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  BookOpen, 
  Search,
  Sparkles,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  ChevronDown,
  MoreVertical,
  Users,
  Eye,
  Lock,
  Unlock,
  Layers,
  HelpCircle,
  UserCheck
} from 'lucide-react';
import { eventJudgesAPI, eventProgramsAPI } from '../../services/api';

const EventJudges = ({ event, eventId, onRefresh, categories = [] }) => {
  const actualEventId = eventId || event?.id;
  const [judges, setJudges] = useState([]);
  const [programs, setPrograms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);

  // Active view tab: 'judges' or 'live_evaluations'
  const [activeView, setActiveView] = useState('judges');

  // Search state
  const [searchQuery, setSearchQuery] = useState('');

  // Add / Edit Modal state
  const [showJudgeModal, setShowJudgeModal] = useState(false);
  const [editingJudge, setEditingJudge] = useState(null);
  const [judgeForm, setJudgeForm] = useState({
    name: '',
    email: '',
    phone: '',
    designation: '',
    notes: '',
  });

  // Assign Programs Modal state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedJudgeForAssign, setSelectedJudgeForAssign] = useState(null);
  const [programAssignmentsState, setProgramAssignmentsState] = useState({}); // { [program_id]: boolean }
  const [programFilterSearch, setProgramFilterSearch] = useState('');
  const [programFilterCategory, setProgramFilterCategory] = useState('all');

  // QR Code Modal state
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrJudge, setQrJudge] = useState(null);
  const [qrSvg, setQrSvg] = useState('');
  const [loadingQr, setLoadingQr] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);

  // Action Menu dropdown state (by judge id)
  const [activeMenuJudgeId, setActiveMenuJudgeId] = useState(null);

  // Status message & loading tracking
  const [copiedTokenId, setCopiedTokenId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState({ text: '', type: '' });

  // Close menus on outside click
  useEffect(() => {
    const handleOutsideClick = () => setActiveMenuJudgeId(null);
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  useEffect(() => {
    if (actualEventId) {
      fetchJudges();
      fetchPrograms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actualEventId]);

  const showToast = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 4500);
  };

  const fetchJudges = async () => {
    try {
      setLoading(true);
      const res = await eventJudgesAPI.list(actualEventId);
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setJudges(data);

      try {
        const overviewRes = await eventJudgesAPI.getOverview(actualEventId);
        setOverview(overviewRes.data);
      } catch (err) {
        console.warn('Overview fetch error:', err);
      }
    } catch (err) {
      console.error('Failed to load judges:', err);
      showToast('Failed to load judges list', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchPrograms = async () => {
    try {
      const res = await eventProgramsAPI.getPrograms(actualEventId, 'page_size=500');
      const data = Array.isArray(res.data) ? res.data : (res.data.results || []);
      setPrograms(data);
    } catch (err) {
      console.error('Failed to load programs for assignment:', err);
    }
  };

  const handleOpenAddModal = () => {
    setEditingJudge(null);
    setJudgeForm({
      name: '',
      email: '',
      phone: '',
      designation: '',
      notes: '',
    });
    setShowJudgeModal(true);
  };

  const handleOpenEditModal = (judge) => {
    setEditingJudge(judge);
    setJudgeForm({
      name: judge.name,
      email: judge.email || '',
      phone: judge.phone || '',
      designation: judge.designation || '',
      notes: judge.notes || '',
    });
    setShowJudgeModal(true);
  };

  const handleSaveJudge = async (e) => {
    e.preventDefault();
    if (!judgeForm.name.trim()) {
      alert('Judge Name is required');
      return;
    }

    try {
      setActionLoading('save_judge');
      if (editingJudge) {
        await eventJudgesAPI.update(editingJudge.id, judgeForm);
        showToast(`Judge "${judgeForm.name}" updated successfully!`);
      } else {
        await eventJudgesAPI.create(actualEventId, judgeForm);
        showToast(`Judge "${judgeForm.name}" added successfully!`);
      }
      setShowJudgeModal(false);
      fetchJudges();
    } catch (err) {
      console.error('Failed to save judge:', err);
      const msg = err.response?.data?.error || err.response?.data?.detail || 'Failed to save judge.';
      showToast(msg, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteJudge = async (judge) => {
    if (!window.confirm(`Are you sure you want to remove judge "${judge.name}"? All their program assignments will be unlinked.`)) {
      return;
    }

    try {
      setActionLoading(`delete_${judge.id}`);
      await eventJudgesAPI.delete(judge.id);
      showToast(`Judge "${judge.name}" removed successfully!`);
      fetchJudges();
    } catch (err) {
      console.error('Failed to delete judge:', err);
      showToast('Failed to delete judge', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenAssignModal = (judge) => {
    setSelectedJudgeForAssign(judge);
    const initialMap = {};
    (judge.program_assignments || []).forEach((assg) => {
      initialMap[assg.program] = true;
    });
    setProgramAssignmentsState(initialMap);
    setProgramFilterSearch('');
    setProgramFilterCategory('all');
    setShowAssignModal(true);
  };

  const handleToggleProgram = (programId) => {
    setProgramAssignmentsState((prev) => ({
      ...prev,
      [programId]: !prev[programId],
    }));
  };

  const handleSelectAllPrograms = (onlineOnly = false) => {
    const next = {};
    programs.forEach((prog) => {
      if (onlineOnly && prog.judging_mode !== 'online') return;
      next[prog.id] = true;
    });
    setProgramAssignmentsState(next);
  };

  const handleClearAllPrograms = () => {
    setProgramAssignmentsState({});
  };

  const handleSaveProgramAssignments = async () => {
    if (!selectedJudgeForAssign) return;

    // Send simple list of assigned program IDs — backend auto-assigns the slot safely
    const assignments = Object.entries(programAssignmentsState)
      .filter(([, isAssigned]) => Boolean(isAssigned))
      .map(([programId]) => ({
        program_id: parseInt(programId, 10),
      }));

    try {
      setActionLoading('save_assignments');
      await eventJudgesAPI.assignPrograms(selectedJudgeForAssign.id, { assignments });
      showToast(`Competitions assigned successfully for ${selectedJudgeForAssign.name}!`);
      setShowAssignModal(false);
      fetchJudges();
    } catch (err) {
      console.error('Failed to save assignments:', err);
      showToast('Failed to save competition assignments', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCopyMagicLink = (judge) => {
    const origin = window.location.origin;
    const url = `${origin}/judge/eval/${judge.access_token}`;
    navigator.clipboard.writeText(url);
    setCopiedTokenId(judge.id);
    showToast('Magic Link copied to clipboard!');
    setTimeout(() => setCopiedTokenId(null), 3000);
  };

  const handleSendInviteEmail = async (judge) => {
    if (!judge.email) {
      alert('Please add an email address for this judge first.');
      handleOpenEditModal(judge);
      return;
    }

    try {
      setActionLoading(`invite_${judge.id}`);
      await eventJudgesAPI.sendInvite(judge.id);
      showToast(`Invitation email successfully sent to ${judge.email}!`);
    } catch (err) {
      console.error('Failed to send invite:', err);
      const msg = err.response?.data?.error || 'Failed to send invite email.';
      showToast(msg, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRegenerateCredentials = async (judge) => {
    if (!window.confirm(`Regenerate access link and PIN for "${judge.name}"? The previous link will stop working.`)) {
      return;
    }

    try {
      setActionLoading(`regen_${judge.id}`);
      await eventJudgesAPI.regenerateLink(judge.id);
      showToast('New credentials generated successfully!');
      fetchJudges();
    } catch (err) {
      console.error('Failed to regenerate credentials:', err);
      showToast('Failed to regenerate link', 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenQrModal = async (judge) => {
    setQrJudge(judge);
    setShowQrModal(true);
    setLoadingQr(true);
    setCopiedPin(false);
    try {
      const res = await eventJudgesAPI.getQrCode(judge.id);
      setQrSvg(res.data.qr_code_svg);
    } catch (err) {
      console.error('Failed to generate QR:', err);
      setQrSvg('');
    } finally {
      setLoadingQr(false);
    }
  };

  const handleCopyPin = (pin) => {
    if (!pin) return;
    navigator.clipboard.writeText(pin);
    setCopiedPin(true);
    setTimeout(() => setCopiedPin(false), 2000);
  };

  // Helper for Judge Initials / Avatar
  const getInitials = (name) => {
    if (!name) return 'J';
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Metrics calculation
  const onlineProgramsCount = useMemo(() => {
    return programs.filter(p => p.judging_mode === 'online').length;
  }, [programs]);

  const totalAssignmentsCount = useMemo(() => {
    return judges.reduce((sum, j) => sum + (j.program_assignments?.length || 0), 0);
  }, [judges]);

  // Filtered judges list
  const filteredJudges = useMemo(() => {
    return judges.filter((j) => {
      const q = searchQuery.toLowerCase().trim();
      const nameMatch = (j.name || '').toLowerCase().includes(q);
      const emailMatch = (j.email || '').toLowerCase().includes(q);
      const desigMatch = (j.designation || '').toLowerCase().includes(q);
      return !q || nameMatch || emailMatch || desigMatch;
    });
  }, [judges, searchQuery]);

  // Filtered programs for assignment modal
  const filteredModalPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchesSearch = p.name.toLowerCase().includes(programFilterSearch.toLowerCase());
      const matchesCategory = programFilterCategory === 'all' || p.category === programFilterCategory;
      return matchesSearch && matchesCategory;
    });
  }, [programs, programFilterSearch, programFilterCategory]);

  const selectedProgramsCount = useMemo(() => {
    return Object.values(programAssignmentsState).filter(Boolean).length;
  }, [programAssignmentsState]);

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-[#f7f8fb] min-h-[620px] relative">
      
      {/* Toast Notification */}
      {message.text && (
        <div className={`p-4 rounded-xl flex items-center justify-between text-xs font-semibold shadow-2xs animate-fadeIn ${
          message.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        }`}>
          <div className="flex items-center gap-2">
            {message.type === 'error' ? <AlertCircle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
            <span>{message.text}</span>
          </div>
          <button onClick={() => setMessage({ text: '', type: '' })} className="text-gray-400 hover:text-gray-600 cursor-pointer">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. HEADER CARD BOX                                                        */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              Evaluation & Judging
            </span>
            <span className="text-slate-300">·</span>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Blind Anonymous Protocol</span>
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
            Judges & Digital Evaluations
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Configure judge panel, assign competitions, open tablet score sheets with PINs, and monitor evaluations in real-time.
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            onClick={fetchJudges}
            disabled={loading}
            title="Refresh judges list"
            className="flex items-center space-x-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-gray-500'}`} />
            <span>Refresh</span>
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Judge</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ALIGNED METRIC STAT BOXES                                              */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Box 1: Total Judges */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Total Judges
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {judges.length}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-normal">
              Active evaluation panel
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Scale className="w-5 h-5" />
          </div>
        </div>

        {/* Box 2: Online Programs */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Online Programs
            </span>
            <span className="text-xl sm:text-2xl font-black text-indigo-600">
              {onlineProgramsCount} <span className="text-xs font-semibold text-slate-400">/ {programs.length}</span>
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-normal">
              Digital tablet judging
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-100 flex items-center justify-center text-purple-600 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
        </div>

        {/* Box 3: Total Program Assignments */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Assignments
            </span>
            <span className="text-xl sm:text-2xl font-black text-slate-900">
              {totalAssignmentsCount}
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-normal">
              Judge-competition pairs
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <BookOpen className="w-5 h-5" />
          </div>
        </div>

        {/* Box 4: Blind Protocol Security */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
              Protocol Security
            </span>
            <span className="text-sm sm:text-base font-extrabold text-emerald-700 block mt-0.5">
              Blind Anonymous
            </span>
            <span className="text-[11px] text-slate-500 block mt-0.5 font-normal">
              Names & teams hidden
            </span>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. TABS / VIEW SWITCHER + CLEAN SEARCH BAR                                */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
        
        {/* View Switcher Pills */}
        <div className="flex items-center gap-1 bg-slate-100/80 p-1 rounded-xl self-start">
          <button
            type="button"
            onClick={() => setActiveView('judges')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'judges'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Judges Panel ({judges.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveView('live_evaluations')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeView === 'live_evaluations'
                ? 'bg-white text-indigo-700 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Live Evaluations Overview</span>
          </button>
        </div>

        {/* Clean Search Input (Active in Judges View) */}
        {activeView === 'judges' && (
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search judges by name or title..."
              className="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 shadow-2xs"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* 4. VIEW A: JUDGES PANEL (PROPERLY ALIGNED TABLE & CARDS - NO SLOTS)       */}
      {/* ========================================================================= */}
      {activeView === 'judges' && (
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
          
          {loading ? (
            <div className="py-20 text-center text-xs text-slate-500">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-indigo-600 mb-2" />
              <span>Loading judges and assignments...</span>
            </div>
          ) : filteredJudges.length === 0 ? (
            <div className="py-16 text-center px-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Scale className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">
                {searchQuery ? 'No Matching Judges Found' : 'No Judges Configured Yet'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                {searchQuery
                  ? 'Try clearing your search query to view all evaluators.'
                  : 'Add your evaluation panel to open score sheets on physical tablets with automatic mark sync.'}
              </p>
              {!searchQuery && (
                <button
                  onClick={handleOpenAddModal}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition shadow-2xs cursor-pointer"
                >
                  <Plus className="h-4 w-4" /> Add First Judge
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100">
                  <thead className="bg-gray-50/70 border-b border-gray-100">
                    <tr>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-700">Judge Profile</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-700">Contact</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-700">Assigned Competitions</th>
                      <th className="px-5 py-3.5 text-left text-xs font-bold text-gray-700">Tablet Magic Link &amp; PIN</th>
                      <th className="px-5 py-3.5 text-right text-xs font-bold text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {filteredJudges.map((judge) => {
                      const assignedCount = judge.program_assignments?.length || 0;

                      return (
                        <tr key={judge.id} className="hover:bg-slate-50/70 transition-colors">
                          
                          {/* Judge Profile Column */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                                {getInitials(judge.name)}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold text-gray-900 truncate">
                                  {judge.name}
                                </div>
                                <div className="text-[11px] text-gray-500 truncate">
                                  {judge.designation || 'Official Evaluator'}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Contact Column */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="space-y-0.5 text-xs">
                              {judge.email ? (
                                <div className="flex items-center gap-1.5 text-gray-700 font-medium">
                                  <Mail className="h-3 w-3 text-gray-400 shrink-0" />
                                  <span className="truncate max-w-[180px]">{judge.email}</span>
                                </div>
                              ) : (
                                <div className="text-slate-400 text-[11px] font-normal">
                                  — No email —
                                </div>
                              )}
                              {judge.phone && (
                                <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                                  <Phone className="h-3 w-3 text-gray-400 shrink-0" />
                                  <span>{judge.phone}</span>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Assignments Column */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenAssignModal(judge)}
                              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80 transition cursor-pointer"
                              title="Click to assign competition programs"
                            >
                              <BookOpen className="h-3.5 w-3.5 text-slate-500" />
                              <span>{assignedCount} {assignedCount === 1 ? 'Competition' : 'Competitions'}</span>
                            </button>
                          </td>

                          {/* Portal Link & PIN Column */}
                          <td className="px-5 py-4 whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {/* Monospace PIN */}
                              <div className="px-2.5 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800" title="Device security PIN">
                                PIN: {judge.access_pin || '----'}
                              </div>

                              {/* Copy Magic Link */}
                              <button
                                onClick={() => handleCopyMagicLink(judge)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer"
                                title="Copy tablet magic link"
                              >
                                {copiedTokenId === judge.id ? (
                                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </button>

                              {/* Open QR Modal */}
                              <button
                                onClick={() => handleOpenQrModal(judge)}
                                className="p-1.5 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition shadow-2xs cursor-pointer"
                                title="Show QR code for tablet camera scan"
                              >
                                <QrCode className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </td>

                          {/* Actions Column */}
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Assign Competitions Button */}
                              <button
                                onClick={() => handleOpenAssignModal(judge)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition shadow-2xs flex items-center gap-1 cursor-pointer"
                              >
                                <span>Assign</span>
                              </button>

                              {/* Send Invite Button */}
                              <button
                                onClick={() => handleSendInviteEmail(judge)}
                                disabled={actionLoading === `invite_${judge.id}`}
                                className="px-2.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold transition shadow-2xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                title="Optional: send email invite"
                              >
                                <Send className="h-3 w-3" />
                                <span>{actionLoading === `invite_${judge.id}` ? 'Sending...' : 'Invite'}</span>
                              </button>

                              {/* More Dropdown Menu */}
                              <div className="relative inline-block text-left">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveMenuJudgeId(activeMenuJudgeId === judge.id ? null : judge.id);
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                  aria-label="More options"
                                >
                                  <MoreVertical className="h-4 w-4" />
                                </button>

                                {activeMenuJudgeId === judge.id && (
                                  <div
                                    onClick={(e) => e.stopPropagation()}
                                    className="absolute right-0 mt-1 w-44 rounded-xl bg-white border border-slate-200 shadow-xl py-1 z-30 animate-in fade-in zoom-in-95"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuJudgeId(null);
                                        handleOpenEditModal(judge);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Edit className="h-3.5 w-3.5 text-slate-400" />
                                      <span>Edit Profile</span>
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuJudgeId(null);
                                        handleRegenerateCredentials(judge);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      <RefreshCw className="h-3.5 w-3.5 text-slate-400" />
                                      <span>Regenerate Link & PIN</span>
                                    </button>

                                    <div className="my-1 border-t border-slate-100" />

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setActiveMenuJudgeId(null);
                                        handleDeleteJudge(judge);
                                      }}
                                      className="w-full text-left px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 flex items-center gap-2 cursor-pointer"
                                    >
                                      <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                                      <span>Remove Judge</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile / Tablet Cards View (lg:hidden) */}
              <div className="lg:hidden divide-y divide-gray-100">
                {filteredJudges.map((judge) => {
                  const assignedCount = judge.program_assignments?.length || 0;

                  return (
                    <div key={judge.id} className="p-4 space-y-3">
                      {/* Top Row: Avatar & Name */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-3 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                            {getInitials(judge.name)}
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-xs font-bold text-gray-900 truncate">{judge.name}</h3>
                            <p className="text-[11px] text-gray-500 truncate">{judge.designation || 'Official Evaluator'}</p>
                          </div>
                        </div>

                        <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md shrink-0">
                          {assignedCount} Competitions
                        </span>
                      </div>

                      {/* Contact & PIN Info Row */}
                      <div className="grid grid-cols-2 gap-2 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Contact</span>
                          <span className="text-[11px] font-medium text-slate-700 truncate block mt-0.5">
                            {judge.email || judge.phone || 'No contact set'}
                          </span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Device PIN</span>
                          <span className="text-xs font-mono font-bold text-indigo-900 block mt-0.5">
                            {judge.access_pin || '----'}
                          </span>
                        </div>
                      </div>

                      {/* Actions Bar */}
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <button
                          onClick={() => handleOpenAssignModal(judge)}
                          className="flex-1 py-1.5 px-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold transition text-center shadow-2xs cursor-pointer flex items-center justify-center gap-1"
                        >
                          <BookOpen className="w-3.5 h-3.5" />
                          <span>Assign</span>
                        </button>

                        <button
                          onClick={() => handleCopyMagicLink(judge)}
                          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                          title="Copy Link"
                        >
                          {copiedTokenId === judge.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>

                        <button
                          onClick={() => handleOpenQrModal(judge)}
                          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                          title="Show QR Code"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleOpenEditModal(judge)}
                          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition shadow-2xs cursor-pointer"
                          title="Edit"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>

                        <button
                          onClick={() => handleDeleteJudge(judge)}
                          className="p-2 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 transition shadow-2xs cursor-pointer"
                          title="Remove"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. VIEW B: LIVE PROGRAM EVALUATIONS OVERVIEW TABLE                        */}
      {/* ========================================================================= */}
      {activeView === 'live_evaluations' && (
        <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between bg-white">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Live Competitions &amp; Judge Status
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Real-time evaluation status showing assigned judges and submissions for each competition.
              </p>
            </div>
            <button
              onClick={fetchJudges}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Refresh Status</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/70 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-700">Competition</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-700">Mode</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-700">Judges Assigned</th>
                  <th className="px-5 py-3 text-left text-xs font-bold text-gray-700">Assigned Evaluators &amp; Live Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white text-xs">
                {(overview?.programs || programs).map((prog) => {
                  const assignedJudges = prog.assigned_judges || [];
                  const neededJudges = prog.effective_num_judges || prog.num_judges || event?.num_judges || 3;

                  return (
                    <tr key={prog.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="font-bold text-gray-900">{prog.name}</div>
                        <div className="text-[11px] text-gray-400">
                          {prog.category_display || prog.category?.toUpperCase()} · {prog.is_team_based ? 'Group' : 'Individual'}
                        </div>
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {prog.judging_mode === 'online' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            <Sparkles className="h-2.5 w-2.5" /> Online
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium bg-gray-100 text-gray-600 border border-gray-200">
                            Offline
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 whitespace-nowrap text-slate-600 font-semibold">
                        <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                          assignedJudges.length >= neededJudges
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {assignedJudges.length} / {neededJudges} Assigned
                        </span>
                      </td>

                      <td className="px-5 py-3.5">
                        {assignedJudges.length === 0 ? (
                          <span className="text-gray-400 text-xs italic">
                            No evaluators assigned yet
                          </span>
                        ) : (
                          <div className="flex items-center gap-2 flex-wrap">
                            {assignedJudges.map((aj) => (
                              <span
                                key={aj.assignment_id || aj.judge_id}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                                  aj.is_locked
                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                                    : aj.status === 'in_progress'
                                    ? 'bg-amber-50 text-amber-800 border-amber-200'
                                    : 'bg-slate-50 text-slate-700 border-slate-200'
                                }`}
                              >
                                <span className={`w-2 h-2 rounded-full ${
                                  aj.is_locked ? 'bg-emerald-500' : aj.status === 'in_progress' ? 'bg-amber-500' : 'bg-slate-300'
                                }`} />
                                <span>{aj.judge_name}</span>
                                <span className="text-[10px] font-bold uppercase text-slate-500">
                                  [{aj.is_locked ? 'Submitted' : aj.status}]
                                </span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. MODAL: ADD / EDIT JUDGE PROFILE (NO MANUAL SLOTS NEEDED)               */}
      {/* ========================================================================= */}
      {showJudgeModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl border border-gray-200 overflow-hidden animate-scaleUp">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
                  <Scale className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    {editingJudge ? 'Edit Judge Profile' : 'Add New Judge'}
                  </h3>
                  <p className="text-xs text-gray-500">Enter judge evaluator details</p>
                </div>
              </div>
              <button
                onClick={() => setShowJudgeModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveJudge} className="p-6 space-y-4">
              {/* Name Input */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Judge Full Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Dr. A. Rahman"
                  value={judgeForm.name}
                  onChange={(e) => setJudgeForm({ ...judgeForm, name: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Designation / Title */}
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Designation / Title</label>
                <input
                  type="text"
                  placeholder="e.g. Senior Vocalist, External Expert"
                  value={judgeForm.designation}
                  onChange={(e) => setJudgeForm({ ...judgeForm, designation: e.target.value })}
                  className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                />
              </div>

              {/* Email & Phone Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address (Optional)</label>
                  <input
                    type="email"
                    placeholder="judge@example.com"
                    value={judgeForm.email}
                    onChange={(e) => setJudgeForm({ ...judgeForm, email: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                  <span className="text-[10px] text-gray-400 mt-1 block">Only needed if sending email invites</span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Phone Number (Optional)</label>
                  <input
                    type="tel"
                    placeholder="+91 9876543210"
                    value={judgeForm.phone}
                    onChange={(e) => setJudgeForm({ ...judgeForm, phone: e.target.value })}
                    className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-gray-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowJudgeModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading === 'save_judge'}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'save_judge' ? 'Saving...' : editingJudge ? 'Save Changes' : 'Create Judge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODAL: ASSIGN COMPETITIONS (SIMPLE CHECKLIST - NO SLOTS NEEDED)        */}
      {/* ========================================================================= */}
      {showAssignModal && selectedJudgeForAssign && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl border border-gray-200 overflow-hidden flex flex-col max-h-[88vh] animate-scaleUp">
            
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-slate-50/70 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
                  {getInitials(selectedJudgeForAssign.name)}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">
                    Assign Competitions: {selectedJudgeForAssign.name}
                  </h3>
                  <p className="text-xs text-gray-500">
                    Select which competitions this judge will evaluate on their tablet.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAssignModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Filter and Quick Select Actions Bar */}
            <div className="px-6 py-3 border-b border-gray-100 bg-white flex flex-wrap items-center justify-between gap-3 shrink-0">
              {/* Search & Category Filter */}
              <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                <div className="relative flex-1">
                  <Search className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    placeholder="Search competitions..."
                    value={programFilterSearch}
                    onChange={(e) => setProgramFilterSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                  />
                </div>

                <div className="relative">
                  <select
                    value={programFilterCategory}
                    onChange={(e) => setProgramFilterCategory(e.target.value)}
                    className="appearance-none pl-3 pr-7 py-1.5 text-xs font-semibold border border-gray-200 rounded-xl bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="all">All Categories</option>
                    {categories.map((cat) => (
                      <option key={cat.code || cat.id} value={cat.code || cat.id}>
                        {cat.name || cat.code?.toUpperCase()}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {/* Bulk Select Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleSelectAllPrograms(true)}
                  className="px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-200 transition cursor-pointer"
                >
                  Select Online Only
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectAllPrograms(false)}
                  className="px-2.5 py-1 text-[11px] font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition cursor-pointer"
                >
                  Select All
                </button>
                <button
                  type="button"
                  onClick={handleClearAllPrograms}
                  className="px-2.5 py-1 text-[11px] font-semibold text-gray-500 hover:text-gray-700 transition cursor-pointer"
                >
                  Clear All
                </button>
              </div>
            </div>

            {/* Programs List - Simple, Clean Checklist */}
            <div className="p-6 overflow-y-auto space-y-2 flex-1 divide-y divide-gray-50">
              {filteredModalPrograms.length === 0 ? (
                <div className="py-12 text-center text-xs text-gray-500">
                  No matching competition programs found.
                </div>
              ) : (
                filteredModalPrograms.map((prog) => {
                  const isAssigned = Boolean(programAssignmentsState[prog.id]);

                  return (
                    <div
                      key={prog.id}
                      onClick={() => handleToggleProgram(prog.id)}
                      className={`pt-2.5 pb-2.5 px-3 rounded-xl transition flex items-center justify-between gap-3 cursor-pointer ${
                        isAssigned ? 'bg-indigo-50/60 border border-indigo-200/80 shadow-2xs' : 'hover:bg-gray-50 border border-transparent'
                      }`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer flex-1 min-w-0" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isAssigned}
                          onChange={() => handleToggleProgram(prog.id)}
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-900 truncate">{prog.name}</span>
                            {prog.judging_mode === 'online' ? (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-50 text-purple-700 border border-purple-200 shrink-0">
                                <Sparkles className="h-2.5 w-2.5" /> Online
                              </span>
                            ) : (
                              <span className="inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium bg-gray-100 text-gray-600 border border-gray-200 shrink-0">
                                Offline
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-500 mt-0.5 truncate">
                            {prog.category_display || prog.category?.toUpperCase()} · {prog.is_team_based ? 'Group' : 'Individual'} · {prog.effective_num_judges || prog.num_judges || event?.num_judges || 3} Judges needed
                          </div>
                        </div>
                      </label>

                      {isAssigned && (
                        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/60 px-2 py-0.5 rounded-md shrink-0">
                          Assigned
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-3.5 border-t border-gray-100 bg-slate-50/70 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold text-gray-700">
                {selectedProgramsCount} Competitions Selected
              </span>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-100 rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveProgramAssignments}
                  disabled={actionLoading === 'save_assignments'}
                  className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition shadow-2xs cursor-pointer disabled:opacity-50"
                >
                  {actionLoading === 'save_assignments' ? 'Saving...' : 'Save Assignments'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 8. MODAL: QR CODE & MOBILE EVALUATION SCAN                                */}
      {/* ========================================================================= */}
      {showQrModal && qrJudge && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-gray-200 overflow-hidden animate-scaleUp p-6 text-center">
            
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-1.5 text-xs font-bold text-gray-900">
                <Smartphone className="h-4 w-4 text-indigo-600" />
                <span>Tablet Evaluation Scan</span>
              </div>
              <button
                onClick={() => setShowQrModal(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="text-center mb-3">
              <h4 className="text-sm font-bold text-gray-900">{qrJudge.name}</h4>
              <p className="text-xs text-gray-500">{event?.title}</p>
            </div>

            {/* QR SVG Container */}
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-2xl mx-auto inline-block mb-3 min-w-[220px] min-h-[220px] flex items-center justify-center shadow-2xs">
              {loadingQr ? (
                <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
              ) : qrSvg ? (
                <div dangerouslySetInnerHTML={{ __html: qrSvg }} />
              ) : (
                <span className="text-xs text-red-500">Failed to render QR Code</span>
              )}
            </div>

            {/* PIN Card with Copy */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 mb-4 flex items-center justify-between">
              <div className="text-left">
                <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">Device Security PIN</div>
                <div className="text-lg font-mono font-black text-indigo-950 tracking-widest">{qrJudge.access_pin}</div>
              </div>
              <button
                type="button"
                onClick={() => handleCopyPin(qrJudge.access_pin)}
                className="px-2.5 py-1.5 bg-white border border-indigo-200 hover:bg-indigo-100/50 rounded-lg text-xs font-bold text-indigo-700 shadow-2xs transition cursor-pointer flex items-center gap-1"
              >
                {copiedPin ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPin ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-[11px] text-gray-500 leading-snug">
              Point your smartphone or tablet camera at this code to open the score sheet instantly. No app installation required.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventJudges;
