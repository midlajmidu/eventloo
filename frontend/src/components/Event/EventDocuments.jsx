import React, { useState, useEffect } from 'react';
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
  Info
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
    return {
      chestNo: chestNumbers.join(', '),
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

  // Build full details list matching user screenshot
  const detailsList = [];

  detailsList.push('Gender: All genders');

  if (item.category && item.category !== 'all') {
    detailsList.push(`Categories: ${item.category.toUpperCase()}`);
  } else {
    detailsList.push('Categories: All categories');
  }

  if (item.programId && item.programId !== 'all') {
    const prog = programs.find(p => p.id === parseInt(item.programId, 10));
    detailsList.push(`Competitions: ${prog ? prog.name : 'Selected Competition'}`);
  } else {
    detailsList.push('Competitions: All competitions');
  }

  detailsList.push('Schedule: All schedule states');
  detailsList.push('Scheduled stages: All stages');
  detailsList.push('Standings: All standings');
  detailsList.push('Range: Result 1 to All');

  if (item.type === 'results') {
    detailsList.push('Results: Published only');
    detailsList.push('Signature Column: Excluded');
  } else if (item.type === 'valuation') {
    detailsList.push(`Copies: ${item.copiesCount || 3}`);
    detailsList.push(`Max Mark: ${item.judgeMaxMarks || 100}`);
    detailsList.push('Signature Column: Excluded');
  } else if (item.type === 'green_room') {
    detailsList.push('Layout: Single page per competition');
    detailsList.push('Code Letter Column: Blank for manual entry');
  } else if (item.type === 'call_list') {
    detailsList.push(`Mode: ${item.callListMode === 'team' ? 'Team Wise' : 'Competition Wise'}`);
    if (item.selectedTeamId && item.selectedTeamId !== 'all') {
      const tm = teams.find(t => t.id === parseInt(item.selectedTeamId, 10));
      detailsList.push(`Team: ${tm ? tm.name : 'Selected Team'}`);
    }
  } else if (item.type === 'certificate') {
    detailsList.push(`Quality: ${(item.exportQuality || 'screen').toUpperCase()}`);
    detailsList.push(`Types: ${(item.certTypes || []).length} selected`);
  } else if (item.type === 'badge') {
    detailsList.push(`Quality: ${(item.exportQuality || 'screen').toUpperCase()}`);
    detailsList.push('Participant Badges (9 per A4 sheet)');
    if (item.selectedTeamId && item.selectedTeamId !== 'all') {
      const tm = teams.find(t => t.id === parseInt(item.selectedTeamId, 10));
      detailsList.push(`Team: ${tm ? tm.name : 'Selected Team'}`);
    } else {
      detailsList.push('Team: All teams');
    }
    if (item.category && item.category !== 'all') {
      detailsList.push(`Category: ${item.category.toUpperCase()}`);
    } else {
      detailsList.push('Category: All categories');
    }
  }

  // Extract visible pills from item.pills (excluding hardcoded '+4' or '+8' strings)
  const rawPills = (item.pills || []).filter(p => typeof p === 'string' && !p.startsWith('+'));
  const firstPill = rawPills.length > 0 
    ? rawPills[0] 
    : (item.category && item.category !== 'all' ? `Categories: ${item.category.toUpperCase()}` : 'Gender: All genders');
  
  const overflowCount = Math.max(1, detailsList.length - 1);

  return (
    <div className="flex items-center space-x-2 flex-wrap gap-y-1 relative">
      <span className="text-xs font-semibold text-gray-900">{item.summary}</span>

      {/* Main Visible Tag Pill */}
      <span className="px-2.5 py-0.5 text-[11px] font-semibold bg-gray-100/90 text-gray-700 rounded-full border border-gray-200/80">
        {firstPill}
      </span>

      {/* Overflow Badge (+X) with Hover Popover Card */}
      <div 
        className="relative inline-block"
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <button
          type="button"
          className="px-2 py-0.5 text-[11px] font-bold bg-gray-100 text-gray-700 rounded-full border border-gray-200/90 hover:bg-gray-200 transition-colors cursor-pointer"
        >
          +{overflowCount}
        </button>

        {/* Hover Popover Box matching user screenshot */}
        {hovered && (
          <div className="absolute left-0 top-full mt-1.5 z-50 w-72 p-3.5 bg-white border border-gray-200 rounded-2xl shadow-xl space-y-1.5 text-xs text-gray-700 font-medium leading-relaxed pointer-events-none animate-in fade-in zoom-in-95">
            {detailsList.map((detail, idx) => (
              <div key={idx} className="flex items-center space-x-2 text-[11px] text-gray-700 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0" />
                <span>{detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>
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
      setPrograms(progRes.data?.results || progRes.data || []);
      setTeams(teamRes.data?.results || teamRes.data || []);
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
            pills: ['Categories: General (GEN)', 'Copies: 3', 'Max Mark: 100', '+4'],
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
            pills: ['Categories: General (GEN)', '+4'],
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
            pills: ['Gender: All genders', '+8'],
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
        const stageType = resultProgram.program_type === 'off_stage' ? 'Off Stage' : 'Stage';
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
          </section>
        `;
      }

      if (pageCount === 0) {
        pagesHtml = `
          <section class="result-page">
            <div class="result-event-name">${escapeHtml(event?.title || 'Eventloo Event')}</div>
            <h1 class="result-title">Competition Results</h1>
            <div class="result-empty-state">No published results match the selected filters.</div>
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

          const catMap = {};
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
            const documentRows = groupDocumentAssignments(program, teamAssignments);
            if (documentRows.length === 0) continue;
            const categoryName = (program.category || 'General').toUpperCase();
            if (!catMap[categoryName]) catMap[categoryName] = [];
            catMap[categoryName].push({ program, rows: documentRows });
          }

          let tablesHtml = '';
          Object.keys(catMap).forEach(cName => {
            const categoryPrograms = catMap[cName];
            let rows = '';
            categoryPrograms.forEach(({ program, rows: programRows }) => {
              const countSuffix = (program.is_team_based && program.team_size)
                ? ` (${program.team_size} Participants)`
                : '';
              programRows.forEach(row => {
                rows += `
                  <tr>
                    <td>${escapeHtml(program.name)}${escapeHtml(countSuffix)}</td>
                    <td class="center font-bold">${escapeHtml(row.chestNo)}</td>
                    <td>${escapeHtml(row.participantNames)}</td>
                  </tr>
                `;
              });
            });

            tablesHtml += `
              <div class="category-header">${escapeHtml(cName)} (${categoryPrograms.length})</div>
              <table class="main-table">
                <thead>
                  <tr>
                    <th style="width: 45%;">Competition</th>
                    <th class="center" style="width: 18%;">Chest No</th>
                    <th style="width: 37%;">Participant</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            `;
          });

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
            </div>
          `;
        }

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

          pagesHtml += `
            <div class="program-page" ${pageBreak}>
              <div class="header">
                <div>${escapeHtml(event?.title || 'Event')}</div>
                <div>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              </div>
              <div class="title">Competitions Call List</div>
              <div class="hr"></div>
              <div class="subheader">
                <div><u><strong>${escapeHtml(progName)}</strong></u></div>
                <div><u><strong>${escapeHtml(progCat)}</strong></u></div>
                <div><u><strong>${escapeHtml(progType)}</strong></u></div>
              </div>
              <table class="main-table">
                <thead>
                  <tr>
                    <th class="center" style="width: 10%;">Sl. No</th>
                    <th class="center" style="width: 15%;">Chest No</th>
                    <th style="width: 45%;">Participant</th>
                    <th style="width: 30%;">Team Name</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
              <div class="total-part">Total participants: ${slNo}</div>
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
          } else {
            rowCount = 3;
          }

          for (let r = 0; r < rowCount; r++) {
            rowsHtml += `
              <tr>
                <td class="center font-bold"></td>
                <td></td><td></td><td></td><td></td>
                <td></td>
              </tr>
            `;
          }

          for (let copyIdx = 0; copyIdx < copies; copyIdx++) {
            pageCount++;
            const pageBreak = pageCount > 1 ? 'style="page-break-before: always;"' : '';
            pagesHtml += `
              <div class="program-page" ${pageBreak}>
                <div class="header">
                  <div>${escapeHtml(event?.title || 'Event')}</div>
                  <div>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
                <div class="title">Valuation Sheet</div>
                <div class="hr"></div>
                <div class="stage-no">Stage No: ________</div>
                
                <table class="info-box">
                  <tbody>
                    <tr>
                      <td class="center font-bold" style="width: 38%;">${escapeHtml(progName)}</td>
                      <td class="center font-bold" style="width: 35%;">${escapeHtml(progCat)}</td>
                      <td class="center font-bold" style="width: 27%;">${escapeHtml(progType)}</td>
                    </tr>
                  </tbody>
                </table>

                <table class="main-table">
                  <thead>
                    <tr>
                      <th class="center" style="width: 18%;">Code Letter</th>
                      <th class="center" colspan="4" style="width: 54%;">Marks</th>
                      <th class="center" style="width: 28%;">Mark out of ${maxMarkVal}</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${rowsHtml}
                  </tbody>
                </table>
              </div>
            `;
          }
        } else {
          // Green Room Sign Sheet format
          let rowsHtml = '';
          if (assignments.length > 0) {
            const documentRows = groupDocumentAssignments(prog, assignments);
            rowsHtml = documentRows.map(row => {
              // Code Letter column is left blank for manual handwriting before event
              return `
                <tr>
                  <td class="center">${escapeHtml(row.chestNo)}</td>
                  <td>${escapeHtml(row.participantNames)}</td>
                  <td class="center"></td>
                  <td></td>
                </tr>
              `;
            }).join('');
          } else {
            rowsHtml = `
              <tr><td class="center">&nbsp;</td><td>&nbsp;</td><td class="center">&nbsp;</td><td></td></tr>
              <tr><td class="center">&nbsp;</td><td>&nbsp;</td><td class="center">&nbsp;</td><td></td></tr>
            `;
          }

          rowsHtml += `
            <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
            <tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>
          `;

          pageCount++;
          const pageBreak = (i > 0 && exportItem?.pageLayout !== 'continuous') ? 'style="page-break-before: always;"' : '';

          pagesHtml += `
            <div class="program-page" ${pageBreak}>
              <div class="header">
                <div>${escapeHtml(event?.title || 'Event')}</div>
                <div>${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
              </div>
              <div class="title">Green Room Sign Sheet</div>
              <div class="hr"></div>
              <div class="subheader">
                <div><strong>${escapeHtml(progName)}</strong></div>
                <div style="text-transform: none; font-weight: normal;">${escapeHtml(progType)}</div>
                <div><strong>${escapeHtml(progCat)}</strong></div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th class="center" style="width: 15%;">Chest No</th>
                    <th style="width: 45%;">Participant</th>
                    <th class="center" style="width: 15%;">Code Letter</th>
                    <th style="width: 25%;">Participants Signature</th>
                  </tr>
                </thead>
                <tbody>
                  ${rowsHtml}
                </tbody>
              </table>
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
          @page { margin: 0; size: landscape; }
          body { font-family: Inter, Arial, sans-serif; padding: 0; color: #0f172a; background: #fff; margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .program-page { box-sizing: border-box; min-height: 100vh; padding: 34px 44px 40px; }
          .header { display: flex; justify-content: space-between; padding-bottom: 10px; border-bottom: 1px solid #cbd5e1; color: #64748b; font-size: 12px; font-weight: 600; }
          .header > div:first-child { color: #312e81; font-weight: 800; letter-spacing: .02em; }
          .title { color: #0f172a; font-size: 28px; line-height: 1.05; font-weight: 800; margin-top: 16px; margin-bottom: 6px; }
          .subtitle { font-size: 14px; font-weight: 600; color: #475569; margin-bottom: 8px; }
          .category-header { color: #312e81; background: #eef2ff; border-left: 4px solid #4f46e5; padding: 8px 10px; font-size: 13px; font-weight: 800; margin-top: 18px; margin-bottom: 8px; }
          .hr { border-bottom: 2px solid #4f46e5; margin-bottom: 14px; }
          .stage-no { text-align: right; color: #475569; font-size: 12px; font-weight: 700; margin-bottom: 12px; }
          .subheader { display: flex; justify-content: space-between; gap: 16px; padding: 10px 12px; border: 1px solid #cbd5e1; background: #f8fafc; font-size: 12px; font-weight: bold; margin-bottom: 14px; text-transform: uppercase; }
          table { width: 100%; border-collapse: collapse; margin-top: 10px; margin-bottom: 15px; }
          table.info-box td { border: 1px solid #c7d2fe; padding: 10px; font-size: 12px; background: #eef2ff; color: #312e81; }
          table.main-table th { border: 1px solid #cbd5e1; padding: 9px; font-size: 11px; background: #4f46e5; color: #fff; }
          table.main-table td { border: 1px solid #cbd5e1; padding: 9px; font-size: 11px; }
          table.main-table tbody tr:nth-child(even) td { background: #f8fafc; }
          th { border: 1px solid #cbd5e1; padding: 9px; font-size: 11px; background: #4f46e5; color: #fff; text-align: left; }
          th.center { text-align: center; }
          td { border: 1px solid #cbd5e1; padding: 9px; font-size: 11px; }
          td.center { text-align: center; }
          .font-bold { font-weight: bold; }
          .total-part { text-align: right; font-size: 11px; font-weight: 600; color: #475569; margin-top: 5px; }
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
        await generateClientPdfFallback(exportItem);
        success = true;
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
      if (exportItem.type === 'results') {
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
    if (exportItem.status === 'processing') return;
    setGenerating(true);
    try {
      await processAndDownloadExport(exportItem);
    } catch (err) {
      console.error('Download click error:', err);
      window.alert(err?.message || `Unable to generate ${exportItem.typeName || 'document'}.`);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateExportSubmit = () => {
    const typeConfig = exportTypes.find(t => t.id === selectedExportType) || exportTypes[0];
    
    let summaryText = `${typeConfig.title}`;
    if (selectedExportType === 'call_list' && callListMode === 'team') {
      const tm = teams.find(t => t.id === parseInt(selectedTeamId, 10));
      summaryText += ` (Team Wise: ${tm ? tm.name : 'All Teams'})`;
    } else if (selectedProgramId !== 'all') {
      const prog = programs.find(p => p.id === parseInt(selectedProgramId, 10));
      if (prog) summaryText += ` for ${prog.name}`;
    } else {
      summaryText += ` for ${selectedCategory === 'all' ? 'All categories' : selectedCategory.toUpperCase()}`;
    }

    const pills = [];
    if (selectedExportType === 'call_list') {
      pills.push(`Type: ${callListMode === 'team' ? 'Team Wise' : 'Competition Wise'}`);
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
      pills.push('Published results only');
    }
    if (selectedCategory !== 'all') pills.push(`Categories: ${selectedCategory.toUpperCase()}`);
    else pills.push('Categories: General (GEN)');
    if (selectedExportType === 'valuation') {
      pills.push(`Copies: ${copiesCount}`);
      pills.push(`Max Mark: ${judgeMaxMarks}`);
    }
    pills.push('+4');

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
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'results',
      title: 'Results',
      description: 'Published result sheets with standings, grades and points per competition.',
      icon: Trophy,
      iconBg: 'bg-amber-100/70 text-amber-700',
    },
    {
      id: 'certificate',
      title: 'Certificate',
      description: 'Participation and placement certificates for competitions.',
      icon: Award,
      iconBg: 'bg-amber-50 text-amber-600',
    },
    {
      id: 'badge',
      title: 'Badge',
      description: 'Official paper badges (9 per A4 sheet with cut guides, chest numbers & programs).',
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
        return <PhoneCall className="w-4 h-4 text-amber-600" />;
      case 'results':
        return <Trophy className="w-4 h-4 text-amber-600" />;
      case 'badge':
        return <BadgeCheck className="w-4 h-4 text-indigo-600" />;
      case 'certificate':
        return <Award className="w-4 h-4 text-amber-600" />;
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
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-3"></div>
        <p className="text-xs text-gray-500 font-medium">Loading Documents Queue...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      
      {/* Top Header Card Box */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">Documents & Exports</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Files are processed in the background, auto-downloaded when ready, and expire after 2 days
          </p>
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-2xs transition-colors inline-flex items-center space-x-1.5 self-start sm:self-auto cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New Export</span>
        </button>
      </div>

      {/* Main Exports Queue Table */}
      <div className="bg-white border border-gray-100 rounded-3xl shadow-2xs overflow-hidden">
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
                            item.status === 'processing'
                              ? 'text-gray-300 cursor-not-allowed'
                              : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100 cursor-pointer'
                          }`}
                          title={item.status === 'processing' ? 'Processing export...' : 'Download Document'}
                        >
                          {item.status === 'processing' ? (
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
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
                        <span>Exports official Eventloo paper badges (9 cards per A4 sheet with cut guides, chest numbers, programs & event counts). Ready to print without templates.</span>
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
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">Select format for call list generation</p>
                  </div>
                )}

                {/* Select Team Dropdown (When Call List Team Wise OR Badge is selected) */}
                {((selectedExportType === 'call_list' && callListMode === 'team') || selectedExportType === 'badge') && (
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
                      {selectedExportType === 'badge'
                        ? 'Download badges for a specific team or all teams'
                        : 'Generate team-wise list for selected team or all teams'}
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

                {/* Competitions Dropdown (Excluded for Badges as badges are participant-level) */}
                {selectedExportType !== 'badge' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-900 mb-1">Competitions</label>
                    <select
                      value={selectedProgramId}
                      onChange={(e) => setSelectedProgramId(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                    >
                      <option value="all">All competitions...</option>
                      {programs.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.category?.toUpperCase()})</option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">Leave empty to include all</p>
                  </div>
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
