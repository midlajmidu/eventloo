import React, { useState, useEffect } from 'react';
import { 
  Settings, 
  Save, 
  CheckCircle, 
  AlertCircle, 
  Award, 
  Clock, 
  Layers,
  Infinity,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { eventsAPI } from '../../services/api';

const DEFAULT_GRADE_RULES = [
  { name: 'A+', min_mark: 90, max_mark: 100 },
  { name: 'A',  min_mark: 80, max_mark: 89.99 },
  { name: 'B+', min_mark: 70, max_mark: 79.99 },
  { name: 'B',  min_mark: 60, max_mark: 69.99 }
];

const EventSettings = ({ event, eventId, onRefresh }) => {
  const [numJudges, setNumJudges] = useState(3);
  const [maxMarkPerJudge, setMaxMarkPerJudge] = useState(100);
  const [convertedTotalMark, setConvertedTotalMark] = useState(100);
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  
  // Student Program Limits (0 = Unlimited)
  const [maxSinglePrograms, setMaxSinglePrograms] = useState(3);
  const [isSingleUnlimited, setIsSingleUnlimited] = useState(false);

  const [maxGroupPrograms, setMaxGroupPrograms] = useState(0);
  const [isGroupUnlimited, setIsGroupUnlimited] = useState(true);

  // Event-level grade percentage bands
  const [enableGradingSystem, setEnableGradingSystem] = useState(true);
  const [gradingRules, setGradingRules] = useState(DEFAULT_GRADE_RULES);

  // Event Points Configuration
  const [stdIndFirst, setStdIndFirst] = useState(5);
  const [stdIndSecond, setStdIndSecond] = useState(3);
  const [stdIndThird, setStdIndThird] = useState(1);

  const [stdGroupFirst, setStdGroupFirst] = useState(10);
  const [stdGroupSecond, setStdGroupSecond] = useState(6);
  const [stdGroupThird, setStdGroupThird] = useState(3);

  const [mixIndFirst, setMixIndFirst] = useState(10);
  const [mixIndSecond, setMixIndSecond] = useState(6);
  const [mixIndThird, setMixIndThird] = useState(3);

  const [mixGroupFirst, setMixGroupFirst] = useState(10);
  const [mixGroupSecond, setMixGroupSecond] = useState(6);
  const [mixGroupThird, setMixGroupThird] = useState(3);
  const [participationPoints, setParticipationPoints] = useState(25);
  const [countGeneralIndividualPoints, setCountGeneralIndividualPoints] = useState(false);

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');

  // Helper to convert ISO deadline string to input format YYYY-MM-DDTHH:mm
  const formatForInput = (isoString) => {
    if (!isoString) return '';
    try {
      const date = new Date(isoString);
      const tzOffset = date.getTimezoneOffset() * 60000;
      const localISOTime = (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
      return localISOTime;
    } catch (e) {
      return '';
    }
  };

  useEffect(() => {
    if (event) {
      setNumJudges(event.num_judges || 3);
      setMaxMarkPerJudge(event.max_mark_per_judge ? parseFloat(event.max_mark_per_judge) : 100);
      setConvertedTotalMark(event.converted_total_mark ? parseFloat(event.converted_total_mark) : 100);
      setRegistrationDeadline(formatForInput(event.registration_deadline));

      const sVal = event.max_single_programs_per_student;
      if (sVal === 0 || sVal === null || sVal === undefined) {
        setIsSingleUnlimited(true);
        setMaxSinglePrograms(3);
      } else {
        setIsSingleUnlimited(false);
        setMaxSinglePrograms(sVal);
      }

      const gVal = event.max_group_programs_per_student;
      if (gVal === 0 || gVal === null || gVal === undefined) {
        setIsGroupUnlimited(true);
        setMaxGroupPrograms(2);
      } else {
        setIsGroupUnlimited(false);
        setMaxGroupPrograms(gVal);
      }

      setEnableGradingSystem(event.enable_grading_system ?? true);
      if (Array.isArray(event.grading_rules) && event.grading_rules.length > 0) {
        setGradingRules(event.grading_rules.map(({ name, min_mark, max_mark }) => ({
          name, min_mark, max_mark
        })));
      } else {
        setGradingRules(DEFAULT_GRADE_RULES);
      }

      setStdIndFirst(event.std_ind_first ?? 5);
      setStdIndSecond(event.std_ind_second ?? 3);
      setStdIndThird(event.std_ind_third ?? 1);

      setStdGroupFirst(event.std_group_first ?? 10);
      setStdGroupSecond(event.std_group_second ?? 6);
      setStdGroupThird(event.std_group_third ?? 3);

      setMixIndFirst(event.mix_ind_first ?? 10);
      setMixIndSecond(event.mix_ind_second ?? 6);
      setMixIndThird(event.mix_ind_third ?? 3);

      setMixGroupFirst(event.mix_group_first ?? 10);
      setMixGroupSecond(event.mix_group_second ?? 6);
      setMixGroupThird(event.mix_group_third ?? 3);
      setParticipationPoints(event.participation_points ?? 25);
      setCountGeneralIndividualPoints(event.count_general_individual_points_for_students ?? false);
    }
  }, [event]);

  // Grade Rule Handlers
  const handleAddRule = () => {
    setGradingRules(prev => [
      ...prev,
      { name: 'C+', min_mark: 50, max_mark: 59.99 }
    ]);
  };

  const handleUpdateRule = (index, field, value) => {
    setGradingRules(prev => {
      const next = [...prev];
      let formattedVal = value;
      if (field === 'min_mark' || field === 'max_mark') {
        formattedVal = parseFloat(value) || 0;
      }
      next[index] = { ...next[index], [field]: formattedVal };
      return next;
    });
  };

  const handleDeleteRule = (index) => {
    setGradingRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleResetRules = () => {
    setGradingRules(DEFAULT_GRADE_RULES);
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!eventId) return;

    setSaving(true);
    setMessage('');

    try {
      const updateData = {
        title: event.title,
        description: event.description || '',
        event_type: event.event_type || 'other',
        status: event.status || 'published',
        start_date: event.start_date,
        end_date: event.end_date,
        num_judges: parseInt(numJudges, 10),
        max_mark_per_judge: parseFloat(maxMarkPerJudge),
        converted_total_mark: parseFloat(convertedTotalMark),
        registration_deadline: registrationDeadline ? new Date(registrationDeadline).toISOString() : null,
        max_single_programs_per_student: isSingleUnlimited ? 0 : (parseInt(maxSinglePrograms, 10) || 0),
        max_group_programs_per_student: isGroupUnlimited ? 0 : (parseInt(maxGroupPrograms, 10) || 0),
        enable_grading_system: enableGradingSystem,
        grading_rules: gradingRules,

        std_ind_first: parseInt(stdIndFirst, 10) || 0,
        std_ind_second: parseInt(stdIndSecond, 10) || 0,
        std_ind_third: parseInt(stdIndThird, 10) || 0,

        std_group_first: parseInt(stdGroupFirst, 10) || 0,
        std_group_second: parseInt(stdGroupSecond, 10) || 0,
        std_group_third: parseInt(stdGroupThird, 10) || 0,

        mix_ind_first: parseInt(mixIndFirst, 10) || 0,
        mix_ind_second: parseInt(mixIndSecond, 10) || 0,
        mix_ind_third: parseInt(mixIndThird, 10) || 0,

        mix_group_first: parseInt(mixGroupFirst, 10) || 0,
        mix_group_second: parseInt(mixGroupSecond, 10) || 0,
        mix_group_third: parseInt(mixGroupThird, 10) || 0,
        participation_points: parseInt(participationPoints, 10) || 0,
        count_general_individual_points_for_students: countGeneralIndividualPoints,
      };

      await eventsAPI.updateEvent(eventId, updateData);
      
      setMessage('Settings saved successfully!');
      setMessageType('success');

      if (onRefresh) {
        await onRefresh();
      }

      setTimeout(() => {
        setMessage('');
      }, 3500);
    } catch (err) {
      console.error('Error updating event settings:', err);
      let errMsg = 'Failed to save settings';
      if (err.response?.data) {
        const data = err.response.data;
        if (typeof data === 'string') {
          errMsg = data;
        } else if (data.message) {
          errMsg = data.message;
        } else if (data.error) {
          errMsg = data.error;
        } else if (data.detail) {
          errMsg = data.detail;
        } else if (typeof data === 'object') {
          const firstKey = Object.keys(data)[0];
          if (firstKey) {
            const val = data[firstKey];
            const detailStr = Array.isArray(val)
              ? val.join(' ')
              : (typeof val === 'string' ? val : JSON.stringify(val));
            errMsg = firstKey === 'non_field_errors' ? detailStr : `${firstKey.replace(/_/g, ' ')}: ${detailStr}`;
          }
        }
      }
      setMessage(errMsg);
      setMessageType('error');
    } finally {
      setSaving(false);
    }
  };

  const isDeadlinePassed = registrationDeadline && new Date() > new Date(registrationDeadline);

  return (
    <div className="space-y-5 max-w-4xl mx-auto py-2">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
            <Settings className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Event Settings</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Manage cutoff deadline, student participation limits, and grading rules for <strong className="text-gray-700">{event?.title}</strong>
            </p>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center justify-center space-x-2 disabled:opacity-50 cursor-pointer self-start sm:self-auto"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving...' : 'Save Settings'}</span>
        </button>
      </div>

      {/* Alert Banner */}
      {message && (
        <div className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
          messageType === 'success' ? 'bg-emerald-50 text-emerald-800 border-emerald-200' : 'bg-red-50 text-red-800 border-red-200'
        }`}>
          {messageType === 'success' ? <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0" /> : <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />}
          <span>{message}</span>
        </div>
      )}

      {/* 1. Team Manager Registration Cutoff Time */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-gray-900">
            <Clock className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Registration Cutoff Time (IST)</h3>
          </div>
          {registrationDeadline ? (
            isDeadlinePassed ? (
              <span className="px-2.5 py-0.5 text-[11px] font-bold bg-red-100 text-red-800 rounded-full border border-red-200">
                Closed
              </span>
            ) : (
              <span className="px-2.5 py-0.5 text-[11px] font-bold bg-emerald-100 text-emerald-800 rounded-full border border-emerald-200">
                Open
              </span>
            )
          ) : (
            <span className="px-2.5 py-0.5 text-[11px] font-medium bg-gray-100 text-gray-600 rounded-full">
              Always Open
            </span>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="flex-1">
            <input
              type="datetime-local"
              value={registrationDeadline}
              onChange={(e) => setRegistrationDeadline(e.target.value)}
              className="w-full px-3.5 py-2 text-xs border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-gray-50 font-medium"
            />
          </div>
          <button
            type="button"
            onClick={() => setRegistrationDeadline('')}
            className="px-3.5 py-2 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors border border-gray-200"
          >
            Clear Deadline
          </button>
        </div>
      </div>

      {/* 2. Student Program Participation Limits */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-2.5 gap-1">
          <div className="flex items-center space-x-2 text-gray-900">
            <Layers className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Student Participation Limits</h3>
          </div>
          <span className="text-[11px] font-medium text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
            Applies to standard categories · General/combined is unlimited
          </span>
        </div>

        <p className="text-xs text-gray-500">
          Set how many programs a student can join within their assigned category. General and combined category programs are always unlimited and do not count against these limits.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Single / Individual Events Limit */}
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-900">
                Single / Individual Events Limit
              </label>
              <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSingleUnlimited}
                  onChange={(e) => setIsSingleUnlimited(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                />
                <span className="text-xs font-semibold text-indigo-700 flex items-center space-x-1">
                  <Infinity className="w-3.5 h-3.5" />
                  <span>Unlimited</span>
                </span>
              </label>
            </div>

            {isSingleUnlimited ? (
              <div className="py-2.5 px-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-800 flex items-center justify-between">
                <span>No limit on single events</span>
                <Infinity className="w-4 h-4 text-indigo-600" />
              </div>
            ) : (
              <div>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxSinglePrograms}
                  onChange={(e) => setMaxSinglePrograms(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. 3"
                />
                <p className="text-[11px] text-gray-500 mt-1">Maximum single programs in student&apos;s category (General is unlimited)</p>
              </div>
            )}
          </div>

          {/* Group / Team Events Limit */}
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-gray-900">
                Group / Team Events Limit
              </label>
              <label className="inline-flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isGroupUnlimited}
                  onChange={(e) => setIsGroupUnlimited(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                />
                <span className="text-xs font-semibold text-indigo-700 flex items-center space-x-1">
                  <Infinity className="w-3.5 h-3.5" />
                  <span>Unlimited</span>
                </span>
              </label>
            </div>

            {isGroupUnlimited ? (
              <div className="py-2.5 px-3 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-800 flex items-center justify-between">
                <span>No limit on group events</span>
                <Infinity className="w-4 h-4 text-indigo-600" />
              </div>
            ) : (
              <div>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={maxGroupPrograms}
                  onChange={(e) => setMaxGroupPrograms(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  placeholder="e.g. 2"
                />
                <p className="text-[11px] text-gray-500 mt-1">Maximum team/group programs in student&apos;s category (General is unlimited)</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. Grading System */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-3">
          <div className="flex items-center space-x-2 text-gray-900">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Grading System</h3>
          </div>

          <label className="inline-flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableGradingSystem}
              onChange={(e) => setEnableGradingSystem(e.target.checked)}
              className="h-4 w-4 text-amber-600 focus:ring-amber-500 border-gray-300 rounded cursor-pointer"
            />
            <span className="text-xs font-bold text-gray-800">
              {enableGradingSystem ? 'Grading System Enabled' : 'Disabled'}
            </span>
          </label>
        </div>

        {enableGradingSystem ? (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">
              Define score percentage bands for this event. Absolute grade points can be configured inside each program.
            </p>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5">Grade Name</th>
                    <th className="px-4 py-2.5">Min Score (%)</th>
                    <th className="px-4 py-2.5">Max Score (%)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {gradingRules.map((rule, idx) => (
                    <tr key={idx} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={rule.name}
                          onChange={(e) => handleUpdateRule(idx, 'name', e.target.value)}
                          className="w-20 px-2.5 py-1 text-xs font-bold bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                          placeholder="Grade"
                        />
                        <button
                          type="button"
                          onClick={() => handleDeleteRule(idx)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                          title="Delete grade"
                          aria-label={`Delete grade ${rule.name || idx + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={rule.min_mark}
                          onChange={(e) => handleUpdateRule(idx, 'min_mark', e.target.value)}
                          className="w-24 px-2.5 py-1 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={rule.max_mark}
                          onChange={(e) => handleUpdateRule(idx, 'max_mark', e.target.value)}
                          className="w-24 px-2.5 py-1 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={handleAddRule}
                className="px-3.5 py-1.5 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl transition-colors border border-amber-200 flex items-center space-x-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Add Grade Rule</span>
              </button>

              <button
                type="button"
                onClick={handleResetRules}
                className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Grading system is disabled for this event. No extra grade points will be awarded.
          </p>
        )}
      </div>

      {/* 4. Event Points Configuration */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center space-x-2 text-gray-900 border-b border-gray-100 pb-2.5">
          <Award className="h-4 w-4 text-emerald-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Event Points Configuration</h3>
        </div>
        <p className="text-xs text-gray-500">
          Configure placement points (1st, 2nd, 3rd) for this specific event across standard and general/mixed programs.
        </p>

        <div className="max-w-sm bg-emerald-50/60 p-4 rounded-xl border border-emerald-200 space-y-2">
          <h4 className="text-xs font-bold text-gray-900">Participation Points</h4>
          <label className="block text-[11px] font-semibold text-gray-600">
            Points for positions after 3rd place
          </label>
          <input
            type="number"
            min="0"
            value={participationPoints}
            onChange={(e) => setParticipationPoints(e.target.value)}
            className="w-28 px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Standard Category — Individual */}
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
            <h4 className="text-xs font-bold text-gray-900">Standard Category — Individual</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">1st Place</label>
                <input
                  type="number"
                  min="0"
                  value={stdIndFirst}
                  onChange={(e) => setStdIndFirst(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">2nd Place</label>
                <input
                  type="number"
                  min="0"
                  value={stdIndSecond}
                  onChange={(e) => setStdIndSecond(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">3rd Place</label>
                <input
                  type="number"
                  min="0"
                  value={stdIndThird}
                  onChange={(e) => setStdIndThird(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Standard Category — Group / Team */}
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
            <h4 className="text-xs font-bold text-gray-900">Standard Category — Group / Team</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">1st Place</label>
                <input
                  type="number"
                  min="0"
                  value={stdGroupFirst}
                  onChange={(e) => setStdGroupFirst(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">2nd Place</label>
                <input
                  type="number"
                  min="0"
                  value={stdGroupSecond}
                  onChange={(e) => setStdGroupSecond(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">3rd Place</label>
                <input
                  type="number"
                  min="0"
                  value={stdGroupThird}
                  onChange={(e) => setStdGroupThird(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* General / Mixed Category — Individual */}
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
            <h4 className="text-xs font-bold text-gray-900">General / Mixed Category — Individual</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">1st Place</label>
                <input
                  type="number"
                  min="0"
                  value={mixIndFirst}
                  onChange={(e) => setMixIndFirst(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">2nd Place</label>
                <input
                  type="number"
                  min="0"
                  value={mixIndSecond}
                  onChange={(e) => setMixIndSecond(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">3rd Place</label>
                <input
                  type="number"
                  min="0"
                  value={mixIndThird}
                  onChange={(e) => setMixIndThird(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-indigo-100 bg-white p-3">
              <input
                type="checkbox"
                checked={countGeneralIndividualPoints}
                onChange={(e) => setCountGeneralIndividualPoints(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="block text-xs font-bold text-gray-900">Count toward participant personal score</span>
                <span className="mt-1 block text-[11px] leading-4 text-gray-500">
                  When enabled, General/Mixed individual points count in the participant profile, Top Scorers and global student score. Team points are counted in both modes.
                </span>
              </span>
            </label>
          </div>

          {/* General / Mixed Category — Group / Team */}
          <div className="bg-gray-50/70 p-4 rounded-xl border border-gray-200 space-y-3">
            <h4 className="text-xs font-bold text-gray-900">General / Mixed Category — Group / Team</h4>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">1st Place</label>
                <input
                  type="number"
                  min="0"
                  value={mixGroupFirst}
                  onChange={(e) => setMixGroupFirst(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">2nd Place</label>
                <input
                  type="number"
                  min="0"
                  value={mixGroupSecond}
                  onChange={(e) => setMixGroupSecond(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-600 mb-1">3rd Place</label>
                <input
                  type="number"
                  min="0"
                  value={mixGroupThird}
                  onChange={(e) => setMixGroupThird(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Judging & Score Conversion Settings */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-4">
        <div className="flex items-center space-x-2 text-gray-900 border-b border-gray-100 pb-2.5">
          <Award className="h-4 w-4 text-indigo-600" />
          <h3 className="text-xs font-bold uppercase tracking-wider">Judging & Mark Evaluation Rules</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Number of Judges */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-gray-700">Default Number of Judges</label>
              <span className="text-[10px] text-indigo-600 font-semibold bg-indigo-50 px-1.5 py-0.5 rounded">Event Fallback</span>
            </div>
            <p className="text-[11px] text-gray-400">Sets the default for new programs. Individual programs can override this.</p>
            <div className="grid grid-cols-4 gap-1.5 pt-1">
              {[1, 2, 3, 4].map((count) => {
                const isSelected = numJudges === count;
                return (
                  <button
                    key={count}
                    type="button"
                    onClick={() => setNumJudges(count)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    {count} {count === 1 ? 'Judge' : 'Judges'}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Max Mark Per Judge */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700">Max Mark per Judge</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="1000"
                value={maxMarkPerJudge}
                onChange={(e) => setMaxMarkPerJudge(parseFloat(e.target.value) || 1)}
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <span className="absolute right-3 top-2 text-[11px] font-medium text-gray-400">Marks</span>
            </div>
          </div>

          {/* Converted Total Scale */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-gray-700">Converted Final Scale</label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="1000"
                value={convertedTotalMark}
                onChange={(e) => setConvertedTotalMark(parseFloat(e.target.value) || 1)}
                className="w-full px-3.5 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="absolute right-3 top-2 text-[11px] font-medium text-gray-400">Target Scale</span>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default EventSettings;
