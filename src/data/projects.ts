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
  /** Set true on ONE project to give it a larger, highlighted card. */
  featured?: boolean;
}

// TODO: check the details below and refine any wording. Years and the two
// URLs marked TODO need confirming — see the README / chat notes.
export const projects: Project[] = [
  {
    title: 'ParkerMarker',
    kind: 'Product',
    blurb: 'Marking, dramatically faster.',
    description:
      'A web tool that takes the grind out of marking. ParkerMarker helps teachers work through student assessments quickly and consistently — turning a long evening of marking into a manageable task, and handing teachers their evenings back.',
    tags: ['Marking', 'Time-saving', 'For teachers'],
    year: '2025',
    liveUrl: 'https://parkermarker.co.uk',
    featured: true,
  },
  {
    title: 'VocMark',
    kind: 'Product',
    blurb: 'AI-assisted marking for vocational coursework.',
    description:
      'Marking vocational coursework such as BTECs is detailed, criteria-heavy work. VocMark uses AI to help teachers assess vocational submissions against the assessment criteria — faster, and with consistent, well-evidenced feedback.',
    tags: ['AI-assisted', 'BTEC & vocational', 'Assessment'],
    year: '2025',
    // TODO: confirm VocMark's real web address (this is a best guess).
    liveUrl: 'https://vocmark.co.uk',
  },
  {
    title: 'Performance Management System',
    kind: 'Product',
    blurb: 'Staff appraisals, without the spreadsheet sprawl.',
    description:
      'A performance management system built for schools. It gives leadership a clear, structured way to set objectives, record progress through the year, and run appraisals — replacing scattered documents with one organised place.',
    tags: ['School leadership', 'Appraisals', 'Staff development'],
    year: '2024',
    // TODO: confirm the real web address for this tool.
    liveUrl: 'https://example.com',
  },
  {
    title: 'Staff Absence System',
    kind: 'Bespoke build',
    blurb: 'A paperless absence and cover workflow.',
    description:
      'A bespoke tool built for a school to handle staff absence requests. It replaced a paper-and-email process with a simple digital workflow — staff submit requests, leadership review and approve them, and cover is organised, all in one place.',
    tags: ['Bespoke build', 'Staff admin', 'Workflow'],
    year: '2024',
    note: 'Built privately for one school — not publicly available.',
  },
];
