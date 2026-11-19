import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Users,
  UserCheck,
  CalendarClock,
  Clock,
  MapPin,
  Calendar,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Lock,
  Layers,
  FileText,
  Trophy,
  ExternalLink
} from 'lucide-react';
import { teamManagerAPI, eventsAPI } from '../../services/api';

const TeamEventOverview = ({
  event,
  eventId,
  teamData,
  categories = [],
  setActiveTab,
  onRefresh,
}) => {
  const [stats, setStats] = useState({
    programsCount: 0,
    assignedProgramsCount: 0,
    totalSlots: 0,
    filledSlots: 0,
    participantsCount: 0,
    loading: true,
  });

  const teamId = teamData?.id || teamData?.team_id || teamData?.team?.id;
  const teamName = teamData?.name || teamData?.team_name || teamData?.team?.name || 'Your Team';

  useEffect(() => {
    fetchTeamEventStats();
  }, [eventId, teamId]);

  const fetchTeamEventStats = async () => {
    if (!eventId || !teamId) {
      setStats((prev) => ({ ...prev, loading: false }));
      return;
    }

    try {
      setStats((prev) => ({ ...prev, loading: true }));
      const [programsRes, studentsRes] = await Promise.allSettled([
        teamManagerAPI.getEventPrograms(teamId, eventId),
        teamManagerAPI.getTeamStudents(teamId),
      ]);

      let programs = [];
      if (programsRes.status === 'fulfilled') {
        const d = programsRes.value.data;
        programs = Array.isArray(d) ? d : (d?.results || d?.programs || []);
      }

      let students = [];
      if (studentsRes.status === 'fulfilled') {
        const d = studentsRes.value.data;
        students = Array.isArray(d) ? d : (d?.students || d?.results || []);
      }

      let assignedProgramsCount = 0;
      let totalSlots = 0;
      let filledSlots = 0;
      const assignedStudentIdSet = new Set();

      programs.forEach((prog) => {
        const assigned = prog.assigned_students || [];
        const limit = prog.per_team_limit || (prog.is_team_based ? (prog.team_size || 4) : 1);
        totalSlots += limit;
        filledSlots += assigned.length;

        if (assigned.length > 0) {
          assignedProgramsCount += 1;
        }

        assigned.forEach((st) => {
          const sId = st.student_id || st.id;
          if (sId) assignedStudentIdSet.add(sId);
        });
      });

      setStats({
        programsCount: programs.length || event?.programs?.length || event?.programs_count || 0,
        assignedProgramsCount,
        totalSlots,
        filledSlots,
        participantsCount: assignedStudentIdSet.size,
        loading: false,
      });
    } catch (err) {
      console.warn('Could not fetch team event stats:', err);
      setStats((prev) => ({ ...prev, loading: false }));
    }
  };

  const isDeadlinePassed = event?.registration_deadline
    ? new Date(event.registration_deadline) < new Date()
    : false;

  const quotaPercent = stats.totalSlots > 0
    ? Math.min(100, Math.round((stats.filledSlots / stats.totalSlots) * 100))
    : 0;

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-[#f7f8fb] min-h-[620px]">
      {/* Top Header Card Box */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">
              {teamName}
            </span>
            <span className="text-slate-300">·</span>
            <span className="text-[10px] font-semibold text-slate-500">
              Team Overview
            </span>
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight mt-0.5">
            {event?.title || 'Event Dashboard'}
          </h1>
          <p className="text-xs text-gray-500 mt-0.5">
            {event?.start_date
              ? new Date(event.start_date).toLocaleDateString('en-US', {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : 'Date TBA'} · {event?.venue || 'Campus Venue'}
          </p>
        </div>

        <div className="flex items-center space-x-2 self-start sm:self-auto">
          <button
            onClick={() => {
              if (onRefresh) onRefresh();
              fetchTeamEventStats();
            }}
            type="button"
            className="px-3.5 py-2 bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 text-xs font-semibold rounded-xl shadow-2xs inline-flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${stats.loading ? 'animate-spin text-indigo-600' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Deadline / Locked Banner */}
      {isDeadlinePassed ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/70 p-3.5 text-xs text-rose-800 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Lock className="h-4 w-4 text-rose-600 shrink-0" />
            <span>
              <strong>Registration Locked:</strong> The deadline passed on{' '}
              {new Date(event.registration_deadline).toLocaleDateString()}. Changes are restricted to Event Admins.
            </span>
          </div>
          <span className="text-[10px] font-bold uppercase tracking-wider bg-rose-100 text-rose-800 px-2 py-0.5 rounded shrink-0">
            Locked
          </span>
        </div>
      ) : event?.registration_deadline ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-3.5 text-xs text-indigo-900 shadow-2xs">
          <div className="flex items-center gap-2.5">
            <Clock className="h-4 w-4 text-indigo-600 shrink-0" />
            <span>
              <strong>Registration Active:</strong> Team assignments close on{' '}
              {new Date(event.registration_deadline).toLocaleDateString()}.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('assignments')}
            className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 underline shrink-0 cursor-pointer"
          >
            Manage Entries →
          </button>
        </div>
      ) : null}

      {/* 4 Primary Stats Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Stat 1: Total Programs */}
        <div
          onClick={() => setActiveTab('programs')}
          className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Event Programs</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
              <BookOpen className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.programsCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">available</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
            <span>{categories.length} competition {categories.length === 1 ? 'category' : 'categories'}</span>
          </div>
        </div>

        {/* Stat 2: Assigned Entries */}
        <div
          onClick={() => setActiveTab('assignments')}
          className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Assigned Entries</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.assignedProgramsCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">/ {stats.programsCount} programs</span>
          </div>
          <div className="mt-1.5">
            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${stats.programsCount > 0 ? (stats.assignedProgramsCount / stats.programsCount) * 100 : 0}%` }}
              />
            </div>
          </div>
        </div>

        {/* Stat 3: Team Participants */}
        <div
          onClick={() => setActiveTab('participants')}
          className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Registered Team</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 group-hover:scale-105 transition-transform">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-bold text-slate-900 tracking-tight">
              {stats.participantsCount}
            </span>
            <span className="text-xs text-slate-400 font-medium">students</span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
            <span>Verified with chest numbers</span>
          </div>
        </div>

        {/* Stat 4: Schedule Status */}
        <div
          onClick={() => setActiveTab('schedule')}
          className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs hover:border-indigo-300 hover:shadow-xs transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Schedule</span>
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform ${
              event?.is_schedule_published ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
            }`}>
              <CalendarClock className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className={`text-xl font-bold tracking-tight ${
              event?.is_schedule_published ? 'text-emerald-700' : 'text-amber-700'
            }`}>
              {event?.is_schedule_published ? 'Published' : 'Draft'}
            </span>
          </div>
          <div className="mt-1.5 text-[11px] text-slate-500 flex items-center gap-1">
            <span>{event?.is_schedule_published ? 'Official PDF available' : 'Under finalization'}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions & Navigation Tiles */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          Quick Actions & Event Sections
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          {/* Tile 1: Assignments */}
          <div
            onClick={() => setActiveTab('assignments')}
            className="flex items-start justify-between p-3.5 rounded-xl border border-slate-200/70 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Student Assignments & Quotas
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Assign team members to individual and team competitions, manage sub-teams, and elect leaders.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </div>

          {/* Tile 2: Official Schedule */}
          <div
            onClick={() => setActiveTab('schedule')}
            className="flex items-start justify-between p-3.5 rounded-xl border border-slate-200/70 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600 mt-0.5 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                <CalendarClock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Official Timetable & Stages
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  View published stage orders, venue timetables, and download printable high-res schedule PDFs.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </div>

          {/* Tile 3: Call List & Verified Roster */}
          <div
            onClick={() => setActiveTab('documents')}
            className="flex items-start justify-between p-3.5 rounded-xl border border-slate-200/70 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600 mt-0.5 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Calling Sheets & Verified Call List
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Inspect verified chest numbers and download competition-wise or category-wise calling sheets.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </div>

          {/* Tile 4: Participants & Passes */}
          <div
            onClick={() => setActiveTab('participants')}
            className="flex items-start justify-between p-3.5 rounded-xl border border-slate-200/70 hover:border-indigo-200 hover:bg-indigo-50/20 transition-all cursor-pointer group"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-amber-50 text-amber-600 mt-0.5 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                  Team Participants & Passes
                </h3>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                  Search participant entries, inspect individual programs, points, and verify digital chest passes.
                </p>
              </div>
            </div>
            <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-600 group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
          </div>
        </div>
      </div>

      {/* Event Details Summary Footer Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">
          Event Logistics & Venue Information
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50/70 border border-slate-100">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">
                {event?.start_date ? new Date(event.start_date).toLocaleDateString() : 'TBA'}
                {event?.end_date && event.end_date !== event.start_date ? ` – ${new Date(event.end_date).toLocaleDateString()}` : ''}
              </div>
              <div className="text-[10px] text-slate-400">Competition Dates</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50/70 border border-slate-100">
            <Clock className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">
                {event?.start_time || 'Schedule Announced'}
              </div>
              <div className="text-[10px] text-slate-400">Daily Timing</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 rounded-lg bg-slate-50/70 border border-slate-100">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <div className="min-w-0">
              <div className="font-semibold text-slate-900 truncate">
                {event?.venue || 'Campus Main Stage'}
              </div>
              <div className="text-[10px] text-slate-400">Host Location</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TeamEventOverview;
