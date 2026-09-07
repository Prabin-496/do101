import { relatedTools } from "@/lib/tools/tool-registry";
import { ToolCard } from "./ToolCard";

export function RelatedTools({ id, title = "Keep going" }: { id: string; title?: string }) {
  const tools = relatedTools(id);
  if (!tools.length) return null;

  return (
    <section aria-labelledby="related-heading">
      <h2 id="related-heading" className="mb-1 text-xl sm:text-2xl">
        {title}
      </h2>
      <p className="mb-4 text-sm font-semibold text-[var(--muted)]">
        People who use this tool usually reach for these next.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </section>
  );
}
