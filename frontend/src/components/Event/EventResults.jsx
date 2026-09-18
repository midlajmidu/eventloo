import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { 
  Search, 
  X, 
  ChevronDown, 
  Printer, 
  Eye, 
  Globe, 
  CheckCircle,
  FileSpreadsheet,
  MoreVertical
} from 'lucide-react';
import { 
  eventProgramsAPI, 
  markEntryAPI, 
  eventResultsAPI, 
  eventPointsAPI 
} from '../../services/api';

const addCompetitionRanks = (rows) => {
  let previousPoints = null;
  let previousRank = 0;
  return rows.map((row, index) => {
    const points = Number(row.total_points || 0);
    const rank = index > 0 && points === previousPoints ? previousRank : index + 1;
    previousPoints = points;
    previousRank = rank;
    return { ...row, rank };
  });
};

const EventResults = ({ categories: dynamicCategories = [] }) => {
  const { eventId } = useParams();

  // Programs & Filtering
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  // Team Points Leaderboard
  const [teamPoints, setTeamPoints] = useState([]);
  const [loadingPoints, setLoadingPoints] = useState(false);
  const [pointsFilter, setPointsFilter] = useState('published'); // 'published' or 'all'

  // Slide-over Drawer for Detailed View Result
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerProgram, setDrawerProgram] = useState(null);
  const [drawerResults, setDrawerResults] = useState([]);
  const [loadingDrawerResults, setLoadingDrawerResults] = useState(false);

  // Status message feedback
  const [message, setMessage] = useState('');

  // Active dropdown action menu state (programId)
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    fetchInitialData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    fetchTeamPoints();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, pointsFilter]);

  const fetchInitialData = async () => {
    setLoadingPrograms(true);
    try {
      // Get all programs for this event
      const progsRes = await eventProgramsAPI.getPrograms(eventId, 'page_size=500');
      const allProgs = Array.isArray(progsRes.data) ? progsRes.data : (progsRes.data.results || []);
      
      setPrograms(allProgs);
    } catch (error) {
      console.error('Error loading programs for results:', error);
      setMessage('Failed to load programs');
    } finally {
      setLoadingPrograms(false);
    }
  };

  const fetchTeamPoints = async () => {
    setLoadingPoints(true);
    try {
      const isPublishedOnly = pointsFilter === 'published';
      const pointsRes = await eventPointsAPI.getEventTeamPoints(eventId, isPublishedOnly);
      const pointsList = Array.isArray(pointsRes.data) ? pointsRes.data : (pointsRes.data.results || []);
      setTeamPoints(pointsList);
    } catch (error) {
      console.error('Error loading team points:', error);
    } finally {
      setLoadingPoints(false);
    }
  };

  // Toggle Publish / Unpublish single program
  const handleTogglePublish = async (program) => {
    setOpenMenuId(null);
    const newPublishStatus = !program.is_published;
    try {
      await eventResultsAPI.toggleProgramPublish(eventId, program.id, newPublishStatus);
      // Update local programs state
      setPrograms(prev => prev.map(p => p.id === program.id ? { 
        ...p, 
        is_published: newPublishStatus,
        result_status: newPublishStatus ? 'published' : 'submitted' 
      } : p));
      // Refresh team points
      fetchTeamPoints();
      setMessage(`Results for ${program.name} ${newPublishStatus ? 'published' : 'unpublished'} successfully!`);
      setTimeout(() => setMessage(''), 4000);
    } catch (error) {
      console.error('Error toggling program publish:', error);
      const errMsg = error.response?.data?.error || 'Failed to update publish status. Please complete mark entry first.';
      setMessage(errMsg);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Publish all submitted programs
  const handlePublishAll = async () => {
    try {
      const res = await eventResultsAPI.publishAllResults(eventId);
      const { published_count = 0, skipped_incomplete_program_ids = [] } = res.data || {};
      fetchInitialData();
      fetchTeamPoints();
      if (published_count > 0) {
        const skippedCount = skipped_incomplete_program_ids.length;
        setMessage(`Published results for ${published_count} completed competition(s)!${skippedCount > 0 ? ` (${skippedCount} incomplete skipped)` : ''}`);
      } else {
        setMessage('No completed competition results available to publish. Mark entry must be entered first.');
      }
      setTimeout(() => setMessage(''), 4000);
    } catch (error) {
      console.error('Error publishing all results:', error);
      const errMsg = error.response?.data?.error || 'Failed to publish all results';
      setMessage(errMsg);
      setTimeout(() => setMessage(''), 5000);
    }
  };

  // Open Detailed Slide-Over View Result Drawer
  const handleOpenDrawer = async (program) => {
    setOpenMenuId(null);
    setDrawerProgram(program);
    setDrawerOpen(true);
    setLoadingDrawerResults(true);

    try {
      const res = await markEntryAPI.getParticipants(eventId, program.id);
      const allParticipants = res.data || [];

      // Filter & Sort by position or average marks
      const withMarks = allParticipants.filter(p =>
        p.entry_status === 'submitted' && (
          p.judge1_marks !== null ||
          p.judge2_marks !== null ||
          p.judge3_marks !== null ||
          p.judge4_marks !== null ||
          p.average_marks !== null ||
          p.position > 0
        )
      );

      const sorted = withMarks.sort((a, b) => {
        if (a.position && b.position) return a.position - b.position;
        if (a.position) return -1;
        if (b.position) return 1;
        return (b.average_marks || 0) - (a.average_marks || 0);
      });

      setDrawerResults(sorted);
    } catch (error) {
      console.error('Error fetching detailed results:', error);
      setDrawerResults([]);
    } finally {
      setLoadingDrawerResults(false);
    }
  };

  // Helper to determine status category for badge
  const getProgramStatus = (program) => {
    if (program.is_published) return 'published';
    if (program.result_status === 'published') return 'published';
    if (program.result_status === 'submitted' || program.is_finished) return 'submitted';
    if (program.result_status === 'in_progress') return 'in_progress';
    return 'pending';
  };

  // Statistics counts
  const statsCounts = programs.reduce((acc, p) => {
    const st = getProgramStatus(p);
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, { pending: 0, in_progress: 0, submitted: 0, published: 0 });

  // Filtered Programs list
  const filteredPrograms = programs.filter(p => {
    const matchesCategory = !selectedCategory || p.category === selectedCategory;
    const matchesSearch = !searchTerm || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  // Prize badge helper
  const renderPrizeBadge = (position) => {
    if (position === 1) {
      return (
        <span className="inline-flex items-center space-x-1 text-xs font-bold text-amber-700">
          <span>🥇</span>
          <span>1st Prize</span>
        </span>
      );
    }
    if (position === 2) {
      return (
        <span className="inline-flex items-center space-x-1 text-xs font-bold text-slate-600">
          <span>🥈</span>
          <span>2nd Prize</span>
        </span>
      );
    }
    if (position === 3) {
      return (
        <span className="inline-flex items-center space-x-1 text-xs font-bold text-amber-800">
          <span>🥉</span>
          <span>3rd Prize</span>
        </span>
      );
    }
    return <span className="text-gray-400 font-medium">-</span>;
  };

  // Helper to format category name
  const getCategoryName = (catCode) => {
    const cat = dynamicCategories.find(c => c.code === catCode);
    if (cat) return cat.name;
    if (catCode === 'hs') return 'High School';
    if (catCode === 'hss') return 'Higher Secondary';
    if (catCode === 'junior') return 'Junior';
    if (catCode === 'general') return 'General';
    return catCode ? catCode.toUpperCase() : 'General';
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      {/* Header Card Box */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Results & Standings</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Manage and reorder competition results, and view team points
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={() => window.print()}
            className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl shadow-2xs inline-flex items-center space-x-1.5 transition-colors"
          >
            <Printer className="w-3.5 h-3.5 text-gray-500" />
            <span>PDF</span>
          </button>
          <button
            onClick={() => {}}
            className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-bold rounded-xl shadow-2xs inline-flex items-center space-x-1.5 transition-colors"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>CSV</span>
          </button>
        </div>
      </div>

      {/* Top Stats Badges Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center bg-gray-100/90 text-gray-700 px-3.5 py-2 rounded-xl text-xs font-bold border border-gray-200">
          <span>Pending</span>
          <span className="ml-2.5 px-2 py-0.5 bg-white rounded-lg shadow-2xs font-extrabold text-gray-900">
            {statsCounts.pending}
          </span>
        </div>

        <div className="flex items-center bg-indigo-50 text-indigo-700 px-3.5 py-2 rounded-xl text-xs font-bold border border-indigo-100">
          <span>In Progress</span>
          <span className="ml-2.5 px-2 py-0.5 bg-white rounded-lg shadow-2xs font-extrabold text-indigo-900">
            {statsCounts.in_progress}
          </span>
        </div>

        <div className="flex items-center bg-amber-50 text-amber-800 px-3.5 py-2 rounded-xl text-xs font-bold border border-amber-100">
          <span>Submitted</span>
          <span className="ml-2.5 px-2 py-0.5 bg-white rounded-lg shadow-2xs font-extrabold text-amber-900">
            {statsCounts.submitted}
          </span>
        </div>

        <div className="flex items-center bg-emerald-50 text-emerald-800 px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-200">
          <span>Published</span>
          <span className="ml-2.5 px-2 py-0.5 bg-white rounded-lg shadow-2xs font-extrabold text-emerald-900">
            {statsCounts.published}
          </span>
        </div>
      </div>

      {/* Feedback Message Banner */}
      {message && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-center space-x-2">
          <CheckCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
          <span>{message}</span>
        </div>
      )}

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Competitions Table (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-4">
            
            {/* Table Search & Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search results..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
                {/* Category selector */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {dynamicCategories.map(cat => (
                    <option key={cat.code} value={cat.code}>{cat.name}</option>
                  ))}
                </select>

                <button
                  onClick={handlePublishAll}
                  className="px-3.5 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl shadow-2xs inline-flex items-center space-x-1.5 transition-colors"
                >
                  <Globe className="w-3.5 h-3.5 text-gray-500" />
                  <span>Publish All</span>
                </button>
              </div>
            </div>

            {/* Competitions Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Competition</th>
                    <th className="px-4 py-3 text-center w-28">Status</th>
                    <th className="px-4 py-3 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white text-xs">
                  {loadingPrograms ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-12 text-center text-gray-400">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600 mx-auto mb-2"></div>
                        <span>Loading competitions...</span>
                      </td>
                    </tr>
                  ) : filteredPrograms.length > 0 ? (
                    filteredPrograms.map((prog, idx) => {
                      const status = getProgramStatus(prog);
                      const isPublished = prog.is_published || status === 'published';
                      const canPublish = isPublished || status === 'submitted';
                      
                      return (
                        <tr key={prog.id} className="hover:bg-gray-50/70 transition-colors">
                          {/* Index # */}
                          <td className="px-4 py-3 text-center text-gray-400 font-semibold">
                            #{idx + 1}
                          </td>

                          {/* Competition Name & Category */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-900 text-xs">
                              {prog.name}
                            </div>
                            <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                              {getCategoryName(prog.category)}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-3 text-center">
                            {status === 'published' && (
                              <span className="inline-block px-3 py-1 bg-emerald-100/80 text-emerald-800 font-bold rounded-full text-[11px]">
                                Published
                              </span>
                            )}
                            {status === 'submitted' && (
                              <span className="inline-block px-3 py-1 bg-amber-100 text-amber-800 font-bold rounded-full text-[11px]">
                                Submitted
                              </span>
                            )}
                            {status === 'in_progress' && (
                              <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 font-bold rounded-full text-[11px]">
                                In Progress
                              </span>
                            )}
                            {status === 'pending' && (
                              <span className="inline-block px-3 py-1 bg-gray-100 text-gray-600 font-bold rounded-full text-[11px]">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Actions Column */}
                          <td className="px-4 py-3 text-right">
                            <div className="relative inline-block text-left">
                              <button
                                onClick={() => setOpenMenuId(openMenuId === prog.id ? null : prog.id)}
                                className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              >
                                <MoreVertical className="w-4 h-4" />
                              </button>

                              {/* Dropdown Action Menu */}
                              {openMenuId === prog.id && (
                                <div className="origin-top-right absolute right-0 mt-1 w-48 rounded-xl bg-white border border-gray-200 shadow-lg z-20 py-1 font-medium text-xs divide-y divide-gray-100">
                                  <button
                                    onClick={() => handleOpenDrawer(prog)}
                                    className="w-full text-left px-3.5 py-2 text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                  >
                                    <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                    <span>View Result</span>
                                  </button>

                                  <button
                                    onClick={() => {
                                      if (!canPublish) {
                                        setMessage(`Cannot publish "${prog.name}": Mark entry has not been completed.`);
                                        setTimeout(() => setMessage(''), 4000);
                                        setOpenMenuId(null);
                                        return;
                                      }
                                      handleTogglePublish(prog);
                                    }}
                                    className={`w-full text-left px-3.5 py-2 flex items-center space-x-2 transition-colors ${
                                      canPublish
                                        ? 'text-gray-700 hover:bg-gray-50'
                                        : 'text-gray-400 bg-gray-50/50 cursor-not-allowed'
                                    }`}
                                    title={!canPublish ? "Mark entry has not been completed for this competition" : ""}
                                  >
                                    <Globe className={`w-3.5 h-3.5 ${isPublished ? 'text-amber-600' : canPublish ? 'text-emerald-600' : 'text-gray-400'}`} />
                                    <div className="flex flex-col">
                                      <span>{isPublished ? 'Unpublish Result' : 'Publish Result'}</span>
                                      {!canPublish && (
                                        <span className="text-[10px] text-amber-600 font-semibold">Marks not entered</span>
                                      )}
                                    </div>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-12 text-center text-gray-400 text-xs">
                        No competition results found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Team Points Leaderboard (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 shadow-2xs space-y-4">
            
            {/* Header & Filter Controls */}
            <div className="flex items-center justify-between gap-2">
              <div className="relative">
                <select
                  value={pointsFilter}
                  onChange={(e) => setPointsFilter(e.target.value)}
                  className="px-3 py-2 text-xs font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none cursor-pointer pr-8 appearance-none"
                >
                  <option value="published">Published Results</option>
                  <option value="all">All Results (Total)</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>

              <button
                onClick={fetchTeamPoints}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs inline-flex items-center space-x-1.5 transition-colors"
              >
                <span>Refresh Points</span>
              </button>
            </div>

            {/* Team Points Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-4 py-3 w-20">Place</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3 text-right w-20">Points</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white text-xs">
                  {loadingPoints ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-12 text-center text-gray-400">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-amber-600 mx-auto mb-2"></div>
                        <span>Calculating points...</span>
                      </td>
                    </tr>
                  ) : teamPoints.length > 0 ? (
                    addCompetitionRanks(teamPoints).map((tp, idx) => {
                      const rank = tp.rank;
                      
                      return (
                        <tr key={tp.team_id || idx} className="hover:bg-gray-50/70 transition-colors">
                          {/* Rank / Medal */}
                          <td className="px-4 py-3 font-bold">
                            {rank === 1 && (
                              <span className="inline-flex items-center space-x-1 text-amber-700">
                                <span>🥇</span>
                                <span>1st</span>
                              </span>
                            )}
                            {rank === 2 && (
                              <span className="inline-flex items-center space-x-1 text-slate-600">
                                <span>🥈</span>
                                <span>2nd</span>
                              </span>
                            )}
                            {rank === 3 && (
                              <span className="inline-flex items-center space-x-1 text-amber-800">
                                <span>🥉</span>
                                <span>3rd</span>
                              </span>
                            )}
                            {rank > 3 && (
                              <span className="text-gray-500">{rank}th</span>
                            )}
                          </td>

                          {/* Team Name */}
                          <td className="px-4 py-3 font-bold text-gray-900">
                            {tp.team_name || `Team #${tp.team_id}`}
                          </td>

                          {/* Points */}
                          <td className="px-4 py-3 text-right font-extrabold text-gray-900 text-sm">
                            {tp.total_points || 0}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-4 py-12 text-center text-gray-400 text-xs">
                        No team points available.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* SLIDE-OVER DRAWER / MODAL: VIEW RESULT (Image 2 Design) */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/40 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-4xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col transition-transform duration-300 transform translate-x-0">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-200 flex items-center justify-between bg-white sticky top-0 z-10">
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-extrabold text-gray-900">
                  #{drawerProgram?.id} {getCategoryName(drawerProgram?.category)} - {drawerProgram?.name}
                </h2>
                <span className={`px-3 py-1 font-bold rounded-full text-xs ${
                  drawerProgram?.is_published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {drawerProgram?.is_published ? 'Published' : 'Submitted'}
                </span>
              </div>

              <button
                onClick={() => setDrawerOpen(false)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body Table */}
            <div className="p-6 flex-1 overflow-x-auto">
              {loadingDrawerResults ? (
                <div className="py-20 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-3"></div>
                  <p className="text-xs text-gray-500 font-medium">Loading candidate scores...</p>
                </div>
              ) : drawerResults.length > 0 ? (
                <table className="w-full text-left border-collapse border border-gray-200 rounded-xl overflow-hidden text-xs">
                  <thead className="bg-gray-50 border-b border-gray-200 font-semibold text-gray-600">
                    <tr>
                      <th className="px-4 py-3 w-14">Sl No</th>
                      <th className="px-4 py-3 w-20">Chest #</th>
                      <th className="px-4 py-3">Participant</th>
                      <th className="px-4 py-3 w-24">Code Letter</th>
                      <th className="px-4 py-3">Team</th>
                      <th className="px-4 py-3 w-16 text-center">Grade</th>
                      <th className="px-4 py-3 w-28">Prize</th>
                      <th className="px-4 py-3 text-right w-20">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {drawerResults.map((item, idx) => (
                      <tr key={item.id || idx} className="hover:bg-gray-50/60 transition-colors">
                        {/* Sl No */}
                        <td className="px-4 py-3 text-gray-500 font-medium">{idx + 1}</td>

                        {/* Chest # */}
                        <td className="px-4 py-3 font-semibold text-gray-700">
                          {item.chest_number || item.student_details?.chest_number || '-'}
                        </td>

                        {/* Participant */}
                        <td className="px-4 py-3 font-bold text-gray-900 uppercase">
                          {item.participant_name || item.student_name || item.name || 'Participant'}
                        </td>

                        {/* Code Letter */}
                        <td className="px-4 py-3 font-semibold text-gray-600">
                          {item.code_letter || '-'}
                        </td>

                        {/* Team */}
                        <td className="px-4 py-3 font-medium text-gray-800">
                          {item.team_name || item.team?.name || '-'}
                        </td>

                        {/* Grade */}
                        <td className="px-4 py-3 text-center font-extrabold text-gray-900">
                          {item.grade || '-'}
                        </td>

                        {/* Prize */}
                        <td className="px-4 py-3">
                          {renderPrizeBadge(item.position)}
                        </td>

                        {/* Points */}
                        <td className="px-4 py-3 text-right font-extrabold text-gray-900 text-sm">
                          {item.points_earned || item.points || 0}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-16 text-center text-gray-400 text-xs">
                  No detailed mark entries found for this competition.
                </div>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default EventResults;
