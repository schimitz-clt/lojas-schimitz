import type { SVGProps } from 'react';

/**
 * Identidade 2.0 monogram. Arcs are 270° with r1 < r2, full stop on the baseline.
 * Geometry matches the approved construction sheet (viewBox 64).
 */
const S_PATH = 'M36.40 22.20A8.2 8.2 0 1 0 28.20 30.40A9.3 9.3 0 1 1 18.90 39.70';

type Variant = 'navy' | 'bordo' | 'cream';

type MonogramProps = SVGProps<SVGSVGElement> & {
  size?: number;
  variant?: Variant;
  ring?: boolean;
  title?: string;
};

export function SchimitzMonogram({
  size = 36,
  variant = 'navy',
  ring = false,
  title,
  className,
  ...rest
}: MonogramProps) {
  const uid = `s${size}${variant}${ring ? 'r' : ''}`;
  const rx = 14.32;
  const stroke = variant === 'cream' ? '#07122A' : '#F3ECDF';
  const dot = variant === 'bordo' ? '#F3ECDF' : '#A8324A';
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      className={className}
      role={title ? 'img' : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      {...rest}
    >
      {variant === 'navy' ? (
        <defs>
          <radialGradient id={`mg${uid}`} cx="28%" cy="18%" r="100%">
            <stop offset="0" stopColor="#1C3869" />
            <stop offset="0.5" stopColor="#0B1B3A" />
            <stop offset="1" stopColor="#07122A" />
          </radialGradient>
          <linearGradient id={`hl${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity="0.09" />
            <stop offset="0.35" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
        </defs>
      ) : null}
      {variant === 'bordo' ? (
        <defs>
          <linearGradient id={`mb${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#8E2439" />
            <stop offset="1" stopColor="#5A1424" />
          </linearGradient>
        </defs>
      ) : null}
      {variant === 'navy' ? (
        <>
          <rect width="64" height="64" rx={rx} fill={`url(#mg${uid})`} />
          <rect width="64" height="64" rx={rx} fill={`url(#hl${uid})`} />
        </>
      ) : null}
      {variant === 'bordo' ? <rect width="64" height="64" rx={rx} fill={`url(#mb${uid})`} /> : null}
      {variant === 'cream' ? <rect width="64" height="64" rx={rx} fill="#F3ECDF" /> : null}
      <path d={S_PATH} fill="none" stroke={stroke} strokeWidth="6" strokeLinecap="butt" />
      <circle cx="46.6" cy="48.5" r="3.5" fill={dot} />
      {ring ? (
        <rect
          x="0.5"
          y="0.5"
          width="63"
          height="63"
          rx={rx - 0.5}
          fill="none"
          stroke="rgba(243,236,223,.22)"
          strokeWidth="1"
        />
      ) : null}
    </svg>
  );
}

export function SchimitzWordmark({ className }: { className?: string }) {
  return (
    <span className={className ? `id-wordmark ${className}` : 'id-wordmark'}>
      Schimitz<i className="id-dot">.</i>
    </span>
  );
}
