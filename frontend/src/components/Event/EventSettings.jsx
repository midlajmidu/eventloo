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
  Sparkles,
  Copy,
  Check,
  CheckCircle2,
  Theater,
  SlidersHorizontal,
  User,
  Users,
  Tag,
  Tags
} from 'lucide-react';
import { eventsAPI, categoriesAPI, eventProgramTypesAPI } from '../../services/api';

const getDefaultGradeRules = (scale = 100) => {
  const s = parseFloat(scale) || 100;
  if (Math.abs(s - 100) < 0.01) {
    return [
      { name: 'A+', min_mark: 90, max_mark: 100, bonus_points: 3 },
      { name: 'A',  min_mark: 80, max_mark: 89.99, bonus_points: 2 },
      { name: 'B+', min_mark: 70, max_mark: 79.99, bonus_points: 1 },
      { name: 'B',  min_mark: 60, max_mark: 69.99, bonus_points: 0 }
    ];
  }
  const round2 = (num) => Math.round(num * 100) / 100;
  return [
    { name: 'A+', min_mark: round2(s * 0.9), max_mark: s, bonus_points: 3 },
    { name: 'A',  min_mark: round2(s * 0.8), max_mark: round2(s * 0.9 - 0.01), bonus_points: 2 },
    { name: 'B+', min_mark: round2(s * 0.7), max_mark: round2(s * 0.8 - 0.01), bonus_points: 1 },
    { name: 'B',  min_mark: round2(s * 0.6), max_mark: round2(s * 0.7 - 0.01), bonus_points: 0 }
  ];
};

const DEFAULT_GRADE_RULES = getDefaultGradeRules(100);

