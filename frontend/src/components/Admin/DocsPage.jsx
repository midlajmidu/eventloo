import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  BookOpen,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  FileText,
  GraduationCap,
  KeyRound,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserCheck,
  Users,
} from 'lucide-react';

const sections = [
  {
    id: 'school-setup',
    number: '01',
    title: 'School setup',
    subtitle: 'Prepare school identity, categories and classes before entering operational data.',
    icon: Settings,
    link: '/admin/settings',
    linkLabel: 'Open Settings',
    blocks: [
      {
        title: 'School details',
        items: [
          'Open Settings → School Details and enter the school name, email, phone, address, logo and visual identity used by the portal and generated documents.',
          'Review these values before creating exports because school information can appear on event documents and certificates.',
        ],
      },
      {
        title: 'Student categories',
        items: [
          'Create every standard student category used by the school, such as Lower Primary, Upper Primary, High School or Higher Secondary.',
          'Use a short, stable category code. Existing students and programs refer to this code, so avoid changing it after live registrations begin.',
          'A general or mixed category combines selected standard categories for programs. Students themselves remain in a standard category.',
          'Deactivate categories that should no longer be selectable instead of reusing their code for a different meaning.',
        ],
      },
      {
        title: 'Classes',
        items: [
          'Create each class with a unique code and connect it to exactly one standard category.',
          'The selected student class must belong to the student category. This rule is checked in manual creation and bulk upload.',
          'Class and category setup should be finished before downloading a student bulk-upload template.',
        ],
      },
      {
        title: 'Backup and transfer',
        items: [
          'Use Settings → Import / Export for school configuration or supported data-transfer operations.',
          'Keep a fresh backup before large imports, structural category changes or the start of result entry.',
        ],
      },
    ],
    note: 'Point configuration is intentionally not stored in global school settings. Configure points separately inside every event.',
  },
  {
    id: 'teams',
    number: '02',
    title: 'Teams and portal access',
    subtitle: 'Create teams first so students can be assigned manually or during bulk upload.',
    icon: Users,
    link: '/admin/teams',
    linkLabel: 'Open Teams',
    blocks: [
      {
        title: 'Create a team',
        items: [
          'Open Teams and select Add Team. Enter the team name and description, then save.',
          'Each team receives its own number and team-portal credentials. Teams are isolated within the current school.',
          'Use View to inspect the team, its members and program participation. Use Edit to update team information.',
        ],
      },
      {
        title: 'Team credentials',
        items: [
          'Open Credentials to copy the team username and password for the responsible team manager.',
          'Regenerating credentials invalidates the previous password. Share new credentials through a secure channel.',
          'A team manager sees only their own school, team members, published/available events and permitted assignments.',
        ],
      },
      {
        title: 'Membership rules',
        items: [
          'A student can belong to only one school team at a time. Changing the team moves the student rather than duplicating membership.',
          'Deleting a team is destructive and can affect related registrations. Review members and program assignments first.',
        ],
      },
    ],
  },
  {
    id: 'students',
    number: '03',
    title: 'Students',
    subtitle: 'Add students manually, import a prepared workbook and assign each student to a team.',
    icon: GraduationCap,
    link: '/admin/students',
    linkLabel: 'Open Students',
    blocks: [
      {
        title: 'Add one student',
        items: [
          'Select Add Student and enter Full Name, Category and Grade/Class. Section and Address are optional.',
          'The category must be active and non-mixing; the grade/class must belong to that category.',
          'After saving, use the team action to assign or move the student. Use the eye button to review profile, team, programs, results and earned points.',
        ],
      },
      {
        title: 'Bulk upload',
        items: [
          'Select Bulk Upload and download a new Excel template after teams, categories and classes are configured.',
          'Enter students only in the Students sheet. The columns match manual creation: name, category, class, section and address, plus optional team_name.',
          'Use the Example sheet for a safe demonstration based on the school’s real category, class and team. Do not copy its demo name unless required.',
          'Use the dropdowns where available. The Setup sheet lists every valid school category, class relationship and team.',
          'Clear spelling differences may be matched automatically and are reported after upload. Ambiguous values are rejected to prevent a wrong assignment.',
          'The complete workbook is validated before creation. An unknown team or invalid category/class relationship prevents a partial import.',
        ],
      },
      {
        title: 'Identifiers and chest numbers',
        items: [
          'Student ID and internal login values are generated automatically when needed.',
          'Creating a student does not create an event chest number. A chest number is generated only when that student is first assigned to a program in an event.',
          'The same student keeps the same chest number throughout that event, including later program assignments.',
        ],
      },
    ],
  },
  {
    id: 'events',
    number: '04',
    title: 'Create and manage events',
    subtitle: 'Create the event shell, control its lifecycle and then open the event workspace.',
    icon: CalendarDays,
    link: '/admin/events',
    linkLabel: 'Open Events',
    blocks: [
      {
        title: 'Create an event',
        items: [
          'Select Add Event and enter the title, start date and end date. Add description, venue, event type, maximum participants and registration deadline when applicable.',
          'Use Draft while preparing. Published makes the event available to the intended portal workflows. Ongoing and Completed communicate the live lifecycle state.',
          'Use the event View action to enter its dedicated management workspace. Event-specific setup and operations live there.',
        ],
      },
      {
        title: 'Recommended order inside an event',
        items: [
          'Settings → Programs → Assignments → Participants → Documents → Mark Entry → Results → Top Scorers / Points → Certificates.',
          'Complete settings before registration and mark entry. Changing limits or scoring rules after results exist can alter expected outcomes.',
        ],
      },
    ],
  },
  {
    id: 'event-settings',
    number: '05',
    title: 'Event settings and point configuration',
    subtitle: 'These rules belong to one event and drive registration, judging, grades and points.',
    icon: ShieldCheck,
    blocks: [
      {
        title: 'Registration cutoff',
        items: [
          'Set the registration cutoff date and time in the event timezone shown by the interface.',
          'After the cutoff, team managers cannot make new program assignments. Administrators retain only the authority supported by the event workflow.',
        ],
      },
      {
        title: 'Student participation limits',
        items: [
          'Set the maximum number of Individual/Single programs allowed per student.',
          'Set the maximum number of Group/Team programs allowed per student.',
          'Enable Unlimited only when the event has no limit for that program type. There is no separate total-program limit.',
        ],
      },
      {
        title: 'Judging and marks',
        items: [
          'Choose the number of judges, maximum mark per judge and converted final scale.',
          'Mark Entry requires a valid mark for every configured judge. The final mark is calculated and converted using these event values.',
        ],
      },
      {
        title: 'Grading and program grade points',
        items: [
          'Enable grading when the event needs grade bands such as A+, A, B+ and B.',
          'Event Settings defines only each grade name and its non-overlapping score range from 0–100%.',
          'Inside Add/Edit Program, optionally enter the absolute points awarded for each grade. A configured grade value replaces placement points; it is never added as a bonus.',
          'Leave a program grade value blank to use the normal event placement points. If grading is disabled, every program uses placement points.',
        ],
      },
      {
        title: 'Placement points',
        items: [
          'Configure 1st, 2nd and 3rd place points separately for Standard Individual, Standard Group/Team, General/Mixed Individual and General/Mixed Group/Team programs.',
          'Use Count toward participant personal score to decide whether General/Mixed Individual points also enter participant profiles, Top Scorers and global student percentages. It is off by default; team points remain active either way.',
          'Participation Points apply to eligible positions after third place according to the event result rules.',
          'Published results use these event settings to generate the real points records used by participant profiles, team totals and top scorers.',
        ],
      },
    ],
    warning: 'Finalize judge, grade and point settings before entering marks or publishing results.',
  },
  {
    id: 'programs',
    number: '06',
    title: 'Programs',
    subtitle: 'Build every competition with the correct category, type, capacity and schedule.',
    icon: BookOpen,
    blocks: [
      {
        title: 'Individual programs',
        items: [
          'Enter program name, category, program type, venue, start/end time, description and participant capacity per team.',
          'Each assignment represents one student. Only students eligible for the selected category can be assigned.',
        ],
      },
      {
        title: 'Group or team-based programs',
        items: [
          'Enable Team Based, then define Members per Sub-Team and the number of sub-teams allowed per school/team.',
          'A sub-team is one competition entry. Keep sub-team numbers separate when the same team enters multiple groups.',
          'All members of one sub-team remain grouped together in call lists, green-room sheets, valuation sheets and result views.',
        ],
      },
      {
        title: 'Standard and general programs',
        items: [
          'A standard-category program accepts students from that category.',
          'A general/mixed program accepts students from the standard categories configured inside that mixed category.',
          'General programs should be created manually so category intent and scoring type can be reviewed.',
        ],
      },
      {
        title: 'Bulk program upload',
        items: [
          'Use the program template for supported standard programs, verify category codes and limits, then upload.',
          'Review imported programs before opening registration, especially team size, sub-team count, capacity and schedule.',
        ],
      },
    ],
  },
  {
    id: 'assignments',
    number: '07',
    title: 'Assignments and team-manager registration',
    subtitle: 'Register eligible students while preserving team, category, limit and sub-team boundaries.',
    icon: UserCheck,
    blocks: [
      {
        title: 'Administrator assignment',
        items: [
          'Open Assignments, choose category and team, then open the required program.',
          'For an individual program, assign eligible students up to the configured per-team capacity.',
          'For a group program, build the selected sub-team. Members can be added through the supported assignment flow until the required group is complete.',
          'A student must belong to the selected school/team and satisfy category and event participation limits.',
        ],
      },
      {
        title: 'Team-manager portal',
        items: [
          'The team manager signs in with the team credentials and sees only available events and programs for their school.',
          'The portal lists only that team’s students who satisfy the program category rules.',
          'The registration cutoff and individual/group participation limits are enforced server-side, not only by the screen.',
          'For team programs, select the correct members and sub-team number. Separate sub-teams must never be merged.',
        ],
      },
      {
        title: 'Chest-number behavior',
        items: [
          'Only a student assigned to at least one program in the event receives a chest number.',
          'That number is stable across every program in the same event. Adding another program does not change it.',
          'For group entries, documents display members together using Name (Chest No) formatting.',
        ],
      },
    ],
  },
  {
    id: 'participants-documents',
    number: '08',
    title: 'Participants and documents',
    subtitle: 'Verify the registration data before printing operational sheets.',
    icon: FileText,
    blocks: [
      {
        title: 'Participants tab',
        items: [
          'Review assigned students, team, category, programs and event chest numbers.',
          'Participant points must come from published result records. Do not treat placeholders or unpublished calculations as earned points.',
          'Correct assignment or team errors before generating documents.',
        ],
      },
      {
        title: 'Valuation sheet',
        items: [
          'Generate judge copies using the configured judge count and maximum marks.',
          'Verify event name, program, category, participant/chest data and the required marking columns.',
        ],
      },
      {
        title: 'Call list',
        items: [
          'Choose Competition Wise for program-by-program calling or Team Wise for a selected team.',
          'Individual entries appear one student per row. A group sub-team appears as one row with all of its members and chest numbers.',
        ],
      },
      {
        title: 'Green room sheet',
        items: [
          'Use the green-room export for participant verification and movement control.',
          'Members of the same program sub-team stay together in one row; a second sub-team receives its own row.',
        ],
      },
      {
        title: 'Results export',
        items: [
          'Result documents use published competition results and include standing, chest number, candidate/member names, team, grade and points where configured.',
          'Confirm result publication before export. Unpublished results should not appear as official results.',
        ],
      },
    ],
  },
  {
    id: 'marks-results',
    number: '09',
    title: 'Mark entry, results and points',
    subtitle: 'Enter complete judge marks, review rankings and publish only verified outcomes.',
    icon: Trophy,
    blocks: [
      {
        title: 'Mark Entry',
        items: [
          'Choose a program with assignments. Enter every judge mark within the event maximum.',
          'Save as Draft to continue later. Final submission makes the completed result available for publication review.',
          'Editing a published result requires explicit confirmation. Recheck ranks, grades and points after any approved edit.',
        ],
      },
      {
        title: 'Results',
        items: [
          'Review final marks, ordering, ties, standing, grade and generated points before publishing.',
          'Publish one completed program or use Publish All for eligible submitted programs. Incomplete mark entry is skipped.',
          'Unpublish only when a correction is genuinely required; official exports and scoreboards depend on publication state.',
        ],
      },
      {
        title: 'Event points',
        items: [
          'The Points tab summarizes team points created from published results under this event’s point configuration.',
          'Individual results award the applicable participant/team record. Group results are treated as one competition entry while retaining all members.',
        ],
      },
      {
        title: 'Top Scorers',
        items: [
          'Top Scorers includes published results only and separates stage, offstage and total points.',
          'Enable Include Team Based Programs to include eligible group-program contributions.',
          'Enable Include General Category Programs to include published general/mixed contributions. General individual contributions also require the event’s personal-score setting to be enabled.',
          'Use category and team filters to narrow the leaderboard. A checkbox cannot display a program until its result is published.',
        ],
      },
      {
        title: 'Global points',
        items: [
          'The main Points page compares performance across complete events using earned points against the available event total and presents the resulting percentage.',
          'Global totals are derived from event results; manual award entry is not part of the normal workflow.',
        ],
      },
    ],
  },
  {
    id: 'certificates',
    number: '10',
    title: 'Certificates and final export',
    subtitle: 'Design templates, preview real fields and produce output that matches the preview.',
    icon: Award,
    blocks: [
      {
        title: 'Available certificate types',
        items: [
          'Configure templates for 1st Place, 2nd Place, 3rd Place and Participation certificates.',
          'Common Prize, Grade Certificate, Result Poster and Badge are marked Coming Soon and should not be used as completed workflows.',
        ],
      },
      {
        title: 'Template design',
        items: [
          'Upload the certificate background and enable only the fields required on the design.',
          'Position Participant Name, Participant ID / Chest No, Category, Team, Event Name, Rank and Photo as needed.',
          'Adjust font, size, color, alignment and placement in the preview. Save the template for that certificate type.',
        ],
      },
      {
        title: 'Generate certificates',
        items: [
          'Open Documents → New Export → Certificate, select the certificate types and print quality, then generate.',
          'The exported certificate uses the same layout and fields shown in the certificate preview.',
          'Placement certificates require published result positions. Participation certificates use assigned participant data.',
        ],
      },
    ],
  },
  {
    id: 'final-checklist',
    number: '11',
    title: 'Event-day and closing checklist',
    subtitle: 'A final verification sequence for reliable documents, results and scoreboards.',
    icon: ClipboardCheck,
    blocks: [
      {
        title: 'Before registration opens',
        items: [
          'Verify school details, categories, class mappings, teams and student membership.',
          'Finalize registration cutoff, participation limits, judge configuration, grading and placement points.',
          'Review every program’s category, individual/group type, capacity, team size and sub-team limit.',
        ],
      },
      {
        title: 'Before competitions begin',
        items: [
          'Confirm all assignments and stable event chest numbers in Participants.',
          'Check that every group sub-team has the correct members and leader where required.',
          'Generate and inspect call lists, green-room sheets and valuation sheets before bulk printing.',
        ],
      },
      {
        title: 'Before publishing',
        items: [
          'Confirm all judge marks, final marks, positions, ties, grades and points.',
          'Publish verified program results, then refresh Results, Points and Top Scorers.',
          'Generate official result documents and certificates only after publication checks are complete.',
        ],
      },
    ],
  },
];

