import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Clipboard, 
  FileSpreadsheet, 
  PhoneCall, 
  Trophy, 
  BadgeCheck, 
  Award, 
  Download, 
  Trash2, 
  Plus, 
  X, 
  CheckCircle2, 
  Check,
  FileText,
  Sliders,
  Loader2,
  Copy,
  Info,
  Sparkles,
  Search,
  ChevronDown
} from 'lucide-react';
import { 
  eventProgramsAPI, 
  eventCallingSheetAPI,
  eventGreenRoomAPI,
  eventValuationAPI,
  eventCallListAPI,
  eventCertificatesAPI,
  markEntryAPI,
  teamsAPI
} from '../../services/api';

const escapeHtml = (value) => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const getParticipantName = (participant, fallback = 'Participant Name') => {
  const student = participant?.student_details || participant?.student || {};
  const combinedName = `${student.first_name || ''} ${student.last_name || ''}`.trim();
  return participant?.name?.trim()
    || participant?.participant_name?.trim()
    || participant?.student_name?.trim()
    || student.full_name?.trim()
    || student.display_name?.trim()
    || student.name?.trim()
    || combinedName
    || fallback;
};

const getTeamName = (participant, fallback = 'Team Unit') => participant?.team_details?.name?.trim()
  || participant?.team?.name?.trim()
  || participant?.team_name?.trim()
  || fallback;

const getAssignmentChest = (assignment) => assignment?.chest_number
  || assignment?.student_details?.chest_number
  || assignment?.student?.chest_number
  || '';

