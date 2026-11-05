import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Download,
  ExternalLink,
  Printer,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  Users,
  Award,
  Layers,
  Eye,
  Table as TableIcon,
  Filter,
  UserCheck
} from 'lucide-react';
import { eventCallListAPI } from '../../services/api';

const TeamDocuments = ({ eventId, event, teamData, categories = [] }) => {
  const [viewMode, setViewMode] = useState('pdf'); // 'pdf' | 'table'
  const [callListMode, setCallListMode] = useState('team'); // 'team' | 'competition'
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // PDF Preview State
  const [pdfBlobUrl, setPdfBlobUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // Table Data State
  const [callListData, setCallListData] = useState([]);
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState('');

  const iframeRef = useRef(null);

  const resolvedTeamId = teamData?.id || teamData?.team_id || teamData?.team?.id;
  const teamName = teamData?.name || teamData?.team_name || teamData?.team?.name || 'Your Team';

  // Cleanup object URLs on unmount or update
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
    };
  }, [pdfBlobUrl]);

  // Load PDF and JSON data when eventId, mode, category, or team changes
  useEffect(() => {
    if (eventId) {
      loadCallListPdf();
      loadCallListJson();
    }
  }, [eventId, callListMode, selectedCategory, resolvedTeamId]);

  const loadCallListPdf = async () => {
    if (!eventId) return;
    setLoadingPdf(true);
    setPdfError('');
    try {
      const params = {
        mode: callListMode,
      };
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }
      if (callListMode === 'team' && resolvedTeamId) {
        params.team_id = resolvedTeamId;
      }

      const response = await eventCallListAPI.generateCallList(eventId, params);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      
      if (pdfBlobUrl) {
        URL.revokeObjectURL(pdfBlobUrl);
      }
      
      const newUrl = URL.createObjectURL(blob);
      setPdfBlobUrl(newUrl);
    } catch (err) {
      console.error('Failed to load call list PDF:', err);
      let errMsg = 'Failed to generate Call List PDF. Please ensure participant assignments are registered.';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          errMsg = json.error || json.detail || text || errMsg;
        } catch (_) {}
      } else if (err?.response?.data?.error) {
        errMsg = err.response.data.error;
      }
      setPdfError(errMsg);
    } finally {
      setLoadingPdf(false);
    }
  };

  const loadCallListJson = async () => {
    if (!eventId) return;
    setLoadingData(true);
    setDataError('');
    try {
      const params = {
        mode: callListMode,
      };
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }
      if (callListMode === 'team' && resolvedTeamId) {
        params.team_id = resolvedTeamId;
      }
      const response = await eventCallListAPI.getCallListData(eventId, params);
      setCallListData(response.data?.items || []);
    } catch (err) {
      console.warn('Could not fetch call list JSON:', err);
      setDataError('Could not load interactive call list data.');
    } finally {
      setLoadingData(false);
    }
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    try {
      const params = {
        mode: callListMode,
      };
      if (selectedCategory !== 'all') {
        params.category = selectedCategory;
      }
      if (callListMode === 'team' && resolvedTeamId) {
        params.team_id = resolvedTeamId;
      }

      const response = await eventCallListAPI.generateCallList(eventId, params);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const cleanTeam = teamName.replace(/\s+/g, '_');
      const cleanEvent = (event?.title || 'Event').replace(/\s+/g, '_');
      link.download = `Call_List_${cleanTeam}_${cleanEvent}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error downloading Call List PDF:', err);
      alert('Unable to download Call List PDF. Please check your network and try again.');
    } finally {
      setDownloadingPdf(false);
    }
  };

  const handlePrint = () => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.print();
    } else if (pdfBlobUrl) {
      window.open(pdfBlobUrl, '_blank')?.print();
    }
  };

  // Filtered table items based on search term
  const filteredItems = callListData.filter((item) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    const chestNo = String(item.chest_no || '').toLowerCase();
    const prog = String(item.program_name || '').toLowerCase();
    const part = String(item.participant_names || '').toLowerCase();
    const cat = String(item.category || '').toLowerCase();
    return chestNo.includes(term) || prog.includes(term) || part.includes(term) || cat.includes(term);
  });

  // Calculate stats
  const totalEntries = callListData.length;
  const soloCount = callListData.filter(i => !i.is_team_based).length;
  const groupCount = callListData.filter(i => i.is_team_based).length;
  const uniqueCategories = Array.from(new Set(callListData.map(i => i.category || i.category_code))).filter(Boolean);

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
          <div className="flex items-start sm:items-center space-x-3.5">
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 shadow-2xs shrink-0">
              <FileText className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                  Team Documents
                </span>
                <span className="text-[11px] font-bold text-slate-500">
                  {teamName}
                </span>
              </div>
              <h1 className="text-xl font-extrabold text-slate-900 mt-1">
                Official Call List & Roster
              </h1>
              <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
                View verified chest numbers, competition call lists, and downloadable PDF rosters for <strong>{event?.title}</strong>.
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf || loadingPdf}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-indigo-700 transition-all shadow-2xs hover:shadow-xs cursor-pointer disabled:opacity-50"
              title="Download official PDF to your device"
            >
              <Download className={`h-4 w-4 ${downloadingPdf ? 'animate-bounce' : ''}`} />
              <span>{downloadingPdf ? 'Downloading PDF...' : 'Download Call List (PDF)'}</span>
            </button>

            {pdfBlobUrl && (
              <>
                <a
                  href={pdfBlobUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                  title="Open in new window"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Open in Tab</span>
                </a>

                <button
                  onClick={handlePrint}
                  type="button"
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                  title="Print document"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-500" />
                  <span className="hidden sm:inline">Print</span>
                </button>
              </>
            )}

            <button
              onClick={() => {
                loadCallListPdf();
                loadCallListJson();
              }}
              disabled={loadingPdf}
              type="button"
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
              title="Reload live PDF"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingPdf ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
          <div className="bg-slate-50/80 rounded-xl p-3 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 block">Total Call Entries</span>
            <span className="text-lg font-extrabold text-slate-900 mt-0.5 block">{totalEntries}</span>
          </div>
          <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/70">
            <span className="text-[11px] font-semibold text-indigo-600 block">Solo Entries</span>
            <span className="text-lg font-extrabold text-indigo-900 mt-0.5 block">{soloCount}</span>
          </div>
          <div className="bg-emerald-50/50 rounded-xl p-3 border border-emerald-100/70">
            <span className="text-[11px] font-semibold text-emerald-600 block">Group Entries</span>
            <span className="text-lg font-extrabold text-emerald-900 mt-0.5 block">{groupCount}</span>
          </div>
          <div className="bg-amber-50/50 rounded-xl p-3 border border-amber-100/70">
            <span className="text-[11px] font-semibold text-amber-700 block">Categories</span>
            <span className="text-lg font-extrabold text-amber-900 mt-0.5 block">{uniqueCategories.length}</span>
          </div>
        </div>
      </div>

      {/* Control Bar: Mode, Category & View Switcher */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Left: Format Switcher & Call List Grouping */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Grouping Mode Pill */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => setCallListMode('team')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                callListMode === 'team'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Category Wise
            </button>
            <button
              type="button"
              onClick={() => setCallListMode('competition')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                callListMode === 'competition'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Competition Wise
            </button>
          </div>

          {/* Category Filter Dropdown */}
          <div className="relative">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.code || cat.id} value={cat.code || cat.id}>
                  {cat.name || cat.code}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: View Toggle & Search */}
        <div className="flex items-center gap-3">
          {viewMode === 'table' && (
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search chest no, program, student..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium"
              />
            </div>
          )}

          {/* View Mode Buttons */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('pdf')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'pdf'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Official PDF preview"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>PDF View</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('table')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                viewMode === 'table'
                  ? 'bg-white text-indigo-600 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Interactive table list"
            >
              <TableIcon className="w-3.5 h-3.5" />
              <span>Table View</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      {viewMode === 'pdf' ? (
        /* PDF Preview Card */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          {loadingPdf ? (
            <div className="flex flex-col items-center justify-center min-h-[550px] p-8 text-center space-y-3">
              <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-600" />
              <p className="text-xs font-bold text-slate-700">
                Generating live official Call List PDF for {teamName}...
              </p>
              <p className="text-[11px] text-slate-400 max-w-sm">
                Formatting running orders, verified chest numbers, and official layout.
              </p>
            </div>
          ) : pdfError ? (
            <div className="p-10 text-center max-w-md mx-auto my-12">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
                <AlertCircle className="h-6 w-6 text-rose-500" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Unable to Render Call List PDF</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{pdfError}</p>
              <button
                type="button"
                onClick={loadCallListPdf}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 shadow-2xs cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>Try Again</span>
              </button>
            </div>
          ) : pdfBlobUrl ? (
            <div>
              <iframe
                ref={iframeRef}
                src={`${pdfBlobUrl}#toolbar=1&navpanes=0`}
                title={`Call List - ${teamName}`}
                className="w-full h-[750px] border-0 bg-slate-900/5"
              />
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400 text-xs">
              No PDF available. Please click refresh to generate.
            </div>
          )}
        </div>
      ) : (
        /* Interactive Table View */
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          <div className="px-5 py-3.5 bg-slate-50/70 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <UserCheck className="h-4 w-4 text-indigo-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Team Participant Call List
              </h3>
            </div>
            <span className="text-[11px] font-semibold text-slate-500">
              Showing {filteredItems.length} of {totalEntries} entries
            </span>
          </div>

          {loadingData ? (
            <div className="p-12 text-center text-slate-500 text-xs">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent mx-auto mb-2" />
              Loading team participants...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="p-12 text-center text-slate-400 text-xs">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-400 mb-2">
                <Search className="h-5 w-5" />
              </div>
              <p className="font-semibold text-slate-600">No matching call list entries found</p>
              <p className="text-[11px] text-slate-400 mt-1">
                {searchTerm ? 'Try adjusting your search criteria.' : 'Ensure students are assigned to programs in the Assignments tab.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-bold border-b border-slate-200">
                    <th className="py-3 px-4 w-12 text-center">#</th>
                    <th className="py-3 px-4">Competition / Program</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4 text-center">Chest No</th>
                    <th className="py-3 px-4">Participant(s)</th>
                    <th className="py-3 px-4 text-center">Type</th>
                    <th className="py-3 px-4 text-center">Gender</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item, idx) => (
                    <tr key={`${item.program_id}-${item.chest_no}-${idx}`} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-center text-slate-400 font-semibold">{idx + 1}</td>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {item.program_name}
                      </td>
                      <td className="py-3 px-4 text-slate-600 font-medium">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-semibold border border-slate-200">
                          {item.category}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-extrabold text-indigo-700">
                        <span className="px-2.5 py-1 bg-indigo-50 border border-indigo-200 rounded-lg text-xs tracking-wide">
                          {item.chest_no}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {item.participant_names || '—'}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                          item.is_team_based
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {item.is_team_based ? 'Group' : 'Solo'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center text-slate-600 font-medium capitalize">
                        {item.gender || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TeamDocuments;
