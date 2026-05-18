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
  /** Set true on ONE project to give it a larger, highlighted card. */
  featured?: boolean;
}

// TODO: refine any wording and confirm the launch years.
export const projects: Project[] = [
  {
    title: 'ParkerMarker',
    kind: 'Product',
    logo: '/logos/parkermarker.svg',
    blurb: 'Mark faster, feed back better.',
    description:
      'A feedback and assessment platform for UK secondary schools. ParkerMarker lets teachers build shared comment banks, mark quickly, export polished feedback slips and generate personal improvement plans — then turns the results into clear assessment insight for whole departments.',
    tags: ['Marking & feedback', 'Comment banks', 'Assessment insight'],
    year: '2025',
    liveUrl: 'https://parkermarker.co.uk',
    featured: true,
  },
  {
    title: 'VocMark',
    kind: 'Product',
    logo: '/logos/vocmark.svg',
    blurb: 'AI marking for BTEC & vocational courses.',
    description:
      'An AI-powered marking platform for UK vocational qualifications — BTEC, CACHE and OCR Nationals. Teachers upload the course spec and assignment brief; VocMark extracts the assessment criteria, grades each submission against them with clear reasoning, and produces a personalised improvement plan for every student.',
    tags: ['AI-powered', 'BTEC & vocational', 'Improvement plans'],
    year: '2026',
    liveUrl: 'https://vocmark.co.uk',
  },
  {
    title: 'PM Review',
    kind: 'Product',
    blurb: 'The whole appraisal cycle, in one place.',
    description:
      'A complete staff appraisal platform for schools. PM Review runs the full cycle — objective setting, self-review with evidence, CPD logging, and progress dashboards for leadership — with automatic reminders that keep deadlines on track. All data is hosted in the UK.',
    tags: ['Staff appraisal', 'CPD tracking', 'School leadership'],
    year: '2026',
    liveUrl: 'https://performancemanagements.web.app',
  },
  {
    title: 'Staff Absence System',
    kind: 'Bespoke build',
    blurb: 'A paperless absence and cover workflow.',
    description:
      "A bespoke absence system built for a school on the Microsoft Power Platform — Power Apps, Power Automate and SharePoint — replacing a paper-based process. Staff request leave and flag which lessons need covering; requests route to their line manager and then the headship team for sign-off, while the cover team gets a dashboard showing exactly who's away each day.",
    tags: ['Power Platform', 'Approval workflows', 'Cover management'],
    year: '2024',
    note: 'Built privately for one school — not publicly available.',
  },
];
