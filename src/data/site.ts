/**
 * ─────────────────────────────────────────────────────────────
 *  SITE CONFIG  —  edit this file to update most of the website
 * ─────────────────────────────────────────────────────────────
 *  Voice rule: ParkerTech is the subject of every sentence. Joseph is
 *  named only on the founder profile and in testimonials.
 *
 *  Anything left as an empty string is simply not rendered, so the site
 *  never shows a half-finished placeholder. Fill a value in and it appears.
 */

export const site = {
  /** Brand name shown in the header and footer. */
  brand: 'ParkerTech',

  /** Founder — used on the founder profile and in structured data only. */
  founder: 'Joseph Parker',

  /** Short description of what the company does. */
  role: 'Software, data and IT support for UK schools',

  /** Public contact address (a role inbox that forwards to Joseph). */
  email: 'hello@parkertech.co.uk',

  /** TODO: a UK landline or VoIP number — not a personal mobile. */
  phone: '',

  /** Where the company is based. */
  location: 'Rochester, Kent',

  /** Live site URL — keep in sync with astro.config.mjs. */
  url: 'https://parkertech.co.uk',

  /** Homepage <title> (the brand is appended automatically). */
  title: 'School software, MIS data and IT support for UK schools',

  /** Used for the <meta name="description"> tag and social previews. */
  description:
    'ParkerTech delivers school software, MIS integration, Power Platform builds and IT support for UK schools and trusts. UK-hosted, PO-friendly, founded by a former teacher.',

  /** Response-time promise, shown on the contact page and in the form. */
  // The word joiner (\u2060) keeps "1–2" from breaking across lines.
  responseTime: 'We reply within 1–\u20602 working days.',

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

  /* ── Homepage hero ────────────────────────────────────────── */
  hero: {
    title: 'Software, data and IT support built for UK schools.',
    subtext:
      'ParkerTech builds school software, integrates MIS data and runs IT projects for schools and trusts across the UK. Founded by a former teacher, so every tool is designed around how schools actually work.',
  },

  /* ── Trust strip (directly under the hero) ────────────────── */
  // Only list things that are true today. Add Cyber Essentials here once certified.
  trust: [
    { icon: 'shield', label: 'UK-hosted data' },
    { icon: 'file', label: 'Purchase orders accepted' },
    { icon: 'lock', label: 'DPA provided' },
    { icon: 'cap', label: 'Founded by a former teacher' },
  ],

  /* ── Outcomes band ────────────────────────────────────────── */
  // Every line here must be something ParkerTech can evidence. If a number
  // can't be backed up, use a plain statement instead.
  outcomes: [
    {
      headline: '2 hours → 20 minutes',
      text: 'Time to mark a class set of 30 books in the Kent secondary pilot that ParkerMarker grew out of.',
      href: '/case-studies/parkermarker',
    },
    {
      headline: 'Paper to digital',
      text: 'Paper and email leave requests replaced with one approval flow that routes each request to the right person.',
      href: '/case-studies/staff-leave-request-system',
    },
    {
      headline: 'One scripted run',
      text: 'Locked-down exam accounts created, collected and reset the same way every exam season, not by hand.',
      href: '/case-studies/exam-account-deployment',
    },
  ],

  /* ── How we work (homepage and About) ─────────────────────── */
  process: [
    {
      title: 'Discovery call',
      text: 'A free 30-minute call to understand the problem, the people involved and what a good result looks like.',
    },
    {
      title: 'Scoped proposal',
      text: 'A written scope with a fixed price or day rate, so your finance team knows the cost before work starts.',
    },
    {
      title: 'Build and pilot',
      text: 'We build in stages and pilot with the staff who will use it, adjusting as we go.',
    },
    {
      title: 'Handover and support',
      text: 'Training for the people using it, and support once it is live.',
    },
  ],

  /* ── About: the company ───────────────────────────────────── */
  about: {
    title: 'Built by people who have worked in schools.',
    intro: [
      'ParkerTech was founded by Joseph Parker, who combined a decade of teaching with IT management and software development to build tools schools would actually use. Today the company delivers ready-made products, bespoke builds and IT support for schools and multi-academy trusts.',
      'ParkerTech is based in Rochester, Kent, and works with schools and trusts across the UK. Every project runs to a written scope and is invoiced against a purchase order.',
    ],
    beliefs: [
      {
        title: 'School technology works better when its makers know the job.',
        text: 'Every product and build starts from how a school actually runs: the timetable, the cover list, the marking pile and the data return. Tools are designed with the staff who will use them, not handed over at the end.',
      },
      {
        title: 'Less time on admin, more time for the work that matters.',
        text: 'The measure of a good system is the time it gives back to teachers, leaders and support staff. If a tool adds clicks without removing work, it has not done its job.',
      },
    ],
  },

  /* ── About: founder profile ───────────────────────────────── */
  // The only page where first-person copy appears — as pull-quotes.
  founderProfile: {
    name: 'Joseph Parker',
    role: 'Founder, ParkerTech',
    /** TODO: path to an 800×800 headshot in public/, e.g. '/people/joseph-parker.jpg'. */
    photo: '',
    bio: [
      'Joseph Parker founded ParkerTech after a decade teaching in schools, including geography and vocational BTEC courses. He brings that classroom experience together with school IT management and software development.',
      'Several ParkerTech products began as tools he built for colleagues: a comment-bank spreadsheet that cut marking a class set from two hours to twenty minutes grew into ParkerMarker, and a marking aid for a colleague new to BTEC became VocMark. He left the classroom to work on school technology full-time.',
      "Joseph leads ParkerTech's product, bespoke build and IT support work, with a focus on assessment, school operations data, and the Microsoft and Google platforms schools already run on.",
    ],
    quotes: [
      'ParkerMarker began as a survival tactic. In my first years of teaching, a single class set of thirty geography books took about two hours to mark.',
      'I know the Sunday evenings lost to marking, the clunky systems that fight you instead of helping, and the quiet wish that someone would just build the tool you actually needed.',
    ],
  },

  /* ── Working with schools: due diligence ──────────────────── */
  // The things a school business manager or trust procurement team checks
  // before raising a purchase order. A row with an empty `value` is skipped,
  // so nothing unverified ever appears on the page.
  credentials: {
    title: 'Working with schools',
    intro:
      'Schools and trusts need to complete due diligence before raising a purchase order. Everything a finance team or data protection officer usually asks for is below. If something is missing, email us and we will send it.',
    // The Company, VAT and ICO rows are built automatically from the
    // `company` block above. These are the rest.
    items: [
      {
        label: 'Data hosting',
        value: 'UK-based',
        note: 'Pupil and staff data stays in the UK, under a written data processing agreement.',
      },
      {
        label: 'Data processing agreement',
        value: 'Provided as standard',
        note: 'A written DPA is in place before we handle any pupil or staff data. Ask us for a copy to review.',
      },
      {
        label: 'GDPR and DPIAs',
        value: 'DPIA support',
        note: 'We can help your data protection officer complete a DPIA for any system we build or supply.',
      },
      {
        label: 'Invoicing',
        value: 'Purchase orders welcome',
        note: 'Invoices raised against your PO number, on 30-day terms.',
      },
      {
        label: 'Insurance',
        // TODO: e.g. '£1m public liability · £1m professional indemnity'.
        value: '',
        note: 'Certificates available to your finance team on request.',
      },
      {
        label: 'Safeguarding',
        // TODO: e.g. 'Enhanced DBS, on the Update Service'.
        value: '',
        note: 'Certificate available to share before any on-site work.',
      },
      {
        label: 'Cyber Essentials',
        // TODO: fill in only once certified.
        value: '',
        note: '',
      },
      {
        label: 'Support',
        // TODO: support hours and response times, e.g. 'Mon–Fri, 8am–5pm term time'.
        value: '',
        note: '',
      },
      {
        label: 'Cancellation',
        // TODO: notice period for ongoing support or licences.
        value: '',
        note: '',
      },
      {
        label: 'References',
        value: 'Available on request',
        note: 'We can put you in touch with school leaders we have worked with.',
      },
    ],
  },

  /* ── Contact form ─────────────────────────────────────────── */
  // Web3Forms access key — submissions are emailed to the address the key
  // was created with (set in the Web3Forms dashboard, not here).
  // This key is safe to be public.
  web3formsKey: 'f065eb0f-00c9-482f-be79-a75e1d7b013b',

  /* ── Analytics ────────────────────────────────────────────── */
  // Google Analytics 4 Measurement ID. Analytics load only after a visitor
  // accepts the cookie-consent banner.
  googleAnalyticsId: 'G-ZPJ0JW0GRV',

  /* ── Testimonials ─────────────────────────────────────────── */
  // Aim for three, with at least one from a trust-level contact.
  testimonials: [
    {
      quote:
        "The standard of Joseph's work is exceptional. He has expertly supported the school to automate a wide range of systems and processes that have resulted in significant efficiency improvements, whilst freeing up leaders to work strategically and be that all important visible presence around the school. No task has proven too small or insurmountable for Joseph, and the quality of creativity, support and guidance he has provided is simply outstanding. Thank you Joseph.",
      name: 'Dan Walton',
      role: 'Associate Headteacher & Ofsted Inspector',
      context: "On ParkerTech's work at St John's Catholic Comprehensive",
    },
  ],
};

export type Site = typeof site;
