import { stringifyJsonLd, type JsonLdObject } from '@/lib/json-ld';

/** Server-safe JSON-LD script tag(s). */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const blocks = Array.isArray(data) ? data : [data];
  return (
    <>
      {blocks.map((block, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: stringifyJsonLd(block) }}
        />
      ))}
    </>
  );
}
