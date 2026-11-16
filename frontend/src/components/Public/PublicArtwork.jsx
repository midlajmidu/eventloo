import React from 'react';

/**
 * Enchanted Knowledge Festival — Custom Illustrated SVG Artwork & Visual Components
 * Inspired by the twilight desert night sky, palace silhouettes, antique lanterns,
 * illuminated parchment, and scholarly motifs.
 */

// Laurel Wreath Rank Badge for 1st, 2nd, 3rd Winner Podiums
export const LaurelRankBadge = ({ rank = 1, size = 48 }) => {
  const isFirst = rank === 1;
  const isSecond = rank === 2;
  const isThird = rank === 3;

  const strokeColor = isFirst ? '#D97706' : isSecond ? '#94A3B8' : isThird ? '#B45309' : '#64748B';
  const fillColor = isFirst ? '#F59E0B' : isSecond ? '#CBD5E1' : isThird ? '#D97706' : '#94A3B8';

  return (
    <div className="relative inline-flex items-center justify-center shrink-0" style={{ width: size, height: size }}>
      <svg viewBox="0 0 54 54" className="w-full h-full drop-shadow-sm" fill="none" xmlns="http://www.w3.org/2000/svg">
        <g stroke={strokeColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M 12 40 C 9 32 10 20 18 12" />
          <path d="M 12 36 C 8 35 6 32 7 29 C 10 30 12 33 12 36 Z" strokeWidth="0.8" fill={strokeColor} fillOpacity="0.15" />
          <path d="M 11 30 C 7 28 5 25 7 22 C 9 24 11 27 11 30 Z" strokeWidth="0.8" fill={strokeColor} fillOpacity="0.15" />
          <path d="M 12 24 C 8 21 8 17 10 15 C 12 17 13 21 12 24 Z" strokeWidth="0.8" fill={strokeColor} fillOpacity="0.15" />
          <path d="M 15 17 C 12 14 13 10 16 9 C 17 12 16 15 15 17 Z" strokeWidth="0.8" fill={strokeColor} fillOpacity="0.15" />
          <path d="M 42 40 C 45 32 44 20 36 12" />
          <path d="M 42 36 C 46 35 48 32 47 29 C 44 30 42 33 42 36 Z" strokeWidth="0.8" fill={strokeColor} fillOpacity="0.15" />
          <path d="M 43 30 C 47 28 49 25 47 22 C 45 24 43 27 43 30 Z" strokeWidth="0.8" fill={strokeColor} fillOpacity="0.15" />
          <path d="M 42 24 C 46 21 46 17 44 15 C 42 17 41 21 42 24 Z" strokeWidth="0.8" fill={strokeColor} fillOpacity="0.15" />
          <path d="M 39 17 C 42 14 41 10 38 9 C 37 12 38 15 39 17 Z" strokeWidth="0.8" fill={strokeColor} fillOpacity="0.15" />
        </g>
        <text
          x="27"
          y="31"
          textAnchor="middle"
          fontSize="18"
          fontWeight="900"
          fontFamily="Cinzel, Georgia, serif"
          fill={fillColor}
        >
          {rank}
        </text>
      </svg>
    </div>
  );
};

export const TwinklingStar = ({ className = '', style = {}, size = 16, delay = '0s' }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    className={`animate-twinkle ${className}`}
    style={{ animationDelay: delay, ...style }}
  >
    <path
      d="M12 0C12 7.5 16.5 12 24 12C16.5 12 12 16.5 12 24C12 16.5 7.5 12 0 12C7.5 12 12 7.5 12 0Z"
      fill="url(#starGlowGrad)"
    />
    <circle cx="12" cy="12" r="2.5" fill="#FFFFFF" />
    <defs>
      <linearGradient id="starGlowGrad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDE68A" />
        <stop offset="0.5" stopColor="#F59E0B" />
        <stop offset="1" stopColor="#FBBF24" stopOpacity="0.4" />
      </linearGradient>
    </defs>
  </svg>
);

// 2. Shooting Star Streak
export const ShootingStar = ({ className = '', style = {} }) => (
  <div className={`absolute pointer-events-none ${className}`} style={style}>
    <div className="relative w-36 h-1 rotate-[28deg] animate-shooting-star">
      <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full shadow-[0_0_12px_#FDE68A]" />
      <div className="w-full h-[2px] bg-gradient-to-l from-white via-amber-300 to-transparent rounded-full" />
    </div>
  </div>
);

// 3. Glowing Full Moon & Islamic Palace Silhouette
export const PalaceMoonSilhouette = ({ className = '' }) => (
  <svg
    viewBox="0 0 540 400"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-full h-auto drop-shadow-[0_0_50px_rgba(253,230,138,0.35)] ${className}`}
  >
    <defs>
      {/* Radiant Golden Moon Gradient */}
      <radialGradient id="moonGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="45%" stopColor="#FDE68A" />
        <stop offset="78%" stopColor="#F59E0B" />
        <stop offset="100%" stopColor="#D97706" stopOpacity="0.8" />
      </radialGradient>
      
      {/* Palace Shading Gradient */}
      <linearGradient id="palaceGrad" x1="270" y1="120" x2="270" y2="400" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFF7ED" stopOpacity="0.9" />
        <stop offset="0.3" stopColor="#FED7AA" />
        <stop offset="0.75" stopColor="#FDBA74" />
        <stop offset="1" stopColor="#EA580C" />
      </linearGradient>
      
      {/* Night Sky Halo */}
      <radialGradient id="skyHalo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.5" />
        <stop offset="60%" stopColor="#F59E0B" stopOpacity="0.2" />
        <stop offset="100%" stopColor="#1E1B4B" stopOpacity="0" />
      </radialGradient>
    </defs>

    {/* Atmospheric Halo */}
    <circle cx="340" cy="180" r="190" fill="url(#skyHalo)" />

    {/* Glowing Full Moon */}
    <circle cx="340" cy="180" r="115" fill="url(#moonGlow)" />
    
    {/* Moon Crater Details (subtle artistic rings) */}
    <circle cx="320" cy="140" r="28" fill="#F59E0B" fillOpacity="0.12" />
    <circle cx="370" cy="190" r="35" fill="#D97706" fillOpacity="0.1" />
    <circle cx="305" cy="205" r="22" fill="#B45309" fillOpacity="0.08" />

    {/* Background Palm Silhouettes behind Palace */}
    <g fill="#7C2D12" fillOpacity="0.6">
      <path d="M480 340C475 290 488 250 500 230C490 238 475 255 470 270C462 250 450 236 438 232C448 245 455 265 458 285C445 272 430 268 418 268C430 280 440 295 448 315L455 350H480Z" />
      <path d="M120 340C125 295 110 260 98 242C108 248 122 262 128 276C134 256 148 244 158 240C148 252 142 270 140 290C152 278 165 274 178 274C165 285 155 300 148 318L142 350H120Z" />
    </g>

    {/* Islamic Palace Structure */}
    {/* Base Terrace */}
    <rect x="150" y="310" width="360" height="90" rx="4" fill="url(#palaceGrad)" />
    
    {/* Lower Arcade Arches */}
    <g fill="#431407">
      <path d="M180 400V350C180 338 190 328 202 328C214 328 224 338 224 350V400H180Z" />
      <path d="M240 400V350C240 338 250 328 262 328C274 328 284 338 284 350V400H240Z" />
      <path d="M300 400V345C300 330 315 318 330 318C345 318 360 330 360 345V400H300Z" />
      <path d="M376 400V350C376 338 386 328 398 328C410 328 420 338 420 350V400H376Z" />
      <path d="M436 400V350C436 338 446 328 458 328C470 328 480 338 480 350V400H436Z" />
    </g>

    {/* Central Portal & Grand Iwan */}
    <path d="M280 330V270H380V330H280Z" fill="url(#palaceGrad)" />
    <path d="M295 330V280C295 262 310 250 330 250C350 250 365 262 365 280V330H295Z" fill="#3B0764" />

    {/* Grand Central Onion Dome */}
    <path
      d="M295 250C295 220 310 190 330 165C350 190 365 220 365 250C360 258 300 258 295 250Z"
      fill="url(#palaceGrad)"
    />
    {/* Dome Finial Crescent */}
    <path d="M330 165V145M327 148C327 144 333 144 333 148" stroke="#FED7AA" strokeWidth="2.5" strokeLinecap="round" />

    {/* Left Flanking Small Dome */}
    <path d="M225 310C225 288 236 268 250 252C264 268 275 288 275 310H225Z" fill="url(#palaceGrad)" />
    <path d="M250 252V240" stroke="#FED7AA" strokeWidth="2" />

    {/* Right Flanking Small Dome */}
    <path d="M385 310C385 288 396 268 410 252C424 268 435 288 435 310H385Z" fill="url(#palaceGrad)" />
    <path d="M410 252V240" stroke="#FED7AA" strokeWidth="2" />

    {/* Tall Slender Minaret (Right) */}
    <rect x="490" y="210" width="18" height="190" fill="url(#palaceGrad)" />
    <rect x="486" y="235" width="26" height="8" rx="2" fill="#7C2D12" />
    <rect x="488" y="275" width="22" height="6" rx="2" fill="#7C2D12" />
    <path d="M490 210C490 195 499 180 499 180C499 180 508 195 508 210H490Z" fill="url(#palaceGrad)" />
    <path d="M499 180V168" stroke="#FED7AA" strokeWidth="1.8" />

    {/* Tall Slender Minaret (Left) */}
    <rect x="152" y="225" width="16" height="175" fill="url(#palaceGrad)" />
    <rect x="148" y="248" width="24" height="7" rx="2" fill="#7C2D12" />
    <path d="M152 225C152 212 160 200 160 200C160 200 168 212 168 225H152Z" fill="url(#palaceGrad)" />
    <path d="M160 200V190" stroke="#FED7AA" strokeWidth="1.8" />

    {/* Window Glow Lights */}
    <g fill="#FEF08A">
      <ellipse cx="202" cy="355" rx="5" ry="10" />
      <ellipse cx="262" cy="355" rx="5" ry="10" />
      <ellipse cx="330" cy="290" rx="8" ry="16" />
      <ellipse cx="398" cy="355" rx="5" ry="10" />
      <ellipse cx="458" cy="355" rx="5" ry="10" />
      <circle cx="499" cy="225" r="3" />
      <circle cx="160" cy="238" r="2.5" />
    </g>
  </svg>
);

// 4. Illustrated Traveller / Seeker with Book of Knowledge
export const TravellerHeroArtwork = ({ className = '' }) => (
  <svg
    viewBox="0 0 320 420"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-full h-auto drop-shadow-[0_15px_35px_rgba(0,0,0,0.6)] ${className}`}
  >
    <defs>
      <linearGradient id="cloakGrad" x1="160" y1="120" x2="160" y2="400" gradientUnits="userSpaceOnUse">
        <stop stopColor="#4338CA" />
        <stop offset="0.45" stopColor="#312E81" />
        <stop offset="0.85" stopColor="#1E1B4B" />
        <stop offset="1" stopColor="#0F172A" />
      </linearGradient>

      <linearGradient id="turbanGrad" x1="160" y1="40" x2="160" y2="120" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F8FAFC" />
        <stop offset="0.6" stopColor="#E2E8F0" />
        <stop offset="1" stopColor="#94A3B8" />
      </linearGradient>

      <linearGradient id="skinGrad" x1="180" y1="80" x2="220" y2="130" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDBA74" />
        <stop offset="0.8" stopColor="#EA580C" />
      </linearGradient>

      <linearGradient id="bookCoverGrad" x1="220" y1="210" x2="280" y2="300" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F59E0B" />
        <stop offset="0.5" stopColor="#D97706" />
        <stop offset="1" stopColor="#78350F" />
      </linearGradient>

      <linearGradient id="bookPagesGrad" x1="220" y1="220" x2="270" y2="290" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFBEB" />
        <stop offset="1" stopColor="#FEF3C7" />
      </linearGradient>
    </defs>

    {/* Shadow behind traveller */}
    <ellipse cx="160" cy="405" rx="90" ry="12" fill="#020617" fillOpacity="0.5" />

    {/* Flowing Outer Cloak / Robe */}
    <path
      d="M125 150C95 180 70 240 60 320C55 360 52 385 50 400H270C265 370 258 310 245 250C238 215 220 170 195 150L160 140L125 150Z"
      fill="url(#cloakGrad)"
    />

    {/* Cloak Fold Lines & Highlights */}
    <path d="M125 150C110 220 100 300 95 400" stroke="#6366F1" strokeWidth="2.5" strokeOpacity="0.5" />
    <path d="M165 148C155 240 152 320 155 400" stroke="#4F46E5" strokeWidth="3" strokeOpacity="0.6" />
    <path d="M190 170C205 240 220 320 228 400" stroke="#3730A3" strokeWidth="2.5" />

    {/* Face Profile (Turned looking toward the right at the palace) */}
    <path
      d="M185 85C192 80 205 82 212 90C218 97 216 108 214 115C218 116 221 119 220 124C218 128 213 129 210 131C212 136 208 142 198 145C188 148 180 142 178 135L185 85Z"
      fill="url(#skinGrad)"
    />

    {/* Eye looking forward/upward */}
    <ellipse cx="211" cy="108" rx="2.5" ry="1.5" fill="#431407" />
    {/* Eyebrow */}
    <path d="M206 102C209 100 214 101 216 104" stroke="#431407" strokeWidth="1.8" strokeLinecap="round" />

    {/* Wrapped White Silk Turban / Keffiyeh with Folds */}
    <path
      d="M150 95C148 65 165 42 192 40C215 38 230 52 232 72C233 88 225 105 208 112C188 118 152 118 150 95Z"
      fill="url(#turbanGrad)"
    />
    {/* Turban Folds / Wrap Rings */}
    <path d="M152 75C170 65 200 64 225 76" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
    <path d="M155 90C175 80 205 80 226 94" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
    <path d="M162 105C180 96 200 98 218 108" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
    {/* Hanging Turban Scarf Tail */}
    <path d="M150 90C138 100 130 125 132 155C133 170 138 185 142 195L150 170C146 150 144 120 152 95Z" fill="#E2E8F0" />

    {/* Right Hand & Arm cradling the open book */}
    <path d="M195 190C210 195 230 205 240 220C245 228 248 240 244 250L220 240C212 225 202 210 195 190Z" fill="url(#cloakGrad)" />
    {/* Hand holding book */}
    <path d="M236 242C240 240 246 242 248 247C250 252 248 258 244 262L235 258" fill="url(#skinGrad)" />

    {/* The Book of Knowledge (Open Leather-bound Tome) */}
    <g transform="rotate(-12 250 260)">
      {/* Heavy Leather Cover with Gilded Edges */}
      <rect x="210" y="235" width="75" height="90" rx="4" fill="url(#bookCoverGrad)" stroke="#FDE68A" strokeWidth="1.5" />
      {/* Gold Trim Corner Filigree */}
      <path d="M213 238H223M213 238V248" stroke="#FEF08A" strokeWidth="1.5" />
      <path d="M282 238H272M282 238V248" stroke="#FEF08A" strokeWidth="1.5" />
      {/* Pages Texture */}
      <rect x="215" y="240" width="65" height="80" rx="2" fill="url(#bookPagesGrad)" />
      {/* Calligraphy Lines on open page */}
      <line x1="222" y1="252" x2="272" y2="252" stroke="#D97706" strokeWidth="1.5" strokeDasharray="3 2" />
      <line x1="222" y1="262" x2="270" y2="262" stroke="#B45309" strokeWidth="1.2" strokeDasharray="4 2" />
      <line x1="222" y1="272" x2="265" y2="272" stroke="#B45309" strokeWidth="1.2" strokeDasharray="5 2" />
      <line x1="222" y1="282" x2="272" y2="282" stroke="#B45309" strokeWidth="1.2" strokeDasharray="3 3" />
      {/* Hanging Golden Bookmark Ribbon */}
      <path d="M245 320C248 335 252 345 250 355L245 350L240 355C242 345 244 335 245 320Z" fill="#F59E0B" />
    </g>
  </svg>
);

// 5. Floating Magical Silk Ribbon / Banner
export const FloatingRibbon = ({ className = '' }) => (
  <svg
    viewBox="0 0 480 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`animate-ribbon pointer-events-none drop-shadow-[0_8px_20px_rgba(244,63,94,0.35)] ${className}`}
  >
    <defs>
      <linearGradient id="ribbonGrad" x1="0" y1="90" x2="480" y2="90" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FB7185" stopOpacity="0.85" />
        <stop offset="0.3" stopColor="#F43F5E" />
        <stop offset="0.7" stopColor="#FB923C" />
        <stop offset="1" stopColor="#FBBF24" stopOpacity="0.75" />
      </linearGradient>
      <linearGradient id="ribbonUnderside" x1="0" y1="90" x2="480" y2="90" gradientUnits="userSpaceOnUse">
        <stop stopColor="#BE123C" />
        <stop offset="0.5" stopColor="#9F1239" />
        <stop offset="1" stopColor="#C2410C" />
      </linearGradient>
    </defs>

    {/* Underside fold */}
    <path
      d="M90 60C140 40 190 75 240 95C280 110 320 120 360 100C330 115 290 112 250 98C200 80 150 45 90 60Z"
      fill="url(#ribbonUnderside)"
    />

    {/* Main Flowing Ribbon Body */}
    <path
      d="M10 80C60 40 120 45 170 70C220 95 270 120 330 100C390 80 430 45 470 30C460 55 420 95 360 115C300 135 240 110 190 85C140 60 70 65 10 110V80Z"
      fill="url(#ribbonGrad)"
    />
    
    {/* Forked ribbon tail */}
    <path d="M10 80L35 95L10 110V80Z" fill="#E11D48" />
  </svg>
);

// 6. Illuminated Antique Moorish Lantern
export const AntiqueLantern = ({ className = '', size = 160 }) => (
  <svg
    width={size}
    height={size * 1.5}
    viewBox="0 0 160 240"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`animate-lantern-glow ${className}`}
  >
    <defs>
      {/* Warm Lantern Flame Radial Glow */}
      <radialGradient id="lanternFlameGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFFFFF" />
        <stop offset="25%" stopColor="#FEF08A" />
        <stop offset="60%" stopColor="#F59E0B" />
        <stop offset="85%" stopColor="#EA580C" stopOpacity="0.85" />
        <stop offset="100%" stopColor="#9A3412" stopOpacity="0" />
      </radialGradient>

      {/* Antique Brass Metalwork Gradient */}
      <linearGradient id="brassGrad" x1="0" y1="0" x2="160" y2="240" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDE68A" />
        <stop offset="0.25" stopColor="#D97706" />
        <stop offset="0.5" stopColor="#B45309" />
        <stop offset="0.8" stopColor="#78350F" />
        <stop offset="1" stopColor="#451A03" />
      </linearGradient>
    </defs>

    {/* Hanging Ring at Top */}
    <circle cx="80" cy="22" r="14" stroke="url(#brassGrad)" strokeWidth="5" fill="none" />
    <path d="M80 34V46" stroke="url(#brassGrad)" strokeWidth="6" strokeLinecap="round" />

    {/* Ornate Onion Cap / Dome */}
    <path
      d="M80 46C65 58 40 75 42 95H118C120 75 95 58 80 46Z"
      fill="url(#brassGrad)"
    />
    {/* Cap Pierced Filigree Holes */}
    <circle cx="80" cy="72" r="3" fill="#1C1917" />
    <circle cx="68" cy="80" r="2.5" fill="#1C1917" />
    <circle cx="92" cy="80" r="2.5" fill="#1C1917" />
    <circle cx="56" cy="88" r="2" fill="#1C1917" />
    <circle cx="104" cy="88" r="2" fill="#1C1917" />

    {/* Upper Molding Rim */}
    <rect x="36" y="94" width="88" height="8" rx="2" fill="url(#brassGrad)" />

    {/* Glass Chamber Background Glow */}
    <path d="M44 102H116L124 175H36L44 102Z" fill="#1C1917" fillOpacity="0.8" />
    <ellipse cx="80" cy="140" rx="38" ry="32" fill="url(#lanternFlameGlow)" />

    {/* Glowing Candle / Flame Core */}
    <path
      d="M80 120C77 128 73 134 74 142C75 148 78 152 80 152C82 152 85 148 86 142C87 134 83 128 80 120Z"
      fill="#FFFFFF"
    />

    {/* Glass Facet Dividers & Moorish Arched Ribs */}
    <path d="M44 102L36 175" stroke="url(#brassGrad)" strokeWidth="4.5" />
    <path d="M68 102L65 175" stroke="url(#brassGrad)" strokeWidth="3" />
    <path d="M92 102L95 175" stroke="url(#brassGrad)" strokeWidth="3" />
    <path d="M116 102L124 175" stroke="url(#brassGrad)" strokeWidth="4.5" />

    {/* Lower Molding Rim */}
    <rect x="32" y="174" width="96" height="10" rx="2" fill="url(#brassGrad)" />

    {/* Base Pedestal with Pierced Trefoils */}
    <path
      d="M36 184H124L130 205C130 215 110 220 80 220C50 220 30 215 30 205L36 184Z"
      fill="url(#brassGrad)"
    />
    {/* Drop Finial Pendant at Bottom */}
    <path d="M80 220V234" stroke="url(#brassGrad)" strokeWidth="4" strokeLinecap="round" />
    <circle cx="80" cy="236" r="3.5" fill="url(#brassGrad)" />
  </svg>
);

