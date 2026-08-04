/**
 * ─────────────────────────────────────────────────────────────
 *  SITE CONFIG  —  edit this file to update most of your website
 * ─────────────────────────────────────────────────────────────
 *  Anything marked "TODO" is a placeholder you should replace.
 */

export const site = {
  /** Brand name shown in the nav and footer. */
  brand: 'ParkerTech',

  /** Founder's name. */
  owner: 'Joseph',

  /** Short description of what the company does. */
  role: 'Software & IT support for UK schools',

  /** Contact email — where enquiries are sent. */
  email: 'joseph@parkertech.co.uk',

  /** Where you're based. */
  location: 'United Kingdom',

  /** Live site URL — keep in sync with astro.config.mjs. */
  url: 'https://parkertech.co.uk',

  /** Used for the <meta name="description"> tag and social previews. */
  description:
    'ParkerTech solves the technology problems in education — practical software and IT support for UK schools, from a company founded by a developer who spent a decade teaching.',

  /* ── Company details ──────────────────────────────────────── */
  // Legally required on the website under the Companies Act 2006 trading
  // disclosure rules: registered name, company number, place of registration
  // and registered office address.
  //
  // Any field left as an empty string is simply not rendered — so the site
  // never shows a half-finished or placeholder legal notice.
  company: {
    /** Full registered name exactly as held at Companies House. */
    legalName: '',
    /** Companies House registration number. */
    number: '',
    /** e.g. 'England and Wales'. */
    placeOfRegistration: 'England and Wales',
    /** Registered office address, one line per row. */
    registeredOffice: [] as string[],
    /** VAT registration number — leave empty if not VAT registered. */
    vatNumber: '',
    /** ICO data protection register number — leave empty until registered. */
    icoNumber: '',
  },

  /* ── Supplier credentials ─────────────────────────────────── */
  // The things a school business manager or trust procurement team checks
  // before raising a purchase order. Each row renders only if it has a value.
  credentials: {
    title: 'Straightforward to work with.',
    intro:
      'Schools and trusts have to do their due diligence before they can raise a purchase order. Here is everything you need in one place — and if your finance team needs something that is not listed, just ask.',
    // The Company and Data protection rows are built automatically from the
    // `company` block above. These are the rest — a row with an empty `value`
    // is skipped, so nothing unverified ever appears on the page.
    items: [
      {
        label: 'Insurance',
        // e.g. '£1m professional indemnity' — leave empty until the policy is in place.
        value: '',
        note: 'Certificates available to your finance team on request.',
      },
      {
        label: 'Safeguarding',
        // e.g. 'Enhanced DBS' — leave empty until the check is on file.
        value: '',
        note: 'Certificate available to share before any on-site work.',
      },
      {
        label: 'Data hosting',
        value: 'UK-based',
        note: 'Pupil and staff data stays in the UK, under a written data processing agreement.',
      },
      {
        label: 'Invoicing',
        value: 'Purchase orders welcome',
        note: 'Invoices raised against your PO number, on 30-day terms.',
      },
    ],
  },

  /* ── Hero section ─────────────────────────────────────────── */
  hero: {
    // The headline renders as:  {titleLead} {titleAccent in colour} {titleTail}
    titleLead: 'Practical software and IT support',
    titleAccent: 'for UK schools.',
    titleTail: '',
    subtext:
      "ParkerTech was founded by Joseph — a developer and former teacher with a decade in the classroom. We build practical software for schools, on a simple idea: school technology works better when the person writing the code has actually done the job.",
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
      'That became ParkerTech. Some of what we build are products any school can pick up and use, like ParkerMarker and VocMark. The rest is bespoke — intranets, data dashboards and automations built around individual schools and trusts, and the people who run them: leadership, admin and data teams as much as teachers. The aim never changes: less time lost to admin, more time for the work that matters.',
    ],
    // The "What we can help with" card. Adjust the groups and items freely.
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
        group: 'How we work',
        items: ['Bespoke to your school', 'Ready-made products', 'Built with teacher input', 'Mindful of school data'],
      },
    ],
  },

  /* ── IT support section ───────────────────────────────────── */
  // TODO: refine the wording below to match the IT services you offer.
  itSupport: {
    title: 'We keep school IT running, too.',
    intro:
      'Building software is only part of it. Alongside the products, we help schools with the technology underneath the day — from the everyday fixes to the long-term plan.',
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
