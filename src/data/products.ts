/**
 * ─────────────────────────────────────────────────────────────
 *  PRODUCTS  —  the ready-made tools, shown at /products/<slug>
 * ─────────────────────────────────────────────────────────────
 *  `pricing`, `trial` and `dataProtection` render only when filled
 *  in, so leave them empty until the terms are confirmed.
 */

export interface Product {
  slug: string;
  name: string;
  /** Page <title>, written around the terms schools search for. */
  pageTitle: string;
  logo: string;
  /** One-line value statement. */
  tagline: string;
  /** Hero paragraph and meta description. */
  summary: string;
  /** Short "who it's for" line for the products index. */
  audienceLine: string;
  /** Fuller "who it's for" points on the detail page. */
  audience: { role: string; text: string }[];
  features: { title: string; text: string }[];
  /** Origin story in the third person — 80 words at most. */
  origin: string;
  /** e.g. 'Per-department licence, billed annually'. Empty shows a contact line. */
  pricing: string;
  /** e.g. '30-day free trial for one department'. */
  trial: string;
  /** Only state what is true for this product's hosting and AI use. */
  dataProtection: string;
  liveUrl: string;
  image: { src: string; alt: string };
  gallery?: { src: string; caption: string }[];
  /** Matching case study slug. */
  caseStudy: string;
}

export const products: Product[] = [
  {
    slug: 'parkermarker',
    name: 'ParkerMarker',
    pageTitle: 'ParkerMarker: marking and feedback software for schools',
    logo: '/logos/parkermarker.svg',
    tagline: 'Mark faster, feed back better.',
    summary:
      'A feedback and assessment platform for UK secondary schools. Shared comment banks, printable feedback slips and question-level analysis that turns results into a personal improvement plan for every student.',
    audienceLine: 'Teachers, heads of department and assessment leads in secondary schools.',
    audience: [
      { role: 'Teachers', text: 'Consistent feedback without writing the same comment thirty times.' },
      { role: 'Heads of department', text: 'Shared comment banks and assignments, so a team marks to one standard.' },
      { role: 'School leaders', text: 'Class-by-class comparisons that show where support is needed most.' },
    ],
    features: [
      {
        title: 'Feedback Slips',
        text: 'Build What Went Well, Even Better If and Next Steps comment banks, assign them with a click or a code, then print, cut and stick.',
      },
      {
        title: 'Assessment Analysis',
        text: 'Enter marks per question and see which topics a class found hardest, with a tolerance mark that flags weak performance.',
      },
      {
        title: 'Personal Improvement Plans',
        text: 'A plan for every student showing what they know, what they do not, and the tasks to close the gap. AI can build the analysis grid from a question paper.',
      },
    ],
    origin:
      'ParkerMarker grew out of a comment-bank spreadsheet first used in a Kent secondary, where it cut the time to mark a class set of 30 books from about two hours to twenty minutes. Several departments adopted it. A second tool, which turned mock-exam results into personal improvement plans, became Assessment Analysis. ParkerMarker brings both together in one app.',
    pricing: '',
    trial: '',
    dataProtection: '',
    liveUrl: 'https://parkermarker.co.uk',
    image: {
      src: '/projects/parkermarker.svg',
      alt: 'ParkerMarker Assessment Analysis screen: marks per question for a class, colour-coded by score',
    },
    caseStudy: 'parkermarker',
  },
  {
    slug: 'vocmark',
    name: 'VocMark',
    pageTitle: 'VocMark: AI-assisted BTEC marking software',
    logo: '/logos/vocmark.svg',
    tagline: 'AI-assisted marking for BTEC and vocational courses.',
    summary:
      'An AI-assisted marking platform for BTEC, CACHE and OCR Nationals. VocMark reads the specification and assignment brief, drafts an assessment against every criterion with its reasoning, and the teacher reviews and decides.',
    audienceLine: 'Vocational teachers, especially those new to BTEC or without a specialist nearby.',
    audience: [
      { role: 'Teachers new to vocational courses', text: 'A criterion-by-criterion starting point that builds marking confidence.' },
      { role: 'Vocational and BTEC leads', text: 'More consistent grading across a team.' },
      { role: 'Students', text: 'Specific feedback on what it takes to reach the next grade.' },
    ],
    features: [
      {
        title: 'Criteria from your documents',
        text: 'Upload the course specification and assignment brief; VocMark extracts the Pass, Merit and Distinction criteria.',
      },
      {
        title: 'Draft assessments with reasoning',
        text: "Each student's PDF is assessed against the criteria, with the reasoning shown. The draft is a starting point, never a verdict.",
      },
      {
        title: 'Improvement plans',
        text: 'A personal plan for each student, setting out exactly what they would need to do to reach the next grade.',
      },
    ],
    origin:
      'VocMark was built to support one colleague: a capable teaching assistant taking over a BTEC course in a school where few staff had marked BTEC before. Vocational marking is exacting, with every piece judged against detailed criteria. VocMark gave a less experienced marker a clear starting point while keeping every decision with them, and grew into a product any vocational teacher can use.',
    pricing: '',
    trial: '',
    // TODO: confirm before filling — VocMark sends coursework to an AI model, so
    // state where that processing happens and that inputs are not used for training.
    dataProtection: '',
    liveUrl: 'https://vocmark.co.uk',
    image: {
      src: '/projects/vocmark.svg',
      alt: "VocMark marking grid for a Health and Social Care unit, showing which Pass, Merit and Distinction criteria each student has met and their overall grade",
    },
    caseStudy: 'vocmark',
  },
  {
    slug: 'pm-review',
    name: 'PM Review',
    pageTitle: 'PM Review: staff appraisal software for schools',
    logo: '/logos/pmreview.svg',
    tagline: 'The whole appraisal cycle, in one place.',
    summary:
      'A staff appraisal platform for schools. PM Review runs the full cycle — objectives, self-review with evidence, line-manager review, mid-year check-ins and CPD — with a live dashboard for leadership and automatic reminders.',
    audienceLine: 'Headteachers, school admins and line managers running appraisal.',
    audience: [
      { role: 'Headteachers', text: 'Live status of every review across the school.' },
      { role: 'Line managers', text: 'Notified the moment a review is submitted to them.' },
      { role: 'Staff', text: 'One place for their self-review, deadlines and CPD log.' },
    ],
    features: [
      {
        title: 'Structured review cycles',
        text: 'Admins set up cycles with deadlines; staff complete self-reviews, line managers review, return or submit, and mid-year check-ins follow the same loop.',
      },
      {
        title: 'Live leadership dashboard',
        text: 'Completion, rating distributions and progress by line manager, updated in real time.',
      },
      {
        title: 'CPD log and document library',
        text: 'Staff record professional development through the year, alongside a shared document library.',
      },
    ],
    origin:
      'PM Review replaces an appraisal process run on an emailed Word template, where several versions of the same document circulated and leaders had no quick way to see who had finished. A shared folder structure helped, but still meant checking folders by hand. PM Review puts the whole cycle in one place and tracks it automatically.',
    pricing: '',
    trial: '',
    dataProtection: 'All PM Review data is hosted in the UK.',
    liveUrl: 'https://performancemanagements.web.app',
    image: {
      src: '/projects/pmreview.webp',
      alt: 'PM Review appraisal cycle dashboard showing review progress by status and line manager',
    },
    gallery: [
      { src: '/projects/pmreview-review.webp', caption: 'A staff review: objectives, commentary and evidence' },
      { src: '/projects/pmreview-cpd.webp', caption: 'The CPD log, where staff record professional development' },
    ],
    caseStudy: 'pm-review',
  },
];
