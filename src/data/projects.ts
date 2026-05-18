/**
 * ─────────────────────────────────────────────────────────────
 *  PROJECTS  —  the tools you've built, shown in the Projects grid
 * ─────────────────────────────────────────────────────────────
 *  To add a project, copy a block and edit the fields.
 *  To remove one, delete its block. The page updates automatically.
 */

export interface Project {
  /** Project name shown on the card. */
  title: string;
  /** URL slug for the project's detail page (/projects/<slug>). */
  slug: string;
  /** "Product" (any school can use it) or "Bespoke build" (made for one school). */
  kind: 'Product' | 'Bespoke build';
  /** One short line summarising the project. */
  blurb: string;
  /** A sentence or two with more detail. */
  description: string;
  /** Descriptive tags — what it does, who it's for. */
  tags: string[];
  /** Year or status label shown in the card corner. */
  year: string;
  /** Optional link visitors can click. Omit it to present the project as a case study. */
  liveUrl?: string;
  /** Optional note shown instead of a link (e.g. for private builds). */
  note?: string;
  /** Optional path to the project's own logo, e.g. '/logos/name.svg'. */
  logo?: string;
  /** Optional cover image for the card (in public/projects/). */
  cover?: string;
  /** How the cover fills its box: 'cover' (default, fills) or 'contain' (fits, centred). */
  coverFit?: 'cover' | 'contain';
  /** Set true on ONE project to give it a larger, highlighted card. */
  featured?: boolean;
  /** Optional one-line tech summary, shown on the detail page. */
  builtWith?: string;
  /** Optional long-form case study, shown on the detail page. */
  story?: { heading: string; body: string[] }[];
}

