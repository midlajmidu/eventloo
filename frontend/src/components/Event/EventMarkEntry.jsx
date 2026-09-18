import React, { useState, useEffect } from 'react';
import { 
  Search,
  CheckCircle,
  Medal,
  X,
  ChevronRight,
  ArrowUpDown
} from 'lucide-react';
import { eventProgramsAPI, markEntryAPI } from '../../services/api';

const EventMarkEntry = ({ eventId, categories: dbCategories = [], event = null }) => {
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  // Filtering on Main Screen
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Sort State in Drawer
  const [sortField, setSortField] = useState('chest'); // 'chest' | 'code' | 'marks'
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' | 'desc'
  const [completedPrograms, setCompletedPrograms] = useState(new Set());

  // Judging Rules from Event Settings
  const numJudges = event?.num_judges ? parseInt(event.num_judges, 10) : 3;
  const maxMarkPerJudge = event?.max_mark_per_judge ? parseFloat(event.max_mark_per_judge) : 100;
  const convertedTotalMark = event?.converted_total_mark ? parseFloat(event.converted_total_mark) : 100;

  // Helper function to safely format numbers
  const safeFormatNumber = (value, decimals = 2) => {
    if (value === null || value === undefined || isNaN(value)) {
      return '-';
    }
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return isNaN(num) ? '-' : num.toFixed(decimals);
  };

  useEffect(() => {
    fetchPrograms();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchPrograms = async () => {
    setLoadingPrograms(true);
    try {
      const response = await eventProgramsAPI.getPrograms(eventId, 'page_size=200');
      const programsData = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setPrograms(programsData);
      
      const completedSet = new Set(
        programsData
          .filter(program => ['submitted', 'published'].includes(program.result_status))
          .map(program => program.id)
      );
      setCompletedPrograms(completedSet);
    } catch (error) {
      console.error('Error fetching programs:', error);
      setMessage('Error loading competitions');
    } finally {
      setLoadingPrograms(false);
    }
  };

  const openMarkEntryDrawer = async (program) => {
    setSelectedProgram(program);
    setDrawerOpen(true);
    setLoadingParticipants(true);
    setSortField('chest');
    setSortOrder('asc');

    try {
      const response = await markEntryAPI.getParticipants(eventId, program.id);
      const partsData = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setParticipants(partsData);
    } catch (error) {
      console.error('Error fetching participants for mark entry:', error);
      setMessage('Failed to load participants');
    } finally {
      setLoadingParticipants(false);
    }
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelectedProgram(null);
    setParticipants([]);
  };

  const handleMarkChange = (participantId, field, value) => {
    const numValue = value === '' ? null : parseFloat(value);
    
    setParticipants(prev => prev.map(p => {
      if (p.id === participantId) {
        const updatedParticipant = { ...p, [field]: numValue };
        
        const judgeValues = [];
        for (let i = 1; i <= numJudges; i++) {
          const val = updatedParticipant[`judge${i}_marks`];
          if (val !== null && val !== undefined && val !== '' && !isNaN(val)) {
            judgeValues.push(parseFloat(val));
          }
        }
        
        if (judgeValues.length > 0) {
          const rawTotal = judgeValues.reduce((a, b) => a + b, 0);
          const maxRawPossible = numJudges * maxMarkPerJudge;
          const convertedTotal = maxRawPossible > 0 ? (rawTotal / maxRawPossible) * convertedTotalMark : rawTotal;
          const averageMarks = rawTotal / judgeValues.length;
          
          updatedParticipant.total_marks = convertedTotal;
          updatedParticipant.average_marks = averageMarks;
        } else {
          updatedParticipant.total_marks = null;
          updatedParticipant.average_marks = null;
        }
        
        return updatedParticipant;
      }
      return p;
    }));
  };

  const handleCodeLetterChange = (participantId, value) => {
    setParticipants(prev => prev.map(p => {
      if (p.id === participantId) {
        return { ...p, code_letter: value.toUpperCase() };
      }
      return p;
    }));
  };

  const handleBulkSubmit = async (isDraft = false) => {
    if (!selectedProgram) return;

    let confirmPublishedEdit = false;
    if (selectedProgram.is_published) {
      confirmPublishedEdit = window.confirm(
        `Results for ${selectedProgram.name} are already published. Do you want to edit these marks?`
      );
      if (!confirmPublishedEdit) return;
    }

    if (!isDraft) {
      const normalizedCodes = participants.map(participant => (participant.code_letter || '').trim().toUpperCase());
      if (normalizedCodes.some(code => !code)) {
        setMessage('Enter a code letter for every participant before submitting marks.');
        return;
      }
      if (new Set(normalizedCodes).size !== normalizedCodes.length) {
        setMessage('Each participant must have a unique code letter within this program.');
        return;
      }
      const invalidRow = participants.find((participant) => {
        for (let i = 1; i <= numJudges; i += 1) {
          const value = participant[`judge${i}_marks`];
          if (value === null || value === undefined || value === '' || Number(value) < 0 || Number(value) > maxMarkPerJudge) {
            return true;
          }
        }
        return false;
      });
      if (invalidRow) {
        setMessage(`Enter all ${numJudges} judge marks between 0 and ${maxMarkPerJudge} before submitting.`);
        return;
      }
    }
    
    setSubmitting(true);
    try {
      const marksPayload = participants.map(p => {
        const judgeValues = [];
        for (let i = 1; i <= numJudges; i++) {
          const val = p[`judge${i}_marks`];
          if (val !== null && val !== undefined && val !== '' && !isNaN(val)) {
            judgeValues.push(parseFloat(val));
          }
        }
        
        let rawTotalMarks = null;
        let totalMarks = null;
        let averageMarks = null;
        
        if (judgeValues.length > 0) {
          rawTotalMarks = judgeValues.reduce((a, b) => a + b, 0);
          const maxRawPossible = numJudges * maxMarkPerJudge;
          totalMarks = maxRawPossible > 0 ? (rawTotalMarks / maxRawPossible) * convertedTotalMark : rawTotalMarks;
          averageMarks = rawTotalMarks / judgeValues.length;
        }
        
        const payloadItem = {
          id: p.id,
          code_letter: p.code_letter || '',
          judge1_marks: numJudges >= 1 ? (p.judge1_marks ?? null) : null,
          judge2_marks: numJudges >= 2 ? (p.judge2_marks ?? null) : null,
          judge3_marks: numJudges >= 3 ? (p.judge3_marks ?? null) : null,
          judge4_marks: numJudges >= 4 ? (p.judge4_marks ?? null) : null,
          raw_total_marks: rawTotalMarks,
          total_marks: totalMarks,
          average_marks: averageMarks,
          marks_out_of_100: totalMarks,
          comments: p.comments || ''
        };
        
        if (p.is_team_based && p.team) {
          payloadItem.team_id = p.team;
        }
        
        return payloadItem;
      });

      await markEntryAPI.bulkUpdateMarks(
        eventId,
        selectedProgram.id,
        marksPayload,
        isDraft ? 'draft' : 'submitted',
        confirmPublishedEdit
      );
      
      // Refresh participant results
      const response = await markEntryAPI.getParticipants(eventId, selectedProgram.id);
      const updatedParts = Array.isArray(response.data) ? response.data : (response.data.results || []);
      setParticipants(updatedParts);

      if (!isDraft) {
        setCompletedPrograms(prev => new Set([...prev, selectedProgram.id]));
        setMessage(`Marks submitted successfully for ${selectedProgram.name}!`);
        window.dispatchEvent(new CustomEvent('pointsUpdated', { detail: { eventId: parseInt(eventId) } }));
        closeDrawer();
      } else {
        setMessage(`Draft saved successfully for ${selectedProgram.name}.`);
        setTimeout(() => setMessage(''), 3000);
      }
    } catch (error) {
      console.error('Error submitting marks:', error);
      const detail = error.response?.data?.error || error.response?.data?.message;
      const readableDetail = typeof detail === 'object'
        ? Object.entries(detail).map(([field, value]) => `${field}: ${Array.isArray(value) ? value.join(', ') : value}`).join(' ')
        : detail;
      setMessage(readableDetail || 'Failed to save marks. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Sort participants in drawer
  const sortedParticipants = [...participants].sort((a, b) => {
    if (sortField === 'code') {
      const codeA = a.code_letter || '';
      const codeB = b.code_letter || '';
      return sortOrder === 'asc' ? codeA.localeCompare(codeB) : codeB.localeCompare(codeA);
    }
    if (sortField === 'marks') {
      const markA = a.total_marks ?? -1;
      const markB = b.total_marks ?? -1;
      return sortOrder === 'asc' ? markA - markB : markB - markA;
    }
    // Default: Sort by Chest Number
    const chestA = parseInt(a.chest_number, 10) || 0;
    const chestB = parseInt(b.chest_number, 10) || 0;
    return sortOrder === 'asc' ? chestA - chestB : chestB - chestA;
  });

  // Filtered Programs for Main Competition Table
  const filteredPrograms = programs.filter(prog => {
    const matchesSearch = !searchQuery || prog.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || prog.category === categoryFilter;
    
    const isCompleted = completedPrograms.has(prog.id);
    let matchesStatus = true;
    if (statusFilter === 'completed') matchesStatus = isCompleted;
    if (statusFilter === 'pending') matchesStatus = !isCompleted;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusBadge = (programId) => {
    const hasMarks = completedPrograms.has(programId);
    if (hasMarks) {
      return (
        <span className="px-2.5 py-1 text-xs font-semibold text-emerald-700 bg-emerald-100/80 rounded-full inline-flex items-center">
          <CheckCircle className="w-3 h-3 mr-1 text-emerald-600" />
          Marks Entered
        </span>
      );
    }
    return (
      <span className="px-2.5 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-full">
        Pending
      </span>
    );
  };

  const categoriesList = dbCategories.length > 0 ? dbCategories.map(cat => ({
    value: cat.code,
    label: cat.name || cat.code.toUpperCase()
  })) : [
    { value: 'junior', label: 'Junior' },
    { value: 'hs', label: 'High School' },
    { value: 'hss', label: 'Higher Secondary' },
    { value: 'general', label: 'General' },
  ];

  return (
    <div className="space-y-6">
      {/* Header Card Box */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Mark Entry</h1>
          <p className="text-xs text-gray-500 mt-0.5">Enter and manage judge marks for <span className="font-semibold text-gray-700">{event?.title || 'this event'}</span></p>
        </div>
      </div>

      {/* Message Notification */}
      {message && (
        <div className={`p-4 rounded-lg text-sm font-medium flex items-center gap-2 ${
          /failed|error|enter|required|unique|invalid/i.test(message)
            ? 'bg-red-50 text-red-700 border border-red-200' 
            : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
        }`}>
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          {message}
        </div>
      )}

      {/* Minimal Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search competitions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50/50"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-end">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
          >
            <option value="">All Categories</option>
            {categoriesList.map(cat => (
              <option key={cat.value} value={cat.value}>{cat.label}</option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-700"
          >
            <option value="">All Statuses</option>
            <option value="completed">Marks Entered</option>
            <option value="pending">Pending</option>
          </select>
        </div>
      </div>

      {/* Competitions Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
        {loadingPrograms ? (
          <div className="p-12 text-center text-gray-500">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
            <p className="text-sm">Loading competitions...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-gray-50/80 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Competition</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Gender</th>
                  <th className="px-6 py-3.5 text-xs font-semibold text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3.5 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredPrograms.length > 0 ? (
                  filteredPrograms.map((prog) => (
                    <tr key={prog.id} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">{prog.name}</div>
                        <div className="text-xs text-gray-400">
                          {prog.is_team_based ? 'Team Competition' : 'Individual Competition'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 capitalize">
                        {prog.category_display || prog.category || 'General'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 capitalize">
                        {prog.gender || 'General'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(prog.id)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <button
                          onClick={() => openMarkEntryDrawer(prog)}
                          className="px-3.5 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg transition-colors inline-flex items-center space-x-1.5 border border-indigo-200 shadow-2xs"
                        >
                          <span>Enter Mark</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-gray-400 text-sm">
                      No competitions found matching filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-Over Drawer from Right to Left */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Overlay */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs transition-opacity"
            onClick={closeDrawer}
          />

          <div className="fixed inset-y-0 right-0 max-w-2xl w-full bg-white shadow-2xl flex flex-col z-50 transform transition-transform duration-300 ease-in-out">
            
            {/* Drawer Header */}
            <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900">
                  {selectedProgram?.name} - <span className="capitalize">{selectedProgram?.category_display || selectedProgram?.category}</span>
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Anonymous evaluation by Chest Number & Secret Code Letter
                </p>
              </div>
              <button
                onClick={closeDrawer}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Judges Config Info */}
            <div className="px-6 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wider flex items-center">
                <Medal className="w-4 h-4 mr-1 text-indigo-600" />
                Judges ({numJudges} Active)
              </label>
              <div className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 px-3 py-1 rounded-full font-medium">
                Max {maxMarkPerJudge} marks per judge ➔ Scaled / {convertedTotalMark}
              </div>
            </div>

            {/* Main Drawer Table Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {loadingParticipants ? (
                <div className="py-20 text-center text-gray-500">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
                  <p className="text-sm">Loading participants...</p>
                </div>
              ) : (
                <>
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-2xs">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-600">
                        <tr>
                          <th className="px-4 py-3 text-center border-r border-gray-200 w-24">Chest #</th>
                          <th className="px-4 py-3 text-center border-r border-gray-200 w-32">Code Letter</th>
                          {Array.from({ length: numJudges }).map((_, idx) => (
                            <th key={idx} className="px-3 py-3 text-center border-r border-gray-200">
                              Judge {idx + 1}
                            </th>
                          ))}
                          <th className="px-4 py-3 text-right">Final Mark</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-sm bg-white">
                        {sortedParticipants.length > 0 ? (
                          sortedParticipants.map((participant) => (
                            <tr key={participant.id} className="hover:bg-indigo-50/30 transition-colors">
                              {/* Chest Number ONLY - Anonymous Grading */}
                              <td className="px-4 py-3 text-center font-bold text-gray-900 border-r border-gray-200 bg-gray-50/30">
                                {participant.chest_number || '#'}
                              </td>

                              {/* Code Letter Input */}
                              <td className="px-4 py-3 text-center border-r border-gray-200">
                                <input
                                  type="text"
                                  maxLength="10"
                                  value={participant.code_letter || ''}
                                  onChange={(e) => handleCodeLetterChange(participant.id, e.target.value)}
                                  placeholder="Code"
                                  className="w-20 px-2 py-1 text-center font-bold text-xs uppercase border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white shadow-2xs"
                                />
                              </td>

                              {/* Dynamic Judge Scores */}
                              {Array.from({ length: numJudges }).map((_, idx) => {
                                const judgeNum = idx + 1;
                                const fieldName = `judge${judgeNum}_marks`;
                                return (
                                  <td key={judgeNum} className="px-3 py-3 text-center border-r border-gray-200">
                                    <input
                                      type="number"
                                      min="0"
                                      max={maxMarkPerJudge}
                                      step="0.01"
                                      value={participant[fieldName] ?? ''}
                                      onChange={(e) => handleMarkChange(participant.id, fieldName, e.target.value)}
                                      placeholder={`0-${maxMarkPerJudge}`}
                                      className="w-16 px-2 py-1 text-center font-semibold text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:outline-none bg-white shadow-2xs"
                                    />
                                  </td>
                                );
                              })}

                              {/* Calculated Final Score */}
                              <td className="px-4 py-3 text-right font-extrabold text-gray-900">
                                {participant.total_marks !== null && participant.total_marks !== undefined ? (
                                  <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
                                    {safeFormatNumber(participant.total_marks)}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 font-medium text-xs">-</span>
                                )}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td colSpan={3 + numJudges} className="px-4 py-12 text-center text-gray-400 text-xs">
                              No participants assigned to this competition yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Sorting Action Buttons */}
                  <div className="flex items-center space-x-3 pt-2">
                    <button
                      onClick={() => {
                        setSortField('code');
                        setSortOrder(prev => sortField === 'code' && prev === 'asc' ? 'desc' : 'asc');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center space-x-1 ${
                        sortField === 'code' 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs' 
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <ArrowUpDown className="w-3 h-3 mr-1" />
                      <span>Sort by Code Letter</span>
                    </button>

                    <button
                      onClick={() => {
                        setSortField('marks');
                        setSortOrder(prev => sortField === 'marks' && prev === 'desc' ? 'asc' : 'desc');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center space-x-1 ${
                        sortField === 'marks' 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs' 
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <ArrowUpDown className="w-3 h-3 mr-1" />
                      <span>Sort by Marks</span>
                    </button>

                    <button
                      onClick={() => {
                        setSortField('chest');
                        setSortOrder(prev => sortField === 'chest' && prev === 'asc' ? 'desc' : 'asc');
                      }}
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors flex items-center space-x-1 ${
                        sortField === 'chest' 
                          ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs' 
                          : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <ArrowUpDown className="w-3 h-3 mr-1" />
                      <span>Sort by Chest #</span>
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Bottom Sticky Action Bar */}
            <div className="p-6 border-t border-gray-200 bg-white flex items-center justify-end space-x-3 sticky bottom-0 z-10">
              <button
                type="button"
                onClick={closeDrawer}
                className="px-4 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              
              {!selectedProgram?.is_published && (
                <button
                  type="button"
                  onClick={() => handleBulkSubmit(true)}
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save as Draft'}
                </button>
              )}

              <button
                type="button"
                onClick={() => handleBulkSubmit(false)}
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors shadow-2xs disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : 'Submit Marks'}
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default EventMarkEntry;
