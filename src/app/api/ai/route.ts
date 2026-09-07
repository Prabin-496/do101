import { NextResponse } from "next/server";
import { planFromRules } from "@/lib/ai/intent";
import { AI_TOOL_MAP } from "@/lib/ai/tool-runtime";
import { AI_LIMITS, isAiConfigured, planWithModel } from "@/lib/ai/provider";

export const runtime = "nodejs";

/**
 * Best-effort in-memory rate limiting. Serverless instances are not shared, so
 * this caps abuse from a single warm instance rather than acting as a hard
 * global quota — see docs/DEPLOYMENT.md.
 */
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < AI_LIMITS.windowMs);
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.clear();
  return recent.length > AI_LIMITS.requestsPerWindow;
}

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous";

  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many requests in a short time. Please wait a minute and try again." },
      { status: 429 },
    );
  }

  let message = "";
  try {
    const body = (await request.json()) as { message?: unknown };
    message = typeof body.message === "string" ? body.message : "";
  } catch {
    return NextResponse.json({ error: "Send a JSON body with a message field." }, { status: 400 });
  }

  if (!message.trim()) {
    return NextResponse.json({ error: "Type something for DO101 AI to route." }, { status: 400 });
  }
  if (message.length > AI_LIMITS.maxInputChars) {
    return NextResponse.json(
      {
        error: `That is longer than the ${AI_LIMITS.maxInputChars.toLocaleString()} character limit. Paste it straight into the tool page instead.`,
      },
      { status: 413 },
    );
  }

  // Deterministic rules first: free, instant, and they work with no API key.
  const rulePlan = planFromRules(message);
  if (rulePlan) return NextResponse.json({ ...rulePlan, aiConfigured: isAiConfigured() });

  if (!isAiConfigured()) {
    return NextResponse.json({
      tool: null,
      args: {},
      message:
        "I could not match that to a DO101 tool. The AI model is not configured on this deployment, so I am matching by rules only — try naming the tool, for example “format this JSON” or “15% of 480”.",
      source: "rules",
      aiConfigured: false,
    });
  }

  const modelPlan = await planWithModel(message);
  if (!modelPlan) {
    return NextResponse.json(
      { error: "The assistant is unavailable right now. Every tool still works on its own page." },
      { status: 503 },
    );
  }

  // Never trust a tool name the model invented.
  const tool = modelPlan.tool && AI_TOOL_MAP[modelPlan.tool] ? modelPlan.tool : null;

  return NextResponse.json({
    tool,
    args: modelPlan.args,
    message:
      tool === null && modelPlan.tool
        ? "I could not match that to a DO101 tool. Try naming what you want to do, such as “format this JSON”."
        : modelPlan.message,
    source: "model",
    aiConfigured: true,
  });
}