// 7. Stack of Antique Leather Books, Scrolls, Ink Bottle & Quill Feather
export const BooksFeatherInk = ({ className = '' }) => (
  <svg
    viewBox="0 0 340 220"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-full h-auto drop-shadow-[0_12px_28px_rgba(0,0,0,0.5)] ${className}`}
  >
    <defs>
      <linearGradient id="book1Spine" x1="20" y1="120" x2="20" y2="160" gradientUnits="userSpaceOnUse">
        <stop stopColor="#7C2D12" />
        <stop offset="0.5" stopColor="#9A3412" />
        <stop offset="1" stopColor="#431407" />
      </linearGradient>
      <linearGradient id="book2Spine" x1="40" y1="85" x2="40" y2="125" gradientUnits="userSpaceOnUse">
        <stop stopColor="#1E3A8A" />
        <stop offset="0.5" stopColor="#2563EB" />
        <stop offset="1" stopColor="#172554" />
      </linearGradient>
      <linearGradient id="parchmentScroll" x1="120" y1="150" x2="240" y2="200" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFBEB" />
        <stop offset="0.6" stopColor="#FEF3C7" />
        <stop offset="1" stopColor="#DEB887" />
      </linearGradient>
      <linearGradient id="inkGlass" x1="240" y1="120" x2="290" y2="190" gradientUnits="userSpaceOnUse">
        <stop stopColor="#0F172A" />
        <stop offset="0.5" stopColor="#1E293B" />
        <stop offset="1" stopColor="#020617" />
      </linearGradient>
    </defs>

    {/* Cast Shadow */}
    <ellipse cx="170" cy="205" rx="150" ry="14" fill="#020617" fillOpacity="0.4" />

    {/* Bottom Heavy Book (Burgundy Leather) */}
    <rect x="25" y="125" width="165" height="34" rx="4" fill="url(#book1Spine)" stroke="#B45309" strokeWidth="1" />
    <path d="M35 125V159M40 125V159M165 125V159" stroke="#FDE68A" strokeWidth="1.5" />
    {/* Gold Embossed Spine Star */}
    <polygon points="100,136 103,144 111,144 105,149 107,157 100,152 93,157 95,149 89,144 97,144" fill="#FDE68A" />

    {/* Top Book (Cobalt & Gilt) */}
    <g transform="rotate(-4 105 105)">
      <rect x="35" y="92" width="145" height="30" rx="3" fill="url(#book2Spine)" stroke="#93C5FD" strokeWidth="1" />
      <path d="M45 92V122M50 92V122M155 92V122" stroke="#FDE68A" strokeWidth="1.5" />
      <line x1="75" y1="107" x2="135" y2="107" stroke="#FDE68A" strokeWidth="2" strokeDasharray="3 3" />
    </g>

    {/* Curled Parchment Scroll in Front */}
    <path
      d="M50 168C90 162 170 160 215 166C225 168 230 178 226 186C222 194 212 198 198 198C150 198 80 196 42 192C32 190 28 180 32 172C36 166 44 168 50 168Z"
      fill="url(#parchmentScroll)"
      stroke="#B45309"
      strokeWidth="1.5"
    />
    <path d="M215 166C222 172 222 186 215 192C208 198 198 196 198 198" stroke="#78350F" strokeWidth="1.2" />

    {/* Ceramic / Glass Ink Bottle with Brass Stopper */}
    <rect x="236" y="145" width="48" height="48" rx="8" fill="url(#inkGlass)" stroke="#475569" strokeWidth="1.5" />
    <path d="M250 135H270V145H250V135Z" fill="#D97706" />
    <ellipse cx="260" cy="135" rx="10" ry="3" fill="#FDE68A" />
    {/* Ink Level Reflection */}
    <path d="M242 165C246 160 255 160 260 162C265 164 274 162 278 165V185H242V165Z" fill="#1E1B4B" />

    {/* Elegant White Goose Quill Feather dipping into Inkwell */}
    <g transform="rotate(-28 260 135)">
      {/* Quill Shaft / Spine */}
      <path d="M260 145C260 90 250 30 220 5" stroke="#F8FAFC" strokeWidth="2.5" strokeLinecap="round" />
      {/* Feather Vane (Left & Right Ribs) */}
      <path
        d="M220 5C235 25 252 55 258 90C250 85 240 75 230 55C224 40 220 20 220 5Z"
        fill="#F1F5F9"
        stroke="#E2E8F0"
        strokeWidth="1"
      />
      <path
        d="M220 5C215 28 222 65 248 105C255 95 258 75 252 50C245 30 230 15 220 5Z"
        fill="#FFFFFF"
        stroke="#E2E8F0"
        strokeWidth="1"
      />
      {/* Feather Barbs Detail */}
      <line x1="230" y1="35" x2="242" y2="42" stroke="#CBD5E1" strokeWidth="1" />
      <line x1="235" y1="55" x2="250" y2="65" stroke="#CBD5E1" strokeWidth="1" />
      <line x1="240" y1="75" x2="254" y2="88" stroke="#CBD5E1" strokeWidth="1" />
    </g>
  </svg>
);

// 8. Islamic Architectural Arch Frame Silhouette
export const IslamicArchway = ({ className = '', style = {} }) => (
  <svg
    viewBox="0 0 200 320"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-full h-auto opacity-40 pointer-events-none ${className}`}
    style={style}
  >
    <path
      d="M20 320V140C20 85 65 30 100 10C135 30 180 85 180 140V320"
      stroke="url(#archGoldGrad)"
      strokeWidth="3"
    />
    {/* Inner Multifoil Cusped Arches */}
    <path
      d="M32 320V150C32 120 45 105 55 95C65 85 85 70 100 45C115 70 135 85 145 95C155 105 168 120 168 150V320"
      stroke="url(#archGoldGrad)"
      strokeWidth="1.8"
      strokeDasharray="4 3"
    />
    <defs>
      <linearGradient id="archGoldGrad" x1="100" y1="10" x2="100" y2="320" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDE68A" />
        <stop offset="0.5" stopColor="#D97706" />
        <stop offset="1" stopColor="#78350F" stopOpacity="0.2" />
      </linearGradient>
    </defs>
  </svg>
);

