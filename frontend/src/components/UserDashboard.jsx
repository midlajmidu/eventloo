import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Calendar,
  Trophy,
  Edit3,
  Award,
  Clock,
  Sparkles,
  ArrowRight,
  Activity,
  CheckCircle2,
} from 'lucide-react';
import { authAPI, eventsAPI } from '../services/api';
import TopNavbar from './Layout/TopNavbar';

const MetricCard = ({ label, value, detail, icon: Icon, tone }) => (
  <div className="group rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.02)] transition duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_24px_rgba(15,23,42,0.06)]">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
        <p className="mt-1.5 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="mt-1 text-xs text-slate-400 font-normal">{detail}</p>
      </div>
      <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${tone}`}>
        <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
      </div>
    </div>
  </div>
);

const UserDashboard = () => {
  const [user, setUser] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [userProfile, eventsRes] = await Promise.all([
        authAPI.getUserProfile().catch(() => null),
        eventsAPI.getEvents().catch(() => ({ data: [] })),
      ]);
      setUser(userProfile);
      const rawEvents = eventsRes?.data;
      const evList = Array.isArray(rawEvents) ? rawEvents : (rawEvents?.results || []);
      setEvents(evList);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const activeEvents = events.filter((e) => e.status === 'ongoing' || e.status === 'published');

  return (
    <div className="min-h-screen bg-[#f7f8fb] flex flex-col">
      {/* Top Navigation Bar */}
      <TopNavbar user={user} />

      {/* Main Content */}
      <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-6">
          {/* Hero Header */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-indigo-600">
                <Sparkles className="h-3 w-3" />
                Event Manager Portal
              </div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
                Event Management Dashboard
              </h1>
              <p className="text-xs text-slate-400 mt-1 font-normal">
                Manage your assigned events, scoring stages, programs, and marks.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Active Manager Session
              </span>
            </div>
          </header>

          {/* Metric Cards */}
          <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <MetricCard
              label="Assigned Events"
              value={events.length}
              detail={`${activeEvents.length} active festivals`}
              icon={Calendar}
              tone="bg-indigo-50 text-indigo-600"
            />
            <MetricCard
              label="Active Competitions"
              value={activeEvents.length}
              detail="Published & live scoring"
              icon={Activity}
              tone="bg-emerald-50 text-emerald-600"
            />
            <MetricCard
              label="Scorecards & Results"
              value="Live"
              detail="Real-time tabulation"
              icon={Trophy}
              tone="bg-amber-50 text-amber-600"
            />
          </section>

          {/* Active Events Directory */}
          <section className="rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.02)] overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold tracking-tight text-slate-900">
                  Assigned Events & Competitions
                </h2>
                <p className="text-xs text-slate-400 mt-0.5 font-normal">
                  Select an event to open the mark entry sheet, manage stages or review results.
                </p>
              </div>
              <span className="text-[11px] font-medium text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                {events.length} Events
              </span>
            </div>

            <div className="p-4 sm:p-5">
              {events.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {events.map((ev) => (
                    <div
                      key={ev.id}
                      onClick={() => navigate(`/events/${ev.id}/dashboard`)}
                      className="group flex flex-col justify-between p-4 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-white hover:border-indigo-200 hover:shadow-xs transition-all duration-200 cursor-pointer"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="text-xs font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                            {ev.title}
                          </h3>
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                              ev.status === 'published'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200'
                            }`}
                          >
                            {ev.status || 'Draft'}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2">
                          {ev.description || 'Event programs, candidate rosters and jury scorecards.'}
                        </p>
                      </div>

                      <div className="mt-3 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs text-slate-500">
                        <span className="text-[11px] text-slate-400">
                          {ev.venue || 'Campus Venue'}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                          Open Event Portal <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center">
                  <Calendar className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                  <p className="text-xs font-semibold text-slate-800">No events found</p>
                  <p className="text-xs text-slate-400 mt-1">
                    When you are assigned to school festivals or competitions, they will appear here.
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default UserDashboard;