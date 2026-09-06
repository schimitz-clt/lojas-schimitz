/** Lightweight loading placeholders — home, catálogo, PDP. */

export function ProductCardSkeleton() {
  return (
    <article className="pcard skel-card" aria-hidden="true">
      <div className="skel skel-media" />
      <div className="pcard-body">
        <div className="skel skel-line" style={{ width: '88%' }} />
        <div className="skel skel-line" style={{ width: '62%', marginTop: 8 }} />
        <div className="skel skel-line skel-price" style={{ width: '44%', marginTop: 12 }} />
        <div className="skel skel-line" style={{ width: '55%', marginTop: 8 }} />
      </div>
      <div className="pcard-cta">
        <div className="skel skel-btn" />
      </div>
    </article>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid" role="status" aria-live="polite" aria-label="Carregando produtos">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function PdpSkeleton() {
  return (
    <div className="pdp" style={{ padding: '24px 0' }} role="status" aria-label="Carregando produto">
      <div className="pdp-grid">
        <div>
          <div className="skel skel-pdp-img card" />
          <div className="pdp-thumbs" style={{ marginTop: 10 }}>
            <div className="skel" style={{ width: 64, height: 64, borderRadius: 10 }} />
            <div className="skel" style={{ width: 64, height: 64, borderRadius: 10 }} />
            <div className="skel" style={{ width: 64, height: 64, borderRadius: 10 }} />
          </div>
        </div>
        <div>
          <div className="skel skel-line" style={{ width: '28%', height: 18 }} />
          <div className="skel skel-line" style={{ width: '92%', height: 28, marginTop: 12 }} />
          <div className="skel skel-line" style={{ width: '48%', marginTop: 10 }} />
          <div className="skel" style={{ height: 110, borderRadius: 12, marginTop: 16 }} />
          <div className="skel skel-btn" style={{ width: 180, marginTop: 16 }} />
        </div>
      </div>
    </div>
  );
}