// 9. Ornate Cusped Mihrab Dome Plaque Frame (For Statistics & Plaques)
export const OrnateArchPlaque = ({ children, className = '' }) => (
  <div className={`relative group ${className}`}>
    {/* Decorative Golden Outer Frame */}
    <div className="absolute inset-0 bg-gradient-to-b from-[#FDE68A]/50 via-[#F59E0B]/20 to-[#B45309]/40 rounded-t-[55px] rounded-b-2xl p-[2px] shadow-[0_12px_32px_rgba(0,0,0,0.35)] transition-transform duration-300 group-hover:scale-[1.02]">
      {/* Inner Cream Parchment Card */}
      <div className="w-full h-full bg-gradient-to-b from-[#FFFDF7] via-[#FFF9ED] to-[#FEF3C7] rounded-t-[53px] rounded-b-[14px] p-5 flex flex-col items-center justify-between border border-amber-200/60 shadow-inner">
        {children}
      </div>
    </div>
  </div>
);

// 10. Stat Illustration A: Candidates (Students Learning)
export const StatCandidatesArt = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="36" rx="34" ry="34" fill="#FEF3C7" />
    <g fill="#9A3412">
      {/* Central Scholar */}
      <circle cx="36" cy="24" r="7" />
      <path d="M24 48C24 40 29 35 36 35C43 35 48 40 48 48V54H24V48Z" />
      {/* Left Student */}
      <circle cx="20" cy="28" r="5" fill="#C2410C" />
      <path d="M11 50C11 44 15 39 20 39C25 39 29 44 29 50V54H11V50Z" fill="#C2410C" />
      {/* Right Student */}
      <circle cx="52" cy="28" r="5" fill="#C2410C" />
      <path d="M43 50C43 44 47 39 52 39C57 39 61 44 61 50V54H43V50Z" fill="#C2410C" />
    </g>
  </svg>
);

