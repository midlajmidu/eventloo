import React, { useState, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';
import { eventsAPI, teamsAPI, eventProgramTypesAPI } from '../../services/api';

const EventTopScorers = ({ event, eventId, categories = [] }) => {
  const [scorers, setScorers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [programTypes, setProgramTypes] = useState(event?.program_types || []);
  const [loading, setLoading] = useState(true);

  // Filters & Checkboxes State
  const [includeTeamBased, setIncludeTeamBased] = useState(false);
  const [includeGeneralCategory, setIncludeGeneralCategory] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTeamId, setSelectedTeamId] = useState('all');

  useEffect(() => {
    fetchTeams();
    const actualId = eventId || event?.id;
    if (actualId) {
      eventProgramTypesAPI.list(actualId)
        .then(res => {
          const list = res.data?.results || res.data || [];
          if (Array.isArray(list) && list.length > 0) setProgramTypes(list);
          else if (event?.program_types) setProgramTypes(event.program_types);
        })
        .catch(() => {
          if (event?.program_types) setProgramTypes(event.program_types);
        });
    }
  }, [eventId, event?.id, event?.program_types]);

  useEffect(() => {
    fetchTopScorers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, includeTeamBased, includeGeneralCategory, selectedCategory, selectedTeamId]);

  const fetchTeams = async () => {
    try {
      const res = await teamsAPI.getTeams();
      setTeams(res.data.results || res.data || []);
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  };

  const fetchTopScorers = async () => {
    try {
      setLoading(true);
      const params = {
        include_team_based: includeTeamBased,
        include_general_category: includeGeneralCategory,
        category: selectedCategory,
        team_id: selectedTeamId
      };
      const res = await eventsAPI.getTopScorers(eventId, params);
      setScorers(res.data.scorers || []);
    } catch (err) {
      console.error('Error fetching top scorers:', err);
    } finally {
      setLoading(false);
    }
  };

  // Client-side search filtering
  const filteredScorers = scorers.filter(scorer => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      scorer.name?.toLowerCase().includes(term) ||
      scorer.team_name?.toLowerCase().includes(term) ||
      scorer.category_display?.toLowerCase().includes(term) ||
      String(scorer.chest_number || '').includes(term)
    );
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      
      {/* Top Header Title & Subtitle */}
      <div className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-white via-white to-indigo-50/70 px-5 py-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-600">Performance</p>
        <h1 className="mt-1 text-xl sm:text-2xl font-bold text-slate-950 tracking-tight flex items-center space-x-2">
          <span>Top Scorers</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          View event top performers and their total points (only includes published results)
        </p>
      </div>

      {/* Checkboxes & Filters Controls Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs space-y-4">
        
        {/* Checkboxes Row */}
        <div className="flex flex-wrap items-center gap-6 text-xs sm:text-sm font-semibold text-gray-800 border-b border-gray-100 pb-3">
          
          {/* Checkbox 1: Include Team Based Category */}
          <label className="inline-flex items-center space-x-2.5 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={includeTeamBased}
              onChange={(e) => setIncludeTeamBased(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="group-hover:text-gray-900 transition-colors">
              Include Team Based Programs
            </span>
          </label>

          {/* Checkbox 2: Include General Category Programs */}
          <label className="inline-flex items-center space-x-2.5 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={includeGeneralCategory}
              onChange={(e) => setIncludeGeneralCategory(e.target.checked)}
              className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 cursor-pointer"
            />
            <span className="group-hover:text-gray-900 transition-colors">
              Include General Category Programs
            </span>
          </label>
        </div>

        {/* Search & Dropdowns Row */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search participants..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
            />
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center space-x-3">
            
            {/* Category Dropdown */}
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="appearance-none pl-3.5 pr-8 py-2 text-xs bg-white border border-gray-200 rounded-xl font-medium text-gray-700 hover:border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer outline-none transition-all"
              >
                <option value="all">All Categories</option>
                {categories.map((cat) => (
                  <option key={cat.id || cat.code} value={cat.code}>
                    {cat.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Teams Dropdown */}
            <div className="relative">
              <select
                value={selectedTeamId}
                onChange={(e) => setSelectedTeamId(e.target.value)}
                className="appearance-none pl-3.5 pr-8 py-2 text-xs bg-white border border-gray-200 rounded-xl font-medium text-gray-700 hover:border-gray-300 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer outline-none transition-all"
              >
                <option value="all">All Teams</option>
                {teams.map((tm) => (
                  <option key={tm.id} value={tm.id}>
                    {tm.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-gray-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Main Top Scorers Table */}
      <div className="bg-white border border-gray-100 rounded-3xl shadow-2xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
            <p className="text-xs text-gray-500 font-medium">Calculating Top Scorers...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50/70">
                <tr>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 tracking-wide">
                    Participant
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 tracking-wide">
                    Team
                  </th>
                  <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-600 tracking-wide">
                    Category
                  </th>
                  {(programTypes.length > 0 ? programTypes : [
                    { code: 'off_stage', name: 'Off-Stage' },
                    { code: 'stage', name: 'Stage' }
                  ]).map(pt => (
                    <th key={pt.code} className="px-6 py-3.5 text-right text-xs font-bold text-gray-600 tracking-wide">
                      {pt.name}
                    </th>
                  ))}
                  <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-600 tracking-wide">
                    Total Points
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filteredScorers.length > 0 ? (
                  filteredScorers.map((scorer, idx) => (
                    <tr key={scorer.student_id || idx} className="hover:bg-gray-50/70 transition-colors">
                      
                      {/* Participant Name & Special Badges */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-2.5">
                          {scorer.chest_number && (
                            <span className="px-2 py-0.5 text-[11px] font-bold font-mono rounded-md bg-slate-100 text-slate-700 border border-slate-200/80">
                              #{scorer.chest_number}
                            </span>
                          )}
                          <span className="font-bold text-xs text-gray-900">
                            {scorer.name}
                          </span>
                          
                          {/* Badges (e.g. Top Scorer) */}
                          {scorer.badges && scorer.badges.map((badge, bIdx) => (
                            <span 
                              key={bIdx}
                              className="px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-indigo-600 text-white shadow-2xs"
                            >
                              {badge.title}
                            </span>
                          ))}
                        </div>
                      </td>


                      {/* Team */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-700 font-medium">
                        {scorer.team_name}
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-700 font-medium">
                        {scorer.category_display}
                      </td>

                      {/* Dynamic Points by Type */}
                      {(programTypes.length > 0 ? programTypes : [
                        { code: 'off_stage', name: 'Off-Stage' },
                        { code: 'stage', name: 'Stage' }
                      ]).map(pt => {
                        const pts = scorer.points_by_type?.[pt.code] ?? (
                          pt.code === 'stage' ? scorer.stage_points : (
                            pt.code === 'off_stage' ? scorer.offstage_points : 0
                          )
                        );
                        return (
                          <td key={pt.code} className="px-6 py-4 text-right whitespace-nowrap text-xs text-gray-700 font-medium">
                            {pts ?? 0}
                          </td>
                        );
                      })}

                      {/* Total Points */}
                      <td className="px-6 py-4 text-right whitespace-nowrap text-xs font-bold text-gray-900">
                        {scorer.total_points}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4 + (programTypes.length > 0 ? programTypes.length : 2)} className="px-6 py-12 text-center text-xs text-gray-500">
                      No published results or top performers found matching your filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventTopScorers;
