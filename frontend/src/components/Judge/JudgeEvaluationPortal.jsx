import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Scale, 
  CheckCircle2, 
  AlertCircle, 
  Clock, 
  MapPin, 
  Save, 
  Lock, 
  ArrowLeft, 
  ShieldCheck, 
  KeyRound, 
  Sparkles, 
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronsUpDown,
  Music,
  RefreshCw,
  Award,
  Check,
  AlertTriangle,
  LayoutDashboard,
  BookOpen,
  Search,
  Calendar,
  Layers,
  HelpCircle,
  Menu,
  X,
  Home,
  Settings,
  Trophy,
  User,
  Sliders,
  CheckCheck
} from 'lucide-react';
import EventlooLogo, { EventlooIcon } from '../common/EventlooLogo';
import { judgePortalAPI } from '../../services/api';

const JudgeEvaluationPortal = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [portalData, setPortalData] = useState(null);

  // PIN verification state
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [pinDigits, setPinDigits] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState('');
  const [verifyingPin, setVerifyingPin] = useState(false);
  const [focusedPinIndex, setFocusedPinIndex] = useState(0);
  const inputRefs = useRef([]);

  // Active view: 'portal' (dashboard/judgement layout) or 'eval' (scoring sheet)
  const [activeView, setActiveView] = useState('portal');
  const [activeNav, setActiveNav] = useState('dashboard'); // 'dashboard' | 'judgement'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'pending' | 'submitted'

  // Score sheet state
  const [scoreSheetData, setScoreSheetData] = useState(null);
  const [loadingSheet, setLoadingSheet] = useState(false);
  const [candidatesScores, setCandidatesScores] = useState({}); // { [result_id]: { mark: '', comments: '' } }
  const [selectedCandidateIndex, setSelectedCandidateIndex] = useState(0);
  const [savingMarks, setSavingMarks] = useState(false);
  const [saveStatusMessage, setSaveStatusMessage] = useState({ text: '', type: '' });
  const [showLockConfirmModal, setShowLockConfirmModal] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Evaluation token is missing.');
      setLoading(false);
      return;
    }

    // Check if PIN was already verified in this session
    const verifiedCache = sessionStorage.getItem(`judge_pin_${token}`);
    const searchParams = new URLSearchParams(window.location.search);
    if (verifiedCache === 'true' || searchParams.get('verified') === 'true') {
      setIsPinVerified(true);
    }
    if (searchParams.get('tab')) {
      setActiveNav(searchParams.get('tab'));
    }
    if (searchParams.get('menu') === 'open') {
      setSidebarOpen(true);
    }

    loadPortalInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (portalData && (isPinVerified || !portalData.judge?.requires_pin)) {
      const searchParams = new URLSearchParams(window.location.search);
      const progParam = searchParams.get('program') || searchParams.get('programId');
      if (progParam && selectedProgramId !== Number(progParam)) {
        handleSelectProgram(Number(progParam));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [portalData, isPinVerified]);

  const showToast = (text, type = 'success') => {
    setSaveStatusMessage({ text, type });
    setTimeout(() => setSaveStatusMessage({ text: '', type: '' }), 4000);
  };

  const loadPortalInfo = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await judgePortalAPI.getPortalInfo(token);
      setPortalData(res.data);

      // If judge does not require PIN, mark as verified automatically
      if (!res.data.judge.requires_pin) {
        setIsPinVerified(true);
      }
    } catch (err) {
      console.error('Portal load error:', err);
      const msg = err.response?.data?.error || 'Invalid or expired judge evaluation link.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isPinVerified && portalData?.judge?.requires_pin) {
      const timer = setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isPinVerified, portalData]);

  const handleDigitChange = (index, value) => {
    const cleaned = value.replace(/\D/g, '');
    if (!cleaned) {
      const next = [...pinDigits];
      next[index] = '';
      setPinDigits(next);
      setPinError('');
      return;
    }

    const digit = cleaned.slice(-1);
    const next = [...pinDigits];
    next[index] = digit;
    setPinDigits(next);
    setPinError('');

    if (index < 3) {
      inputRefs.current[index + 1]?.focus();
    } else {
      const fullCode = next.join('');
      if (fullCode.length === 4) {
        handleVerifyPin(null, fullCode);
      }
    }
  };

  const handleDigitKeyDown = (index, e) => {
    if (e.key === 'Backspace') {
      if (!pinDigits[index] && index > 0) {
        inputRefs.current[index - 1]?.focus();
        const next = [...pinDigits];
        next[index - 1] = '';
        setPinDigits(next);
      } else {
        const next = [...pinDigits];
        next[index] = '';
        setPinDigits(next);
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4);
    if (!pasted) return;

    const next = ['', '', '', ''];
    for (let i = 0; i < pasted.length; i++) {
      next[i] = pasted[i];
    }
    setPinDigits(next);
    setPinError('');

    if (pasted.length === 4) {
      inputRefs.current[3]?.focus();
      handleVerifyPin(null, pasted);
    } else {
      inputRefs.current[Math.min(pasted.length, 3)]?.focus();
    }
  };

  const handleVerifyPin = async (e, digitsToVerify) => {
    if (e && e.preventDefault) e.preventDefault();
    const code = (typeof digitsToVerify === 'string' ? digitsToVerify : pinDigits.join('')).trim();
    if (code.length !== 4) {
      setPinError('Please enter all 4 digits of your Security PIN.');
      return;
    }

    try {
      setVerifyingPin(true);
      setPinError('');
      await judgePortalAPI.verifyPin(token, code);
      sessionStorage.setItem(`judge_pin_${token}`, 'true');
      setIsPinVerified(true);
    } catch (err) {
      console.error('PIN verification error:', err);
      const msg = err.response?.data?.message || err.response?.data?.error || 'Incorrect PIN. Please verify your invitation.';
      setPinError(msg);
      setPinDigits(['', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setVerifyingPin(false);
    }
  };

  const handleGoBack = () => {
    setActiveView('portal');
    setActiveNav('judgement');
    const url = new URL(window.location.href);
    url.searchParams.delete('program');
    url.searchParams.delete('programId');
    url.searchParams.delete('index');
    window.history.replaceState({}, '', url.toString());
    loadPortalInfo();
  };

  const handleSelectProgram = async (programId) => {
    setSelectedProgramId(programId);
    const searchParams = new URLSearchParams(window.location.search);
    const initIdx = searchParams.get('index') ? parseInt(searchParams.get('index'), 10) : 0;
    setSelectedCandidateIndex(isNaN(initIdx) ? 0 : initIdx);
    setActiveView('eval');
    setLoadingSheet(true);
    setSaveStatusMessage({ text: '', type: '' });

    try {
      const res = await judgePortalAPI.getScoreSheet(token, programId);
      setScoreSheetData(res.data);

      // Initialize candidate scores
      const initialMap = {};
      (res.data.candidates || []).forEach((c) => {
        initialMap[c.result_id] = {
          mark: c.current_mark !== null && c.current_mark !== undefined ? String(c.current_mark) : '',
          comments: c.comments || '',
        };
      });
      setCandidatesScores(initialMap);
    } catch (err) {
      console.error('Error loading score sheet:', err);
      showToast(err.response?.data?.error || 'Failed to load score sheet', 'error');
    } finally {
      setLoadingSheet(false);
    }
  };

  const handleScoreChange = (resultId, rawValue) => {
    const maxMark = scoreSheetData?.criteria?.max_mark_per_judge || 100;
    
    // Clear if empty
    if (rawValue === '' || rawValue === null || rawValue === undefined) {
      setCandidatesScores((prev) => ({
        ...prev,
        [resultId]: { ...prev[resultId], mark: '' },
      }));
      return;
    }

    // Only allow decimals up to 2 places
    const cleanStr = String(rawValue).trim();
    if (!/^\d*(\.\d{0,2})?$/.test(cleanStr)) {
      return;
    }

    const num = parseFloat(cleanStr);
    if (!isNaN(num) && num > maxMark) {
      return;
    }

    setCandidatesScores((prev) => ({
      ...prev,
      [resultId]: { ...prev[resultId], mark: cleanStr },
    }));
  };

  const handleCommentsChange = (resultId, comments) => {
    setCandidatesScores((prev) => ({
      ...prev,
      [resultId]: { ...prev[resultId], comments },
    }));
  };

  const handleSaveScores = async (isFinalLock = false) => {
    if (!selectedProgramId) return;

    const maxMark = scoreSheetData?.criteria?.max_mark_per_judge || 100;

    // Validate marks before saving
    const marksPayload = Object.keys(candidatesScores).map((resultId) => {
      const entry = candidatesScores[resultId];
      const val = entry?.mark;
      return {
        result_id: parseInt(resultId, 10),
        mark: val !== '' && val !== null && !isNaN(val) ? parseFloat(val) : null,
        comments: entry?.comments || '',
      };
    });

    if (isFinalLock) {
      const candidates = scoreSheetData?.candidates || [];
      const unscored = candidates.filter((c) => {
        const val = candidatesScores[c.result_id]?.mark;
        return val === '' || val === null || val === undefined;
      });

      if (unscored.length > 0) {
        const confirmAll = window.confirm(
          `There are ${unscored.length} candidate(s) without a score. Do you want to submit and lock anyway?`
        );
        if (!confirmAll) return;
      }
    }

    try {
      setSavingMarks(true);
      const res = await judgePortalAPI.saveMarks(token, selectedProgramId, {
        marks: marksPayload,
        is_final_lock: isFinalLock,
      });

      showToast(res.data.message || (isFinalLock ? 'Evaluation locked & submitted!' : 'Draft scores saved!'));

      if (isFinalLock) {
        setShowLockConfirmModal(false);
      }

      // Refresh sheet data
      const refreshedSheet = await judgePortalAPI.getScoreSheet(token, selectedProgramId);
      setScoreSheetData(refreshedSheet.data);

      // Refresh portal list data in background
      loadPortalInfo();
    } catch (err) {
      console.error('Error saving scores:', err);
      const errMsg = err.response?.data?.error || 'Failed to save scores.';
      showToast(errMsg, 'error');
    } finally {
      setSavingMarks(false);
    }
  };

  const { judge, event: eventData, programs = [] } = portalData || {};

  // Evaluation stats in score sheet
  const scoredCount = useMemo(() => {
    return Object.values(candidatesScores).filter((c) => c?.mark !== '' && c?.mark !== null && !isNaN(c?.mark)).length;
  }, [candidatesScores]);

  // Derived metrics for Dashboard
  const completedCount = useMemo(() => {
    return programs.filter((p) => p.assignment?.is_locked).length;
  }, [programs]);

  const pendingCount = useMemo(() => {
    return programs.filter((p) => !p.assignment?.is_locked).length;
  }, [programs]);

  const inProgressCount = useMemo(() => {
    return programs.filter((p) => !p.assignment?.is_locked && (p.evaluated_count || 0) > 0).length;
  }, [programs]);

  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const isLocked = Boolean(p.assignment?.is_locked);
      if (statusFilter === 'pending' && isLocked) return false;
      if (statusFilter === 'submitted' && !isLocked) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = (p.name || '').toLowerCase().includes(query);
        const matchesCategory = (p.category_display || '').toLowerCase().includes(query);
        const matchesVenue = (p.venue || '').toLowerCase().includes(query);
        if (!matchesName && !matchesCategory && !matchesVenue) return false;
      }
      return true;
    });
  }, [programs, statusFilter, searchQuery]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center p-4">
        <div className="text-center text-slate-700 space-y-3">
          <RefreshCw className="h-7 w-7 animate-spin text-indigo-600 mx-auto" />
          <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Loading Evaluation Portal...</h2>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-[#f7f8fb] flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200/80 max-w-md w-full rounded-2xl p-6 sm:p-8 text-center text-slate-900 shadow-2xs">
          <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4 border border-rose-100">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Portal Access Denied</h2>
          <p className="text-xs text-slate-500 mt-2 mb-6 leading-relaxed">{error}</p>
          <p className="text-[11px] text-slate-400">
            Please ask the event administrator to provide an updated link or invitation.
          </p>
        </div>
      </div>
    );
  }

  // PIN Verification Screen (1:1 Reference Match)
  if (!isPinVerified && judge?.requires_pin) {
    const fullPin = pinDigits.join('');
    return (
      <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#f8f9fc] flex flex-col items-center justify-center p-4 sm:p-6 select-none font-sans">
        {/* Main Card */}
        <div className="bg-white border border-slate-100 max-w-[390px] sm:max-w-[420px] w-full rounded-[28px] sm:rounded-[32px] px-6 py-8 sm:px-9 sm:py-10 text-slate-900 shadow-[0_16px_50px_rgba(20,15,60,0.05)] mx-auto">
          <div className="text-center">
            {/* Squircle Key Icon */}
            <div className="w-14 h-14 rounded-2xl bg-[#eeecfc] text-[#4f35d2] flex items-center justify-center mx-auto mb-3.5 border border-[#e2defa]/70 shadow-2xs">
              <KeyRound className="w-7 h-7 stroke-[2.2]" />
            </div>

            {/* Security Verification Pill Badge */}
            <span className="inline-block text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-[#4f35d2] bg-[#f0edfc] px-3.5 py-1 rounded-full border border-[#ded8f9]">
              Security Verification
            </span>

            {/* Welcome Heading */}
            <h1 className="text-2xl sm:text-[26px] font-extrabold text-[#0b132b] mt-3 tracking-tight">
              Welcome, {judge?.name || 'Evaluator'}
            </h1>

            {/* Description */}
            <p className="text-xs sm:text-[13px] text-slate-500 mt-2 max-w-[290px] mx-auto text-center leading-relaxed font-normal">
              Enter your 4-digit Security PIN to unlock the{' '}
              <span className="font-semibold text-slate-700">{eventData?.title || 'event'}</span> evaluation sheet.
            </p>
          </div>

          <form onSubmit={handleVerifyPin} className="mt-2">
            {/* 4 Digit Boxes */}
            <div className="flex items-center justify-center gap-2.5 sm:gap-3.5 my-6 sm:my-7">
              {[0, 1, 2, 3].map((index) => {
                const isFocused = focusedPinIndex === index;
                const hasValue = Boolean(pinDigits[index]);
                return (
                  <input
                    key={index}
                    ref={(el) => (inputRefs.current[index] = el)}
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    value={pinDigits[index]}
                    onFocus={() => setFocusedPinIndex(index)}
                    onBlur={() => setFocusedPinIndex(null)}
                    onChange={(e) => handleDigitChange(index, e.target.value)}
                    onKeyDown={(e) => handleDigitKeyDown(index, e)}
                    onPaste={handlePaste}
                    className={`w-12 h-14 sm:w-14 sm:h-16 shrink-0 text-2xl font-bold text-center rounded-[18px] sm:rounded-2xl border transition-all duration-200 outline-none caret-[#3b27b8] ${
                      isFocused
                        ? 'border-2 border-[#3b27b8] text-slate-900 bg-white shadow-xs ring-4 ring-[#3b27b8]/12'
                        : hasValue
                        ? 'border border-[#3b27b8]/80 text-slate-900 bg-white shadow-2xs'
                        : 'border border-slate-200/90 bg-[#f9fafc] text-slate-900 hover:border-slate-300'
                    }`}
                  />
                );
              })}
            </div>

            {pinError && (
              <div className="mb-4 p-2.5 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-medium text-center flex items-center justify-center gap-1.5 animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{pinError}</span>
              </div>
            )}

            {/* Unlock Button */}
            <button
              type="submit"
              disabled={verifyingPin}
              className="w-full py-3.5 sm:py-4 bg-[#231779] hover:bg-[#1b1261] active:scale-[0.99] text-white rounded-2xl text-xs sm:text-sm font-semibold transition-all duration-200 shadow-md shadow-[#231779]/20 disabled:opacity-75 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center gap-2"
            >
              {verifyingPin ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : (
                <>
                  <span>Unlock Evaluation Portal</span>
                  <span className="text-base leading-none">→</span>
                </>
              )}
            </button>

            {/* Thin Divider Line matching reference image */}
            <div className="w-full border-t border-slate-100 my-5 sm:my-6" />

            {/* Note text below divider */}
            <p className="text-[11px] sm:text-xs text-slate-400 text-center leading-relaxed max-w-[310px] mx-auto font-normal">
              The 4-digit PIN was provided in your invitation email or displayed on the admin screen.
            </p>
          </form>
        </div>

        {/* Footer: Powered by Eventloo (Real Model matching QR Badge) */}
        <footer className="mt-7 text-center select-none">
          <div className="inline-flex items-center gap-2 text-xs text-slate-500">
            <span>Powered by</span>
            <EventlooLogo size="sm" theme="light" showSubtitle={false} />
          </div>
        </footer>
      </div>
    );
  }

  // =========================================================================
  // SCORING SHEET VIEW (MATCHING 1:1 REFERENCE DESIGN)
  // =========================================================================
  if (activeView === 'eval' && selectedProgramId) {
    const isLocked = Boolean(scoreSheetData?.assignment?.is_locked);
    const maxMark = scoreSheetData?.criteria?.max_mark_per_judge || 100;
    const candidates = scoreSheetData?.candidates || [];
    const currentCandidate = candidates[selectedCandidateIndex] || candidates[0];
    const currentScore = currentCandidate ? (candidatesScores[currentCandidate.result_id]?.mark ?? '') : '';
    const currentComments = currentCandidate ? (candidatesScores[currentCandidate.result_id]?.comments ?? '') : '';
    const progressPercent = candidates.length > 0 ? Math.round((scoredCount / candidates.length) * 100) : 0;

    return (
      <div className="min-h-screen bg-[#f8f9fc] text-slate-900 flex flex-col font-sans select-none">
        {/* Top Header - Desktop & Mobile Adaptive with Separate Back Button */}
        <header className="bg-white border-b border-slate-100 sticky top-0 z-30 shadow-2xs">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            {/* Desktop Left: Dedicated Back Button + Brand Logo + Title + Divider + Judge Portal */}
            <div className="hidden sm:flex items-center space-x-3.5 min-w-0">
              <button
                type="button"
                onClick={handleGoBack}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 hover:text-[#4f35d2] text-xs font-bold transition shadow-2xs cursor-pointer active:scale-95"
                title="Back to Judgement Dashboard"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Back</span>
              </button>

              <div className="h-4 w-px bg-slate-200" />

              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="flex items-center justify-center shrink-0">
                  <EventlooIcon className="w-7 h-7" variant="color" />
                </div>
                <span className="font-bold text-base text-slate-900 truncate">
                  {eventData?.title || 'Zenith Youth Fest 2026'}
                </span>
                <span className="text-slate-300 font-light mx-1">|</span>
                <span className="text-sm font-semibold text-slate-700">
                  Judge Portal
                </span>
              </div>
            </div>

            {/* Mobile Left: Clean Dedicated Back Button */}
            <div className="flex sm:hidden items-center">
              <button
                type="button"
                onClick={handleGoBack}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-800 hover:text-[#4f35d2] transition cursor-pointer active:scale-95 shadow-2xs text-xs font-bold"
              >
                <ArrowLeft className="w-4 h-4 text-slate-700" />
                <span>Back</span>
              </button>
            </div>

            {/* Desktop Right: Blind Scoring Active Badge + Evaluator Pill */}
            <div className="hidden sm:flex items-center space-x-3 shrink-0">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#eaf8f1] text-[#1e8a54] border border-[#bce9d2]">
                <ShieldCheck className="w-3.5 h-3.5 text-[#1e8a54] shrink-0" />
                <span>Blind Scoring Active</span>
              </div>

              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 shadow-2xs">
                <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <span>{judge?.name || 'midlaj'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
              </div>
            </div>
          </div>
        </header>

        {/* Toast Alert */}
        {saveStatusMessage.text && (
          <div className={`fixed top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl shadow-md text-xs font-semibold flex items-center gap-2 animate-fadeIn max-w-[90vw] text-center ${
            saveStatusMessage.type === 'error'
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}>
            {saveStatusMessage.type === 'error' ? <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" /> : <Check className="h-4 w-4 text-emerald-600 shrink-0" />}
            <span className="truncate">{saveStatusMessage.text}</span>
          </div>
        )}

        {/* Main Workspace Area */}
        <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-4 sm:space-y-5 pb-32 sm:pb-28">
          {loadingSheet ? (
            <div className="py-24 text-center space-y-3">
              <RefreshCw className="h-7 w-7 animate-spin text-indigo-600 mx-auto" />
              <p className="text-xs text-slate-500 font-medium">Loading scoring sheet...</p>
            </div>
          ) : candidates.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200/80 text-xs text-slate-500 shadow-2xs">
              No participants assigned to this program yet.
            </div>
          ) : (
            <>
              {/* Program Header Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-2xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
                    {/* Music / Program Icon squircle */}
                    <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-[#eeecfc] text-[#4f35d2] flex items-center justify-center shrink-0 border border-[#e2defa]/70 shadow-2xs">
                      <Music className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                          {scoreSheetData?.program?.name}
                        </h1>
                        <span className="text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200 shrink-0">
                          {scoreSheetData?.program?.category_display || 'JR'}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                        {scoreSheetData?.program?.venue && (
                          <span className="flex items-center gap-1 truncate">
                            <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="truncate">{scoreSheetData?.program?.venue}</span>
                          </span>
                        )}
                        <span>·</span>
                        <span className="flex items-center gap-1 shrink-0">
                          <User className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{scoreSheetData?.program?.is_team_based ? 'Group' : 'Individual'}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Desktop Max Mark display on right */}
                  <div className="hidden sm:block text-right shrink-0">
                    <span className="text-xs font-semibold text-slate-400">Max: </span>
                    <span className="text-lg font-extrabold text-[#4f35d2]">{maxMark}</span>
                  </div>
                </div>

                {/* Mobile-only stats row below header */}
                <div className="flex sm:hidden items-center justify-between pt-3 mt-3 border-t border-slate-100 text-xs">
                  <span className="font-bold text-slate-800">
                    {scoredCount} / {candidates.length} Evaluated
                  </span>
                  <div>
                    <span className="text-slate-400 font-medium">Max: </span>
                    <span className="font-extrabold text-[#4f35d2]">{maxMark}</span>
                  </div>
                </div>

                {isLocked && (
                  <div className="mt-3.5 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-xs text-emerald-800">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span>
                      Evaluation for this competition was locked on{' '}
                      <strong>{scoreSheetData?.assignment?.locked_at ? new Date(scoreSheetData.assignment.locked_at).toLocaleTimeString() : 'recently'}</strong>. Marks are read-only.
                    </span>
                  </div>
                )}
              </div>



              {/* Two-Column Workspace (Desktop) & Responsive Scoring Card (Mobile) */}
              <div className="flex flex-col md:flex-row items-start gap-4 lg:gap-5">
                {/* Left Column: Participants list (Desktop/Tablet) */}
                <div className="w-full md:w-72 lg:w-80 shrink-0 bg-white border border-slate-200/80 rounded-2xl p-4 shadow-2xs hidden md:block">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Participants ({candidates.length})
                    </h3>
                    <span className="text-xs font-semibold text-slate-400 font-mono">
                      {scoredCount} / {candidates.length}
                    </span>
                  </div>

                  <div className="mt-3 space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                    {candidates.map((cand, idx) => {
                      const isActive = idx === selectedCandidateIndex;
                      const scoreVal = candidatesScores[cand.result_id]?.mark;
                      const hasScore = scoreVal !== '' && scoreVal !== null && !isNaN(scoreVal);
                      const displayId = cand.chest_number && cand.chest_number !== '-' ? cand.chest_number : (cand.code_letter || idx + 1);

                      return (
                        <button
                          key={cand.result_id}
                          type="button"
                          onClick={() => setSelectedCandidateIndex(idx)}
                          className={`w-full flex items-center justify-between px-3.5 py-3 rounded-xl transition text-xs cursor-pointer ${
                            isActive
                              ? 'bg-[#f0eefd] border-l-4 border-l-[#4f35d2] text-[#4f35d2] font-bold shadow-2xs'
                              : 'bg-white hover:bg-slate-50 text-slate-700 font-medium border border-transparent hover:border-slate-100'
                          }`}
                        >
                          <div className="flex flex-col text-left min-w-0">
                            <span className="font-bold text-sm truncate font-mono">
                              {cand.code_letter ? `Code ${cand.code_letter}` : `Participant ${idx + 1}`}
                            </span>
                            {cand.chest_number && cand.chest_number !== '-' && (
                              <span className={`text-[11px] font-mono mt-0.5 ${isActive ? 'text-[#4f35d2]/80 font-medium' : 'text-slate-400'}`}>
                                Chest: #{cand.chest_number}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isActive ? (
                              <>
                                <span className="w-2 h-2 rounded-full bg-[#4f35d2]" />
                                <span className="font-bold text-slate-900 w-8 text-right font-mono">
                                  {hasScore ? scoreVal : '-'}
                                </span>
                              </>
                            ) : hasScore ? (
                              <>
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span className="font-bold text-slate-800 w-8 text-right font-mono">
                                  {scoreVal}
                                </span>
                              </>
                            ) : (
                              <span className="text-slate-300 font-bold w-8 text-right">-</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Right Column: Active Performer Card (Desktop & Mobile) */}
                <div className="flex-1 w-full bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-7 shadow-2xs space-y-5">
                  {/* Stepper Header */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setSelectedCandidateIndex((prev) => Math.max(0, prev - 1))}
                      disabled={selectedCandidateIndex === 0}
                      className="w-10 h-10 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 transition active:scale-95 cursor-pointer shrink-0"
                      aria-label="Previous performer"
                    >
                      <ChevronLeft className="w-5 h-5" />
                    </button>

                    <div className="text-center min-w-0 px-2">
                      <div className="inline-flex items-center justify-center gap-1.5 mb-0.5">
                        <span className="text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wider text-[#4f35d2] bg-[#f0eefd] px-2.5 py-0.5 rounded-md border border-[#ded8f9]">
                          Code Letter
                        </span>
                      </div>
                      <h2 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight font-mono">
                        {currentCandidate?.code_letter ? `Code ${currentCandidate.code_letter}` : `Participant ${selectedCandidateIndex + 1}`}
                      </h2>
                      <div className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-0.5 mt-1 text-xs text-slate-500 font-medium">
                        {currentCandidate?.chest_number && currentCandidate.chest_number !== '-' && (
                          <span className="font-mono text-xs text-slate-500 whitespace-nowrap">
                            Chest No: <strong className="text-slate-800 font-mono">#{currentCandidate.chest_number}</strong>
                          </span>
                        )}
                        <span className="text-slate-300 hidden sm:inline">·</span>
                        <span className="text-slate-400 whitespace-nowrap">Performer {selectedCandidateIndex + 1} of {candidates.length}</span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedCandidateIndex((prev) => Math.min(candidates.length - 1, prev + 1))}
                      disabled={selectedCandidateIndex === candidates.length - 1}
                      className="w-10 h-10 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center text-slate-600 transition active:scale-95 cursor-pointer shrink-0"
                      aria-label="Next performer"
                    >
                      <ChevronRight className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Score Input Box */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Enter Score
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        disabled={isLocked}
                        placeholder={`0 - ${maxMark}`}
                        value={currentScore}
                        onChange={(e) => handleScoreChange(currentCandidate.result_id, e.target.value)}
                        className={`w-full py-3.5 px-4 text-base sm:text-lg font-bold rounded-xl border transition outline-none ${
                          isLocked
                            ? 'bg-slate-50 border-slate-200 text-slate-400 cursor-not-allowed'
                            : 'bg-white border-slate-200 focus:border-[#4f35d2] focus:ring-4 focus:ring-[#4f35d2]/10 text-slate-900 placeholder:text-slate-300'
                        }`}
                      />
                      {!isLocked && (
                        <div className="absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                          <ChevronsUpDown className="w-4 h-4 text-slate-400" />
                        </div>
                      )}
                    </div>


                  </div>

                  {/* Remarks Input */}
                  <div>
                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                      Remarks (optional)
                    </label>
                    <textarea
                      rows={3}
                      disabled={isLocked}
                      placeholder="Add notes..."
                      value={currentComments}
                      onChange={(e) => handleCommentsChange(currentCandidate.result_id, e.target.value)}
                      className="w-full text-xs px-4 py-3 bg-white border border-slate-200 rounded-xl focus:border-[#4f35d2] focus:ring-4 focus:ring-[#4f35d2]/10 outline-none text-slate-700 placeholder:text-slate-400 transition resize-none disabled:bg-slate-50 disabled:text-slate-400"
                    />
                  </div>

                  {/* Save Button & Draft status */}
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => handleSaveScores(false)}
                      disabled={savingMarks || isLocked}
                      className="w-full sm:w-auto px-6 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-xs font-bold text-slate-700 transition shadow-2xs flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5 text-slate-500" />
                      <span>{savingMarks ? 'Saving...' : 'Save'}</span>
                    </button>

                    <div className="text-center sm:text-right">
                      {isLocked ? (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center justify-center sm:justify-end gap-1">
                          <Check className="w-3.5 h-3.5" /> Locked & Submitted
                        </span>
                      ) : (
                        <span className="text-xs font-semibold text-emerald-600 flex items-center justify-center sm:justify-end gap-1">
                          <Check className="w-3.5 h-3.5" /> Draft saved
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer: Powered by Eventloo (Real Model matching QR Badge) */}
              <footer className="pt-6 pb-4 text-center select-none">
                <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                  <span>Powered by</span>
                  <EventlooLogo size="sm" theme="light" showSubtitle={false} />
                </div>
              </footer>
            </>
          )}
        </main>

        {/* Floating / Sticky Bottom Bar (Desktop & Mobile) */}
        {!isLocked && (
          <footer className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-slate-200/90 py-3 sm:py-3.5 px-4 sm:px-6 z-40 shadow-lg pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            {/* Desktop View */}
            <div className="max-w-6xl mx-auto hidden sm:flex items-center justify-between gap-4">
              <div className="flex flex-col gap-1.5 min-w-[220px] sm:min-w-[280px]">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">Evaluation Progress</span>
                  <span className="font-semibold text-slate-500 font-mono">
                    {scoredCount} / {candidates.length}
                  </span>
                </div>
                <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
                  <div
                    className="bg-[#4f35d2] h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => setShowLockConfirmModal(true)}
                  disabled={savingMarks || scoredCount === 0}
                  className="px-6 py-2.5 sm:py-3 rounded-2xl bg-[#2b1b85] hover:bg-[#231570] text-white text-xs sm:text-sm font-semibold transition shadow-md shadow-[#2b1f86]/20 cursor-pointer flex items-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>Submit & Lock All</span>
                </button>
              </div>
            </div>

            {/* Mobile View: Full Width Submit & Lock All */}
            <div className="sm:hidden">
              <button
                type="button"
                onClick={() => setShowLockConfirmModal(true)}
                disabled={savingMarks || scoredCount === 0}
                className="w-full py-3.5 rounded-2xl bg-[#2b1b85] hover:bg-[#231570] text-white text-xs sm:text-sm font-semibold transition shadow-md shadow-[#2b1f86]/20 cursor-pointer flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                <Lock className="w-4 h-4" />
                <span>Submit & Lock All</span>
              </button>
            </div>
          </footer>
        )}

        {/* Lock Confirmation Modal */}
        {showLockConfirmModal && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 text-slate-900 shadow-2xl animate-scaleUp">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3 border border-amber-200">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <h3 className="text-base font-bold text-center text-slate-900">Submit & Lock Evaluation?</h3>
              <p className="text-xs text-slate-500 text-center mt-2 mb-6 leading-relaxed">
                You have evaluated <strong>{scoredCount}</strong> out of <strong>{candidates.length}</strong> candidate(s). Once locked, marks cannot be altered on this device.
              </p>

              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowLockConfirmModal(false)}
                  className="py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Go Back
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveScores(true)}
                  disabled={savingMarks}
                  className="py-2.5 text-xs font-bold bg-[#2b1f86] hover:bg-[#251a75] text-white rounded-xl transition shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {savingMarks ? 'Locking...' : 'Yes, Lock & Submit'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // PORTAL MAIN DASHBOARD & JUDGEMENT LAYOUT (ULTRA-MINIMAL ADMIN PORTAL)
  // =========================================================================
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden font-sans select-none">
      {/* Mobile sidebar backdrop overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/25 transition-opacity lg:hidden z-40 backdrop-blur-xs"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Official Admin-Style Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 flex flex-col shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="flex items-center justify-between h-16 sm:h-20 px-6 border-b border-gray-200 shrink-0">
          <EventlooLogo variant="full" size="md" showSubtitle />
          <button
            type="button"
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sidebar Navigation - Clean: Only Dashboard & Judgement */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Judge Workspace
          </div>

          <button
            type="button"
            onClick={() => {
              setActiveNav('dashboard');
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center px-3 py-2 text-xs font-medium transition-all duration-150 rounded-lg cursor-pointer ${
              activeNav === 'dashboard'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <Home
              className={`h-4 w-4 mr-2.5 transition-colors duration-200 ${
                activeNav === 'dashboard' ? 'text-indigo-600' : 'text-slate-400'
              }`}
            />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveNav('judgement');
              setSidebarOpen(false);
            }}
            className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-all duration-150 rounded-lg cursor-pointer ${
              activeNav === 'judgement'
                ? 'bg-indigo-50 text-indigo-700 font-semibold'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center">
              <Scale
                className={`h-4 w-4 mr-2.5 transition-colors duration-200 ${
                  activeNav === 'judgement' ? 'text-indigo-600' : 'text-slate-400'
                }`}
              />
              <span>Judgement</span>
            </div>
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                activeNav === 'judgement'
                  ? 'bg-indigo-100 text-indigo-700'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {programs.length}
            </span>
          </button>
        </nav>

        {/* Bottom Evaluator Profile */}
        <div className="p-3 border-t border-gray-200 shrink-0">
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70">
            <div className="w-8 h-8 rounded-full bg-[#2b1f86] text-white flex items-center justify-center font-bold text-xs shrink-0 shadow-xs">
              {judge?.name ? judge.name.charAt(0).toUpperCase() : 'J'}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-slate-900 truncate">{judge?.name || 'Evaluator'}</p>
              <p className="text-[10px] text-slate-400 truncate">{judge?.designation || 'Official Judge'}</p>
            </div>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Online" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
        {/* Top Navbar */}
        <header className="bg-white border-b border-gray-100 sticky top-0 z-30 backdrop-blur-lg bg-white/95 shrink-0 max-w-full overflow-hidden">
          <div className="flex items-center justify-between h-16 px-3.5 sm:px-6 lg:px-8 max-w-full">
            {/* Left: Mobile hamburger menu + Mobile Logo + Desktop Title */}
            <div className="flex items-center space-x-2.5 sm:space-x-4 min-w-0">
              <button
                type="button"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="lg:hidden p-2 rounded-lg text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors duration-200 shrink-0 cursor-pointer"
                aria-label="Toggle sidebar menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Mobile Brand Logo */}
              <div className="flex lg:hidden items-center shrink-0">
                <EventlooLogo variant="full" size="sm" />
              </div>

              {/* Desktop Event Title */}
              <div className="hidden sm:flex items-center gap-2 min-w-0 pl-1">
                <span className="text-xs font-semibold text-slate-900 truncate">
                  {eventData?.title}
                </span>
                {eventData?.venue && (
                  <>
                    <span className="text-slate-300">·</span>
                    <span className="text-xs text-slate-500 truncate">
                      {eventData.venue}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Right: Station Status & Judge Pill */}
            <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
              <div className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>Station Online</span>
              </div>

              <div className="h-4 w-px bg-slate-200 hidden sm:block" />

              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="w-7 h-7 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
                  <Scale className="h-3.5 w-3.5" />
                </div>
                <span className="text-xs font-semibold text-slate-700 max-w-[100px] sm:max-w-[160px] truncate hidden sm:inline-block">
                  {judge?.name}
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable Page Content */}
        <main className="flex-1 min-w-0 w-full max-w-full overflow-x-hidden overflow-y-auto">
          <div className="w-full mx-auto px-3.5 sm:px-6 lg:px-8 py-5 max-w-7xl">
            {/* VIEW A: DASHBOARD SECTION */}
            {activeNav === 'dashboard' && (
              <div className="space-y-5 animate-fadeIn">
                {/* Clean Greeting Banner */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <div className="min-w-0">
                    <h1 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 truncate">
                      Welcome back, {judge?.name || 'Evaluator'} 👋
                    </h1>
                    <p className="mt-0.5 text-xs text-slate-500 truncate">
                      {eventData?.title}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveNav('judgement')}
                    className="self-start sm:self-auto inline-flex items-center gap-2 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white text-xs font-semibold rounded-xl shadow-xs transition active:scale-95 cursor-pointer shrink-0"
                  >
                    <Scale className="h-4 w-4" />
                    <span>Go to Judgement ({programs.length})</span>
                  </button>
                </div>

                {/* 4-Box Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
                  {/* Card 1: Assigned */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-slate-300 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Assigned</p>
                        <p className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">{programs.length}</p>
                      </div>
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 shrink-0">
                        <Trophy className="h-4 w-4 sm:h-4.5 sm:w-4.5" strokeWidth={1.8} />
                      </div>
                    </div>
                  </div>

                  {/* Card 2: Completed & Locked */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-slate-300 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Submitted</p>
                        <p className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-emerald-600">{completedCount}</p>
                      </div>
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100 shrink-0">
                        <CheckCircle2 className="h-4 w-4 sm:h-4.5 sm:w-4.5" strokeWidth={1.8} />
                      </div>
                    </div>
                  </div>

                  {/* Card 3: Pending Evaluation */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-slate-300 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Pending</p>
                        <p className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-amber-600">{pendingCount}</p>
                      </div>
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-100 shrink-0">
                        <Clock className="h-4 w-4 sm:h-4.5 sm:w-4.5" strokeWidth={1.8} />
                      </div>
                    </div>
                  </div>

                  {/* Card 4: Scoring Ceiling */}
                  <div className="rounded-xl border border-slate-200/80 bg-white p-3 sm:p-4 shadow-[0_1px_2px_rgba(15,23,42,0.03)] transition hover:border-slate-300 min-w-0 overflow-hidden">
                    <div className="flex items-start justify-between gap-1.5 sm:gap-2">
                      <div className="min-w-0">
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Max Mark</p>
                        <p className="mt-1 text-2xl sm:text-3xl font-extrabold tracking-tight text-purple-600">{eventData?.max_mark_per_judge || 100}</p>
                      </div>
                      <div className="flex h-8 w-8 sm:h-9 sm:w-9 items-center justify-center rounded-lg bg-purple-50 text-purple-600 border border-purple-100 shrink-0">
                        <Award className="h-4 w-4 sm:h-4.5 sm:w-4.5" strokeWidth={1.8} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Assigned Competitions List */}
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.03)] space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm sm:text-base font-bold text-slate-900">Assigned Competitions</h3>
                    <button
                      type="button"
                      onClick={() => setActiveNav('judgement')}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition cursor-pointer"
                    >
                      View All ({programs.length}) →
                    </button>
                  </div>

                  {programs.length === 0 ? (
                    <div className="p-8 text-center text-xs text-slate-400 bg-slate-50/50 rounded-xl border border-slate-100">
                      No competitions assigned yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {programs.slice(0, 5).map((prog) => {
                        const isLocked = Boolean(prog.assignment?.is_locked);
                        return (
                          <div key={prog.id} className="py-2.5 sm:py-3 flex items-center justify-between gap-2 min-w-0">
                            <div className="min-w-0 flex-1 pr-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate max-w-[160px] sm:max-w-none">{prog.name}</h4>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 shrink-0">
                                  {prog.category_display}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                {prog.venue || 'Main Stage'} · {prog.is_team_based ? 'Group' : 'Individual'}
                              </p>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isLocked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 sm:px-2.5 py-1 rounded-lg border border-emerald-200 shrink-0">
                                  <CheckCircle2 className="h-3 w-3" /> Submitted
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleSelectProgram(prog.id)}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium transition shadow-xs cursor-pointer active:scale-95"
                                >
                                  Evaluate →
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* VIEW B: JUDGEMENT SECTION (Compact Table Directory Style) */}
            {activeNav === 'judgement' && (
              <div className="space-y-4 animate-fadeIn">
                {/* Search & Filter Toolbar */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search competitions by name or venue..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full text-xs pl-9 pr-4 py-2.5 bg-white border border-slate-200/90 rounded-xl focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 text-slate-800 placeholder-slate-400 transition shadow-2xs"
                    />
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                    {[
                      { id: 'all', label: `All (${programs.length})` },
                      { id: 'pending', label: `Pending (${pendingCount})` },
                      { id: 'submitted', label: `Submitted (${completedCount})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setStatusFilter(f.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer whitespace-nowrap active:scale-95 ${
                          statusFilter === f.id
                            ? 'bg-indigo-600 text-white shadow-2xs'
                            : 'bg-white border border-slate-200/90 text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compact Table (Matching Teams and Student Sections) */}
                <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                    <p className="text-sm font-semibold text-slate-900">Competitions Directory</p>
                    <p className="text-xs text-slate-400">{filteredPrograms.length} assigned</p>
                  </div>

                  {/* Desktop / Tablet Table View (Matching Teams & Students Section) */}
                  <div className="hidden sm:block overflow-x-auto">
                    <table className="min-w-full text-left">
                      <thead className="bg-slate-50/80">
                        <tr>
                          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Competition
                          </th>
                          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Category
                          </th>
                          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Format & Venue
                          </th>
                          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Progress
                          </th>
                          <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Status
                          </th>
                          <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPrograms.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-12 text-center">
                              <Scale className="mx-auto h-6 w-6 text-slate-300" />
                              <p className="mt-2 text-sm font-semibold text-slate-700">No competitions found</p>
                              <p className="text-xs text-slate-400 mt-0.5">Try adjusting your filter or search keywords</p>
                            </td>
                          </tr>
                        ) : (
                          filteredPrograms.map((prog) => {
                            const isLocked = Boolean(prog.assignment?.is_locked);
                            const evaluatedCount = prog.evaluated_count || 0;
                            const totalParticipants = prog.total_participants || 0;
                            const progressPct = totalParticipants > 0 ? Math.round((evaluatedCount / totalParticipants) * 100) : 0;

                            return (
                              <tr key={prog.id} className="transition hover:bg-indigo-50/30">
                                {/* Competition column */}
                                <td className="px-5 py-3.5">
                                  <div className="flex items-center gap-3">
                                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                                      <Music className="h-4 w-4" />
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-semibold text-slate-900 truncate max-w-[220px] sm:max-w-xs">
                                        {prog.name}
                                      </p>
                                      <p className="text-xs text-slate-400 truncate">
                                        {prog.venue || 'Main Stage'}
                                      </p>
                                    </div>
                                  </div>
                                </td>

                                {/* Category column */}
                                <td className="px-5 py-3.5">
                                  <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                                    {prog.category_display || 'General'}
                                  </span>
                                </td>

                                {/* Format & Venue */}
                                <td className="px-5 py-3.5">
                                  <div className="flex flex-col items-start gap-1">
                                    <span className="text-xs font-medium text-slate-700">
                                      {prog.is_team_based ? 'Group' : 'Individual'}
                                    </span>
                                    {prog.venue && (
                                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                                        <MapPin className="h-3 w-3 text-slate-400" />
                                        <span className="truncate max-w-[140px]">{prog.venue}</span>
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Progress */}
                                <td className="px-5 py-3.5">
                                  <div className="w-28 space-y-1">
                                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-500">
                                      <span>{evaluatedCount}/{totalParticipants}</span>
                                      <span>{progressPct}%</span>
                                    </div>
                                    <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden border border-slate-200/60">
                                      <div
                                        className={`h-full transition-all duration-300 ${isLocked ? 'bg-emerald-500' : 'bg-indigo-600'}`}
                                        style={{ width: `${progressPct}%` }}
                                      />
                                    </div>
                                  </div>
                                </td>

                                {/* Status */}
                                <td className="px-5 py-3.5">
                                  {isLocked ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 whitespace-nowrap">
                                      <CheckCircle2 className="h-3 w-3" /> Submitted
                                    </span>
                                  ) : evaluatedCount > 0 ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-1 rounded-lg border border-amber-200 whitespace-nowrap">
                                      In Progress
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-1 rounded-lg border border-slate-200 whitespace-nowrap">
                                      Pending
                                    </span>
                                  )}
                                </td>

                                {/* Action */}
                                <td className="px-5 py-3.5">
                                  <div className="flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => handleSelectProgram(prog.id)}
                                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 shadow-2xs ${
                                        isLocked
                                          ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                                          : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                      }`}
                                    >
                                      <span>{isLocked ? 'View' : 'Evaluate'}</span>
                                      <ChevronRight className="h-3 w-3" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Compact Table View */}
                  <div className="sm:hidden divide-y divide-slate-100">
                    {filteredPrograms.length === 0 ? (
                      <div className="py-12 text-center">
                        <Scale className="mx-auto h-6 w-6 text-slate-300" />
                        <p className="mt-2 text-sm font-semibold text-slate-700">No competitions found</p>
                      </div>
                    ) : (
                      filteredPrograms.map((prog) => {
                        const isLocked = Boolean(prog.assignment?.is_locked);
                        const evaluatedCount = prog.evaluated_count || 0;
                        const totalParticipants = prog.total_participants || 0;

                        return (
                          <div key={prog.id} className="p-3.5 flex items-center justify-between gap-3 transition hover:bg-slate-50/50">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 shrink-0">
                                <Music className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <p className="text-xs font-bold text-slate-900 truncate max-w-[150px]">
                                    {prog.name}
                                  </p>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
                                    {prog.category_display || 'JR'}
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-400 mt-0.5 truncate">
                                  {prog.venue || 'Main Stage'} · {evaluatedCount}/{totalParticipants} evaluated
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {isLocked ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200 shrink-0">
                                  <CheckCircle2 className="h-3 w-3" /> Submitted
                                </span>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => handleSelectProgram(prog.id)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer active:scale-95 shadow-2xs ${
                                  isLocked
                                    ? 'bg-slate-100 text-slate-700 border border-slate-200'
                                    : 'bg-indigo-600 text-white'
                                }`}
                              >
                                <span>{isLocked ? 'View' : 'Evaluate'}</span>
                                <ChevronRight className="h-3 w-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </section>
              </div>
            )}

            {/* Footer Branding (Real Model matching QR Badge) */}
            <footer className="py-6 text-center select-none">
              <div className="inline-flex items-center gap-2 text-xs text-slate-500">
                <span>Powered by</span>
                <EventlooLogo size="sm" theme="light" showSubtitle={false} />
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
};

export default JudgeEvaluationPortal;
