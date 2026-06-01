import type { Thing, WithContext } from "schema-dts";

/**
 * Renders a JSON-LD <script>. Typed via schema-dts so the object shape is
 * checked at compile time (CLAUDE.md: no `any`). dangerouslySetInnerHTML is
 * the standard, safe way to emit JSON-LD in React — the payload is our own
 * server-built object, never user input.
 */
export function JsonLd<T extends Thing>({ data }: { data: WithContext<T> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
