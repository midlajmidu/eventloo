import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  RefreshCw, 
  ChevronRight, 
  X
} from 'lucide-react';
import { eventPointsAPI } from '../../services/api';

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

const EventPoints = ({ event, eventId }) => {
  const [teamPoints, setTeamPoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTeamDrawer, setSelectedTeamDrawer] = useState(null);

  useEffect(() => {
    fetchData();
    
    // Listen for points updates from mark entry & result publishing
    const handlePointsUpdate = (e) => {
      if (!e.detail || e.detail.eventId === parseInt(eventId, 10)) {
        setRefreshing(true);
        fetchData().finally(() => setRefreshing(false));
      }
    };
    
    window.addEventListener('pointsUpdated', handlePointsUpdate);
    return () => {
      window.removeEventListener('pointsUpdated', handlePointsUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const pointsRes = await eventPointsAPI.getEventTeamPoints(eventId);
      const teamPointsData = pointsRes.data?.results || pointsRes.data || [];
      setTeamPoints(teamPointsData);
    } catch (error) {
      console.error('EventPoints: Error fetching team points:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-3"></div>
        <p className="text-xs text-gray-500 font-medium">Loading Standings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-6xl mx-auto py-2">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-5 rounded-2xl border border-gray-100 shadow-2xs">
        <div>
          <h1 className="text-xl font-bold text-gray-900 tracking-tight flex items-center space-x-2">
            <span>Points Standings</span>
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Official published team leaderboard for {event?.title || 'this Event'}
          </p>
        </div>

        <button
          onClick={() => {
            setRefreshing(true);
            fetchData().finally(() => setRefreshing(false));
          }}
          disabled={refreshing}
          className="px-3.5 py-2 bg-gray-900 hover:bg-gray-800 text-white text-xs font-bold rounded-xl transition-all inline-flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          <span>{refreshing ? 'Syncing...' : 'Sync Points'}</span>
        </button>
      </div>

      {/* Main Leaderboard Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-2xs overflow-hidden">
        {teamPoints.length === 0 ? (
          <div className="py-16 text-center text-gray-400">
            <Trophy className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm font-bold text-gray-700">No published points recorded yet</p>
            <p className="text-xs text-gray-500 mt-1 max-w-xs mx-auto">
              Points will automatically appear here once competition results are published in the Results tab.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/70">
                <tr>
                  <th className="px-6 py-3.5 text-left text-[11px] font-extrabold text-gray-400 uppercase tracking-wider w-20">
                    Rank
                  </th>
                  <th className="px-6 py-3.5 text-left text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Team Name
                  </th>
                  <th className="px-6 py-3.5 text-center text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Competitions
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-extrabold text-gray-400 uppercase tracking-wider">
                    Total Points
                  </th>
                  <th className="px-6 py-3.5 text-right text-[11px] font-extrabold text-gray-400 uppercase tracking-wider w-36">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {addCompetitionRanks(teamPoints).map((team) => {
                  const rank = team.rank;

                  return (
                    <tr 
                      key={team.team_id}
                      className="hover:bg-gray-50/70 transition-colors"
                    >
                      {/* Rank */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center justify-center w-7 h-7 rounded-lg text-xs font-extrabold ${
                          rank === 1 ? 'bg-amber-100 text-amber-900 border border-amber-300' :
                          rank === 2 ? 'bg-slate-100 text-slate-800 border border-slate-300' :
                          rank === 3 ? 'bg-orange-100 text-orange-900 border border-orange-200' :
                          'bg-gray-50 text-gray-600 border border-gray-200'
                        }`}>
                          {rank}
                        </span>
                      </td>

                      {/* Team Name */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-bold text-sm text-gray-900">{team.team_name}</div>
                      </td>

                      {/* Competitions */}
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="text-xs font-semibold text-gray-600">
                          {team.programs_participated || 0} Competed
                        </span>
                      </td>

                      {/* Total Points */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <span className="font-extrabold text-sm text-emerald-700">
                          {team.total_points || 0} PTS
                        </span>
                      </td>

                      {/* Action / Breakdown */}
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => setSelectedTeamDrawer(team)}
                          className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg transition-colors border border-gray-200 inline-flex items-center space-x-1 cursor-pointer"
                        >
                          <span>Breakdown</span>
                          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Team Breakdown Slide-Over Drawer */}
      {selectedTeamDrawer && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50 overflow-hidden">
          <div className="w-full max-w-md bg-white h-full shadow-2xl overflow-y-auto flex flex-col transition-transform duration-300">
            
            {/* Drawer Header */}
            <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <div>
                <h2 className="text-base font-bold text-gray-900">
                  {selectedTeamDrawer.team_name}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  Total Points: <strong className="text-emerald-600">{selectedTeamDrawer.total_points} PTS</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedTeamDrawer(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Drawer Body List */}
            <div className="p-5 flex-1 overflow-y-auto space-y-3 bg-gray-50/50">
              <div className="text-xs font-extrabold text-gray-400 uppercase tracking-wider mb-2">
                Published Competition Breakdown
              </div>

              {selectedTeamDrawer.program_results && selectedTeamDrawer.program_results.length > 0 ? (
                selectedTeamDrawer.program_results.map((res, idx) => (
                  <div key={idx} className="p-3.5 bg-white rounded-xl border border-gray-100 flex items-center justify-between text-xs shadow-2xs">
                    <div>
                      <div className="font-bold text-gray-900">{res.program_name}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5">
                        {res.category?.toUpperCase() || 'GENERAL'} {res.participant_name ? `• ${res.participant_name}` : ''}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {res.position && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                          res.position === 1 ? 'bg-amber-50 text-amber-800 border-amber-200' :
                          res.position === 2 ? 'bg-slate-100 text-slate-700 border-slate-200' :
                          'bg-orange-50 text-orange-800 border-orange-200'
                        }`}>
                          {res.position === 1 ? '1st Place' : res.position === 2 ? '2nd Place' : '3rd Place'}
                        </span>
                      )}

                      <span className="font-extrabold text-emerald-700">
                        +{res.points_earned} PTS
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-gray-400 bg-white border border-gray-100 rounded-xl">
                  No published scores available.
                </div>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-4 border-t border-gray-100 bg-white flex items-center justify-between sticky bottom-0">
              <span className="text-xs text-gray-400">Synced with published results</span>
              <button
                onClick={() => setSelectedTeamDrawer(null)}
                className="px-4 py-2 bg-gray-900 text-white text-xs font-bold rounded-xl hover:bg-gray-800 transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default EventPoints;
