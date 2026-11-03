import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
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
  UserCheck
} from 'lucide-react';
import { eventsAPI, teamManagerAPI, categoriesAPI, eventScheduleAPI } from '../../services/api';
import EventPrograms from '../Event/EventPrograms';
import EventParticipants from '../Event/EventParticipants';
import EventResults from '../Event/EventResults';
import TeamEventDetail from './TeamEventDetail';

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
  const [activeTab, setActiveTab] = useState('programs');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Schedule PDF preview state
  const [pdfUrl, setPdfUrl] = useState(null);
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [pdfError, setPdfError] = useState('');

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

      let resolvedTeam = storedTeam;
      if (teamId) {
        try {
          const profileRes = await teamManagerAPI.getTeamProfile(teamId);
          if (profileRes.data) {
            resolvedTeam = { ...storedTeam, ...profileRes.data };
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
    } catch (err) {
      console.error('Error loading team event dashboard:', err);
      setError('Unable to load event details. Please verify your team permissions.');
    } finally {
      setLoading(false);
    }
  };

  const loadSchedulePdf = async () => {
    setLoadingPdf(true);
    setPdfError('');
    try {
      const response = await eventScheduleAPI.export(eventId, 'pdf');
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
      setPdfError(msg);
    } finally {
      setLoadingPdf(false);
    }
  };

  const downloadSchedulePdf = async () => {
    setDownloadingPdf(true);
    try {
      const response = await eventScheduleAPI.export(eventId, 'pdf');
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${event?.title || 'event'}-official-schedule.pdf`;
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

  const tabs = [
    {
      id: 'programs',
      name: 'Programs',
      icon: BookOpen,
      badge: null,
      description: 'View all event programs, stages, and competition guidelines',
    },
    {
      id: 'participants',
      name: 'Participants',
      icon: UserCheck,
      badge: null,
      description: 'View your team participants, chest numbers, and digital passes',
    },
    {
      id: 'schedule',
      name: 'Schedule (PDF)',
      icon: CalendarClock,
      badge: event?.is_schedule_published ? 'Published' : 'Draft',
      badgeColor: event?.is_schedule_published ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800',
      description: 'Official stage schedules and downloadable PDF documentation',
    },
    {
      id: 'assignments',
      name: 'Assignments',
      icon: Users,
      badge: null,
      description: 'Manage student entries, leaders, and team quotas',
    },
    {
      id: 'results',
      name: 'Results & Standings',
      icon: Trophy,
      badge: null,
      description: 'Live published rankings, awardees, and team leaderboards',
    },
    {
      id: 'documents',
      name: 'Documents',
      icon: FileText,
      badge: null,
      description: 'Official certificates, forms, and event files',
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

  // Render Component for Active Tab
  const renderTabContent = () => {
    switch (activeTab) {
      case 'programs':
        return (
          <EventPrograms
            event={event}
            eventId={eventId}
            categories={categories}
            readOnly={true}
          />
        );

      case 'participants':
        return (
          <div className="min-h-[560px] p-4 sm:p-6 bg-white">
            <EventParticipants
              eventId={eventId}
              categories={categories}
              teamId={teamData?.id || teamData?.team_id}
              teamName={teamData?.name || teamData?.team_name}
              isTeamManager={true}
            />
          </div>
        );

      case 'schedule':
        return (
          <div className="min-h-[560px] p-4 sm:p-6 bg-white">
            {/* Schedule Section Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-5 border-b border-slate-200">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-indigo-600">
                  Official Event Itinerary
                </p>
                <h2 className="text-xl font-bold text-slate-900 mt-0.5">Program Schedule</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Finalized timetable, stage assignments, and venue schedules.
                </p>
              </div>

              {event?.is_schedule_published && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 shadow-2xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <span>Official Schedule Published</span>
                  </span>

                  <button
                    onClick={loadSchedulePdf}
                    disabled={loadingPdf}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${loadingPdf ? 'animate-spin text-indigo-600' : ''}`} />
                    <span>Refresh</span>
                  </button>

                  {pdfUrl && (
                    <a
                      href={pdfUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Open in Tab</span>
                    </a>
                  )}

                  <button
                    onClick={downloadSchedulePdf}
                    disabled={downloadingPdf}
                    className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    <Download className="h-4 w-4" />
                    <span>{downloadingPdf ? 'Downloading...' : 'Download Schedule (PDF)'}</span>
                  </button>
                </div>
              )}
            </div>

            {/* Schedule Body */}
            <div className="mt-6">
              {!event?.is_schedule_published ? (
                /* Unconfirmed / Unpublished Notice */
                <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-amber-50/70 via-white to-amber-50/30 p-8 text-center max-w-2xl mx-auto my-8 shadow-xs">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 mb-4 shadow-2xs">
                    <Clock className="h-7 w-7 text-amber-600" />
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-bold uppercase tracking-wider mb-2">
                    <Lock className="h-3 w-3" /> Under Finalization
                  </span>
                  <h3 className="text-lg font-bold text-slate-900 mt-2">
                    Official Schedule Has Not Been Published Yet
                  </h3>
                  <p className="text-xs text-slate-600 mt-2.5 leading-relaxed max-w-lg mx-auto">
                    The Event Managers and organizers are currently organizing program timings and stage allocations.
                    Once confirmed and published by the Event Manager, the full schedule and official printable PDF will appear here for you to view and download.
                  </p>
                  <div className="mt-6 pt-5 border-t border-amber-200/60 flex items-center justify-center gap-2 text-xs text-slate-500">
                    <CalendarClock className="h-4 w-4 text-slate-400" />
                    <span>Please check back later or contact your event coordinator.</span>
                  </div>
                </div>
              ) : pdfError ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-center max-w-lg mx-auto my-6">
                  <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-rose-800">{pdfError}</p>
                  <button
                    onClick={loadSchedulePdf}
                    className="mt-3 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-2xs"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> Retry
                  </button>
                </div>
              ) : loadingPdf ? (
                <div className="flex flex-col items-center justify-center min-h-[460px] space-y-3">
                  <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-600" />
                  <p className="text-xs font-semibold text-slate-600">
                    Generating live official schedule PDF...
                  </p>
                </div>
              ) : pdfUrl ? (
                <div className="w-full rounded-2xl border border-slate-200 overflow-hidden shadow-2xs bg-slate-900/5">
                  <iframe
                    src={`${pdfUrl}#toolbar=1&navpanes=0`}
                    title="Official Event Schedule"
                    className="h-[750px] w-full border-0"
                  />
                </div>
              ) : (
                <div className="text-center py-12">
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

      case 'assignments':
        return (
          <TeamEventDetail
            eventId={eventId}
            embedded={true}
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

      case 'documents':
        return (
          <div className="p-8 sm:p-12 text-center bg-white min-h-[480px] flex flex-col items-center justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600 shadow-2xs mb-4">
              <FileText className="h-8 w-8 text-indigo-500" />
            </div>
            <h3 className="text-lg font-bold text-slate-900">Event Documents</h3>
            <p className="text-xs text-slate-500 max-w-md mt-1.5 leading-relaxed">
              Official certificates, guidelines, evaluation forms, and circular documents will be made available here once released by the event organizers.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50/70 px-4 py-2.5 text-xs font-medium text-slate-500">
              <Layers className="h-4 w-4 text-slate-400" />
              <span>No documents uploaded for this event currently</span>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fb]">
        <div className="text-center">
          <div className="h-10 w-10 animate-spin rounded-full border-3 border-slate-200 border-t-indigo-600 mx-auto" />
          <p className="mt-3 text-xs font-semibold text-slate-600">Loading Team Event Portal...</p>
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-6">
        <div className="max-w-md text-center bg-white p-8 rounded-2xl border border-slate-200 shadow-lg">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600 mb-4">
            <AlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-base font-bold text-slate-900">Access Restricted</h2>
          <p className="text-xs text-slate-500 mt-2">{error || 'Event could not be found.'}</p>
          <button
            onClick={() => navigate('/team-manager/events')}
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Events</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex flex-col font-sans">
      {/* ========================================================================= */}
      {/* TOP NAVIGATION BAR (Dedicated Event Portal Window Header) */}
      {/* ========================================================================= */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200/90 shadow-2xs backdrop-blur-md bg-white/95">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            {/* Left: Back button + School Logo + Event Title & Metadata */}
            <div className="flex items-center gap-3 min-w-0">
              <button
                onClick={() => navigate('/team-manager/events')}
                className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors shrink-0 border border-slate-200 shadow-2xs cursor-pointer"
                title="Back to Events List"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>

              {event.school_logo && (
                <img
                  src={event.school_logo}
                  alt={event.school_name || 'School Logo'}
                  className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl object-contain bg-slate-50 border border-slate-200/80 p-0.5 shrink-0 shadow-2xs"
                />
              )}

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-indigo-600 truncate">
                    {event.school_name || 'Team Event Portal'}
                  </span>
                  <span className="text-slate-300">·</span>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${getStatusBadge(
                      event.status
                    )}`}
                  >
                    {event.status || 'Active'}
                  </span>
                </div>
                <h1 className="text-base sm:text-lg font-bold text-slate-900 truncate tracking-tight mt-0.5">
                  {event.title}
                </h1>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 mt-0.5">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    {event.start_date
                      ? new Date(event.start_date).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      : 'Date TBA'}
                  </span>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400" />
                    {event.venue || 'Campus Main Stage'}
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Team Name Badge & Schedule Status Badge & Eventloo Logo */}
            <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto shrink-0">
              {teamData?.name && (
                <div className="inline-flex items-center gap-2 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3.5 py-1.5 text-xs font-bold text-indigo-900 shadow-2xs">
                  <Users className="h-3.5 w-3.5 text-indigo-600" />
                  <span>{teamData.name}</span>
                </div>
              )}
              {event.is_schedule_published ? (
                <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-800 shadow-2xs">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  <span>Schedule Confirmed</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] font-semibold text-amber-800 shadow-2xs">
                  <Clock className="h-3 w-3 text-amber-600" />
                  <span>Schedule Draft</span>
                </span>
              )}

              <div className="h-5 w-px bg-slate-200 hidden sm:block" />

              <a
                href="/"
                title="Eventloo"
                className="hidden sm:flex items-center hover:opacity-90 transition-opacity pl-0.5 shrink-0"
              >
                <img
                  src="/eventloo-loop-logo.svg"
                  alt="Eventloo"
                  className="h-5 sm:h-6 w-auto object-contain"
                />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* MAIN LAYOUT (Sticky Sidebar on Desktop, Horizontal Tabs on Mobile) */}
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
          {/* Desktop Sticky Sidebar Navigation */}
          <div className="sticky top-20 hidden max-h-[calc(100vh-6rem)] w-64 shrink-0 self-start overflow-y-auto lg:block">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 shadow-2xs">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2.5 px-2">
                Event Sections
              </h3>
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                        isActive
                          ? 'bg-indigo-600 text-white shadow-xs'
                          : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={`h-4 w-4 shrink-0 transition-colors ${
                            isActive ? 'text-white' : 'text-slate-400'
                          }`}
                        />
                        <span className="truncate">{tab.name}</span>
                      </div>
                      {tab.badge && (
                        <span
                          className={`ml-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                            isActive ? 'bg-white/20 text-white' : tab.badgeColor
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

            {/* Quick Overview Card */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-4 mt-4 shadow-2xs">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">
                Team Event Summary
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Your Team</span>
                  <span className="font-bold text-slate-900 truncate max-w-[120px]">
                    {teamData?.name || 'Assigned Team'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Event Status</span>
                  <span className="font-bold capitalize text-slate-900">{event.status || 'Active'}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-medium">Schedule</span>
                  <span
                    className={`font-bold ${
                      event.is_schedule_published ? 'text-emerald-600' : 'text-amber-600'
                    }`}
                  >
                    {event.is_schedule_published ? 'Published' : 'Under Finalization'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamEventDashboard;
