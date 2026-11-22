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
  MoreVertical,
  AlertCircle,
  Sparkles,
  Download,
  Image as ImageIcon,
  Archive,
  Loader2,
  Info
} from 'lucide-react';
import { 
  eventProgramsAPI, 
  markEntryAPI, 
  eventResultsAPI, 
  eventPointsAPI,
  eventCertificatesAPI
} from '../../services/api';
import Pagination from '../common/Pagination';

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

const EventResults = ({ categories: dynamicCategories = [], readOnly = false, eventId: propEventId }) => {
  const { eventId: paramEventId } = useParams();
  const eventId = propEventId || paramEventId;

  // Programs & Filtering
  const [programs, setPrograms] = useState([]);
  const [loadingPrograms, setLoadingPrograms] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  // E-Poster Export Modal & Progress States
  const [posterModalOpen, setPosterModalOpen] = useState(false);
  const [selectedPosterTemplate, setSelectedPosterTemplate] = useState('result_poster');
  const [posterOrderBy, setPosterOrderBy] = useState('result_number');
  const [downloadingPosterAll, setDownloadingPosterAll] = useState(false);
  const [downloadingFormat, setDownloadingFormat] = useState(null);
  const [downloadingProgId, setDownloadingProgId] = useState(null);
  const [posterActionMsg, setPosterActionMsg] = useState('');

  const triggerBlobDownload = (blobData, filename, mimeType = 'application/pdf') => {
    const blob = new Blob([blobData], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const renderProgramPosterPng = async (program, templateType = 'result_poster') => {
    const [tplRes, dataRes] = await Promise.all([
      eventCertificatesAPI.getTemplates(eventId),
      eventCertificatesAPI.getPreviewData(eventId, templateType, program.id)
    ]);
    const tpl = (tplRes.data?.results || []).find(t => t.certificateType === templateType) || tplRes.data?.results?.[0];
    if (!tpl || !tpl.bgImage) {
      throw new Error(`Please upload a background image for ${templateType} in the Templates studio first.`);
    }
    const fields = tpl.fields || {};
    const recipient = dataRes.data?.recipient || {};

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = tpl.bgImage;
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error('Failed to load poster background image'));
    });

    const offCanvas = document.createElement('canvas');
    const w = img.naturalWidth || 1200;
    const h = img.naturalHeight || Math.round(w / (tpl.aspectRatio || 0.75));
    offCanvas.width = w;
    offCanvas.height = h;
    const ctx = offCanvas.getContext('2d');
    if (!ctx) throw new Error('Could not create canvas context');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);

    const scaleFactor = w / 672.0;
    Object.values(fields).forEach(f => {
      if (!f.enabled) return;
      const rawText = recipient[f.id] || f.sample || '';
      if (!rawText) return;
      const text = f.uppercase ? String(rawText).toUpperCase() : String(rawText);

      const posX = (f.x / 100.0) * w;
      const posY = (f.y / 100.0) * h;
      const fontSize = Math.round((f.fontSize || 16) * scaleFactor);
      const boxWidthPx = ((f.boxWidth || 35) / 100.0) * w;

      const italicStr = f.italic ? 'italic ' : '';
      const boldStr = f.bold ? 'bold ' : 'normal ';
      ctx.font = `${italicStr}${boldStr}${fontSize}px sans-serif`;
      ctx.textAlign = f.textAlign || 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = f.color || '#000000';

      const words = text.split(' ');
      let lines = [];
      let curLine = '';
      for (let i = 0; i < words.length; i++) {
        const testLine = curLine ? `${curLine} ${words[i]}` : words[i];
        if (ctx.measureText(testLine).width > boxWidthPx && curLine) {
          lines.push(curLine);
          curLine = words[i];
        } else {
          curLine = testLine;
        }
      }
      if (curLine) lines.push(curLine);

      const lineHeight = fontSize * 1.25;
      const totalH = lines.length * lineHeight;
      let startY = posY - (totalH / 2) + (lineHeight / 2);

      lines.forEach((line) => {
        ctx.fillText(line, posX, startY);
        startY += lineHeight;
      });
    });

    return new Promise((resolve, reject) => {
      offCanvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('PNG export generation failed'));
          return;
        }
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const resultNoStr = recipient.resultNo ? `${recipient.resultNo.replace(/[^a-zA-Z0-9]/g, '_')}_` : '';
        link.setAttribute('download', `${resultNoStr}${program.name.replace(/\s+/g, '_')}_Poster.png`);
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        window.URL.revokeObjectURL(url);
        resolve();
      }, 'image/png', 0.95);
    });
  };

  const handleDownloadAllPosters = async (format = 'pdf') => {
    setDownloadingFormat(format);
    setDownloadingPosterAll(true);
    setPosterActionMsg('');
    try {
      let certTypesParam = selectedPosterTemplate;
      let posterModeParam = 'single';
      if (selectedPosterTemplate === 'alternating') {
        certTypesParam = 'result_poster,result_poster_2,result_poster_3,result_poster_4,result_poster_5';
        posterModeParam = 'alternating';
      } else if (selectedPosterTemplate === 'poster_wise') {
        certTypesParam = 'result_poster,result_poster_2,result_poster_3,result_poster_4,result_poster_5';
        posterModeParam = 'poster_wise';
      }

      const res = await eventCertificatesAPI.generateCertificates(eventId, {
        cert_types: certTypesParam,
        poster_mode: posterModeParam,
        order_by: posterOrderBy,
        file_format: format,
        quality: 'print'
      });

      const disposition = res.headers?.['content-disposition'] || '';
      let downloadFilename = `Result_Posters_${event?.title || 'Event'}.${format === 'jpg' ? 'zip' : 'pdf'}`;
      const fnMatch = disposition.match(/filename="?([^";]+)"?/i);
      if (fnMatch && fnMatch[1]) {
        downloadFilename = fnMatch[1];
      }
      const mimeType = (format === 'jpg' || downloadFilename.endsWith('.zip')) ? 'application/zip' : 'application/pdf';
      triggerBlobDownload(res.data, downloadFilename, mimeType);
      setPosterActionMsg(`All E-Posters ${format === 'jpg' ? 'ZIP' : 'PDF'} downloaded successfully!`);
      setTimeout(() => setPosterActionMsg(''), 4000);
    } catch (err) {
      let errorMsg = 'Failed to generate E-Posters. Please ensure certificate templates are configured.';
      if (err.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text());
          if (parsed?.error) errorMsg = parsed.error;
        } catch (_) {}
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      }
      setPosterActionMsg(errorMsg);
    } finally {
      setDownloadingPosterAll(false);
      setDownloadingFormat(null);
    }
  };

  const handleDownloadSinglePoster = async (program, format = 'pdf') => {
    if (!program) return;
    setDownloadingProgId(program.id);
    setPosterActionMsg('');
    try {
      const templateType = selectedPosterTemplate.startsWith('result_poster') ? selectedPosterTemplate : 'result_poster';
      const res = await eventCertificatesAPI.generateCertificates(eventId, {
        cert_types: templateType,
        program_id: program.id,
        file_format: format,
        quality: 'print'
      });
      const disposition = res.headers?.['content-disposition'] || '';
      const resultNoStr = program.result_number ? `Result_${String(program.result_number).padStart(2, '0')}_` : '';
      const cleanProgName = program.name ? program.name.replace(/\s+/g, '_') : 'Poster';
      let downloadFilename = `${resultNoStr}${cleanProgName}.${format === 'jpg' ? 'jpg' : 'pdf'}`;
      const fnMatch = disposition.match(/filename="?([^";]+)"?/i);
      if (fnMatch && fnMatch[1]) {
        downloadFilename = fnMatch[1];
      }
      const mimeType = format === 'jpg' ? 'image/jpeg' : 'application/pdf';
      triggerBlobDownload(res.data, downloadFilename, mimeType);
    } catch (err) {
      let errorMsg = err.message || 'Unable to download e-poster. Please ensure background image is saved in Templates.';
      if (err.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text());
          if (parsed?.error) errorMsg = parsed.error;
        } catch (_) {}
      } else if (err.response?.data?.error) {
        errorMsg = err.response.data.error;
      }
      setPosterActionMsg(errorMsg);
      alert(errorMsg);
    } finally {
      setDownloadingProgId(null);
    }
  };

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
      let allProgs = Array.isArray(progsRes.data) ? progsRes.data : (progsRes.data.results || []);
      if (readOnly) {
        // Team managers ONLY see officially published results
        allProgs = allProgs.filter((p) => p.is_published);
      }
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
      // Team managers only ever see published results. Admins can view both.
      const isPublishedOnly = readOnly ? true : (pointsFilter === 'published');
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
      // Refresh full programs list to get updated sequential result_numbers
      await fetchInitialData();
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
      let allParticipants = [];
      try {
        const res = await markEntryAPI.getParticipants(eventId, program.id);
        allParticipants = res.data || [];
      } catch (err) {
        console.warn('markEntryAPI error, attempting results API fallback:', err);
      }

      if (!allParticipants || allParticipants.length === 0) {
        try {
          const res2 = await eventResultsAPI.getProgramResults(eventId, program.id);
          allParticipants = Array.isArray(res2.data) ? res2.data : (res2.data?.results || []);
        } catch (err2) {
          console.warn('eventResultsAPI fallback error:', err2);
        }
      }

      // Filter & Sort by position or marks
      const withMarks = (allParticipants || []).filter(p =>
        p.position > 0 ||
        (p.points_earned && Number(p.points_earned) > 0) ||
        p.entry_status === 'submitted' ||
        p.average_marks !== null ||
        p.total_marks !== null
      );

      const sorted = withMarks.sort((a, b) => {
        if (a.position && b.position) return a.position - b.position;
        if (a.position) return -1;
        if (b.position) return 1;
        return (Number(b.average_marks || b.total_marks) || 0) - (Number(a.average_marks || a.total_marks) || 0);
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

  // Helper: Priority rank for competition sorting (Submitted marks come to the very top)
  const getStatusRank = (program) => {
    const status = getProgramStatus(program);
    switch (status) {
      case 'submitted':
        return 1; // Submitted marks come first at the very top
      case 'published':
        return 2; // Published results
      case 'in_progress':
        return 3; // In progress
      case 'pending':
      default:
        return 4; // Pending
    }
  };

  // Filtered and sorted programs (submitted marks at the top)
  const sortedPrograms = programs
    .filter(p => {
      const matchesCategory = !selectedCategory || p.category === selectedCategory;
      const matchesSearch = !searchTerm || 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.category.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategory && matchesSearch;
    })
    .sort((a, b) => {
      const rankA = getStatusRank(a);
      const rankB = getStatusRank(b);
      if (rankA !== rankB) {
        return rankA - rankB;
      }
      return (a.name || '').localeCompare(b.name || '');
    });

  // Reset pagination on search or category filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCategory]);

  // Paginated programs for table display
  const totalPages = Math.ceil(sortedPrograms.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedPrograms = sortedPrograms.slice(startIndex, startIndex + pageSize);

  // Published competitions sorted according to posterOrderBy
  const publishedCompetitions = programs
    .filter(p => p.is_published || getProgramStatus(p) === 'published')
    .sort((a, b) => {
      if (posterOrderBy === 'result_number') {
        const rA = a.result_number != null ? a.result_number : 999999;
        const rB = b.result_number != null ? b.result_number : 999999;
        return rA - rB;
      }
      if (posterOrderBy === 'program_code') {
        return (a.id || 0) - (b.id || 0);
      }
      if (posterOrderBy === 'category') {
        return (a.category || '').localeCompare(b.category || '');
      }
      return (a.name || '').localeCompare(b.name || '');
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
    <div className="p-4 sm:p-6 space-y-5 bg-[#f7f8fb] min-h-[620px]">
      {/* Header Card Box */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Results & Standings</h1>
            <p className="text-xs text-gray-500 mt-0.5">
              {readOnly ? 'Official competition results and team points standings' : 'Manage and reorder competition results, and view team points'}
            </p>
          </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto flex-wrap gap-y-2">
          <button
            type="button"
            onClick={() => setPosterModalOpen(true)}
            className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
            title="Export official result posters for published competitions"
          >
            <Sparkles className="w-3.5 h-3.5 text-indigo-200" />
            <span>Download E-Posters</span>
          </button>
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
        {!readOnly && (
          <>
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
          </>
        )}

        <div className="flex items-center bg-emerald-50 text-emerald-800 px-3.5 py-2 rounded-xl text-xs font-bold border border-emerald-200">
          <span>{readOnly ? 'Published Competitions' : 'Published'}</span>
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
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-4">
            
            {/* Table Search & Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search results..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs text-gray-700 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded-md"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-end">
                {/* Category selector */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-2.5 py-1.5 text-[11px] font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none cursor-pointer"
                >
                  <option value="">All Categories</option>
                  {dynamicCategories.map(cat => (
                    <option key={cat.code} value={cat.code}>{cat.name}</option>
                  ))}
                </select>

                {!readOnly && (
                  <button
                    onClick={handlePublishAll}
                    className="px-2.5 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-[11px] font-semibold rounded-lg shadow-2xs inline-flex items-center space-x-1 transition-colors whitespace-nowrap cursor-pointer"
                  >
                    <Globe className="w-3 h-3 text-gray-500" />
                    <span>Publish All</span>
                  </button>
                )}
              </div>
            </div>

            {/* Competitions Table */}
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-left border-collapse">
                <thead className="bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500">
                  <tr>
                    <th className="px-4 py-3 w-12 text-center">#</th>
                    <th className="px-4 py-3">Competition</th>
                    <th className="px-4 py-3 text-center w-28 whitespace-nowrap">Status</th>
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
                  ) : paginatedPrograms.length > 0 ? (
                    paginatedPrograms.map((prog, idx) => {
                      const status = getProgramStatus(prog);
                      const isPublished = prog.is_published || status === 'published';
                      const canPublish = isPublished || status === 'submitted';
                      
                      return (
                        <tr
                          key={prog.id}
                          onClick={() => handleOpenDrawer(prog)}
                          className="hover:bg-gray-50/70 transition-colors cursor-pointer"
                        >
                          {/* Index # */}
                          <td className="px-4 py-3 text-center text-gray-400 font-semibold">
                            #{startIndex + idx + 1}
                          </td>

                          {/* Competition Name & Category */}
                          <td className="px-4 py-3">
                            <div className="font-bold text-gray-900 text-xs flex items-center gap-2">
                              <span>{prog.name}</span>
                              {prog.is_team_based && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                  Group
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-gray-400 font-medium mt-0.5">
                              {getCategoryName(prog.category)}
                            </div>
                          </td>

                          {/* Status Badge */}
                          <td className="px-4 py-3 text-center whitespace-nowrap">
                            {status === 'published' && (
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                <span className="inline-block px-2.5 py-0.5 bg-emerald-100/80 text-emerald-800 font-semibold rounded-full text-[11px] whitespace-nowrap">
                                  Published
                                </span>
                                {prog.result_number && (
                                  <span className="inline-block px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded-full text-[10px] whitespace-nowrap">
                                    Result #{String(prog.result_number).padStart(2, '0')}
                                  </span>
                                )}
                              </div>
                            )}
                            {status === 'submitted' && (
                              <span className="inline-block px-2.5 py-0.5 bg-amber-100 text-amber-800 font-semibold rounded-full text-[11px] whitespace-nowrap">
                                Submitted
                              </span>
                            )}
                            {status === 'in_progress' && (
                              <span className="inline-block px-2.5 py-0.5 bg-indigo-100 text-indigo-800 font-semibold rounded-full text-[11px] whitespace-nowrap">
                                In Progress
                              </span>
                            )}
                            {status === 'pending' && (
                              <span className="inline-block px-2.5 py-0.5 bg-gray-100 text-gray-600 font-semibold rounded-full text-[11px] whitespace-nowrap">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Actions Column */}
                          <td className="px-4 py-3 text-right">
                            {readOnly ? (
                              <div className="flex items-center justify-end space-x-1.5" onClick={(e) => e.stopPropagation()}>
                                {isPublished && (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadSinglePoster(prog, 'pdf')}
                                    disabled={downloadingProgId === prog.id}
                                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition-colors shadow-2xs cursor-pointer"
                                    title="Download Result E-Poster (PDF)"
                                  >
                                    {downloadingProgId === prog.id ? (
                                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                                    ) : (
                                      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                    )}
                                    <span>Poster</span>
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => handleOpenDrawer(prog)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 transition-colors shadow-2xs cursor-pointer"
                                  title="View detailed results"
                                >
                                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                  <span>View Results</span>
                                </button>
                              </div>
                            ) : (
                              <div
                                className="flex items-center justify-end space-x-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isPublished && (
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadSinglePoster(prog, 'pdf')}
                                    disabled={downloadingProgId === prog.id}
                                    className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[11px] font-semibold rounded-lg border border-indigo-200/80 transition-colors shadow-2xs cursor-pointer"
                                    title="Download Result E-Poster (PDF)"
                                  >
                                    {downloadingProgId === prog.id ? (
                                      <Loader2 className="w-3 h-3 animate-spin text-indigo-600" />
                                    ) : (
                                      <Sparkles className="w-3 h-3 text-indigo-600" />
                                    )}
                                    <span className="hidden sm:inline">Poster</span>
                                  </button>
                                )}
                                <div className="relative inline-block text-left">
                                  <button
                                    onClick={() => setOpenMenuId(openMenuId === prog.id ? null : prog.id)}
                                    className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <MoreVertical className="w-4 h-4" />
                                  </button>

                                  {/* Dropdown Action Menu */}
                                  {openMenuId === prog.id && (
                                    <div className="origin-top-right absolute right-0 mt-1 w-52 rounded-xl bg-white border border-gray-200 shadow-lg z-20 py-1 font-medium text-xs divide-y divide-gray-100">
                                      <button
                                        onClick={() => {
                                          handleOpenDrawer(prog);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full text-left px-3.5 py-2 text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                      >
                                        <Eye className="w-3.5 h-3.5 text-indigo-600" />
                                        <span>View Result</span>
                                      </button>

                                      {isPublished && (
                                        <div className="py-1">
                                          <button
                                            onClick={() => {
                                              handleDownloadSinglePoster(prog, 'pdf');
                                              setOpenMenuId(null);
                                            }}
                                            className="w-full text-left px-3.5 py-2 text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                          >
                                            <Download className="w-3.5 h-3.5 text-indigo-600" />
                                            <span>Download Poster (PDF)</span>
                                          </button>
                                          <button
                                            onClick={() => {
                                              handleDownloadSinglePoster(prog, 'jpg');
                                              setOpenMenuId(null);
                                            }}
                                            className="w-full text-left px-3.5 py-2 text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
                                          >
                                            <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                                            <span>Download Poster (JPG)</span>
                                          </button>
                                        </div>
                                      )}

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
                              </div>
                            )}
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

            {/* Pagination Controls for Competitions Table */}
            {sortedPrograms.length > 0 && (
              <div className="pt-2 border-t border-gray-100">
                <Pagination
                  currentPage={currentPage}
                  totalPages={totalPages}
                  totalCount={sortedPrograms.length}
                  pageSize={pageSize}
                  onPageChange={setCurrentPage}
                  onPageSizeChange={(newSize) => {
                    setPageSize(newSize);
                    setCurrentPage(1);
                  }}
                  showPageSizeSelector={false}
                  compact={true}
                />
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Team Points Leaderboard (5 Cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-xl p-4 shadow-2xs space-y-4">
            
            {/* Header & Filter Controls */}
            <div className="flex items-center justify-between gap-2">
              {readOnly ? (
                <div className="px-3 py-2 text-xs font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl">
                  Official Team Standings
                </div>
              ) : (
                <div className="relative">
                  <select
                    value={pointsFilter}
                    onChange={(e) => setPointsFilter(e.target.value)}
                    className="px-3 py-2 text-xs font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none cursor-pointer pr-8 appearance-none"
                  >
                    <option value="all">All Results (Total)</option>
                    <option value="published">Published Results</option>
                  </select>
                  <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              )}

              <button
                onClick={fetchTeamPoints}
                className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
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
                {(() => {
                  const status = getProgramStatus(drawerProgram);
                  if (status === 'published') {
                    return (
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-3 py-1 font-bold rounded-full text-xs bg-emerald-100 text-emerald-800">
                          Published
                        </span>
                        {drawerProgram?.result_number && (
                          <span className="px-2.5 py-1 font-bold rounded-full text-xs bg-indigo-100 text-indigo-800">
                            Result #{String(drawerProgram.result_number).padStart(2, '0')}
                          </span>
                        )}
                      </div>
                    );
                  }
                  if (status === 'submitted') {
                    return (
                      <span className="px-3 py-1 font-bold rounded-full text-xs bg-amber-100 text-amber-800">
                        Submitted
                      </span>
                    );
                  }
                  if (status === 'in_progress') {
                    return (
                      <span className="px-3 py-1 font-bold rounded-full text-xs bg-indigo-100 text-indigo-800">
                        In Progress
                      </span>
                    );
                  }
                  return (
                    <span className="px-3 py-1 font-bold rounded-full text-xs bg-gray-100 text-gray-700">
                      Pending
                    </span>
                  );
                })()}
              </div>

              <div className="flex items-center space-x-2">
                {getProgramStatus(drawerProgram) === 'published' && (
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => handleDownloadSinglePoster(drawerProgram, 'pdf')}
                      disabled={downloadingProgId === drawerProgram?.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
                      title="Download E-Poster as high-res PDF"
                    >
                      {downloadingProgId === drawerProgram?.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                      )}
                      <span>Poster PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownloadSinglePoster(drawerProgram, 'jpg')}
                      disabled={downloadingProgId === drawerProgram?.id}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl shadow-2xs transition-colors cursor-pointer"
                      title="Download E-Poster as high-res JPG Image named with Result Number"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                      <span>Poster JPG</span>
                    </button>
                  </div>
                )}

                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Drawer Body Table */}
            <div className="p-6 flex-1 overflow-x-auto">
              {getProgramStatus(drawerProgram) === 'in_progress' && (
                <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200/90 rounded-xl text-xs text-indigo-800 flex items-center space-x-2.5">
                  <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    These scores are currently saved as a <strong>draft</strong>. Final evaluation has not been formally submitted in Mark Entry.
                  </span>
                </div>
              )}
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

      {/* EXPORT RESULT E-POSTERS MODAL */}
      {posterModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 sm:p-6">
          <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-indigo-50/70 via-white to-purple-50/40">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-200">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-gray-900 leading-tight">
                    Export Result E-Posters
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Generate and download official visual podium posters with sequential result numbering
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPosterModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Notification Alert */}
            {posterActionMsg && (
              <div className="mx-6 mt-4 p-3 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 text-xs font-semibold flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>{posterActionMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setPosterActionMsg('')}
                  className="text-indigo-400 hover:text-indigo-600 p-0.5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Modal Content Scroll Area */}
            <div className="p-6 overflow-y-auto space-y-6 flex-1">
              
              {/* Configuration Controls Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200/80">
                {/* Template Selection */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Poster Template Design</span>
                  </label>
                  <select
                    value={selectedPosterTemplate}
                    onChange={(e) => setSelectedPosterTemplate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="result_poster">Poster 1 (Default Design)</option>
                    <option value="result_poster_2">Poster 2</option>
                    <option value="result_poster_3">Poster 3</option>
                    <option value="result_poster_4">Poster 4</option>
                    <option value="result_poster_5">Poster 5</option>
                    <option value="alternating">🔀 Shuffled / Alternating (Posters 1, 2, 3...)</option>
                    <option value="poster_wise">📑 Poster-wise Grouped</option>
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    {selectedPosterTemplate === 'alternating'
                      ? 'Cycles templates across competitions for variety'
                      : selectedPosterTemplate === 'poster_wise'
                      ? 'Generates full set of Poster 1, then Poster 2, etc.'
                      : 'Applies this specific template design'}
                  </p>
                </div>

                {/* Print Order */}
                <div>
                  <label className="block text-xs font-bold text-gray-800 mb-1.5 flex items-center space-x-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Print Order Sequence</span>
                  </label>
                  <select
                    value={posterOrderBy}
                    onChange={(e) => setPosterOrderBy(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                  >
                    <option value="result_number">Result Number (Result 01, 02, 03...) [Recommended]</option>
                    <option value="program_code">Competition Code / ID Order</option>
                    <option value="category">Category Order</option>
                  </select>
                  <p className="text-[11px] text-gray-500 mt-1">
                    Orders posters chronologically by officially published Result Number
                  </p>
                </div>
              </div>

              {/* Master Batch Download Box */}
              <div className="p-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-md">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-extrabold uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded-md">
                      Batch Export
                    </span>
                    <h4 className="text-sm font-bold">Download All Published Posters</h4>
                  </div>
                  <p className="text-xs text-indigo-100 max-w-md">
                    Compiles {publishedCompetitions.length} published competition {publishedCompetitions.length === 1 ? 'poster' : 'posters'} into a single print-ready PDF according to your selected order and template.
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <button
                    type="button"
                    onClick={() => handleDownloadAllPosters('pdf')}
                    disabled={downloadingPosterAll || publishedCompetitions.length === 0}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-white hover:bg-slate-50 text-indigo-700 disabled:opacity-60 text-xs font-extrabold rounded-xl shadow transition-colors inline-flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                  >
                    {downloadingPosterAll && downloadingFormat === 'pdf' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-700" />
                        <span>Generating PDF...</span>
                      </>
                    ) : (
                      <>
                        <Download className="w-4 h-4 text-indigo-700" />
                        <span>Download All (PDF)</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadAllPosters('jpg')}
                    disabled={downloadingPosterAll || publishedCompetitions.length === 0}
                    className="flex-1 sm:flex-initial px-4 py-2.5 bg-amber-400 hover:bg-amber-300 text-amber-950 disabled:opacity-60 text-xs font-extrabold rounded-xl shadow transition-colors inline-flex items-center justify-center space-x-1.5 cursor-pointer shrink-0"
                    title="Download all posters as JPG images bundled in a ZIP archive named by result numbers"
                  >
                    {downloadingPosterAll && downloadingFormat === 'jpg' ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-amber-950" />
                        <span>Creating ZIP...</span>
                      </>
                    ) : (
                      <>
                        <Archive className="w-4 h-4 text-amber-950" />
                        <span>Download All (ZIP / JPGs)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* One-by-One Poster Downloads */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-500">
                      One-by-One Downloads ({publishedCompetitions.length})
                    </h4>
                    <p className="text-xs text-gray-400">
                      Download individual posters as high-resolution PDF documents or PNG images for social media sharing
                    </p>
                  </div>
                </div>

                {publishedCompetitions.length > 0 ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100 bg-white">
                    {publishedCompetitions.map((prog) => {
                      const isDownloadingThis = downloadingProgId === prog.id;
                      return (
                        <div
                          key={prog.id}
                          className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70 transition-colors"
                        >
                          {/* Program Info */}
                          <div className="flex items-center space-x-3 min-w-0">
                            {prog.result_number ? (
                              <div className="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-800 flex flex-col items-center justify-center shrink-0 border border-indigo-200">
                                <span className="text-[9px] font-bold uppercase leading-none">Res</span>
                                <span className="text-xs font-extrabold leading-tight">
                                  #{String(prog.result_number).padStart(2, '0')}
                                </span>
                              </div>
                            ) : (
                              <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-600 flex flex-col items-center justify-center shrink-0 border border-gray-200">
                                <span className="text-[9px] font-bold uppercase leading-none">ID</span>
                                <span className="text-xs font-extrabold leading-tight">
                                  #{prog.id}
                                </span>
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="flex items-center space-x-2 flex-wrap">
                                <span className="text-xs font-bold text-gray-900 truncate">
                                  {prog.name}
                                </span>
                                {prog.is_team_based && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100">
                                    Group
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-gray-400 flex items-center space-x-1.5 mt-0.5">
                                <span>{getCategoryName(prog.category)}</span>
                                <span>•</span>
                                <span className="text-emerald-600 font-semibold">Published</span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons for this Competition */}
                          <div className="flex items-center space-x-2 self-end sm:self-center shrink-0">
                            <button
                              type="button"
                              onClick={() => handleDownloadSinglePoster(prog, 'pdf')}
                              disabled={isDownloadingThis}
                              className="px-3 py-1.5 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 rounded-lg shadow-2xs inline-flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                              title="Download PDF Poster"
                            >
                              {isDownloadingThis ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-600" />
                              ) : (
                                <Download className="w-3.5 h-3.5 text-indigo-600" />
                              )}
                              <span>PDF</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownloadSinglePoster(prog, 'jpg')}
                              disabled={isDownloadingThis}
                              className="px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200/80 rounded-lg shadow-2xs inline-flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
                              title="Download JPG Image named with Result Number"
                            >
                              <ImageIcon className="w-3.5 h-3.5 text-amber-600" />
                              <span>JPG Image</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                    <Info className="w-6 h-6 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs font-bold text-gray-700">No Published Results Found</p>
                    <p className="text-[11px] text-gray-500 mt-1 max-w-sm mx-auto">
                      Posters can only be generated for officially published results. Use the "Publish Result" action in the table to publish competitions first.
                    </p>
                  </div>
                )}
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
              <div className="text-[11px] text-gray-500 hidden sm:block">
                Poster graphics and positioning can be customized in the <strong>Templates</strong> studio tab.
              </div>
              <button
                type="button"
                onClick={() => setPosterModalOpen(false)}
                className="w-full sm:w-auto px-5 py-2 bg-white hover:bg-gray-100 text-gray-700 text-xs font-bold rounded-xl border border-gray-200 shadow-2xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default EventResults;