const groupDocumentAssignments = (program, assignments = []) => {
  if (!program?.is_team_based) {
    return assignments.map(assignment => ({
      chestNo: getAssignmentChest(assignment),
      codeLetter: assignment?.code_letter || assignment?.code || '',
      participantNames: getParticipantName(assignment, ''),
      teamName: getTeamName(assignment, 'Individual'),
      members: [assignment]
    }));
  }

  const grouped = new Map();
  assignments.forEach(assignment => {
    const teamId = assignment.team_id || assignment.team || 'team';
    const subTeam = assignment.sub_team_number || 1;
    const key = `${teamId}-${subTeam}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(assignment);
  });

  return Array.from(grouped.values()).map(members => {
    const ordered = [...members].sort((a, b) => Number(Boolean(b.is_leader)) - Number(Boolean(a.is_leader)));
    const chestNumbers = ordered.map(getAssignmentChest).filter(Boolean);
    const participantNames = ordered.map(member => {
      const name = getParticipantName(member, 'Participant');
      const chest = getAssignmentChest(member);
      return chest ? `${name} (${chest})` : name;
    }).join(', ');
    const codeLetter = ordered.find(m => m.code_letter || m.code)?.code_letter || ordered.find(m => m.code_letter || m.code)?.code || '';
    return {
      chestNo: chestNumbers.join(', '),
      codeLetter,
      participantNames,
      teamName: getTeamName(ordered[0], 'Team'),
      members: ordered
    };
  });
};

const formatCategory = (program) => program?.category_display || String(program?.category || 'General')
  .replace(/[_-]+/g, ' ')
  .replace(/\b\w/g, char => char.toUpperCase());

const formatStanding = (position) => {
  const value = Number(position);
  if (!Number.isFinite(value) || value <= 0) return '-';
  const mod100 = value % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${value}th`;
  if (value % 10 === 1) return `${value}st`;
  if (value % 10 === 2) return `${value}nd`;
  if (value % 10 === 3) return `${value}rd`;
  return `${value}th`;
};

const formatResultParticipant = (result) => {
  if (Array.isArray(result?.participant_members) && result.participant_members.length > 0) {
    return result.participant_members.map((member) => {
      if (typeof member === 'string') return member;
      return member.chest_number
        ? `${member.name || 'Participant'} (${member.chest_number})`
        : (member.name || 'Participant');
    }).join(', ');
  }
  return result?.participant_name || result?.student_name || result?.name || 'Participant';
};

const getRelativeTime = (timestamp) => {
  if (!timestamp) return 'Just now';
  const date = new Date(timestamp);
  if (isNaN(date.getTime())) return timestamp || 'Just now';

  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);

  if (diffSec < 10) return 'Just now';
  if (diffSec < 60) return `${diffSec}s ago`;

  const minutes = Math.floor(diffSec / 60);
  if (minutes < 60) return `${minutes} min${minutes > 1 ? 's' : ''} ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days > 1 ? 's' : ''} ago`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`;

  const years = Math.floor(days / 365);
  return `${years} year${years > 1 ? 's' : ''} ago`;
};

const ExportSummaryCell = ({ item, programs = [], teams = [] }) => {
  const [hovered, setHovered] = useState(false);

  // Extract structured key-value parameters from the item
  const details = [];

  // 1. Scope (Competition / Category / Team)
  if (item.programId && item.programId !== 'all') {
    const prog = programs.find(p => p.id === parseInt(item.programId, 10));
    details.push({ label: 'Competition', value: prog ? prog.name : `Competition #${item.programId}` });
  } else {
    details.push({ label: 'Competition Scope', value: 'All Competitions' });
  }

  if (item.category && item.category !== 'all') {
    details.push({ label: 'Category', value: item.category.toUpperCase() });
  } else {
    details.push({ label: 'Category Scope', value: 'All Categories' });
  }

  if (item.selectedTeamId && item.selectedTeamId !== 'all') {
    const tm = teams.find(t => t.id === parseInt(item.selectedTeamId, 10));
    details.push({ label: 'Team', value: tm ? tm.name : `Team #${item.selectedTeamId}` });
  }

  // 2. Type-specific parameters
  if (item.type === 'results') {
    if (item.resultDocMode === 'posters') {
      const modeLabel = item.posterSelection === 'alternating' 
        ? 'Shuffled / Alternating' 
        : (item.posterSelection === 'poster_wise' ? 'All Posters' : 'Poster Template');
      details.push({ label: 'Poster Selection', value: modeLabel });
      details.push({ label: 'File Format', value: item.posterFormat === 'jpg' ? 'JPG (ZIP)' : 'PDF' });
      details.push({ label: 'Sort Order', value: item.posterOrder === 'result_number' ? 'Result Number' : 'Schedule Order' });
    } else {
      details.push({ label: 'Document Type', value: 'Official Result Sheets' });
      details.push({ label: 'Status Filter', value: 'Published Results Only' });
    }
  } else if (item.type === 'valuation') {
    details.push({ label: 'Copies per Judge', value: `${item.copiesCount || 3} Copies` });
    details.push({ label: 'Max Marks', value: `${item.judgeMaxMarks || 100} Marks` });
  } else if (item.type === 'green_room') {
    details.push({ label: 'Layout', value: 'Single page per competition' });
    details.push({ label: 'Code Letters', value: 'Blank for manual entry' });
  } else if (item.type === 'call_list') {
    const modeLabel = item.callListMode === 'participant'
      ? 'Participant List'
      : (item.callListMode === 'team' ? 'Team Wise' : 'Competition Wise');
    details.push({ label: 'Call List Mode', value: modeLabel });
  } else if (item.type === 'certificate') {
    details.push({ label: 'Export Quality', value: `${(item.exportQuality || 'screen').toUpperCase()}` });
    details.push({ label: 'Selected Types', value: `${(item.certTypes || []).length} selected` });
  } else if (item.type === 'badge') {
    details.push({ label: 'Export Quality', value: `${(item.exportQuality || 'screen').toUpperCase()}` });
    details.push({ label: 'Layout', value: '9 Badges per A4 Sheet' });
  }

  // Derive visible badges for the badge row
  // Clean badges without messy hardcoded '+4', '+8', or legacy boilerplate strings
  const legacyFiller = [
    'Gender: All genders', 
    'Schedule: All schedule states', 
    'Scheduled stages: All stages', 
    'Standings: All standings', 
    'Range: Result 1 to All'
  ];
  const rawPills = (item.pills || []).filter(
    p => typeof p === 'string' && !p.startsWith('+') && !legacyFiller.includes(p)
  );

  let visiblePills = [];
  if (rawPills.length > 0) {
    visiblePills = rawPills.slice(0, 2);
  } else {
    if (item.resultDocMode === 'posters') {
      visiblePills.push('E-Posters');
      visiblePills.push(item.posterFormat === 'jpg' ? 'Format: JPG (ZIP)' : 'Format: PDF');
    } else if (item.type === 'valuation') {
      visiblePills.push(`${item.copiesCount || 3} Copies`);
      if (item.category && item.category !== 'all') {
        visiblePills.push(`Cat: ${item.category.toUpperCase()}`);
      }
    } else if (item.category && item.category !== 'all') {
      visiblePills.push(`Cat: ${item.category.toUpperCase()}`);
    } else {
      visiblePills.push('All Categories');
    }
  }

  const remainingCount = Math.max(0, details.length - visiblePills.length);

  const getBadgeClass = (pillText) => {
    const lower = String(pillText).toLowerCase();
    if (lower.includes('poster') || lower.includes('certificate')) {
      return 'bg-indigo-50 text-indigo-700 border-indigo-200/80 font-semibold';
    }
    if (lower.includes('jpg') || lower.includes('zip') || lower.includes('format')) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200/80 font-semibold';
    }
    if (lower.includes('category') || lower.includes('cat:') || lower.includes('cat ')) {
      return 'bg-amber-50 text-amber-700 border-amber-200/80 font-medium';
    }
    if (lower.includes('copies') || lower.includes('mark') || lower.includes('page')) {
      return 'bg-sky-50 text-sky-700 border-sky-200/80 font-medium';
    }
    return 'bg-gray-100/90 text-gray-700 border-gray-200/80 font-medium';
  };

  return (
    <div className="flex flex-col gap-1.5 py-0.5 max-w-sm">
      {/* Top Row: Clean, Bold Title on its own line */}
      <div className="text-xs font-semibold text-gray-900 leading-snug">
        {item.summary}
      </div>

      {/* Bottom Row: Dedicated metadata badges line */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {visiblePills.map((pill, idx) => (
          <span
            key={idx}
            className={`px-2 py-0.5 text-[11px] rounded-md border ${getBadgeClass(pill)} whitespace-nowrap`}
          >
            {pill}
          </span>
        ))}

        {/* Overflow Badge (+N) with Hover Popover */}
        {remainingCount > 0 && (
          <div
            className="relative inline-flex items-center"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <button
              type="button"
              className="px-1.5 py-0.5 text-[10px] font-bold bg-gray-100 text-gray-700 rounded-md border border-gray-200 hover:bg-gray-200 transition-colors cursor-pointer select-none"
            >
              +{remainingCount}
            </button>

            {hovered && (
              <div className="absolute left-0 top-full mt-1.5 z-50 w-72 p-3 bg-white border border-gray-200 rounded-xl shadow-xl space-y-2 pointer-events-none animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-1.5 border-b border-gray-100">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-gray-400">
                    Export Parameters
                  </span>
                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-100">
                    {item.typeName}
                  </span>
                </div>
                <div className="space-y-1.5">
                  {details.map((d, idx) => (
                    <div key={idx} className="flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 font-medium">{d.label}:</span>
                      <span className="font-semibold text-gray-800 text-right ml-2 truncate max-w-[150px]">
                        {d.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const SearchableCompetitionSelect = ({
  programs = [],
  selectedProgramId,
  onChange,
  selectedCategory = 'all'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const containerRef = useRef(null);
  const searchInputRef = useRef(null);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, 50);
    } else {
      setSearchQuery('');
    }
  }, [isOpen]);

  // Sort all programs alphabetically by name (A to Z)
  const sortedPrograms = useMemo(() => {
    return [...programs].sort((a, b) => 
      (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' })
    );
  }, [programs]);

  // Filter based on selectedCategory and searchQuery
  const filteredPrograms = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    let list = sortedPrograms;

    if (selectedCategory && selectedCategory !== 'all') {
      const categoryMatches = list.filter(p => p.category === selectedCategory);
      if (categoryMatches.length > 0) {
        list = categoryMatches;
      }
    }

    if (!q) {
      return list;
    }

    const matches = list.filter(p => {
      const name = (p.name || '').toLowerCase();
      const cat = (p.category || '').toLowerCase();
      const code = String(p.program_code || p.code || p.id || '').toLowerCase();
      const type = (p.program_type || '').toLowerCase();
      return name.includes(q) || cat.includes(q) || code.includes(q) || type.includes(q);
    });

    // If no matches in category, search across all programs so user is never stranded
    if (matches.length === 0 && selectedCategory !== 'all') {
      return sortedPrograms.filter(p => {
        const name = (p.name || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        const code = String(p.program_code || p.code || p.id || '').toLowerCase();
        const type = (p.program_type || '').toLowerCase();
        return name.includes(q) || cat.includes(q) || code.includes(q) || type.includes(q);
      });
    }

    return matches;
  }, [sortedPrograms, selectedCategory, searchQuery]);

  // Currently selected program object
  const currentProgram = useMemo(() => {
    if (selectedProgramId === 'all' || !selectedProgramId) return null;
    return programs.find(p => String(p.id) === String(selectedProgramId)) || null;
  }, [programs, selectedProgramId]);

  return (
    <div className="relative" ref={containerRef}>
      <label className="block text-xs font-bold text-gray-900 mb-1 flex items-center justify-between">
        <span>Competitions</span>
        <span className="text-[11px] font-normal text-gray-400">
          {programs.length} total (A–Z)
        </span>
      </label>

      {/* Trigger Button */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setIsOpen(!isOpen);
          }
        }}
        className={`w-full px-3.5 py-2.5 bg-white border rounded-xl text-xs font-medium transition-all flex items-center justify-between cursor-pointer select-none ${
          isOpen ? 'border-indigo-500 ring-2 ring-indigo-100 shadow-xs' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center space-x-2 min-w-0 flex-1 mr-2">
          {currentProgram ? (
            <>
              <span className="w-2 h-2 rounded-full bg-indigo-600 flex-shrink-0" />
              <span className="font-semibold text-gray-900 truncate">
                {currentProgram.name}
              </span>
              {currentProgram.category && (
                <span className="px-1.5 py-0.5 text-[10px] font-bold rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 uppercase flex-shrink-0">
                  {currentProgram.category}
                </span>
              )}
            </>
          ) : (
            <span className="text-gray-600 font-medium">All competitions...</span>
          )}
        </div>

        <div className="flex items-center space-x-1 flex-shrink-0">
          {currentProgram && (
            <span
              role="button"
              tabIndex={0}
              title="Clear selection (show all)"
              onClick={(e) => {
                e.stopPropagation();
                onChange('all');
              }}
              className="p-1 hover:bg-gray-100 rounded-md text-gray-400 hover:text-gray-700 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-indigo-600' : ''}`} />
        </div>
      </div>

      <p className="text-[11px] text-gray-400 mt-1">Leave empty to include all</p>

      {/* Dropdown Popover */}
      {isOpen && (
        <div 
          onClick={(e) => e.stopPropagation()}
          className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95"
        >
          {/* Search Box Header */}
          <div className="p-2.5 border-b border-gray-100 bg-gray-50/80">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    setIsOpen(false);
                  }
                }}
                placeholder="Search from 100+ competitions (A–Z)..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-gray-200 rounded-lg text-xs font-medium text-gray-800 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5 rounded cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-gray-400 font-medium">
              <span>Sorted Alphabetically (A–Z)</span>
              <span>{filteredPrograms.length} found</span>
            </div>
          </div>

          {/* List Options */}
          <div className="max-h-60 overflow-y-auto divide-y divide-gray-50">
            {/* Default "All competitions" item */}
            {(!searchQuery || 'all competitions'.includes(searchQuery.toLowerCase())) && (
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  onChange('all');
                  setIsOpen(false);
                }}
                className={`p-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                  selectedProgramId === 'all' || !selectedProgramId
                    ? 'bg-indigo-50/80 text-indigo-900 font-bold'
                    : 'hover:bg-gray-50 text-gray-700 font-medium'
                }`}
              >
                <div>
                  <div className="font-semibold text-gray-900">All competitions...</div>
                  <div className="text-[10px] text-gray-400">Generate documents for all competitions in category</div>
                </div>
                {(selectedProgramId === 'all' || !selectedProgramId) && (
                  <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                )}
              </div>
            )}

            {/* Program Items */}
            {filteredPrograms.length > 0 ? (
              filteredPrograms.map((p) => {
                const isSelected = String(selectedProgramId) === String(p.id);
                return (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      onChange(p.id);
                      setIsOpen(false);
                    }}
                    className={`p-2.5 flex items-center justify-between text-xs transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-50/80 text-indigo-900 font-bold'
                        : 'hover:bg-indigo-50/50 text-gray-700'
                    }`}
                  >
                    <div className="min-w-0 flex-1 mr-3">
                      <div className="flex items-center space-x-1.5">
                        <span className="font-semibold text-gray-900 truncate">
                          {p.name}
                        </span>
                        {p.program_code && (
                          <span className="text-[10px] text-gray-400 font-mono">
                            #{p.program_code}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-1.5 mt-0.5">
                        {p.category && (
                          <span className="px-1.5 py-0.2 text-[9px] font-bold rounded bg-gray-100 text-gray-600 uppercase">
                            {p.category}
                          </span>
                        )}
                        {p.is_team_based !== undefined && (
                          <span className="text-[10px] text-gray-400">
                            {p.is_team_based ? 'Group' : 'Individual'}
                          </span>
                        )}
                        {p.program_type && (
                          <span className="text-[10px] text-gray-400">
                            • {p.program_type}
                          </span>
                        )}
                      </div>
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="p-6 text-center text-xs text-gray-500">
                <p className="font-medium text-gray-700">No competitions found</p>
                <p className="text-[11px] text-gray-400 mt-0.5">
                  No matching competition for &quot;{searchQuery}&quot;
                </p>
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mt-2 text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
                >
                  Clear search query
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const EventDocuments = ({ event, eventId, categories = [] }) => {
  const [programs, setPrograms] = useState([]);
  const [teams, setTeams] = useState([]);
  const [exportsQueue, setExportsQueue] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [downloadingItemId, setDownloadingItemId] = useState(null);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const [, setTick] = useState(0);

  // Live timer to refresh relative time strings (e.g. "Just now" -> "1 min ago" -> "20 mins ago")
  useEffect(() => {
    const timer = setInterval(() => {
      setTick(t => t + 1);
    }, 10000);
    return () => clearInterval(timer);
  }, []);

  // Form State inside Create Export Drawer
  const [selectedExportType, setSelectedExportType] = useState('valuation');
  const [onlyWithParticipants, setOnlyWithParticipants] = useState(true);
  const [pageLayout, setPageLayout] = useState('single');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProgramId, setSelectedProgramId] = useState('all');
  const [selectedTeamId, setSelectedTeamId] = useState('all');
  const [callListMode, setCallListMode] = useState('competition'); // 'competition' or 'team'
  const [copiesCount, setCopiesCount] = useState(3);
  const [judgeMaxMarks, setJudgeMaxMarks] = useState(100);

  // Certificate Specific Filter State (Matching Screenshot)
  const [exportQuality, setExportQuality] = useState('screen'); // 'screen', 'standard', 'print'
  const [selectedCertTypes, setSelectedCertTypes] = useState(['participation']); // ['participation', 'first_place', 'second_place', 'third_place', 'common_prize', 'grade_certificate']

  // Result Specific Format & E-Poster State
  const [resultDocMode, setResultDocMode] = useState('sheet'); // 'sheet' or 'posters'
  const [resultPosterSelection, setResultPosterSelection] = useState('result_poster');
  const [resultPosterOrder, setResultPosterOrder] = useState('result_number');
  const [resultPosterFormat, setResultPosterFormat] = useState('pdf'); // 'pdf' or 'jpg'

  const storageKey = `eventloo_exports_queue_${eventId}`;

  useEffect(() => {
    fetchData();
    loadExportsQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);


  const fetchData = async () => {
    try {
      setLoading(true);
      const [progRes, teamRes] = await Promise.all([
        eventProgramsAPI.getPrograms(eventId, 'page_size=200').catch(() => ({ data: [] })),
        teamsAPI.getTeams().catch(() => ({ data: [] }))
      ]);
      const progs = Array.isArray(progRes?.data) ? progRes.data : (Array.isArray(progRes?.data?.results) ? progRes.data.results : []);
      const tms = Array.isArray(teamRes?.data) ? teamRes.data : (Array.isArray(teamRes?.data?.results) ? teamRes.data.results : []);
      setPrograms(progs);
      setTeams(tms);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExportsQueue = () => {
    try {
      const saved = sessionStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        const sanitized = parsed.map(item => ({
          ...item,
          createdAt: item.createdAt || new Date().toISOString()
        }));
        setExportsQueue(sanitized);
      } else {
        const initialQueue = [
          {
            id: 'exp-1',
            type: 'valuation',
            typeName: 'Valuation Sheet',
            icon: 'valuation',
            summary: 'Valuation sheets (3 Copies for Judges)',
            pills: ['Categories: General (GEN)', 'Copies: 3', 'Max Mark: 100'],
            status: 'completed',
            completedIn: '1.2s',
            copiesCount: 3,
            judgeMaxMarks: 100,
            createdAt: new Date().toISOString()
          },
          {
            id: 'exp-2',
            type: 'green_room',
            typeName: 'Green Room Sign',
            icon: 'green_room',
            summary: 'Green room signs',
            pills: ['Categories: General (GEN)', 'Layout: Single Page'],
            status: 'completed',
            completedIn: '0.9s',
            copiesCount: 1,
            judgeMaxMarks: 100,
            createdAt: new Date(Date.now() - 120000).toISOString()
          },
          {
            id: 'exp-3',
            type: 'results',
            typeName: 'Competition Results',
            icon: 'results',
            summary: 'Competition wise results for All teams',
            pills: ['Published results only', 'All categories'],
            status: 'completed',
            completedIn: '1.8s',
            copiesCount: 1,
            judgeMaxMarks: 100,
            createdAt: new Date(Date.now() - 3600000 * 3).toISOString()
          }
        ];
        setExportsQueue(initialQueue);
        sessionStorage.setItem(storageKey, JSON.stringify(initialQueue));
      }
    } catch (e) {
      console.error('Error loading exports queue:', e);
    }
  };

  const saveQueue = (updatedQueue) => {
    setExportsQueue(updatedQueue);
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(updatedQueue));
    } catch (e) {
      console.error('Error saving queue:', e);
    }
  };

  const handleDeleteExport = (exportId) => {
    const updated = exportsQueue.filter(item => item.id !== exportId);
    saveQueue(updated);
  };

  const toggleCertType = (typeId) => {
    setSelectedCertTypes(prev => 
      prev.includes(typeId) 
        ? (prev.length > 1 ? prev.filter(t => t !== typeId) : prev) 
        : [...prev, typeId]
    );
  };

  // Dynamic Printable PDF Generator applying Custom Configured Certificate Templates
  const generateClientPdfFallback = async (exportItem) => {
    let targetPrograms = programs;
    if (exportItem?.category && exportItem.category !== 'all') {
      targetPrograms = targetPrograms.filter(p => p.category === exportItem.category);
    }
    if (exportItem?.programId && exportItem.programId !== 'all') {
      targetPrograms = targetPrograms.filter(p => p.id === parseInt(exportItem.programId, 10));
    }
    if (exportItem.type === 'results') {
      targetPrograms = targetPrograms.filter(program => (
        program.is_published === true || program.result_status === 'published'
      ));
    } else if (targetPrograms.length === 0) {
      throw new Error('No programs match the selected export filters.');
    }

    const copies = exportItem?.copiesCount || 3;
    const maxMarkVal = exportItem?.judgeMaxMarks || 100;
    const printWin = window.open('', '_blank');
    if (!printWin) return;

    let pagesHtml = '';
    let pageCount = 0;

    if (exportItem.type === 'results') {
      const generatedAt = new Date();
      const generatedDate = generatedAt.toLocaleDateString('en-GB');
      const generatedTime = generatedAt.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
      });
      const targetEventId = eventId || event?.id;

      for (let i = 0; i < targetPrograms.length; i++) {
        const fallbackProgram = targetPrograms[i];
        let resultProgram = fallbackProgram;
        let programResults = [];

        try {
          const response = await markEntryAPI.getResultsSummary(targetEventId, fallbackProgram.id);
          resultProgram = response.data?.program || fallbackProgram;
          programResults = response.data?.results || [];
        } catch (error) {
          console.error(`Error fetching results for program ${fallbackProgram.id}:`, error);
        }

        programResults = programResults
          .filter(result => result.position || result.average_marks !== null || result.points_earned)
          .sort((a, b) => {
            if (a.position && b.position) return a.position - b.position;
            if (a.position) return -1;
            if (b.position) return 1;
            return Number(b.average_marks || 0) - Number(a.average_marks || 0);
          });

        if (exportItem.onlyWithParticipants !== false && programResults.length === 0) {
          continue;
        }

        pageCount++;
        const pageBreak = pageCount > 1 ? 'style="page-break-before: always;"' : '';
        const mode = resultProgram.is_team_based ? 'Group' : 'Individual';
        const stageType = resultProgram.program_type_display || (resultProgram.program_type ? resultProgram.program_type.replace(/_/g, ' ') : 'Stage');
        const categoryName = formatCategory(resultProgram);

        const rowsHtml = programResults.length > 0
          ? programResults.map(result => `
              <tr>
                <td class="result-standing">${escapeHtml(result.position_display || formatStanding(result.position))}</td>
                <td class="result-chest">${escapeHtml(result.chest_number || '-')}</td>
                <td class="result-candidate">${escapeHtml(formatResultParticipant(result))}</td>
                <td>${escapeHtml(result.team_name || '-')}</td>
                <td class="result-center">${escapeHtml(result.grade || '-')}</td>
                <td class="result-center">${escapeHtml(result.points_earned ?? 0)}</td>
              </tr>
            `).join('')
          : '<tr><td colspan="6" class="result-empty">No scored results available for this program.</td></tr>';

        pagesHtml += `
          <section class="result-page" ${pageBreak}>
            <div class="result-topline">
              <div class="result-event-name">${escapeHtml(event?.title || 'Eventloo Event')}</div>
              <div>${escapeHtml(`${generatedDate} ${generatedTime}`)}</div>
            </div>
            <h1 class="result-title">Competition Results</h1>
            <div class="result-program-meta">
              <div class="result-program-name">#${escapeHtml(resultProgram.id)} ${escapeHtml(String(resultProgram.name || 'Program').toUpperCase())}</div>
              <div class="result-mode">${escapeHtml(`${mode} - ${stageType}`)}</div>
              <div class="result-category">${escapeHtml(String(categoryName).toUpperCase())}</div>
            </div>
            <table class="results-table">
              <thead>
                <tr>
                  <th>Standing</th>
                  <th>Chest No</th>
                  <th>Candidate Name</th>
                  <th>Team</th>
                  <th>Grade</th>
                  <th>Points</th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
            <div class="result-total">Total entries: ${programResults.length}</div>
            <div class="doc-footer">Powered by <strong>eventloo.in</strong></div>
          </section>
        `;
      }

      if (pageCount === 0) {
        pagesHtml = `
          <section class="result-page">
            <div class="result-event-name">${escapeHtml(event?.title || 'Eventloo Event')}</div>
            <h1 class="result-title">Competition Results</h1>
            <div class="result-empty-state">No published results match the selected filters.</div>
            <div class="doc-footer">Powered by <strong>eventloo.in</strong></div>
          </section>
        `;
      }
    } else if (exportItem.type === 'call_list') {
      const mode = exportItem.callListMode || 'competition';
      const targetTeamId = exportItem.selectedTeamId || 'all';

      if (mode === 'team') {
        let targetTeams = teams;
        if (targetTeamId !== 'all') {
          targetTeams = targetTeams.filter(t => t.id === parseInt(targetTeamId, 10));
        }
        if (targetTeams.length === 0) throw new Error('No teams are available for this export.');

        for (let t = 0; t < targetTeams.length; t++) {
          const tm = targetTeams[t];
          pageCount++;
          const pageBreak = pageCount > 1 ? 'style="page-break-before: always;"' : '';

          const studentMap = {};
          for (const program of targetPrograms) {
            let assignments = [];
            try {
              const response = await eventCallingSheetAPI.getProgramParticipants(program.id);
              assignments = response.data?.results || response.data || [];
            } catch (error) {
              console.error(`Error fetching participants for program ${program.id}:`, error);
            }
            const teamAssignments = assignments.filter(assignment => (
              Number(assignment.team_id || assignment.team) === Number(tm.id)
            ));

            for (const a of teamAssignments) {
              const sid = a.student_id || a.student?.id || a.id;
              if (!studentMap[sid]) {
                const sName = a.student_name || (a.student?.first_name 
                  ? `${a.student.first_name || ''} ${a.student.last_name || ''}`.trim()
                  : (a.participant_names || 'Participant'));
                studentMap[sid] = {
                  name: sName,
                  chestNo: a.chest_number || a.student?.chest_number || '—',
                  category: a.category || a.student?.category || program.category || 'General',
                  gender: a.gender || a.student?.gender || '—',
                  competitions: []
                };
              }
              studentMap[sid].competitions.push({
                name: program.name,
                is_team_based: program.is_team_based,
                team_size: program.team_size
              });
            }
          }

          const sortedStudents = Object.values(studentMap).sort((a, b) => {
            const aNum = parseInt(a.chestNo, 10);
            const bNum = parseInt(b.chestNo, 10);
            if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
            return String(a.name).localeCompare(String(b.name));
          });

          let rows = '';
          sortedStudents.forEach((student, sIdx) => {
            const compHtml = student.competitions.map(c => {
              const countSuffix = (c.is_team_based && c.team_size) ? ` (${c.team_size} Participants)` : '';
              return `<div style="margin-bottom: 2px;">&bull; ${escapeHtml(c.name)}${escapeHtml(countSuffix)}</div>`;
            }).join('');

            rows += `
              <tr>
                <td class="center font-semibold" style="width: 7%; color: #64748b;">${sIdx + 1}</td>
                <td class="center font-bold" style="width: 13%; color: #4338ca;">${escapeHtml(student.chestNo)}</td>
                <td class="font-bold" style="width: 25%;">${escapeHtml(student.name)}</td>
                <td class="center" style="width: 15%; font-weight: 500;">${escapeHtml(student.category)}</td>
                <td class="center" style="width: 10%; text-transform: capitalize;">${escapeHtml(student.gender)}</td>
                <td style="width: 30%; line-height: 1.4;">${compHtml || '—'}</td>
              </tr>
            `;
          });

          let tablesHtml = '';
          if (sortedStudents.length > 0) {
            tablesHtml = `
              <table class="main-table">
                <thead>
                  <tr>
                    <th class="center" style="width: 7%;">#</th>
                    <th class="center" style="width: 13%;">Chest No</th>
                    <th style="width: 25%;">Participant</th>
                    <th class="center" style="width: 15%;">Category</th>
                    <th class="center" style="width: 10%;">Gender</th>
                    <th style="width: 30%;">Competitions</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
              <div style="text-align: right; font-size: 11px; font-weight: bold; color: #475569; margin-top: 8px;">
                Total participants: ${sortedStudents.length}
              </div>
            `;
          }

          pagesHtml += `
            <div class="program-page" ${pageBreak}>
              <div class="header">
                <div>${escapeHtml(event?.title || 'Event')}</div>
                <div>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              </div>
              <div class="title">Call List</div>
              <div class="subtitle">${escapeHtml(tm.name)}</div>
              <div class="hr"></div>
              ${tablesHtml}
              ${tablesHtml ? '' : '<div class="center">No assigned participants.</div>'}
              <div class="doc-footer">Powered by <strong>eventloo.in</strong></div>
            </div>
          `;
        }

      } else if (mode === 'participant') {
        pageCount++;
        const pageBreak = pageCount > 1 ? 'style="page-break-before: always;"' : '';
        const partMap = {};
        for (const program of targetPrograms) {
          let assignments = [];
          try {
            const response = await eventCallingSheetAPI.getProgramParticipants(program.id);
            assignments = response.data?.results || response.data || [];
          } catch (error) {
            console.error(`Error fetching participants for program ${program.id}:`, error);
          }
          if (targetTeamId !== 'all') {
            assignments = assignments.filter(a => Number(a.team_id || a.team) === Number(targetTeamId));
          }

          for (const a of assignments) {
            const sid = a.student_id || a.student?.id || a.id;
            if (!partMap[sid]) {
              const sName = a.student_name || (a.student?.first_name 
                ? `${a.student.first_name || ''} ${a.student.last_name || ''}`.trim()
                : (a.participant_names || 'Participant'));
              const tm = teams.find(t => t.id === Number(a.team_id || a.team));
              partMap[sid] = {
                chestNo: a.chest_number || a.student?.chest_number || '—',
                name: sName,
                gender: a.gender || a.student?.gender || '—',
                className: a.student?.grade ? `${a.student.grade} ${a.student.section || ''}`.trim() : (a.class_name || '—'),
                category: a.category || a.student?.category || program.category || 'General',
                teamName: tm?.name || a.team_name || '—'
              };
            }
          }
        }

        const sortedParts = Object.values(partMap).sort((a, b) => {
          const aNum = parseInt(a.chestNo, 10);
          const bNum = parseInt(b.chestNo, 10);
          if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
          return String(a.name).localeCompare(String(b.name));
        });

        let rows = '';
        sortedParts.forEach((p, idx) => {
          rows += `
            <tr>
              <td class="center font-semibold" style="width: 7%; color: #64748b;">${idx + 1}</td>
              <td class="center font-bold" style="width: 14%; color: #4338ca;">${escapeHtml(p.chestNo)}</td>
              <td class="font-bold" style="width: 25%;">${escapeHtml(p.name)}</td>
              <td class="center" style="width: 12%; text-transform: capitalize;">${escapeHtml(p.gender)}</td>
              <td class="center" style="width: 14%;">${escapeHtml(p.className)}</td>
              <td class="center font-medium" style="width: 14%;">${escapeHtml(p.category)}</td>
              <td class="center font-bold" style="width: 14%;">${escapeHtml(p.teamName)}</td>
            </tr>
          `;
        });

        const bannerTitle = targetTeamId !== 'all' 
          ? `Team: ${teams.find(t => t.id === parseInt(targetTeamId, 10))?.name || 'Selected Team'} (${sortedParts.length} Participants)`
          : `Official Verified Participant Roster (${sortedParts.length} Total Participants)`;

        pagesHtml += `
          <div class="program-page" ${pageBreak}>
            <div class="header">
              <div>${escapeHtml(event?.title || 'Event')}</div>
              <div>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
            <div class="title">Participant List</div>
            <div class="subtitle">${escapeHtml(bannerTitle)}</div>
            <div class="hr"></div>
            <table class="main-table">
              <thead>
                <tr>
                  <th class="center" style="width: 7%;">NO.</th>
                  <th class="center" style="width: 14%;">CHEST NO</th>
                  <th style="width: 25%;">STUDENT NAME</th>
                  <th class="center" style="width: 12%;">GENDER</th>
                  <th class="center" style="width: 14%;">CLASS</th>
                  <th class="center" style="width: 14%;">CATEGORY</th>
                  <th class="center" style="width: 14%;">TEAM</th>
                </tr>
              </thead>
              <tbody>
                ${rows || '<tr><td colspan="7" class="center">No participants found.</td></tr>'}
              </tbody>
            </table>
            <div style="text-align: right; font-size: 11px; font-weight: bold; color: #475569; margin-top: 8px;">
              Total participants: ${sortedParts.length}
            </div>
            <div class="doc-footer">Powered by <strong>eventloo.in</strong></div>
          </div>
        `;

      } else {
        for (let i = 0; i < targetPrograms.length; i++) {
          const prog = targetPrograms[i];
          const progName = (prog.name || 'PROGRAM').toUpperCase();
          const progCat = (prog.category || 'HIGHER SECONDARY').toUpperCase();
          const progType = prog.is_team_based ? 'Group' : 'Individual';

          let assignments = [];
          try {
            const res = await eventCallingSheetAPI.getProgramParticipants(prog.id);
            assignments = res.data?.results || res.data || [];
          } catch (e) {
            console.error('Error fetching participants:', e);
          }

          let rowsHtml = '';
          let slNo = 0;
          if (assignments.length > 0) {
            const documentRows = groupDocumentAssignments(prog, assignments);
            rowsHtml = documentRows.map(row => {
              slNo++;
              return `
                <tr>
                  <td class="center">${slNo}</td>
                  <td class="center font-bold">${escapeHtml(row.chestNo)}</td>
                  <td>${escapeHtml(row.participantNames)}</td>
                  <td>${escapeHtml(row.teamName)}</td>
                </tr>
              `;
            }).join('');
          } else {
            rowsHtml = '<tr><td colspan="4" class="center">No assigned participants.</td></tr>';
          }

          pageCount++;
          const pageBreak = pageCount > 1 ? 'style="page-break-before: always;"' : '';
          const stageDisplay = prog?.stage?.name || prog?.venue || '—';

          pagesHtml += `
            <div class="program-page" ${pageBreak}>
              <div class="header">
                <div>${escapeHtml(event?.school?.name || event?.title || 'Eventloo')}</div>
                <div>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              </div>
              <div class="title">Competitions Call List</div>
              
              <table class="info-box">
                <tbody>
                  <tr>
                    <td class="font-bold" style="width: 40%;"><strong>PROGRAM:</strong> ${escapeHtml(progName)}</td>
                    <td class="center font-bold" style="width: 24%;"><strong>CATEGORY:</strong> ${escapeHtml(progCat)}</td>
                    <td class="center font-bold" style="width: 18%;"><strong>MODE:</strong> ${escapeHtml(progType)}</td>
                    <td class="center font-bold" style="width: 18%;"><strong>STAGE:</strong> ${escapeHtml(stageDisplay)}</td>
                  </tr>
                </tbody>
              </table>

              <table class="main-table">
                <thead>
                  <tr>
                    <th class="center" style="width: 10%;">Sl. No</th>
                    <th class="center" style="width: 16%;">Chest No</th>
                    <th style="width: 44%;">Participant</th>
                    <th style="width: 30%;">Team Name</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
              <div class="total-part">Total participants: ${slNo}</div>
              <div class="doc-footer">Powered by <strong>eventloo.in</strong></div>
            </div>
          `;
        }
      }
    } else {

      for (let i = 0; i < targetPrograms.length; i++) {
        const prog = targetPrograms[i];
        const progName = (prog.name || 'PROGRAM').toUpperCase();
        const progCat = (prog.category || 'UPPER PRIMARY').toUpperCase();
        const progType = prog.is_team_based ? 'Group' : 'Individual';
        const stageDisplay = prog?.stage?.name || prog?.venue || '—';

        let assignments = [];
        try {
          const res = await eventCallingSheetAPI.getProgramParticipants(prog.id);
          assignments = res.data?.results || res.data || [];
        } catch (e) {
          console.error('Error fetching participants for pdf:', e);
        }

        if (exportItem.type === 'valuation') {
          let rowsHtml = '';
          let rowCount = 0;

          if (assignments.length > 0) {
            if (prog.is_team_based) {
              const subTeams = new Set();
              assignments.forEach(a => {
                const key = `${a.team_id || a.team || 'team'}-${a.sub_team_number || 1}`;
                subTeams.add(key);
              });
              rowCount = subTeams.size;
            } else {
              rowCount = assignments.length;
            }
          }

          const assignedJudgesMap = {};
          if (Array.isArray(prog.assigned_judges)) {
            prog.assigned_judges.forEach(j => {
              if (j.judge_number) {
                assignedJudgesMap[j.judge_number] = j.judge_name;
              }
            });
          }
          const assignedMax = Object.keys(assignedJudgesMap).length > 0
            ? Math.max(...Object.keys(assignedJudgesMap).map(Number))
            : 0;
          const judgeCount = Math.max(1, Math.min(
            Math.max(
              Number(prog.effective_num_judges || prog.num_judges || event?.num_judges || 3),
              assignedMax
            ),
            6
          ));

          const documentRows = assignments.length > 0 ? groupDocumentAssignments(prog, assignments) : [];
          const sortedDocRows = [...documentRows].sort((a, b) => (a.codeLetter || '').localeCompare(b.codeLetter || ''));
          rowCount = Math.max(sortedDocRows.length, rowCount);

          // Generate exact number of rows matching participating candidates / sub-teams
          for (let r = 0; r < rowCount; r++) {
            const judgeCells = Array.from({ length: judgeCount }, () => `<td style="padding: 14px 6px;"></td>`).join('');
            const cLetter = sortedDocRows[r]?.codeLetter || '';
            rowsHtml += `
              <tr>
                <td class="center font-bold" style="padding: 14px 6px;">${escapeHtml(cLetter)}</td>
                ${judgeCells}
              </tr>
            `;
          }

          const eventTitleDisplay = (event?.title || 'Event').toUpperCase();
          const schoolNameDisplay = event?.school?.name || event?.school_name || 'Eventloo Demo';
          const maxMarkVal = prog.max_mark_per_judge || exportItem?.judgeMaxMarks || event?.max_mark_per_judge || 100;
          const marksColWidthPercent = 78;
          const perJudgeWidthPercent = (marksColWidthPercent / judgeCount).toFixed(2);

          const judgeHeaderCells = Array.from({ length: judgeCount }, (_, j) => {
            const jNum = j + 1;
            const jName = assignedJudgesMap[jNum];
            const nameSub = jName ? `<div style="font-size: 8.5px; font-weight: normal; color: #4338ca; text-transform: none; margin-top: 1px;">(${escapeHtml(jName)})</div>` : '';
            return `<th class="center sub-th" style="width: ${perJudgeWidthPercent}%;">Judge ${jNum}${nameSub}</th>`;
          }).join('');

          const sigBoxes = Array.from({ length: judgeCount }, (_, j) => {
            const jNum = j + 1;
            const jName = assignedJudgesMap[jNum];
            const labelHtml = jName
              ? `<div>Judge ${jNum}: <strong>${escapeHtml(jName)}</strong></div><div style="font-size: 8.5px; font-weight: normal; color: #64748b; margin-top: 2px;">Signature</div>`
              : `<div>Judge ${jNum} Name &amp; Signature</div>`;
            return `
              <div class="sig-box">
                <div class="sig-label">${labelHtml}</div>
                <div class="sig-line"></div>
              </div>
            `;
          }).join('');

          for (let copyIdx = 0; copyIdx < copies; copyIdx++) {
            pageCount++;
            const pageBreak = pageCount > 1 ? 'style="page-break-before: always;"' : '';
            pagesHtml += `
              <div class="program-page" ${pageBreak}>
                <div class="header">
                  <div>
                    <div style="font-size: 11px; font-weight: 700; color: #4f46e5; margin-bottom: 2px;">${escapeHtml(eventTitleDisplay)}</div>
                    <div class="title" style="margin-top: 0; margin-bottom: 0;">VALUATION SHEET</div>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 11px; font-weight: 700; color: #0f172a;">${escapeHtml(schoolNameDisplay)}</div>
                    <div style="font-size: 10px; color: #64748b; margin-top: 2px;">${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} · Copy ${copyIdx + 1} of ${copies}</div>
                  </div>
                </div>
                
                <table class="info-box">
                  <tbody>
                    <tr>
                      <td class="font-bold" style="width: 40%;"><strong>PROGRAM:</strong> ${escapeHtml(progName)}</td>
                      <td class="center font-bold" style="width: 24%;"><strong>CATEGORY:</strong> ${escapeHtml(progCat)}</td>
                      <td class="center font-bold" style="width: 18%;"><strong>MODE:</strong> ${escapeHtml(progType)}</td>
                      <td class="center font-bold" style="width: 18%;"><strong>STAGE:</strong> ${escapeHtml(stageDisplay)}</td>
                    </tr>
                  </tbody>
                </table>

                <table class="main-table">
                  <thead>
                    <tr>
                      <th class="center" rowspan="2" style="width: 22%;">Code Letter</th>
                      <th class="center" colspan="${judgeCount}" style="width: 78%;">Marks (Max: ${maxMarkVal})</th>
                    </tr>
                    <tr>
                      ${judgeHeaderCells}
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml}
                  </tbody>
                </table>

                <div class="judge-signatures">
                  ${sigBoxes}
                </div>
                <div class="doc-footer">Powered by <strong>eventloo.in</strong></div>
              </div>
            `;
          }
        } else {
          // Green Room Sign Sheet format
          let rowsHtml = '';
          if (assignments.length > 0) {
            const documentRows = groupDocumentAssignments(prog, assignments);
            rowsHtml = documentRows.map(row => {
              const gender = row.members?.[0]?.student?.gender || row.members?.[0]?.student_details?.gender || '—';
              return `
                <tr>
                  <td class="center font-bold" style="padding: 10px 6px;">${escapeHtml(row.chestNo)}</td>
                  <td style="padding: 10px 8px;">${escapeHtml(row.participantNames)}</td>
                  <td class="center" style="padding: 10px 6px;">${escapeHtml(gender)}</td>
                  <td class="center font-bold" style="padding: 10px 6px;">${escapeHtml(row.codeLetter || '')}</td>
                  <td style="padding: 10px 6px;"></td>
                </tr>
              `;
            }).join('');
          }

          // Ensure at least 6 rows
          const minRows = 6;
          const currentCount = assignments.length > 0 ? groupDocumentAssignments(prog, assignments).length : 0;
          for (let r = currentCount; r < minRows; r++) {
            rowsHtml += `
              <tr>
                <td class="center" style="padding: 10px 6px;">&nbsp;</td>
                <td style="padding: 10px 8px;">&nbsp;</td>
                <td class="center" style="padding: 10px 6px;">&nbsp;</td>
                <td class="center" style="padding: 10px 6px;">&nbsp;</td>
                <td style="padding: 10px 6px;">&nbsp;</td>
              </tr>
            `;
          }

          pageCount++;
          const pageBreak = (i > 0 && exportItem?.pageLayout !== 'continuous') ? 'style="page-break-before: always;"' : '';

          pagesHtml += `
            <div class="program-page" ${pageBreak}>
              <div class="header">
                <div>${escapeHtml(event?.school?.name || event?.title || 'Eventloo')}</div>
                <div>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              </div>
              <div class="title">Green Room Sign Sheet</div>

              <table class="info-box">
                <tbody>
                  <tr>
                    <td class="font-bold" style="width: 40%;"><strong>PROGRAM:</strong> ${escapeHtml(progName)}</td>
                    <td class="center font-bold" style="width: 24%;"><strong>CATEGORY:</strong> ${escapeHtml(progCat)}</td>
                    <td class="center font-bold" style="width: 18%;"><strong>MODE:</strong> ${escapeHtml(progType)}</td>
                    <td class="center font-bold" style="width: 18%;"><strong>STAGE:</strong> ${escapeHtml(stageDisplay)}</td>
                  </tr>
                </tbody>
              </table>

              <table class="main-table">
                <thead>
                  <tr>
                    <th class="center" style="width: 14%;">Chest No</th>
                    <th style="width: 42%;">Participant</th>
                    <th class="center" style="width: 14%;">Gender</th>
                    <th class="center" style="width: 14%;">Code Letter</th>
                    <th class="center" style="width: 16%;">Participant Signature</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>

              <div class="gr-signature">
                <div class="sig-box" style="margin-left: auto;">
                  <div class="sig-label">Green Room In-charge Signature</div>
                  <div class="sig-line"></div>
                </div>
              </div>
              <div class="doc-footer">Powered by <strong>eventloo.in</strong></div>
            </div>
          `;
        }
      }
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${escapeHtml(exportItem.typeName || 'Export Document')}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700&family=Dancing+Script:wght@500;700&family=Great+Vibes&family=Inter:wght@400;600;800&family=Montserrat:wght@400;600;800&family=Outfit:wght@400;600;800&family=Playfair+Display:ital,wght@0,600;0,800;1,600&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          @page {
            margin: ${exportItem?.type === 'certificate' || exportItem?.type === 'badge' ? '0' : '12mm 14mm'};
            size: ${exportItem?.type === 'certificate' ? 'landscape' : 'A4 portrait'};
          }
          body { font-family: Inter, Arial, sans-serif; padding: 0; color: #0f172a; background: #fff; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .program-page { box-sizing: border-box; width: 100%; max-width: 182mm; margin: 0 auto; padding: 0 0 20px 0; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 8px; border-bottom: 1.5px solid #4f46e5; color: #64748b; font-size: 11px; }
          .header > div:first-child { color: #312e81; font-weight: 800; font-size: 12px; }
          .title { color: #0f172a; font-size: 22px; line-height: 1.15; font-weight: 800; margin: 12px 0 8px 0; letter-spacing: -0.01em; }
          .subtitle { font-size: 13px; font-weight: 700; color: #475569; margin-bottom: 8px; }
          .category-header { color: #312e81; background: #eef2ff; border: 1px solid #cbd5e1; padding: 6px 10px; font-size: 11px; font-weight: 700; margin-top: 14px; margin-bottom: 6px; }
          .hr { border-bottom: 2px solid #4f46e5; margin-bottom: 14px; }
          .stage-no { text-align: right; color: #475569; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
          .subheader { display: flex; justify-content: space-between; gap: 16px; padding: 10px 12px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 12px; font-weight: bold; margin-bottom: 14px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; }
          table.info-box { border: 1px solid #c7d2fe; margin: 10px 0 14px 0; }
          table.info-box td { border: 1px solid #c7d2fe; padding: 7px 10px; font-size: 11px; background: #eef2ff; color: #312e81; }
          table.main-table { border: 1px solid #64748b; }
          table.main-table th { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 11px; background: #312e81; color: #fff; font-weight: 700; }
          table.main-table th.sub-th { background: #eef2ff; color: #312e81; font-weight: 700; font-size: 10px; }
          table.main-table td { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 11px; }
          table.main-table tbody tr:nth-child(even) td { background: #f8fafc; }
          th { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 11px; background: #312e81; color: #fff; text-align: left; }
          th.center { text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 7px 8px; font-size: 11px; }
          td.center { text-align: center; }
          .font-bold { font-weight: bold; }
          .total-part { text-align: right; font-size: 11px; font-weight: 700; color: #475569; margin-top: 6px; }
          .judge-signatures { display: flex; justify-content: space-between; gap: 14px; margin-top: 36px; padding-top: 8px; }
          .gr-signature { display: flex; justify-content: flex-end; margin-top: 36px; padding-top: 8px; }
          .sig-box { flex: 1; text-align: center; min-width: 0; }
          .sig-label { font-size: 10px; font-weight: 700; color: #312e81; margin-bottom: 28px; line-height: 1.25; min-height: 28px; }
          .sig-line { border-top: 1px solid #94a3b8; width: 90%; margin: 0 auto; }
          .doc-footer { text-align: center; font-size: 8pt; color: #94a3b8; margin-top: 24px; padding-top: 8px; letter-spacing: 0.02em; }
          .doc-footer strong { color: #64748b; font-weight: 700; }
          body.certificate-document { padding: 0; overflow: visible; }
          .cert-sheet {
            width: 100vw;
            height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            break-after: page;
            page-break-after: always;
          }
          .cert-sheet:last-child { break-after: auto; page-break-after: auto; }
          .cert-page {
            position: relative;
            max-width: 100vw;
            max-height: 100vh;
            overflow: hidden;
            box-sizing: border-box;
            container-type: inline-size;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .certificate-background {
            position: absolute;
            inset: 0;
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          .certificate-field {
            position: absolute;
            z-index: 2;
            transform: translate(-50%, -50%);
            line-height: 1.15;
            white-space: nowrap;
          }
          .certificate-photo {
            position: absolute;
            z-index: 2;
            transform: translate(-50%, -50%);
            border-radius: 50%;
            border: 2px dashed #0284c7;
            background: rgba(224, 242, 254, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5cqw;
            font-weight: bold;
            color: #0369a1;
          }
          .certificate-missing {
            position: absolute;
            inset: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            background: #f8fafc;
            border: 2px dashed #cbd5e1;
            color: #94a3b8;
            font-weight: bold;
          }
          .result-page {
            box-sizing: border-box;
            width: 100%;
            min-height: calc(100vh - 40px);
            padding: 28px 50px 36px;
            color: #0f172a;
            background: #fff;
          }
          .result-topline {
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding-bottom: 10px;
            border-bottom: 1px solid #cbd5e1;
            color: #64748b;
            font-size: 12px;
          }
          .result-event-name { color: #312e81; font-size: 14px; font-weight: 800; letter-spacing: .02em; }
          .result-title { color: #0f172a; font-size: 30px; line-height: 1; margin: 16px 0 30px; }
          .result-program-meta {
            display: grid;
            grid-template-columns: minmax(0, 1.4fr) minmax(180px, 1fr) minmax(120px, .7fr);
            align-items: center;
            gap: 24px;
            padding: 14px 0 12px;
            padding: 13px 14px;
            border: 1px solid #cbd5e1;
            border-left: 5px solid #4f46e5;
            background: #f8fafc;
            font-size: 15px;
          }
          .result-program-name { color: #312e81; font-size: 17px; font-weight: 800; }
          .result-mode { text-align: center; }
          .result-category { text-align: right; font-weight: 800; }
          .results-table { margin: 16px 0 0; table-layout: fixed; }
          .results-table th,
          .results-table td { border: 1px solid #cbd5e1; padding: 10px 8px; font-size: 13px; }
          .results-table th { background: #4f46e5; color: #fff; text-align: center; font-weight: 800; }
          .results-table tbody tr:nth-child(even) td { background: #f8fafc; }
          .results-table th:nth-child(1) { width: 9%; }
          .results-table th:nth-child(2) { width: 11%; }
          .results-table th:nth-child(3) { width: 34%; }
          .results-table th:nth-child(4) { width: 24%; }
          .results-table th:nth-child(5) { width: 8%; }
          .results-table th:nth-child(6) { width: 7%; }
          .result-standing, .result-chest, .result-center { text-align: center; }
          .result-standing, .result-chest { font-weight: 800; }
          .result-candidate { text-transform: uppercase; }
          .result-empty { padding: 28px !important; text-align: center; color: #666; }
          .result-total { margin-top: 10px; text-align: right; color: #475569; font-size: 12px; font-weight: 600; }
          .result-empty-state { margin-top: 80px; text-align: center; color: #64748b; font-size: 15px; }
        </style>
      </head>
      <body class="${exportItem.type === 'certificate' ? 'certificate-document' : ''}">
        ${pagesHtml}
      </body>
      </html>
    `;

    printWin.document.write(htmlContent);
    printWin.document.close();
    const imageLoads = Array.from(printWin.document.images).map(image => {
      if (image.complete) return Promise.resolve();
      return new Promise(resolve => {
        image.addEventListener('load', resolve, { once: true });
        image.addEventListener('error', resolve, { once: true });
      });
    });
    const fontsReady = printWin.document.fonts?.ready || Promise.resolve();
    Promise.all([fontsReady, ...imageLoads]).then(() => {
      window.setTimeout(() => printWin.print(), 150);
    });
  };

  const triggerBlobDownload = async (data, filename, mimeType = 'application/pdf') => {
    let blob = data instanceof Blob ? data : new Blob([data], { type: mimeType });
    
    if (blob.size > 100 && blob.type !== 'application/json') {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 5000);
      return true;
    }
    return false;
  };

  const processAndDownloadExport = async (exportItem) => {
    const targetEventId = eventId || event?.id || 1;
    let success = false;
    let failure = null;

    try {
      if (exportItem.type === 'green_room') {
        const res = await eventGreenRoomAPI.generateGreenRoomSign(targetEventId, {
          only_with_participants: exportItem.onlyWithParticipants !== false,
          layout: exportItem.pageLayout || 'single',
          category: exportItem.category || 'all',
          program_id: exportItem.programId || 'all'
        });
        success = await triggerBlobDownload(res.data, `Green_Room_Sign_Sheet_${event?.title || 'Event'}.pdf`, 'application/pdf');
      } else if (exportItem.type === 'results') {
        if (exportItem.resultDocMode === 'posters') {
          let certTypesParam = 'result_poster';
          let posterModeParam = 'single';
          if (exportItem.posterSelection === 'alternating') {
            certTypesParam = 'result_poster,result_poster_2,result_poster_3,result_poster_4,result_poster_5';
            posterModeParam = 'alternating';
          } else if (exportItem.posterSelection === 'poster_wise') {
            certTypesParam = 'result_poster,result_poster_2,result_poster_3,result_poster_4,result_poster_5';
            posterModeParam = 'poster_wise';
          } else if (exportItem.posterSelection) {
            certTypesParam = exportItem.posterSelection;
          }
          const fileFormatParam = exportItem.posterFormat || 'pdf';
          const res = await eventCertificatesAPI.generateCertificates(targetEventId, {
            cert_types: certTypesParam,
            poster_mode: posterModeParam,
            order_by: exportItem.posterOrder || 'result_number',
            category: exportItem.category || 'all',
            program_id: exportItem.programId || 'all',
            file_format: fileFormatParam,
            quality: exportItem.exportQuality || 'standard'
          });

          const disposition = res.headers?.['content-disposition'] || '';
          const contentType = res.headers?.['content-type'] || '';
          let downloadFilename = `Result_Posters_${event?.title || 'Event'}.${fileFormatParam === 'jpg' ? 'zip' : 'pdf'}`;
          const fnMatch = disposition.match(/filename="?([^";]+)"?/i);
          if (fnMatch && fnMatch[1]) {
            downloadFilename = fnMatch[1];
          }
          let downloadMime = 'application/pdf';
          if (contentType.includes('zip') || downloadFilename.endsWith('.zip')) {
            downloadMime = 'application/zip';
          } else if (contentType.includes('jpeg') || contentType.includes('jpg') || downloadFilename.endsWith('.jpg')) {
            downloadMime = 'image/jpeg';
          }
          success = await triggerBlobDownload(res.data, downloadFilename, downloadMime);
        } else {
          await generateClientPdfFallback(exportItem);
          success = true;
        }
      } else if (exportItem.type === 'valuation') {
        const res = await eventValuationAPI.generateValuationSheet(targetEventId, {
          only_with_participants: exportItem.onlyWithParticipants !== false,
          layout: exportItem.pageLayout || 'single',
          category: exportItem.category || 'all',
          program_id: exportItem.programId || 'all',
          copies: exportItem.copiesCount || 3,
          max_marks: exportItem.judgeMaxMarks || 100
        });
        success = await triggerBlobDownload(res.data, `Valuation_Sheet_${event?.title || 'Event'}.pdf`, 'application/pdf');
      } else if (exportItem.type === 'call_list') {
        const res = await eventCallListAPI.generateCallList(targetEventId, {
          mode: exportItem.callListMode || 'competition',
          only_with_participants: exportItem.onlyWithParticipants !== false,
          category: exportItem.category || 'all',
          program_id: exportItem.programId || 'all',
          team_id: exportItem.selectedTeamId || 'all'
        });
        success = await triggerBlobDownload(res.data, `${exportItem.typeName || 'Call_List'}.pdf`, 'application/pdf');
      } else if (exportItem.type === 'certificate' || exportItem.type === 'badge') {
        const certTypesParam = exportItem.type === 'badge'
          ? 'badge'
          : (exportItem.certTypes || ['participation']).join(',');
        const res = await eventCertificatesAPI.generateCertificates(targetEventId, {
          cert_types: certTypesParam,
          category: exportItem.category || 'all',
          program_id: exportItem.type === 'badge' ? 'all' : (exportItem.programId || 'all'),
          team_id: exportItem.selectedTeamId || 'all',
          quality: exportItem.exportQuality || 'standard'
        });
        const isBadgeOnly = exportItem.type === 'badge' || (exportItem.certTypes?.length === 1 && exportItem.certTypes[0] === 'badge');
        const docName = isBadgeOnly ? 'Badges' : 'Certificates';
        success = await triggerBlobDownload(
          res.data,
          `${docName}_${event?.title || 'Event'}.pdf`,
          'application/pdf'
        );
      }
    } catch (err) {
      console.error('API Download attempt error:', err);
      failure = err;
    }

    if (!success) {
      if (exportItem.type === 'results' && exportItem.resultDocMode === 'posters') {
        let serverMessage = failure?.response?.data?.error;
        if (failure?.response?.data instanceof Blob) {
          try {
            const errorPayload = JSON.parse(await failure.response.data.text());
            serverMessage = errorPayload?.error;
          } catch (parseError) {
            console.error('Unable to read poster error response:', parseError);
          }
        }
        throw new Error(serverMessage || 'Unable to generate Result E-Posters. Please ensure Result Poster templates are uploaded in Templates studio.');
      } else if (exportItem.type === 'results') {
        await generateClientPdfFallback(exportItem);
      } else if (exportItem.type === 'certificate' || exportItem.type === 'badge') {
        let serverMessage = failure?.response?.data?.error;
        if (failure?.response?.data instanceof Blob) {
          try {
            const errorPayload = JSON.parse(await failure.response.data.text());
            serverMessage = errorPayload?.error;
          } catch (parseError) {
            console.error('Unable to read certificate error response:', parseError);
          }
        }
        const fallbackMsg = exportItem.type === 'badge'
          ? 'Unable to generate badges. Please ensure attendees are registered and assigned to programs.'
          : 'Unable to generate certificates. Check that the selected templates are uploaded and that eligible published results exist.';
        throw new Error(serverMessage || fallbackMsg);
      } else {
        throw new Error(`Unable to generate ${exportItem.typeName || 'document'} because participant data could not be loaded.`);
      }
    }
  };

  const handleDownloadClick = async (exportItem) => {
    if (exportItem.status === 'processing' || generating) return;
    setGenerating(true);
    setDownloadingItemId(exportItem.id);
    setDownloadNotice({
      status: 'loading',
      text: `Generating and preparing ${exportItem.typeName || 'document'}... Large exports with multiple pages or high-resolution images may take up to a minute.`
    });
    try {
      await processAndDownloadExport(exportItem);
      setDownloadNotice({
        status: 'success',
        text: `${exportItem.typeName || 'Document'} downloaded successfully!`
      });
      setTimeout(() => setDownloadNotice(null), 4000);
    } catch (err) {
      console.error('Download click error:', err);
      setDownloadNotice(null);
      window.alert(err?.message || `Unable to generate ${exportItem.typeName || 'document'}.`);
    } finally {
      setGenerating(false);
      setDownloadingItemId(null);
    }
  };

  const handleCreateExportSubmit = () => {
    const typeConfig = exportTypes.find(t => t.id === selectedExportType) || exportTypes[0];
    
    let summaryText = `${typeConfig.title}`;
    if (selectedExportType === 'call_list') {
      if (callListMode === 'team') {
        const tm = teams.find(t => t.id === parseInt(selectedTeamId, 10));
        summaryText += ` (Team Wise: ${tm ? tm.name : 'All Teams'})`;
      } else if (callListMode === 'participant') {
        const tm = teams.find(t => t.id === parseInt(selectedTeamId, 10));
        summaryText = `Participant List (${tm ? tm.name : 'All Teams'})`;
      } else if (selectedProgramId !== 'all') {
        const prog = programs.find(p => p.id === parseInt(selectedProgramId, 10));
        if (prog) summaryText += ` for ${prog.name}`;
      } else {
        summaryText += ` for ${selectedCategory === 'all' ? 'All categories' : selectedCategory.toUpperCase()}`;
      }
    } else if (selectedProgramId !== 'all') {
      const prog = programs.find(p => p.id === parseInt(selectedProgramId, 10));
      if (prog) summaryText += ` for ${prog.name}`;
    } else {
      summaryText += ` for ${selectedCategory === 'all' ? 'All categories' : selectedCategory.toUpperCase()}`;
    }

    const pills = [];
    if (selectedExportType === 'call_list') {
      const modeLabel = callListMode === 'participant' ? 'Participant List' : (callListMode === 'team' ? 'Team Wise' : 'Competition Wise');
      pills.push(`Type: ${modeLabel}`);
    }
    if (selectedExportType === 'certificate') {
      pills.push(`Quality: ${exportQuality.toUpperCase()}`);
      pills.push(`Types: ${selectedCertTypes.length}`);
    }
    if (selectedExportType === 'badge') {
      pills.push(`Quality: ${exportQuality.toUpperCase()}`);
      pills.push('9 Badges / A4 Sheet');
      if (selectedTeamId && selectedTeamId !== 'all') {
        const tm = teams.find(t => t.id === parseInt(selectedTeamId, 10));
        pills.push(`Team: ${tm ? tm.name : 'Selected Team'}`);
      } else {
        pills.push('Team: All teams');
      }
    }
    if (selectedExportType === 'results') {
      if (resultDocMode === 'posters') {
        const modeLabel = resultPosterSelection === 'alternating' 
          ? 'Shuffled / Alternating' 
          : (resultPosterSelection === 'poster_wise' ? 'All Posters' : 'Poster Template');
        summaryText = `Result E-Posters (${modeLabel})`;
        pills.push('E-Posters');
        pills.push(resultPosterFormat === 'jpg' ? 'Format: JPG (ZIP)' : 'Format: PDF');
        pills.push(resultPosterOrder === 'result_number' ? 'Order: Result #' : 'Order: Schedule');
        pills.push(resultPosterSelection === 'alternating' ? 'Posters: Alternating' : (resultPosterSelection === 'poster_wise' ? 'Posters: All' : 'Single Template'));
      } else {
        pills.push('Published results only');
      }
    }
    if (selectedProgramId && selectedProgramId !== 'all') {
      const prog = programs.find(p => p.id === parseInt(selectedProgramId, 10));
      if (prog) pills.push(`Competition: ${prog.name}`);
    }
    if (selectedCategory !== 'all') pills.push(`Categories: ${selectedCategory.toUpperCase()}`);
    else pills.push('Categories: General (GEN)');
    if (selectedExportType === 'valuation') {
      pills.push(`Copies: ${copiesCount}`);
      pills.push(`Max Mark: ${judgeMaxMarks}`);
    }

    const startMs = Date.now();
    const newItemId = `exp-${startMs}`;
    const newExportItem = {
      id: newItemId,
      type: selectedExportType,
      typeName: typeConfig.title,
      icon: typeConfig.id,
      summary: summaryText,
      pills: pills,
      status: 'processing',
      completedIn: '-',
      onlyWithParticipants,
      pageLayout,
      category: selectedCategory,
      programId: selectedProgramId,
      selectedTeamId: selectedTeamId,
      callListMode: callListMode,
      copiesCount: copiesCount,
      judgeMaxMarks: judgeMaxMarks,
      exportQuality: exportQuality,
      certTypes: selectedExportType === 'badge' ? ['badge'] : selectedCertTypes,
      resultDocMode,
      posterSelection: resultPosterSelection,
      posterOrder: resultPosterOrder,
      posterFormat: resultPosterFormat,
      createdAt: new Date(startMs).toISOString()
    };

    const updatedQueue = [newExportItem, ...exportsQueue];
    saveQueue(updatedQueue);
    setDrawerOpen(false);

    const processDuration = 1000 + Math.floor(Math.random() * 800);
    setTimeout(() => {
      const finishMs = Date.now();
      const actualDuration = ((finishMs - startMs) / 1000).toFixed(1);
      const completedInStr = `${actualDuration}s`;

      setExportsQueue(prev => {
        const finished = prev.map(item => item.id === newItemId ? { 
          ...item, 
          status: 'completed',
          completedIn: completedInStr
        } : item);
        try { sessionStorage.setItem(storageKey, JSON.stringify(finished)); } catch(e){}
        return finished;
      });
    }, processDuration);
  };

  const exportTypes = [
    {
      id: 'valuation',
      title: 'Valuation Sheet',
      description: 'Scoring sheets for judges and evaluators.',
      icon: FileSpreadsheet,
      iconBg: 'bg-indigo-50 text-indigo-600',
    },
    {
      id: 'green_room',
      title: 'Green Room Sign',
      description: 'Signs for green room / backstage management.',
      icon: Clipboard,
      iconBg: 'bg-indigo-50 text-indigo-600',
    },
    {
      id: 'call_list',
      title: 'Call List',
      description: 'Competition-wise and Team-wise call lists.',
      icon: PhoneCall,
      iconBg: 'bg-indigo-50 text-indigo-600',
    },
    {
      id: 'results',
      title: 'Results',
      description: 'Published result sheets with standings, grades and points per competition.',
      icon: Trophy,
      iconBg: 'bg-indigo-50 text-indigo-600',
    },
    {
      id: 'certificate',
      title: 'Certificate',
      description: 'Participation and placement certificates for competitions.',
      icon: Award,
      iconBg: 'bg-indigo-50 text-indigo-600',
    },
    {
      id: 'badge',
      title: 'Badge',
      description: 'Official participant badges (Full A4 size per participant in high quality with QR verification).',
      icon: BadgeCheck,
      iconBg: 'bg-indigo-50 text-indigo-600',
    }
  ];

  const getExportIcon = (iconId) => {
    switch (iconId) {
      case 'green_room':
        return <Clipboard className="w-4 h-4 text-indigo-600" />;
      case 'valuation':
        return <FileSpreadsheet className="w-4 h-4 text-indigo-600" />;
      case 'call_list':
        return <PhoneCall className="w-4 h-4 text-indigo-600" />;
      case 'results':
        return <Trophy className="w-4 h-4 text-indigo-600" />;
      case 'badge':
        return <BadgeCheck className="w-4 h-4 text-indigo-600" />;
      case 'certificate':
        return <Award className="w-4 h-4 text-indigo-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const certTypePills = [
    { id: 'first_place', label: '1st Place' },
    { id: 'second_place', label: '2nd Place' },
    { id: 'third_place', label: '3rd Place' },
    { id: 'participation', label: 'Participation' },
    { id: 'badge', label: 'Badge' },
    { id: 'common_prize', label: 'Common Prize', comingSoon: true },
    { id: 'grade_certificate', label: 'Grade', comingSoon: true }
  ];

  if (loading) {
    return (
      <div className="py-20 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-3"></div>
        <p className="text-xs text-gray-500 font-medium">Loading Documents Queue...</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-5 bg-[#f7f8fb] min-h-[620px]">
      
      {/* Top Header Card Box */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Documents & Exports</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Files are processed in the background, auto-downloaded when ready, and expire after 2 days
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl shadow-2xs transition-colors inline-flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Export</span>
        </button>
      </div>

      {/* Download Status Notice Banner */}
      {downloadNotice && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-2xs transition-all ${
          downloadNotice.status === 'loading'
            ? 'bg-indigo-50/90 border-indigo-200 text-indigo-950'
            : 'bg-emerald-50/90 border-emerald-200 text-emerald-950'
        }`}>
          <div className="flex items-center space-x-2.5">
            {downloadNotice.status === 'loading' ? (
              <Loader2 className="w-4 h-4 text-indigo-600 animate-spin shrink-0" />
            ) : (
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>{downloadNotice.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setDownloadNotice(null)}
            className={`p-1 rounded-md transition-colors cursor-pointer ${
              downloadNotice.status === 'loading'
                ? 'text-indigo-400 hover:text-indigo-700'
                : 'text-emerald-500 hover:text-emerald-800'
            }`}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main Exports Queue Table */}
      <div className="bg-white border border-slate-200/80 rounded-xl shadow-2xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead className="bg-gray-50/70">
              <tr>
                <th className="px-6 py-3.5 text-left text-xs font-extrabold text-gray-500 tracking-wider">
                  Export Type
                </th>
                <th className="px-6 py-3.5 text-left text-xs font-extrabold text-gray-500 tracking-wider">
                  Summary
                </th>
                <th className="px-6 py-3.5 text-center text-xs font-extrabold text-gray-500 tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3.5 text-center text-xs font-extrabold text-gray-500 tracking-wider">
                  Completed In
                </th>
                <th className="px-6 py-3.5 text-center text-xs font-extrabold text-gray-500 tracking-wider">
                  Queued At
                </th>
                <th className="px-6 py-3.5 text-right text-xs font-extrabold text-gray-500 tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {exportsQueue.length > 0 ? (
                exportsQueue.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50/60 transition-colors">
                    {/* Export Type Icon & Title */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2.5">
                        <div className="p-1.5 rounded-lg bg-gray-100 border border-gray-200">
                          {getExportIcon(item.icon)}
                        </div>
                        <span className="font-bold text-xs text-gray-900">{item.typeName}</span>
                      </div>
                    </td>

                    {/* Summary & Pills */}
                    <td className="px-6 py-4">
                      <ExportSummaryCell item={item} programs={programs} teams={teams} />
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      {item.status === 'processing' ? (
                        <span className="px-3 py-1 text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full inline-flex items-center space-x-1 animate-pulse">
                          <Loader2 className="w-3.5 h-3.5 text-indigo-600 animate-spin" />
                          <span>Processing</span>
                        </span>
                      ) : (
                        <span className="px-3 py-1 text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full inline-flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Completed</span>
                        </span>
                      )}
                    </td>

                    {/* Completed In */}
                    <td className="px-6 py-4 text-center whitespace-nowrap text-xs font-medium text-gray-600">
                      {item.status === 'processing' ? '-' : (item.completedIn || '1.0s')}
                    </td>

                    {/* Queued At */}
                    <td className="px-6 py-4 text-center whitespace-nowrap text-xs font-medium text-gray-500">
                      {getRelativeTime(item.createdAt)}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center space-x-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadClick(item)}
                          disabled={item.status === 'processing' || generating}
                          className={`p-1.5 rounded-lg transition-colors ${
                            item.status === 'processing' || downloadingItemId === item.id
                              ? 'text-indigo-600 bg-indigo-50 cursor-wait'
                              : generating
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer'
                          }`}
                          title={
                            downloadingItemId === item.id
                              ? 'Generating and preparing download...'
                              : item.status === 'processing'
                              ? 'Processing export...'
                              : 'Download Document'
                          }
                        >
                          {downloadingItemId === item.id || item.status === 'processing' ? (
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                          ) : (
                            <Download className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteExport(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          title="Delete Export"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="px-6 py-12 text-center text-xs text-gray-400">
                    No export requests in queue. Click "+ New Export" to create one.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Export Right-Side Slide-Over Modal Drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-xs flex justify-end z-50 overflow-hidden">
          <div className="w-full max-w-2xl bg-white h-full shadow-2xl overflow-y-auto flex flex-col transition-transform duration-300 transform translate-x-0">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-white sticky top-0 z-10">
              <h2 className="text-xl font-bold text-gray-900">Create Export</h2>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6 bg-white">
              
              {/* Section Sub-Header */}
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Export Type</h3>
                  <p className="text-xs text-gray-500 mt-0.5">Select the type of document you want to generate</p>
                </div>
              </div>

              {/* Grid of 6 Export Type Option Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {exportTypes.map((type) => {
                  const IconComp = type.icon;
                  const isSelected = selectedExportType === type.id;

                  return (
                    <div
                      key={type.id}
                      onClick={() => !type.comingSoon && setSelectedExportType(type.id)}
                      className={`relative p-4 rounded-2xl border-2 transition-all flex flex-col justify-between min-h-[140px] ${
                        type.comingSoon ? 'cursor-not-allowed opacity-70 bg-gray-50' : 'cursor-pointer'
                      } ${
                        isSelected 
                          ? 'border-indigo-500 bg-indigo-50/40 shadow-2xs' 
                          : type.comingSoon ? 'border-gray-200' : 'border-gray-200 hover:border-gray-300 bg-white'
                      }`}
                    >
                      {/* Top Row: Icon & Red Checkmark Badge */}
                      <div className="flex items-center justify-between mb-3">
                        <div className={`p-2.5 rounded-xl ${type.iconBg}`}>
                          <IconComp className="w-5 h-5" />
                        </div>

                        {type.comingSoon ? (
                          <span className="px-2 py-1 rounded-lg bg-gray-200 text-gray-600 text-[10px] font-bold">
                            Coming Soon
                          </span>
                        ) : isSelected && (
                          <div className="w-5 h-5 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-2xs">
                            <Check className="w-3.5 h-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Title & Description */}
                      <div>
                        <div className={`font-bold text-xs ${isSelected ? 'text-indigo-800' : 'text-gray-900'}`}>
                          {type.title}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1 leading-snug">
                          {type.description}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Configure Filters Section */}
              <div className="bg-slate-50/70 p-5 rounded-2xl border border-gray-200 space-y-5">
                
                {/* Section Header */}
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Sliders className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900">Configure Filters</h4>
                    <p className="text-xs text-gray-500 mt-0.5">Customize your export by selecting specific data</p>
                  </div>
                </div>

                {/* CERTIFICATE & BADGE FILTER SECTION */}
                {(selectedExportType === 'certificate' || selectedExportType === 'badge') && (
                  <>
                    {/* Export Quality Cards */}
                    <div>
                      <label className="block text-xs font-bold text-gray-900 mb-2">Export Quality</label>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Screen */}
                        <div
                          onClick={() => setExportQuality('screen')}
                          className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                            exportQuality === 'screen'
                              ? 'border-indigo-500 bg-indigo-50/40 shadow-2xs'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-bold text-xs ${exportQuality === 'screen' ? 'text-indigo-700' : 'text-gray-900'}`}>
                              Screen
                            </span>
                            {exportQuality === 'screen' && (
                              <Check className="w-4 h-4 text-indigo-600 stroke-[3]" />
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1">Smaller file, good for viewing</p>
                        </div>

                        {/* Standard */}
                        <div
                          onClick={() => setExportQuality('standard')}
                          className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                            exportQuality === 'standard'
                              ? 'border-indigo-500 bg-indigo-50/40 shadow-2xs'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-bold text-xs ${exportQuality === 'standard' ? 'text-indigo-700' : 'text-gray-900'}`}>
                              Standard
                            </span>
                            {exportQuality === 'standard' && (
                              <Check className="w-4 h-4 text-indigo-600 stroke-[3]" />
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1">Balanced quality and size</p>
                        </div>

                        {/* Print */}
                        <div
                          onClick={() => setExportQuality('print')}
                          className={`relative p-3.5 rounded-xl border-2 transition-all cursor-pointer ${
                            exportQuality === 'print'
                              ? 'border-indigo-500 bg-indigo-50/40 shadow-2xs'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className={`font-bold text-xs ${exportQuality === 'print' ? 'text-indigo-700' : 'text-gray-900'}`}>
                              Print
                            </span>
                            {exportQuality === 'print' && (
                              <Check className="w-4 h-4 text-indigo-600 stroke-[3]" />
                            )}
                          </div>
                          <p className="text-[11px] text-gray-500 mt-1">High quality for printing</p>
                        </div>
                      </div>
                      
                      <div className="flex items-start space-x-1.5 text-[11px] text-gray-500 mt-2">
                        <Info className="w-3.5 h-3.5 text-gray-400 shrink-0 mt-0.5" />
                        <span>Physical size is calculated from template pixels and selected DPI; fitting never upscales the artwork.</span>
                      </div>
                    </div>

                    {/* Badge Info Banner */}
                    {selectedExportType === 'badge' && (
                      <div className="p-3.5 bg-indigo-50/80 border border-indigo-100 rounded-xl text-xs text-indigo-900 flex items-center space-x-2.5">
                        <BadgeCheck className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>Exports official participant badges (front & back sides with QR verification, chest numbers, and registered programs list).</span>
                      </div>
                    )}

                    {/* Certificate Types Selectable Pills (Certificate only) */}
                    {selectedExportType === 'certificate' && (
                      <div>
                        <label className="block text-xs font-bold text-gray-900 mb-2">Certificate Types</label>
                        <div className="flex flex-wrap gap-2">
                          {certTypePills.map((pill) => {
                            const isSelected = selectedCertTypes.includes(pill.id);
                            return (
                              <button
                                key={pill.id}
                                type="button"
                                disabled={pill.comingSoon}
                                onClick={() => !pill.comingSoon && toggleCertType(pill.id)}
                                className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-1.5 ${
                                  pill.comingSoon
                                    ? 'cursor-not-allowed bg-gray-100 border border-gray-200 text-gray-500 opacity-75'
                                    : isSelected
                                    ? 'bg-indigo-600 text-white shadow-2xs'
                                    : 'cursor-pointer bg-white border border-gray-200 text-gray-800 hover:bg-gray-50'
                                }`}
                              >
                                {!pill.comingSoon && isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                <span>{pill.label}</span>
                                {pill.comingSoon && <span className="text-[9px] uppercase tracking-wide">Coming Soon</span>}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* Result Document Mode: Result Sheet vs Result E-Posters */}
                {selectedExportType === 'results' && (
                  <div className="space-y-4 p-4 bg-indigo-50/50 rounded-2xl border border-indigo-100">
                    <div>
                      <label className="block text-xs font-bold text-gray-900 mb-1 flex items-center space-x-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Result Document Format</span>
                      </label>
                      <select
                        value={resultDocMode}
                        onChange={(e) => setResultDocMode(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer shadow-2xs"
                      >
                        <option value="sheet">📄 Standard Result Sheet (Tabular Report)</option>
                        <option value="posters">🖼️ Result E-Posters (Visual Certificate Posters)</option>
                      </select>
                      <p className="text-[11px] text-gray-500 mt-1">
                        {resultDocMode === 'posters'
                          ? 'Generates graphics-rich e-posters with podium placements, chest numbers, and result numbers'
                          : 'Generates tabular competition result sheets with scores, rankings and grades'}
                      </p>
                    </div>

                    {resultDocMode === 'posters' && (
                      <div className="space-y-3 pt-2 border-t border-indigo-100">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {/* Poster Template Selection */}
                          <div>
                            <label className="block text-xs font-bold text-gray-900 mb-1">
                              Poster Design Template
                            </label>
                            <select
                              value={resultPosterSelection}
                              onChange={(e) => setResultPosterSelection(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="result_poster">Poster 1 (Default Design)</option>
                              <option value="result_poster_2">Poster 2</option>
                              <option value="result_poster_3">Poster 3</option>
                              <option value="result_poster_4">Poster 4</option>
                              <option value="result_poster_5">Poster 5</option>
                              <option value="alternating">🔀 Shuffled / Alternating (Posters 1, 2, 3...)</option>
                              <option value="poster_wise">📑 Poster-wise (All Poster 1, then Poster 2...)</option>
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">
                              {resultPosterSelection === 'alternating' 
                                ? 'Consecutive results rotate templates automatically' 
                                : 'Select specific design or rotate through all active templates'}
                            </p>
                          </div>

                          {/* Print / Result Order */}
                          <div>
                            <label className="block text-xs font-bold text-gray-900 mb-1">
                              Print Order
                            </label>
                            <select
                              value={resultPosterOrder}
                              onChange={(e) => setResultPosterOrder(e.target.value)}
                              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                            >
                              <option value="result_number">Result Number (Result 01, 02, 03...)</option>
                              <option value="default">Competition Code / ID Order</option>
                              <option value="category">Category / Section Order</option>
                            </select>
                            <p className="text-[10px] text-gray-400 mt-1">Order pages by published result sequence</p>
                          </div>
                        </div>

                        {/* File Format Selection */}
                        <div>
                          <label className="block text-xs font-bold text-gray-900 mb-1">
                            Download File Format
                          </label>
                          <select
                            value={resultPosterFormat}
                            onChange={(e) => setResultPosterFormat(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                          >
                            <option value="pdf">📄 PDF Document (Multi-page PDF Document)</option>
                            <option value="jpg">📦 JPG Format (Single JPG or ZIP bundle named with Result No.)</option>
                          </select>
                          <p className="text-[10px] text-gray-400 mt-1">
                            {resultPosterFormat === 'jpg'
                              ? 'Outputs high-resolution JPG images. Multiple posters are packaged as a ZIP archive named with Result Numbers.'
                              : 'Compiles all posters into a single high-resolution PDF document'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Copies Per Competition & Max Mark Inputs (Valuation Sheet only) */}
                {selectedExportType === 'valuation' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-900 mb-1 flex items-center space-x-1.5">
                        <Copy className="w-3.5 h-3.5 text-gray-600" />
                        <span>Copies Per Competition / Page</span>
                      </label>
                      <select
                        value={copiesCount}
                        onChange={(e) => setCopiesCount(parseInt(e.target.value, 10))}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        <option value={1}>1 Copy (Single Judge)</option>
                        <option value={2}>2 Copies (2 Judges)</option>
                        <option value={3}>3 Copies (Standard 3 Judges)</option>
                        <option value={4}>4 Copies (4 Judges)</option>
                        <option value={5}>5 Copies (5 Judges)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-900 mb-1">
                        Judge Max Mark
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="1000"
                        value={judgeMaxMarks}
                        onChange={(e) => setJudgeMaxMarks(parseInt(e.target.value, 10) || 100)}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="e.g. 50 or 100"
                      />
                    </div>
                  </div>
                )}

                {/* Call List Type Selector (Only when Call List is selected) */}
                {selectedExportType === 'call_list' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-900 mb-1">
                      Call List Type
                    </label>
                    <select
                      value={callListMode}
                      onChange={(e) => setCallListMode(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="competition">Competition Wise Call List</option>
                      <option value="team">Team Wise Call List</option>
                      <option value="participant">Participant List</option>
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">Select format for call list generation</p>
                  </div>
                )}

                {/* Select Team Dropdown (When Call List Team/Participant Wise OR Badge is selected) */}
                {((selectedExportType === 'call_list' && (callListMode === 'team' || callListMode === 'participant')) || selectedExportType === 'badge') && (
                  <div>
                    <label className="block text-xs font-bold text-gray-900 mb-1">
                      {selectedExportType === 'badge' ? 'Team' : 'Select Team'}
                    </label>
                    <select
                      value={selectedTeamId}
                      onChange={(e) => setSelectedTeamId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="all">All teams...</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      {callListMode === 'participant'
                        ? 'Generate participant list for selected team or all teams'
                        : (selectedExportType === 'badge'
                            ? 'Download badges for a specific team or all teams'
                            : 'Generate team-wise list for selected team or all teams')}
                    </p>
                  </div>
                )}

                {/* Categories Dropdown */}
                <div>
                  <label className="block text-xs font-bold text-gray-900 mb-1">Categories</label>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                  >
                    <option value="all">All categories...</option>
                    {categories.map(c => (
                      <option key={c.code} value={c.code}>{c.name || c.code.toUpperCase()}</option>
                    ))}
                  </select>
                  <p className="text-[11px] text-gray-400 mt-1">Leave empty to include all</p>
                </div>

                {/* Competitions Searchable Dropdown (Excluded for Badges and Participant List) */}
                {selectedExportType !== 'badge' && !(selectedExportType === 'call_list' && callListMode === 'participant') && (
                  <SearchableCompetitionSelect
                    programs={programs}
                    selectedProgramId={selectedProgramId}
                    onChange={setSelectedProgramId}
                    selectedCategory={selectedCategory}
                  />
                )}

              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-5 border-t border-gray-100 bg-white flex items-center justify-between sticky bottom-0">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleCreateExportSubmit}
                disabled={generating}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors disabled:opacity-50 flex items-center space-x-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Generate Export</span>
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default EventDocuments;
