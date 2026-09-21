import type { ToolFaq } from "@/lib/tools/types";

/**
 * A how-to guide: one page answering one specific, problem-shaped search.
 *
 * The tool pages rank for the name of a tool ("PDF merger"). People more often
 * search for the job ("merge PDFs without uploading them", "compress a photo
 * under 100 KB for a form"). A guide is written for that exact phrasing, answers
 * it in the first paragraph, and hands the reader to the tool that does it.
 *
 * Every claim in a guide must be true of the tool it points at — the facts come
 * from the tool registry, and the limits are stated as plainly as the tool
 * page states them.
 */
export interface Guide {
  /** URL segment under /how-to. The searcher's phrasing, hyphenated. */
  slug: string;
  /** Id of the DO101 tool that does the job. */
  tool: string;
  /** The H1: the question as the searcher would type it. */
  heading: string;
  seoTitle: string;
  seoDescription: string;
  /**
   * The direct answer, 40–70 words, in the first paragraph. Written to be
   * quoted whole by a search snippet or an AI assistant.
   */
  answer: string;
  /** Ordered steps, each doable on the page it links to. */
  steps: string[];
  /** Two to four sections of genuinely useful context: the why, the limits, the alternatives. */
  sections: Array<{ heading: string; paragraphs: string[] }>;
  faqs: ToolFaq[];
  /** Other guides worth reading next. */
  related: string[];
}
