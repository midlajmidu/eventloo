import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI } from '../../services/api';
import EventOverview from './EventOverview';
import EventPrograms from './EventPrograms';
import EventAssignments from './EventAssignments';
import EventParticipants from './EventParticipants';
import EventMarkEntry from './EventMarkEntry';
import EventResults from './EventResults';
import EventDocuments from './EventDocuments';
import EventPoints from './EventPoints';
import EventCertificates from './EventCertificates';
import EventSettings from './EventSettings';
import EventTopScorers from './EventTopScorers';
import EventStages from './EventStages';
import EventSchedule from './EventSchedule';
import EventProgramTypes from './EventProgramTypes';
import {
  LayoutDashboard,
  BookOpen,
  Tags,
  Users,
  UserCheck,
  Edit3,
  Trophy,
  FileText,
  Award,
  Sparkles,
  Settings,
  Medal,
  MapPinned,
  CalendarClock,
  ArrowLeft,
  Calendar,
  ExternalLink,
} from 'lucide-react';

const EventDashboard = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const getInitialTab = () => {
    try {
      const tab = new URLSearchParams(window.location.search).get('tab');
      return tab || 'dashboard';
    } catch (_) {
      return 'dashboard';
    }
  };
  const [event, setEvent] = useState(null);
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

  // Sync activeTab when user navigates using browser Back/Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      const tab = new URLSearchParams(window.location.search).get('tab');
      setActiveTab(tab || 'dashboard');
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Set document title dynamically
  useEffect(() => {
    if (event?.title) {
      if (activeTab === 'certificates') {
        document.title = `Templates Designer - ${event.title} | Eventloo`;
      } else {
        document.title = `${event.title} - Dashboard | Eventloo`;
      }
    }
  }, [event?.title, activeTab]);

  useEffect(() => {
    fetchEvent();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  const fetchCategories = async () => {
    try {
      const { categoriesAPI } = await import('../../services/api');
      const res = await categoriesAPI.list();
      setCategories(res.data.results || res.data || []);
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const fetchEvent = async () => {
    try {
      setLoading(true);
      const response = await eventsAPI.getEvent(eventId);
      console.log('Event API response:', response);

      // Extract data from axios response
      const eventData = response.data;
      console.log('Event data:', eventData);

      // Ensure status is a string
      if (eventData && typeof eventData.status !== 'string') {
        console.warn('Event status is not a string:', eventData.status);
        eventData.status = 'draft'; // Default fallback
      }

      setEvent(eventData);
    } catch (error) {
      console.error('Error fetching event:', error);
      navigate('/admin/events');
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'dashboard', name: 'Dashboard', icon: LayoutDashboard, description: 'Event overview and key metrics' },
    { id: 'programs', name: 'Programs', icon: BookOpen, description: 'Manage event programs' },
    { id: 'types', name: 'Types', icon: Tags, description: 'Manage program types (Stage, Off-Stage, etc.)' },
    { id: 'stages', name: 'Stages', icon: MapPinned, description: 'Manage stages and locations' },
    { id: 'schedule', name: 'Schedule', icon: CalendarClock, description: 'Schedule programs by stage and time' },
    { id: 'assignments', name: 'Assignments', icon: Users, description: 'Assign students to programs' },
    { id: 'participants', name: 'Participants', icon: UserCheck, description: 'View assigned participants with chest numbers' },
    { id: 'mark-entry', name: 'Mark Entry', icon: Edit3, description: 'Enter marks and scores' },
    { id: 'results', name: 'Results', icon: Trophy, description: 'View results and rankings' },
    { id: 'top-scorers', name: 'Top Scorers', icon: Medal, description: 'View event top performers and points' },
    { id: 'documents', name: 'Documents', icon: FileText, description: 'Generate calling sheets & valuation forms' },
    { id: 'points', name: 'Points', icon: Award, description: 'Team points overview' },
    { id: 'certificates', name: 'Templates', icon: Sparkles, description: 'Design certificate templates', openInNewTab: true },
    { id: 'settings', name: 'Settings', icon: Settings, description: 'Event judge & mark configuration' },
  ];

  const handleTabSwitch = (tabId) => {
    if (tabId === 'certificates') {
      window.open(`/events/${eventId}/dashboard?tab=certificates`, '_blank', 'noopener,noreferrer');
      return;
    }
    setActiveTab(tabId);
    try {
      const url = new URL(window.location.href);
      if (tabId === 'dashboard') {
        url.searchParams.delete('tab');
      } else {
        url.searchParams.set('tab', tabId);
      }
      window.history.replaceState(window.history.state, '', url.pathname + url.search);
    } catch (_) {}
  };

  const renderActiveComponent = () => {
    console.log('EventDashboard eventId:', eventId, 'Type:', typeof eventId);
    const props = { event, eventId, onRefresh: fetchEvent, categories };

    switch (activeTab) {
      case 'dashboard':
        return <EventOverview {...props} setActiveTab={handleTabSwitch} />;
      case 'programs':
        return <EventPrograms {...props} />;
      case 'types':
        return <EventProgramTypes {...props} />;
      case 'stages':
        return <EventStages {...props} />;
      case 'schedule':
        return <EventSchedule {...props} />;
      case 'assignments':
        return <EventAssignments {...props} />;
      case 'participants':
        return <EventParticipants {...props} />;
      case 'mark-entry':
        return <EventMarkEntry eventId={eventId} categories={categories} event={event} />;
      case 'results':
        return <EventResults {...props} />;
      case 'top-scorers':
        return <EventTopScorers {...props} />;
      case 'documents':
        return <EventDocuments {...props} />;
      case 'points':
        return <EventPoints {...props} />;
      case 'certificates':
        return <EventCertificates {...props} />;
      case 'settings':
        return <EventSettings {...props} />;
      default:
        return <EventOverview {...props} setActiveTab={handleTabSwitch} />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Event Not Found</h2>
          <button
            onClick={() => navigate('/admin/events')}
            className="text-indigo-600 hover:text-indigo-800"
          >
            ← Back to Events
          </button>
        </div>
      </div>
    );
  }

  const handleBack = () => {
    const role = localStorage.getItem('user_role');
    if (role === 'event_manager') {
      navigate('/user/dashboard');
    } else {
      navigate('/admin/events');
    }
  };

  const isTemplatesTab = activeTab === 'certificates';

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex flex-col">
      {/* Event Header */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className={`${isTemplatesTab ? 'w-full px-4 sm:px-6 lg:px-8' : 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'}`}>
          <div className="flex justify-between items-center py-3 sm:py-3.5 gap-4">
            {/* Top Left: Back Button, Event Logo, Event Title */}
            <div className="flex items-center min-w-0 pr-2 sm:pr-4">
              <button
                onClick={handleBack}
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
                  {new Date(event.start_date).toLocaleDateString()} · {event.venue || 'Campus Venue'}
                </p>
              </div>
            </div>

            {/* Right Side: Status badge & Eventloo Logo (Hidden on mobile screen) */}
            <div className="hidden sm:flex items-center space-x-3 shrink-0">
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                event.status === 'published' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                event.status === 'ongoing' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                event.status === 'completed' ? 'bg-slate-100 text-slate-700 border border-slate-200' :
                'bg-amber-50 text-amber-700 border border-amber-200'
              }`}>
                {event.status && typeof event.status === 'string'
                  ? event.status.charAt(0).toUpperCase() + event.status.slice(1)
                  : 'Draft'
                }
              </span>

              <div className="h-5 w-px bg-slate-200" />

              <a
                href="/"
                title="Eventloo"
                className="flex items-center hover:opacity-90 transition-opacity shrink-0"
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

      <div className={`${isTemplatesTab ? 'w-full px-4 sm:px-6 lg:px-8' : 'max-w-7xl mx-auto px-3 sm:px-6 lg:px-8'} py-4 sm:py-6 w-full flex-1`}>
        {!isTemplatesTab && (
          /* Mobile Horizontal Tabs Navigation */
          <div className="lg:hidden mb-4 bg-white rounded-xl border border-slate-200/80 p-1.5 shadow-2xs">
            <div className="flex items-center overflow-x-auto space-x-1.5 no-scrollbar scroll-smooth py-0.5 px-0.5">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                const isExternal = tab.id === 'certificates';
                return (
                  <button
                    type="button"
                    key={tab.id}
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabSwitch(tab.id);
                    }}
                    title={isExternal ? `${tab.name} (Opens in new browser tab)` : tab.name}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${isActive
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                  >
                    <Icon className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{tab.name}</span>
                    {isExternal && (
                      <ExternalLink className={`h-3 w-3 shrink-0 ml-0.5 ${isActive ? 'text-white/80' : 'text-slate-400'}`} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className={isTemplatesTab ? 'w-full' : 'flex flex-col lg:flex-row gap-5'}>
          {!isTemplatesTab && (
            /* Desktop Sidebar Navigation */
            <div className="sticky top-6 hidden max-h-[calc(100vh-5rem)] w-60 shrink-0 self-start overflow-y-auto lg:block space-y-3">
              {/* Small Minimal Dashboard Pulse on top of Event Navigation */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs">
                <div className="flex items-center justify-between mb-2 px-1">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Event Overview</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Live
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabSwitch('programs');
                    }}
                    className="bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg p-2 border border-slate-200/60 cursor-pointer text-left"
                  >
                    <span className="text-base font-bold text-slate-900 block leading-tight">
                      {event.programs?.length || event.programs_count || 0}
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal block">Programs</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      handleTabSwitch('participants');
                    }}
                    className="bg-slate-50 hover:bg-slate-100 transition-colors rounded-lg p-2 border border-slate-200/60 cursor-pointer text-left"
                  >
                    <span className="text-base font-bold text-slate-900 block leading-tight">
                      {event.current_participants || 0}
                    </span>
                    <span className="text-[10px] text-slate-500 font-normal block">Registered</span>
                  </button>
                </div>
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] px-1 text-slate-500">
                  <span>Teams: <strong className="text-slate-800">{event.current_teams || 0}</strong></span>
                  <span>Cap: <strong className="text-slate-800">{event.max_participants || 'Unlimited'}</strong></span>
                </div>
              </div>

              {/* Event Navigation */}
              <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs">
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-2">Event Navigation</h3>
                <nav className="space-y-0.5">
                  {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    const isExternal = tab.id === 'certificates';
                    return (
                      <button
                        type="button"
                        key={tab.id}
                        onClick={(e) => {
                          e.preventDefault();
                          handleTabSwitch(tab.id);
                        }}
                        title={isExternal ? `${tab.name} (Opens in new browser tab)` : tab.name}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer ${isActive
                            ? 'bg-indigo-50 text-indigo-700 font-semibold'
                            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                          }`}
                      >
                        <div className="flex items-center min-w-0">
                          <Icon className={`h-4 w-4 mr-2.5 flex-shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'
                            }`} />
                          <span className="truncate">{tab.name}</span>
                        </div>
                        {isExternal && (
                          <ExternalLink className={`h-3.5 w-3.5 shrink-0 ml-1.5 transition-colors ${isActive ? 'text-indigo-500' : 'text-slate-400'}`} />
                        )}
                      </button>
                    );
                  })}
                </nav>
              </div>
            </div>
          )}

          {/* Main Content */}
          <div className="flex-1 min-w-0 w-full">
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden min-h-[640px]">
              {renderActiveComponent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDashboard; 
