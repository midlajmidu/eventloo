import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI } from '../../services/api';
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
import {
  BookOpen,
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
} from 'lucide-react';

const EventDashboard = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('programs');
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState([]);

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
    { id: 'programs', name: 'Programs', icon: BookOpen, description: 'Manage event programs' },
    { id: 'stages', name: 'Stages', icon: MapPinned, description: 'Manage stages and locations' },
    { id: 'schedule', name: 'Schedule', icon: CalendarClock, description: 'Schedule programs by stage and time' },
    { id: 'assignments', name: 'Assignments', icon: Users, description: 'Assign students to programs' },
    { id: 'participants', name: 'Participants', icon: UserCheck, description: 'View assigned participants with chest numbers' },
    { id: 'mark-entry', name: 'Mark Entry', icon: Edit3, description: 'Enter marks and scores' },
    { id: 'results', name: 'Results', icon: Trophy, description: 'View results and rankings' },
    { id: 'top-scorers', name: 'Top Scorers', icon: Medal, description: 'View event top performers and points' },
    { id: 'documents', name: 'Documents', icon: FileText, description: 'Generate calling sheets & valuation forms' },
    { id: 'points', name: 'Points', icon: Award, description: 'Team points overview' },
    { id: 'certificates', name: 'Templates', icon: Sparkles, description: 'Design certificate templates' },
    { id: 'settings', name: 'Settings', icon: Settings, description: 'Event judge & mark configuration' },
  ];

  const renderActiveComponent = () => {
    console.log('EventDashboard eventId:', eventId, 'Type:', typeof eventId);
    const props = { event, eventId, onRefresh: fetchEvent, categories };

    switch (activeTab) {
      case 'programs':
        return <EventPrograms {...props} />;
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
        return <EventPrograms {...props} />;
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

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex flex-col">
      {/* Event Header (No TopNavbar with quick add / search / notifications) */}
      <div className="bg-white border-b border-slate-200/80 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-3 sm:py-3.5">
            <div className="flex items-center">
              <button
                onClick={handleBack}
                className="mr-3 p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors border border-slate-200/70"
                title="Back to Events"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Event Portal</p>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">{event.title}</h1>
                <p className="text-xs text-slate-400 mt-0.5 font-normal">
                  {new Date(event.start_date).toLocaleDateString()} · {event.venue || 'Campus Venue'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
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
            </div>
          </div>
        </div>
      </div>

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
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${isActive
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
          {/* Desktop Sidebar Navigation */}
          <div className="sticky top-6 hidden max-h-[calc(100vh-5rem)] w-60 shrink-0 self-start overflow-y-auto lg:block">
            <div className="bg-white rounded-xl border border-slate-200/80 p-3 shadow-2xs">
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-2">Event Navigation</h3>
              <nav className="space-y-0.5">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-3 py-2 rounded-lg text-xs font-medium transition-colors ${isActive
                          ? 'bg-indigo-50 text-indigo-700 font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                      <Icon className={`h-4 w-4 mr-2.5 flex-shrink-0 transition-colors ${isActive ? 'text-indigo-600' : 'text-slate-400'
                        }`} />
                      <span>{tab.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl border border-slate-200/80 p-3 mt-4 shadow-2xs">
              <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 px-1">Quick Overview</h4>
              <div className="space-y-2 px-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Participants</span>
                  <span className="font-bold text-slate-900">{event.current_participants || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Teams</span>
                  <span className="font-bold text-slate-900">{event.current_teams || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">Max Capacity</span>
                  <span className="font-bold text-slate-900">{event.max_participants || 'Unlimited'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
              {renderActiveComponent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDashboard; 
