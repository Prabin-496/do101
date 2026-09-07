import "server-only";
import { AI_TOOLS } from "./tool-runtime";

/**
 * Server-side provider abstraction.
 *
 * The model NEVER produces a result the visitor sees — it only picks which
 * DO101 tool to run and with what arguments. The tool itself runs in the
 * browser using the same code the visible UI uses.
 *
 * No key configured means no provider, and DO101 AI falls back to the
 * deterministic rules. Nothing here is required for the site to work.
 */

export interface ProviderPlan {
  tool: string | null;
  args: Record<string, string | number>;
  message: string;
}

export const AI_LIMITS = {
  maxInputChars: 8000,
  timeoutMs: 12_000,
  requestsPerWindow: 12,
  windowMs: 60_000,
} as const;

export function isAiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function toolCatalogue(): string {
  return AI_TOOLS.map((tool) => {
    const args = Object.entries(tool.args)
      .map(([key, description]) => `      - ${key}: ${description}`)
      .join("\n");
    return `- ${tool.name}: ${tool.description}${args ? `\n${args}` : ""}`;
  }).join("\n");
}

const SYSTEM_PROMPT = `You are DO101 AI, the router for a free online toolbox.

Your ONLY job is to choose which DO101 tool answers the user's request and to
extract its arguments. You never compute the answer yourself and you never
describe a result: the chosen tool runs afterwards in the user's browser and
its real output is shown to them.

Available tools:
${"{TOOLS}"}

Reply with a single JSON object and nothing else:
{"tool": "<tool name or null>", "args": {...}, "message": "<one short sentence>"}

Rules:
- "message" is at most one sentence, present tense, describing what you are about
  to run (e.g. "Formatting it with the JSON Formatter."). Never claim a tool has
  already run and never state a result.
- If no tool fits, set "tool" to null and use "message" to say briefly what DO101
  can do instead.
- Copy argument values verbatim from the user's message. Do not invent data.`;

export async function planWithModel(input: string): Promise<ProviderPlan | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_LIMITS.timeoutMs);

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-haiku-4-5-20251001",
        max_tokens: 512,
        system: SYSTEM_PROMPT.replace("{TOOLS}", toolCatalogue()),
        messages: [{ role: "user", content: input.slice(0, AI_LIMITS.maxInputChars) }],
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    const text = data.content?.find((block) => block.type === "text")?.text ?? "";
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    if (!json) return null;

    const parsed = JSON.parse(json) as ProviderPlan;
    if (parsed.tool !== null && typeof parsed.tool !== "string") return null;
    return {
      tool: parsed.tool,
      args:
        parsed.args && typeof parsed.args === "object"
          ? (parsed.args as Record<string, string | number>)
          : {},
      message: typeof parsed.message === "string" ? parsed.message.slice(0, 240) : "",
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
