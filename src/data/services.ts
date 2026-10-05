/**
 * ─────────────────────────────────────────────────────────────
 *  SERVICES  —  the three service pages under /services/<slug>
 * ─────────────────────────────────────────────────────────────
 *  Each service renders from the same template. Any `duration`,
 *  `pricingBasis` or FAQ `answer` left empty is not shown, so add
 *  figures only once they're confirmed.
 */

export type ServiceSlug = 'software-products' | 'bespoke-builds-and-data' | 'it-support';

export interface Service {
  slug: ServiceSlug;
  /** Page H1 and card title. */
  title: string;
  /** Shorter label for the nav dropdown and footer. */
  navLabel: string;
  icon: 'layers' | 'chart' | 'server';
  /** Two-sentence summary for the homepage service card. */
  summary: string;
  /** One-paragraph hero summary on the service page. */
  intro: string;
  /** <meta name="description"> — lead with the terms buyers search for. */
  metaDescription: string;
  /** Optional 3:2 image for the hero. */
  image?: { src: string; alt: string };
  whatWeDo: { title: string; text: string }[];
  whoFor: { role: string; text: string }[];
  engagements: { title: string; text: string; duration: string }[];
  /** e.g. 'Day rate or fixed-price project'. Empty hides the line. */
  pricingBasis: string;
  faqs: { question: string; answer: string }[];
}

/** FAQs that apply to every service, appended after the service's own. */
export const sharedFaqs: Service['faqs'] = [
  {
    question: 'Where is our data hosted?',
    answer:
      'In the UK. Pupil and staff data stays in the UK, under a written data processing agreement.',
  },
  {
    question: 'Do you provide a data processing agreement?',
    answer:
      'Yes. A written DPA is in place before we handle any pupil or staff data, and we can help your DPO complete a DPIA.',
  },
  {
    question: 'Can we pay by purchase order?',
    answer: 'Yes. Invoices are raised against your PO number, on 30-day terms.',
  },
  {
    question: 'Do you work on site or remotely?',
    // TODO: confirm — e.g. 'Software work is remote; IT and infrastructure work on site in Kent and the South East by arrangement.'
    answer: '',
  },
];

