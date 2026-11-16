import React from 'react';
import eventlooWhiteLogo from "@/assets/gravitas/eventloo-logo.png";
import eventlooColorLogo from "@/assets/eventloo-logo-color.png";

/**
 * Eventloo Official Loop Icon Component
 */
export const EventlooIcon = ({ className = "w-8 h-8", variant = "color", animated = false }) => {
  const src = variant === "white" ? eventlooWhiteLogo : eventlooColorLogo;
  return (
    <img
      src={src}
      alt="Eventloo"
      className={`${className} object-contain ${animated ? 'hover:scale-105 transition-transform duration-300' : ''}`}
    />
  );
};

/**
 * Main Eventloo Logo component (Icon + Text or Icon only)
 */
const EventlooLogo = ({
  variant = 'full', // 'full' | 'icon' | 'white'
  size = 'md', // 'sm' | 'md' | 'lg' | 'xl'
  theme = 'light', // 'light' | 'dark'
  showText = true,
  className = '',
  showSubtitle = false,
  onClick,
}) => {
  const sizeMap = {
    sm: { icon: 'w-6 h-6', text: 'text-lg', space: 'gap-2' },
    md: { icon: 'w-9 h-9', text: 'text-2xl', space: 'gap-3' },
    lg: { icon: 'w-12 h-12', text: 'text-3xl', space: 'gap-3.5' },
    xl: { icon: 'w-16 h-16', text: 'text-4xl', space: 'gap-4' },
  };

  const currentSize = sizeMap[size] || sizeMap.md;
  const isWhite = theme === 'dark' || variant === 'white';
  const textColor = isWhite ? 'text-white' : 'text-gray-900';
  const subtitleColor = isWhite ? 'text-gray-400' : 'text-gray-500';

  if (variant === 'icon' || showText === false) {
    return <EventlooIcon className={`${currentSize.icon} ${className}`} variant={isWhite ? 'white' : 'color'} animated />;
  }

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center ${currentSize.space} ${onClick ? 'cursor-pointer select-none' : ''} ${className}`}
    >
      <div className="relative flex items-center justify-center">
        <EventlooIcon className={currentSize.icon} variant={isWhite ? 'white' : 'color'} animated />
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
