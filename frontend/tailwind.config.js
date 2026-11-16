/** @type {import('tailwindcss').Config} */

function withOpacity(varName, fallback) {
  return ({ opacityValue }) => {
    if (opacityValue !== undefined) {
      return `color-mix(in srgb, var(${varName}, ${fallback}) calc(${opacityValue} * 100%), transparent)`;
    }
    return `var(${varName}, ${fallback})`;
  };
}

module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: withOpacity('--primary', '#6366f1'),
          foreground: withOpacity('--primary-foreground', '#ffffff'),
          50: '#eef2ff',
          100: '#e0e7ff',
          500: '#6366f1',
          600: '#4f46e5',
          700: '#4338ca',
        },
        secondary: {
          DEFAULT: withOpacity('--secondary', '#64748b'),
          foreground: withOpacity('--secondary-foreground', '#ffffff'),
          50: '#f8fafc',
          100: '#f1f5f9',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
        },
        background: withOpacity('--background', '#090817'),
        foreground: withOpacity('--foreground', '#FDFBF7'),
        card: {
          DEFAULT: withOpacity('--card', '#FDFBF7'),
          foreground: withOpacity('--card-foreground', '#1E1B4B'),
        },
        popover: {
          DEFAULT: withOpacity('--popover', '#FDFBF7'),
          foreground: withOpacity('--popover-foreground', '#1E1B4B'),
        },
        muted: {
          DEFAULT: withOpacity('--muted', '#332B5E'),
          foreground: withOpacity('--muted-foreground', '#A5B4FC'),
        },
        accent: {
          DEFAULT: withOpacity('--accent', '#F59E0B'),
          foreground: withOpacity('--accent-foreground', '#090817'),
        },
        destructive: {
          DEFAULT: withOpacity('--destructive', '#EF4444'),
          foreground: withOpacity('--destructive-foreground', '#FFFFFF'),
        },
        border: withOpacity('--border', 'rgba(245, 158, 11, 0.35)'),
        input: withOpacity('--input', 'rgba(245, 158, 11, 0.35)'),
        ring: withOpacity('--ring', '#F59E0B'),
        parchment: {
          DEFAULT: withOpacity('--parchment', '#FDFBF7'),
          deep: withOpacity('--parchment-deep', '#F5EEDB'),
        },
        ink: {
          DEFAULT: withOpacity('--ink', '#1E1B4B'),
          soft: withOpacity('--ink-soft', '#4338CA'),
        },
        night: {
          DEFAULT: withOpacity('--night', '#090817'),
          deep: withOpacity('--night-deep', '#05040F'),
        },
        gold: withOpacity('--gold', '#F59E0B'),
        glow: withOpacity('--glow', '#FDE68A'),
        pop: {
          DEFAULT: withOpacity('--pop', '#E53935'),
          2: withOpacity('--pop-2', '#D8D8D8'),
          3: withOpacity('--pop-3', '#F5F5F2'),
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Cinzel', 'Georgia', 'serif'],
        editorial: ['"Playfair Display"', 'Georgia', 'serif'],
        'sans-dm': ['"DM Sans"', 'sans-serif'],
        script: ['"Great Vibes"', 'cursive'],
        serif: ['"Cormorant Garamond"', 'Georgia', 'serif'],
        swiss: ['Inter', '"Helvetica Neue"', 'Helvetica', 'Arial', 'sans-serif'],
        grotesk: ['"Space Grotesk"', 'sans-serif'],
        archivo: ['"Archivo Black"', 'sans-serif'],
        anton: ['Anton', 'sans-serif'],
        bebas: ['"Bebas Neue"', 'sans-serif'],
        fraunces: ['Fraunces', 'serif'],
        oswald: ['Oswald', 'sans-serif'],
        baskerville: ['"Libre Baskerville"', 'serif'],
        fredoka: ['Fredoka', 'sans-serif'],
        'retro-script': ['Pacifico', 'cursive'],
      },
      animation: {
        flicker: 'flicker 2.6s ease-in-out infinite',
        twinkle: 'twinkle 3s ease-in-out infinite',
        drift: 'drift 14s ease-in-out infinite',
        shoot: 'shoot 9s ease-out infinite',
        shimmer: 'shimmer 5s ease-in-out infinite',
        rise: 'rise 1.2s ease-out both',
        marquee: 'marquee 28s linear infinite',
        'clip-up': 'clip-up .9s cubic-bezier(.2,.7,.1,1) both',
        stamp: 'stamp .7s cubic-bezier(.3,1.4,.5,1) both',
        'flip-in': 'flip-in .45s ease-out both',
        'spin-slow': 'spin-slow 40s linear infinite',
        bob: 'bob 4s ease-in-out infinite',
        wobble: 'wobble 5s ease-in-out infinite',
        ember: 'ember 12s linear infinite',
        'wave-slow': 'wave-slow 12s ease-in-out infinite',
        'float-slow': 'float-slow 7s ease-in-out infinite',
      },
      keyframes: {
        flicker: {
          '0%, 100%': { opacity: '0.85', transform: 'scale(1)' },
          '20%': { opacity: '1', transform: 'scale(1.06)' },
          '45%': { opacity: '0.7', transform: 'scale(0.97)' },
          '70%': { opacity: '0.95', transform: 'scale(1.03)' },
        },
        twinkle: {
          '0%, 100%': { opacity: '0.15', transform: 'scale(0.7)' },
          '50%': { opacity: '1', transform: 'scale(1.1)' },
        },
        drift: {
          '0%, 100%': { transform: 'translate3d(0,0,0) rotate(-4deg)' },
          '50%': { transform: 'translate3d(3%,-4%,0) rotate(-1deg)' },
        },
        shoot: {
          '0%': { transform: 'translate(0,0) rotate(-25deg)', opacity: '0' },
          '5%': { opacity: '1' },
          '18%': { transform: 'translate(-40vw,18vw) rotate(-25deg)', opacity: '0' },
          '100%': { opacity: '0', transform: 'translate(-40vw,18vw) rotate(-25deg)' },
        },
        shimmer: {
          '0%, 100%': { transform: 'scaleY(-1) translateX(0)', opacity: '0.35' },
          '50%': { transform: 'scaleY(-1) translateX(6px)', opacity: '0.5' },
        },
        rise: {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'none' },
        },
        marquee: {
          from: { transform: 'translateX(0)' },
          to: { transform: 'translateX(-50%)' },
        },
        'clip-up': {
          from: { clipPath: 'inset(100% 0 0 0)', transform: 'translateY(30%)' },
          to: { clipPath: 'inset(0 0 0 0)', transform: 'none' },
        },
        stamp: {
          '0%': { transform: 'scale(1.6) rotate(-14deg)', opacity: '0' },
          '60%': { transform: 'scale(0.92) rotate(-8deg)', opacity: '1' },
          '100%': { transform: 'scale(1) rotate(-8deg)', opacity: '1' },
        },
        'flip-in': {
          from: { transform: 'rotateX(90deg)' },
          to: { transform: 'rotateX(0)' },
        },
        'spin-slow': {
          to: { transform: 'rotate(360deg)' },
        },
        bob: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wobble: {
          '0%, 100%': { transform: 'rotate(-2deg)' },
          '50%': { transform: 'rotate(2deg)' },
        },
        ember: {
          '0%': { transform: 'translateY(0)', opacity: '0' },
          '15%': { opacity: '0.9' },
          '100%': { transform: 'translateY(-90vh) translateX(30px)', opacity: '0' },
        },
        'wave-slow': {
          '0%, 100%': { transform: 'translateX(0)' },
          '50%': { transform: 'translateX(-40px)' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
};
