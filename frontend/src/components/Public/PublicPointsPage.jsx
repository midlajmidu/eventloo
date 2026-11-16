import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Trophy,
  Search,
  ChevronDown,
  ChevronUp,
  Award,
  Sparkles,
  RefreshCw,
  AlertCircle,
  Medal,
  Users,
  ShieldCheck,
  Star
} from 'lucide-react';
import { publicEventAPI } from '../../services/api';
import PublicNavbar from './PublicNavbar';
import PublicFooter from './PublicFooter';
import BadgeScannerModal from './BadgeScannerModal';
import {
  LaurelRankBadge,
  ExploreFlagArt,
  ExploreTrophyArt,
  TwinklingStar
} from './PublicArtwork';

const PublicPointsPage = () => {
  const { eventId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    fetchStandings();
  }, [eventId]);

  const fetchStandings = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await publicEventAPI.getPublicPortal(eventId);
      setData(res.data);
    } catch (err) {
      console.error('Failed to load championship standings:', err);
      if (err.response?.status === 403) {
        setError('This festival portal is currently private.');
      } else {
        setError('Unable to load championship standings. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };

  const event = data?.event;
  const rawStandings = data?.team_standings || [];

  // Filtered standings by search query
  const filteredStandings = useMemo(() => {
    if (!searchTerm) return rawStandings;
    return rawStandings.filter((t) =>
      t.team_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [rawStandings, searchTerm]);

  // Top 3 Podium Teams
  const topThree = useMemo(() => {
    return rawStandings.slice(0, 3);
  }, [rawStandings]);

  const firstPlace = topThree[0] || null;
  const secondPlace = topThree[1] || null;
  const thirdPlace = topThree[2] || null;

  const toggleExpand = (teamId) => {
    setExpandedTeamId((prev) => (prev === teamId ? null : teamId));
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
          Calculating Championship Standings...
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
            Championship Unavailable
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed font-sans">{error}</p>
          <button
            type="button"
            onClick={fetchStandings}
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

      {/* 2. Main Championship Container */}
      <main className="flex-1 pt-28 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto w-full space-y-12">
        
        {/* Header Vignette */}
        <div className="text-center space-y-3 relative">
          <div className="absolute top-0 right-1/4 pointer-events-none">
            <TwinklingStar size={16} delay="0.5s" />
          </div>
          <div className="absolute top-4 left-1/4 pointer-events-none">
            <TwinklingStar size={14} delay="1.2s" />
          </div>

          <div className="flex items-center justify-center space-x-2 text-amber-400">
            <Sparkles className="w-4 h-4 animate-twinkle" />
            <span className="font-cinzel text-xs uppercase tracking-[0.25em] font-bold">
              Team Points & Standings
            </span>
            <Sparkles className="w-4 h-4 animate-twinkle" />
          </div>

          <h1 className="font-cinzel-dec text-3xl sm:text-5xl font-bold tracking-tight text-white drop-shadow-md">
            Championship Leaderboard
          </h1>

          <p className="text-xs sm:text-sm text-amber-200/80 max-w-lg mx-auto font-sans leading-relaxed">
            Overall team rankings and points earned across all officially published programs in {event?.title || event?.name || 'the festival'}.
          </p>
        </div>

        {/* 3. Top-3 Championship Podium (When at least 1 team has points) */}
        {rawStandings.length > 0 && (
          <div className="pt-4 pb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end max-w-4xl mx-auto">
              
              {/* 2nd Place Podium */}
              <div className="order-2 md:order-1 flex flex-col items-center">
                {secondPlace ? (
                  <div className="w-full bg-gradient-to-b from-[#1C1738] to-[#120E28] border-2 border-slate-400/40 rounded-3xl p-6 text-center space-y-3 shadow-xl relative transform hover:scale-[1.02] transition-transform">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                      <LaurelRankBadge rank={2} size={50} />
                    </div>
                    <div className="pt-5">
                      <span className="font-cinzel text-[11px] uppercase tracking-widest text-slate-300 font-bold">
                        Silver Laurels
                      </span>
                      <h3 className="font-editorial text-xl font-bold text-white truncate pt-1">
                        {secondPlace.team_name}
                      </h3>
                      <div className="pt-2 flex items-center justify-center space-x-2">
                        <span className="font-cinzel text-3xl font-bold text-slate-200">
                          {secondPlace.total_points}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase">pts</span>
                      </div>
                      <div className="pt-2 flex justify-center gap-2 text-[11px] text-slate-300">
                        <span className="bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-600">
                          🥇 {secondPlace.first_places}
                        </span>
                        <span className="bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-600">
                          🥈 {secondPlace.second_places}
                        </span>
                        <span className="bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-600">
                          🥉 {secondPlace.third_places}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-44 w-full border border-dashed border-white/10 rounded-3xl flex items-center justify-center text-xs text-slate-500">
                    2nd Position Pending
                  </div>
                )}
              </div>

              {/* 1st Place Champion Podium (Elevated / Golden) */}
              <div className="order-1 md:order-2 flex flex-col items-center">
                {firstPlace ? (
                  <div className="w-full bg-gradient-to-b from-[#2B1B4A] via-[#1F1439] to-[#150D2B] border-2 border-amber-400/70 rounded-3xl p-8 text-center space-y-3 shadow-[0_15px_40px_rgba(245,158,11,0.25)] relative transform hover:scale-[1.03] transition-transform">
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2">
                      <LaurelRankBadge rank={1} size={64} />
                    </div>
                    <div className="w-full flex justify-center pt-4">
                      <ExploreFlagArt size={64} />
                    </div>
                    <div>
                      <span className="font-cinzel text-xs uppercase tracking-[0.2em] text-amber-300 font-bold block">
                        ✦ Grand Champion ✦
                      </span>
                      <h3 className="font-editorial text-2xl sm:text-3xl font-bold text-white truncate pt-1">
                        {firstPlace.team_name}
                      </h3>
                      <div className="pt-2 flex items-center justify-center space-x-2">
                        <span className="font-cinzel text-4xl sm:text-5xl font-bold text-amber-300 drop-shadow-[0_2px_12px_rgba(245,158,11,0.4)]">
                          {firstPlace.total_points}
                        </span>
                        <span className="text-sm font-bold text-amber-200 uppercase">pts</span>
                      </div>
                      <div className="pt-3 flex justify-center gap-2 text-xs text-amber-100 font-semibold">
                        <span className="bg-amber-500/20 px-3 py-1 rounded-full border border-amber-400/40">
                          🥇 {firstPlace.first_places} Golds
                        </span>
                        <span className="bg-amber-500/20 px-3 py-1 rounded-full border border-amber-400/40">
                          🥈 {firstPlace.second_places}
                        </span>
                        <span className="bg-amber-500/20 px-3 py-1 rounded-full border border-amber-400/40">
                          🥉 {firstPlace.third_places}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-56 w-full border border-dashed border-white/10 rounded-3xl flex items-center justify-center text-xs text-slate-500">
                    Grand Champion Pending
                  </div>
                )}
              </div>

              {/* 3rd Place Podium */}
              <div className="order-3 flex flex-col items-center">
                {thirdPlace ? (
                  <div className="w-full bg-gradient-to-b from-[#1C1738] to-[#120E28] border-2 border-amber-700/50 rounded-3xl p-6 text-center space-y-3 shadow-xl relative transform hover:scale-[1.02] transition-transform">
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2">
                      <LaurelRankBadge rank={3} size={50} />
                    </div>
                    <div className="pt-5">
                      <span className="font-cinzel text-[11px] uppercase tracking-widest text-amber-600 font-bold">
                        Bronze Laurels
                      </span>
                      <h3 className="font-editorial text-xl font-bold text-white truncate pt-1">
                        {thirdPlace.team_name}
                      </h3>
                      <div className="pt-2 flex items-center justify-center space-x-2">
                        <span className="font-cinzel text-3xl font-bold text-amber-600">
                          {thirdPlace.total_points}
                        </span>
                        <span className="text-xs font-bold text-slate-400 uppercase">pts</span>
                      </div>
                      <div className="pt-2 flex justify-center gap-2 text-[11px] text-slate-300">
                        <span className="bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-600">
                          🥇 {thirdPlace.first_places}
                        </span>
                        <span className="bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-600">
                          🥈 {thirdPlace.second_places}
                        </span>
                        <span className="bg-slate-800/80 px-2.5 py-1 rounded-full border border-slate-600">
                          🥉 {thirdPlace.third_places}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="h-44 w-full border border-dashed border-white/10 rounded-3xl flex items-center justify-center text-xs text-slate-500">
                    3rd Position Pending
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

        {/* 4. Search Filter & Leaderboard Table */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <h2 className="font-cinzel text-xl sm:text-2xl font-bold text-white tracking-wide">
              Complete Standings Table
            </h2>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-amber-400/80 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search team name..."
                className="w-full pl-10 pr-4 py-2.5 rounded-full bg-[#181335] border border-amber-500/30 text-xs text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 shadow-inner"
              />
            </div>
          </div>

          {/* Standings List Table */}
          <div className="space-y-3">
            {filteredStandings.length > 0 ? (
              filteredStandings.map((team, idx) => {
                const rank = idx + 1;
                const isExpanded = expandedTeamId === team.team_id;
                const hasResults = team.program_results && team.program_results.length > 0;

                return (
                  <div
                    key={team.team_id}
                    className="rounded-2xl bg-gradient-to-r from-[#1A1435] via-[#15102E] to-[#1A1435] border border-amber-400/20 shadow-md hover:border-amber-400/40 transition-all overflow-hidden"
                  >
                    <div
                      className="p-4 sm:p-5 flex items-center justify-between gap-4 cursor-pointer"
                      onClick={() => toggleExpand(team.team_id)}
                    >
                      {/* Left: Rank & Team */}
                      <div className="flex items-center space-x-3 sm:space-x-4 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-400/30 flex items-center justify-center shrink-0">
                          <span className="font-cinzel font-bold text-amber-300 text-sm">
                            #{rank}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-editorial text-base sm:text-lg font-bold text-white truncate">
                            {team.team_name}
                          </h4>
                          <div className="flex items-center gap-3 text-[11px] text-slate-400 font-sans pt-0.5">
                            <span>Won: {team.programs_won || 0}</span>
                            <span>•</span>
                            <span className="text-amber-300">🥇 {team.first_places}</span>
                            <span className="text-slate-300">🥈 {team.second_places}</span>
                            <span className="text-amber-600">🥉 {team.third_places}</span>
                          </div>
                        </div>
                      </div>

                      {/* Right: Total Points & Accordion Trigger */}
                      <div className="flex items-center space-x-4 shrink-0">
                        <div className="text-right">
                          <span className="font-cinzel text-xl sm:text-2xl font-bold text-amber-300 block">
                            {team.total_points}
                          </span>
                          <span className="text-[10px] uppercase font-bold text-amber-200/60 block">
                            Points
                          </span>
                        </div>

                        {hasResults && (
                          <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                            {isExpanded ? (
                              <ChevronUp className="w-4 h-4" />
                            ) : (
                              <ChevronDown className="w-4 h-4" />
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Expandable Won Programs List */}
                    {isExpanded && hasResults && (
                      <div className="px-5 pb-5 pt-2 border-t border-white/10 bg-[#0F0B24]/70 space-y-3">
                        <span className="font-cinzel text-[11px] uppercase tracking-wider text-amber-300 font-bold block">
                          Published Achievements for {team.team_name}:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {team.program_results.map((pr, pIdx) => (
                            <div
                              key={pIdx}
                              className="p-3 rounded-xl bg-white/5 border border-white/10 text-xs flex items-center justify-between"
                            >
                              <div className="min-w-0">
                                <p className="font-bold text-white truncate">
                                  {pr.program_name}
                                </p>
                                <p className="text-[11px] text-slate-400 truncate">
                                  {pr.participant_name}
                                </p>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-400/20 text-amber-300">
                                  Rank {pr.position || '-'}
                                </span>
                                <span className="block text-[10px] text-amber-400 font-bold mt-0.5">
                                  +{pr.points_earned} pts
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-12 text-center rounded-3xl bg-[#16113A] border border-amber-500/20 text-slate-400 text-sm">
                No teams found matching &ldquo;{searchTerm}&rdquo;.
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 5. Global Footer */}
      <PublicFooter event={event} eventId={eventId} />

      {/* 6. Scanner Modal */}
      {isScannerOpen && (
        <BadgeScannerModal
          eventId={eventId}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
};

export default PublicPointsPage;

