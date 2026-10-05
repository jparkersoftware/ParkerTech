/**
 * ─────────────────────────────────────────────────────────────
 *  CASE STUDIES  —  shown at /case-studies and /case-studies/<slug>
 * ─────────────────────────────────────────────────────────────
 *  To add one, copy a block and edit the fields; the index, filters and
 *  related-case-study links update automatically. Keep each study under
 *  350 words, and keep client schools anonymous ("a secondary school")
 *  unless they have given written permission to be named.
 */

import type { ServiceSlug } from './services';

export type Category = 'Products' | 'Bespoke builds' | 'Data & dashboards' | 'Infrastructure';

export const categories: Category[] = [
  'Products',
  'Bespoke builds',
  'Data & dashboards',
  'Infrastructure',
];

export interface Project {
  title: string;
  /** URL slug for /case-studies/<slug>. */
  slug: string;
  /** "Product" (any school can use it) or "Bespoke build" (made for one school). */
  kind: 'Product' | 'Bespoke build';
  /** The service page this case study appears under. */
  service: ServiceSlug;
  /** Filter chips on the case-studies index. */
  categories: Category[];
  /** One-line result, shown on cards. */
  outcome: string;
  /** One or two sentences: the page intro and meta description. */
  summary: string;
  client: { type: string; region?: string };
  /** Three or four sentences. */
  challenge: string;
  built: string[];
  /** Measurable where possible, otherwise the operational change. */
  result: string;
  tech: string[];
  year: string;
  /** Product page slug, for products. */
  product?: string;
  logo?: string;
  cover?: string;
  coverAlt?: string;
  /** How the cover fills its box: 'cover' (default) or 'contain'. */
  coverFit?: 'cover' | 'contain';
  gallery?: { src: string; caption: string }[];
  quote?: { text: string; name: string; role: string };
}

