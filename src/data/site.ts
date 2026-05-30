/**
 * ─────────────────────────────────────────────────────────────
 *  SITE CONFIG  —  edit this file to update most of your website
 * ─────────────────────────────────────────────────────────────
 *  Anything marked "TODO" is a placeholder you should replace.
 */

export const site = {
  /** Brand name shown in the nav and footer. */
  brand: 'ParkerTech',

  /** Your name. */
  owner: 'Joseph',

  /** Short description of what you do. */
  role: 'Software & IT support for UK schools',

  /** Contact email — where enquiries are sent. */
  email: 'joseph@parkertech.co.uk',

  /** Where you're based. */
  location: 'United Kingdom',

  /** Live site URL — keep in sync with astro.config.mjs. */
  url: 'https://parkertech.co.uk',

  /** Used for the <meta name="description"> tag and social previews. */
  description:
    'ParkerTech solves the technology problems in education — practical software and IT support for UK schools, from a developer who spent a decade teaching.',

  /* ── Hero section ─────────────────────────────────────────── */
  hero: {
    // The headline renders as:  {titleLead} {titleAccent in colour} {titleTail}
    titleLead: 'School technology that',
    titleAccent: 'makes the grade.',
    titleTail: '',
    subtext:
      "I'm Joseph — a developer and former teacher with a decade in the classroom. ParkerTech is where I build practical software for schools, and a place to see what's possible when the person writing the code has actually done the job.",
  },

  /* ── Contact form ─────────────────────────────────────────── */
  // Web3Forms access key — form submissions are emailed straight to you,
  // and the visitor stays on the site. (This key is safe to be public.)
  web3formsKey: 'f065eb0f-00c9-482f-be79-a75e1d7b013b',

  /* ── Analytics ────────────────────────────────────────────── */
  // Google Analytics 4 Measurement ID. Analytics load only after a visitor
  // accepts the cookie-consent banner.
  googleAnalyticsId: 'G-ZPJ0JW0GRV',

  /* ── About section ────────────────────────────────────────── */
  about: {
    paragraphs: [
      "I'm Joseph. I spent a decade teaching in schools, so I know the Sunday evenings lost to marking, the clunky systems that fight you instead of helping, and the quiet wish that someone would just build the tool you actually needed.",
      "Eventually I decided to build it myself. I left the classroom to focus on technology full-time, and now I create software for schools — designed around how they really work, by someone who's been on the other side of the staffroom door.",
      'Some of what I build are products any school can pick up and use, like ParkerMarker and VocMark. The rest is bespoke — intranets, data dashboards and automations built around a single school and the people who run it: leadership, admin and data teams as much as teachers. The aim never changes: less time lost to admin, more time for the work that matters.',
    ],
    // The "What I can help with" card. Adjust the groups and items freely.
    capabilities: [
      {
        group: 'Assessment & marking',
        items: ['Marking automation', 'AI-assisted grading', 'Vocational coursework (BTEC)', 'Feedback & moderation'],
      },
      {
        group: 'School operations & data',
        items: ['Staff absence & cover', 'Performance management', 'Power BI dashboards', 'Wonde & MIS integration'],
      },
      {
        group: 'Cloud & infrastructure',
        items: ['Cloud modernisation', 'Chromebook rollouts', 'Google Workspace setup', 'Network refresh'],
      },
      {
        group: 'How I work',
        items: ['Bespoke to your school', 'Ready-made products', 'Built with teacher input', 'Mindful of school data'],
      },
    ],
  },

  /* ── IT support section ───────────────────────────────────── */
  // TODO: refine the wording below to match the IT services you offer.
  itSupport: {
    title: 'I keep school IT running, too.',
    intro:
      'Building software is only part of it. Alongside the products, I help schools with the technology underneath the day — from the everyday fixes to the long-term plan.',
    services: [
      {
        title: 'Everyday IT support',
        description:
          'A dependable point of contact for the issues that stall a school day — accounts, devices, access and the rest — handled quickly and without the fuss.',
      },
      {
        title: 'Cloud & infrastructure',
        description:
          'Planning and delivering modern, cloud-first infrastructure, so schools run on systems that are resilient, secure and straightforward to manage.',
      },
      {
        title: 'IT strategy & systems',
        description:
          'Helping school leaders make sensible, well-structured technology decisions — with proper processes behind them, not guesswork.',
      },
      {
        title: 'MIS migration & setup',
        description:
          'Moving schools onto Arbor with full data migration from their previous MIS, then configuring it to fit — including assessment setup for individual schools and multi-academy trusts.',
      },
    ],
  },

  /* ── Testimonials ─────────────────────────────────────────── */
  testimonials: [
    {
      quote:
        "The standard of Joseph's work is exceptional. He has expertly supported the school to automate a wide range of systems and processes that have resulted in significant efficiency improvements, whilst freeing up leaders to work strategically and be that all important visible presence around the school. No task has proven too small or insurmountable for Joseph, and the quality of creativity, support and guidance he has provided is simply outstanding. Thank you Joseph.",
      name: 'Dan Walton',
      role: 'Associate Headteacher & Ofsted Inspector',
      org: "St John's Catholic Comprehensive",
    },
  ],
};

export type Site = typeof site;
