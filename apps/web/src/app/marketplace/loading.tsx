/** Instant shell while seller cards resolve. Does not change the marketplace page. */
export default function Loading() {
  return (
    <div style={{ padding: '22px 0', maxWidth: 760 }} role="status" aria-label="Carregando marketplace">
      <div className="skel" style={{ height: 28, width: '42%' }} />
      <div className="skel" style={{ height: 14, width: '86%', marginTop: 14 }} />
      <div className="skel" style={{ height: 14, width: '70%', marginTop: 8 }} />
      <div className="skel" style={{ height: 120, width: '100%', marginTop: 18, borderRadius: 16 }} />
    </div>
  );
}