const EventSettings = ({ event, eventId, onRefresh }) => {
  const [activeSettingsTab, setActiveSettingsTab] = useState('registration-limits');
  const [numJudges, setNumJudges] = useState(3);
  const [maxMarkPerJudge, setMaxMarkPerJudge] = useState(100);
  const [convertedTotalMark, setConvertedTotalMark] = useState(100);
  const [savingJudgeSettings, setSavingJudgeSettings] = useState(false);
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  
  // Student Program Limits (0 = Unlimited)
  const [maxSinglePrograms, setMaxSinglePrograms] = useState(3);
  const [isSingleUnlimited, setIsSingleUnlimited] = useState(false);

  const [maxGroupPrograms, setMaxGroupPrograms] = useState(0);
  const [isGroupUnlimited, setIsGroupUnlimited] = useState(true);

  // Category-wise limits
  const [categories, setCategories] = useState([]);
  const [loadingCategories, setLoadingCategories] = useState(false);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState('');
  const [categoryLimits, setCategoryLimits] = useState({});
  const [appliedToAllSuccess, setAppliedToAllSuccess] = useState(false);
  const [programTypes, setProgramTypes] = useState(event?.program_types || []);

  // Helper to construct default category limits
  const createDefaultCategoryLimits = (saved = {}, eventDefaults = {}, pTypes = programTypes) => {
    const tot = saved?.max_total !== undefined ? Number(saved.max_total) : 0;
    const sin = saved?.max_single !== undefined 
      ? Number(saved.max_single) 
      : (eventDefaults.max_single !== undefined ? Number(eventDefaults.max_single) : 3);
    const grp = saved?.max_group !== undefined 
      ? Number(saved.max_group) 
      : (eventDefaults.max_group !== undefined ? Number(eventDefaults.max_group) : 0);

    const savedTypeLimits = saved?.type_limits || {};
    const type_limits = {};

    const activeTypes = pTypes && pTypes.length > 0 ? pTypes : [
      { code: 'stage', name: 'Stage', is_stage_based: true, color: '#4F46E5' },
      { code: 'off_stage', name: 'Off-Stage', is_stage_based: false, color: '#10B981' }
    ];

    activeTypes.forEach(pt => {
      let val;
      if (savedTypeLimits[pt.code] !== undefined) {
        val = Number(savedTypeLimits[pt.code]);
      } else if (pt.code === 'stage' && saved.max_onstage !== undefined) {
        val = Number(saved.max_onstage);
      } else if (pt.code === 'off_stage' && saved.max_offstage !== undefined) {
        val = Number(saved.max_offstage);
      } else {
        val = 3;
      }
      type_limits[pt.code] = {
        max: val > 0 ? val : 3,
        is_unlimited: val === 0,
      };
    });

    const on = saved?.max_onstage !== undefined 
      ? Number(saved.max_onstage) 
      : (type_limits['stage'] ? (type_limits['stage'].is_unlimited ? 0 : type_limits['stage'].max) : 3);
    const off = saved?.max_offstage !== undefined 
      ? Number(saved.max_offstage) 
      : (type_limits['off_stage'] ? (type_limits['off_stage'].is_unlimited ? 0 : type_limits['off_stage'].max) : 3);

    return {
      max_total: tot > 0 ? tot : 5,
      is_total_unlimited: tot === 0,
      max_onstage: on > 0 ? on : 3,
      is_onstage_unlimited: on === 0,
      max_offstage: off > 0 ? off : 3,
      is_offstage_unlimited: off === 0,
      max_single: sin > 0 ? sin : 3,
      is_single_unlimited: sin === 0,
      max_group: grp > 0 ? grp : 2,
      is_group_unlimited: grp === 0,
      type_limits,
    };
  };

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

  // Fetch school categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        setLoadingCategories(true);
        const res = await categoriesAPI.list();
        const list = res?.data?.results || res?.data || [];
        const cats = Array.isArray(list) ? list : [];
        setCategories(cats);
        if (cats.length > 0 && !selectedCategoryTab) {
          const firstStandard = cats.find(c => !c.is_mixing && !['general', 'gen', 'gn', 'open'].includes((c.code || '').toLowerCase())) || cats[0];
          if (firstStandard) {
            setSelectedCategoryTab(firstStandard.code);
          }
        }
      } catch (err) {
        console.warn('Failed to load categories:', err);
      } finally {
        setLoadingCategories(false);
      }
    };
    fetchCategories();
  }, []);

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

      // Populate category-specific limits
      const savedCatLimits = event.category_participation_limits || {};
      const newLimitsMap = {};
      const allCodes = new Set([
        ...categories.map(c => c.code),
        ...Object.keys(savedCatLimits)
      ]);
      allCodes.forEach(code => {
        if (!code) return;
        newLimitsMap[code] = createDefaultCategoryLimits(
          savedCatLimits[code],
          {
            max_single: event.max_single_programs_per_student,
            max_group: event.max_group_programs_per_student,
          }
        );
      });
      setCategoryLimits(newLimitsMap);

      const scale = event.converted_total_mark ? parseFloat(event.converted_total_mark) : 100;
      setEnableGradingSystem(event.enable_grading_system ?? true);
      if (Array.isArray(event.grading_rules) && event.grading_rules.length > 0) {
        setGradingRules(event.grading_rules.map(({ name, min_mark, max_mark, bonus_points, points }) => ({
          name,
          min_mark,
          max_mark,
          bonus_points: parseInt(bonus_points ?? points ?? 0, 10) || 0,
        })));
      } else {
        setGradingRules(getDefaultGradeRules(scale));
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

  // Synchronize categoryLimits whenever categories list becomes available
  useEffect(() => {
    if (categories.length > 0 && event) {
      const savedCatLimits = event.category_participation_limits || {};
      setCategoryLimits(prev => {
        const next = { ...prev };
        let updated = false;
        categories.forEach(cat => {
          if (!next[cat.code]) {
            next[cat.code] = createDefaultCategoryLimits(
              savedCatLimits[cat.code],
              {
                max_single: event.max_single_programs_per_student,
                max_group: event.max_group_programs_per_student,
              }
            );
            updated = true;
          }
        });
        return updated ? next : prev;
      });
      if (!selectedCategoryTab) {
        const firstStandard = categories.find(c => !c.is_mixing && !['general', 'gen', 'gn', 'open'].includes((c.code || '').toLowerCase())) || categories[0];
        if (firstStandard) {
          setSelectedCategoryTab(firstStandard.code);
        }
      }
    }
  }, [categories, event]);

  // Load event-scoped program types
  useEffect(() => {
    const actualId = eventId || event?.id;
    if (actualId) {
      eventProgramTypesAPI.list(actualId)
        .then((res) => {
          const list = res.data?.results || res.data || [];
          if (Array.isArray(list) && list.length > 0) {
            setProgramTypes(list);
          } else if (event?.program_types) {
            setProgramTypes(event.program_types);
          }
        })
        .catch(() => {
          if (event?.program_types) setProgramTypes(event.program_types);
        });
    }
  }, [eventId, event?.id, event?.program_types]);

  const updateSelectedCategoryLimit = (field, value) => {
    if (!selectedCategoryTab) return;
    setCategoryLimits(prev => ({
      ...prev,
      [selectedCategoryTab]: {
        ...(prev[selectedCategoryTab] || createDefaultCategoryLimits()),
        [field]: value
      }
    }));
  };

  const updateSelectedCategoryTypeLimit = (typeCode, field, value) => {
    if (!selectedCategoryTab) return;
    setCategoryLimits(prev => {
      const cur = prev[selectedCategoryTab] || createDefaultCategoryLimits();
      const curTypeLimits = { ...(cur.type_limits || {}) };
      const curType = curTypeLimits[typeCode] || { max: 3, is_unlimited: false };
      curTypeLimits[typeCode] = {
        ...curType,
        [field]: value
      };
      const updated = {
        ...cur,
        type_limits: curTypeLimits,
      };
      if (typeCode === 'stage') {
        if (field === 'max') updated.max_onstage = value;
        if (field === 'is_unlimited') updated.is_onstage_unlimited = value;
      }
      if (typeCode === 'off_stage') {
        if (field === 'max') updated.max_offstage = value;
        if (field === 'is_unlimited') updated.is_offstage_unlimited = value;
      }
      return {
        ...prev,
        [selectedCategoryTab]: updated
      };
    });
  };

  const handleApplyToAllCategories = () => {
    if (!selectedCategoryTab) return;
    const currentConfig = categoryLimits[selectedCategoryTab] || createDefaultCategoryLimits();
    setCategoryLimits(prev => {
      const next = { ...prev };
      categories.forEach(cat => {
        next[cat.code] = { ...currentConfig };
      });
      return next;
    });
    setAppliedToAllSuccess(true);
    setTimeout(() => {
      setAppliedToAllSuccess(false);
    }, 3000);
  };

  // Dedicated handler to save judge & scoring scale first
  const handleSaveJudgeSettings = async () => {
    if (!eventId) return;
    setSavingJudgeSettings(true);
    setMessage('');
    try {
      const payload = {
        num_judges: parseInt(numJudges, 10) || 3,
        max_mark_per_judge: parseFloat(maxMarkPerJudge) || 100,
        converted_total_mark: parseFloat(convertedTotalMark) || 100,
      };

      if (eventsAPI.patchEvent) {
        await eventsAPI.patchEvent(eventId, payload);
      } else {
        await eventsAPI.updateEvent(eventId, {
          title: event?.title || '',
          description: event?.description || '',
          event_type: event?.event_type || 'other',
          status: event?.status || 'published',
          start_date: event?.start_date,
          end_date: event?.end_date,
          ...payload,
        });
      }

      setMessage(`Judge criteria & Converted Final Scale (${convertedTotalMark} marks) saved successfully!`);
      setMessageType('success');
      if (onRefresh) await onRefresh();
      setTimeout(() => setMessage(''), 3500);
    } catch (err) {
      console.error('Error saving judge settings:', err);
      let errMsg = 'Failed to save judge settings';
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
            errMsg = Array.isArray(val) ? `${firstKey}: ${val.join(', ')}` : `${firstKey}: ${val}`;
          }
        }
      }
      setMessage(errMsg);
      setMessageType('error');
    } finally {
      setSavingJudgeSettings(false);
    }
  };

  // Grade Rule Handlers
  const handleAddRule = () => {
    const s = parseFloat(convertedTotalMark) || 100;
    const round2 = (num) => Math.round(num * 100) / 100;
    setGradingRules(prev => [
      ...prev,
      { name: 'C+', min_mark: round2(s * 0.5), max_mark: round2(s * 0.6 - 0.01), bonus_points: 0 }
    ]);
  };

  const handleUpdateRule = (index, field, value) => {
    setGradingRules(prev => {
      const next = [...prev];
      let formattedVal = value;
      if (field === 'min_mark' || field === 'max_mark') {
        formattedVal = parseFloat(value) || 0;
      } else if (field === 'bonus_points') {
        formattedVal = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
      }
      next[index] = { ...next[index], [field]: formattedVal };
      return next;
    });
  };

  const handleDeleteRule = (index) => {
    setGradingRules(prev => prev.filter((_, i) => i !== index));
  };

  const handleResetRules = () => {
    setGradingRules(getDefaultGradeRules(convertedTotalMark));
  };

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!eventId) return;

    setSaving(true);
    setMessage('');

    try {
      // Format sanitized category limits dictionary
      const formattedCategoryLimits = {};
      const formatCategoryObj = (cur) => {
        const typeLimitsFormatted = {};
        if (cur.type_limits) {
          Object.entries(cur.type_limits).forEach(([tCode, tObj]) => {
            typeLimitsFormatted[tCode] = tObj.is_unlimited ? 0 : (parseInt(tObj.max, 10) || 0);
          });
        }
        const onstageVal = typeLimitsFormatted['stage'] !== undefined
          ? typeLimitsFormatted['stage']
          : (cur.is_onstage_unlimited ? 0 : (parseInt(cur.max_onstage, 10) || 0));
        const offstageVal = typeLimitsFormatted['off_stage'] !== undefined
          ? typeLimitsFormatted['off_stage']
          : (cur.is_offstage_unlimited ? 0 : (parseInt(cur.max_offstage, 10) || 0));

        typeLimitsFormatted['stage'] = onstageVal;
        typeLimitsFormatted['off_stage'] = offstageVal;

        return {
          max_total: cur.is_total_unlimited ? 0 : (parseInt(cur.max_total, 10) || 0),
          max_onstage: onstageVal,
          max_offstage: offstageVal,
          type_limits: typeLimitsFormatted,
          max_single: cur.is_single_unlimited ? 0 : (parseInt(cur.max_single, 10) || 0),
          max_group: cur.is_group_unlimited ? 0 : (parseInt(cur.max_group, 10) || 0),
        };
      };

      categories.forEach(cat => {
        const cur = categoryLimits[cat.code] || createDefaultCategoryLimits();
        formattedCategoryLimits[cat.code] = formatCategoryObj(cur);
      });

      // Include any other category entries present in categoryLimits state
      Object.keys(categoryLimits).forEach(catCode => {
        if (!formattedCategoryLimits[catCode]) {
          formattedCategoryLimits[catCode] = formatCategoryObj(categoryLimits[catCode]);
        }
      });

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
        category_participation_limits: formattedCategoryLimits,
        enable_grading_system: enableGradingSystem,
        grading_rules: gradingRules.map(r => ({
          name: r.name,
          min_mark: parseFloat(r.min_mark) || 0,
          max_mark: parseFloat(r.max_mark) || 0,
          bonus_points: Math.max(0, parseInt(r.bonus_points, 10) || 0),
        })),

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

      {/* 2-Tab Settings Navigation */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-gray-100/90 p-1.5 rounded-2xl border border-gray-200">
        <button
          type="button"
          onClick={() => setActiveSettingsTab('registration-limits')}
          className={`px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2.5 cursor-pointer ${
            activeSettingsTab === 'registration-limits'
              ? 'bg-white text-indigo-600 shadow-xs border border-gray-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <Clock className={`h-4 w-4 ${activeSettingsTab === 'registration-limits' ? 'text-indigo-600' : 'text-gray-500'}`} />
          <div className="text-left">
            <div className="font-bold">Registration & Student Limits</div>
            <div className="text-[10px] font-normal text-gray-500">Cutoff time & participation quotas</div>
          </div>
        </button>

        <button
          type="button"
          onClick={() => setActiveSettingsTab('judging-grading')}
          className={`px-4 py-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-2.5 cursor-pointer ${
            activeSettingsTab === 'judging-grading'
              ? 'bg-white text-indigo-600 shadow-xs border border-gray-200'
              : 'text-gray-600 hover:text-gray-900 hover:bg-white/60'
          }`}
        >
          <Award className={`h-4 w-4 ${activeSettingsTab === 'judging-grading' ? 'text-indigo-600' : 'text-gray-500'}`} />
          <div className="text-left">
            <div className="font-bold">Judging, Grading & Points</div>
            <div className="text-[10px] font-normal text-gray-500">Judges, scale, bonus grades & placement points</div>
          </div>
        </button>
      </div>

      {/* TAB 1: REGISTRATION & STUDENT LIMITS */}
      {activeSettingsTab === 'registration-limits' && (
        <div className="space-y-5">
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

      {/* 3. Category-Wise Student Program Participation Limits */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-5">
        {/* Header & Apply to All Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
          <div className="flex items-center space-x-2.5 text-gray-900">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
              <Layers className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                Student Participation Limits (Category-Wise)
              </h3>
              <p className="text-[11px] text-gray-500 mt-0.5">
                Configure separate limits per category for Total, On-Stage, Off-Stage, Solo, and Group programs.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            {appliedToAllSuccess && (
              <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg animate-in fade-in">
                <Check className="w-3.5 h-3.5" />
                <span>Applied to all categories!</span>
              </span>
            )}
            {categories.length > 1 && (
              <button
                type="button"
                onClick={handleApplyToAllCategories}
                disabled={!selectedCategoryTab}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all shadow-2xs cursor-pointer active:scale-95 disabled:opacity-50"
                title="Copy current category limits to all other categories"
              >
                <Copy className="w-3.5 h-3.5 text-indigo-600" />
                <span>Apply to All Categories</span>
              </button>
            )}
          </div>
        </div>

        {/* Categories Tab Selector */}
        {loadingCategories ? (
          <div className="py-4 text-center text-xs text-gray-500">Loading school categories...</div>
        ) : categories.length === 0 ? (
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
            No categories defined yet for your school. Please create student categories in Admin Settings.
          </div>
        ) : (
          <div className="space-y-4">
            {/* Category tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
              {categories
                .filter(
                  (cat) =>
                    !cat.is_mixing &&
                    !['general', 'gen', 'gn', 'open', 'open category'].includes((cat.code || '').toLowerCase()) &&
                    (cat.name || '').toLowerCase() !== 'general'
                )
                .map((cat) => {
                const isSelected = (selectedCategoryTab || '').toLowerCase() === (cat.code || '').toLowerCase();
                const lim = categoryLimits[cat.code] || createDefaultCategoryLimits();
                const isGeneral = false;

                return (
                  <button
                    key={cat.id || cat.code}
                    type="button"
                    onClick={() => setSelectedCategoryTab(cat.code)}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs ring-2 ring-indigo-600/20'
                        : 'bg-gray-50/80 text-gray-700 border-gray-200 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <span>{cat.name}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-bold uppercase ${
                      isSelected ? 'bg-indigo-700/80 text-indigo-100' : 'bg-gray-200 text-gray-600'
                    }`}>
                      {cat.code}
                    </span>
                    {isGeneral ? (
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-medium ${
                        isSelected ? 'bg-indigo-800 text-indigo-200' : 'bg-purple-100 text-purple-700'
                      }`}>
                        General
                      </span>
                    ) : (
                      !lim.is_total_unlimited && (
                        <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-indigo-100 text-indigo-700'
                        }`}>
                          Max {lim.max_total}
                        </span>
                      )
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Category Editor */}
            {(() => {
              const activeCat = categories.find(
                (c) => (c.code || '').toLowerCase() === (selectedCategoryTab || '').toLowerCase()
              ) || categories[0];

              const isGeneral = activeCat && (activeCat.is_mixing || ['general', 'gen', 'gn', 'open'].includes((activeCat.code || '').toLowerCase()));
              const currentLimits = categoryLimits[activeCat?.code] || createDefaultCategoryLimits();

              if (isGeneral) {
                return (
                  <div className="p-4 bg-purple-50/70 border border-purple-200 rounded-xl text-xs text-purple-900 space-y-1.5">
                    <div className="font-bold flex items-center gap-1.5 text-purple-800">
                      <Sparkles className="w-4 h-4 text-purple-600" />
                      <span>{activeCat.name} is a General / Combined Category</span>
                    </div>
                    <p className="text-[11px] text-purple-700">
                      General and combined category programs are universal competitions open to all students across your school. They are unlimited by design and do not consume standard category quotas.
                    </p>
                  </div>
                );
              }

              return (
                <div className="bg-gray-50/60 rounded-xl p-4 border border-gray-200 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-gray-200/80 gap-1">
                    <div>
                      <h4 className="text-xs font-bold text-gray-900 flex items-center gap-1.5">
                        <span>Configuring limits for</span>
                        <span className="text-indigo-600 font-extrabold">{activeCat?.name || selectedCategoryTab}</span>
                        <span className="text-[10px] font-mono bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold">
                          {activeCat?.code || selectedCategoryTab}
                        </span>
                      </h4>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        Students in this category can enter programs up to these independent limits.
                      </p>
                    </div>

                    <span className="text-[11px] font-semibold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full border border-indigo-100 shrink-0">
                      {currentLimits.is_total_unlimited ? 'Total: Unlimited' : `Total Max: ${currentLimits.max_total}`}
                    </span>
                  </div>

                  {/* 5 Limit Cards Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {/* 1. Total Limit */}
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg">
                            <Layers className="w-4 h-4" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-900 block leading-tight">
                              Total Programs Limit
                            </label>
                            <span className="text-[10px] text-gray-500">Overall cap (all types)</span>
                          </div>
                        </div>

                        <label className="inline-flex items-center space-x-1 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={currentLimits.is_total_unlimited}
                            onChange={(e) => updateSelectedCategoryLimit('is_total_unlimited', e.target.checked)}
                            className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                          />
                          <span className="text-[11px] font-semibold text-indigo-700 flex items-center space-x-0.5">
                            <Infinity className="w-3 h-3" />
                            <span>Unlimited</span>
                          </span>
                        </label>
                      </div>

                      {currentLimits.is_total_unlimited ? (
                        <div className="py-2 px-2.5 bg-indigo-50/70 border border-indigo-100 rounded-lg text-xs font-bold text-indigo-800 flex items-center justify-between">
                          <span>Unlimited total programs</span>
                          <Infinity className="w-4 h-4 text-indigo-500" />
                        </div>
                      ) : (
                        <div>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={currentLimits.max_total}
                            onChange={(e) => updateSelectedCategoryLimit('max_total', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            placeholder="e.g. 5"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">Maximum programs student can join in total</p>
                        </div>
                      )}
                    </div>

                    {/* Dynamic Program Type Limit Cards */}
                    {(() => {
                      const typesToRender = programTypes.length > 0 ? programTypes : [
                        { code: 'stage', name: 'Stage', is_stage_based: true, color: '#4F46E5', description: 'Live stage performances' },
                        { code: 'off_stage', name: 'Off-Stage', is_stage_based: false, color: '#10B981', description: 'Non-stage / written / craft' }
                      ];

                      return typesToRender.map((pt) => {
                        const typeLimitsObj = currentLimits.type_limits?.[pt.code] || {
                          max: pt.code === 'stage' ? currentLimits.max_onstage : (pt.code === 'off_stage' ? currentLimits.max_offstage : 3),
                          is_unlimited: pt.code === 'stage' ? currentLimits.is_onstage_unlimited : (pt.code === 'off_stage' ? currentLimits.is_offstage_unlimited : false),
                        };
                        const isUnlim = Boolean(typeLimitsObj.is_unlimited);
                        const maxVal = typeLimitsObj.max ?? 3;
                        const typeColor = pt.color || '#4F46E5';

                        return (
                          <div key={pt.code} className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-center gap-1.5">
                                <div
                                  className="p-1.5 rounded-lg border border-black/5"
                                  style={{ backgroundColor: `${typeColor}15`, color: typeColor }}
                                >
                                  {pt.is_stage_based ? <Theater className="w-4 h-4" /> : <SlidersHorizontal className="w-4 h-4" />}
                                </div>
                                <div>
                                  <label className="text-xs font-bold text-gray-900 block leading-tight">
                                    {pt.name} Limit
                                  </label>
                                  <span className="text-[10px] text-gray-500">
                                    {pt.description || (pt.is_stage_based ? 'Live stage performances' : 'Non-stage / written events')}
                                  </span>
                                </div>
                              </div>

                              <label className="inline-flex items-center space-x-1 cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={isUnlim}
                                  onChange={(e) => updateSelectedCategoryTypeLimit(pt.code, 'is_unlimited', e.target.checked)}
                                  className="h-3.5 w-3.5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded cursor-pointer"
                                />
                                <span className="text-[11px] font-semibold text-gray-700 flex items-center space-x-0.5">
                                  <Infinity className="w-3 h-3 text-indigo-500" />
                                  <span>Unlimited</span>
                                </span>
                              </label>
                            </div>

                            {isUnlim ? (
                              <div
                                className="py-2 px-2.5 rounded-lg text-xs font-bold flex items-center justify-between border"
                                style={{ backgroundColor: `${typeColor}10`, borderColor: `${typeColor}30`, color: typeColor }}
                              >
                                <span>Unlimited {pt.name.toLowerCase()} events</span>
                                <Infinity className="w-4 h-4 opacity-70" />
                              </div>
                            ) : (
                              <div>
                                <input
                                  type="number"
                                  min="1"
                                  max="50"
                                  value={maxVal}
                                  onChange={(e) => updateSelectedCategoryTypeLimit(pt.code, 'max', e.target.value)}
                                  className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                  placeholder="e.g. 3"
                                />
                                <p className="text-[10px] text-gray-500 mt-1">Maximum {pt.name.toLowerCase()} items per student</p>
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}

                    {/* 4. Single Limit */}
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                            <User className="w-4 h-4" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-900 block leading-tight">
                              Single / Solo Events
                            </label>
                            <span className="text-[10px] text-gray-500">Individual competitions</span>
                          </div>
                        </div>

                        <label className="inline-flex items-center space-x-1 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={currentLimits.is_single_unlimited}
                            onChange={(e) => updateSelectedCategoryLimit('is_single_unlimited', e.target.checked)}
                            className="h-3.5 w-3.5 text-amber-600 focus:ring-amber-500 border-gray-300 rounded cursor-pointer"
                          />
                          <span className="text-[11px] font-semibold text-amber-700 flex items-center space-x-0.5">
                            <Infinity className="w-3 h-3" />
                            <span>Unlimited</span>
                          </span>
                        </label>
                      </div>

                      {currentLimits.is_single_unlimited ? (
                        <div className="py-2 px-2.5 bg-amber-50/70 border border-amber-100 rounded-lg text-xs font-bold text-amber-800 flex items-center justify-between">
                          <span>Unlimited single events</span>
                          <Infinity className="w-4 h-4 text-amber-500" />
                        </div>
                      ) : (
                        <div>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={currentLimits.max_single}
                            onChange={(e) => updateSelectedCategoryLimit('max_single', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            placeholder="e.g. 3"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">Maximum solo programs in this category</p>
                        </div>
                      )}
                    </div>

                    {/* 5. Group Limit */}
                    <div className="bg-white p-3.5 rounded-xl border border-gray-200 shadow-2xs space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <div className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                            <Users className="w-4 h-4" />
                          </div>
                          <div>
                            <label className="text-xs font-bold text-gray-900 block leading-tight">
                              Group / Team Events
                            </label>
                            <span className="text-[10px] text-gray-500">Team-based programs</span>
                          </div>
                        </div>

                        <label className="inline-flex items-center space-x-1 cursor-pointer shrink-0">
                          <input
                            type="checkbox"
                            checked={currentLimits.is_group_unlimited}
                            onChange={(e) => updateSelectedCategoryLimit('is_group_unlimited', e.target.checked)}
                            className="h-3.5 w-3.5 text-emerald-600 focus:ring-emerald-500 border-gray-300 rounded cursor-pointer"
                          />
                          <span className="text-[11px] font-semibold text-emerald-700 flex items-center space-x-0.5">
                            <Infinity className="w-3 h-3" />
                            <span>Unlimited</span>
                          </span>
                        </label>
                      </div>

                      {currentLimits.is_group_unlimited ? (
                        <div className="py-2 px-2.5 bg-emerald-50/70 border border-emerald-100 rounded-lg text-xs font-bold text-emerald-800 flex items-center justify-between">
                          <span>Unlimited group events</span>
                          <Infinity className="w-4 h-4 text-emerald-500" />
                        </div>
                      ) : (
                        <div>
                          <input
                            type="number"
                            min="1"
                            max="50"
                            value={currentLimits.max_group}
                            onChange={(e) => updateSelectedCategoryLimit('max_group', e.target.value)}
                            className="w-full px-3 py-1.5 text-xs font-bold text-gray-800 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                            placeholder="e.g. 2"
                          />
                          <p className="text-[10px] text-gray-500 mt-1">Maximum group programs in this category</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Quick Reference Summary Table for All Categories */}
            <div className="mt-4 border border-gray-200 rounded-xl overflow-hidden">
              <div className="bg-gray-100/70 px-4 py-2 border-b border-gray-200 flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">
                  Category Limits Overview Matrix
                </span>
                <span className="text-[10px] text-gray-500">
                  Click any category to edit its limits
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                    <tr>
                      <th className="px-3.5 py-2">Category</th>
                      <th className="px-3 py-2 text-center">Total Limit</th>
                      {(programTypes.length > 0 ? programTypes : [
                        { code: 'stage', name: 'Stage' },
                        { code: 'off_stage', name: 'Off-Stage' }
                      ]).map(pt => (
                        <th key={pt.code} className="px-3 py-2 text-center">{pt.name}</th>
                      ))}
                      <th className="px-3 py-2 text-center">Single / Solo</th>
                      <th className="px-3 py-2 text-center">Group / Team</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 font-medium">
                    {categories
                      .filter(
                        (cat) =>
                          !cat.is_mixing &&
                          !['general', 'gen', 'gn', 'open', 'open category'].includes((cat.code || '').toLowerCase()) &&
                          (cat.name || '').toLowerCase() !== 'general'
                      )
                      .map((cat) => {
                      const isSelected = (selectedCategoryTab || '').toLowerCase() === (cat.code || '').toLowerCase();
                      const lim = categoryLimits[cat.code] || createDefaultCategoryLimits();
                      const isGeneral = false;

                      return (
                        <tr
                          key={cat.id || cat.code}
                          onClick={() => setSelectedCategoryTab(cat.code)}
                          className={`hover:bg-indigo-50/40 transition-colors cursor-pointer ${
                            isSelected ? 'bg-indigo-50/60 font-semibold' : ''
                          }`}
                        >
                          <td className="px-3.5 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-gray-900">{cat.name}</span>
                              <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1 rounded">
                                {cat.code}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isGeneral ? (
                              <span className="text-gray-400 text-[11px] font-medium">—</span>
                            ) : lim.is_total_unlimited ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                <Infinity className="w-3 h-3" /> Unlimited
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                Max {lim.max_total}
                              </span>
                            )}
                          </td>
                          {(programTypes.length > 0 ? programTypes : [
                            { code: 'stage', name: 'Stage' },
                            { code: 'off_stage', name: 'Off-Stage' }
                          ]).map(pt => {
                            const tObj = lim.type_limits?.[pt.code] || {
                              max: pt.code === 'stage' ? lim.max_onstage : (pt.code === 'off_stage' ? lim.max_offstage : 3),
                              is_unlimited: pt.code === 'stage' ? lim.is_onstage_unlimited : (pt.code === 'off_stage' ? lim.is_offstage_unlimited : false),
                            };
                            return (
                              <td key={pt.code} className="px-3 py-2 text-center">
                                {isGeneral ? (
                                  <span className="text-gray-400 text-[11px] font-medium">—</span>
                                ) : tObj.is_unlimited ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                    <Infinity className="w-3 h-3" /> Unlimited
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                                    Max {tObj.max}
                                  </span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-3 py-2 text-center">
                            {isGeneral ? (
                              <span className="text-gray-400 text-[11px] font-medium">—</span>
                            ) : lim.is_single_unlimited ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                <Infinity className="w-3 h-3" /> Unlimited
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                Max {lim.max_single}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isGeneral ? (
                              <span className="text-gray-400 text-[11px] font-medium">—</span>
                            ) : lim.is_group_unlimited ? (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                                <Infinity className="w-3 h-3" /> Unlimited
                              </span>
                            ) : (
                              <span className="inline-flex items-center text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                Max {lim.max_group}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedCategoryTab(cat.code);
                              }}
                              className={`text-[11px] font-bold px-2 py-1 rounded transition-colors ${
                                isSelected
                                  ? 'text-indigo-600 bg-indigo-100'
                                  : 'text-gray-500 hover:text-indigo-600 hover:bg-gray-100'
                              }`}
                            >
                              {isSelected ? 'Editing' : 'Edit'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note banner */}
            <p className="text-[11px] text-gray-500 italic bg-gray-50 p-2.5 rounded-lg border border-gray-200">
              💡 <strong>Pro-Tip:</strong> General / Combined category programs (e.g. General Quiz, Open House) are universal and open to all students across your school. They do not count towards category-specific limits.
            </p>
          </div>
        )}
      </div>
        </div>
      )}

      {/* TAB 2: JUDGING, GRADING & POINTS */}
      {activeSettingsTab === 'judging-grading' && (
        <div className="space-y-5">
          {/* 1. Judging & Score Conversion Settings (Judge Criteria) */}
          <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
              <div className="flex items-center space-x-2.5 text-gray-900">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl border border-indigo-100">
                  <Award className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-900">
                    Judging & Mark Evaluation Rules
                  </h3>
                  <p className="text-[11px] text-gray-500 mt-0.5">
                    Set judge count, max mark per judge, and the target Converted Final Scale before configuring grades.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveJudgeSettings}
                disabled={saving || savingJudgeSettings}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-2xs cursor-pointer disabled:opacity-50 self-start sm:self-auto"
                title="Save judge criteria and final scale first"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{savingJudgeSettings ? 'Saving Scale...' : 'Save Judge Criteria'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-1">
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
                <p className="text-[11px] text-gray-400">Each judge enters marks up to this maximum.</p>
              </div>

              {/* Converted Total Scale */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-semibold text-gray-700">Converted Final Scale</label>
                  <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                    Out of {convertedTotalMark}
                  </span>
                </div>
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
                <p className="text-[11px] text-gray-400">Final scores are scaled to this target (e.g. 50 or 100 marks).</p>
              </div>
            </div>
          </div>

          {/* 2. Grading System */}
      <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-gray-100 pb-3 gap-2">
          <div className="flex items-center space-x-2 text-gray-900">
            <Sparkles className="h-4 w-4 text-amber-500" />
            <h3 className="text-xs font-bold uppercase tracking-wider">Grading System</h3>
            <span className="px-2 py-0.5 text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
              Scale: Out of {convertedTotalMark} marks
            </span>
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50/50 p-3 rounded-xl border border-amber-100">
              <p className="text-xs text-gray-600">
                Define score bands out of your Converted Final Scale (<strong>{convertedTotalMark} marks</strong>) and bonus points. Bonus points are added directly on top of placement points (e.g. 1st place 5 pts + A+ 3 pts = 8 pts; 4th place with B+ receives 1 bonus point).
              </p>
              {Math.abs(convertedTotalMark - 100) > 0.01 && (
                <button
                  type="button"
                  onClick={() => setGradingRules(getDefaultGradeRules(convertedTotalMark))}
                  className="shrink-0 px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors border border-amber-300 cursor-pointer"
                  title={`Rescale default grade thresholds to match ${convertedTotalMark} marks`}
                >
                  Adjust for {convertedTotalMark} Scale
                </button>
              )}
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-700 font-bold border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-2.5">Grade Name</th>
                    <th className="px-4 py-2.5">Min Mark (out of {convertedTotalMark})</th>
                    <th className="px-4 py-2.5">Max Mark (out of {convertedTotalMark})</th>
                    <th className="px-4 py-2.5">Bonus Points (+pts)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium">
                  {gradingRules.map((rule, idx) => {
                    const scaleNum = parseFloat(convertedTotalMark) || 100;
                    const minPct = scaleNum > 0 ? ((rule.min_mark / scaleNum) * 100).toFixed(0) : 0;
                    const maxPct = scaleNum > 0 ? ((rule.max_mark / scaleNum) * 100).toFixed(0) : 0;
                    return (
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
                          <div className="flex flex-col space-y-0.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={Math.max(100, scaleNum)}
                              value={rule.min_mark}
                              onChange={(e) => handleUpdateRule(idx, 'min_mark', e.target.value)}
                              className="w-24 px-2.5 py-1 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            />
                            <span className="text-[10px] text-gray-400 font-medium">{minPct}% of scale</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex flex-col space-y-0.5">
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              max={Math.max(100, scaleNum)}
                              value={rule.max_mark}
                              onChange={(e) => handleUpdateRule(idx, 'max_mark', e.target.value)}
                              className="w-24 px-2.5 py-1 text-xs font-semibold bg-gray-50 border border-gray-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                            />
                            <span className="text-[10px] text-gray-400 font-medium">{maxPct}% of scale</span>
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-xs font-black text-amber-600">+</span>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={rule.bonus_points ?? 0}
                              onChange={(e) => handleUpdateRule(idx, 'bonus_points', e.target.value)}
                              className="w-20 px-2.5 py-1 text-xs font-bold text-gray-900 bg-amber-50/60 border border-amber-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-none"
                              placeholder="0"
                            />
                            <span className="text-[11px] font-bold text-gray-500">pts</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
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
                <span>Reset Defaults ({convertedTotalMark} scale)</span>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-gray-400 italic">
            Grading system is disabled for this event. No bonus points will be awarded for grades.
          </p>
        )}
      </div>

      {/* 5. Event Points Configuration */}
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
        </div>
      )}

      {/* Bottom Save Action */}
      <div className="flex justify-end pt-2 pb-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving...' : 'Save All Settings'}</span>
        </button>
      </div>

    </div>
  );
};

export default EventSettings;
