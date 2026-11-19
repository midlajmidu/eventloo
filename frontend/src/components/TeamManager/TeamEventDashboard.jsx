import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  LayoutDashboard,
  BookOpen,
  CalendarClock,
  Users,
  Trophy,
  FileText,
  Download,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Clock,
  CheckCircle2,
  Lock,
  Layers,
  MapPin,
  Calendar,
  UserCheck,
  ChevronDown
} from 'lucide-react';
import { eventsAPI, teamManagerAPI, categoriesAPI, eventScheduleAPI } from '../../services/api';
import TeamEventOverview from './TeamEventOverview';
import EventPrograms from '../Event/EventPrograms';
import EventParticipants from '../Event/EventParticipants';
import EventResults from '../Event/EventResults';
import TeamEventDetail from './TeamEventDetail';
import TeamDocuments from './TeamDocuments';

const TeamEventDashboard = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();

  const [event, setEvent] = useState(null);
  const [categories, setCategories] = useState([]);
  const [teamData, setTeamData] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('team_data') || '{}');
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState('dashboard');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Quick live team stats for sidebar pulse
  const [teamStats, setTeamStats] = useState({
    programsCount: 0,
    assignedProgramsCount: 0,
    participantsCount: 0,
  });

  // Schedule PDF preview state
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');
  const [scheduleLayout, setScheduleLayout] = useState('stage'); // 'stage' | 'time'
  const [showDownloadOptions, setShowDownloadOptions] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, [eventId]);

  useEffect(() => {
    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [pdfUrl]);

  // Load PDF when switching to schedule tab if schedule is published
  useEffect(() => {
    if (activeTab === 'schedule' && event?.is_schedule_published && !pdfUrl && !loadingPdf) {
      loadSchedulePdf();
    }
  }, [activeTab, event?.is_schedule_published]);

  const fetchInitialData = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch team metadata from localStorage
      const storedTeam = JSON.parse(localStorage.getItem('team_data') || '{}');
      const teamId = storedTeam.id || storedTeam.team_id;

      let resolvedTeam = {
        ...storedTeam,
        name: storedTeam.name || storedTeam.team_name,
      };
      if (teamId) {
        try {
          const profileRes = await teamManagerAPI.getTeamProfile(teamId);
          if (profileRes.data) {
            const pTeam = profileRes.data.team || profileRes.data;
            resolvedTeam = {
              ...resolvedTeam,
              ...profileRes.data,
              id: pTeam.id || resolvedTeam.id || teamId,
              name: pTeam.name || pTeam.team_name || resolvedTeam.name,
              team_name: pTeam.name || pTeam.team_name || resolvedTeam.team_name,
            };
          }
        } catch (err) {
          console.warn('Could not refresh team profile:', err);
        }
      }
      setTeamData(resolvedTeam);

      // 2. Fetch event details & categories in parallel
      const [eventRes, catRes] = await Promise.all([
        eventsAPI.getEvent(eventId),
        categoriesAPI.list().catch(() => ({ data: [] }))
      ]);

      const eventObj = eventRes.data;
      if (eventObj && typeof eventObj.status !== 'string') {
        eventObj.status = 'published';
      }
      setEvent(eventObj);
      setCategories(catRes.data.results || catRes.data || []);

      // 3. Fetch team stats asynchronously for sidebar pulse
      const activeTeamId = resolvedTeam?.id || teamId;
      if (activeTeamId) {
        teamManagerAPI.getEventPrograms(activeTeamId, eventId).then((res) => {
          const progs = Array.isArray(res.data) ? res.data : (res.data?.results || res.data?.programs || []);
          let assignedProgs = 0;
          const assignedStudents = new Set();
          progs.forEach((p) => {
            const assigned = p.assigned_students || [];
            if (assigned.length > 0) assignedProgs += 1;
            assigned.forEach((st) => {
              const sid = st.student_id || st.id;
              if (sid) assignedStudents.add(sid);
            });
          });
          setTeamStats({
            programsCount: progs.length || eventObj?.programs?.length || eventObj?.programs_count || 0,
            assignedProgramsCount: assignedProgs,
            participantsCount: assignedStudents.size,
          });
        }).catch(() => {});
      }
    } catch (err) {
      console.error('Error loading team event dashboard:', err);
      setError('Unable to load event details. Please verify your team permissions.');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedulePdf = async (layout = scheduleLayout) => {
    setLoadingPdf(true);
    setPdfError('');
    try {
      const response = await eventScheduleAPI.export(eventId, 'pdf', layout);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      setPdfUrl((prevUrl) => {
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        return URL.createObjectURL(blob);
      });
    } catch (err) {
      console.error('Error fetching schedule PDF:', err);
      let msg = 'The schedule is not accessible or has not been published to Team Managers yet.';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          msg = json.detail || json.error || text || msg;
        } catch (_) {}
      } else if (err?.response?.data?.error) {
        msg = err.response.data.error;
      }

      const isUnpublished =
        err?.response?.status === 403 ||
        msg.toLowerCase().includes('not been published') ||
        msg.toLowerCase().includes('not published');

      if (isUnpublished) {
        setEvent((prev) => (prev ? { ...prev, is_schedule_published: false } : prev));
        setPdfUrl((prevUrl) => {
          if (prevUrl) URL.revokeObjectURL(prevUrl);
          return null;
        });
        setPdfError('');
        return;
      }

      setPdfError(msg);
    } finally {
      setLoadingPdf(false);
    }
  };

  const handleLayoutChange = (newLayout) => {
    setScheduleLayout(newLayout);
    loadSchedulePdf(newLayout);
  };

  const refreshScheduleState = async (layout = scheduleLayout) => {
    setLoadingPdf(true);
    setPdfError('');
    try {
      const eventRes = await eventsAPI.getEvent(eventId);
      const latestEvent = eventRes.data;
      if (latestEvent && typeof latestEvent.status !== 'string') {
        latestEvent.status = 'published';
      }
      setEvent(latestEvent);
      if (latestEvent?.is_schedule_published) {
        const response = await eventScheduleAPI.export(eventId, 'pdf', layout);
        const blob = new Blob([response.data], { type: 'application/pdf' });
        setPdfUrl((prevUrl) => {
          if (prevUrl) URL.revokeObjectURL(prevUrl);
          return URL.createObjectURL(blob);
        });
      } else {
        setPdfUrl((prevUrl) => {
          if (prevUrl) URL.revokeObjectURL(prevUrl);
          return null;
        });
      }
    } catch (err) {
      console.error('Error refreshing schedule state:', err);
      let msg = 'Unable to refresh schedule.';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          msg = json.detail || json.error || text || msg;
        } catch (_) {}
      } else if (err?.response?.data?.error) {
        msg = err.response.data.error;
      }
      if (
        err?.response?.status === 403 ||
        msg.toLowerCase().includes('not published') ||
        msg.toLowerCase().includes('not been published')
      ) {
        setEvent((prev) => (prev ? { ...prev, is_schedule_published: false } : prev));
        setPdfUrl((prevUrl) => {
          if (prevUrl) URL.revokeObjectURL(prevUrl);
          return null;
        });
        setPdfError('');
        return;
      }
      setPdfError(msg);
    } finally {
      setLoadingPdf(false);
    }
  };

  const downloadSchedulePdf = async (layout = scheduleLayout) => {
    setDownloadingPdf(true);
    setShowDownloadOptions(false);
    try {
      const response = await eventScheduleAPI.export(eventId, 'pdf', layout);
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const suffix = layout === 'time' ? '-timewise' : '-stagewise';
      link.download = `${event?.title || 'event'}-official-schedule${suffix}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download schedule failed:', err);
      let msg = 'Unable to download schedule PDF. Please check if the schedule is published.';
      if (err?.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          msg = json.detail || json.error || text || msg;
        } catch (_) {}
      } else if (err?.response?.data?.error) {
        msg = err.response.data.error;
      }
      alert(msg);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Section Tabs (Harmonized with Admin EventDashboard)
  const tabs = [
    {
      id: 'dashboard',
      name: 'Overview',
      icon: LayoutDashboard,
      description: 'Event overview and key team metrics',
    },
    {
      id: 'programs',
      name: 'Programs',
      icon: BookOpen,
      description: 'View all event programs, stages, and competition guidelines',
    },
    {
      id: 'assignments',
      name: 'Assignments',
      icon: Users,
      description: 'Manage student entries, leaders, and team quotas',
    },
    {
      id: 'participants',
      name: 'Participants',
      icon: UserCheck,
      description: 'View your team participants, chest numbers, and digital passes',
    },
    {
      id: 'schedule',
      name: 'Schedule',
      icon: CalendarClock,
      badge: event?.is_schedule_published ? 'Live' : 'Draft',
      badgeColor: event?.is_schedule_published
        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
        : 'bg-amber-50 text-amber-700 border border-amber-200',
      description: 'Official stage schedules and downloadable PDF documentation',
    },
    {
      id: 'documents',
      name: 'Call List',
      icon: FileText,
      badge: 'Roster',
      badgeColor: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
      description: 'Official team call lists, verified chest numbers & assignments',
    },
    {
      id: 'results',
      name: 'Results',
      icon: Trophy,
      description: 'Live published rankings, awardees, and team leaderboards',
    },
  ];

  const getStatusBadge = (status) => {
    switch (status?.toLowerCase()) {
      case 'published':
      case 'active':
        return 'bg-emerald-50 text-emerald-700 border-emerald-200';
      case 'ongoing':
        return 'bg-indigo-50 text-indigo-700 border-indigo-200';
      case 'completed':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'draft':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200';
    }
  };

  const teamName = teamData?.name || teamData?.team_name || teamData?.team?.name;

  // Render Component for Active Tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <TeamEventOverview
            event={event}
            eventId={eventId}
            teamData={teamData}
            categories={categories}
            setActiveTab={setActiveTab}
            onRefresh={fetchInitialData}
          />
        );

      case 'programs':
        return (
          <EventPrograms
            event={event}
            eventId={eventId}
            categories={categories}
            readOnly={true}
          />
        );

      case 'assignments':
        return (
          <TeamEventDetail
            eventId={eventId}
            embedded={true}
          />
        );

      case 'participants':
        return (
          <EventParticipants
            eventId={eventId}
            categories={categories}
            teamId={teamData?.id || teamData?.team_id}
            teamName={teamName}
            isTeamManager={true}
          />
        );

      case 'schedule':
        return (
          <div className="p-4 sm:p-6 space-y-5 bg-[#f7f8fb] min-h-[620px]">
            {/* Schedule Section Top Header Card */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
                    Official Itinerary
                  </span>
                  <span className="text-slate-300">·</span>
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                      event?.is_schedule_published
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}
                  >
                    {event?.is_schedule_published ? 'Schedule Published' : 'Under Finalization'}
                  </span>
                </div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight mt-0.5">
                  Program Schedule & Timetable
                </h1>
                <p className="text-xs text-gray-500 mt-0.5">
                  Finalized timetable, stage assignments, and venue schedules for {event?.title}.
                </p>
              </div>

              {event?.is_schedule_published && (
                <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                  {/* Layout toggle switcher */}
                  <div className="inline-flex items-center rounded-xl border border-slate-200 bg-slate-100 p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={() => handleLayoutChange('stage')}
                      disabled={loadingPdf}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        scheduleLayout === 'stage'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Grouped by Stage and Venue"
                    >
                      <Layers className="h-3.5 w-3.5" />
                      <span>Stage-wise</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLayoutChange('time')}
                      disabled={loadingPdf}
                      className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all cursor-pointer ${
                        scheduleLayout === 'time'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                      title="Chronological Time order with Stage column"
                    >
                      <Clock className="h-3.5 w-3.5" />
                      <span>Time-wise</span>
                    </button>
                  </div>

                  <button
                    onClick={() => refreshScheduleState(scheduleLayout)}
                    disabled={loadingPdf}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingPdf ? 'animate-spin text-indigo-600' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>

                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Open in Tab</span>
                    </a>
                  )}

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowDownloadOptions(!showDownloadOptions)}
                      disabled={downloadingPdf}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-colors shadow-2xs cursor-pointer disabled:opacity-50"
                    >
                      <Download className="h-3.5 w-3.5" />
                      <span>{downloadingPdf ? 'Downloading...' : 'Download (PDF)'}</span>
                      <ChevronDown className={`h-3 w-3 transition-transform ${showDownloadOptions ? 'rotate-180' : ''}`} />
                    </button>

                    {showDownloadOptions && (
                      <>
                        <div
                          className="fixed inset-0 z-20"
                          onClick={() => setShowDownloadOptions(false)}
                        />
                        <div className="absolute right-0 mt-2 w-72 rounded-xl bg-white p-2 shadow-xl ring-1 ring-slate-900/10 z-30 animate-in fade-in slide-in-from-top-1">
                          <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            Select PDF Layout
                          </div>

                          <button
                            type="button"
                            onClick={() => downloadSchedulePdf('stage')}
                            className="w-full flex items-start gap-3 rounded-lg p-2.5 text-left hover:bg-indigo-50/70 transition-colors group cursor-pointer"
                          >
                            <div className="mt-0.5 rounded-lg bg-indigo-100 p-1.5 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                              <Layers className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-900 flex items-center gap-1.5">
                                <span>Stage-wise Schedule</span>
                                <span className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded">Default</span>
                              </div>
                              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                                Programs grouped under each stage/venue with timings.
                              </p>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => downloadSchedulePdf('time')}
                            className="w-full flex items-start gap-3 rounded-lg p-2.5 text-left hover:bg-emerald-50/70 transition-colors group cursor-pointer mt-1"
                          >
                            <div className="mt-0.5 rounded-lg bg-emerald-100 p-1.5 text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                              <Clock className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-800 group-hover:text-emerald-900">
                                Time-wise Schedule
                              </div>
                              <p className="text-[11px] text-slate-500 leading-tight mt-0.5">
                                Date first, then chronologically by time with Stage column.
                              </p>
                            </div>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Schedule Body */}
            <div>
              {!event?.is_schedule_published ? (
                /* Unpublished Notice */
                <div className="bg-white rounded-xl border border-slate-200/80 p-8 text-center max-w-2xl mx-auto my-6 shadow-2xs">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-amber-700 mb-3 border border-amber-100 shadow-2xs">
                    <Clock className="h-6 w-6 text-amber-600" />
                  </div>
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold uppercase tracking-wider mb-2">
                    <Lock className="h-3 w-3" /> Under Finalization
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-1">
                    Official Schedule Has Not Been Published Yet
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-md mx-auto">
                    The Event Managers and coordinators are organizing stage allocations and program timings. Once finalized and published, the official timetable and PDF will appear here.
                  </p>
                  <div className="mt-5 pt-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-center gap-3 text-xs text-slate-500">
                    <button
                      type="button"
                      onClick={refreshScheduleState}
                      disabled={loadingPdf}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 cursor-pointer shadow-2xs transition-colors"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${loadingPdf ? 'animate-spin text-indigo-600' : ''}`} />
                      <span>Check Publication Status</span>
                    </button>
                  </div>
                </div>
              ) : pdfError ? (
                <div className="bg-white rounded-xl border border-rose-200 p-6 text-center max-w-lg mx-auto my-6 shadow-2xs">
                  <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-rose-800">{pdfError}</p>
                  <button
                    onClick={refreshScheduleState}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-2xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                </div>
              ) : loadingPdf ? (
                <div className="bg-white rounded-xl border border-slate-200/80 flex flex-col items-center justify-center min-h-[460px] space-y-3 shadow-2xs">
                  <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-600" />
                  <p className="text-xs font-semibold text-slate-600">
                    Generating live official schedule PDF...
                  </p>
                </div>
              ) : pdfUrl ? (
                <div className="w-full rounded-xl border border-slate-200/80 overflow-hidden shadow-2xs bg-slate-900/5">
                  <iframe
                    src={`${pdfUrl}#toolbar=1&navpanes=0`}
                    title="Official Event Schedule"
                    className="h-[560px] sm:h-[750px] w-full border-0"
                  />
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-slate-200/80 text-center py-12 shadow-2xs">
                  <button
                    onClick={loadSchedulePdf}
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-indigo-700"
                  >
                    View Official Schedule PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        );

      case 'documents':
        return (
          <TeamDocuments
            eventId={eventId}
            event={event}
            teamData={teamData}
            categories={categories}
          />
        );

      case 'results':
        return (
          <EventResults
            categories={categories}
            readOnly={true}
            eventId={eventId}
          />
        );

      default:
        return (
          <TeamEventOverview
            event={event}
            eventId={eventId}
            teamData={teamData}
            categories={categories}
            setActiveTab={setActiveTab}
            onRefresh={fetchInitialData}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#f7f8fb]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-3 text-xs font-semibold text-slate-500">Loading Team Event Portal...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex justify-center items-center h-screen bg-[#f7f8fb] px-4">
        <div className="text-center max-w-md bg-white p-6 sm:p-8 rounded-xl border border-slate-200/80 shadow-2xs">
          <div className="w-11 h-11 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <AlertCircle className="w-5 h-5" />
          </div>
          <h2 className="text-lg font-bold text-slate-900 mb-1">Access Restricted</h2>
          <p className="text-xs text-slate-500 mb-4">{error || 'Event could not be found or you do not have permission to view it.'}</p>
          <button
            onClick={() => navigate('/team-manager/events')}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Events List
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex flex-col font-sans">
      {/* ========================================================================= */}
      {/* Event Header (Exact Admin Event Portal Model) */}
      {/* ========================================================================= */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-3.5 gap-4">
            {/* Top Left: Back Button, School/Event Logo, Event Title & Metadata */}
            <div className="flex items-center min-w-0">
              <button
                onClick={() => navigate('/team-manager/events')}
                className="mr-2 sm:mr-3 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200/70 shrink-0 cursor-pointer"
                title="Back to Events"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              {(event.logo || event.event_logo) ? (
                <img
                  src={event.logo || event.event_logo}
                  alt={event.title || 'Event Logo'}
                  className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl object-contain bg-slate-50 border border-slate-200/80 p-0.5 shrink-0 mr-2.5 sm:mr-3 shadow-2xs"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextSibling) {
                      e.currentTarget.nextSibling.style.display = 'flex';
                    }
                  }}
                />
              ) : null}
              <div
                className={`w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-indigo-50 border border-indigo-200/70 items-center justify-center text-indigo-600 shrink-0 mr-2.5 sm:mr-3 shadow-2xs ${
                  (event.logo || event.event_logo) ? 'hidden' : 'flex'
                }`}
              >
                <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <h1 className="text-base sm:text-xl md:text-2xl font-bold tracking-tight text-slate-900 truncate">
                  {event.title}
                </h1>
                <p className="hidden sm:block text-xs text-slate-400 mt-0.5 font-normal truncate">
                  {event.start_date
                    ? new Date(event.start_date).toLocaleDateString()
                    : 'Date TBA'} · {event.venue || 'Campus Venue'}
                </p>
              </div>
            </div>

            {/* Right Side: Eventloo Logo (Hidden on mobile screen) */}
            <div className="hidden sm:flex items-center shrink-0">
              <a
                href="/"
                title="Eventloo"
                className="flex items-center hover:opacity-90 transition-opacity pl-0.5 shrink-0"
              >
                <img
                  src="/eventloo-loop-logo.svg"
                  alt="Eventloo"
                  className="h-5 sm:h-7 w-auto object-contain"
                />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Main Layout Container */}
      {/* ========================================================================= */}
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 w-full flex-1">
        {/* Mobile Horizontal Tabs Navigation */}
        <div className="lg:hidden mb-4 bg-white rounded-xl border border-slate-200/80 p-1.5 shadow-2xs">
          <div className="flex items-center overflow-x-auto space-x-1.5 no-scrollbar scroll-smooth py-0.5 px-0.5">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          {/* Desktop Sidebar Navigation (Exact Admin Model) */}
          <div className="sticky top-20 hidden max-h-[calc(100vh-5.5rem)] w-60 shrink-0 self-start overflow-y-auto lg:block space-y-3">
            {/* Small Minimal Dashboard Pulse on top of Event Navigation */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs">
              <div className="flex items-center justify-between mb-2 px-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                  Team Overview
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Live
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <button
                  onClick={() => setActiveTab('programs')}
                  className="bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg p-2 border border-slate-200/60 cursor-pointer text-left"
                >
                  <span className="text-base font-bold text-slate-900 block leading-tight">
                    {teamStats.programsCount || event.programs?.length || event.programs_count || 0}
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal block">Programs</span>
                </button>
                <button
                  onClick={() => setActiveTab('participants')}
                  className="bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg p-2 border border-slate-200/60 cursor-pointer text-left"
                >
                  <span className="text-base font-bold text-slate-900 block leading-tight">
                    {teamStats.participantsCount || 0}
                  </span>
                  <span className="text-[10px] text-slate-500 font-normal block">Registered</span>
                </button>
              </div>
              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] px-1 text-slate-500">
                <span>
                  Assigned: <strong className="text-slate-800">{teamStats.assignedProgramsCount || 0}</strong>
                </span>
                <span>
                  Schedule:{' '}
                  <strong
                    className={
                      event.is_schedule_published ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'
                    }
                  >
                    {event.is_schedule_published ? 'Live' : 'Draft'}
                  </strong>
                </span>
              </div>
            </div>

            {/* Event Sections Navigation */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-2">
                Event Sections
              </h3>
              <nav className="space-y-0.5">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center min-w-0">
                        <Icon
                          className={`h-4 w-4 mr-2.5 flex-shrink-0 transition-colors ${
                            isActive ? 'text-indigo-600' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{tab.name}</span>
                      </div>
                      {tab.badge && (
                        <span
                          className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold shrink-0 ${
                            isActive
                              ? 'bg-indigo-100 text-indigo-700'
                              : tab.badgeColor || 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {tab.badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamEventDashboard;