const quickSteps = [
  'Configure school, categories and classes',
  'Create teams and secure portal credentials',
  'Add or bulk-upload students and assign teams',
  'Create an event and finalize event settings',
  'Create individual, group and general programs',
  'Complete assignments and verify chest numbers',
  'Print operational sheets and enter marks',
  'Review, publish, export and issue certificates',
];

const DocsPage = () => {
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSections = useMemo(() => {
    if (!normalizedQuery) return sections;
    return sections.filter((section) => JSON.stringify(section).toLowerCase().includes(normalizedQuery));
  }, [normalizedQuery]);

  return (
    <div className="min-h-full bg-slate-50/70 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-3xl border border-indigo-100 bg-white shadow-sm">
          <div className="relative px-6 py-8 sm:px-8">
            <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-indigo-600 via-violet-500 to-blue-500" />
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-3xl">
                <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-indigo-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-indigo-700">
                  <Sparkles className="h-3 w-3" /> Administrator handbook
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">Event management documentation</h1>
                <p className="mt-1.5 max-w-2xl text-xs leading-5 text-slate-400 font-normal">
                  A complete operating guide from the first school setup through teams, students, events, judging, published results, documents and certificates.
                </p>
              </div>
              <div className="relative w-full lg:max-w-sm">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search the documentation"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:border-indigo-300 focus:bg-white focus:ring-2 focus:ring-indigo-100"
                />
              </div>
            </div>
          </div>
        </header>

        {!normalizedQuery && (
          <section className="mt-5 rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-indigo-600" />
              <h2 className="text-sm font-semibold text-slate-950">Recommended complete workflow</h2>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {quickSteps.map((step, index) => (
                <div key={step} className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-bold text-white">{index + 1}</span>
                  <p className="text-xs font-medium leading-5 text-slate-600">{step}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="mt-6 grid gap-6 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <div className="sticky top-6 rounded-2xl border border-slate-200/80 bg-white p-3 shadow-sm">
              <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">On this page</p>
              <nav className="max-h-[70vh] space-y-0.5 overflow-y-auto">
                {sections.map((section) => (
                  <a key={section.id} href={`#${section.id}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 transition hover:bg-indigo-50 hover:text-indigo-700">
                    <span className="text-[10px] font-semibold text-slate-300">{section.number}</span>
                    <span>{section.title}</span>
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          <main className="space-y-5">
            {visibleSections.map((section) => {
              const Icon = section.icon;
              return (
                <article id={section.id} key={section.id} className="scroll-mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm">
                  <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-indigo-600">Step {section.number}</p>
                          <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">{section.title}</h2>
                          <p className="mt-1 text-sm leading-6 text-slate-500">{section.subtitle}</p>
                        </div>
                      </div>
                      {section.link && (
                        <Link to={section.link} className="inline-flex shrink-0 items-center gap-1.5 self-start rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-100">
                          {section.linkLabel}<ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-px bg-slate-100 sm:grid-cols-2">
                    {section.blocks.map((block) => (
                      <section key={block.title} className="bg-white px-5 py-5 sm:px-6">
                        <h3 className="text-sm font-semibold text-slate-900">{block.title}</h3>
                        <ol className="mt-3 space-y-2.5">
                          {block.items.map((item, index) => (
                            <li key={item} className="flex gap-3 text-sm leading-6 text-slate-600">
                              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-400" />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ol>
                      </section>
                    ))}
                  </div>

                  {(section.note || section.warning) && (
                    <div className={`mx-5 mb-5 mt-1 rounded-xl border px-4 py-3 text-xs leading-5 sm:mx-6 ${section.warning ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-indigo-100 bg-indigo-50 text-indigo-800'}`}>
                      <span className="font-semibold">{section.warning ? 'Important: ' : 'Note: '}</span>
                      {section.warning || section.note}
                    </div>
                  )}
                </article>
              );
            })}

            {visibleSections.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
                <Search className="mx-auto h-6 w-6 text-slate-300" />
                <h2 className="mt-3 text-sm font-semibold text-slate-900">No documentation found</h2>
                <p className="mt-1 text-sm text-slate-500">Try a broader term such as points, teams, marks or certificates.</p>
              </div>
            )}

            <footer className="rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-600 to-violet-600 px-6 py-6 text-white shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex items-center gap-2"><KeyRound className="h-4 w-4" /><p className="text-sm font-semibold">Security reminder</p></div>
                  <p className="mt-1 max-w-2xl text-xs leading-5 text-indigo-100">Keep administrator and team credentials private, regenerate exposed team passwords, and verify the active school and event before importing, publishing or deleting data.</p>
                </div>
                <Link to="/admin/dashboard" className="inline-flex shrink-0 items-center justify-center rounded-lg bg-white px-4 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-50">Return to Dashboard</Link>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
};

export default DocsPage;