export const services: Service[] = [
  {
    slug: 'software-products',
    title: 'Software products for schools',
    navLabel: 'Software products',
    icon: 'layers',
    summary:
      'Ready-made tools schools can adopt this term: ParkerMarker, VocMark and PM Review. Built with teachers, for marking, vocational assessment and staff appraisal.',
    intro:
      'Ready-made software for marking, vocational assessment and staff appraisal. Each product started as a tool built for a real school problem, and is now available to any UK school, department or trust.',
    metaDescription:
      'ParkerMarker, VocMark and PM Review: marking, BTEC assessment and staff appraisal software for UK schools. UK-hosted, built with teachers.',
    image: {
      src: '/projects/pmreview.webp',
      alt: 'PM Review appraisal cycle dashboard showing review progress by status and line manager',
    },
    whatWeDo: [
      {
        title: 'Marking and feedback',
        text: 'ParkerMarker gives departments shared comment banks, printable feedback slips and question-level assessment analysis.',
      },
      {
        title: 'Vocational assessment',
        text: 'VocMark drafts assessments against BTEC, CACHE and OCR Nationals criteria for the teacher to review, edit and decide.',
      },
      {
        title: 'Staff appraisal and CPD',
        text: 'PM Review runs the whole performance management cycle, with a live dashboard for the headteacher and a CPD log for every member of staff.',
      },
      {
        title: 'Personal improvement plans',
        text: 'ParkerMarker and VocMark both turn assessment results into a plan for each student showing what to do next.',
      },
      {
        title: 'Built with teacher input',
        text: 'Every feature is shaped by the staff who use it, and the teacher always stays in control of grading decisions.',
      },
    ],
    whoFor: [
      { role: 'Teachers and heads of department', text: 'Faster, consistent marking across a team.' },
      { role: 'Vocational and BTEC leads', text: 'Confidence for staff new to criteria-based marking.' },
      { role: 'Headteachers and SLT', text: 'Oversight of appraisal and assessment without chasing spreadsheets.' },
    ],
    engagements: [
      {
        title: 'Department adoption',
        text: 'One department sets up ParkerMarker or VocMark for its classes, with a walkthrough for the team.',
        duration: '',
      },
      {
        title: 'Whole-school appraisal',
        text: 'PM Review configured for your review cycle, roles and line-management structure.',
        duration: '',
      },
      {
        title: 'Trust-wide rollout',
        text: 'A product rolled out across several schools, with shared comment banks or cycles where that helps.',
        duration: '',
      },
    ],
    // TODO: e.g. 'Per-school or per-department licence'.
    pricingBasis: '',
    faqs: [
      {
        question: 'Does AI make grading decisions?',
        answer:
          'No. VocMark and ParkerMarker only draft and suggest. Every grading decision stays with the teacher, in line with JCQ rules that the teacher remains the assessor.',
      },
      {
        question: 'Can we try a product before buying?',
        // TODO: trial terms.
        answer: '',
      },
    ],
  },
  {
    slug: 'bespoke-builds-and-data',
    title: 'Bespoke builds and school data',
    navLabel: 'Bespoke builds & data',
    icon: 'chart',
    summary:
      'Power Platform apps, SharePoint intranets, Wonde/MIS integrations and Power BI dashboards built around how your school runs.',
    intro:
      'Power Platform apps, SharePoint intranets, Wonde and MIS integrations and Power BI dashboards, built around how your school or trust actually runs. Paper forms and email chains become tracked workflows; scattered records become live dashboards for leadership.',
    metaDescription:
      'Power BI school dashboards, Wonde and MIS integration, Power Apps and SharePoint builds for UK schools and trusts. Built around how your school runs.',
    image: {
      src: '/projects/options-portal.svg',
      alt: 'A subject options form with pathway questions and KS3 and KS4 choices',
    },
    whatWeDo: [
      {
        title: 'Power Platform apps',
        text: 'Power Apps and Power Automate workflows for leave requests, behaviour logging, approvals and alerts.',
      },
      {
        title: 'SharePoint intranets',
        text: 'Staff intranets that bring forms, dashboards and documents into the place staff already work.',
      },
      {
        title: 'Wonde and MIS integration',
        text: 'Live data pulled from your MIS through Wonde, so dashboards and apps never need re-keying.',
      },
      {
        title: 'Power BI dashboards',
        text: 'Leadership dashboards for attendance, behaviour and staffing, including automated Bradford Factor calculations.',
      },
      {
        title: 'School web portals',
        text: 'Student and parent-facing sites such as subject options, with per-student access and live validation.',
      },
      {
        title: 'Rescuing existing systems',
        text: 'Taking over a system another supplier built, getting it working again and improving it.',
      },
    ],
    whoFor: [
      { role: 'SLT and headteachers', text: 'A live view of the school without waiting for a report.' },
      { role: 'School business managers', text: 'Fewer paper forms, fewer inbox chains, a clear audit trail.' },
      { role: 'Data and MIS leads', text: 'MIS data used once, everywhere, without exports.' },
      { role: 'Pastoral and cover teams', text: 'The day-to-day picture on one screen.' },
    ],
    engagements: [
      {
        title: 'Paper process to digital workflow',
        text: 'A form, approval route and dashboard on the Power Platform, replacing a paper or email process.',
        duration: '',
      },
      {
        title: 'Leadership dashboard from MIS data',
        text: 'A Wonde connection to your MIS and a Power BI dashboard built around the questions your SLT asks.',
        duration: '',
      },
      {
        title: 'System rescue and modernisation',
        text: 'An existing school system brought back to working order, then improved in agreed stages.',
        duration: '',
      },
    ],
    // TODO: e.g. 'Fixed-price project or day rate'.
    pricingBasis: '',
    faqs: [
      {
        question: 'Do we need Microsoft 365?',
        answer:
          'Power Platform and SharePoint builds run inside your existing Microsoft 365 tenancy. Other builds, such as web portals, do not need it.',
      },
      {
        question: 'Which MIS do you work with?',
        answer:
          'Data integrations use Wonde, which connects to the major UK school MIS platforms, including Arbor, SIMS and Bromcom.',
      },
    ],
  },
  {
    slug: 'it-support',
    title: 'IT support and infrastructure for schools',
    navLabel: 'IT support & infrastructure',
    icon: 'server',
    summary:
      'Everyday support, cloud-first infrastructure, Chromebook and Google Workspace rollouts, and Arbor MIS migration.',
    intro:
      'Everyday IT support, cloud-first infrastructure, Chromebook and Google Workspace rollouts, and Arbor MIS migration for schools and trusts. From the fixes that stall a school day to the long-term technology plan.',
    metaDescription:
      'School IT support in Kent and across the UK: Arbor MIS migration, cloud-first infrastructure, Chromebook and Google Workspace rollouts.',
    whatWeDo: [
      {
        title: 'Everyday IT support',
        text: 'A dependable point of contact for accounts, devices and access issues that stall a school day.',
      },
      {
        title: 'Cloud and infrastructure',
        text: 'Planning and delivering cloud-first infrastructure and network refreshes that are resilient, secure and simple to manage.',
      },
      {
        title: 'Chromebooks and Google Workspace',
        text: 'Device rollouts and Google Workspace setup for staff and students.',
      },
      {
        title: 'Arbor MIS migration and setup',
        text: 'Moving schools onto Arbor with full data migration from the previous MIS, then configuring it to fit, including assessment setup for schools and multi-academy trusts.',
      },
      {
        title: 'IT strategy and systems',
        text: 'Helping school leaders make well-structured technology decisions, with proper processes behind them.',
      },
      {
        title: 'Exam IT administration',
        text: 'Scripted, locked-down candidate accounts for on-screen exams, in line with JCQ requirements.',
      },
    ],
    whoFor: [
      { role: 'Headteachers and SLT', text: 'A clear technology plan and someone accountable for delivering it.' },
      { role: 'School business managers', text: 'Predictable costs and one supplier to call.' },
      { role: 'IT and network managers', text: 'Extra capacity for projects, migrations and exam season.' },
      { role: 'Exams officers', text: 'Exam accounts that are right first time.' },
    ],
    engagements: [
      {
        title: 'Arbor MIS migration',
        text: 'Data migrated from your current MIS, Arbor configured, and assessment set up for your school or trust.',
        duration: '',
      },
      {
        title: 'Chromebook and Google Workspace rollout',
        text: 'Devices enrolled and managed, and Google Workspace set up for staff and students.',
        duration: '',
      },
      {
        title: 'Ongoing IT support',
        text: 'A regular point of contact for day-to-day issues, alongside planned improvement work.',
        duration: '',
      },
    ],
    // TODO: e.g. 'Day rate, or a termly support agreement'.
    pricingBasis: '',
    faqs: [
      {
        question: 'What are your support hours?',
        // TODO: support hours and response times.
        answer: '',
      },
    ],
  },
];

export const serviceBySlug = (slug: ServiceSlug) =>
  services.find((s) => s.slug === slug) as Service;
