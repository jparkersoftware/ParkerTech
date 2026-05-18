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
  role: 'Educational technology developer & former teacher',

  /** Contact email — where enquiries are sent. */
  email: 'joseph@parkertech.co.uk',

  /** Where you're based. */
  location: 'United Kingdom',

  /** Set to false to hide the "open to new work" badges. */
  available: true,

  /** Live site URL — keep in sync with astro.config.mjs. */
  url: 'https://parkertech.co.uk',

  /** Used for the <meta name="description"> tag and social previews. */
  description:
    'ParkerTech builds educational technology for schools — practical tools that save teachers time, made by a developer who spent a decade in the classroom.',

  /* ── Hero section ─────────────────────────────────────────── */
  hero: {
    // The headline renders as:  {titleLead} {titleAccent in colour} {titleTail}
    titleLead: 'Technology that gives teachers',
    titleAccent: 'their time back.',
    titleTail: '',
    subtext:
      "I'm Joseph — a developer and former teacher with a decade in the classroom. ParkerTech is where I build practical software for schools, and a place to see what's possible when the person writing the code has actually done the job.",
  },

  /* ── Contact form ─────────────────────────────────────────── */
  // Web3Forms access key — form submissions are emailed straight to you,
  // and the visitor stays on the site. (This key is safe to be public.)
  web3formsKey: 'f065eb0f-00c9-482f-be79-a75e1d7b013b',

  /* ── About section ────────────────────────────────────────── */
  about: {
    paragraphs: [
      "I'm Joseph. I spent a decade teaching in schools, so I know the Sunday evenings lost to marking, the clunky systems that fight you instead of helping, and the quiet wish that someone would just build the tool you actually needed.",
      "Eventually I decided to build it myself. I left the classroom to focus on technology full-time, and now I create software for schools — designed around how they really work, by someone who's been on the other side of the staffroom door.",
      'Some of what I build are products any school can pick up and use, like ParkerMarker and VocMark. Others are bespoke tools made for a single school. The aim never changes: less time lost to admin, more time for teaching.',
    ],
    // The "What I can help with" card. Adjust the groups and items freely.
    capabilities: [
      {
        group: 'Assessment & marking',
        items: ['Marking automation', 'AI-assisted grading', 'Vocational coursework (BTEC)', 'Feedback & moderation'],
      },
      {
        group: 'School operations',
        items: ['Staff absence & cover', 'Performance management', 'Admin workflows', 'Reporting dashboards'],
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
    ],
    // Featured case study shown at the top of the IT support section.
    caseStudy: {
      label: 'Featured case study',
      title: 'A cloud-first transformation',
      summary:
        'A secondary school was heading into an expensive renewal cycle — ageing on-premise servers, end-of-life network switches and a 270-user Citrix licence. I built and delivered a cloud-first strategy that retired the legacy stack and moved the school onto modern, low-maintenance cloud services.',
      points: [
        'Replaced on-premise servers and Citrix with Microsoft Intune and Azure AD',
        'Chromebooks and Google Workspace rolled out for staff and students',
        'Cloud printing, cloud phones and a refreshed, modern network',
      ],
      stats: [
        { value: '~£22k', label: 'Saved every year' },
        { value: 'Under 5mo', label: 'Investment payback' },
        { value: '270 → 20', label: 'Citrix licences needed' },
      ],
    },
  },
};

export type Site = typeof site;
