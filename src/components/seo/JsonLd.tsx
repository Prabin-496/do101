export function JsonLd({ data }: { data: Record<string, unknown> | Array<Record<string, unknown>> }) {
  return (
    <script
      type="application/ld+json"
      // Serialised by us from typed objects — no user input reaches this string.
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