export const projects: Project[] = [
  {
    title: 'ParkerMarker',
    slug: 'parkermarker',
    kind: 'Product',
    service: 'software-products',
    categories: ['Products'],
    outcome: 'Marking a class set cut from two hours to twenty minutes in the pilot.',
    summary:
      'A comment-bank workflow piloted in a Kent secondary, now a feedback and assessment platform for UK secondary schools.',
    client: { type: 'Secondary school', region: 'Kent' },
    challenge:
      'Marking a class set of 30 books took about two hours, with a What Went Well, Even Better If and Next Steps comment for every student. After mock exams, departments kept large spreadsheets of marks per question, hunting for trends by hand. There was no quick way to turn the topics a student struggled with into a plan they could act on.',
    built: [
      'A comment-bank spreadsheet that turned a few numbers into a personalised feedback slip for each pupil, mail-merged onto a cut-and-stick template',
      'A mail merge that turned mock results into a personal improvement plan for each student',
      'ParkerMarker: both tools rebuilt as one app, with shared department comment banks, AI-suggested banks and question-level Assessment Analysis',
    ],
    result:
      'In the pilot, marking a class set fell from about two hours to twenty minutes. The teaching and learning team noticed, it was shown to subject leaders within a week, and several departments adopted it. ParkerMarker is now available to any UK secondary school.',
    tech: ['React', 'Firebase', 'Vite'],
    year: '2025',
    product: 'parkermarker',
    logo: '/logos/parkermarker.svg',
    cover: '/projects/parkermarker.svg',
    coverAlt: 'ParkerMarker Assessment Analysis screen: marks per question for a class, colour-coded by score',
  },
  {
    title: 'VocMark',
    slug: 'vocmark',
    kind: 'Product',
    service: 'software-products',
    categories: ['Products'],
    outcome: 'A criterion-by-criterion starting point for staff new to BTEC marking.',
    summary:
      'AI-assisted marking for BTEC, CACHE and OCR Nationals, built for a teaching assistant taking over a BTEC course.',
    client: { type: 'School' },
    challenge:
      'A BTEC course was being handed to a capable teaching assistant who was new to vocational qualifications, in a school where few staff had marked BTEC before. BTEC marking is exacting: every piece of work is judged against detailed Pass, Merit and Distinction criteria. The school needed a way to give a less experienced marker real confidence without taking the judgement away from them.',
    built: [
      'Upload of the course specification and assignment brief, with the assessment criteria extracted automatically',
      "A draft assessment of each student's work against every criterion, with the reasoning shown",
      'Teacher review: every draft can be edited, overruled or accepted, and the teacher remains the assessor',
      'A personal improvement plan for each student setting out what it takes to reach the next grade',
    ],
    result:
      'The new marker gets a criterion-level starting point for every piece of coursework, with every decision still theirs, in line with JCQ rules for regulated qualifications. VocMark has since grown into a product any vocational teacher can use.',
    tech: ['React', 'Firebase', 'Vite', 'Anthropic API'],
    year: '2026',
    product: 'vocmark',
    logo: '/logos/vocmark.svg',
    cover: '/projects/vocmark.svg',
    coverAlt:
      "VocMark marking grid for a Health and Social Care unit, showing which Pass, Merit and Distinction criteria each student has met",
  },
  {
    title: 'PM Review',
    slug: 'pm-review',
    kind: 'Product',
    service: 'software-products',
    categories: ['Products'],
    outcome: 'Leaders see the status of every appraisal without opening a folder.',
    summary:
      'A staff appraisal platform that replaced an emailed Word template with one tracked cycle and a live dashboard for leadership.',
    client: { type: 'School' },
    challenge:
      'Performance management ran on a Word template that staff copied, filled in and emailed to their line manager. Several versions of the same document circulated, and there was no way to see at a glance who had finished. A shared folder structure brought some order, but reporting progress to SLT still meant working through folders by hand.',
    built: [
      'Review cycles with deadlines, set up by a school admin',
      'Self-review, line-manager review, return-for-revision and mid-year check-ins in one workflow',
      'A live headteacher dashboard: completion, rating distributions and progress by line manager',
      'Automatic reminders, a CPD log and a shared document library',
      'Four roles, so staff see only what is relevant to them',
    ],
    result:
      'The whole cycle runs in one place and is tracked automatically. Line managers are notified as soon as a review reaches them, and leadership can see the status of every review without chasing anyone. All data is hosted in the UK.',
    tech: ['React', 'TypeScript', 'Tailwind CSS', 'Firebase'],
    year: '2026',
    product: 'pm-review',
    logo: '/logos/pmreview.svg',
    cover: '/projects/pmreview.webp',
    coverAlt: 'PM Review appraisal cycle dashboard showing review progress by status and line manager',
    gallery: [
      { src: '/projects/pmreview-review.webp', caption: 'A staff review: objectives, commentary and evidence' },
      { src: '/projects/pmreview-cpd.webp', caption: 'The CPD log, where staff record professional development' },
    ],
  },
  {
    title: 'Options Portal',
    slug: 'options-portal',
    kind: 'Bespoke build',
    service: 'bespoke-builds-and-data',
    categories: ['Bespoke builds'],
    outcome: 'A broken options site restored and rebuilt for phones.',
    summary:
      "A secondary school's subject-options website, rescued after a hosting change broke it and rebuilt to be mobile-friendly.",
    client: { type: 'Secondary school' },
    challenge:
      "The school's subject-options website, built by another developer, had replaced paper forms and spreadsheets: each student logged in and picked only from the courses offered to them. Then the hosting provider dropped the version of PHP it relied on, and parts of the site stopped working. Most students use a phone, and the interface had not been built for one.",
    built: [
      'The existing PHP codebase taken over, updated for the newer PHP version and brought back online',
      'A reworked, mobile-friendly interface with a cleaner design',
      'Option blocks with live validation, so invalid subject combinations are caught before submission',
      'Per-student control over which courses each student can see and select',
      'An admin dashboard tracking who has submitted, with choices exported straight into timetabling',
    ],
    result:
      'The portal is running again on a supported PHP version. Students and parents complete the process from a phone in a few minutes, there are no paper forms to collate or re-key, and leadership can see progress as it happens.',
    tech: ['PHP', 'HTML', 'CSS', 'JavaScript'],
    year: '2024',
    cover: '/projects/options-portal.svg',
    coverAlt: 'Options Portal form with pathway questions, then KS3 and KS4 subject choices',
    coverFit: 'cover',
  },
  {
    title: 'Staff Leave Request System',
    slug: 'staff-leave-request-system',
    kind: 'Bespoke build',
    service: 'bespoke-builds-and-data',
    categories: ['Bespoke builds'],
    outcome: 'Paper and email leave requests replaced with one digital approval flow.',
    summary:
      'A leave-request and approval workflow on the Microsoft Power Platform, replacing paper forms and email.',
    client: { type: 'School' },
    challenge:
      'Leave requests arrived as paper forms, emails or a quick word in the corridor. Leadership had no consistent view of who was off, who had approved what, or the history behind it.',
    built: [
      'A short Power Apps request form that works on a phone or computer',
      'Power Automate routing to the right line manager or member of SLT, with status updates to the requester',
      'One central SharePoint record of all approved leave',
      'A daily dashboard for the cover team showing who is out',
      'Reporting, a full audit trail and role-based permissions',
    ],
    result:
      'Every request now follows the same digital route and lands in one record. Approvers see the staffing picture before deciding, staff no longer chase for answers, and the cover team arranges cover from one screen.',
    tech: ['Power Apps', 'Power Automate', 'SharePoint'],
    year: '2024',
  },
  {
    title: 'Staff Behaviour Dashboard',
    slug: 'staff-behaviour-dashboard',
    kind: 'Bespoke build',
    service: 'bespoke-builds-and-data',
    categories: ['Bespoke builds', 'Data & dashboards'],
    outcome: 'Incidents logged in seconds, with alerts the moment a threshold is crossed.',
    summary:
      "A behaviour and pastoral system built into a school's SharePoint intranet, with automatic alerts and Power BI dashboards.",
    client: { type: 'School' },
    challenge:
      'The school wanted staff to log out-of-lesson incidents, headteacher detentions, exits and isolation quickly, inside the SharePoint intranet they already used. Pastoral leads needed to know as soon as a student crossed a threshold, and leadership wanted a deeper view of patterns over time.',
    built: [
      'Quick-entry incident logging built into the school intranet',
      'Power Automate tracking of every event, with alerts when a student crosses a threshold',
      "Power Apps galleries showing any student's full picture at a glance",
      'Power BI dashboards for leadership',
    ],
    result:
      'Staff log an incident in seconds, alerts fire automatically, and leaders have a single place to see behaviour trends across the school.',
    tech: ['Power Apps', 'Power Automate', 'SharePoint', 'Power BI'],
    year: '2025',
  },
  {
    title: 'Leadership Data Dashboards',
    slug: 'leadership-data-dashboards',
    kind: 'Bespoke build',
    service: 'bespoke-builds-and-data',
    categories: ['Data & dashboards'],
    outcome: 'Live MIS data in Power BI, with Bradford Factor calculated automatically.',
    summary:
      "Live data from a school's MIS, pulled through Wonde and visualised in Power BI for leadership.",
    client: { type: 'School' },
    challenge:
      "The information leadership needed was scattered across records in the school's MIS, with no single, clear view of measures such as staff attendance or Bradford Factor scores.",
    built: [
      'A Wonde integration pulling live data from the MIS',
      'Power BI dashboards designed around leadership questions',
      'Staff attendance tracking with automated Bradford Factor calculations',
    ],
    result:
      'Leadership have live dashboards built on MIS data, and Bradford Factor scores are calculated automatically.',
    tech: ['Wonde API', 'Power BI'],
    year: '2025',
  },
  {
    title: 'Exam Account Deployment',
    slug: 'exam-account-deployment',
    kind: 'Bespoke build',
    service: 'it-support',
    categories: ['Infrastructure'],
    outcome: 'Locked-down exam accounts set up the same way, every exam season.',
    summary:
      "PowerShell scripts covering the full lifecycle of a school's exam accounts, in line with JCQ requirements for exam security.",
    client: { type: "School exams office" },
    challenge:
      "On-screen exams and controlled assessments need a set of locked-down candidate accounts, each with the right name, password, groups and restrictions. Afterwards, candidates' work has to be collected and the accounts cleared down. Done by hand, account by account, the process was slow and easy to get subtly wrong, and in an exam an inconsistent setting is a real problem.",
    built: [
      "A deployment script that creates or updates accounts in Active Directory in one run, with the school's naming convention, passwords, groups and restrictions",
      "A collection script that gathers candidates' work back off the accounts",
      'A reset script that clears the accounts down ready for the next session',
    ],
    result:
      'Every exam season runs the same scripted process, producing identical, locked-down accounts without anyone working through a list by hand. The exams officer and IT team can be confident exam access is controlled and consistent.',
    tech: ['PowerShell', 'Active Directory'],
    year: '2023',
  },
];

export const projectBySlug = (slug: string) => projects.find((p) => p.slug === slug);