// 11. Stat Illustration B: Institutions (Madrasa / Palace Arch)
export const StatInstitutionsArt = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="36" rx="34" ry="34" fill="#FEF3C7" />
    <g fill="#B45309">
      {/* Central Grand Dome */}
      <path d="M26 34C26 25 31 18 36 14C41 18 46 25 46 34H26Z" />
      <rect x="22" y="34" width="28" height="22" rx="1" />
      <path d="M30 56V42C30 38 33 35 36 35C39 35 42 38 42 42V56H30Z" fill="#FEF3C7" />
      {/* Left Turret */}
      <rect x="14" y="26" width="6" height="30" rx="1" />
      <path d="M14 26C14 22 17 18 17 18C17 18 20 22 20 26H14Z" />
      {/* Right Turret */}
      <rect x="52" y="26" width="6" height="30" rx="1" />
      <path d="M52 26C52 22 55 18 55 18C55 18 58 22 58 26H52Z" />
    </g>
  </svg>
);

// 12. Stat Illustration C: Programs (Stack of Knowledge Books)
export const StatProgramsArt = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="36" rx="34" ry="34" fill="#FEF3C7" />
    <rect x="16" y="42" width="40" height="11" rx="2" fill="#B45309" stroke="#78350F" strokeWidth="1" />
    <rect x="18" y="30" width="36" height="10" rx="2" fill="#1E3A8A" stroke="#172554" strokeWidth="1" />
    <rect x="22" y="20" width="30" height="9" rx="2" fill="#B91C1C" stroke="#7F1D1D" strokeWidth="1" />
    {/* Hanging Bookmark Ribbon */}
    <path d="M42 20V34L45 31L48 34V20H42Z" fill="#F59E0B" />
  </svg>
);