export const projects: Project[] = [
  {
    title: 'ParkerMarker',
    slug: 'parkermarker',
    kind: 'Product',
    logo: '/logos/parkermarker.svg',
    cover: '/projects/parkermarker.svg',
    blurb: 'Mark faster, feed back better.',
    description:
      'A feedback and assessment platform for UK secondary schools. ParkerMarker lets teachers build shared comment banks, mark quickly, export polished feedback slips and generate personal improvement plans — then turns the results into clear assessment insight for whole departments.',
    tags: ['Marking & feedback', 'Comment banks', 'Assessment insight'],
    year: '2025',
    liveUrl: 'https://parkermarker.co.uk',
    featured: true,
    builtWith: 'React, Firebase and Vite',
    story: [
      {
        heading: 'Where it started',
        body: [
          "ParkerMarker began as a survival tactic. In my first years of teaching, a single class set of thirty geography books took about two hours to mark — a What Went Well, Even Better If and Next Steps comment for every student. So I built a spreadsheet: three comment banks, and lookups that turned a few numbers into a bespoke WWW/EBI/NS slip for each pupil. Mail-merged onto a cut-and-stick template, it brought that two hours down to twenty minutes. The teaching and learning team noticed, and within a week I was showing it to subject leaders — several departments adopted it. That spreadsheet is what ParkerMarker's Feedback Slips grew out of.",
          "The other half came from assessment. After mock exams we kept large spreadsheets of marks per question, hunting for trends. One year I was asked to build a mail merge that could take the topics a student had struggled with and turn them into a personal improvement plan — their score, what they had done well, where the gaps were, and revision tasks to close them. That became ParkerMarker's Assessment Analysis. The app brings both ideas together, properly built, in one place.",
        ],
      },
      {
        heading: 'How it works',
        body: [
          'ParkerMarker is two tools in one app. You create your class once, then choose the workflow that fits the task in front of you.',
          "Feedback Slips is for everyday marking. You build three comment banks yourself, or let the built-in AI suggest WWW/EBI/NS banks from the question you're marking. Then you mark with ParkerMarker open, assigning comments to each student with a click or a quick code. When you're done, you export the slips, print, cut and stick them into books — consistent feedback without writing the same comment thirty times.",
          "Assessment Analysis is for gap analysis after an assessment. You enter the questions from a paper — the marks available, the topic, and a tolerance mark that flags weak performance — attach a class, and put in each student's marks per question. ParkerMarker does the rest: a clear picture of how the class performed and which topics they found hardest, plus a Personal Improvement Plan for every student showing what they know, what they don't, and the tasks to bridge the gap. You can also hand the AI a question paper and have it build the analysis grid for you — then you just enter the marks.",
        ],
      },
      {
        heading: "Who it's for",
        body: [
          'ParkerMarker is built for teachers, heads of department and school leaders. Teachers get their evenings back, with feedback that stays consistent without losing their own voice. Departments get shared comment banks and shared assignments, so a whole team marks to the same standard — and leaders can compare classes and see where support is needed most.',
        ],
      },
    ],
  },
  {
    title: 'VocMark',
    slug: 'vocmark',
    kind: 'Product',
    logo: '/logos/vocmark.svg',
    cover: '/projects/vocmark.svg',
    blurb: 'AI marking for BTEC & vocational courses.',
    description:
      'An AI-powered marking platform for UK vocational qualifications — BTEC, CACHE and OCR Nationals. Teachers upload the course spec and assignment brief; VocMark extracts the assessment criteria, grades each submission against them with clear reasoning, and produces a personalised improvement plan for every student.',
    tags: ['AI-powered', 'BTEC & vocational', 'Improvement plans'],
    year: '2026',
    liveUrl: 'https://vocmark.co.uk',
  },
  {
    title: 'PM Review',
    slug: 'pm-review',
    kind: 'Product',
    logo: '/logos/pmreview.svg',
    cover: '/projects/pmreview.webp',
    blurb: 'The whole appraisal cycle, in one place.',
    description:
      'A complete staff appraisal platform for schools. PM Review runs the full cycle — objective setting, self-review with evidence, CPD logging, and progress dashboards for leadership — with automatic reminders that keep deadlines on track. All data is hosted in the UK.',
    tags: ['Staff appraisal', 'CPD tracking', 'School leadership'],
    year: '2026',
    liveUrl: 'https://performancemanagements.web.app',
  },
  {
    title: 'Options Portal',
    slug: 'options-portal',
    kind: 'Bespoke build',
    blurb: 'Subject options, controlled per student.',
    description:
      "A yearly subject-options website built for a school. Students choose the courses they'll take next year — but the school decides exactly which courses each individual student can see and select, so no one signs up to a subject they aren't set up to succeed on.",
    tags: ['Subject options', 'Per-student access', 'School admin'],
    year: '2024',
    note: 'Built privately for a school — not publicly available.',
  },
  {
    title: 'Staff Absence System',
    slug: 'staff-absence-system',
    kind: 'Bespoke build',
    blurb: 'A paperless absence and cover workflow.',
    description:
      "A bespoke absence system built for a school on the Microsoft Power Platform — Power Apps, Power Automate and SharePoint — replacing a paper-based process. Staff request leave and flag which lessons need covering; requests route to their line manager and then the headship team for sign-off, while the cover team gets a dashboard showing exactly who's away each day.",
    tags: ['Power Platform', 'Approval workflows', 'Cover management'],
    year: '2024',
    note: 'Built privately for one school — not publicly available.',
  },
  {
    title: 'Staff Behaviour Dashboard',
    slug: 'staff-behaviour-dashboard',
    kind: 'Bespoke build',
    blurb: 'Log, track and act on behaviour in one place.',
    description:
      "A behaviour and pastoral system built into a school's SharePoint intranet on the Microsoft Power Platform. Staff log incidents — out-of-lesson, headteacher detentions, exits and isolation — in seconds, and Power Automate tracks every event, firing alerts the moment a student crosses a threshold. Power Apps galleries give staff the full picture of any student at a glance, while Power BI dashboards give leadership the deeper view.",
    tags: ['Power Platform', 'Behaviour tracking', 'Power BI insight'],
    year: '2025',
    note: 'Built privately for a school — not publicly available.',
  },
  {
    title: 'Leadership Data Dashboards',
    slug: 'leadership-data-dashboards',
    kind: 'Bespoke build',
    blurb: 'Live MIS data, visualised for leadership.',
    description:
      "A data integration that pulls live information straight from a school's MIS using Wonde and visualises it in Power BI. It turns scattered records into clear dashboards for leadership — including staff attendance tracking and automated Bradford Factor calculations.",
    tags: ['Wonde + MIS', 'Power BI', 'Leadership data'],
    year: '2025',
    note: 'Built privately for a school — not publicly available.',
  },
  {
    title: 'Exam Account Automation',
    slug: 'exam-account-automation',
    kind: 'Bespoke build',
    blurb: 'Secure exam accounts, set up in seconds.',
    description:
      "A PowerShell automation built for a school's exams office. It provisions secure, locked-down candidate accounts ahead of on-screen exams and retrieves every candidate's files automatically once the exam finishes — replacing a manual, error-prone process with a fast, repeatable one that meets JCQ requirements for exam security.",
    tags: ['PowerShell', 'Exam administration', 'JCQ compliant'],
    year: '2023',
    note: 'Built privately for a school — not publicly available.',
  },
];
