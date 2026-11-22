import React, { useState, useEffect, useRef } from 'react';
import { 
  Upload, 
  Save, 
  Check, 
  Layers, 
  User, 
  Plus, 
  Sparkles, 
  Eye, 
  X, 
  AlignLeft, 
  AlignCenter, 
  AlignRight, 
  Type, 
  Download,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Trophy,
  Medal,
  Award,
  Hash,
  GripVertical,
  Flag,
  Calendar,
  Image as ImageIcon,
  MoveHorizontal,
  ChevronDown,
  Loader2,
  Shuffle
} from 'lucide-react';
import { eventCertificatesAPI } from '../../services/api';

export const POSTER_SLOTS = [
  { id: 'result_poster', label: 'Poster 1', num: 1 },
  { id: 'result_poster_2', label: 'Poster 2', num: 2 },
  { id: 'result_poster_3', label: 'Poster 3', num: 3 },
  { id: 'result_poster_4', label: 'Poster 4', num: 4 },
  { id: 'result_poster_5', label: 'Poster 5', num: 5 },
];

const OTHER_CERTIFICATE_TYPES = [
  { id: 'first_place', title: '1st Place Certificate', subtitle: 'Coming Soon', defaultStatus: 'Missing', comingSoon: true },
  { id: 'second_place', title: '2nd Place Certificate', subtitle: 'Coming Soon', defaultStatus: 'Missing', comingSoon: true },
  { id: 'third_place', title: '3rd Place Certificate', subtitle: 'Coming Soon', defaultStatus: 'Missing', comingSoon: true },
  { id: 'participation', title: 'Participation Certificate', subtitle: 'Coming Soon', defaultStatus: 'Missing', comingSoon: true },
  { id: 'badge', title: 'Participant ID Badge', subtitle: 'Coming Soon', defaultStatus: 'Missing', comingSoon: true },
  { id: 'common_prize', title: 'Common Prize Certificate', subtitle: 'Coming Soon', defaultStatus: 'Missing', comingSoon: true },
  { id: 'grade_certificate', title: 'Grade Certificate', subtitle: 'Coming Soon', defaultStatus: 'Missing', comingSoon: true }
];

const TEMPLATE_TYPES = [
  ...POSTER_SLOTS.map(p => ({ id: p.id, title: p.label, subtitle: 'Program result poster design', defaultStatus: 'Missing' })),
  ...OTHER_CERTIFICATE_TYPES
];

export const FONT_OPTIONS = [
  // ── Luxury & Formal Serifs ──────────────────────────
  { category: 'Serif & Luxury', label: 'Cinzel (Royal & Imperial)', value: 'cinzel', css: "'Cinzel', serif" },
  { category: 'Serif & Luxury', label: 'Playfair Display (Editorial Serif)', value: 'playfair', css: "'Playfair Display', serif" },
  { category: 'Serif & Luxury', label: 'Cormorant Garamond (Classic Prestigious)', value: 'cormorant', css: "'Cormorant Garamond', serif" },
  { category: 'Serif & Luxury', label: 'Libre Baskerville (Official Document)', value: 'libre_baskerville', css: "'Libre Baskerville', serif" },
  { category: 'Serif & Luxury', label: 'Merriweather (Refined Editorial)', value: 'merriweather', css: "'Merriweather', serif" },
  { category: 'Serif & Luxury', label: 'Lora (Contemporary Calligraphic)', value: 'lora', css: "'Lora', serif" },
  { category: 'Serif & Luxury', label: 'Fraunces (Vintage Display)', value: 'fraunces', css: "'Fraunces', serif" },
  { category: 'Serif & Luxury', label: 'Abril Fatface (Bold Headline Serif)', value: 'abril_fatface', css: "'Abril Fatface', cursive, serif" },
  { category: 'Serif & Luxury', label: 'Times New Roman (Standard Formal)', value: 'times', css: "'Times New Roman', Times, serif" },

  // ── Modern & Poster Sans-Serif ──────────────────────
  { category: 'Modern & Poster Sans', label: 'Montserrat (Modern Bold)', value: 'montserrat', css: "'Montserrat', sans-serif" },
  { category: 'Modern & Poster Sans', label: 'Poppins (Geometric Clean)', value: 'poppins', css: "'Poppins', sans-serif" },
  { category: 'Modern & Poster Sans', label: 'Oswald (Tall Poster Display)', value: 'oswald', css: "'Oswald', sans-serif" },
  { category: 'Modern & Poster Sans', label: 'Bebas Neue (Heavy Headline)', value: 'bebas_neue', css: "'Bebas Neue', sans-serif" },
  { category: 'Modern & Poster Sans', label: 'Anton (Ultra Impact)', value: 'anton', css: "'Anton', sans-serif" },
  { category: 'Modern & Poster Sans', label: 'Archivo Black (Solid Block)', value: 'archivo_black', css: "'Archivo Black', sans-serif" },
  { category: 'Modern & Poster Sans', label: 'Inter (High Legibility)', value: 'inter', css: "'Inter', sans-serif" },
  { category: 'Modern & Poster Sans', label: 'Plus Jakarta Sans (Crisp Clean)', value: 'plus_jakarta', css: "'Plus Jakarta Sans', sans-serif" },
  { category: 'Modern & Poster Sans', label: 'DM Sans (Minimalist Display)', value: 'dm_sans', css: "'DM Sans', sans-serif" },
  { category: 'Modern & Poster Sans', label: 'Space Grotesk (Tech Modern)', value: 'space_grotesk', css: "'Space Grotesk', sans-serif" },
  { category: 'Modern & Poster Sans', label: 'Fredoka (Soft & Rounded)', value: 'fredoka', css: "'Fredoka', cursive, sans-serif" },
  { category: 'Modern & Poster Sans', label: 'Helvetica / Arial (Neutral Swiss)', value: 'helvetica', css: 'Helvetica, Arial, sans-serif' },

  // ── Calligraphy & Handwritten ───────────────────────
  { category: 'Script & Calligraphy', label: 'Great Vibes (Royal Script)', value: 'great_vibes', css: "'Great Vibes', cursive" },
  { category: 'Script & Calligraphy', label: 'Alex Brush (Fluid Calligraphy)', value: 'alex_brush', css: "'Alex Brush', cursive" },
  { category: 'Script & Calligraphy', label: 'Dancing Script (Playful Script)', value: 'dancing_script', css: "'Dancing Script', cursive" },
  { category: 'Script & Calligraphy', label: 'Pacifico (Retro Brush Script)', value: 'pacifico', css: "'Pacifico', cursive" },
  { category: 'Script & Calligraphy', label: 'Caveat (Casual Signature)', value: 'caveat', css: "'Caveat', cursive" },
  { category: 'Script & Calligraphy', label: 'Satisfy (Smooth Signature)', value: 'satisfy', css: "'Satisfy', cursive" },
  { category: 'Script & Calligraphy', label: 'Lobster (Bold Decorative Script)', value: 'lobster', css: "'Lobster', cursive" },
  { category: 'Script & Calligraphy', label: 'Zapf Chancery (Chancery Script)', value: 'zapf', css: "'Zapf Chancery', cursive" },

  // ── Monospaced & Code ───────────────────────────────
  { category: 'Monospaced', label: 'Space Mono (Technical Monospace)', value: 'space_mono', css: "'Space Mono', monospace" },
  { category: 'Monospaced', label: 'Courier New (Typewriter Classic)', value: 'courier', css: "'Courier New', Courier, monospace" }
];

const ASPECT_RATIO_PRESETS = [
  { label: '3:4 Poster', value: 0.75, desc: 'Portrait Event Poster' },
  { label: '9:16 Story', value: 0.5625, desc: 'WhatsApp & Instagram Story' },
  { label: '4:5 Social', value: 0.8, desc: 'Instagram Portrait' },
  { label: '1:1 Square', value: 1.0, desc: 'Square Post / DP' },
  { label: '4:3 Certificate', value: 1.333, desc: 'Landscape Certificate' },
  { label: 'A4 Landscape', value: 1.414, desc: 'Standard Landscape Print' },
  { label: 'A4 Portrait', value: 0.707, desc: 'Standard Portrait Print' },
];

const COLOR_SWATCHES = [
  { label: 'Pure Black', value: '#000000' },
  { label: 'Pure White', value: '#FFFFFF' },
  { label: 'Amber Gold', value: '#D97706' },
  { label: 'Warm Bronze', value: '#B45309' },
  { label: 'Royal Indigo', value: '#4338CA' },
  { label: 'Navy Blue', value: '#1E3A8A' },
  { label: 'Emerald Green', value: '#059669' },
  { label: 'Crimson Red', value: '#DC2626' },
  { label: 'Dark Slate', value: '#1E293B' },
  { label: 'Muted Gray', value: '#64748B' },
];

const SHADOW_PRESETS = [
  { label: 'None', value: 'none', css: 'none' },
  { label: 'Soft Shadow', value: 'soft', css: '1px 2px 4px rgba(0,0,0,0.45)' },
  { label: 'Strong Drop', value: 'strong', css: '2px 4px 10px rgba(0,0,0,0.85)' },
  { label: 'White Glow', value: 'glow', css: '0 0 8px rgba(255,255,255,0.9), 0 0 16px rgba(255,255,255,0.6)' },
  { label: 'Dark Outline', value: 'outline_dark', css: '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000' },
  { label: 'White Outline', value: 'outline_light', css: '-1px -1px 0 #fff, 1px -1px 0 #fff, -1px 1px 0 #fff, 1px 1px 0 #fff' },
];

const BADGE_PRESETS = [
  { label: 'None', value: 'none', className: '' },
  { label: 'Dark Glass Pill', value: 'dark_pill', className: 'bg-black/70 text-white rounded-full px-3 py-0.5 backdrop-blur-xs' },
  { label: 'White Crisp Pill', value: 'white_pill', className: 'bg-white/90 text-slate-900 rounded-full px-3 py-0.5 shadow-sm border border-slate-200/60' },
  { label: 'Amber Gold Badge', value: 'amber_badge', className: 'bg-amber-600/90 text-white rounded-full px-3 py-0.5 shadow-sm' },
  { label: 'Indigo Pill', value: 'indigo_pill', className: 'bg-indigo-600/90 text-white rounded-full px-3 py-0.5 shadow-sm' },
];

const certificateFontCss = (fontKey) => (
  FONT_OPTIONS.find(option => option.value === fontKey)?.css || FONT_OPTIONS[0].css
);

const certificateTransform = (alignment = 'center') => {
  if (alignment === 'left') return 'translate(0, -50%)';
  if (alignment === 'right') return 'translate(-100%, -50%)';
  return 'translate(-50%, -50%)';
};

