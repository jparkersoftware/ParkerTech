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
  /** Optional screenshots, shown in a gallery on the detail page. */
  gallery?: { src: string; caption: string }[];
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
    blurb: 'AI-assisted marking for BTEC & vocational courses.',
    description:
      'An AI-assisted marking platform for UK vocational qualifications — BTEC, CACHE and OCR Nationals. Teachers upload the course spec and assignment brief; VocMark extracts the assessment criteria, drafts an assessment against them with clear reasoning for the teacher to review, and produces a personalised improvement plan for every student.',
    tags: ['AI-assisted', 'BTEC & vocational', 'Improvement plans'],
    year: '2026',
    liveUrl: 'https://vocmark.co.uk',
    builtWith: 'React, Firebase, Vite and the Anthropic API',
    story: [
      {
        heading: 'Where it started',
        body: [
          "VocMark started with a single colleague. When I was moving on from a school, the BTEC course I'd taught was being handed to a teaching assistant — capable, but new to vocational qualifications, in a school where few staff had marked BTEC before. BTEC marking is exacting: every piece of work is judged against detailed Pass, Merit and Distinction criteria. I'd been experimenting with AI integrations, and it struck me that this was exactly the kind of task where the right tool could give a less experienced marker real confidence. So I built VocMark to support him — and it grew from there into a product any vocational teacher can use.",
        ],
      },
      {
        heading: 'How it works',
        body: [
          'VocMark works one assignment at a time. You create a class, then create an assignment by uploading two documents: the course specification and the assignment brief. VocMark reads both and pulls out the assessment criteria.',
          "You then attach your class and, for each student, upload a PDF of their coursework. VocMark works through it against the criteria and produces a draft assessment — a judgement on each criterion with the reasoning behind it. That draft is a starting point, not a verdict: the teacher reviews, edits and decides. From there VocMark can generate a personal improvement plan for each student, setting out exactly what they'd need to do to reach the next grade.",
        ],
      },
      {
        heading: "Who it's for",
        body: [
          'VocMark is built for teachers who are new to vocational qualifications, or working without a BTEC specialist nearby. The aim is straightforward: help a less experienced marker feel confident in their grading decisions, and help every student get specific, useful feedback on how to progress.',
          "It's an assistant, never a replacement for a teacher's professional judgement. VocMark only ever drafts and suggests — every grading decision stays with the teacher. That's deliberate: it keeps VocMark consistent with JCQ rules, which require the teacher to remain the assessor for regulated qualifications.",
        ],
      },
    ],
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
    builtWith: 'React, TypeScript, Tailwind CSS and Firebase',
    story: [
      {
        heading: 'Where it started',
        body: [
          "Performance management at one of the schools I worked in was held together with email. There was a Word template; staff made a copy, filled it in, and emailed it to their line manager to review. Inevitably there were several versions of the same document in circulation, and no real oversight — no way to see at a glance who had finished their review and who hadn't. I built a OneDrive folder structure with sharing restrictions to at least keep everything central and give it some hierarchy, but it still meant working through folders by hand to tell SLT where things stood. PM Review is the proper version of that idea: the whole cycle in one place, tracked automatically.",
        ],
      },
      {
        heading: 'How it works',
        body: [
          "PM Review runs a school's entire performance management cycle as one structured workflow. An admin sets up a review cycle with deadlines. Staff log in and complete their self-review — objectives, ratings and commentary — then their line manager reviews it, adds their own commentary, and either returns it for revision or submits it. Mid-year check-ins are opened by the admin and flow through the same loop.",
          "Everything is tracked in real time. Staff see a countdown to their deadline; line managers are notified the moment a review is submitted to them; and the headteacher has a live dashboard showing the status of every review across the school — completion percentages, rating distributions, and progress broken down by line manager. Alongside the cycle there's a shared document library and a CPD log, where staff record their professional development through the year.",
        ],
      },
      {
        heading: "Who it's for",
        body: [
          "PM Review has four roles, each seeing only what's relevant to them. A School Admin sets up cycles and manages staff; the Headteacher gets oversight of every review and opens the mid-year round; Line Managers review and confirm their own team; and Staff complete their self-review and keep their CPD log. Staff can't see each other's reviews — the structure mirrors how a school actually runs appraisal, and replaces the paper forms, shared drives and email chains it used to take.",
        ],
      },
    ],
    gallery: [
      {
        src: '/projects/pmreview-review.webp',
        caption: 'A staff review — objectives, commentary and evidence',
      },
      {
        src: '/projects/pmreview-cpd.webp',
        caption: 'The CPD log, where staff record professional development',
      },
    ],
  },
  {
    title: 'Options Portal',
    slug: 'options-portal',
    kind: 'Bespoke build',
    blurb: 'Subject options, controlled per student.',
    description:
      "A yearly subject-options website for a secondary school. Students choose the courses they'll take next year — but the school decides exactly which courses each individual student can see and select, so no one signs up to a subject they aren't set up to succeed on.",
    tags: ['Subject options', 'Per-student access', 'School admin'],
    year: '2024',
    note: 'Built privately for a school — not publicly available.',
    builtWith: 'PHP, with HTML, CSS and JavaScript',
    story: [
      {
        heading: 'Where it started',
        body: [
          "The Options Portal came to me as a rescue job. A secondary school had commissioned a developer to build a website for its subject-options process — the point in the year when students choose the courses they'll study next. It had already replaced a heavily manual routine of paper forms and spreadsheets: each student logged in and picked only from the options actually offered to them. By the time it reached me, parts of it had stopped working — the hosting provider had dropped the old version of PHP the site relied on, and without it the site broke.",
          "I was asked to take it over. It was my first time inside a PHP codebase — until then I'd been firmly an HTML, CSS and JavaScript developer — so I learned what I needed as I went, updated the functions the newer PHP needed, and got the portal running again. From there I kept improving it, making the changes the school asked for: reworking the interface to be properly mobile-friendly, since a phone is what most students use, and giving the whole thing a cleaner, more modern feel.",
        ],
      },
      {
        heading: 'How it works',
        body: [
          "Students log in securely and work through their choices in option blocks, with live validation that catches an invalid combination before it's ever submitted — so no one picks a set of subjects the timetable can't support. Behind the scenes, staff get an administration dashboard: real-time tracking of who has and hasn't submitted, and the collected choices ready to export straight into the next stage of timetabling, with no re-keying.",
        ],
      },
      {
        heading: "Who it's for",
        body: [
          "The portal serves two sides at once. For students and parents it's a clear, modern process they can complete from a phone in a few minutes. For the school it removes the paper forms and the duplicate data entry, improves the accuracy of what students submit, and gives leadership immediate sight of how the options process is going — rather than waiting on a pile of forms to be collated by hand.",
        ],
      },
    ],
    gallery: [
      {
        src: '/projects/options-portal.svg',
        caption: 'The multi-stage options form — pathway questions, then KS3 and KS4 choices',
      },
    ],
  },
  {
    title: 'Staff Leave Request System',
    slug: 'staff-leave-request-system',
    kind: 'Bespoke build',
    blurb: 'A paperless leave-request and approval workflow.',
    description:
      "A staff leave-request system built for a school on the Microsoft Power Platform — Power Apps, Power Automate and SharePoint — replacing a paper-and-email process. Staff submit leave requests digitally; each one is routed automatically to the right line manager or SLT for approval, and approved leave is logged centrally — giving leadership a clear view of staff availability and the cover team a daily picture of who needs covering.",
    tags: ['Power Platform', 'Approval workflows', 'Leave & cover'],
    year: '2024',
    note: 'Built privately for one school — not publicly available.',
    builtWith: 'Power Apps, Power Automate and SharePoint',
    story: [
      {
        heading: 'Where it started',
        body: [
          "Staff leave in a school is one of those processes that quietly sprawls. Requests came in as paper forms, emails, or a quick word in the corridor — which made it hard for leadership to keep a consistent view of who was off, who had approved what, and what the history was. I built the Staff Leave Request System to bring all of that into one place: the polish of a modern HR platform, but shaped around how a school actually runs.",
        ],
      },
      {
        heading: 'How it works',
        body: [
          "A staff member submits a leave request from their phone or a computer — a short, simple form. From there the system takes over: the request is routed automatically to the right line manager or member of SLT, who can see the staffing picture and approve or decline it. The staff member gets confirmation and status updates without having to chase anyone.",
          "Every approved request feeds one central record, so there's a single, reliable picture of staff leave rather than a scatter of forms and inboxes. The cover team gets a dashboard of exactly who's out each day, so they can arrange cover without chasing anyone; leadership get reporting and a clear audit trail of who requested what, when, and who signed it off; and role-based permissions mean each person sees only what's relevant to them.",
        ],
      },
      {
        heading: "Who it's for",
        body: [
          "The system serves everyone in the loop. Teaching and support staff get a quick, professional way to request leave; line managers and SLT get the staffing context to make a decision and approve in a tap; the cover team can see who's out each day and arrange cover from one screen; and the school's leadership and admin team get oversight — a live picture of availability and a complete history — instead of piecing it together from emails and spreadsheets.",
        ],
      },
    ],
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
    title: 'Exam Account Deployment',
    slug: 'exam-account-deployment',
    kind: 'Bespoke build',
    blurb: 'Secure exam accounts, set up in seconds.',
    description:
      "A set of PowerShell scripts for a school's exams office, covering the full lifecycle of exam accounts — deploying secure, locked-down candidate accounts before on-screen exams, collecting candidates' files once exams finish, and resetting the accounts afterwards. It replaces a manual, error-prone routine with a fast, repeatable one that meets JCQ requirements for exam security.",
    tags: ['PowerShell', 'Exam administration', 'JCQ compliant'],
    year: '2023',
    note: 'Built privately for a school — not publicly available.',
    builtWith: 'PowerShell and Active Directory',
    story: [
      {
        heading: 'Where it started',
        body: [
          "Exam season comes with a quiet mountain of IT admin. Around on-screen exams and controlled assessments, a set of locked-down student accounts has to be created — each one named correctly, with the right password, group memberships and restrictions, so a candidate can only do what the exam allows — then, afterwards, the candidates' work collected and the accounts cleared back down. Done by hand, account by account, it's slow and easy to get subtly wrong, and in an exam context an inconsistent setting is a real problem. I wrote a set of PowerShell scripts so the school's exams office could handle every account the same way, every time.",
        ],
      },
      {
        heading: 'How it works',
        body: [
          "The work is split across a set of scripts that follow an exam account through its whole life. The first prepares the accounts: in a single run it creates or updates them in Active Directory, applies the school's standard naming convention, sets passwords, adds each account to the correct groups, and disables or restricts anything a candidate shouldn't be able to reach — so what comes out is a set of accounts ready for the exam devices, locked down and identical to one another.",
          "Once exams are finished, a second script collects the candidates' work back off the accounts, so nothing is left scattered across machines — and a third resets the accounts, clearing them down ready for the next session. Because it's all scripted, the same process runs every exam season without depending on someone working through a list by hand.",
        ],
      },
      {
        heading: "Who it's for",
        body: [
          'The scripts were built for the people who carry exam readiness — the exams officer and the IT or network manager who have to be certain every account is correct before candidates sit down. They take a slow, error-prone job off their hands, and give school leadership confidence that exam access is controlled and consistent, in line with JCQ requirements for exam security.',
        ],
      },
    ],
  },
];
