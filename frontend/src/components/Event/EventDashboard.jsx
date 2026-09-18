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
    { id: 'certificates', name: 'Certificates', icon: Sparkles, description: 'Generate certificates' },
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <button
                onClick={() => navigate('/admin/events')}
                className="mr-4 p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">{event.title}</h1>
                <p className="text-sm text-gray-500 mt-1">
                  {new Date(event.start_date).toLocaleDateString()} - {event.venue}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                event.status === 'published' ? 'bg-green-100 text-green-800' :
                event.status === 'ongoing' ? 'bg-indigo-100 text-indigo-800' :
                event.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                'bg-yellow-100 text-yellow-800'
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

      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Mobile Horizontal Tabs Navigation */}
        <div className="lg:hidden mb-4 bg-white rounded-xl border border-gray-200 p-2 shadow-xs">
          <div className="flex items-center overflow-x-auto space-x-2 no-scrollbar scroll-smooth py-1 px-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors shrink-0 ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 shrink-0 ${isActive ? 'text-white' : 'text-gray-400'}`} />
                  <span>{tab.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Desktop Sidebar Navigation */}
          <div className="sticky top-6 hidden max-h-[calc(100vh-3rem)] w-64 shrink-0 self-start overflow-y-auto lg:block">
            <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-xs">
              <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 px-2">Event Management</h3>
              <nav className="space-y-1">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      className={`w-full flex items-center px-4 py-3 rounded-lg transition-colors ${
                        activeTab === tab.id
                          ? 'bg-indigo-50 text-indigo-700 border-l-4 border-indigo-600 rounded-l-none'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon className={`h-5 w-5 mr-3 flex-shrink-0 transition-colors duration-200 ${
                        activeTab === tab.id ? 'text-indigo-600' : 'text-gray-400'
                      }`} />
                      <span className="font-semibold text-sm">{tab.name}</span>
                    </button>
                  );
                })}
              </nav>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl border border-gray-200 p-4 mt-6 shadow-xs">
              <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 px-1">Quick Stats</h4>
              <div className="space-y-3 px-1">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 font-medium">Participants</span>
                  <span className="text-sm font-bold text-gray-900">{event.current_participants || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 font-medium">Teams</span>
                  <span className="text-sm font-bold text-gray-900">{event.current_teams || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-500 font-medium">Max Participants</span>
                  <span className="text-sm font-bold text-gray-900">{event.max_participants}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              {renderActiveComponent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDashboard; 
