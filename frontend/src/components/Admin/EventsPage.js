import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { eventsAPI } from '../../services/api';
import { 
  Calendar, 
  MapPin, 
  Users, 
  Plus, 
  Edit, 
  Trash2, 
  Search,
  Eye,
  AlertCircle,
  X
} from 'lucide-react';

const EventsPage = () => {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null);

  useEffect(() => {
    fetchEvents();
  }, [searchTerm, filterStatus]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const params = {};
      if (filterStatus !== 'all') params.status = filterStatus;
      if (searchTerm) params.search = searchTerm;
      
      const response = await eventsAPI.getEvents(params);
      console.log('Fetch events response:', response);
      
      // Extract data from axios response
      const data = response.data;
      console.log('Events data:', data);
      
      // Ensure events is always an array
      const eventsArray = Array.isArray(data) ? data : (data.results || []);
      console.log('Events array:', eventsArray);
      
      setEvents(eventsArray);
    } catch (err) {
      setError('Failed to fetch events');
      setEvents([]); // Set to empty array on error
      console.error('Error fetching events:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEvent = async (eventId) => {
    if (window.confirm('Are you sure you want to delete this event?')) {
      setError(null); // Clear any previous errors
      setSuccess(null); // Clear any previous success messages
      try {
        await eventsAPI.deleteEvent(eventId);
        await fetchEvents();
        setError(null); // Clear any previous errors
        setSuccess('Event deleted successfully!');
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(null), 3000);
      } catch (err) {
        console.error('Error deleting event:', err);
        console.error('Error response:', err.response);
        
        // Provide more specific error messages
        let errorMessage = 'Failed to delete event';
        
        if (err.response) {
          const status = err.response.status;
          const data = err.response.data;
          
          if (status === 403) {
            errorMessage = 'Permission denied. You do not have permission to delete events.';
          } else if (status === 404) {
            errorMessage = 'Event not found. It may have already been deleted.';
          } else if (status === 400) {
            errorMessage = data?.error || data?.detail || 'Invalid request. Please check the event data.';
          } else if (status === 500) {
            errorMessage = 'Server error. Please try again later.';
          } else if (data?.error) {
            errorMessage = data.error;
          } else if (data?.detail) {
            errorMessage = data.detail;
          }
        } else if (err.message) {
          errorMessage = `Network error: ${err.message}`;
        }
        
        setError(errorMessage);
      }
    }
  };

  const handleEditEvent = (event) => {
    setEditingEvent(event);
    setShowEditModal(true);
  };

  const handleUpdateEvent = async (updatedData) => {
    try {
      await eventsAPI.updateEvent(editingEvent.id, updatedData);
      setShowEditModal(false);
      setEditingEvent(null);
      await fetchEvents();
    } catch (err) {
      console.error('Error updating event:', err);
      throw err;
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      draft: { class: 'badge-gray', label: 'Draft' },
      published: { class: 'badge-primary', label: 'Published' },
      ongoing: { class: 'badge-warning', label: 'Ongoing' },
      completed: { class: 'badge-success', label: 'Completed' },
      cancelled: { class: 'badge-danger', label: 'Cancelled' }
    };
    
    const config = statusConfig[status] || statusConfig.draft;
    return <span className={`badge ${config.class}`}>{config.label}</span>;
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const filteredEvents = (Array.isArray(events) ? events : []).filter(event => {
    const matchesSearch = event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = filterStatus === 'all' || event.status === filterStatus;
    return matchesSearch && matchesStatus;
  });

  const statusOptions = [
    { value: 'all', label: 'All Events' },
    { value: 'draft', label: 'Draft' },
    { value: 'published', label: 'Published' },
    { value: 'ongoing', label: 'Ongoing' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="loading-spinner h-12 w-12"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600 mt-1">Manage and organize school events</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Event
        </button>
      </div>

      {/* Search and Filters */}
      <div className="card">
        <div className="card-body">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="form-input pl-10"
                />
              </div>
            </div>
            <div className="flex gap-3">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="form-select w-40"
              >
                {statusOptions.map(option => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-center gap-2">
          <div className="h-5 w-5 text-green-500">✓</div>
          <span className="text-green-700">{success}</span>
        </div>
      )}

      {/* Events Grid */}
      {filteredEvents.length === 0 ? (
        <div className="empty-state">
          <Calendar className="empty-state-icon" />
          <h3 className="empty-state-title">No events found</h3>
          <p className="empty-state-description">
            {searchTerm || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria.'
              : 'Get started by creating your first event.'
            }
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Event
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEvents.map((event) => (
            <div 
              key={event.id} 
              className="card card-hover cursor-pointer"
              onClick={() => navigate(`/events/${event.id}/dashboard`)}
            >
              {/* Event Header */}
              <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600 relative overflow-hidden">
                <div className="absolute inset-0 bg-black bg-opacity-20 flex items-center justify-center">
                  <Calendar className="h-8 w-8 text-white" />
                </div>
                <div className="absolute top-3 right-3">
                  {getStatusBadge(event.status)}
                </div>
              </div>

              {/* Event Content */}
              <div className="card-body">
                <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                  {event.title}
                </h3>
                
                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2" />
                    {formatDate(event.start_date)}
                    {event.end_date && event.end_date !== event.start_date && (
                      <span> - {formatDate(event.end_date)}</span>
                    )}
                  </div>
                  
                  {event.location && (
                    <div className="flex items-center text-sm text-gray-600">
                      <MapPin className="h-4 w-4 mr-2" />
                      {event.location}
                    </div>
                  )}
                  
                  <div className="flex items-center text-sm text-gray-600">
                    <Users className="h-4 w-4 mr-2" />
                    {event.is_team_based ? 'Team Event' : 'Individual Event'}
                  </div>
                </div>

                {event.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {event.description}
                  </p>
                )}

                {/* Event Actions */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/events/${event.id}/dashboard`);
                    }}
                    className="btn btn-secondary btn-sm"
                  >
                    <Eye className="h-4 w-4 mr-1" />
                    Open Event
                  </button>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEditEvent(event);
                      }}
                      className="p-2 text-gray-400 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition-colors duration-200"
                      title="Edit event"
                    >
                      <Edit className="h-4 w-4" />
                    </button>
                    
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteEvent(event.id);
                      }}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors duration-200"
                      title="Delete event"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-gray-900">
              {events.filter(e => e.status === 'published').length}
            </div>
            <div className="text-sm text-gray-600">Published</div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-gray-900">
              {events.filter(e => e.status === 'ongoing').length}
            </div>
            <div className="text-sm text-gray-600">Ongoing</div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-gray-900">
              {events.filter(e => e.status === 'completed').length}
            </div>
            <div className="text-sm text-gray-600">Completed</div>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center">
            <div className="text-2xl font-bold text-gray-900">
              {events.filter(e => e.status === 'draft').length}
            </div>
            <div className="text-sm text-gray-600">Draft</div>
          </div>
        </div>
      </div>

      {/* Create Event Modal */}
      {showCreateModal && (
        <CreateEventModal 
          onClose={() => setShowCreateModal(false)}
          onSave={() => {
            setShowCreateModal(false);
            fetchEvents();
          }}
        />
      )}

      {/* Edit Event Modal */}
      {showEditModal && editingEvent && (
        <EditEventModal
          event={editingEvent}
          onClose={() => setShowEditModal(false)}
          onUpdate={handleUpdateEvent}
        />
      )}
    </div>
  );
};

// Simplified Create Event Modal
const CreateEventModal = ({ onClose, onSave }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    venue: '',
    is_team_based: false,
    status: 'draft',
    event_type: 'other',
    max_participants: '',
    registration_deadline: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!formData.title || !formData.start_date || !formData.end_date) {
        setError('Please fill in all required fields (Title, Start Date, End Date)');
        setLoading(false);
        return;
      }

      // Prepare the data with proper field names and validation
      const eventData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        venue: formData.venue.trim(),
        event_type: formData.event_type,
        status: formData.status,
        is_team_based: formData.is_team_based,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        registration_deadline: formData.registration_deadline || null
      };

      // Remove null/empty values
      Object.keys(eventData).forEach(key => {
        if (eventData[key] === null || eventData[key] === '') {
          delete eventData[key];
        }
      });

      console.log('Sending event data:', eventData);
      
      // Make the API call
      const response = await eventsAPI.createEvent(eventData);
      console.log('Full API response:', response);
      console.log('Response status:', response.status);
      console.log('Response data:', response.data);
      
      // If we get here, the API call was successful
      if (response.status === 201 || response.status === 200) {
        console.log('Event created successfully!');
        console.log('Created event:', response.data);
        onSave(); // Close modal and refresh list
      } else {
        console.warn('Unexpected response status:', response.status);
        setError('Unexpected response from server');
      }
      
    } catch (err) {
      console.error('Error creating event:', err);
      console.log('Error response status:', err.response?.status);
      console.log('Error response data:', err.response?.data);
      console.log('Error message:', err.message);
      
      // Check if it's actually a success case (sometimes the API returns success with error status)
      if (err.response?.status === 201 || err.response?.status === 200) {
        console.log('Event created successfully despite error response');
        onSave();
        return;
      }
      
      // Handle different types of errors
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          setError(err.response.data);
        } else if (err.response.data.detail) {
          setError(err.response.data.detail);
        } else if (err.response.data.message) {
          setError(err.response.data.message);
        } else if (err.response.data.non_field_errors) {
          setError(err.response.data.non_field_errors.join(', '));
        } else {
          // Handle field-specific errors
          const fieldErrors = [];
          Object.keys(err.response.data).forEach(field => {
            if (Array.isArray(err.response.data[field])) {
              fieldErrors.push(`${field}: ${err.response.data[field].join(', ')}`);
            } else {
              fieldErrors.push(`${field}: ${err.response.data[field]}`);
            }
          });
          setError(fieldErrors.join('; '));
        }
      } else {
        setError(err.message || 'Failed to create event');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create New Event</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venue
            </label>
            <input
              type="text"
              value={formData.venue}
              onChange={(e) => setFormData({...formData, venue: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Type
              </label>
              <select
                value={formData.event_type}
                onChange={(e) => setFormData({...formData, event_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="other">Other</option>
                <option value="competition">Competition</option>
                <option value="cultural">Cultural</option>
                <option value="sports">Sports</option>
                <option value="academic">Academic</option>
                <option value="workshop">Workshop</option>
                <option value="seminar">Seminar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Participants
            </label>
            <input
              type="number"
              value={formData.max_participants}
              onChange={(e) => setFormData({...formData, max_participants: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Registration Deadline
            </label>
            <input
              type="datetime-local"
              value={formData.registration_deadline}
              onChange={(e) => setFormData({...formData, registration_deadline: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_team_based"
              checked={formData.is_team_based}
              onChange={(e) => setFormData({...formData, is_team_based: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_team_based" className="ml-2 block text-sm text-gray-900">
              Team-based event
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Simplified Edit Event Modal
const EditEventModal = ({ event, onClose, onUpdate }) => {
  // Helper function to format date for input fields
  const formatDateForInput = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
  };

  // Helper function to format datetime for input fields
  const formatDateTimeForInput = (dateTimeString) => {
    if (!dateTimeString) return '';
    const date = new Date(dateTimeString);
    return date.toISOString().slice(0, 16); // Format: YYYY-MM-DDTHH:MM
  };

  const [formData, setFormData] = useState({
    title: event.title || '',
    description: event.description || '',
    start_date: formatDateForInput(event.start_date),
    end_date: formatDateForInput(event.end_date),
    start_time: event.start_time || '',
    end_time: event.end_time || '',
    venue: event.venue || '',
    is_team_based: event.is_team_based || false,
    status: event.status || 'draft',
    event_type: event.event_type || 'other',
    max_participants: event.max_participants || '',
    registration_deadline: formatDateTimeForInput(event.registration_deadline)
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Validate required fields
      if (!formData.title || !formData.start_date || !formData.end_date) {
        setError('Please fill in all required fields (Title, Start Date, End Date)');
        setLoading(false);
        return;
      }

      // Prepare the data with proper field names and validation
      const updatedData = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        start_date: formData.start_date,
        end_date: formData.end_date,
        start_time: formData.start_time || null,
        end_time: formData.end_time || null,
        venue: formData.venue.trim(),
        event_type: formData.event_type,
        status: formData.status,
        is_team_based: formData.is_team_based,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        registration_deadline: formData.registration_deadline || null
      };

      // Remove null/empty values
      Object.keys(updatedData).forEach(key => {
        if (updatedData[key] === null || updatedData[key] === '') {
          delete updatedData[key];
        }
      });

      console.log('Sending updated event data:', updatedData);
      
      // Make the API call
      await onUpdate(updatedData);
      console.log('Event updated successfully!');
      
    } catch (err) {
      console.error('Error updating event:', err);
      console.log('Error response status:', err.response?.status);
      console.log('Error response data:', err.response?.data);
      console.log('Error message:', err.message);
      
      // Handle different types of errors
      if (err.response?.data) {
        if (typeof err.response.data === 'string') {
          setError(err.response.data);
        } else if (err.response.data.detail) {
          setError(err.response.data.detail);
        } else if (err.response.data.message) {
          setError(err.response.data.message);
        } else if (err.response.data.non_field_errors) {
          setError(err.response.data.non_field_errors.join(', '));
        } else {
          // Handle field-specific errors
          const fieldErrors = [];
          Object.keys(err.response.data).forEach(field => {
            if (Array.isArray(err.response.data[field])) {
              fieldErrors.push(`${field}: ${err.response.data[field].join(', ')}`);
            } else {
              fieldErrors.push(`${field}: ${err.response.data[field]}`);
            }
          });
          setError(fieldErrors.join('; '));
        }
      } else {
        setError(err.message || 'Failed to update event');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Edit Event: {event.title}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Event Title *
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows="3"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Date *
              </label>
              <input
                type="date"
                value={formData.start_date}
                onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Date *
              </label>
              <input
                type="date"
                value={formData.end_date}
                onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Venue
            </label>
            <input
              type="text"
              value={formData.venue}
              onChange={(e) => setFormData({...formData, venue: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Event Type
              </label>
              <select
                value={formData.event_type}
                onChange={(e) => setFormData({...formData, event_type: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="other">Other</option>
                <option value="competition">Competition</option>
                <option value="cultural">Cultural</option>
                <option value="sports">Sports</option>
                <option value="academic">Academic</option>
                <option value="workshop">Workshop</option>
                <option value="seminar">Seminar</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Status
              </label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({...formData, status: e.target.value})}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Max Participants
            </label>
            <input
              type="number"
              value={formData.max_participants}
              onChange={(e) => setFormData({...formData, max_participants: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              min="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Registration Deadline
            </label>
            <input
              type="datetime-local"
              value={formData.registration_deadline}
              onChange={(e) => setFormData({...formData, registration_deadline: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center">
            <input
              type="checkbox"
              id="is_team_based"
              checked={formData.is_team_based}
              onChange={(e) => setFormData({...formData, is_team_based: e.target.checked})}
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
            />
            <label htmlFor="is_team_based" className="ml-2 block text-sm text-gray-900">
              Team-based event
            </label>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventsPage; 