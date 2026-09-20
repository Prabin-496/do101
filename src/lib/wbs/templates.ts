/**
 * Starter breakdowns.
 *
 * Each one is a real, conventional decomposition for its field rather than
 * filler — the point of a template is that the first level is already the one
 * a reviewer expects to see. Templates are written as indented outlines and
 * parsed by the same code that handles a pasted one.
 */

import type { WbsDoc, WbsTask } from "./model";
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

/** The document a first-time visitor sees, so the tool is never an empty box. */
export function starterTasks(): WbsTask[] {
  return parseOutline(`Planning
  Define scope
  Agree budget
Delivery
  Do the work
  Review
Close
  Hand over`);
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
