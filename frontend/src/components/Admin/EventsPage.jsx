import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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
  X,
  Upload,
  Image as ImageIcon
} from 'lucide-react';

const EventsPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
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
    const params = new URLSearchParams(location.search);
    if (params.get('action') === 'create' || params.get('create') === 'true') {
      setShowCreateModal(true);
    }
  }, [location.search]);

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
      draft: { class: 'border-slate-200 bg-slate-100 text-slate-600', label: 'Draft' },
      published: { class: 'border-indigo-100 bg-indigo-50 text-indigo-700', label: 'Published' },
      ongoing: { class: 'border-violet-100 bg-violet-50 text-violet-700', label: 'Ongoing' },
      completed: { class: 'border-slate-200 bg-white text-slate-700', label: 'Completed' },
      cancelled: { class: 'border-red-100 bg-red-50 text-red-700', label: 'Cancelled' }
    };
    
    const config = statusConfig[status] || statusConfig.draft;
    return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${config.class}`}>{config.label}</span>;
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
      <div className="flex min-h-[65vh] items-center justify-center bg-[#f7f8fb]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-indigo-600" />
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">Workspace</p>
          <h1 className="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Events</h1>
          <p className="text-xs text-slate-400 mt-1 font-normal">Create and manage your school events and festival programs.</p>
        </div>
        <button onClick={() => setShowCreateModal(true)} className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-indigo-700">
          <Plus className="h-3.5 w-3.5" /> Create event
        </button>
      </header>

      <section className="mt-6 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input type="search" placeholder="Search events" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50/70 pl-9 pr-3 text-sm outline-none focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100" />
          </div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="h-10 rounded-xl border border-slate-200 bg-slate-50/70 px-3 text-sm text-slate-700 outline-none focus:border-indigo-300 focus:ring-2 focus:ring-indigo-100 sm:w-44">
            {statusOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      </section>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-500" />
          <span className="text-red-700">{error}</span>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex items-center gap-2">
          <div className="h-5 w-5 text-indigo-500">✓</div>
          <span className="text-indigo-700">{success}</span>
        </div>
      )}

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3"><p className="text-sm font-semibold text-slate-900">Event directory</p><p className="text-xs text-slate-400">{filteredEvents.length} events</p></div>
        {filteredEvents.length === 0 ? <div className="py-16 text-center"><Calendar className="mx-auto h-6 w-6 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-900">No events found</p><p className="mt-1 text-sm text-slate-400">Try changing the search or status filter.</p></div> : (
          <div className="overflow-x-auto"><table className="min-w-full"><thead className="bg-slate-50/80"><tr>{['Event', 'Schedule', 'Venue', 'Category', 'Status'].map(label => <th key={label} className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">{label}</th>)}<th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">Actions</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{filteredEvents.map(event => <tr key={event.id} className="transition hover:bg-indigo-50/30"><td className="px-5 py-3.5"><div className="flex items-center gap-3">{(event.logo || event.event_logo) ? (<img src={event.logo || event.event_logo} alt={event.title} className="h-10 w-10 rounded-xl object-cover border border-slate-200 shrink-0 bg-white" onError={(e) => { e.currentTarget.style.display = 'none'; }} />) : (<div className="h-10 w-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center justify-center shrink-0"><Calendar className="h-5 w-5" /></div>)}<div className="min-w-0"><p className="max-w-[240px] truncate text-sm font-semibold text-slate-900">{event.title}</p><p className="max-w-[240px] truncate text-xs text-slate-400">{event.description || 'No description'}</p></div></div></td><td className="whitespace-nowrap px-5 py-3.5 text-sm text-slate-600">{formatDate(event.start_date)}{event.end_date && event.end_date !== event.start_date ? ` – ${formatDate(event.end_date)}` : ''}</td><td className="px-5 py-3.5 text-sm text-slate-600">{event.venue || event.location || '—'}</td><td className="px-5 py-3.5 text-sm text-slate-600 capitalize">{event.event_type || 'Competition'}</td><td className="px-5 py-3.5">{getStatusBadge(event.status)}</td><td className="px-5 py-3.5"><div className="flex justify-end gap-2"><button onClick={() => navigate(`/events/${event.id}/dashboard`)} className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50 px-2.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"><Eye className="h-3.5 w-3.5" /> View</button><button onClick={() => handleEditEvent(event)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-700" title="Edit event"><Edit className="h-4 w-4" /></button><button onClick={() => handleDeleteEvent(event.id)} className="rounded-lg border border-slate-200 p-1.5 text-slate-400 hover:border-red-100 hover:bg-red-50 hover:text-red-600" title="Delete event"><Trash2 className="h-4 w-4" /></button></div></td></tr>)}</tbody></table></div>
        )}
      </section>

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
    </main>
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
    is_team_based: true,
    status: 'draft',
    event_type: 'other',
    max_participants: '',
    registration_deadline: ''
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo image must be smaller than 5MB');
      return;
    }
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
  };

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
        is_team_based: true,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        registration_deadline: formData.registration_deadline || null
      };

      // Remove null/empty values
      Object.keys(eventData).forEach(key => {
        if (eventData[key] === null || eventData[key] === '') {
          delete eventData[key];
        }
      });

      let payload;
      if (logoFile) {
        const formDataPayload = new FormData();
        Object.entries(eventData).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            formDataPayload.append(key, value);
          }
        });
        formDataPayload.append('logo', logoFile);
        payload = formDataPayload;
      } else {
        payload = eventData;
      }

      console.log('Sending event data:', payload);
      
      // Make the API call
      const response = await eventsAPI.createEvent(payload);
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 md:pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
          
          {/* Sticky Header */}
          <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Create New Event</h3>
                <p className="text-xs text-slate-500">Configure schedule, venue, and participation settings</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Scrollable Form Content */}
          <form 
            id="create-event-drawer-form" 
            onSubmit={handleSubmit} 
            className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
          >
            {/* Card 1: Event Details */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Basic Information
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Event Logo
                </label>
                <div className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-xl">
                  {logoPreview ? (
                    <div className="relative shrink-0">
                      <img
                        src={logoPreview}
                        alt="Event Logo Preview"
                        className="h-16 w-16 rounded-xl object-cover border border-slate-200 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-sm"
                        title="Remove logo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer transition">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{logoPreview ? 'Change Event Logo' : 'Upload Event Logo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-slate-400 mt-1">
                      PNG, JPG, SVG or WEBP (max 5MB). Upload your official event badge/logo.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Event Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Sports Meet 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Provide an overview of the event, guidelines, or schedule..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Event Type
                  </label>
                  <select
                    value={formData.event_type}
                    onChange={(e) => setFormData({...formData, event_type: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: Schedule & Timing */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Schedule & Timing
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registration Deadline
                </label>
                <input
                  type="datetime-local"
                  value={formData.registration_deadline}
                  onChange={(e) => setFormData({...formData, registration_deadline: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Card 3: Venue & Participation */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Venue & Participation
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Venue / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Main Auditorium / Sports Ground"
                  value={formData.venue}
                  onChange={(e) => setFormData({...formData, venue: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Participants
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 100 (leave blank for unlimited)"
                  value={formData.max_participants}
                  onChange={(e) => setFormData({...formData, max_participants: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>
            </div>
          </form>

          {/* Sticky Footer */}
          <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-event-drawer-form"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Creating Event...</span>
                </>
              ) : (
                <span>Create Event</span>
              )}
            </button>
          </div>

        </div>
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
    try {
      const date = new Date(dateTimeString);
      const tzOffset = date.getTimezoneOffset() * 60000;
      return (new Date(date.getTime() - tzOffset)).toISOString().slice(0, 16);
    } catch (e) {
      return '';
    }
  };

  const [formData, setFormData] = useState({
    title: event.title || '',
    description: event.description || '',
    start_date: formatDateForInput(event.start_date),
    end_date: formatDateForInput(event.end_date),
    start_time: event.start_time || '',
    end_time: event.end_time || '',
    venue: event.venue || '',
    is_team_based: true,
    status: event.status || 'draft',
    event_type: event.event_type || 'other',
    max_participants: event.max_participants || '',
    registration_deadline: formatDateTimeForInput(event.registration_deadline)
  });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(event.logo || event.event_logo || null);
  const [removeLogoFlag, setRemoveLogoFlag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError('Logo image must be smaller than 5MB');
      return;
    }
    setLogoFile(file);
    setRemoveLogoFlag(false);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const handleRemoveLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    setRemoveLogoFlag(true);
  };

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
        is_team_based: true,
        max_participants: formData.max_participants ? parseInt(formData.max_participants) : null,
        registration_deadline: formData.registration_deadline || null
      };

      // Remove null/empty values
      Object.keys(updatedData).forEach(key => {
        if (updatedData[key] === null || updatedData[key] === '') {
          delete updatedData[key];
        }
      });

      let payload;
      if (logoFile instanceof File) {
        const formDataPayload = new FormData();
        Object.entries(updatedData).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            formDataPayload.append(key, value);
          }
        });
        formDataPayload.append('logo', logoFile);
        payload = formDataPayload;
      } else if (removeLogoFlag) {
        const formDataPayload = new FormData();
        Object.entries(updatedData).forEach(([key, value]) => {
          if (value !== null && value !== undefined && value !== '') {
            formDataPayload.append(key, value);
          }
        });
        formDataPayload.append('logo', '');
        payload = formDataPayload;
      } else {
        payload = updatedData;
      }

      console.log('Sending updated event data:', payload);
      
      // Make the API call
      await onUpdate(payload);
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

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
      />

      <div className="fixed inset-y-0 right-0 flex max-w-full pl-6 md:pl-10">
        <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-300">
          
          {/* Sticky Header */}
          <div className="border-b border-slate-200 bg-white px-6 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Edit className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Edit Event</h3>
                <p className="text-xs text-slate-500">Update configuration for {event.title}</p>
              </div>
            </div>
            <button 
              type="button"
              onClick={onClose} 
              className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="mx-6 mt-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          {/* Scrollable Form Content */}
          <form 
            id="edit-event-drawer-form" 
            onSubmit={handleSubmit} 
            className="flex-1 overflow-y-auto px-6 py-5 space-y-5"
          >
            {/* Card 1: Event Details */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Basic Information
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Event Logo
                </label>
                <div className="flex items-center gap-4 p-3 bg-white border border-slate-200 rounded-xl">
                  {logoPreview ? (
                    <div className="relative shrink-0">
                      <img
                        src={logoPreview}
                        alt="Event Logo Preview"
                        className="h-16 w-16 rounded-xl object-cover border border-slate-200 shadow-sm"
                      />
                      <button
                        type="button"
                        onClick={handleRemoveLogo}
                        className="absolute -top-1.5 -right-1.5 p-1 bg-red-600 text-white rounded-full hover:bg-red-700 shadow-sm"
                        title="Remove logo"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <div className="h-16 w-16 rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 flex flex-col items-center justify-center text-slate-400 shrink-0">
                      <ImageIcon className="h-6 w-6 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <label className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg cursor-pointer transition">
                      <Upload className="h-3.5 w-3.5" />
                      <span>{logoPreview ? 'Change Event Logo' : 'Upload Event Logo'}</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml"
                        onChange={handleLogoChange}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[11px] text-slate-400 mt-1">
                      PNG, JPG, SVG or WEBP (max 5MB). Upload your official event badge/logo.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Event Title <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Annual Sports Meet 2026"
                  value={formData.title}
                  onChange={(e) => setFormData({...formData, title: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Description
                </label>
                <textarea
                  placeholder="Provide an overview of the event, guidelines, or schedule..."
                  value={formData.description}
                  onChange={(e) => setFormData({...formData, description: e.target.value})}
                  rows="3"
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Event Type
                  </label>
                  <select
                    value={formData.event_type}
                    onChange={(e) => setFormData({...formData, event_type: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
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
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({...formData, status: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="ongoing">Ongoing</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Card 2: Schedule & Timing */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Schedule & Timing
              </h4>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.start_date}
                    onChange={(e) => setFormData({...formData, start_date: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.end_date}
                    onChange={(e) => setFormData({...formData, end_date: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={formData.start_time}
                    onChange={(e) => setFormData({...formData, start_time: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={formData.end_time}
                    onChange={(e) => setFormData({...formData, end_time: e.target.value})}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Registration Deadline
                </label>
                <input
                  type="datetime-local"
                  value={formData.registration_deadline}
                  onChange={(e) => setFormData({...formData, registration_deadline: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Card 3: Venue & Participation */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Venue & Participation
              </h4>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Venue / Location
                </label>
                <input
                  type="text"
                  placeholder="e.g. Main Auditorium / Sports Ground"
                  value={formData.venue}
                  onChange={(e) => setFormData({...formData, venue: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Max Participants
                </label>
                <input
                  type="number"
                  min="1"
                  placeholder="e.g. 100 (leave blank for unlimited)"
                  value={formData.max_participants}
                  onChange={(e) => setFormData({...formData, max_participants: e.target.value})}
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 focus:border-indigo-500"
                />
              </div>
            </div>
          </form>

          {/* Sticky Footer */}
          <div className="border-t border-slate-200 bg-white px-6 py-4 flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="edit-event-drawer-form"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 transition"
            >
              {loading ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default EventsPage; 