// 13. Stat Illustration D: States / Regions (Celestial Astrolabe & Globe)
export const StatAstrolabeArt = ({ size = 64 }) => (
  <svg width={size} height={size} viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="36" cy="36" rx="34" ry="34" fill="#FEF3C7" />
    <circle cx="36" cy="32" r="16" stroke="#9A3412" strokeWidth="2.5" />
    <ellipse cx="36" cy="32" rx="16" ry="6" stroke="#B45309" strokeWidth="1.8" />
    <ellipse cx="36" cy="32" rx="6" ry="16" stroke="#B45309" strokeWidth="1.8" />
    {/* Stand and Base */}
    <path d="M36 48V56M26 56H46" stroke="#78350F" strokeWidth="3" strokeLinecap="round" />
    <circle cx="36" cy="14" r="3" stroke="#9A3412" strokeWidth="2" fill="none" />
  </svg>
);

// 14. Antique Brass & Glass Hourglass for Countdown
export const AntiqueHourglass = ({ className = '', size = 130 }) => (
  <svg
    width={size}
    height={size * 1.5}
    viewBox="0 0 120 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`drop-shadow-[0_15px_35px_rgba(245,158,11,0.35)] ${className}`}
  >
    <defs>
      <linearGradient id="brassFrame" x1="0" y1="0" x2="120" y2="180" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDE68A" />
        <stop offset="0.3" stopColor="#D97706" />
        <stop offset="0.7" stopColor="#B45309" />
        <stop offset="1" stopColor="#78350F" />
      </linearGradient>

      <linearGradient id="glassReflection" x1="30" y1="20" x2="90" y2="160" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFFFF" stopOpacity="0.4" />
        <stop offset="0.5" stopColor="#FED7AA" stopOpacity="0.1" />
        <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.3" />
      </linearGradient>

      <radialGradient id="sandGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stopColor="#FFFBEB" />
        <stop offset="50%" stopColor="#FDE68A" />
        <stop offset="100%" stopColor="#F59E0B" />
      </radialGradient>
    </defs>

    {/* Top Ornate Brass Plate */}
    <rect x="20" y="10" width="80" height="12" rx="4" fill="url(#brassFrame)" />
    <circle cx="60" cy="10" r="4" fill="url(#brassFrame)" />

    {/* Bottom Ornate Brass Plate */}
    <rect x="20" y="158" width="80" height="12" rx="4" fill="url(#brassFrame)" />
    <circle cx="60" cy="170" r="4" fill="url(#brassFrame)" />

    {/* Side Supporting Pillars */}
    <rect x="22" y="20" width="6" height="140" rx="2" fill="url(#brassFrame)" />
    <rect x="92" y="20" width="6" height="140" rx="2" fill="url(#brassFrame)" />

    {/* Hourglass Glass Bulb Enclosure */}
    <path
      d="M34 24H86C86 55 68 85 60 90C52 85 34 55 34 24Z"
      fill="url(#glassReflection)"
      stroke="#FED7AA"
      strokeWidth="1.5"
    />
    <path
      d="M34 156H86C86 125 68 95 60 90C52 95 34 125 34 156Z"
      fill="url(#glassReflection)"
      stroke="#FED7AA"
      strokeWidth="1.5"
    />

    {/* Sand in Upper Bulb (Trickling Down) */}
    <path d="M42 45H78C76 65 65 82 60 88C55 82 44 65 42 45Z" fill="url(#sandGlow)" />

    {/* Trickling Sand Stream */}
    <line x1="60" y1="88" x2="60" y2="148" stroke="#FDE68A" strokeWidth="2.5" strokeDasharray="3 2" />

    {/* Accumulating Sand Mound in Bottom Bulb */}
    <path
      d="M40 154C42 144 50 134 60 134C70 134 78 144 80 154H40Z"
      fill="url(#sandGlow)"
    />

    {/* Dynamic Sand Droplet Grains */}
    <circle cx="60" cy="98" r="1.5" fill="#FFFFFF" />
    <circle cx="60" cy="112" r="1.5" fill="#FFFFFF" />
    <circle cx="60" cy="126" r="1.5" fill="#FFFFFF" />
  </svg>
);

