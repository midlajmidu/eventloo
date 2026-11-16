import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Trophy, BarChart2, Calendar, ShieldCheck, MapPin, QrCode } from 'lucide-react';
import EventlooLogo from '../common/EventlooLogo';
import { SunsetSkylineFooter } from './PublicArtwork';

const PublicFooter = ({ event, eventId }) => {
  return (
    <footer className="relative bg-[#090817] text-slate-300 pt-0 pb-12 overflow-hidden border-t border-amber-500/20">
      {/* Grand Illustrated Sunset City Skyline Landscape Transition */}
      <div className="relative -mb-1">
        <SunsetSkylineFooter className="w-full opacity-90" />
      </div>

      <div className="max-w-7xl mx-auto px-6 sm:px-12 relative z-10 pt-10 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Col 1: Event Identity & Story */}
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center space-x-3">
              {event?.logo || event?.school_logo ? (
                <img
                  src={event.logo || event.school_logo}
                  alt={event?.title || event?.name}
                  className="w-11 h-11 rounded-xl object-contain bg-white/10 p-1 border border-amber-400/30 shadow-[0_0_15px_rgba(245,158,11,0.25)]"
                />
              ) : (
                <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-indigo-600 p-[1.5px] shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                  <div className="w-full h-full bg-[#120F2B] rounded-[9px] flex items-center justify-center text-amber-300 font-cinzel font-bold text-lg">
                    {event?.title ? event.title.charAt(0).toUpperCase() : (event?.name ? event.name.charAt(0).toUpperCase() : 'E')}
                  </div>
                </div>
              )}
              <div>
                <span className="text-[10px] font-cinzel uppercase tracking-[0.2em] text-amber-400 block font-bold">
                  {event?.school_name || 'Official Festival Portal'}
                </span>
                <h3 className="text-xl sm:text-2xl font-editorial font-bold text-white tracking-wide">
                  {event?.title || event?.name || 'Festival Portal'}
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-300/90 leading-relaxed max-w-md font-sans">
              {event?.public_about_text || event?.description || 'Bringing together curious minds, creative talents, and inspired teams to learn, compete, and showcase excellence in a spirit of knowledge and innovation.'}
            </p>

            {event?.venue && (
              <div className="flex items-center gap-2 text-xs text-amber-200/80 font-medium">
                <MapPin className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span>{event.venue}</span>
              </div>
            )}
          </div>

          {/* Col 2: Navigation Links */}
          <div className="space-y-3">
            <h4 className="font-cinzel text-xs uppercase tracking-widest text-amber-300 font-bold">
              Festival Directory
            </h4>
            <ul className="space-y-2.5 text-xs">
              <li>
                <Link to={`/events/${eventId}/public`} className="text-slate-300 hover:text-amber-300 transition-colors flex items-center space-x-2">
                  <span className="text-amber-500/70 font-mono text-[11px]">01</span>
                  <span>Festival Home</span>
                </Link>
              </li>
              <li>
                <Link to={`/events/${eventId}/public/results`} className="text-slate-300 hover:text-amber-300 transition-colors flex items-center space-x-2">
                  <span className="text-amber-500/70 font-mono text-[11px]">02</span>
                  <span>Live Results</span>
                </Link>
              </li>
              <li>
                <Link to={`/events/${eventId}/public/points`} className="text-slate-300 hover:text-amber-300 transition-colors flex items-center space-x-2">
                  <span className="text-amber-500/70 font-mono text-[11px]">03</span>
                  <span>Team Points Table</span>
                </Link>
              </li>
              <li>
                <Link to={`/events/${eventId}/public/schedule`} className="text-slate-300 hover:text-amber-300 transition-colors flex items-center space-x-2">
                  <span className="text-amber-500/70 font-mono text-[11px]">04</span>
                  <span>Program Schedule</span>
                </Link>
              </li>
              <li>
                <Link to={`/events/${eventId}/public/verify`} className="text-slate-300 hover:text-amber-300 transition-colors flex items-center space-x-2">
                  <span className="text-amber-500/70 font-mono text-[11px]">05</span>
                  <span>Candidate Badge & Scanner</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Col 3: Event Theme & Badge Scanner */}
          <div className="space-y-3">
            <h4 className="font-cinzel text-xs uppercase tracking-widest text-amber-300 font-bold">
              Theme & Credentials
            </h4>
            <div className="p-4 rounded-2xl bg-gradient-to-b from-[#1C1738] to-[#120E28] border border-amber-400/25 space-y-2.5 shadow-lg">
              <span className="text-[10px] font-cinzel font-bold text-amber-400/80 uppercase tracking-widest block">
                Festival Theme
              </span>
              <p className="font-brush text-2xl text-amber-300 tracking-wider">
                {event?.public_theme_title || 'Paths of Knowledge'}
              </p>
              <Link
                to={`/events/${eventId}/public/verify`}
                className="inline-flex items-center gap-2 text-xs font-semibold text-amber-300 hover:text-amber-200 pt-1 transition-colors"
              >
                <QrCode className="w-3.5 h-3.5 text-amber-400" />
                <span>Verify Participant Badge →</span>
              </Link>
            </div>
          </div>

        </div>

        {/* Bottom Bar: Copyright & Centered Eventloo Brand (From Reference Image Bottom) */}
        <div className="pt-8 border-t border-amber-500/20 flex flex-col items-center justify-center text-center space-y-2">
          <div className="flex items-center space-x-2.5 text-white">
            <div className="w-6 h-6 rounded bg-gradient-to-tr from-amber-400 to-indigo-500 p-[1px]">
              <div className="w-full h-full bg-[#0A081C] rounded flex items-center justify-center">
                <EventlooLogo size="sm" variant="white" showText={false} />
              </div>
            </div>
            <span className="font-editorial text-lg font-bold tracking-wide text-white">
              Eventloo
            </span>
          </div>

          <p className="text-xs text-amber-200/70 tracking-wide font-sans">
            Event Management for Colleges, Schools and Organizations
          </p>

          <p className="text-[11px] text-slate-500 pt-2">
            &copy; {new Date().getFullYear()} {event?.school_name || 'Eventloo'}. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default PublicFooter;
