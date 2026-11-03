import React, { useState, useEffect } from 'react';
import { Search, ChevronDown, User, RefreshCw, X, ExternalLink, Eye, QrCode, Copy, Check, ShieldCheck } from 'lucide-react';
import { eventsAPI, teamsAPI } from '../../services/api';
import QRCodeSVG from '../common/QRCodeSVG';

const EventParticipants = ({ 
  eventId, 
  categories = [], 
  teamId = null, 
  teamName = null, 
  isTeamManager = false 
}) => {
  const [participants, setParticipants] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState(null);
  
  // Drawer state for viewing student program details
  const [selectedParticipant, setSelectedParticipant] = useState(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState('all');
  const [selectedGender, setSelectedGender] = useState('all');

  useEffect(() => {
    if (eventId) {
      fetchParticipantsData();
      if (!teamId) {
        fetchTeamsData();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, teamId]);

  const fetchParticipantsData = async () => {
    try {
      setLoading(true);
      const params = teamId ? { team_id: teamId } : {};
      const res = await eventsAPI.getChestNumbers(eventId, params);
      let list = [];
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data?.results)) {
        list = res.data.results;
      } else if (Array.isArray(res.data?.data)) {
        list = res.data.data;
      }
      setParticipants(list);
    } catch (err) {
      console.error('Error fetching event participants:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamsData = async () => {
    try {
      const res = await teamsAPI.getTeams();
      let list = [];
      if (Array.isArray(res.data)) {
        list = res.data;
      } else if (Array.isArray(res.data?.results)) {
        list = res.data.results;
      }
      setTeams(list);
    } catch (err) {
      console.error('Error fetching teams:', err);
    }
  };

  // Filtered Participants List
  const filteredParticipants = participants.filter((item) => {
    const sName = (item.student_name || item.student_details?.full_name || '').toLowerCase();
    const cNo = (item.chest_number || '').toString().toLowerCase();
    const q = searchQuery.toLowerCase().trim();
    
    // Search query filter
    if (q && !sName.includes(q) && !cNo.includes(q)) {
      return false;
    }

    // Category filter
    if (selectedCategory && selectedCategory !== 'all') {
      const itemCat = (item.category || '').toLowerCase();
      const targetCat = selectedCategory.toLowerCase();
      const catObj = (categories || []).find(c => (c.code || '').toLowerCase() === targetCat || (c.id || '').toString() === targetCat);
      const catName = catObj ? (catObj.name || '').toLowerCase() : '';
      
      const matchesCat = itemCat === targetCat || (catName && itemCat === catName) || itemCat.includes(targetCat);
      if (!matchesCat) return false;
    }

    // Team filter
    if (isTeamManager) {
      // Backend already strictly isolates to this manager's team; ensure safe matching
      if (teamId && item.team && typeof item.team !== 'object') {
        if (item.team.toString() !== teamId.toString()) {
          return false;
        }
      }
    } else if (teamId) {
      const itemTeam = (typeof item.team === 'object' ? item.team?.id : item.team || '').toString();
      const itemTeamId = (item.team_id || '').toString();
      const targetTeam = teamId.toString();
      const itemTeamName = (item.team_name || '').toLowerCase();
      const targetTeamName = (teamName || '').toLowerCase();
      const matchesStrict = itemTeam === targetTeam || itemTeamId === targetTeam || (targetTeamName && (itemTeamName === targetTeamName || itemTeamName.includes(targetTeamName)));
      if (!matchesStrict) return false;
    } else if (selectedTeam && selectedTeam !== 'all') {
      const itemTeamId = (typeof item.team === 'object' ? item.team?.id : item.team || '').toString();
      const itemTeamName = (item.team_name || '').toLowerCase();
      const targetTeam = selectedTeam.toLowerCase();
      const teamObj = (teams || []).find(t => (t.id || '').toString() === targetTeam);
      const tName = teamObj ? (teamObj.name || '').toLowerCase() : '';

      const matchesTeam = itemTeamId === targetTeam || (tName && itemTeamName === tName) || (tName && itemTeamName.includes(tName));
      if (!matchesTeam) return false;
    }

    if (selectedGender !== 'all' && (item.gender || '').toLowerCase() !== selectedGender) {
      return false;
    }

    return true;
  });

  // Calculate drawer point summary totals
  const drawerPrograms = selectedParticipant?.assigned_programs || [];
  const offstagePoints = drawerPrograms
    .filter(p => !p.is_stage)
    .reduce((sum, p) => sum + (p.points || 0), 0);

  const stagePoints = drawerPrograms
    .filter(p => p.is_stage)
    .reduce((sum, p) => sum + (p.points || 0), 0);

  const totalScore = offstagePoints + stagePoints;

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2 relative">
      
      {/* Header Card Box */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs flex items-center justify-between">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
            {isTeamManager ? 'Team Participants' : 'Participants'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {isTeamManager ? (
              <>Viewing assigned participants and chest numbers for <span className="font-semibold text-indigo-600">{teamName || 'Your Team'}</span></>
            ) : (
              <>Manage registrations and chest numbers for <span className="font-semibold text-gray-700">this event</span></>
            )}
          </p>
        </div>

        <button
          onClick={fetchParticipantsData}
          disabled={loading}
          className="flex items-center space-x-2 px-3.5 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-indigo-600' : 'text-gray-500'}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Search and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search participants..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs"
          />
        </div>

        {/* Filters Dropdowns */}
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          
          {/* Category Dropdown */}
          <div className="relative flex-1 sm:flex-initial">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full appearance-none pl-3.5 pr-9 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-2xs"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat.code || cat.id} value={cat.code || cat.id}>
                  {cat.name || (cat.code ? cat.code.toUpperCase() : 'Category')}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

          {/* Team Dropdown or Fixed Team Label */}
          {teamId ? (
            <div className="px-3.5 py-2 bg-indigo-50 border border-indigo-200/90 rounded-xl text-xs font-bold text-indigo-700 shadow-2xs whitespace-nowrap">
              {teamName || 'My Team'}
            </div>
          ) : (
            <div className="relative flex-1 sm:flex-initial">
              <select
                value={selectedTeam}
                onChange={(e) => setSelectedTeam(e.target.value)}
                className="w-full appearance-none pl-3.5 pr-9 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-slate-900 cursor-pointer shadow-2xs"
              >
                <option value="all">All Teams</option>
                {teams.map((team) => (
                  <option key={team.id} value={team.id.toString()}>
                    {team.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            </div>
          )}

          <div className="relative flex-1 sm:flex-initial">
            <select value={selectedGender} onChange={(e) => setSelectedGender(e.target.value)} className="w-full appearance-none pl-3.5 pr-9 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs">
              <option value="all">All Genders</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>

        </div>

      </div>

      {/* Participants Table */}
      <div className="bg-white border border-gray-100 rounded-2xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-700">
                  Name
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-700">
                  Chest No.
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-700">
                  Gender
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-700">
                  Category
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-bold text-gray-700">
                  Team
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-bold text-gray-700">
                  Action
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                // Skeleton Rows
                Array.from({ length: 6 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200" />
                        <div className="h-4 w-32 bg-gray-200 rounded" />
                      </div>
                    </td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-200 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-200 rounded" /></td>
                    <td className="px-6 py-4"><div className="h-4 w-28 bg-gray-200 rounded" /></td>
                    <td className="px-6 py-4 text-right"><div className="h-4 w-20 bg-gray-200 rounded ml-auto" /></td>
                  </tr>
                ))
              ) : filteredParticipants.length > 0 ? (
                filteredParticipants.map((item) => {
                  const sName = item.student_name || item.student_details?.full_name || 'Participant Name';
                  return (
                    <tr 
                      key={item.id} 
                      onClick={() => setSelectedParticipant(item)}
                      className="hover:bg-gray-50/70 transition-colors cursor-pointer group"
                    >
                      
                      {/* Name Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200/80 flex items-center justify-center text-slate-700 font-bold text-xs group-hover:border-slate-300 transition-colors">
                            {sName ? sName.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                          </div>
                          <div>
                            <div className="text-xs font-bold text-gray-900 group-hover:text-slate-900 transition-colors flex items-center space-x-1.5">
                              <span>{sName}</span>
                              <ExternalLink className="w-3 h-3 text-gray-300 group-hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            {item.student_id && (
                              <div className="text-[11px] text-gray-400 font-mono">
                                ID: {item.student_id}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Chest No. Column */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-gray-100 text-gray-800 border border-gray-200/80">
                          #{item.chest_number || 'N/A'}
                        </span>
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium capitalize text-gray-600">
                        {item.gender || '—'}
                      </td>

                      {/* Category Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-semibold text-gray-600">
                        {item.category || 'General'}
                      </td>

                      {/* Team Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-xs font-medium text-gray-700">
                        {item.team_name || 'Individual'}
                      </td>

                      {/* Action Column */}
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <a
                          href={`${window.location.origin}/events/${eventId}/badge/${item.student || item.id || item.chest_number}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Open Public Badge"
                          className="inline-flex items-center space-x-1 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl shadow-2xs transition-colors mr-2 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Pass</span>
                        </a>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedParticipant(item);
                          }}
                          className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Details</span>
                        </button>
                      </td>

                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-xs text-gray-400">
                    No assigned participants found matching your filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side Drawer for Participant Details (Matching User's Provided Mock Screenshot) */}
      {selectedParticipant && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-slate-900/40 backdrop-blur-xs flex justify-end transition-opacity">
          {/* Backdrop Click to Close */}
          <div 
            className="fixed inset-0"
            onClick={() => setSelectedParticipant(null)}
          />

          {/* Slide-over Drawer Panel */}
          <div className="relative w-full max-w-2xl bg-white shadow-2xl h-full flex flex-col z-10 p-6 overflow-y-auto animate-in slide-in-from-right duration-200">
            
            {/* Header: Student Name #ChestNo & Close Button */}
            <div className="flex items-start justify-between pb-4 border-b border-gray-100">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 tracking-tight flex items-center space-x-2">
                  <span>{(selectedParticipant.student_name || selectedParticipant.student_details?.full_name || 'PARTICIPANT').toUpperCase()}</span>
                  <span className="text-gray-800 font-extrabold">#{selectedParticipant.chest_number || 'N/A'}</span>
                </h2>
                <div className="flex items-center space-x-4 text-xs text-gray-500 font-medium mt-1.5">
                  <div>
                    Team: <span className="text-gray-900 font-bold">{selectedParticipant.team_name || 'Individual'}</span>
                  </div>
                  <div className="text-gray-300">•</div>
                  <div>
                    Category: <span className="text-gray-900 font-bold">{selectedParticipant.category || 'General'}</span>
                  </div>
                  <div className="text-gray-300">•</div>
                  <div>
                    Gender: <span className="text-gray-900 font-bold capitalize">{selectedParticipant.gender || 'Not set'}</span>
                  </div>
                </div>
              </div>

              <button
                onClick={() => setSelectedParticipant(null)}
                className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-xl transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* QR-Based Digital Festival Pass Card */}
            {(() => {
              const studentIdentifier = selectedParticipant.student || selectedParticipant.id || selectedParticipant.chest_number;
              const publicBadgeUrl = `${window.location.origin}/events/${eventId}/badge/${studentIdentifier}`;
              return (
                <div className="mt-5 rounded-2xl bg-slate-50/90 p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="flex items-center space-x-4">
                    {/* QR Code Container */}
                    <div className="w-24 h-24 sm:w-28 sm:h-28 bg-white p-2 rounded-2xl shadow-2xs shrink-0 flex items-center justify-center border border-slate-200/90">
                      <QRCodeSVG
                        eventId={eventId}
                        studentId={selectedParticipant.student || selectedParticipant.id}
                        value={publicBadgeUrl}
                        size={100}
                        className="w-full h-full"
                      />
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" />
                          <span>Event Digital Pass</span>
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-900 bg-white border border-slate-200 px-2 py-0.5 rounded-md">
                          #{selectedParticipant.chest_number || 'N/A'}
                        </span>
                      </div>
                      <h4 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                        Public Participant Badge
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-snug">
                        Event-specific QR code linking to verified student badge, school branding, chest no & enrolled programs.
                      </p>
                    </div>
                  </div>

                  <div className="flex sm:flex-col items-stretch gap-2 w-full sm:w-36 shrink-0">
                    <a
                      href={publicBadgeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer text-center"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Open Badge</span>
                    </a>

                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(publicBadgeUrl);
                        setCopiedId(selectedParticipant.id);
                        setTimeout(() => setCopiedId(null), 2000);
                      }}
                      className="flex-1 sm:flex-initial inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 rounded-xl text-xs font-semibold shadow-2xs transition-colors cursor-pointer text-center"
                    >
                      {copiedId === selectedParticipant.id ? (
                        <>
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 text-slate-500" />
                          <span>Copy Link</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* Table of Assigned Programs (Matching user mockup) */}
            <div className="mt-6 flex-1">
              <div className="border border-gray-200/90 rounded-2xl overflow-hidden shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50/80 border-b border-gray-200/90 text-gray-700 font-bold">
                    <tr>
                      <th className="py-3.5 px-4">Competition</th>
                      <th className="py-3.5 px-3 text-center">Type</th>
                      <th className="py-3.5 px-3 text-center">Mode</th>
                      <th className="py-3.5 px-3 text-center">Status</th>
                      <th className="py-3.5 px-3 text-center">Grade</th>
                      <th className="py-3.5 px-4 text-right">Points</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 bg-white">
                    {drawerPrograms.length > 0 ? (
                      drawerPrograms.map((prog, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/60 transition-colors">
                          
                          {/* Competition Name */}
                          <td className="py-4 px-4 font-bold text-gray-900">
                            {prog.name}
                          </td>

                          {/* Type (Stage / Offstage) */}
                          <td className="py-4 px-3 text-center">
                            <span className="inline-block px-3 py-1 rounded-full text-[11px] font-medium bg-white text-gray-700 border border-gray-300/80 shadow-2xs">
                              {prog.type || 'Offstage'}
                            </span>
                          </td>

                          {/* Mode (Individual / Group) */}
                          <td className="py-4 px-3 text-center font-medium text-gray-700">
                            {prog.mode || 'Individual'}
                          </td>

                          {/* Status Badge */}
                          <td className="py-4 px-3 text-center">
                            {prog.status === 'Participated' ? (
                              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Participated
                              </span>
                            ) : prog.status === 'Not Participated' ? (
                              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-red-50 text-red-700 border border-red-200">
                                Not Participated
                              </span>
                            ) : (
                              <span className="inline-block px-3 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                Pending
                              </span>
                            )}
                          </td>

                          {/* Grade */}
                          <td className="py-4 px-3 text-center font-extrabold text-gray-900">
                            {prog.grade || '-'}
                          </td>

                          {/* Points */}
                          <td className="py-4 px-4 text-right font-extrabold text-indigo-600 text-sm">
                            {prog.mode === 'Group'
                              ? `${prog.team_points || 0} team`
                              : (prog.points || 0)}
                          </td>

                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan="6" className="py-8 text-center text-xs text-gray-400">
                          No programs assigned to this participant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer Summary Scores (Matching User Mockup) */}
            <div className="mt-8 pt-6 border-t border-gray-100 flex items-center justify-between">
              <div className="flex items-center space-x-8">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    OFFSTAGE POINTS
                  </div>
                  <div className="text-2xl font-black text-gray-900 mt-0.5">
                    {offstagePoints}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    STAGE POINTS
                  </div>
                  <div className="text-2xl font-black text-gray-900 mt-0.5">
                    {stagePoints}
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  TOTAL SCORE
                </div>
                <div className="text-3xl font-black text-indigo-600 mt-0.5">
                  {totalScore}
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default EventParticipants;
