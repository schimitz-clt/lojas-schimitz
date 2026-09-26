import { parseProductStory } from '@/lib/product-story';

/** Benefits, specs, box contents and FAQ. Each block is omitted when its field is empty. */
export function ProductStory({
  product,
}: {
  product: {
    highlights?: unknown;
    features?: unknown;
    boxContents?: unknown;
    faq?: unknown;
  };
}) {
  const story = parseProductStory(product);
  if (!story.highlights.length && !story.features.length && !story.boxContents.length && !story.faq.length) {
    return null;
  }

  return (
    <div className="pdp-story">
      {story.highlights.length ? (
        <section className="pdp-story-block" aria-label="Benefícios">
          <h2>O que você leva</h2>
          <ul className="pdp-story-pills">
            {story.highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {story.features.length ? (
        <section className="pdp-story-block" aria-label="Especificações">
          <h2>Detalhes</h2>
          <dl className="pdp-story-specs">
            {story.features.map((item) => (
              <div key={`${item.label}-${item.value}`}>
                <dt>{item.label}</dt>
                <dd>{item.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ) : null}
      {story.boxContents.length ? (
        <section className="pdp-story-block" aria-label="O que vem na caixa">
          <h2>O que vem na caixa</h2>
          <ul className="pdp-story-box">
            {story.boxContents.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {story.faq.length ? (
        <section className="pdp-story-block" aria-label="Perguntas frequentes">
          <h2>Perguntas frequentes</h2>
          <div className="pdp-story-faq">
            {story.faq.map((item) => (
              <details key={item.question}>
                <summary>{item.question}</summary>
                <p>{item.answer}</p>
              </details>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
