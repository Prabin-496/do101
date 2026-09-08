/**
 * The AI tool directory.
 *
 * This is a hand-curated editorial list, not a scraped database. That shapes
 * what it does and does not record:
 *
 * - **What each tool is for** and its official link — stable facts.
 * - **No prices.** AI pricing changes every few weeks; a stale figure is worse
 *   than none, so each entry links to the tool's own pricing page instead.
 * - **No star ratings, review counts or "best of" rankings.** DO101 has not
 *   run a comparative evaluation, and inventing scores would be dishonest.
 * - **A free-tier flag only where the tool has publicly offered one for a long
 *   time**, marked as needing verification because it can change.
 *
 * For genuinely new launches, /news/startups reads Product Hunt live — a
 * directory can never be as current as a feed.
 */

export type AiCategory =
  | "chat"
  | "image"
  | "video"
  | "audio"
  | "voice"
  | "code"
  | "writing"
  | "research"
  | "productivity"
  | "design"
  | "3d";

export interface AiTool {
  id: string;
  name: string;
  /** One sentence on what it actually does. */
  summary: string;
  url: string;
  category: AiCategory;
  /** Additional categories it also serves well. */
  alsoIn?: AiCategory[];
  /** What this one is genuinely better suited to than its peers. */
  bestFor: string;
  maker: string;
  /** Whether a free tier has been publicly available. Always verify. */
  freeTier: "yes" | "limited" | "trial" | "no";
}

export interface CategoryMeta {
  id: AiCategory;
  label: string;
  icon: string;
  blurb: string;
  /** Practical guidance on choosing within this category. */
  guidance: string;
}

export const AI_CATEGORIES: CategoryMeta[] = [
  {
    id: "chat",
    label: "Chat assistants",
    icon: "💬",
    blurb: "General-purpose assistants for questions, drafting and analysis.",
    guidance:
      "The frontier assistants are close enough that the right choice usually comes down to which ecosystem you already live in and how each one writes. Try the same real task in two of them before committing.",
  },
  {
    id: "image",
    label: "Image generation",
    icon: "🎨",
    blurb: "Generate and edit still images from a text description.",
    guidance:
      "These differ most in house style and in how much control you get. Some reward long descriptive prompts; others expect short ones. If you need a specific look, the model matters more than the prompt.",
  },
  {
    id: "video",
    label: "Video generation",
    icon: "🎬",
    blurb: "Generate or edit video clips from text, images or other footage.",
    guidance:
      "Clip length, motion coherence and whether audio is included vary a lot, and this is the fastest-moving category of all. Check what the current version actually produces rather than trusting a demo reel.",
  },
  {
    id: "audio",
    label: "Music and audio",
    icon: "🎵",
    blurb: "Compose music, generate sound effects, clean up recordings.",
    guidance:
      "Check the licence before publishing anything. Terms differ sharply on whether output can be used commercially, and that is the detail that catches people out.",
  },
  {
    id: "voice",
    label: "Voice and speech",
    icon: "🗣️",
    blurb: "Text to speech, voice cloning, dubbing and transcription.",
    guidance:
      "Only clone a voice with the speaker's explicit consent. Reputable services require it, and in many places using someone's voice without permission is unlawful as well as wrong.",
  },
  {
    id: "code",
    label: "Coding",
    icon: "⌨️",
    blurb: "Write, explain, review and refactor code.",
    guidance:
      "Editor integration matters more than raw model quality day to day. Whichever you pick, read what it produces — a confident wrong answer is the main failure mode.",
  },
  {
    id: "writing",
    label: "Writing",
    icon: "✍️",
    blurb: "Drafting, editing and grammar.",
    guidance:
      "The editing tools tend to earn their keep more reliably than the generators: catching your mistakes is a better-defined job than inventing your prose.",
  },
  {
    id: "research",
    label: "Research and search",
    icon: "🔎",
    blurb: "Answer questions with sources, and read long documents.",
    guidance:
      "Always follow the citations. These tools are useful precisely because they show their sources — a claim you have not checked is still just a claim.",
  },
  {
    id: "productivity",
    label: "Productivity",
    icon: "🚀",
    blurb: "Notes, meetings, automation and everyday workflow.",
    guidance:
      "Meeting recorders need everyone's consent to record, which is a legal requirement in many places, not just good manners.",
  },
  {
    id: "design",
    label: "Design",
    icon: "🖌️",
    blurb: "Layouts, presentations, interfaces and brand assets.",
    guidance:
      "Best used to get past a blank page. The output usually needs a designer's pass before it goes anywhere public.",
  },
  {
    id: "3d",
    label: "3D and spatial",
    icon: "🧊",
    blurb: "Generate 3D models and scenes.",
    guidance:
      "The newest and least settled category. Check the topology of anything you plan to actually use in a game engine or for printing.",
  },
];

export function categoryMeta(id: AiCategory): CategoryMeta {
  return AI_CATEGORIES.find((c) => c.id === id) ?? AI_CATEGORIES[0];
}
