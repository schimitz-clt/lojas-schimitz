import type { SVGProps } from 'react';

/** Shared storefront icon geometry — Magalu-style stroke set (Schimitz yellow/black chrome). */
export const ICON_STROKE = 1.8;

type IconProps = SVGProps<SVGSVGElement> & {
  size?: number;
  title?: string;
};

function baseProps({ size = 22, title, className, ...rest }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: ICON_STROKE,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    role: title ? ('img' as const) : undefined,
    'aria-hidden': title ? undefined : true,
    'aria-label': title,
    className,
    ...rest,
  };
}

export function IconHome(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M4 10.5 12 4l8 6.5" />
      <path d="M6.5 9.8V19a1 1 0 0 0 1 1h3.2v-5.2h2.6V20H16.5a1 1 0 0 0 1-1V9.8" />
    </svg>
  );
}

export function IconSearch(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="11" cy="11" r="6.2" />
      <path d="m16.2 16.2 3.3 3.3" />
    </svg>
  );
}

export function IconCart(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M6 7h15l-1.4 8.2a2 2 0 0 1-2 1.8H9.2a2 2 0 0 1-2-1.6L5 4H3" />
      <circle cx="9" cy="20" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="18" cy="20" r="1.15" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconHeart({ filled = false, ...props }: IconProps & { filled?: boolean }) {
  return (
    <svg {...baseProps(props)}>
      <path
        d="M12 19s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7a3.8 3.8 0 0 1 7 2.8C19 14.6 12 19 12 19z"
        fill={filled ? 'currentColor' : 'none'}
      />
    </svg>
  );
}

export function IconUser(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5.5 19.2c1.2-3.2 3.4-4.8 6.5-4.8s5.3 1.6 6.5 4.8" />
    </svg>
  );
}

export function IconBell(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M6 16h12l-1.2-2.2V11a4.8 4.8 0 0 0-9.6 0v2.8L6 16z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function IconPin(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 21s6-5.4 6-10a6 6 0 1 0-12 0c0 4.6 6 10 6 10z" />
      <circle cx="12" cy="11" r="2" />
    </svg>
  );
}

export function IconCoupon(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M3.5 8.5A1.5 1.5 0 0 1 5 7h14a1.5 1.5 0 0 1 1.5 1.5V10a2 2 0 0 0 0 4v1.5A1.5 1.5 0 0 1 19 17H5a1.5 1.5 0 0 1-1.5-1.5V14a2 2 0 0 0 0-4V8.5z" />
      <path d="M12 9.2v5.6" strokeDasharray="1.6 2.2" />
    </svg>
  );
}

export function IconTag(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12.6 3.2a1 1 0 0 1 .7.3l7.2 7.2a1 1 0 0 1 0 1.4l-8.4 8.4a1 1 0 0 1-1.4 0L3.5 13.3a1 1 0 0 1-.3-.7V4.2A1 1 0 0 1 4.2 3.2h8.4z" />
      <circle cx="8.2" cy="8.2" r="1.35" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function IconGrid(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <rect x="4" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.4" />
      <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.4" />
      <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.4" />
    </svg>
  );
}

export function IconCompare(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M7 8h11" />
      <path d="m15 5 3 3-3 3" />
      <path d="M17 16H6" />
      <path d="m9 13-3 3 3 3" />
    </svg>
  );
}

export function IconCheck(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="m5.5 12.5 4 4 9-9" />
    </svg>
  );
}

export function IconSparkles(props: IconProps) {
  return (
    <svg {...baseProps(props)}>
      <path d="M12 3.5 13.2 8.2 18 9.5 13.2 10.8 12 15.5 10.8 10.8 6 9.5 10.8 8.2 12 3.5z" />
      <path d="M18.5 14.5 19.1 16.6 21.2 17.2 19.1 17.8 18.5 19.9 17.9 17.8 15.8 17.2 17.9 16.6 18.5 14.5z" />
      <path d="M6.2 14.8 6.7 16.5 8.4 17 6.7 17.5 6.2 19.2 5.7 17.5 4 17 5.7 16.5 6.2 14.8z" />
    </svg>
  );
}

export type BottomNavIconId = 'home' | 'search' | 'cart' | 'heart';

export function BottomNavGlyph({ id, active }: { id: BottomNavIconId; active?: boolean }) {
  const size = 28;
  switch (id) {
    case 'home':
      return <IconHome size={size} />;
    case 'search':
      return <IconSearch size={size} />;
    case 'cart':
      return <IconCart size={size} />;
    case 'heart':
      return <IconHeart size={size} filled={Boolean(active)} />;
    default:
      return null;
  }
}

export type HomeShortcutIconId = 'cupons' | 'ofertas' | 'categorias';

export function HomeShortcutGlyph({ id }: { id: HomeShortcutIconId }) {
  const size = 26;
  if (id === 'cupons') return <IconCoupon size={size} />;
  if (id === 'ofertas') return <IconTag size={size} />;
  return <IconGrid size={size} />;
}
