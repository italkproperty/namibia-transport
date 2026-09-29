/**
 * Renders one structured-data object.
 *
 * A component rather than a repeated `<script dangerouslySetInnerHTML>`,
 * because the serialisation is the part that goes wrong: a raw string built
 * by hand eventually meets a place name with an apostrophe.
 */
export function JsonLd({ schema }: { schema: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
    />
  );
}
