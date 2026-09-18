import React from 'react';

/**
 * Eventloo Minimal & Professional Loop Icon Component
 */
export const EventlooIcon = ({ className = "w-8 h-8", animated = false }) => (
  <svg
    viewBox="0 0 100 100"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${animated ? 'hover:scale-105 transition-transform duration-300' : ''}`}
  >
    <defs>
      <linearGradient id="eventlooGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#06B6D4" /> {/* Cyan */}
        <stop offset="50%" stopColor="#3B82F6" /> {/* Blue */}
        <stop offset="100%" stopColor="#6366F1" /> {/* Indigo */}
      </linearGradient>
      <linearGradient id="eventlooGrad2" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#8B5CF6" /> {/* Violet */}
        <stop offset="50%" stopColor="#6366F1" /> {/* Indigo */}
        <stop offset="100%" stopColor="#06B6D4" /> {/* Cyan */}
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>
    {/* Smooth Infinity Loop Ribbon */}
    <path
      d="M30 50 C15 50 15 28 32 28 C45 28 55 72 68 72 C85 72 85 50 70 50 C55 50 45 28 32 28 C15 28 15 50 30 50 Z"
      stroke="url(#eventlooGrad1)"
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M70 50 C85 50 85 28 68 28 C55 28 45 72 32 72 C15 72 15 50 30 50"
      stroke="url(#eventlooGrad2)"
      strokeWidth="9"
      strokeLinecap="round"
      strokeLinejoin="round"
      opacity="0.8"
    />
    {/* Glowing Nodes */}
    <circle cx="32" cy="28" r="3.5" fill="#06B6D4" filter="url(#glow)" />
    <circle cx="68" cy="72" r="3.5" fill="#8B5CF6" filter="url(#glow)" />
  </svg>
);

/**
 * Main Eventloo Logo component (Icon + Text or Icon only)
 */
const EventlooLogo = ({
  variant = 'full', // 'full' | 'icon'
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  theme = 'light', // 'light' | 'dark'
  className = '',
  showSubtitle = false,
}) => {
  const sizeMap = {
    sm: { icon: 'w-6 h-6', text: 'text-lg', space: 'gap-2' },
    md: { icon: 'w-9 h-9', text: 'text-2xl', space: 'gap-3' },
    lg: { icon: 'w-12 h-12', text: 'text-3xl', space: 'gap-3.5' },
    xl: { icon: 'w-16 h-16', text: 'text-4xl', space: 'gap-4' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const textColor = theme === 'dark' ? 'text-white' : 'text-gray-900';
  const subtitleColor = theme === 'dark' ? 'text-gray-400' : 'text-gray-500';

  if (variant === 'icon') {
    return <EventlooIcon className={`${currentSize.icon} ${className}`} animated />;
  }

  return (
    <div className={`inline-flex items-center ${currentSize.space} ${className}`}>
      <div className="relative flex items-center justify-center">
        <EventlooIcon className={currentSize.icon} animated />
      </div>

      <div className="flex flex-col">
        <div className="flex items-center tracking-tight leading-none">
          <span className={`font-extrabold ${currentSize.text} ${textColor}`}>
            Event<span className="bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">loo</span>
          </span>
        </div>
        {showSubtitle && (
          <span className={`text-[10px] font-semibold ${subtitleColor} tracking-wider uppercase mt-1`}>
            Event Management System
          </span>
        )}
      </div>
    </div>
  );
};

export default EventlooLogo;