// 15. Explore Destination Card Artwork 1: Live Results Golden Trophy
export const ExploreTrophyArt = ({ size = 96 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="trophyGold" x1="0" y1="10" x2="100" y2="90" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFBEB" />
        <stop offset="0.3" stopColor="#FDE68A" />
        <stop offset="0.6" stopColor="#F59E0B" />
        <stop offset="1" stopColor="#B45309" />
      </linearGradient>
      <linearGradient id="ribbonMaroon" x1="10" y1="40" x2="90" y2="90" gradientUnits="userSpaceOnUse">
        <stop stopColor="#BE123C" />
        <stop offset="1" stopColor="#881337" />
      </linearGradient>
    </defs>
    {/* Flowing Victory Ribbons */}
    <path d="M28 50C15 60 10 75 14 85C20 82 25 74 30 65" stroke="url(#ribbonMaroon)" strokeWidth="6" strokeLinecap="round" />
    <path d="M72 50C85 60 90 75 86 85C80 82 75 74 70 65" stroke="url(#ribbonMaroon)" strokeWidth="6" strokeLinecap="round" />

    {/* Cup Handles */}
    <path d="M30 32C18 32 18 52 32 54" stroke="url(#trophyGold)" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M70 32C82 32 82 52 68 54" stroke="url(#trophyGold)" strokeWidth="4.5" strokeLinecap="round" />

    {/* Main Cup Body */}
    <path d="M28 24H72C72 46 62 60 50 64C38 60 28 46 28 24Z" fill="url(#trophyGold)" />
    <ellipse cx="50" cy="24" rx="22" ry="4" fill="#FFFBEB" />

    {/* Cup Stem & Ornate Ring */}
    <rect x="46" y="64" width="8" height="14" fill="url(#trophyGold)" />
    <circle cx="50" cy="71" r="5" fill="#FDE68A" />

    {/* Stepped Pedestal Base */}
    <path d="M38 78H62L66 88H34L38 78Z" fill="url(#trophyGold)" />
    <rect x="30" y="88" width="40" height="6" rx="2" fill="#78350F" />
  </svg>
);

export const IllustratedTrophy = ExploreTrophyArt;

// 16. Explore Destination Card Artwork 2: Team Points Flag on Mountain
export const ExploreFlagArt = ({ size = 96 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="flagMountain" x1="50" y1="50" x2="50" y2="95" gradientUnits="userSpaceOnUse">
        <stop stopColor="#D97706" />
        <stop offset="0.5" stopColor="#B45309" />
        <stop offset="1" stopColor="#451A03" />
      </linearGradient>
      <linearGradient id="bannerGold" x1="35" y1="20" x2="85" y2="45" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F59E0B" />
        <stop offset="0.6" stopColor="#EA580C" />
        <stop offset="1" stopColor="#DC2626" />
      </linearGradient>
    </defs>
    {/* Mountain Ridge */}
    <path d="M10 92L38 60L52 70L75 52L95 92H10Z" fill="url(#flagMountain)" />
    <path d="M38 60L52 70L75 52L85 92H50L38 60Z" fill="#78350F" />

    {/* Golden Flagpole */}
    <line x1="38" y1="18" x2="38" y2="70" stroke="#FDE68A" strokeWidth="3" strokeLinecap="round" />
    <circle cx="38" cy="18" r="3" fill="#FDE68A" />

    {/* Fluttering Triangular / Swallowtail Banner */}
    <path
      d="M38 22L84 32C76 38 76 40 84 46L38 48V22Z"
      fill="url(#bannerGold)"
      stroke="#FEF08A"
      strokeWidth="1"
    />
    {/* Emblem Star on Banner */}
    <polygon points="54,32 55,35 58,35 56,37 57,40 54,38 51,40 52,37 50,35 53,35" fill="#FEF08A" />
  </svg>
);

// 17. Explore Destination Card Artwork 3: Event Schedule Desk Calendar & Pocket Watch
export const ExploreCalendarArt = ({ size = 96 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="calPages" x1="20" y1="30" x2="70" y2="85" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFBEB" />
        <stop offset="1" stopColor="#FEF3C7" />
      </linearGradient>
      <linearGradient id="goldWatch" x1="55" y1="55" x2="90" y2="90" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FDE68A" />
        <stop offset="0.5" stopColor="#D97706" />
        <stop offset="1" stopColor="#78350F" />
      </linearGradient>
    </defs>
    {/* Standing Desk Calendar */}
    <rect x="18" y="32" width="56" height="52" rx="4" fill="url(#calPages)" stroke="#B45309" strokeWidth="1.5" />
    <path d="M18 32H74V44H18V32Z" fill="#DC2626" />
    {/* Binder Rings */}
    <rect x="28" y="27" width="5" height="9" rx="2" fill="#78350F" />
    <rect x="44" y="27" width="5" height="9" rx="2" fill="#78350F" />
    <rect x="60" y="27" width="5" height="9" rx="2" fill="#78350F" />
    {/* Calendar Number Matrix Lines */}
    <rect x="26" y="52" width="6" height="6" rx="1" fill="#D97706" />
    <rect x="36" y="52" width="6" height="6" rx="1" fill="#B45309" />
    <rect x="46" y="52" width="6" height="6" rx="1" fill="#D97706" />
    <rect x="56" y="52" width="6" height="6" rx="1" fill="#B45309" />
    <rect x="26" y="64" width="6" height="6" rx="1" fill="#B45309" />
    <rect x="36" y="64" width="6" height="6" rx="1" fill="#B91C1C" />
    <rect x="46" y="64" width="6" height="6" rx="1" fill="#D97706" />

    {/* Antique Pocket Watch in Foreground */}
    <circle cx="72" cy="72" r="16" fill="#FFFBEB" stroke="url(#goldWatch)" strokeWidth="3" />
    <circle cx="72" cy="72" r="13" stroke="#D97706" strokeWidth="1" strokeDasharray="2 2" />
    {/* Watch Hands pointing to 10:10 */}
    <line x1="72" y1="72" x2="68" y2="65" stroke="#78350F" strokeWidth="1.8" strokeLinecap="round" />
    <line x1="72" y1="72" x2="78" y2="66" stroke="#78350F" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="72" cy="72" r="1.5" fill="#451A03" />
    <circle cx="72" cy="54" r="3" stroke="url(#goldWatch)" strokeWidth="1.5" fill="none" />
  </svg>
);

// 18. Explore Destination Card Artwork 4: Candidate Digital Badge & QR Card
export const ExploreBadgeArt = ({ size = 96 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="badgePaper" x1="20" y1="20" x2="80" y2="85" gradientUnits="userSpaceOnUse">
        <stop stopColor="#FFFDF7" />
        <stop offset="1" stopColor="#FEF3C7" />
      </linearGradient>
    </defs>
    {/* Lanyard Strap Loop at Top */}
    <path d="M50 10L42 24H58L50 10Z" fill="#3B82F6" stroke="#1D4ED8" strokeWidth="1" />
    {/* Brass Badge Clip */}
    <rect x="46" y="22" width="8" height="6" rx="1.5" fill="#F59E0B" />

    {/* Suspended ID Badge Card */}
    <rect x="22" y="27" width="56" height="65" rx="5" fill="url(#badgePaper)" stroke="#D97706" strokeWidth="1.5" />
    <rect x="26" y="32" width="48" height="10" rx="2" fill="#1E1B4B" />
    <line x1="30" y1="37" x2="48" y2="37" stroke="#FEF08A" strokeWidth="1.5" />

    {/* Scannable High-contrast QR Code Pattern on Card */}
    <rect x="34" y="48" width="32" height="32" rx="3" fill="#FFFFFF" stroke="#0F172A" strokeWidth="1" />
    {/* QR Corner Markers */}
    <rect x="37" y="51" width="9" height="9" fill="#0F172A" />
    <rect x="39" y="53" width="5" height="5" fill="#FFFFFF" />
    <rect x="40" y="54" width="3" height="3" fill="#0F172A" />

    <rect x="54" y="51" width="9" height="9" fill="#0F172A" />
    <rect x="56" y="53" width="5" height="5" fill="#FFFFFF" />
    <rect x="57" y="54" width="3" height="3" fill="#0F172A" />

    <rect x="37" y="68" width="9" height="9" fill="#0F172A" />
    <rect x="39" y="70" width="5" height="5" fill="#FFFFFF" />
    <rect x="40" y="71" width="3" height="3" fill="#0F172A" />

    {/* Data Bits */}
    <rect x="49" y="54" width="2" height="2" fill="#0F172A" />
    <rect x="51" y="58" width="2" height="2" fill="#0F172A" />
    <rect x="49" y="68" width="2" height="2" fill="#0F172A" />
    <rect x="55" y="66" width="4" height="2" fill="#0F172A" />
  </svg>
);

// 19. Islamic City Skyline at Sunset (Footer Landscape)
export const SunsetSkylineFooter = ({ className = '' }) => (
  <svg
    viewBox="0 0 1200 240"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`w-full h-auto pointer-events-none ${className}`}
  >
    <defs>
      <linearGradient id="footerSkyGrad" x1="600" y1="0" x2="600" y2="240" gradientUnits="userSpaceOnUse">
        <stop stopColor="#F97316" stopOpacity="0.45" />
        <stop offset="0.4" stopColor="#C026D3" stopOpacity="0.35" />
        <stop offset="0.8" stopColor="#4338CA" stopOpacity="0.5" />
        <stop offset="1" stopColor="#1E1B4B" />
      </linearGradient>

      <linearGradient id="footerCitySilhouette" x1="600" y1="60" x2="600" y2="240" gradientUnits="userSpaceOnUse">
        <stop stopColor="#312E81" />
        <stop offset="0.7" stopColor="#1E1B4B" />
        <stop offset="1" stopColor="#0F172A" />
      </linearGradient>
    </defs>

    {/* Sunset Sky Background */}
    <rect width="1200" height="240" fill="url(#footerSkyGrad)" />

    {/* Distant Mountain Silhouettes */}
    <path
      d="M0 160L120 125L260 145L400 110L560 140L720 100L900 135L1080 115L1200 140V240H0V160Z"
      fill="#4338CA"
      fillOpacity="0.35"
    />

    {/* Foreground Mosque & Minaret Skylines */}
    {/* Left Complex */}
    <path
      d="M40 240V160C40 145 55 130 70 120C85 130 100 145 100 160V240H40Z"
      fill="url(#footerCitySilhouette)"
    />
    <rect x="25" y="100" width="8" height="140" fill="url(#footerCitySilhouette)" />
    <path d="M25 100C25 90 29 80 29 80C29 80 33 90 33 100H25Z" fill="url(#footerCitySilhouette)" />

    {/* Center Left Domes */}
    <path
      d="M180 240V175C180 160 195 145 210 135C225 145 240 160 240 175V240H180Z"
      fill="url(#footerCitySilhouette)"
    />

    {/* Far Right Grand Complex */}
    <path
      d="M1020 240V150C1020 130 1045 110 1070 95C1095 110 1120 130 1120 150V240H1020Z"
      fill="url(#footerCitySilhouette)"
    />
    <rect x="1140" y="80" width="10" height="160" fill="url(#footerCitySilhouette)" />
    <path d="M1140 80C1140 68 1145 55 1145 55C1145 55 1150 68 1150 80H1140Z" fill="url(#footerCitySilhouette)" />

    <rect x="990" y="110" width="8" height="130" fill="url(#footerCitySilhouette)" />
    <path d="M990 110C990 100 994 90 994 90C994 90 998 100 998 110H990Z" fill="url(#footerCitySilhouette)" />

    {/* Continuous Horizon Base Wall */}
    <rect x="0" y="210" width="1200" height="30" fill="#0F172A" />
  </svg>
);
