/**
 * Starter breakdowns.
 *
 * Each one is a real, conventional decomposition for its field rather than
 * filler — the point of a template is that the first level is already the one
 * a reviewer expects to see. Templates are written as indented outlines and
 * parsed by the same code that handles a pasted one.
 */

import type { FieldValue, WbsDoc, WbsTask } from "./model";
import { newTask } from "./model";
import { addDays, todayIso, weekday } from "./gantt";
import { parseOutline } from "./import";
import { defaultChart, defaultFields, defaultGantt, defaultSettings } from "./fields";

export interface WbsTemplate {
  id: string;
  name: string;
  icon: string;
  blurb: string;
  outline: string;
}

export const TEMPLATES: WbsTemplate[] = [
  {
    id: "software",
    name: "Software release",
    icon: "💻",
    blurb: "Discovery through to launch, the way most product teams phase it.",
    outline: `Discovery
  Stakeholder interviews
  Requirements document
  Success metrics agreed
Design
  User flows
  Wireframes
  Visual design
  Design review sign-off
Build
  Backend
    Data model
    API endpoints
    Background jobs
  Frontend
    Component library
    Screens
    Accessibility pass
  Integrations
Quality
  Test plan
  Automated tests
  Bug fixing
  Performance testing
Launch
  Release notes
  Deployment
  Monitoring and alerts
  Post-launch review`,
  },
  {
    id: "construction",
    name: "Construction project",
    icon: "🏗️",
    blurb: "Site through to handover, with the usual inspection gates.",
    outline: `Pre-construction
  Site survey
  Permits and approvals
  Procurement plan
Site works
  Clearance
  Excavation
  Foundations
Structure
  Frame
  Roof
  External walls
Building services
  Electrical first fix
  Plumbing first fix
  HVAC
Finishes
  Plastering
  Flooring
  Painting and decorating
Handover
  Snagging list
  Final inspection
  Documentation and warranties`,
  },
  {
    id: "event",
    name: "Event delivery",
    icon: "🎪",
    blurb: "Everything a conference or launch event needs, in delivery order.",
    outline: `Planning
  Objectives and budget
  Date and venue
  Run of show
Programme
  Speaker outreach
  Agenda
  Rehearsals
Logistics
  Catering
  AV and staging
  Signage
  Travel and accommodation
Marketing
  Landing page
  Invitations
  Social campaign
Delivery
  Registration desk
  On-the-day crew
  Live support
Wrap-up
  Feedback survey
  Invoices and reconciliation
  Post-event report`,
  },
  {
    id: "research",
    name: "Thesis or research project",
    icon: "🎓",
    blurb: "From proposal to submission, including ethics and data collection.",
    outline: `Proposal
  Research question
  Supervisor approval
  Ethics application
Literature review
  Source gathering
  Critical reading notes
  Synthesis chapter
Methodology
  Study design
  Instruments
  Pilot study
Data collection
  Recruitment
  Fieldwork
  Data cleaning
Analysis
  Statistical analysis
  Findings write-up
Writing
  Introduction
  Discussion
  Conclusion
  Formatting and references
Submission
  Supervisor review
  Proofreading
  Final submission`,
  },
  {
    id: "marketing",
    name: "Marketing campaign",
    icon: "📣",
    blurb: "Positioning through to reporting for a product or brand campaign.",
    outline: `Strategy
  Audience research
  Positioning and messaging
  Budget and channel mix
Creative
  Concept development
  Copywriting
  Design assets
  Video production
Channels
  Paid search
  Paid social
  Email sequence
  Landing pages
Launch
  QA and tracking setup
  Go live
  Community monitoring
Measurement
  Weekly reporting
  Attribution review
  Campaign retrospective`,
  },
  {
    id: "product-launch",
    name: "Physical product launch",
    icon: "📦",
    blurb: "Design, manufacture, logistics and retail readiness.",
    outline: `Product definition
  Market research
  Specification
  Costing
Design
  Industrial design
  Prototyping
  Testing and certification
Manufacturing
  Supplier selection
  Tooling
  Pilot run
  Mass production
Packaging
  Structural packaging
  Artwork
  Compliance labelling
Distribution
  Freight and customs
  Warehousing
  Retail allocation
Go to market
  Pricing
  Launch campaign
  Retail training`,
  },
];

export function templateTasks(id: string): WbsTask[] {
  const template = TEMPLATES.find((entry) => entry.id === id);
  return template ? parseOutline(template.outline) : [];
}

/**
 * The document a first-time visitor sees.
 *
 * A small, conventional project breakdown with dates already on the work
 * packages, so the sheet opens looking like the thing it is: numbered rows,
 * durations that count themselves, and a timeline. Dates are anchored to the
 * Monday of the current week rather than written down, so the starter never
 * arrives looking out of date.
 */
export function starterTasks(from: string = mondayOfThisWeek()): WbsTask[] {
  const week = (n: number, days: number, values: Record<string, FieldValue> = {}) => ({
    start: addDays(from, n * 7),
    finish: addDays(from, n * 7 + days - 1),
    ...values,
  });

  const leaf = (name: string, values: Record<string, FieldValue>): WbsTask => ({
    ...newTask(name, values),
  });

  return [
    {
      ...newTask("Project Initiation"),
      children: [
        {
          ...newTask("Project Planning"),
          children: [
            leaf("Requirements Gathering", week(0, 12, { progress: 100 })),
            leaf("Stakeholder Analysis", week(2, 5, { progress: 60 })),
          ],
        },
        leaf("Project Charter", week(3, 5, { progress: 0 })),
      ],
    },
    {
      ...newTask("Project Definition & Planning"),
      children: [
        leaf("Scope & Goals", week(4, 12, { progress: 0 })),
        leaf("Budget", week(6, 5, { progress: 0 })),
      ],
    },
    leaf("Project Execution", week(7, 33, { progress: 0 })),
  ];
}

/** The Monday on or before today, so a starter plan begins on a weekday. */
function mondayOfThisWeek(): string {
  const today = todayIso();
  return addDays(today, -weekday(today));
}

/** Where the editor keeps its work. localStorage, on this device, only. */
export const WBS_STORAGE_KEY = "wbs-document";

export function createDoc(tasks: WbsTask[] = starterTasks()): WbsDoc {
  return {
    version: 1,
    settings: defaultSettings(),
    chart: defaultChart(),
    gantt: defaultGantt(),
    fields: defaultFields(),
    tasks,
  };
}