const POSTER_INITIAL_FIELDS = {
  // Program & Header Info
  resultNo: { id: 'resultNo', label: 'Result Number', sample: 'RESULT NO. 01', x: 50, y: 12, fontSize: 26, color: '#0F172A', fontFamily: 'anton', textAlign: 'center', bold: true, letterSpacing: 2, uppercase: true, enabled: false },
  programName: { id: 'programName', label: 'Program Name', sample: 'English Elocution', x: 50, y: 19, fontSize: 22, color: '#4338CA', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  programCode: { id: 'programCode', label: 'Program Code / No', sample: 'Item #104', x: 50, y: 25, fontSize: 13, color: '#6366F1', fontFamily: 'poppins', textAlign: 'center', bold: true, letterSpacing: 1, uppercase: true, enabled: false },
  category: { id: 'category', label: 'Category / Section', sample: 'Senior Category • Stage 01', x: 50, y: 26, fontSize: 13, color: '#64748B', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 1, uppercase: true, enabled: false },
  
  // 1st Place Winner (Separated Elements)
  firstPlaceLabel: { id: 'firstPlaceLabel', label: '1st Place Badge', sample: '🥇 1st Place', x: 50, y: 35, fontSize: 13, color: '#B45309', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 1, uppercase: true, enabled: false },
  firstPlaceName: { id: 'firstPlaceName', label: '1st Place Participant Name', sample: 'Muhammed Nihal', x: 50, y: 40, fontSize: 18, color: '#0F172A', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  firstPlaceChest: { id: 'firstPlaceChest', label: '1st Place Chest No', sample: 'Chest No: 4003', x: 50, y: 45, fontSize: 13, color: '#4338CA', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  firstPlaceTeam: { id: 'firstPlaceTeam', label: '1st Place Team', sample: 'Team Falcon', x: 50, y: 49, fontSize: 12, color: '#64748B', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: false },
  firstPlaceName2: { id: 'firstPlaceName2', label: '1st Place Joint Winner 2', sample: 'Fathima Zahra', x: 50, y: 52, fontSize: 17, color: '#0F172A', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  firstPlaceChest2: { id: 'firstPlaceChest2', label: '1st Place Joint Chest 2', sample: 'Chest No: 4009', x: 50, y: 56, fontSize: 13, color: '#4338CA', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  firstPlaceTeam2: { id: 'firstPlaceTeam2', label: '1st Place Joint Team 2', sample: 'Team Phoenix', x: 50, y: 60, fontSize: 12, color: '#64748B', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: false },

  // 2nd Place Winner (Separated Elements)
  secondPlaceLabel: { id: 'secondPlaceLabel', label: '2nd Place Badge', sample: '🥈 2nd Place', x: 50, y: 55, fontSize: 13, color: '#475569', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 1, uppercase: true, enabled: false },
  secondPlaceName: { id: 'secondPlaceName', label: '2nd Place Participant Name', sample: 'Ayisha Rida', x: 50, y: 59, fontSize: 16, color: '#1E293B', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  secondPlaceChest: { id: 'secondPlaceChest', label: '2nd Place Chest No', sample: 'Chest No: 4012', x: 50, y: 63, fontSize: 13, color: '#4338CA', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  secondPlaceTeam: { id: 'secondPlaceTeam', label: '2nd Place Team', sample: 'Team Phoenix', x: 50, y: 67, fontSize: 12, color: '#64748B', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: false },
  secondPlaceName2: { id: 'secondPlaceName2', label: '2nd Place Joint Winner 2', sample: 'Nafih Razak', x: 50, y: 70, fontSize: 15, color: '#1E293B', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  secondPlaceChest2: { id: 'secondPlaceChest2', label: '2nd Place Joint Chest 2', sample: 'Chest No: 4018', x: 50, y: 73, fontSize: 12, color: '#4338CA', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  secondPlaceTeam2: { id: 'secondPlaceTeam2', label: '2nd Place Joint Team 2', sample: 'Team Falcon', x: 50, y: 75, fontSize: 11, color: '#64748B', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: false },

  // 3rd Place Winner (Separated Elements)
  thirdPlaceLabel: { id: 'thirdPlaceLabel', label: '3rd Place Badge', sample: '🥉 3rd Place', x: 50, y: 73, fontSize: 13, color: '#78350F', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 1, uppercase: true, enabled: false },
  thirdPlaceName: { id: 'thirdPlaceName', label: '3rd Place Participant Name', sample: 'Salman Faris', x: 50, y: 77, fontSize: 15, color: '#334155', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  thirdPlaceChest: { id: 'thirdPlaceChest', label: '3rd Place Chest No', sample: 'Chest No: 4025', x: 50, y: 81, fontSize: 13, color: '#4338CA', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  thirdPlaceTeam: { id: 'thirdPlaceTeam', label: '3rd Place Team', sample: 'Team Griffin', x: 50, y: 85, fontSize: 12, color: '#64748B', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: false },
  thirdPlaceName2: { id: 'thirdPlaceName2', label: '3rd Place Joint Winner 2', sample: 'Danish Ali', x: 50, y: 87, fontSize: 14, color: '#334155', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  thirdPlaceChest2: { id: 'thirdPlaceChest2', label: '3rd Place Joint Chest 2', sample: 'Chest No: 4031', x: 50, y: 90, fontSize: 12, color: '#4338CA', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  thirdPlaceTeam2: { id: 'thirdPlaceTeam2', label: '3rd Place Joint Team 2', sample: 'Team Vortex', x: 50, y: 92, fontSize: 11, color: '#64748B', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: false },

  // General & Footer Details
  grade: { id: 'grade', label: 'Grade / Score', sample: 'Top Grade: A+ | Score: 98/100', x: 50, y: 31, fontSize: 12, color: '#059669', fontFamily: 'poppins', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  customText1: { id: 'customText1', label: 'Congratulatory Note', sample: 'Congratulations to all brilliant winners & participants!', x: 50, y: 89, fontSize: 12, color: '#4338CA', fontFamily: 'dancing_script', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  eventName: { id: 'eventName', label: 'Event / Fest Title', sample: 'School Arts & Cultural Fest 2026', x: 50, y: 92, fontSize: 14, color: '#0F172A', fontFamily: 'cinzel', textAlign: 'center', bold: true, letterSpacing: 1, uppercase: true, enabled: false },
  dateVenue: { id: 'dateVenue', label: 'Date & Venue', sample: 'Main Stage • 22 Nov 2026', x: 50, y: 96, fontSize: 11, color: '#64748B', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: false }
};

const INITIAL_FIELDS = {
  participantName: { id: 'participantName', label: 'Participant Name', sample: 'Ayisha Amna', x: 42, y: 60, fontSize: 22, color: '#000000', fontFamily: 'cinzel', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: true },
  chestNo: { id: 'chestNo', label: 'Participant ID / Chest No', sample: 'Chest No: 4003', x: 42, y: 68, fontSize: 16, color: '#1E40AF', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: true },
  category: { id: 'category', label: 'Category', sample: 'Higher Secondary', x: 42, y: 75, fontSize: 14, color: '#374151', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: true },
  teamName: { id: 'teamName', label: 'Team', sample: 'Palakkutty Unit', x: 42, y: 82, fontSize: 14, color: '#374151', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: true },
  eventName: { id: 'eventName', label: 'Event Name', sample: 'School Arts Festival', x: 42, y: 88, fontSize: 14, color: '#1F2937', fontFamily: 'cinzel', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  programName: { id: 'programName', label: 'Program Name', sample: 'Solo Song', x: 42, y: 92, fontSize: 13, color: '#374151', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: false },
  rank: { id: 'rank', label: 'Rank / Place', sample: '1st Place', x: 75, y: 60, fontSize: 16, color: '#D97706', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  totalPrograms: { id: 'totalPrograms', label: 'Total Programs Count', sample: 'Total Programs: 3', x: 42, y: 95, fontSize: 12, color: '#D97706', fontFamily: 'montserrat', textAlign: 'center', bold: true, letterSpacing: 0, uppercase: false, enabled: false },
  assignedPrograms: { id: 'assignedPrograms', label: 'Assigned Programs List', sample: 'Solo Song, Elocution, Quiz (General)', x: 42, y: 97, fontSize: 11, color: '#374151', fontFamily: 'poppins', textAlign: 'center', bold: false, letterSpacing: 0, uppercase: false, enabled: false }
};

const getInitialFields = (templateId) => {
  const isPoster = templateId?.startsWith('result_poster');
  const base = isPoster ? POSTER_INITIAL_FIELDS : INITIAL_FIELDS;
  const result = JSON.parse(JSON.stringify(base));
  Object.keys(result).forEach(k => {
    if (!result[k].boxWidth) {
      result[k].boxWidth = (['resultNo', 'eventName', 'customText1', 'assignedPrograms'].includes(k)) ? 60 : 35;
    }
  });
  return result;
};

const EventCertificates = ({ event, eventId }) => {
  const [activeTemplateId, setActiveTemplateId] = useState('result_poster');
  const [unlockedPosterIds, setUnlockedPosterIds] = useState(['result_poster']);
  const [templates, setTemplates] = useState({});
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [selectedFieldId, setSelectedFieldId] = useState(null);
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadMenuOpen, setDownloadMenuOpen] = useState(false);
  const [eventStudents, setEventStudents] = useState([]);
  const [randomNotice, setRandomNotice] = useState('');
  const [isDragOverCanvas, setIsDragOverCanvas] = useState(false);

  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);
  const downloadDropdownRef = useRef(null);

  const [sampleData, setSampleData] = useState({
    // Program & Header
    resultNo: 'RESULT NO. 01',
    programName: 'English Elocution',
    programCode: 'Item #104',
    category: 'Senior Category • Stage 01',
    // 1st Place
    firstPlaceLabel: '🥇 1st Place',
    firstPlaceName: 'Participant 1',
    firstPlaceChest: 'Chest No: 1001',
    firstPlaceTeam: 'Team Alpha',
    firstPlaceName2: 'Participant 1B',
    firstPlaceChest2: 'Chest No: 1002',
    firstPlaceTeam2: 'Team Beta',
    // 2nd Place
    secondPlaceLabel: '🥈 2nd Place',
    secondPlaceName: 'Participant 2',
    secondPlaceChest: 'Chest No: 1003',
    secondPlaceTeam: 'Team Beta',
    secondPlaceName2: 'Participant 2B',
    secondPlaceChest2: 'Chest No: 1004',
    secondPlaceTeam2: 'Team Alpha',
    // 3rd Place
    thirdPlaceLabel: '🥉 3rd Place',
    thirdPlaceName: 'Participant 3',
    thirdPlaceChest: 'Chest No: 1005',
    thirdPlaceTeam: 'Team Gamma',
    thirdPlaceName2: 'Participant 3B',
    thirdPlaceChest2: 'Chest No: 1006',
    thirdPlaceTeam2: 'Team Delta',
    // Extras & General
    grade: 'Top Grade: A+ | Score: 98/100',
    customText1: 'Congratulations to all brilliant winners & participants!',
    eventName: event?.title || 'School Arts & Cultural Fest 2026',
    dateVenue: 'Main Stage • 22 Nov 2026'
  });

  useEffect(() => {
    loadTemplates();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    fetchSampleData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, activeTemplateId]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedFieldId(null);
        setDownloadMenuOpen(false);
      }
    };
    const handleOutsideClick = (e) => {
      if (downloadDropdownRef.current && !downloadDropdownRef.current.contains(e.target)) {
        setDownloadMenuOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, []);

  const fetchSampleData = async () => {
    try {
      const response = await eventCertificatesAPI.getPreviewData(eventId, activeTemplateId);
      if (response.data?.recipient) {
        setSampleData(prev => ({ ...prev, ...response.data.recipient }));
      }
      if (Array.isArray(response.data?.eventStudents) && response.data.eventStudents.length > 0) {
        setEventStudents(response.data.eventStudents);
        // Fill initial placeholders with real event participants if no recipient was returned
        if (!response.data?.recipient) {
          const s = response.data.eventStudents;
          setSampleData(prev => ({
            ...prev,
            participantName: s[0]?.name || prev.participantName,
            chestNo: s[0]?.chest || prev.chestNo,
            teamName: s[0]?.team || prev.teamName,
            firstPlaceName: s[0]?.name || prev.firstPlaceName,
            firstPlaceChest: s[0]?.chest || prev.firstPlaceChest,
            firstPlaceTeam: s[0]?.team || prev.firstPlaceTeam,
            secondPlaceName: s[1]?.name || prev.secondPlaceName,
            secondPlaceChest: s[1]?.chest || prev.secondPlaceChest,
            secondPlaceTeam: s[1]?.team || prev.secondPlaceTeam,
            thirdPlaceName: s[2]?.name || prev.thirdPlaceName,
            thirdPlaceChest: s[2]?.chest || prev.thirdPlaceChest,
            thirdPlaceTeam: s[2]?.team || prev.thirdPlaceTeam,
          }));
        }
      }
    } catch (err) {
      console.error('Error fetching sample DB participant:', err);
    }
  };

  const PARTICIPANT_FIELDS = [
    'participantName',
    'firstPlaceName',
    'firstPlaceName2',
    'secondPlaceName',
    'secondPlaceName2',
    'thirdPlaceName',
    'thirdPlaceName2'
  ];

  const cycleRandomStudentForField = (fieldId) => {
    if (!eventStudents || eventStudents.length === 0) return;
    const currentVal = sampleData[fieldId];
    const available = eventStudents.filter(s => s.name !== currentVal);
    const pool = available.length > 0 ? available : eventStudents;
    const chosen = pool[Math.floor(Math.random() * pool.length)];
    if (!chosen) return;

    if (fieldId === 'participantName') {
      setSampleData(prev => ({
        ...prev,
        participantName: chosen.name,
        chestNo: chosen.chest || prev.chestNo,
        teamName: chosen.team || prev.teamName,
        category: chosen.category || prev.category
      }));
    } else if (fieldId === 'firstPlaceName') {
      setSampleData(prev => ({
        ...prev,
        firstPlaceName: chosen.name,
        firstPlaceChest: chosen.chest || prev.firstPlaceChest,
        firstPlaceTeam: chosen.team || prev.firstPlaceTeam
      }));
    } else if (fieldId === 'firstPlaceName2') {
      setSampleData(prev => ({
        ...prev,
        firstPlaceName2: chosen.name,
        firstPlaceChest2: chosen.chest || prev.firstPlaceChest2,
        firstPlaceTeam2: chosen.team || prev.firstPlaceTeam2
      }));
    } else if (fieldId === 'secondPlaceName') {
      setSampleData(prev => ({
        ...prev,
        secondPlaceName: chosen.name,
        secondPlaceChest: chosen.chest || prev.secondPlaceChest,
        secondPlaceTeam: chosen.team || prev.secondPlaceTeam
      }));
    } else if (fieldId === 'secondPlaceName2') {
      setSampleData(prev => ({
        ...prev,
        secondPlaceName2: chosen.name,
        secondPlaceChest2: chosen.chest || prev.secondPlaceChest2,
        secondPlaceTeam2: chosen.team || prev.secondPlaceTeam2
      }));
    } else if (fieldId === 'thirdPlaceName') {
      setSampleData(prev => ({
        ...prev,
        thirdPlaceName: chosen.name,
        thirdPlaceChest: chosen.chest || prev.thirdPlaceChest,
        thirdPlaceTeam: chosen.team || prev.thirdPlaceTeam
      }));
    } else if (fieldId === 'thirdPlaceName2') {
      setSampleData(prev => ({
        ...prev,
        thirdPlaceName2: chosen.name,
        thirdPlaceChest2: chosen.chest || prev.thirdPlaceChest2,
        thirdPlaceTeam2: chosen.team || prev.thirdPlaceTeam2
      }));
    }

    setRandomNotice(`Loaded event participant: ${chosen.name}${chosen.team ? ` (${chosen.team})` : ''}`);
    setTimeout(() => setRandomNotice(''), 3000);
  };

  const loadTemplates = async () => {
    try {
      const response = await eventCertificatesAPI.getTemplates(eventId);
      const loaded = {};
      const validPosterKeys = new Set(Object.keys(POSTER_INITIAL_FIELDS));
      const foundPosterIds = ['result_poster'];

      (response.data?.results || []).forEach(template => {
        const isPoster = template.certificateType?.startsWith('result_poster');
        if (isPoster && (template.bgImage || template.status === 'Custom' || template.id)) {
          foundPosterIds.push(template.certificateType);
        }
        const defaults = getInitialFields(template.certificateType);
        
        let mergedFields = { ...defaults };
        if (template.fields) {
          Object.entries(template.fields).forEach(([k, f]) => {
            if (isPoster) {
              // For result poster: only accept valid poster fields and custom fields
              // Legacy generic fields (participantName, chestNo, teamName, rank) are ignored
              if (validPosterKeys.has(k) || k.startsWith('custom')) {
                mergedFields[k] = { ...(mergedFields[k] || {}), ...f };
              }
            } else {
              mergedFields[k] = { ...(mergedFields[k] || {}), ...f };
            }
          });
        }

        loaded[template.certificateType] = {
          ...template,
          id: template.certificateType,
          aspectRatio: template.aspectRatio || (isPoster ? 0.75 : 4 / 3),
          fields: mergedFields
        };
      });
      setTemplates(loaded);
      setUnlockedPosterIds(prev => Array.from(new Set([...prev, ...foundPosterIds])));
    } catch (e) {
      console.error('Error loading templates:', e);
      setErrorMessage(e.response?.data?.error || 'Unable to load templates.');
    }
  };

  const isPosterActive = activeTemplateId?.startsWith('result_poster');
  const currentSlot = POSTER_SLOTS.find(s => s.id === activeTemplateId) || POSTER_SLOTS[0];
  const activePosterSlots = POSTER_SLOTS.filter(s => unlockedPosterIds.includes(s.id));
  const currentDefaults = getInitialFields(activeTemplateId);
  const savedTemplate = templates[activeTemplateId];

  let resolvedTemplateFields = { ...currentDefaults };
  if (savedTemplate?.fields) {
    const validPosterKeys = new Set(Object.keys(POSTER_INITIAL_FIELDS));
    Object.entries(savedTemplate.fields).forEach(([k, f]) => {
      if (isPosterActive) {
        if (validPosterKeys.has(k) || k.startsWith('custom')) {
          resolvedTemplateFields[k] = { ...(resolvedTemplateFields[k] || {}), ...f };
        }
      } else {
        resolvedTemplateFields[k] = { ...(resolvedTemplateFields[k] || {}), ...f };
      }
    });
  }

  const currentTemplate = savedTemplate ? {
    ...savedTemplate,
    aspectRatio: savedTemplate.aspectRatio || (isPosterActive ? 0.75 : 4 / 3),
    fields: resolvedTemplateFields
  } : {
    id: activeTemplateId,
    bgImage: '',
    status: 'Missing',
    aspectRatio: isPosterActive ? 0.75 : 4 / 3,
    fields: currentDefaults
  };

  const saveTemplates = async (updated = templates) => {
    const template = updated[activeTemplateId] || currentTemplate;
    setSaving(true);
    setErrorMessage('');
    try {
      const response = await eventCertificatesAPI.updateTemplate(eventId, activeTemplateId, {
        fields: template.fields,
        aspect_ratio: template.aspectRatio
      });
      setTemplates(prev => ({
        ...prev,
        [activeTemplateId]: {
          ...response.data,
          id: activeTemplateId,
          aspectRatio: template.aspectRatio
        }
      }));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (e) {
      console.error('Error saving templates:', e);
      setErrorMessage(e.response?.data?.error || 'Unable to save the template layout.');
    } finally {
      setSaving(false);
    }
  };

  const handleAddPosterSlot = () => {
    if (unlockedPosterIds.length >= 5) {
      setErrorMessage('Maximum of 5 result poster templates allowed.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    const nextSlot = POSTER_SLOTS.find(s => !unlockedPosterIds.includes(s.id));
    if (!nextSlot) return;

    // Inherit the layout from the current template so the user gets the same structure
    const currentFieldsCopy = JSON.parse(JSON.stringify(currentTemplate.fields || getInitialFields(nextSlot.id)));

    setUnlockedPosterIds(prev => [...prev, nextSlot.id]);
    setTemplates(prev => ({
      ...prev,
      [nextSlot.id]: {
        id: nextSlot.id,
        certificateType: nextSlot.id,
        bgImage: '',
        status: 'Missing',
        aspectRatio: currentTemplate.aspectRatio || 0.75,
        fields: currentFieldsCopy
      }
    }));
    setActiveTemplateId(nextSlot.id);
    setSelectedFieldId(null);
    setSavedSuccess(false);
  };

  const handleDeletePosterSlot = async (posterId) => {
    if (posterId === 'result_poster') {
      setErrorMessage('Primary Result Poster 1 cannot be deleted. Use "Clear" to reset it.');
      setTimeout(() => setErrorMessage(''), 3000);
      return;
    }
    const slotInfo = POSTER_SLOTS.find(s => s.id === posterId);
    if (!window.confirm(`Are you sure you want to delete ${slotInfo?.label || 'this poster design'}? This will remove its template configuration.`)) {
      return;
    }
    try {
      await eventCertificatesAPI.resetTemplate(eventId, posterId);
    } catch (_) {}

    setUnlockedPosterIds(prev => prev.filter(id => id !== posterId));
    setTemplates(prev => {
      const copy = { ...prev };
      delete copy[posterId];
      return copy;
    });
    if (activeTemplateId === posterId) {
      setActiveTemplateId('result_poster');
      setSelectedFieldId(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!currentTemplate.bgImage) {
      setErrorMessage('Please upload a template background image and save first.');
      return;
    }
    setDownloading(true);
    setErrorMessage('');
    try {
      const res = await eventCertificatesAPI.generateCertificates(eventId, {
        cert_types: activeTemplateId,
        quality: 'print'
      });
      const slotLabel = POSTER_SLOTS.find(s => s.id === activeTemplateId)?.label || 'Result_Poster';
      const filename = `${slotLabel.replace(/\s+/g, '_')}_${event?.title || 'Event'}.pdf`;
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      let msg = err.response?.data?.error;
      if (err.response?.data instanceof Blob) {
        try {
          const parsed = JSON.parse(await err.response.data.text());
          msg = parsed?.error;
        } catch (_) {}
      }
      setErrorMessage(msg || 'Unable to download Result Poster PDF. Ensure programs and participants are assigned.');
    } finally {
      setDownloading(false);
    }
  };

  // High-Resolution PNG Direct Export from Canvas
  const handleDownloadPng = async () => {
    if (!currentTemplate.bgImage) {
      setErrorMessage('Please upload a template background image first.');
      return;
    }
    setDownloading(true);
    setErrorMessage('');
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.src = currentTemplate.bgImage;
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('Failed to load background image for PNG export'));
      });

      const offCanvas = document.createElement('canvas');
      const w = img.naturalWidth || 1600;
      const h = img.naturalHeight || Math.round(w / (currentTemplate.aspectRatio || 0.75));
      offCanvas.width = w;
      offCanvas.height = h;
      const ctx = offCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // 1. Draw Background Image
      ctx.drawImage(img, 0, 0, w, h);

      // 2. Draw Text Layers
      const fields = Object.values(currentTemplate.fields || {});
      const scaleFactor = w / 672.0;

      fields.forEach(f => {
        if (!f.enabled) return;
        const rawText = sampleData[f.id] || f.sample || '';
        if (!rawText) return;
        const text = f.uppercase ? rawText.toUpperCase() : rawText;

        const posX = (f.x / 100.0) * w;
        const posY = (f.y / 100.0) * h;
        const fontSize = Math.round((f.fontSize || 16) * scaleFactor);
        const boxWidthPct = f.boxWidth || 35;
        const boxWidthPx = (boxWidthPct / 100.0) * w;

        const fontObj = FONT_OPTIONS.find(o => o.value === f.fontFamily) || FONT_OPTIONS[0];
        const italicStr = f.italic ? 'italic ' : '';
        const boldStr = f.bold ? 'bold ' : 'normal ';
        ctx.font = `${italicStr}${boldStr}${fontSize}px ${fontObj.css}`;
        ctx.textAlign = f.textAlign || 'center';
        ctx.textBaseline = 'middle';

        // Apply Shadow / Glow
        if (f.shadow && f.shadow !== 'none') {
          if (f.shadow === 'soft') {
            ctx.shadowColor = 'rgba(0,0,0,0.45)';
            ctx.shadowBlur = 4 * scaleFactor;
            ctx.shadowOffsetX = 1 * scaleFactor;
            ctx.shadowOffsetY = 2 * scaleFactor;
          } else if (f.shadow === 'strong') {
            ctx.shadowColor = 'rgba(0,0,0,0.85)';
            ctx.shadowBlur = 8 * scaleFactor;
            ctx.shadowOffsetX = 2 * scaleFactor;
            ctx.shadowOffsetY = 4 * scaleFactor;
          } else if (f.shadow === 'glow') {
            ctx.shadowColor = 'rgba(255,255,255,0.9)';
            ctx.shadowBlur = 12 * scaleFactor;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
          } else if (f.shadow === 'outline_dark') {
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 3 * scaleFactor;
          } else if (f.shadow === 'outline_light') {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 3 * scaleFactor;
          }
        } else {
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        ctx.fillStyle = f.color || '#000000';

        // Word-wrap within boxWidthPx
        const words = text.split(' ');
        let lines = [];
        let curLine = '';
        for (let i = 0; i < words.length; i++) {
          const testLine = curLine ? `${curLine} ${words[i]}` : words[i];
          if (ctx.measureText(testLine).width > boxWidthPx && curLine) {
            lines.push(curLine);
            curLine = words[i];
          } else {
            curLine = testLine;
          }
        }
        if (curLine) lines.push(curLine);

        // Auto shrink font size if words still exceed boxWidthPx
        let curFontSize = fontSize;
        let exceeds = lines.some(line => ctx.measureText(line).width > boxWidthPx);
        while (exceeds && curFontSize > 8) {
          curFontSize -= 1;
          ctx.font = `${italicStr}${boldStr}${curFontSize}px ${fontObj.css}`;
          exceeds = lines.some(line => ctx.measureText(line).width > boxWidthPx);
        }

        const lineHeight = curFontSize * 1.25;
        const totalHeight = (lines.length - 1) * lineHeight;
        const startY = posY - (totalHeight / 2.0);

        lines.forEach((line, idx) => {
          const lineY = startY + (idx * lineHeight);
          if (f.shadow === 'outline_dark' || f.shadow === 'outline_light') {
            ctx.strokeText(line, posX, lineY);
          }
          ctx.fillText(line, posX, lineY);
        });
      });

      offCanvas.toBlob((blob) => {
        if (!blob) throw new Error('Canvas export failed');
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const slotLabel = POSTER_SLOTS.find(s => s.id === activeTemplateId)?.label || 'Result_Poster';
        link.download = `${slotLabel.replace(/\s+/g, '_')}_${event?.title || 'Design'}.png`;
        document.body.appendChild(link);
        link.click();
        link.parentNode?.removeChild(link);
        URL.revokeObjectURL(url);
      }, 'image/png');
    } catch (err) {
      console.error('PNG export failed:', err);
      setErrorMessage('Could not export PNG image. Make sure background image is loaded.');
    } finally {
      setDownloading(false);
    }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      setErrorMessage('Use a PNG, JPEG or WebP template image.');
      e.target.value = '';
      return;
    }
    if (file.size > 25 * 1024 * 1024) {
      setErrorMessage('Template images must be 25 MB or smaller.');
      e.target.value = '';
      return;
    }

    setSaving(true);
    setErrorMessage('');
    try {
      const payload = new FormData();
      payload.append('background_image', file);
      payload.append('fields', JSON.stringify(currentTemplate.fields || getInitialFields(activeTemplateId)));
      if (currentTemplate.aspectRatio) {
        payload.append('aspect_ratio', currentTemplate.aspectRatio);
      }
      const response = await eventCertificatesAPI.updateTemplate(
        eventId, activeTemplateId, payload
      );
      setTemplates(prev => ({
        ...prev,
        [activeTemplateId]: {
          ...response.data,
          id: activeTemplateId,
          aspectRatio: response.data.aspectRatio || currentTemplate.aspectRatio
        }
      }));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (error) {
      setErrorMessage(error.response?.data?.error || 'Unable to upload the template image.');
    } finally {
      setSaving(false);
      e.target.value = '';
    }
  };

  const handleMouseDown = (fieldKey, e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedFieldId(fieldKey);

    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const field = currentTemplate.fields?.[fieldKey] || POSTER_INITIAL_FIELDS[fieldKey] || {};
    const startX = field.x ?? 50;
    const startY = field.y ?? 50;

    let hasMoved = false;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startMouseX;
      const deltaY = moveEvent.clientY - startMouseY;
      if (!hasMoved && Math.hypot(deltaX, deltaY) < 3) return;
      hasMoved = true;

      const deltaXPct = (deltaX / canvasRect.width) * 100;
      const deltaYPct = (deltaY / canvasRect.height) * 100;

      const newX = Math.max(0, Math.min(100, Math.round((startX + deltaXPct) * 10) / 10));
      const newY = Math.max(0, Math.min(100, Math.round((startY + deltaYPct) * 10) / 10));

      setTemplates(prev => {
        const cur = prev[activeTemplateId] || currentTemplate;
        const updatedFields = {
          ...cur.fields,
          [fieldKey]: { ...cur.fields[fieldKey], x: newX, y: newY }
        };
        return {
          ...prev,
          [activeTemplateId]: { ...cur, fields: updatedFields }
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleWidthResizeMouseDown = (fieldKey, side, e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedFieldId(fieldKey);

    if (!canvasRef.current) return;
    const canvasRect = canvasRef.current.getBoundingClientRect();
    const startMouseX = e.clientX;
    const field = currentTemplate.fields?.[fieldKey] || POSTER_INITIAL_FIELDS[fieldKey] || {};
    const startX = field.x ?? 50;
    const startBoxWidth = field.boxWidth || 35;
    const alignment = field.textAlign || 'center';

    const onMouseMove = (moveEvent) => {
      const deltaXPx = moveEvent.clientX - startMouseX;
      const deltaXPct = (deltaXPx / canvasRect.width) * 100;

      let newBoxWidth;
      let newX = startX;

      if (alignment === 'center') {
        if (side === 'right') {
          // Right side enlarged: left edge stays pinned at (startX - startBoxWidth / 2)
          newBoxWidth = startBoxWidth + deltaXPct;
          if (newBoxWidth < 8) newBoxWidth = 8;
          if (newBoxWidth > 98) newBoxWidth = 98;
          const actualDeltaW = newBoxWidth - startBoxWidth;
          newX = startX + (actualDeltaW / 2);
        } else {
          // Left side enlarged: right edge stays pinned at (startX + startBoxWidth / 2)
          newBoxWidth = startBoxWidth - deltaXPct;
          if (newBoxWidth < 8) newBoxWidth = 8;
          if (newBoxWidth > 98) newBoxWidth = 98;
          const actualDeltaW = newBoxWidth - startBoxWidth;
          newX = startX - (actualDeltaW / 2);
        }
      } else if (alignment === 'left') {
        if (side === 'right') {
          // Right side enlarged: left edge stays pinned at startX
          newBoxWidth = startBoxWidth + deltaXPct;
          newBoxWidth = Math.max(8, Math.min(98, newBoxWidth));
          newX = startX;
        } else {
          // Left side enlarged: right edge stays pinned at (startX + startBoxWidth)
          newBoxWidth = startBoxWidth - deltaXPct;
          if (newBoxWidth < 8) newBoxWidth = 8;
          if (newBoxWidth > 98) newBoxWidth = 98;
          const actualDeltaW = newBoxWidth - startBoxWidth;
          newX = startX - actualDeltaW;
        }
      } else {
        // alignment === 'right'
        if (side === 'right') {
          // Right side enlarged: left edge stays pinned at (startX - startBoxWidth)
          newBoxWidth = startBoxWidth + deltaXPct;
          if (newBoxWidth < 8) newBoxWidth = 8;
          if (newBoxWidth > 98) newBoxWidth = 98;
          const actualDeltaW = newBoxWidth - startBoxWidth;
          newX = startX + actualDeltaW;
        } else {
          // Left side enlarged: right edge stays pinned at startX
          newBoxWidth = startBoxWidth - deltaXPct;
          newBoxWidth = Math.max(8, Math.min(98, newBoxWidth));
          newX = startX;
        }
      }

      newBoxWidth = Math.round(newBoxWidth * 10) / 10;
      newX = Math.max(0, Math.min(100, Math.round(newX * 10) / 10));

      setTemplates(prev => {
        const cur = prev[activeTemplateId] || currentTemplate;
        const updatedFields = {
          ...cur.fields,
          [fieldKey]: { ...cur.fields[fieldKey], boxWidth: newBoxWidth, x: newX }
        };
        return {
          ...prev,
          [activeTemplateId]: { ...cur, fields: updatedFields }
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleResizeMouseDown = (fieldKey, handleType, e) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    setSelectedFieldId(fieldKey);

    const startX = e.clientX;
    const startSize = currentTemplate.fields[fieldKey]?.fontSize || 18;

    const onMouseMove = (moveEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const delta = handleType.includes('right') ? deltaX : -deltaX;
      const newFontSize = Math.max(8, Math.min(110, Math.round(startSize + delta * 0.25)));

      setTemplates(prev => {
        const cur = prev[activeTemplateId] || currentTemplate;
        const updatedFields = {
          ...cur.fields,
          [fieldKey]: { ...cur.fields[fieldKey], fontSize: newFontSize }
        };
        return {
          ...prev,
          [activeTemplateId]: { ...cur, fields: updatedFields }
        };
      });
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const toggleFieldEnabled = (fieldKey) => {
    const cur = currentTemplate;
    const isCurrentlyEnabled = !!cur.fields[fieldKey]?.enabled;
    const updatedFields = {
      ...cur.fields,
      [fieldKey]: { 
        ...(cur.fields[fieldKey] || POSTER_INITIAL_FIELDS[fieldKey]),
        enabled: !isCurrentlyEnabled 
      }
    };
    setTemplates({
      ...templates,
      [activeTemplateId]: { ...cur, fields: updatedFields }
    });
    if (!isCurrentlyEnabled) {
      setSelectedFieldId(fieldKey);
    } else if (selectedFieldId === fieldKey) {
      setSelectedFieldId(null);
    }
  };

  const handleClearCanvas = () => {
    const cur = currentTemplate;
    const clearedFields = {};
    Object.entries(cur.fields || {}).forEach(([k, f]) => {
      if (!k.startsWith('custom')) {
        clearedFields[k] = { ...f, enabled: false };
      }
    });
    setTemplates(prev => ({
      ...prev,
      [activeTemplateId]: { ...cur, fields: clearedFields }
    }));
    setSelectedFieldId(null);
  };

  const enableAndPlaceField = (fieldId, x = 50, y = 50) => {
    const cur = currentTemplate;
    const baseField = cur.fields[fieldId] || POSTER_INITIAL_FIELDS[fieldId] || {
      id: fieldId,
      label: fieldId,
      sample: 'Field Text',
      fontSize: 16,
      color: '#000000',
      fontFamily: 'montserrat',
      textAlign: 'center',
      bold: true,
      letterSpacing: 0,
      uppercase: false,
      boxWidth: 35
    };

    const updatedFields = {
      ...cur.fields,
      [fieldId]: {
        ...baseField,
        x,
        y,
        enabled: true
      }
    };

    setTemplates({
      ...templates,
      [activeTemplateId]: { ...cur, fields: updatedFields }
    });
    setSelectedFieldId(fieldId);
  };

  const updateFieldProp = (fieldKey, prop, val) => {
    const cur = currentTemplate;
    const updatedFields = {
      ...cur.fields,
      [fieldKey]: { ...cur.fields[fieldKey], [prop]: val }
    };
    setTemplates({
      ...templates,
      [activeTemplateId]: { ...cur, fields: updatedFields }
    });
  };

  const nudgeField = (fieldKey, deltaX, deltaY) => {
    if (!fieldKey || !currentTemplate.fields[fieldKey]) return;
    const f = currentTemplate.fields[fieldKey];
    const newX = Math.max(0, Math.min(100, Math.round((f.x + deltaX) * 10) / 10));
    const newY = Math.max(0, Math.min(100, Math.round((f.y + deltaY) * 10) / 10));
    updateFieldProp(fieldKey, 'x', newX);
    updateFieldProp(fieldKey, 'y', newY);
  };

  const handleAspectRatioChange = (newRatio) => {
    setTemplates(prev => {
      const cur = prev[activeTemplateId] || currentTemplate;
      return {
        ...prev,
        [activeTemplateId]: { ...cur, aspectRatio: newRatio }
      };
    });
  };

  const handleAddCustomField = () => {
    const customId = `custom_${Date.now()}`;
    const customCount = Object.keys(currentTemplate.fields).filter(k => k.startsWith('custom')).length + 1;
    const newField = {
      id: customId,
      label: `Custom Text ${customCount}`,
      sample: 'Custom Label Text',
      x: 50,
      y: 50,
      fontSize: 16,
      color: '#1E293B',
      fontFamily: 'montserrat',
      textAlign: 'center',
      bold: true,
      letterSpacing: 0,
      uppercase: false,
      enabled: true,
      isCustom: true,
      boxWidth: 35
    };
    const updated = {
      ...templates,
      [activeTemplateId]: {
        ...currentTemplate,
        fields: {
          ...currentTemplate.fields,
          [customId]: newField
        }
      }
    };
    setTemplates(updated);
    setSelectedFieldId(customId);
  };

  const handleDeleteField = (fieldKey) => {
    if (!fieldKey) return;
    const { [fieldKey]: removed, ...remaining } = currentTemplate.fields;
    const updated = {
      ...templates,
      [activeTemplateId]: {
        ...currentTemplate,
        fields: remaining
      }
    };
    setTemplates(updated);
    setSelectedFieldId(Object.keys(remaining)[0] || null);
  };

  // Drag and Drop from Sidebar into Canvas
  const handleDragStart = (e, fieldId) => {
    e.dataTransfer.setData('text/plain', fieldId);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleCanvasDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOverCanvas) setIsDragOverCanvas(true);
  };

  const handleCanvasDragLeave = () => {
    setIsDragOverCanvas(false);
  };

  const handleCanvasDrop = (e) => {
    e.preventDefault();
    setIsDragOverCanvas(false);
    const fieldId = e.dataTransfer.getData('text/plain');
    if (!fieldId || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    let x = ((e.clientX - rect.left) / rect.width) * 100;
    let y = ((e.clientY - rect.top) / rect.height) * 100;
    x = Math.max(2, Math.min(95, Math.round(x * 10) / 10));
    y = Math.max(2, Math.min(95, Math.round(y * 10) / 10));

    enableAndPlaceField(fieldId, x, y);
  };

  const activeTypeInfo = TEMPLATE_TYPES.find(t => t.id === activeTemplateId) || TEMPLATE_TYPES[0];
  const selectedField = selectedFieldId && currentTemplate.fields[selectedFieldId]?.enabled ? currentTemplate.fields[selectedFieldId] : null;

  // Layer groups for Result Poster
  const FIRST_PLACE_GROUP = [
    { id: 'firstPlaceName', label: '1st Place Participant', icon: User, defaultSample: 'Muhammed Nihal' },
    { id: 'firstPlaceChest', label: '1st Place Chest No', icon: Hash, defaultSample: 'Chest No: 4003' },
    { id: 'firstPlaceTeam', label: '1st Place Team', icon: Flag, defaultSample: 'Team Falcon' },
    { id: 'firstPlaceLabel', label: '1st Place Title Badge', icon: Trophy, defaultSample: '🥇 1st Place' },
    { id: 'firstPlaceName2', label: '1st Place (Joint Winner 2 Name)', icon: User, defaultSample: 'Fathima Zahra', isJoint: true },
    { id: 'firstPlaceChest2', label: '1st Place (Joint Winner 2 Chest)', icon: Hash, defaultSample: 'Chest No: 4009', isJoint: true },
    { id: 'firstPlaceTeam2', label: '1st Place (Joint Winner 2 Team)', icon: Flag, defaultSample: 'Team Phoenix', isJoint: true },
  ];

  const SECOND_PLACE_GROUP = [
    { id: 'secondPlaceName', label: '2nd Place Participant', icon: User, defaultSample: 'Ayisha Rida' },
    { id: 'secondPlaceChest', label: '2nd Place Chest No', icon: Hash, defaultSample: 'Chest No: 4012' },
    { id: 'secondPlaceTeam', label: '2nd Place Team', icon: Flag, defaultSample: 'Team Phoenix' },
    { id: 'secondPlaceLabel', label: '2nd Place Title Badge', icon: Medal, defaultSample: '🥈 2nd Place' },
    { id: 'secondPlaceName2', label: '2nd Place (Joint Winner 2 Name)', icon: User, defaultSample: 'Nafih Razak', isJoint: true },
    { id: 'secondPlaceChest2', label: '2nd Place (Joint Winner 2 Chest)', icon: Hash, defaultSample: 'Chest No: 4018', isJoint: true },
    { id: 'secondPlaceTeam2', label: '2nd Place (Joint Winner 2 Team)', icon: Flag, defaultSample: 'Team Falcon', isJoint: true },
  ];

  const THIRD_PLACE_GROUP = [
    { id: 'thirdPlaceName', label: '3rd Place Participant', icon: User, defaultSample: 'Salman Faris' },
    { id: 'thirdPlaceChest', label: '3rd Place Chest No', icon: Hash, defaultSample: 'Chest No: 4025' },
    { id: 'thirdPlaceTeam', label: '3rd Place Team', icon: Flag, defaultSample: 'Team Griffin' },
    { id: 'thirdPlaceLabel', label: '3rd Place Title Badge', icon: Award, defaultSample: '🥉 3rd Place' },
    { id: 'thirdPlaceName2', label: '3rd Place (Joint Winner 2 Name)', icon: User, defaultSample: 'Danish Ali', isJoint: true },
    { id: 'thirdPlaceChest2', label: '3rd Place (Joint Winner 2 Chest)', icon: Hash, defaultSample: 'Chest No: 4031', isJoint: true },
    { id: 'thirdPlaceTeam2', label: '3rd Place (Joint Winner 2 Team)', icon: Flag, defaultSample: 'Team Vortex', isJoint: true },
  ];

  const HEADER_EVENT_GROUP = [
    { id: 'resultNo', label: 'Result Number (e.g. RESULT NO. 01)', icon: Sparkles, defaultSample: 'RESULT NO. 01' },
    { id: 'programName', label: 'Program Name', icon: Type, defaultSample: 'English Elocution' },
    { id: 'programCode', label: 'Program Code / No', icon: Hash, defaultSample: 'Item #104' },
    { id: 'category', label: 'Category / Section', icon: Layers, defaultSample: 'Senior Category • Stage 01' },
    { id: 'eventName', label: 'Event / Fest Title', icon: Flag, defaultSample: 'School Arts & Cultural Fest 2026' },
    { id: 'dateVenue', label: 'Date & Venue', icon: Calendar, defaultSample: 'Main Stage • 22 Nov 2026' },
    { id: 'grade', label: 'Grade / Score', icon: Award, defaultSample: 'Top Grade: A+ | Score: 98/100' },
  ];

  const customFieldsList = Object.values(currentTemplate.fields || {}).filter(f => f.isCustom);

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-[#f7f8fb] min-h-[680px]">
      
      {/* Save Success Toast */}
      {savedSuccess && (
        <div className="fixed top-20 right-8 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2 animate-bounce">
          <Check className="w-5 h-5 stroke-[3]" />
          <span className="text-xs font-bold">Result Poster layout saved successfully!</span>
        </div>
      )}
      {randomNotice && (
        <div className="fixed top-20 right-8 z-50 bg-indigo-700 text-white px-4 py-2.5 rounded-xl shadow-lg flex items-center space-x-2">
          <Shuffle className="w-4 h-4 shrink-0 text-amber-300" />
          <span className="text-xs font-bold">{randomNotice}</span>
        </div>
      )}
      {errorMessage && (
        <div className="fixed top-20 right-8 z-50 max-w-sm bg-rose-600 text-white px-4 py-3 rounded-xl shadow-lg flex items-start space-x-2">
          <X className="w-5 h-5 shrink-0" />
          <span className="text-xs font-bold">{errorMessage}</span>
        </div>
      )}

      {/* Top Header Card Box */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Result Poster Studio</h1>
              <span className="px-2.5 py-0.5 text-[11px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200 rounded-full">
                Live Drag & Drop Designer
              </span>
              <span className="px-2.5 py-0.5 text-[11px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full">
                {activePosterSlots.length} of 5 Posters
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Design up to 5 custom result poster templates for <span className="font-semibold text-gray-700">{event?.title || 'this Event'}</span>
            </p>
          </div>

          {/* Global Save Action */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => saveTemplates(templates)}
              disabled={saving}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait text-white text-xs font-bold rounded-xl transition-all shadow-sm flex items-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : `Save ${currentSlot.label} Layout`}</span>
            </button>
          </div>
        </div>

        {/* Multi-Poster Templates Tab Bar (Max 5 Posters) */}
        <div className="flex items-center justify-between flex-wrap gap-2 pt-3 border-t border-slate-100">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Poster Templates:</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {activePosterSlots.map((slot, index) => {
              const isSelected = activeTemplateId === slot.id;
              const t = templates[slot.id];
              const isConfigured = Boolean(t?.bgImage || t?.status === 'Custom');
              return (
                <div key={slot.id} className="relative inline-flex items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTemplateId(slot.id);
                      setSelectedFieldId(null);
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer border flex items-center space-x-1.5 ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${isSelected ? 'text-indigo-200' : 'text-indigo-500'}`} />
                    <span>{slot.label}</span>
                    {isConfigured ? (
                      <span className={`w-2 h-2 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-500'}`} title="Background Image Uploaded" />
                    ) : (
                      <span className={`text-[10px] ${isSelected ? 'text-indigo-200' : 'text-gray-400'}`}>(Blank)</span>
                    )}
                    {index > 0 && (
                      <span
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePosterSlot(slot.id);
                        }}
                        title={`Delete ${slot.label}`}
                        className={`ml-1 p-0.5 rounded hover:bg-rose-500 hover:text-white transition-colors cursor-pointer ${
                          isSelected ? 'text-indigo-200' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <X className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>
                </div>
              );
            })}

            {activePosterSlots.length < 5 && (
              <button
                type="button"
                onClick={handleAddPosterSlot}
                className="px-3 py-1.5 text-xs font-bold rounded-xl border border-dashed border-indigo-300 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 transition-all cursor-pointer flex items-center space-x-1 shadow-2xs"
                title="Add another result poster template design (Maximum of 5 posters)"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Add Poster ({activePosterSlots.length}/5)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left / Center Canvas Workspace (Col 8) */}
        <div className="lg:col-span-8 bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 shadow-2xs space-y-4">
          
          {/* Header Title & Top Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                Official Result Template
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 flex items-center space-x-2">
                <span>Program Result Poster ({currentSlot?.label || 'Poster 1'})</span>
                <span className="px-2 py-0.5 text-[10px] font-bold bg-emerald-100 text-emerald-800 rounded-md">
                  Active
                </span>
              </h2>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/*"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="h-8 px-3 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-colors inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                title="Upload background poster image"
              >
                <Upload className="w-3.5 h-3.5 text-slate-500" />
                <span>Upload Image</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewModalOpen(true)}
                className="h-8 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold rounded-xl transition-colors inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Preview</span>
              </button>

              {/* Single Unified Download Button with PNG / PDF Dropdown */}
              <div className="relative inline-block" ref={downloadDropdownRef}>
                <button
                  type="button"
                  onClick={() => setDownloadMenuOpen(prev => !prev)}
                  disabled={downloading || !currentTemplate.bgImage}
                  className="h-8 px-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-bold rounded-xl transition-all shadow-2xs inline-flex items-center space-x-1.5 cursor-pointer"
                  title={!currentTemplate.bgImage ? 'Upload an image and save first to download' : 'Export and download poster'}
                >
                  {downloading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Exporting...</span>
                    </>
                  ) : (
                    <>
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                      <ChevronDown className="w-3 h-3 text-indigo-200 ml-0.5" />
                    </>
                  )}
                </button>

                {downloadMenuOpen && (
                  <div className="absolute right-0 mt-1.5 w-56 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 text-left">
                    <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Export {currentSlot?.label || 'Poster'}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setDownloadMenuOpen(false);
                        handleDownloadPng();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                        <ImageIcon className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">PNG Image</div>
                        <div className="text-[10px] text-slate-400">High-res for social & web</div>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDownloadMenuOpen(false);
                        handleDownloadPdf();
                      }}
                      className="w-full px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center space-x-2.5 transition-colors cursor-pointer text-left"
                    >
                      <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Download className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-800">PDF Document</div>
                        <div className="text-[10px] text-slate-400">Multi-page print quality</div>
                      </div>
                    </button>
                  </div>
                )}
              </div>

              {/* Clear Canvas Action */}
              <button
                type="button"
                onClick={handleClearCanvas}
                className="h-8 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition-colors inline-flex items-center space-x-1.5 cursor-pointer shadow-2xs"
                title="Clear all active layers on this canvas"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          {/* Aspect Ratio Presets Toolbar */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-1">
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Canvas Format:</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              {ASPECT_RATIO_PRESETS.map((preset) => {
                const isActive = Math.abs((currentTemplate.aspectRatio || 0.75) - preset.value) < 0.05;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => handleAspectRatioChange(preset.value)}
                    title={preset.desc}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all cursor-pointer border ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Canva-Style Canvas Container with Drag & Drop Listener */}
          <div 
            onClick={() => setSelectedFieldId(null)}
            onDragOver={handleCanvasDragOver}
            onDragLeave={handleCanvasDragLeave}
            onDrop={handleCanvasDrop}
            className={`relative w-full rounded-2xl p-4 transition-all flex justify-center items-center overflow-hidden min-h-[560px] cursor-default ${
              isDragOverCanvas 
                ? 'bg-indigo-50/80 border-2 border-dashed border-indigo-500 ring-4 ring-indigo-100' 
                : 'bg-slate-50 border-2 border-dashed border-indigo-200'
            }`}
          >
            {/* Drag Overlay Hint */}
            {isDragOverCanvas && (
              <div className="absolute inset-0 z-40 bg-indigo-600/10 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
                <div className="bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg font-bold text-xs flex items-center space-x-2 animate-pulse">
                  <Plus className="w-4 h-4" />
                  <span>Drop layer here to place on canvas</span>
                </div>
              </div>
            )}

            {/* Template Badge Label Top Left */}
            <div className="absolute top-4 left-4 z-20 px-3 py-1 bg-white/90 backdrop-blur-xs border border-gray-200 rounded-lg text-[11px] font-bold text-gray-700 shadow-2xs flex items-center space-x-1.5">
              <span>Result Poster</span>
              <span className="text-gray-300">•</span>
              <span className="text-indigo-600 font-extrabold">
                {ASPECT_RATIO_PRESETS.find(p => Math.abs((currentTemplate.aspectRatio || 0.75) - p.value) < 0.05)?.label || '3:4 Poster'}
              </span>
            </div>

            {/* Canvas Main Image / Layout Container */}
            <div
              ref={canvasRef}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFieldId(null);
              }}
              style={{
                aspectRatio: currentTemplate.aspectRatio ? `${currentTemplate.aspectRatio}` : '3/4'
              }}
              className="relative w-full max-w-xl bg-white rounded-xl shadow-lg overflow-hidden select-none border border-gray-200 transition-all cursor-default"
            >
              {/* Background Poster Image */}
              {currentTemplate.bgImage ? (
                <img
                  src={currentTemplate.bgImage}
                  alt="Template Background"
                  className="w-full h-full object-cover pointer-events-none"
                />
              ) : (
                <div className="w-full h-full min-h-[460px] relative bg-slate-100/60 p-6 flex flex-col justify-center items-center text-center border-2 border-dashed border-gray-300">
                  <div className="p-4 rounded-2xl bg-white shadow-2xs border border-gray-200 mb-2">
                    <Upload className="w-8 h-8 text-indigo-400 mx-auto mb-1" />
                    <div className="text-xs font-bold text-gray-800">Upload Result Poster Background Image</div>
                    <div className="text-[11px] text-gray-400 mt-0.5">Click "Upload Image" above to load your poster design</div>
                  </div>
                  <div className="text-[11px] font-semibold text-gray-400">
                    {event?.title || 'Event Design Canvas'}
                  </div>
                </div>
              )}

              {/* Draggable & Resizable Fields Overlaid on Canvas */}
              {Object.values(currentTemplate.fields || {}).filter(f => f.enabled).length === 0 && (
                <div className="absolute inset-0 z-20 flex items-center justify-center p-6 bg-slate-900/10 backdrop-blur-[1px] pointer-events-none">
                  <div className="bg-white/95 border border-dashed border-indigo-200 rounded-2xl p-6 text-center shadow-md max-w-sm">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-2.5 shadow-2xs">
                      <Layers className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-extrabold text-gray-900">Canvas is Blank</h4>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                      Drag any layer from <span className="font-semibold text-indigo-600">Poster Canvas Layers</span> on the right, or click <span className="font-semibold text-gray-700">+ Add</span> to place elements on your poster.
                    </p>
                  </div>
                </div>
              )}

              {Object.values(currentTemplate.fields || {}).map((f) => {
                if (!f.enabled) return null;

                const isSelected = selectedFieldId === f.id;
                const displayText = sampleData[f.id] || f.sample || '';
                const shadowObj = SHADOW_PRESETS.find(s => s.value === f.shadow);
                const badgeObj = BADGE_PRESETS.find(b => b.value === f.badgeBg);
                const currentBoxWidth = f.boxWidth || 35;

                return (
                  <div
                    key={f.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFieldId(f.id);
                      if (PARTICIPANT_FIELDS.includes(f.id)) {
                        cycleRandomStudentForField(f.id);
                      }
                    }}
                    onMouseDown={(e) => handleMouseDown(f.id, e)}
                    style={{
                      left: `${f.x}%`,
                      top: `${f.y}%`,
                      width: `${currentBoxWidth}%`,
                      transform: certificateTransform(f.textAlign),
                      fontSize: `${f.fontSize || 16}px`,
                      color: f.color || '#000000',
                      fontFamily: certificateFontCss(f.fontFamily),
                      textAlign: f.textAlign || 'center',
                      fontWeight: f.bold ? 'bold' : 'normal',
                      fontStyle: f.italic ? 'italic' : 'normal',
                      letterSpacing: `${f.letterSpacing || 0}px`,
                      textTransform: f.uppercase ? 'uppercase' : 'none',
                      textShadow: shadowObj && shadowObj.value !== 'none' ? shadowObj.css : 'none',
                      wordBreak: 'break-word',
                      overflowWrap: 'break-word',
                      whiteSpace: 'normal',
                      lineHeight: 1.25,
                    }}
                    className={`absolute z-30 px-2 py-1 select-none transition-shadow ${badgeObj?.className || ''} ${
                      isSelected 
                        ? 'border-2 border-indigo-600 bg-indigo-50/15 ring-2 ring-indigo-400/25 rounded-xs cursor-move shadow-md' 
                        : 'border border-transparent hover:border-indigo-400/60 hover:bg-white/10 rounded-xs cursor-pointer'
                    }`}
                  >
                    <span className="pointer-events-none select-none block leading-tight">{displayText}</span>

                    {/* Canva-style Interactive Bounding Box Controls when selected */}
                    {isSelected && (
                      <>
                        {/* Width Badge Indicator Top Center */}
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 px-1.5 py-0.5 bg-indigo-600 text-white text-[9px] font-mono font-bold rounded shadow-xs pointer-events-none whitespace-nowrap z-40">
                          Width: {Math.round(currentBoxWidth)}%
                        </div>

                        {/* 4 Corner handles for font size */}
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(f.id, 'top-left', e)}
                          className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize hover:scale-125 transition-transform shadow-xs z-40"
                          title="Drag corner to scale font size"
                        />
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(f.id, 'top-right', e)}
                          className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize hover:scale-125 transition-transform shadow-xs z-40"
                          title="Drag corner to scale font size"
                        />
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(f.id, 'bottom-left', e)}
                          className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-nesw-resize hover:scale-125 transition-transform shadow-xs z-40"
                          title="Drag corner to scale font size"
                        />
                        <div 
                          onMouseDown={(e) => handleResizeMouseDown(f.id, 'bottom-right', e)}
                          className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-indigo-600 rounded-full cursor-nwse-resize hover:scale-125 transition-transform shadow-xs z-40"
                          title="Drag corner to scale font size"
                        />

                        {/* 2 Side Pill Handles for Box Width Resizing */}
                        <div 
                          onMouseDown={(e) => handleWidthResizeMouseDown(f.id, 'left', e)}
                          className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-6 bg-white border-2 border-indigo-600 rounded-full cursor-ew-resize hover:scale-125 hover:bg-indigo-50 transition-all shadow-xs z-40"
                          title="Drag left border to adjust box width"
                        />
                        <div 
                          onMouseDown={(e) => handleWidthResizeMouseDown(f.id, 'right', e)}
                          className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-6 bg-white border-2 border-indigo-600 rounded-full cursor-ew-resize hover:scale-125 hover:bg-indigo-50 transition-all shadow-xs z-40"
                          title="Drag right border to adjust box width"
                        />
                      </>
                    )}
                  </div>
                );
              })}

            </div>

          </div>

          {/* Comprehensive PDF & Poster Typography Editor Toolbar */}
          {selectedField && (
            <div onClick={(e) => e.stopPropagation()} className="bg-slate-50 p-5 rounded-2xl border border-gray-200 space-y-4">
              
              {/* Header with Title and Quick Positioning tools */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-200 pb-3">
                <div className="flex items-center space-x-2">
                  <Type className="w-4 h-4 text-indigo-600" />
                  <span className="text-xs font-extrabold text-gray-900">
                    Editing Layer: <span className="text-indigo-600 font-bold">{selectedField.label}</span>
                  </span>
                </div>

                {/* Micro-Positioning D-Pad & Alignment helpers */}
                <div className="flex items-center space-x-1.5 flex-wrap">
                  <span className="text-[10px] font-bold text-gray-500 uppercase mr-1">Position:</span>
                  <div className="flex items-center space-x-1 bg-white px-2 py-1 border border-gray-200 rounded-lg text-[11px] font-mono font-bold text-gray-700">
                    <span>X: {selectedField.x}%</span>
                    <span className="text-gray-300">|</span>
                    <span>Y: {selectedField.y}%</span>
                  </div>

                  {/* Nudge Arrows */}
                  <div className="flex items-center space-x-0.5 bg-white border border-gray-200 rounded-lg p-0.5">
                    <button
                      type="button"
                      onClick={() => nudgeField(selectedFieldId, -0.5, 0)}
                      title="Nudge Left"
                      className="p-1 hover:bg-slate-100 rounded text-gray-600 cursor-pointer"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeField(selectedFieldId, 0, -0.5)}
                      title="Nudge Up"
                      className="p-1 hover:bg-slate-100 rounded text-gray-600 cursor-pointer"
                    >
                      <ArrowUp className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeField(selectedFieldId, 0, 0.5)}
                      title="Nudge Down"
                      className="p-1 hover:bg-slate-100 rounded text-gray-600 cursor-pointer"
                    >
                      <ArrowDown className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => nudgeField(selectedFieldId, 0.5, 0)}
                      title="Nudge Right"
                      className="p-1 hover:bg-slate-100 rounded text-gray-600 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Center Buttons */}
                  <button
                    type="button"
                    onClick={() => updateFieldProp(selectedFieldId, 'x', 50)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 cursor-pointer"
                    title="Center Horizontally (X = 50%)"
                  >
                    Center X
                  </button>
                  <button
                    type="button"
                    onClick={() => updateFieldProp(selectedFieldId, 'y', 50)}
                    className="px-2 py-1 bg-white hover:bg-slate-100 border border-gray-200 rounded-lg text-[10px] font-bold text-gray-700 cursor-pointer"
                    title="Center Vertically (Y = 50%)"
                  >
                    Center Y
                  </button>

                  {/* Delete Custom Field if applicable */}
                  {selectedField.isCustom && (
                    <button
                      type="button"
                      onClick={() => handleDeleteField(selectedFieldId)}
                      className="p-1 bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 rounded-lg cursor-pointer"
                      title="Delete this custom text layer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Live Text Content / Sample Value Override */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-gray-700">
                    Custom Preview Text (Displayed on Canvas)
                  </label>
                  {PARTICIPANT_FIELDS.includes(selectedFieldId) && (
                    <button
                      type="button"
                      onClick={() => cycleRandomStudentForField(selectedFieldId)}
                      className="px-2.5 py-0.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-bold rounded-lg transition-all cursor-pointer inline-flex items-center space-x-1 shadow-2xs"
                      title="Pick another random real student belonging to this event"
                    >
                      <Shuffle className="w-3 h-3 text-amber-600" />
                      <span>🎲 Pick Random Event Student</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={sampleData[selectedFieldId] !== undefined ? sampleData[selectedFieldId] : selectedField.sample}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSampleData(prev => ({ ...prev, [selectedFieldId]: val }));
                    updateFieldProp(selectedFieldId, 'sample', val);
                  }}
                  placeholder="Enter custom preview text..."
                  className="w-full px-3 py-1.5 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* 4-Column Controls Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 items-start">
                
                {/* 1. Categorized Google Fonts Dropdown */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Font Family</label>
                  <select
                    value={selectedField.fontFamily || 'montserrat'}
                    onChange={(e) => updateFieldProp(selectedFieldId, 'fontFamily', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {['Serif & Luxury', 'Modern & Poster Sans', 'Script & Calligraphy', 'Monospaced'].map((cat) => (
                      <optgroup key={cat} label={`── ${cat} ──`}>
                        {FONT_OPTIONS.filter(f => f.category === cat).map(font => (
                          <option key={font.value} value={font.value} style={{ fontFamily: font.css }}>
                            {font.label}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>

                {/* 2. Font Size with Slider & Quick +/- */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-gray-700">Font Size</label>
                    <div className="flex items-center space-x-1">
                      <button
                        type="button"
                        onClick={() => updateFieldProp(selectedFieldId, 'fontSize', Math.max(8, (selectedField.fontSize || 16) - 1))}
                        className="w-5 h-5 flex items-center justify-center bg-white border border-gray-200 rounded text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                      >
                        -
                      </button>
                      <span className="text-xs font-mono font-bold text-indigo-700 w-8 text-center">
                        {selectedField.fontSize || 16}px
                      </span>
                      <button
                        type="button"
                        onClick={() => updateFieldProp(selectedFieldId, 'fontSize', Math.min(110, (selectedField.fontSize || 16) + 1))}
                        className="w-5 h-5 flex items-center justify-center bg-white border border-gray-200 rounded text-xs font-bold text-gray-600 hover:bg-gray-100 cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                  <input
                    type="range"
                    min="8"
                    max="100"
                    value={selectedField.fontSize || 16}
                    onChange={(e) => updateFieldProp(selectedFieldId, 'fontSize', parseInt(e.target.value, 10))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* 3. Text Color & Swatches */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Text Color</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="color"
                      value={selectedField.color || '#000000'}
                      onChange={(e) => updateFieldProp(selectedFieldId, 'color', e.target.value)}
                      className="w-8 h-8 rounded-lg border border-gray-300 cursor-pointer bg-white"
                    />
                    <input
                      type="text"
                      value={selectedField.color || '#000000'}
                      onChange={(e) => updateFieldProp(selectedFieldId, 'color', e.target.value)}
                      className="w-20 px-2 py-1 text-xs font-mono font-bold text-gray-700 uppercase bg-white border border-gray-200 rounded-lg"
                    />
                  </div>
                  {/* Swatch row */}
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {COLOR_SWATCHES.slice(0, 7).map((swatch) => (
                      <button
                        key={swatch.value}
                        type="button"
                        onClick={() => updateFieldProp(selectedFieldId, 'color', swatch.value)}
                        style={{ backgroundColor: swatch.value }}
                        title={swatch.label}
                        className={`w-4 h-4 rounded-full border ${selectedField.color === swatch.value ? 'ring-2 ring-indigo-500 scale-110' : 'border-gray-300'} cursor-pointer`}
                      />
                    ))}
                  </div>
                </div>

                {/* 4. Text Alignment */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Text Alignment</label>
                  <div className="flex items-center space-x-1 bg-white p-1 border border-gray-200 rounded-xl">
                    <button
                      type="button"
                      onClick={() => updateFieldProp(selectedFieldId, 'textAlign', 'left')}
                      className={`flex-1 py-1.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        selectedField.textAlign === 'left' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                      title="Align Left"
                    >
                      <AlignLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateFieldProp(selectedFieldId, 'textAlign', 'center')}
                      className={`flex-1 py-1.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        selectedField.textAlign === 'center' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                      title="Align Center"
                    >
                      <AlignCenter className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateFieldProp(selectedFieldId, 'textAlign', 'right')}
                      className={`flex-1 py-1.5 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                        selectedField.textAlign === 'right' ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-500 hover:bg-gray-100'
                      }`}
                      title="Align Right"
                    >
                      <AlignRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* 5. Bounding Box Width Limit */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center space-x-1">
                      <MoveHorizontal className="w-3.5 h-3.5 text-indigo-600" />
                      <label className="text-[11px] font-bold text-gray-700">Box Width Limit</label>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-700">
                      {Math.round(selectedField.boxWidth || 35)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="95"
                    step="1"
                    value={selectedField.boxWidth || 35}
                    onChange={(e) => updateFieldProp(selectedFieldId, 'boxWidth', Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                    {[
                      { label: '25%', val: 25 },
                      { label: '35%', val: 35 },
                      { label: '50%', val: 50 },
                      { label: '75%', val: 75 }
                    ].map(preset => (
                      <button
                        key={preset.val}
                        type="button"
                        onClick={() => updateFieldProp(selectedFieldId, 'boxWidth', preset.val)}
                        className={`px-1.5 py-0.5 text-[10px] font-bold rounded border transition-colors cursor-pointer ${
                          Math.round(selectedField.boxWidth || 35) === preset.val
                            ? 'bg-indigo-50 border-indigo-300 text-indigo-700'
                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-100'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 6. Letter Spacing */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-bold text-gray-700">Letter Spacing</label>
                    <span className="text-xs font-mono font-bold text-indigo-700">{selectedField.letterSpacing || 0}px</span>
                  </div>
                  <input
                    type="range"
                    min="-2"
                    max="14"
                    step="0.5"
                    value={selectedField.letterSpacing || 0}
                    onChange={(e) => updateFieldProp(selectedFieldId, 'letterSpacing', Number(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                {/* 6. Text Shadow / Glow Preset */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Text Shadow & Glow</label>
                  <select
                    value={selectedField.shadow || 'none'}
                    onChange={(e) => updateFieldProp(selectedFieldId, 'shadow', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {SHADOW_PRESETS.map(sp => (
                      <option key={sp.value} value={sp.value}>{sp.label}</option>
                    ))}
                  </select>
                </div>

                {/* 7. Badge Pill / Highlight */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Badge Background Pill</label>
                  <select
                    value={selectedField.badgeBg || 'none'}
                    onChange={(e) => updateFieldProp(selectedFieldId, 'badgeBg', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    {BADGE_PRESETS.map(bp => (
                      <option key={bp.value} value={bp.value}>{bp.label}</option>
                    ))}
                  </select>
                </div>

                {/* 8. Text Formatting Toggles (Bold, Italic, Uppercase) */}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 mb-1">Style Modifiers</label>
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      onClick={() => updateFieldProp(selectedFieldId, 'bold', !selectedField.bold)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        selectedField.bold ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      B
                    </button>
                    <button
                      type="button"
                      onClick={() => updateFieldProp(selectedFieldId, 'italic', !selectedField.italic)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold italic border transition-all cursor-pointer ${
                        selectedField.italic ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      I
                    </button>
                    <button
                      type="button"
                      onClick={() => updateFieldProp(selectedFieldId, 'uppercase', !selectedField.uppercase)}
                      className={`flex-1 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        selectedField.uppercase ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      TT
                    </button>
                  </div>
                </div>

              </div>

            </div>
          )}

        </div>

        {/* Right Template Library & Draggable Layers Panel (Col 4) */}
        <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-xl p-5 sm:p-6 shadow-2xs space-y-5">
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <div className="flex items-center space-x-2">
              <Layers className="w-5 h-5 text-gray-700" />
              <h3 className="text-base font-bold text-gray-900">Template Library</h3>
            </div>
            <span className="px-2 py-0.5 text-xs font-extrabold bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
              Result Poster Active
            </span>
          </div>

          {/* List of Templates - Active Result Posters (Max 5) and Other Certificates */}
          <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
            {/* 1. Result Posters Section */}
            <div>
              <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                <span>Result Posters ({activePosterSlots.length}/5)</span>
                {activePosterSlots.length < 5 && (
                  <button
                    type="button"
                    onClick={handleAddPosterSlot}
                    className="text-indigo-600 hover:text-indigo-800 font-extrabold text-[10px] cursor-pointer"
                  >
                    + Add New
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {activePosterSlots.map((slot, index) => {
                  const isSelected = activeTemplateId === slot.id;
                  const t = templates[slot.id];
                  const isCustom = Boolean(t?.status === 'Custom' || t?.bgImage);

                  return (
                    <div
                      key={slot.id}
                      onClick={() => setActiveTemplateId(slot.id)}
                      className={`p-2 rounded-xl border transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'border-indigo-600 bg-indigo-50/70 shadow-2xs'
                          : 'border-gray-100 hover:border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center space-x-2">
                        <div className={`w-2.5 h-2.5 rounded-full border-2 ${
                          isCustom ? 'border-emerald-600 bg-emerald-500' : 'border-indigo-600 bg-indigo-500'
                        }`} />
                        <span className={`text-xs font-bold ${isSelected ? 'text-indigo-700 font-extrabold' : 'text-gray-900'}`}>
                          {slot.label}
                        </span>
                      </div>

                      <div className="flex items-center space-x-1.5">
                        <span className={`px-2 py-0.5 text-[9px] font-bold rounded-md ${
                          isCustom ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {isCustom ? 'Configured' : 'Blank'}
                        </span>
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePosterSlot(slot.id);
                            }}
                            title={`Delete ${slot.label}`}
                            className="p-1 text-gray-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2. Other Certificate Types (Coming Soon) */}
            <div>
              <div className="text-[10px] font-extrabold text-gray-400 uppercase tracking-wider mb-1.5">
                Certificates (Coming Soon)
              </div>
              <div className="space-y-1">
                {OTHER_CERTIFICATE_TYPES.map((item) => (
                  <div
                    key={item.id}
                    className="p-2 rounded-xl border border-gray-100 bg-gray-50/70 opacity-55 flex items-center justify-between cursor-not-allowed"
                  >
                    <div className="flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 rounded-full border-2 border-gray-300 bg-gray-100" />
                      <span className="text-xs font-bold text-gray-500">{item.title}</span>
                    </div>
                    <span className="px-1.5 py-0.5 text-[9px] font-bold bg-gray-100 text-gray-400 rounded">
                      Coming Soon
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section: DRAGGABLE POSTER ELEMENTS */}
          <div className="pt-3 border-t border-gray-100 space-y-4">
            
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Poster Canvas Layers
                </h4>
                <p className="text-[11px] text-gray-500">
                  Drag items onto canvas or click to add / edit
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddCustomField}
                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold flex items-center space-x-1 cursor-pointer transition-colors shadow-2xs"
                title="Add a custom text label or watermark"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Custom Text</span>
              </button>
            </div>

            {/* Structured Groups of Drag & Drop Items */}
            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1">

              {/* 1. First Place Winner Group */}
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Trophy className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-extrabold text-amber-900">🥇 1st Place Winner</span>
                  </div>
                  <span className="text-[10px] font-bold text-amber-700">Separate Layers</span>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {FIRST_PLACE_GROUP.map((item) => {
                    const isEnabled = currentTemplate.fields[item.id]?.enabled;
                    const isSelected = selectedFieldId === item.id;
                    const ItemIcon = item.icon;

                    return (
                      <div
                        key={item.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onClick={() => {
                          if (isEnabled) {
                            setSelectedFieldId(item.id);
                            if (PARTICIPANT_FIELDS.includes(item.id)) {
                              cycleRandomStudentForField(item.id);
                            }
                          } else {
                            toggleFieldEnabled(item.id);
                          }
                        }}
                        className={`p-2 rounded-lg border flex items-center justify-between cursor-grab active:cursor-grabbing transition-all select-none ${
                          isSelected
                            ? 'bg-amber-100 border-amber-400 ring-1 ring-amber-400 shadow-2xs'
                            : isEnabled
                              ? 'bg-white border-amber-200 hover:bg-amber-50/80'
                              : 'bg-white/70 border-gray-200 text-gray-400 hover:bg-white hover:text-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <GripVertical className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <ItemIcon className={`w-3.5 h-3.5 ${isEnabled ? 'text-amber-700' : 'text-gray-400'}`} />
                          <span className={`text-xs font-bold ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                            {item.label}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {isEnabled ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFieldEnabled(item.id);
                              }}
                              title="Click to remove layer from canvas"
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 group/lbtn cursor-pointer transition-colors"
                            >
                              <Check className="w-3 h-3 stroke-[3] group-hover/lbtn:hidden" />
                              <X className="w-3 h-3 stroke-[3] hidden group-hover/lbtn:inline" />
                              <span className="group-hover/lbtn:hidden">On Canvas</span>
                              <span className="hidden group-hover/lbtn:inline">Remove</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFieldEnabled(item.id);
                              }}
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-transparent cursor-pointer transition-colors"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 2. Second Place Winner Group */}
              <div className="p-3 bg-slate-100/60 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Medal className="w-4 h-4 text-slate-600" />
                    <span className="text-xs font-extrabold text-slate-800">🥈 2nd Place Winner</span>
                  </div>
                  <span className="text-[10px] font-bold text-slate-600">Separate Layers</span>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {SECOND_PLACE_GROUP.map((item) => {
                    const isEnabled = currentTemplate.fields[item.id]?.enabled;
                    const isSelected = selectedFieldId === item.id;
                    const ItemIcon = item.icon;

                    return (
                      <div
                        key={item.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onClick={() => {
                          if (isEnabled) {
                            setSelectedFieldId(item.id);
                            if (PARTICIPANT_FIELDS.includes(item.id)) {
                              cycleRandomStudentForField(item.id);
                            }
                          } else {
                            toggleFieldEnabled(item.id);
                          }
                        }}
                        className={`p-2 rounded-lg border flex items-center justify-between cursor-grab active:cursor-grabbing transition-all select-none ${
                          isSelected
                            ? 'bg-slate-200 border-slate-400 ring-1 ring-slate-400 shadow-2xs'
                            : isEnabled
                              ? 'bg-white border-slate-200 hover:bg-slate-50'
                              : 'bg-white/70 border-gray-200 text-gray-400 hover:bg-white hover:text-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <GripVertical className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <ItemIcon className={`w-3.5 h-3.5 ${isEnabled ? 'text-slate-700' : 'text-gray-400'}`} />
                          <span className={`text-xs font-bold ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                            {item.label}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {isEnabled ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFieldEnabled(item.id);
                              }}
                              title="Click to remove layer from canvas"
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 group/lbtn cursor-pointer transition-colors"
                            >
                              <Check className="w-3 h-3 stroke-[3] group-hover/lbtn:hidden" />
                              <X className="w-3 h-3 stroke-[3] hidden group-hover/lbtn:inline" />
                              <span className="group-hover/lbtn:hidden">On Canvas</span>
                              <span className="hidden group-hover/lbtn:inline">Remove</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFieldEnabled(item.id);
                              }}
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-transparent cursor-pointer transition-colors"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 3. Third Place Winner Group */}
              <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-200/80 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Award className="w-4 h-4 text-orange-700" />
                    <span className="text-xs font-extrabold text-orange-900">🥉 3rd Place Winner</span>
                  </div>
                  <span className="text-[10px] font-bold text-orange-700">Separate Layers</span>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {THIRD_PLACE_GROUP.map((item) => {
                    const isEnabled = currentTemplate.fields[item.id]?.enabled;
                    const isSelected = selectedFieldId === item.id;
                    const ItemIcon = item.icon;

                    return (
                      <div
                        key={item.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onClick={() => {
                          if (isEnabled) {
                            setSelectedFieldId(item.id);
                            if (PARTICIPANT_FIELDS.includes(item.id)) {
                              cycleRandomStudentForField(item.id);
                            }
                          } else {
                            toggleFieldEnabled(item.id);
                          }
                        }}
                        className={`p-2 rounded-lg border flex items-center justify-between cursor-grab active:cursor-grabbing transition-all select-none ${
                          isSelected
                            ? 'bg-orange-100 border-orange-400 ring-1 ring-orange-400 shadow-2xs'
                            : isEnabled
                              ? 'bg-white border-orange-200 hover:bg-orange-50/80'
                              : 'bg-white/70 border-gray-200 text-gray-400 hover:bg-white hover:text-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <GripVertical className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <ItemIcon className={`w-3.5 h-3.5 ${isEnabled ? 'text-orange-800' : 'text-gray-400'}`} />
                          <span className={`text-xs font-bold ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                            {item.label}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {isEnabled ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFieldEnabled(item.id);
                              }}
                              title="Click to remove layer from canvas"
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 group/lbtn cursor-pointer transition-colors"
                            >
                              <Check className="w-3 h-3 stroke-[3] group-hover/lbtn:hidden" />
                              <X className="w-3 h-3 stroke-[3] hidden group-hover/lbtn:inline" />
                              <span className="group-hover/lbtn:hidden">On Canvas</span>
                              <span className="hidden group-hover/lbtn:inline">Remove</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFieldEnabled(item.id);
                              }}
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-transparent cursor-pointer transition-colors"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 4. Program & Event Details Group */}
              <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-200/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5">
                    <Sparkles className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-extrabold text-indigo-950">📋 Program & Event Header</span>
                  </div>
                  <span className="text-[10px] font-bold text-indigo-600">Info Layers</span>
                </div>

                <div className="grid grid-cols-1 gap-1.5">
                  {HEADER_EVENT_GROUP.map((item) => {
                    const isEnabled = currentTemplate.fields[item.id]?.enabled;
                    const isSelected = selectedFieldId === item.id;
                    const ItemIcon = item.icon;

                    return (
                      <div
                        key={item.id}
                        draggable={true}
                        onDragStart={(e) => handleDragStart(e, item.id)}
                        onClick={() => {
                          if (isEnabled) {
                            setSelectedFieldId(item.id);
                            if (PARTICIPANT_FIELDS.includes(item.id)) {
                              cycleRandomStudentForField(item.id);
                            }
                          } else {
                            toggleFieldEnabled(item.id);
                          }
                        }}
                        className={`p-2 rounded-lg border flex items-center justify-between cursor-grab active:cursor-grabbing transition-all select-none ${
                          isSelected
                            ? 'bg-indigo-100 border-indigo-400 ring-1 ring-indigo-400 shadow-2xs'
                            : isEnabled
                              ? 'bg-white border-indigo-200 hover:bg-indigo-50/80'
                              : 'bg-white/70 border-gray-200 text-gray-400 hover:bg-white hover:text-gray-700'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          <GripVertical className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <ItemIcon className={`w-3.5 h-3.5 ${isEnabled ? 'text-indigo-700' : 'text-gray-400'}`} />
                          <span className={`text-xs font-bold ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                            {item.label}
                          </span>
                        </div>

                        <div className="flex items-center space-x-1.5">
                          {isEnabled ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFieldEnabled(item.id);
                              }}
                              title="Click to remove layer from canvas"
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center space-x-1 hover:bg-rose-50 hover:text-rose-700 hover:border-rose-200 group/lbtn cursor-pointer transition-colors"
                            >
                              <Check className="w-3 h-3 stroke-[3] group-hover/lbtn:hidden" />
                              <X className="w-3 h-3 stroke-[3] hidden group-hover/lbtn:inline" />
                              <span className="group-hover/lbtn:hidden">On Canvas</span>
                              <span className="hidden group-hover/lbtn:inline">Remove</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFieldEnabled(item.id);
                              }}
                              className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-gray-100 text-gray-600 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-transparent cursor-pointer transition-colors"
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 5. Custom Dynamic Text Layers */}
              {customFieldsList.length > 0 && (
                <div className="p-3 bg-purple-50/40 rounded-xl border border-purple-200/70 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-purple-950">Custom Text Layers</span>
                    <span className="text-[10px] font-bold text-purple-600">{customFieldsList.length} Layers</span>
                  </div>

                  <div className="grid grid-cols-1 gap-1.5">
                    {customFieldsList.map((cf) => {
                      const isSelected = selectedFieldId === cf.id;
                      return (
                        <div
                          key={cf.id}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, cf.id)}
                          onClick={() => setSelectedFieldId(cf.id)}
                          className={`p-2 rounded-lg border flex items-center justify-between cursor-grab active:cursor-grabbing transition-all select-none ${
                            isSelected
                              ? 'bg-purple-100 border-purple-400 ring-1 ring-purple-400 shadow-2xs'
                              : 'bg-white border-purple-200 hover:bg-purple-50'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <GripVertical className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <Type className="w-3.5 h-3.5 text-purple-700" />
                            <span className="text-xs font-bold text-gray-900">{cf.label}</span>
                          </div>

                          <div className="flex items-center space-x-1">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteField(cf.id);
                              }}
                              className="p-1 hover:bg-rose-100 text-rose-600 rounded-md"
                              title="Delete layer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

            </div>

            {/* Save Layout Button */}
            <button
              type="button"
              onClick={() => saveTemplates(templates)}
              disabled={saving}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-wait text-white text-xs font-bold rounded-xl shadow-2xs transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save Result Poster Template'}</span>
            </button>

          </div>

        </div>

      </div>

      {/* High-Res Full-Screen Preview Modal */}
      {previewModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl max-w-4xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="text-lg font-bold text-gray-900">
                  Full Preview: Program Result Poster
                </h3>
                <p className="text-xs text-gray-500">Live preview with database sample values</p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex justify-center p-4 bg-slate-100 rounded-2xl overflow-hidden">
              <div
                style={{
                  aspectRatio: currentTemplate.aspectRatio ? `${currentTemplate.aspectRatio}` : '3/4'
                }}
                className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden border border-gray-200"
              >
                {currentTemplate.bgImage ? (
                  <img
                    src={currentTemplate.bgImage}
                    alt="Certificate Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full min-h-[400px] bg-slate-50 flex items-center justify-center text-xs font-bold text-gray-400">
                    No custom image uploaded yet
                  </div>
                )}

                {Object.values(currentTemplate.fields || {}).map((f) => {
                  if (!f.enabled) return null;
                  const displayText = sampleData[f.id] || f.sample || '';
                  const shadowObj = SHADOW_PRESETS.find(s => s.value === f.shadow);
                  const badgeObj = BADGE_PRESETS.find(b => b.value === f.badgeBg);

                  return (
                    <div
                      key={f.id}
                      style={{
                        left: `${f.x}%`,
                        top: `${f.y}%`,
                        width: `${f.boxWidth || 35}%`,
                        transform: certificateTransform(f.textAlign),
                        fontSize: `${f.fontSize || 16}px`,
                        color: f.color || '#000000',
                        fontFamily: certificateFontCss(f.fontFamily),
                        textAlign: f.textAlign || 'center',
                        fontWeight: f.bold ? 'bold' : 'normal',
                        fontStyle: f.italic ? 'italic' : 'normal',
                        letterSpacing: `${f.letterSpacing || 0}px`,
                        textTransform: f.uppercase ? 'uppercase' : 'none',
                        textShadow: shadowObj && shadowObj.value !== 'none' ? shadowObj.css : 'none',
                        wordBreak: 'break-word',
                        overflowWrap: 'break-word',
                        whiteSpace: 'normal',
                        lineHeight: 1.25,
                      }}
                      className={`absolute z-30 px-2 py-0.5 select-none ${badgeObj?.className || ''}`}
                    >
                      {displayText}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={downloading || !currentTemplate.bgImage}
                className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 disabled:opacity-50 text-emerald-700 border border-emerald-200 text-xs font-bold rounded-xl transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4" />
                <span>Download PNG</span>
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloading || !currentTemplate.bgImage}
                className="px-4 py-2.5 bg-indigo-50 hover:bg-indigo-100 disabled:opacity-50 text-indigo-700 border border-indigo-200 text-xs font-bold rounded-xl transition-colors inline-flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{downloading ? 'Generating PDF...' : 'Download PDF'}</span>
              </button>
              <button
                type="button"
                onClick={() => setPreviewModalOpen(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default EventCertificates;
