import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { eventsAPI } from '../../services/api';
import EventPrograms from './EventPrograms';
import EventAssignments from './EventAssignments';
import EventMarkEntry from './EventMarkEntry';
import EventResults from './EventResults';
import EventDocuments from './EventDocuments';
import EventPoints from './EventPoints';
import EventCertificates from './EventCertificates';
import EventReports from './EventReports';

const EventDashboard = () => {
  const { eventId } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [activeTab, setActiveTab] = useState('programs');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvent();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

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
    { id: 'programs', name: 'Programs', icon: '📋', description: 'Manage event programs' },
    { id: 'assignments', name: 'Assignments', icon: '👥', description: 'Assign students to programs' },
    { id: 'mark-entry', name: 'Mark Entry', icon: '✏️', description: 'Enter marks and scores' },
    { id: 'results', name: 'Results', icon: '🏆', description: 'View results and rankings' },
    { id: 'documents', name: 'Documents', icon: '📄', description: 'Generate calling sheets & valuation forms' },
    { id: 'points', name: 'Points', icon: '⭐', description: 'Team points overview' },
    { id: 'certificates', name: 'Certificates', icon: '🏅', description: 'Generate certificates' },
    { id: 'reports', name: 'Reports', icon: '📊', description: 'Event analytics' },
  ];

  const renderActiveComponent = () => {
    console.log('EventDashboard eventId:', eventId, 'Type:', typeof eventId);
    const props = { event, eventId, onRefresh: fetchEvent };
    
    switch (activeTab) {
      case 'programs':
        return <EventPrograms {...props} />;
      case 'assignments':
        return <EventAssignments {...props} />;
      case 'mark-entry':
        return <EventMarkEntry eventId={eventId} />;
      case 'results':
        return <EventResults />;
      case 'documents':
        return <EventDocuments {...props} />;
      case 'points':
        return <EventPoints {...props} />;
      case 'certificates':
        return <EventCertificates {...props} />;
      case 'reports':
        return <EventReports {...props} />;
      default:
        return <EventPrograms {...props} />;
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
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
            className="text-blue-600 hover:text-blue-800"
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
                event.status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
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

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-8">
          {/* Sidebar Navigation */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Management</h3>
              <nav className="space-y-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition-colors ${
                      activeTab === tab.id
                        ? 'bg-blue-50 text-blue-700 border-l-4 border-blue-700'
                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    <div className="flex items-center">
                      <span className="text-lg mr-3">{tab.icon}</span>
                      <div>
                        <div className="font-medium">{tab.name}</div>
                        <div className="text-xs text-gray-500 mt-1">{tab.description}</div>
                      </div>
                    </div>
                  </button>
                ))}
              </nav>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-lg shadow-sm p-4 mt-6">
              <h4 className="font-semibold text-gray-900 mb-3">Quick Stats</h4>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Participants</span>
                  <span className="text-sm font-medium">{event.current_participants || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Teams</span>
                  <span className="text-sm font-medium">{event.current_teams || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Max Participants</span>
                  <span className="text-sm font-medium">{event.max_participants}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="flex-1">
            <div className="bg-white rounded-lg shadow-sm">
              {renderActiveComponent()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EventDashboard; 