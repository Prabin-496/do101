/**
 * Rough instructions into a standard operating procedure.
 *
 * People explain a process the way they would say it out loud: "open the
 * portal, then export last month — make sure it's the right month — and if
 * it's empty, ping finance." This separates that into numbered steps, pulls the
 * warnings and decision points out where a reader will see them, and lists the
 * roles and systems involved, ready to edit and download as a Word document.
 */

import type { DocBlock } from "./export";

export interface SopStep {
  id: string;
  text: string;
  warnings: string[];
  /** "If the report is empty → contact finance." */
  decision: string | null;
  role: string | null;
}

export interface Sop {
  title: string;
  purpose: string;
  scope: string;
  roles: string[];
  systems: string[];
  prerequisites: string[];
  steps: SopStep[];
}

const WARNING = /\b(make sure|ensure|don't|do not|never|always|careful|be careful|important|warning|caution|remember to|double[- ]check|note that|note:)\b|必ず|注意|忘れずに|禁止|してはいけない|確認すること/i;
const DECISION = /^(?:if|when|in case|unless|otherwise|should)\b|^(?:もし|万が一)|場合(?:は|には)/i;
const PREREQ = /\b(before (?:you )?(?:start|begin)|you(?:'ll| will)? need|prerequisites?|requirements?|make sure you have|you must have|access to)\b|必要なもの|事前に|前提/i;
const CONNECTORS = /(?:,|;)?\s+(?:and then|then|after that|afterwards|next|once (?:that's|that is|it's|it is) done,?|when (?:that's|it's) done,?|finally)\s+|(?:その後|次に|それから|最後に)[、,]?/gi;
const LEAD_INS = /^(?:first(?:ly)?|to start|start by|begin by|then|next|after that|afterwards|finally|lastly|and|also|now|step \d+[:.]?|\d+[.)]|[-*•])[,:]?\s+/i;
const ROLE_WORDS = [
  "manager", "supervisor", "team lead", "admin", "administrator", "finance", "accounting", "accountant", "hr",
  "reception", "receptionist", "customer", "client", "it", "support", "operator", "staff", "owner", "approver",
  "warehouse", "driver", "nurse", "doctor", "chef", "cashier", "sales", "legal", "security",
];

function capitalise(text: string): string {
  return text ? text[0].toUpperCase() + text.slice(1) : text;
}

function clean(text: string): string {
  let t = text.trim();
  for (let i = 0; i < 3; i++) t = t.replace(LEAD_INS, "");
  t = t.replace(/^(?:you (?:need|have|should|must|will need) to|you should|you'll want to|we need to|please)\s+/i, "");
  t = t.replace(/[.;,。、\s]+$/, "");
  return capitalise(t);
}

function findRole(text: string): string | null {
  const lower = text.toLowerCase();
  for (const role of ROLE_WORDS) {
    if (new RegExp(`\\b(?:the |a |your )?${role}(?: team)?\\b`).test(lower)) {
      return role === "hr" || role === "it" ? role.toUpperCase() : capitalise(role);
    }
  }
  return null;
}

function findSystems(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(/\b(?:open|log (?:in|into)|login to|go to|in|on|into|using|via|from)\s+(?:the\s+)?((?:[A-Z][\w.&-]*\s?){1,4})/g)) {
    const name = m[1].trim();
    if (name.length > 1 && !/^(I|If|When|The|This|That|Then|It)$/.test(name)) found.add(name);
  }
  for (const m of text.matchAll(/\bthe\s+([a-z][\w-]*(?:\s[a-z][\w-]*)?\s(?:panel|portal|dashboard|system|app|sheet|spreadsheet|folder|drive|page|tool|form|inbox|register|database))\b/gi)) {
    found.add(capitalise(m[1]));
  }
  return [...found];
}

/** Breaks a line into separate steps at "then", "after that", "次に" and so on. */
function splitSteps(text: string): string[] {
  const pieces: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    for (const sentence of line.split(/(?<=[.!?。！？])\s*/)) {
      for (const part of sentence.split(CONNECTORS)) {
        if (part && part.trim().length > 1) pieces.push(part.trim());
      }
    }
  }
  return pieces;
}

export function buildSop(input: string, title?: string): Sop {
  const pieces = splitSteps(input);
  const steps: SopStep[] = [];
  const prerequisites: string[] = [];
  const roles = new Set<string>();
  const systems = new Set<string>();

  for (const piece of pieces) {
    const role = findRole(piece);
    if (role) roles.add(role);
    for (const s of findSystems(piece)) systems.add(s);

    // Requirements before the first real step are prerequisites.
    if (steps.length === 0 && PREREQ.test(piece)) {
      prerequisites.push(clean(piece));
      continue;
    }
    // A warning on its own belongs to the step it follows.
    if (WARNING.test(piece) && steps.length > 0 && !/\b(then|click|open|send|enter|select|press|upload|type|fill)\b/i.test(piece.replace(WARNING, ""))) {
      steps[steps.length - 1].warnings.push(clean(piece));
      continue;
    }
    // A condition on its own is a branch of the step it follows.
    if (DECISION.test(piece.trim()) && steps.length > 0) {
      const last = steps[steps.length - 1];
      last.decision = last.decision ? `${last.decision} ${clean(piece)}` : clean(piece);
      continue;
    }
    const text = clean(piece);
    if (text.length < 2) continue;
    steps.push({ id: `s${steps.length + 1}`, text, warnings: WARNING.test(piece) ? [] : [], decision: null, role });
  }

  const derivedTitle = title?.trim() || (steps[0] ? `How to ${steps[0].text.charAt(0).toLowerCase()}${steps[0].text.slice(1).split(/[,.]/)[0]}` : "Standard operating procedure");
  return {
    title: derivedTitle.slice(0, 90),
    purpose: "",
    scope: "",
    roles: [...roles],
    systems: [...systems],
    prerequisites,
    steps,
  };
}

export interface SopMeta {
  owner: string;
  version: string;
  date: string;
}

export function sopToDoc(sop: Sop, meta: SopMeta): DocBlock[] {
  const blocks: DocBlock[] = [
    { type: "title", text: sop.title },
    { type: "table", rows: [["Owner", "Version", "Last updated"], [meta.owner || "—", meta.version || "1.0", meta.date]] },
  ];
  if (sop.purpose) blocks.push({ type: "heading", text: "Purpose" }, { type: "paragraph", text: sop.purpose });
  if (sop.scope) blocks.push({ type: "heading", text: "Scope" }, { type: "paragraph", text: sop.scope });
  if (sop.roles.length) blocks.push({ type: "heading", text: "Roles involved" }, { type: "bullets", items: sop.roles });
  if (sop.systems.length) blocks.push({ type: "heading", text: "Systems and tools" }, { type: "bullets", items: sop.systems });
  if (sop.prerequisites.length) blocks.push({ type: "heading", text: "Before you start" }, { type: "bullets", items: sop.prerequisites });
  blocks.push({ type: "heading", text: "Procedure" });
  blocks.push({
    type: "table",
    rows: [
      ["#", "Step", "Who", "Checks and decisions"],
      ...sop.steps.map((s, i) => [
        String(i + 1),
        s.text,
        s.role ?? "",
        [...s.warnings.map((w) => `⚠ ${w}`), ...(s.decision ? [`↳ ${s.decision}`] : [])].join("\n"),
      ]),
    ],
    widths: [500, 4300, 1400, 2800],
  });
  blocks.push({ type: "heading", text: "Revision history" });
  blocks.push({ type: "table", rows: [["Version", "Date", "Change", "By"], [meta.version || "1.0", meta.date, "First version", meta.owner || ""]] });
  return blocks;
}

export function sopToMarkdown(sop: Sop, meta: SopMeta): string {
  const lines = [`# ${sop.title}`, "", `Owner: ${meta.owner || "—"} · Version ${meta.version || "1.0"} · ${meta.date}`, ""];
  if (sop.purpose) lines.push("## Purpose", sop.purpose, "");
  if (sop.scope) lines.push("## Scope", sop.scope, "");
  if (sop.roles.length) lines.push("## Roles", ...sop.roles.map((r) => `- ${r}`), "");
  if (sop.systems.length) lines.push("## Systems", ...sop.systems.map((r) => `- ${r}`), "");
  if (sop.prerequisites.length) lines.push("## Before you start", ...sop.prerequisites.map((r) => `- ${r}`), "");
  lines.push("## Procedure");
  sop.steps.forEach((s, i) => {
    lines.push(`${i + 1}. ${s.text}${s.role ? ` _(${s.role})_` : ""}`);
    for (const w of s.warnings) lines.push(`   - ⚠ ${w}`);
    if (s.decision) lines.push(`   - ↳ ${s.decision}`);
  });
  return lines.join("\n");
}
