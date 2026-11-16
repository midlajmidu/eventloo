import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Trophy,
  Search,
  ChevronLeft,
  ChevronRight,
  Calendar,
  MapPin,
  Award,
  Printer,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Sparkles,
  Users,
  RefreshCw
} from 'lucide-react';
import { publicEventAPI } from '../../services/api';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import BadgeScannerModal from './BadgeScannerModal';
import { LaurelRankBadge, ExploreTrophyArt, TwinklingStar } from './PublicArtwork';

const PublicResultsPage = () => {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState(null);

  // Filters & State
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    fetchPortalData();
  }, [eventId]);

  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await publicEventAPI.getPublicPortal(eventId);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load results data:', err);
      if (err.response?.status === 403) {
        setError('This festival portal is currently private.');
      } else {
        setError(err?.response?.data?.error || 'Live results could not be loaded.');
      }
    } finally {
      setLoading(false);
    }
  };

  const event = data?.event;
  const stats = data?.stats || {};
  const categories = data?.categories || [];
  const programs = data?.programs || [];

  // Filter programs
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      const matchCat = selectedCategory === 'all' || p.category === selectedCategory;
      const matchSearch =
        !searchTerm || p.name.toLowerCase().includes(searchTerm.toLowerCase());
      return matchCat && matchSearch;
    });
  }, [programs, selectedCategory, searchTerm]);

  // Current category programs for next/prev
  const currentCategoryPrograms = useMemo(() => {
    if (selectedCategory === 'all') return programs;
    return programs.filter((p) => p.category === selectedCategory);
  }, [programs, selectedCategory]);

  const activeProgram = useMemo(() => {
    if (!selectedProgramId) return null;
    return programs.find((p) => String(p.id) === String(selectedProgramId)) || null;
  }, [programs, selectedProgramId]);

  const handleCategoryChange = (catCode) => {
    setSelectedCategory(catCode);
    setSelectedProgramId('');
  };

  const handlePrevProgram = () => {
    if (currentCategoryPrograms.length <= 1) return;
    const currIdx = currentCategoryPrograms.findIndex((p) => String(p.id) === String(activeProgram?.id));
    const prevIdx = currIdx > 0 ? currIdx - 1 : currentCategoryPrograms.length - 1;
    setSelectedProgramId(String(currentCategoryPrograms[prevIdx].id));
  };

  const handleNextProgram = () => {
    if (currentCategoryPrograms.length <= 1) return;
    const currIdx = currentCategoryPrograms.findIndex((p) => String(p.id) === String(activeProgram?.id));
    const nextIdx = currIdx < currentCategoryPrograms.length - 1 ? currIdx + 1 : 0;
    setSelectedProgramId(String(currentCategoryPrograms[nextIdx].id));
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#090817] flex flex-col items-center justify-center text-center p-6 space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 p-[2px] animate-pulse">
          <div className="w-full h-full bg-[#120F2B] rounded-[14px] flex items-center justify-center">
            <RefreshCw className="w-7 h-7 text-amber-400 animate-spin" />
          </div>
        </div>
        <p className="font-cinzel text-sm uppercase tracking-widest text-amber-300">
          Gathering Official Live Results...
        </p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#090817] flex flex-col items-center justify-center text-center p-6">
        <div className="max-w-md w-full bg-[#15122F] border border-amber-500/30 rounded-3xl p-8 shadow-2xl space-y-5">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center justify-center">
            <AlertCircle className="w-7 h-7" />
          </div>
          <h2 className="font-cinzel text-lg font-bold text-white uppercase tracking-wider">
            Results Unavailable
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed font-sans">{error}</p>
          <Link
            to={`/events/${eventId}/public`}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-[#120F2B] hover:brightness-110 transition-all shadow-md"
          >
            <span>Return to Festival Home</span>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090817] text-white selection:bg-amber-500 selection:text-slate-950 flex flex-col justify-between overflow-x-hidden">
      {/* 1. Global Navigation Header */}
      <PublicNavbar
        eventId={eventId}
        eventData={event}
        onOpenScanner={() => setIsScannerOpen(true)}
      />

      {/* 2. Main Results Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-28 pb-20 space-y-8 animate-fade-in">
        
        {/* Header Hero Banner */}
        <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-r from-[#2A1646] via-[#1E1139] to-[#160E30] border-2 border-amber-400/40 shadow-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-6 relative overflow-hidden">
          <div className="space-y-2 relative z-10">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/20 text-amber-300 text-xs font-cinzel uppercase tracking-widest font-bold border border-amber-400/30">
              <Trophy className="w-3.5 h-3.5 text-amber-300" />
              <span>Official Live Results</span>
            </div>
            <h1 className="text-3xl sm:text-5xl font-bold text-white font-cinzel-dec tracking-tight">
              Live Program Results
            </h1>
            <p className="text-xs sm:text-sm text-amber-200/80 font-sans">
              {event?.title || event?.name} &bull; {stats.published_results_count || 0} of {programs.length} programs officially published
            </p>
          </div>

          <div className="flex items-center gap-3 relative z-10 shrink-0">
            <Link
              to={`/events/${eventId}/public/points`}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-[#090817] text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg"
            >
              <span>Points Table</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

        {/* 2 Dropdowns Filter Ribbon */}
        <div className="p-6 rounded-3xl bg-[#16113A] border border-amber-500/30 shadow-xl space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="public-results-category" className="block font-cinzel text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                1. Select Category
              </label>
              <select
                id="public-results-category"
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#120D2F] border border-amber-500/30 text-xs font-cinzel uppercase tracking-wider text-amber-200 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((cat) => (
                  <option key={cat.code} value={cat.code}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="public-results-program" className="block font-cinzel text-xs font-bold uppercase tracking-wider text-amber-400 mb-2">
                2. Select Program
              </label>
              <select
                id="public-results-program"
                value={selectedProgramId}
                onChange={(e) => setSelectedProgramId(e.target.value)}
                className="w-full px-4 py-3 rounded-2xl bg-[#120D2F] border border-amber-500/30 text-xs font-cinzel uppercase tracking-wider text-amber-200 outline-none focus:ring-2 focus:ring-amber-400 cursor-pointer"
              >
                <option value="">-- Choose a Program ({currentCategoryPrograms.length}) --</option>
                {currentCategoryPrograms.map((prog) => (
                  <option key={prog.id} value={prog.id}>
                    {prog.name} {prog.category_name ? `(${prog.category_name})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Detail Program Card or Prompt */}
        {activeProgram ? (
          /* Selected Program Detail View */
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => setSelectedProgramId('')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-300 hover:text-amber-200 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Back to Program List</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePrevProgram}
                  className="p-2 rounded-xl bg-[#1C1738] border border-amber-400/30 hover:bg-[#251F48] text-white cursor-pointer"
                  title="Previous Program"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleNextProgram}
                  className="p-2 rounded-xl bg-[#1C1738] border border-amber-400/30 hover:bg-[#251F48] text-white cursor-pointer"
                  title="Next Program"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="p-2 rounded-xl bg-[#1C1738] border border-amber-400/30 hover:bg-[#251F48] text-white cursor-pointer"
                  title="Print Official Result Poster"
                >
                  <Printer className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-8 sm:p-10 rounded-3xl bg-gradient-to-br from-[#1E173D] via-[#161135] to-[#100B26] border-2 border-amber-400/40 shadow-2xl space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-amber-400/20">
                <div className="space-y-1">
                  <span className="font-cinzel text-[11px] font-bold uppercase tracking-widest text-amber-400">
                    {activeProgram.category_name || activeProgram.category} &bull; {activeProgram.program_type || 'General'}
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-bold text-white font-editorial tracking-wide">
                    {activeProgram.name}
                  </h2>
                  {activeProgram.venue && (
                    <div className="text-xs text-amber-200/80 flex items-center gap-1.5 pt-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      <span>{activeProgram.stage_name || activeProgram.venue}</span>
                    </div>
                  )}
                </div>

                <span className={`px-4 py-1.5 rounded-full text-xs font-cinzel font-bold uppercase tracking-wider ${
                  activeProgram.is_published
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                }`}>
                  {activeProgram.is_published ? '● Results Officially Published' : '○ Pending Evaluation'}
                </span>
              </div>

              {/* Podium Placements */}
              {activeProgram.results && activeProgram.results.length > 0 ? (
                <div className="space-y-4 pt-2">
                  <h3 className="font-cinzel text-xs font-bold uppercase tracking-wider text-amber-300">
                    Official Award Placements:
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {activeProgram.results.map((res, idx) => (
                      <div
                        key={idx}
                        className="p-6 rounded-2xl bg-white/5 border border-amber-400/20 flex items-center space-x-4 shadow-lg hover:border-amber-400/50 transition-all"
                      >
                        <LaurelRankBadge rank={res.position || idx + 1} size={48} />
                        <div className="min-w-0 flex-1">
                          <div className="text-base font-bold text-white truncate font-editorial">
                            {res.student_name || 'Participant'}
                          </div>
                          <div className="text-xs font-semibold text-amber-300 truncate mt-0.5">
                            {res.team_name || 'Individual'}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-2 flex items-center gap-2">
                            {res.chest_number && (
                              <span className="font-mono text-amber-200/90 font-bold">
                                #{res.chest_number}
                              </span>
                            )}
                            {res.grade && (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-[10px]">
                                Grade {res.grade}
                              </span>
                            )}
                            {res.points && (
                              <span className="font-bold text-amber-400">
                                +{res.points} pts
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="py-16 text-center text-slate-400 text-xs">
                  Results for this program have not been officially published yet. Please check back soon!
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Guidance Prompt When No Program Selected */
          <div className="py-20 text-center rounded-3xl bg-[#16113A] border border-amber-500/20 text-amber-200/80 space-y-4">
            <Trophy className="w-14 h-14 mx-auto text-amber-400/70 animate-pulse" />
            <h3 className="text-xl font-cinzel font-bold text-white">
              Please Select a Program Above
            </h3>
            <p className="text-xs text-amber-200/70 max-w-md mx-auto leading-relaxed">
              Choose a category and program from the dropdowns above to view its live standings, rankings, and awarded points.
            </p>
          </div>
        )}

      </main>

      {/* 3. Global Footer */}
      <PublicFooter event={event} eventId={eventId} />

      {/* 4. Scanner Modal */}
      {isScannerOpen && (
        <BadgeScannerModal
          eventId={eventId}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
};

export default PublicResultsPage;
