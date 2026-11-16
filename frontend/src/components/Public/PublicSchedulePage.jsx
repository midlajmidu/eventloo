import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Calendar,
  Clock,
  MapPin,
  Search,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Layers,
  ChevronRight,
  Filter,
  CheckCircle2
} from 'lucide-react';
import { publicEventAPI } from '../../services/api';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import BadgeScannerModal from './BadgeScannerModal';
import {
  ExploreCalendarArt,
  TwinklingStar
} from './PublicArtwork';

const PublicSchedulePage = () => {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  // Filters
  const [selectedDate, setSelectedDate] = useState('all');
  const [selectedStage, setSelectedStage] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    fetchSchedule();
  }, [eventId]);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await publicEventAPI.getPublicPortal(eventId);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load schedule:', err);
      if (err.response?.status === 403) {
        setError('This festival portal is currently private.');
      } else {
        setError('Unable to load event schedule. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const event = data?.event;
  const programs = data?.programs || [];
  const stages = data?.stages || [];

  // Extract distinct schedule dates from programs
  const availableDates = useMemo(() => {
    const dateSet = new Set();
    programs.forEach((p) => {
      if (p.start_time) {
        try {
          const d = new Date(p.start_time);
          const dateStr = d.toISOString().split('T')[0];
          dateSet.add(dateStr);
        } catch {
          // ignore invalid
        }
      }
    });
    return Array.from(dateSet).sort();
  }, [programs]);

  // Distinct stages list
  const availableStages = useMemo(() => {
    const stageSet = new Set();
    programs.forEach((p) => {
      const name = p.stage_name || p.venue;
      if (name) stageSet.add(name);
    });
    return Array.from(stageSet).sort();
  }, [programs]);

  // Filtered Programs
  const filteredPrograms = useMemo(() => {
    return programs.filter((p) => {
      // Date filter
      if (selectedDate !== 'all') {
        if (!p.start_time) return false;
        const progDate = p.start_time.split('T')[0];
        if (progDate !== selectedDate) return false;
      }

      // Stage filter
      if (selectedStage !== 'all') {
        const stageName = p.stage_name || p.venue || '';
        if (stageName !== selectedStage) return false;
      }

      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = p.name && p.name.toLowerCase().includes(term);
        const matchVenue = (p.stage_name || p.venue || '').toLowerCase().includes(term);
        const matchCat = (p.category_name || p.category || '').toLowerCase().includes(term);
        if (!matchName && !matchVenue && !matchCat) return false;
      }

      return true;
    });
  }, [programs, selectedDate, selectedStage, searchTerm]);

  // Format Date for tabs
  const formatTabDate = (isoDateStr) => {
    try {
      const d = new Date(isoDateStr);
      return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
    } catch {
      return isoDateStr;
    }
  };

  // Format Time Range
  const formatTimeRange = (startTimeStr, endTimeStr) => {
    if (!startTimeStr) return 'Time TBA';
    try {
      const s = new Date(startTimeStr);
      const sFormatted = s.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      if (endTimeStr) {
        const e = new Date(endTimeStr);
        const eFormatted = e.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return `${sFormatted} – ${eFormatted}`;
      }
      return sFormatted;
    } catch {
      return startTimeStr;
    }
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
          Unfolding Festival Schedule...
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
            Schedule Unavailable
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed font-sans">{error}</p>
          <button
            type="button"
            onClick={fetchSchedule}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-wider bg-gradient-to-r from-amber-500 to-amber-600 text-[#120F2B] hover:brightness-110 transition-all shadow-md"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#090817] text-white selection:bg-amber-500 selection:text-slate-950 flex flex-col justify-between overflow-x-hidden">
      {/* 1. Global Navigation Bar */}
      <PublicNavbar
        eventId={eventId}
        eventData={event}
        onOpenScanner={() => setIsScannerOpen(true)}
      />

      {/* 2. Main Schedule Content */}
      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-10">
        
        {/* Header Vignette */}
        <div className="text-center space-y-3 relative">
          <div className="flex items-center justify-center space-x-2 text-amber-400">
            <Sparkles className="w-4 h-4 animate-twinkle" />
            <span className="font-cinzel text-xs uppercase tracking-[0.25em] font-bold">
              Timeline & Venues
            </span>
            <Sparkles className="w-4 h-4 animate-twinkle" />
          </div>

          <h1 className="font-cinzel-dec text-3xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-md">
            Festival Program Schedule
          </h1>

          <p className="text-xs sm:text-sm text-amber-200/80 max-w-lg mx-auto font-sans leading-relaxed">
            Plan your festival journey. Track stage timings, performance venues, and program schedules in real time.
          </p>
        </div>

        {/* 3. Date Ribbon Selector */}
        {availableDates.length > 0 && (
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-2 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedDate('all')}
              className={`px-4 py-2 rounded-full text-xs font-cinzel uppercase tracking-wider transition-all duration-200 shrink-0 ${
                selectedDate === 'all'
                  ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-[#090817] font-bold shadow-[0_0_15px_rgba(245,158,11,0.35)] scale-105'
                  : 'bg-[#181335] text-slate-300 hover:text-white border border-amber-500/20'
              }`}
            >
              All Dates ({programs.length})
            </button>
            {availableDates.map((dateStr) => (
              <button
                key={dateStr}
                type="button"
                onClick={() => setSelectedDate(dateStr)}
                className={`px-4 py-2 rounded-full text-xs font-cinzel uppercase tracking-wider transition-all duration-200 shrink-0 ${
                  selectedDate === dateStr
                    ? 'bg-gradient-to-r from-amber-400 to-amber-500 text-[#090817] font-bold shadow-[0_0_15px_rgba(245,158,11,0.35)] scale-105'
                    : 'bg-[#181335] text-slate-300 hover:text-white border border-amber-500/20'
                }`}
              >
                {formatTabDate(dateStr)}
              </button>
            ))}
          </div>
        )}

        {/* 4. Controls: Stage Filter & Search Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-[#140F2D] p-4 rounded-2xl border border-amber-400/20 shadow-md">
          {/* Stage Dropdown / Pills */}
          <div className="flex items-center space-x-2 w-full sm:w-auto overflow-x-auto">
            <Filter className="w-4 h-4 text-amber-400 shrink-0" />
            <select
              value={selectedStage}
              onChange={(e) => setSelectedStage(e.target.value)}
              className="bg-[#1C163D] border border-amber-500/30 text-white rounded-xl text-xs py-2 px-3 focus:outline-none focus:ring-1 focus:ring-amber-400"
            >
              <option value="all">All Stages & Venues</option>
              {availableStages.map((stageName) => (
                <option key={stageName} value={stageName}>
                  {stageName}
                </option>
              ))}
            </select>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-amber-400/80 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search program, venue or category..."
              className="w-full pl-10 pr-4 py-2 rounded-xl bg-[#1C163D] border border-amber-500/30 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>
        </div>

        {/* 5. Schedule Timeline List */}
        <div className="space-y-4">
          {filteredPrograms.length > 0 ? (
            filteredPrograms.map((prog) => {
              const timeDisplay = formatTimeRange(prog.start_time, prog.end_time);
              const stageVenue = prog.stage_name || prog.venue || 'Venue TBA';

              return (
                <div
                  key={prog.id}
                  className="rounded-2xl bg-gradient-to-r from-[#1A1435] via-[#15102E] to-[#1A1435] border border-amber-400/25 p-5 shadow-lg hover:border-amber-400/50 transition-all duration-300 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  {/* Left: Timing Badge & Program Details */}
                  <div className="flex items-start space-x-4 min-w-0">
                    <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-400/30 flex flex-col items-center justify-center shrink-0 text-amber-300">
                      <Clock className="w-5 h-5 mb-0.5" />
                      <span className="text-[9px] font-mono font-bold uppercase">Time</span>
                    </div>

                    <div className="space-y-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-cinzel text-[11px] font-bold text-amber-300 uppercase tracking-wider">
                          {timeDisplay}
                        </span>
                        <span className="text-amber-500/40">•</span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/5 border border-white/10 text-slate-300">
                          {prog.category_name || prog.category || 'General'}
                        </span>
                        {prog.is_published && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Results Published
                          </span>
                        )}
                      </div>

                      <h3 className="font-editorial text-lg sm:text-xl font-bold text-white tracking-wide truncate">
                        {prog.name}
                      </h3>

                      <div className="flex items-center space-x-2 text-xs text-slate-400 pt-0.5">
                        <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                        <span>{stageVenue}</span>
                        {prog.program_type && (
                          <>
                            <span>•</span>
                            <span className="capitalize">{prog.program_type} Program</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: Action Link to Results if published or badge */}
                  <div className="shrink-0 flex items-center space-x-3 w-full sm:w-auto justify-end pt-2 sm:pt-0 border-t sm:border-t-0 border-white/10">
                    {prog.is_published ? (
                      <Link
                        to={`/events/${eventId}/public/results`}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-amber-500/15 hover:bg-amber-500/25 border border-amber-400/40 text-amber-300 text-xs font-semibold transition-colors"
                      >
                        <span>View Results</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </Link>
                    ) : (
                      <span className="text-xs text-slate-400 font-medium">
                        Upcoming Event
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-16 text-center rounded-3xl bg-[#16113A] border border-amber-500/20 text-slate-400 space-y-3">
              <Calendar className="w-10 h-10 mx-auto text-amber-400/50" />
              <p className="text-sm">No programs found for the selected date and filters.</p>
            </div>
          )}
        </div>
      </main>

      {/* 6. Global Footer */}
      <PublicFooter event={event} eventId={eventId} />

      {/* 7. Scanner Modal */}
      {isScannerOpen && (
        <BadgeScannerModal
          eventId={eventId}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
};

export default PublicSchedulePage;

