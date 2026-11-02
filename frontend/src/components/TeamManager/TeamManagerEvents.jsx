import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { teamManagerAPI, categoriesAPI } from '../../services/api';
import {
  Calendar,
  MapPin,
  Clock,
  Users,
  Search,
  Target,
  Eye,
  AlertCircle,
  ChevronRight,
  Tag
} from 'lucide-react';

const TeamManagerEvents = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [eventPrograms, setEventPrograms] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [selectedTeam, setSelectedTeam] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const teamData = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = teamData.id || teamData.team_id;

      if (!teamId) {
        setError('No active team found. Please sign in again.');
        return;
      }
      setSelectedTeam(teamId);

      const [eventsResponse, studentsResponse, categoriesResponse] = await Promise.all([
        teamManagerAPI.getTeamEvents(teamId).catch((err) => {
          console.warn('Events fetch error:', err);
          return { data: { events: [] } };
        }),
        teamManagerAPI.getTeamStudents(teamId).catch((err) => {
          console.warn('Students fetch error:', err);
          return { data: { students: [] } };
        }),
        categoriesAPI.list().catch((err) => {
          console.warn('Categories fetch error:', err);
          return { data: [] };
        }),
      ]);

      const eventsData = Array.isArray(eventsResponse.data?.events)
        ? eventsResponse.data.events
        : Array.isArray(eventsResponse.data?.results)
          ? eventsResponse.data.results
          : (eventsResponse.data || []);

      const studentsData = Array.isArray(studentsResponse.data?.students)
        ? studentsResponse.data.students
        : Array.isArray(studentsResponse.data?.results)
          ? studentsResponse.data.results
          : (studentsResponse.data || []);

      const categoriesData = Array.isArray(categoriesResponse.data?.results)
        ? categoriesResponse.data.results
        : Array.isArray(categoriesResponse.data)
          ? categoriesResponse.data
          : [];

      setEvents(eventsData);
      setTeamMembers(studentsData);
      setCategories(categoriesData);

      // Fetch programs for events
      const programsData = {};
      for (const event of eventsData) {
        try {
          const programsResponse = await teamManagerAPI.getEventPrograms(teamId, event.id);
          let programsDataForEvent = [];
          if (programsResponse.data?.results) {
            programsDataForEvent = programsResponse.data.results.programs || [];
          } else {
            programsDataForEvent = programsResponse.data?.programs || [];
          }
          programsData[event.id] = programsDataForEvent;
        } catch (err) {
          console.warn(`Failed to fetch programs for event ${event.id}:`, err);
          programsData[event.id] = [];
        }
      }
      setEventPrograms(programsData);
    } catch (err) {
      console.error('Error fetching event data:', err);
      setError('Unable to load festivals and events.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'published':
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'ongoing':
        return 'bg-indigo-50 text-indigo-700 border-indigo-100';
      case 'completed':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'draft':
        return 'bg-amber-50 text-amber-700 border-amber-200';
      default:
        return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  const getCategoryDisplay = (code) => {
    if (!code) return 'General';
    const found = categories.find(
      (c) => c.code?.toLowerCase() === code.toLowerCase() || c.name?.toLowerCase() === code.toLowerCase()
    );
    if (found?.name) return found.name;
    const map = {
      lp: 'Lower Primary',
      up: 'Upper Primary',
      hs: 'High School',
      hss: 'Higher Secondary',
      junior: 'Junior',
      senior: 'Senior',
      general: 'General',
    };
    return map[code.toLowerCase()] || code.toUpperCase();
  };

  const getEventCategories = (eventId) => {
    const list = eventPrograms[eventId] || [];
    const set = new Set();
    list.forEach((p) => {
      if (p.category) set.add(p.category.toLowerCase());
    });
    return Array.from(set);
  };

  const filteredEvents = events.filter((event) => {
    const q = searchTerm.trim().toLowerCase();
    const matchesSearch =
      !q ||
      event.title?.toLowerCase().includes(q) ||
      event.description?.toLowerCase().includes(q) ||
      event.venue?.toLowerCase().includes(q);
    const matchesStatus = filterStatus === 'all' || event.status?.toLowerCase() === filterStatus.toLowerCase();

    let matchesCategory = true;
    if (filterCategory !== 'all') {
      const eventCats = getEventCategories(event.id);
      const targetCat = filterCategory.toLowerCase();
      matchesCategory = eventCats.some((c) => {
        return (
          c === targetCat ||
          categories.find((cat) => cat.code?.toLowerCase() === targetCat)?.name?.toLowerCase() === c ||
          categories.find((cat) => cat.name?.toLowerCase() === targetCat)?.code?.toLowerCase() === c
        );
      });
    }

    return matchesSearch && matchesStatus && matchesCategory;
  });

  const handleEventClick = (eventId) => {
    navigate(`/team-manager/events/${eventId}`);
  };

  if (loading) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb]">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600 mx-auto" />
          <p className="mt-3 text-sm font-medium text-slate-500">Loading festival schedules...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb] px-6">
        <div className="max-w-sm text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-rose-50 text-rose-600">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-900">Unable to load events</h2>
          <p className="mt-1 text-sm text-slate-500">{error}</p>
          <button
            type="button"
            onClick={fetchData}
            className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        {/* ========================================================================= */}
        {/* 1. HEADER (Matches Admin Portal) */}
        {/* ========================================================================= */}
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
              Workspace
            </p>
            <h1 className="mt-0.5 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Events & Festivals
            </h1>
            <p className="mt-0.5 text-xs text-slate-500">
              Active festivals and competitions for your team.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200/80 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-2xs">
              <Users className="h-3.5 w-3.5 text-slate-400" />
              <span>{teamMembers.length} Team Members</span>
            </div>
          </div>
        </header>

        {/* ========================================================================= */}
        {/* 2. SEARCH & FILTER BAR */}
        {/* ========================================================================= */}
        <section className="mt-4 sm:mt-5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-[1fr_180px_180px_auto]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                placeholder="Search events by title, venue or description..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
              />
            </div>

            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All Categories</option>
              {categories.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.name}
                </option>
              ))}
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100"
            >
              <option value="all">All Statuses</option>
              <option value="published">Published</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>

            <button
              onClick={() => {
                setSearchTerm('');
                setFilterStatus('all');
                setFilterCategory('all');
              }}
              className="h-10 rounded-xl px-4 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-indigo-700 sm:col-span-2 md:col-span-1"
            >
              Clear
            </button>
          </div>
        </section>

        {/* ========================================================================= */}
        {/* 3. TABLE FORMAT DIRECTORY (Matches Admin EventsPage exactly) */}
        {/* ========================================================================= */}
        <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-slate-900">Event directory</p>
              {filterCategory !== 'all' && (
                <span className="rounded-md bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700 border border-indigo-100">
                  {getCategoryDisplay(filterCategory)}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">{filteredEvents.length} events</p>
          </div>

          {filteredEvents.length === 0 ? (
            <div className="py-16 text-center">
              <Calendar className="mx-auto h-6 w-6 text-slate-300" />
              <p className="mt-3 text-sm font-semibold text-slate-900">No events found</p>
              <p className="mt-1 text-sm text-slate-400">
                There are no active festival events matching your current filters.
              </p>
              {(searchTerm || filterStatus !== 'all' || filterCategory !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchTerm('');
                    setFilterStatus('all');
                    setFilterCategory('all');
                  }}
                  className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-indigo-50 px-3.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                >
                  Reset Filters
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Desktop Table View */}
              <div className="hidden md:block overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-slate-50/80">
                    <tr>
                      {['Event', 'Schedule', 'Venue', 'Programs Allocated', 'Status'].map((label) => (
                        <th
                          key={label}
                          className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400"
                        >
                          {label}
                        </th>
                      ))}
                      <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredEvents.map((event) => {
                      const eventProgramsList = eventPrograms[event.id] || [];
                      const totalPrograms = eventProgramsList.length;
                      const assignedPrograms = eventProgramsList.filter((p) => p.assigned_count > 0).length;
                      const completionPercent = totalPrograms > 0 ? Math.round((assignedPrograms / totalPrograms) * 100) : 0;
                      const eventCats = getEventCategories(event.id);

                      return (
                        <tr key={event.id} className="transition hover:bg-indigo-50/30">
                          {/* Event Name & Category */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                                <Calendar className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <button
                                  type="button"
                                  onClick={() => handleEventClick(event.id)}
                                  className="text-left font-semibold text-slate-900 hover:text-indigo-600 transition truncate max-w-[260px] block text-sm"
                                >
                                  {event.title}
                                </button>
                                <p className="max-w-[260px] truncate text-xs text-slate-400">
                                  {event.description || (event.event_type ? `${event.event_type} festival` : 'Competition event')}
                                </p>
                                {eventCats.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {eventCats.map((catCode) => (
                                      <span
                                        key={catCode}
                                        className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-600"
                                      >
                                        {getCategoryDisplay(catCode)}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Schedule */}
                          <td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600">
                            <div>
                              {event.start_date ? new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'TBA'}
                              {event.end_date && event.end_date !== event.start_date && (
                                <> – {new Date(event.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>
                              )}
                            </div>
                            {event.start_time && (
                              <div className="text-xs text-slate-400 mt-0.5">{event.start_time}</div>
                            )}
                          </td>

                          {/* Venue */}
                          <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                            {event.venue ? (
                              <span className="inline-flex items-center gap-1.5 text-slate-600">
                                <MapPin className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                                <span className="truncate max-w-[180px]">{event.venue}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>

                          {/* Programs Allocated */}
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <div className="flex items-center gap-2.5">
                              <span className="text-xs font-semibold text-slate-700">
                                {assignedPrograms}/{totalPrograms}
                              </span>
                              <span className="text-xs text-slate-400">({completionPercent}%)</span>
                              <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                                <div
                                  className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                                  style={{ width: `${completionPercent}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="whitespace-nowrap px-5 py-3.5">
                            <span
                              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium capitalize ${getStatusBadge(
                                event.status
                              )}`}
                            >
                              {event.status || 'Active'}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="whitespace-nowrap px-5 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => handleEventClick(event.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-200 hover:bg-indigo-100"
                                title="View event details"
                              >
                                <Eye className="h-3.5 w-3.5" />
                                <span>View</span>
                              </button>
                              <button
                                onClick={() => handleEventClick(event.id)}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50/50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 transition hover:border-indigo-300 hover:bg-indigo-100"
                                title="Assign team roster to programs in this event"
                              >
                                <Target className="h-3.5 w-3.5" />
                                <span>Assign Programs</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards View */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredEvents.map((event) => {
                  const eventProgramsList = eventPrograms[event.id] || [];
                  const totalPrograms = eventProgramsList.length;
                  const assignedPrograms = eventProgramsList.filter((p) => p.assigned_count > 0).length;
                  const completionPercent = totalPrograms > 0 ? Math.round((assignedPrograms / totalPrograms) * 100) : 0;
                  const eventCats = getEventCategories(event.id);

                  return (
                    <article key={event.id} className="p-4 space-y-3 hover:bg-slate-50/60 transition-colors">
                      {/* Top: Icon + Title + Status */}
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-3 min-w-0">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600 mt-0.5">
                            <Calendar className="h-5 w-5" />
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => handleEventClick(event.id)}
                              className="text-left font-semibold text-slate-900 hover:text-indigo-600 transition text-sm leading-snug"
                            >
                              {event.title}
                            </button>
                            <p className="mt-0.5 text-xs text-slate-400 line-clamp-2">
                              {event.description || (event.event_type ? `${event.event_type} festival` : 'Competition event')}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize shrink-0 ${getStatusBadge(
                            event.status
                          )}`}
                        >
                          {event.status || 'Active'}
                        </span>
                      </div>

                      {/* Categories */}
                      {eventCats.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {eventCats.map((catCode) => (
                            <span
                              key={catCode}
                              className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-600"
                            >
                              {getCategoryDisplay(catCode)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Schedule & Venue info */}
                      <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-xl border border-slate-100">
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Date</p>
                          <p className="font-medium text-slate-800 truncate mt-0.5">
                            {event.start_date ? new Date(event.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'TBA'}
                          </p>
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Venue</p>
                          <p className="font-medium text-slate-800 truncate mt-0.5 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                            <span className="truncate">{event.venue || 'TBA'}</span>
                          </p>
                        </div>
                      </div>

                      {/* Program allocation progress */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-slate-500 font-medium">Programs Assigned</span>
                          <span className="font-bold text-slate-800">
                            {assignedPrograms}/{totalPrograms}{' '}
                            <span className="text-indigo-600 font-normal">({completionPercent}%)</span>
                          </span>
                        </div>
                        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                          <div
                            className="h-full rounded-full bg-indigo-600 transition-all duration-300"
                            style={{ width: `${completionPercent}%` }}
                          />
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          onClick={() => handleEventClick(event.id)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 shadow-2xs hover:bg-slate-50 transition-colors min-h-[40px]"
                        >
                          <Eye className="h-3.5 w-3.5 text-slate-400" />
                          <span>Details</span>
                        </button>
                        <button
                          onClick={() => handleEventClick(event.id)}
                          className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2.5 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 transition-colors min-h-[40px]"
                        >
                          <Target className="h-3.5 w-3.5" />
                          <span>Assign Programs</span>
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
        </section>
      </div>
    </main>
  );
};

export default TeamManagerEvents;
