import type { ImgHTMLAttributes } from 'react';

/**
 * Approved brand mark: proposta N5 "LS fatiado" (outlined SVGs in /public/brand/n5).
 * Kept under the historical `SchimitzMonogram` name so every call site (placeholders,
 * cart, campaign, home) switches to the N5 app-icon artwork without touching its logic.
 */
export const N5_BRAND = {
  appIcon: '/brand/n5/icone-app-512.svg',
  symbolOnNavy: '/brand/n5/simbolo-fundo-navy.svg',
  symbolOnLight: '/brand/n5/simbolo-fundo-claro.svg',
  lockupOnNavy: '/brand/n5/lockup-horizontal-fundo-navy.svg',
  lockupOnLight: '/brand/n5/lockup-horizontal-fundo-claro.svg',
  favicon: '/brand/n5/favicon.svg',
} as const;

type Variant = 'navy' | 'bordo' | 'cream';

type MonogramProps = Omit<ImgHTMLAttributes<HTMLImageElement>, 'src' | 'width' | 'height'> & {
  size?: number;
  /** Legacy prop from the S. monogram; the N5 icon carries its own contrast. */
  variant?: Variant;
  /** Legacy prop: adds a hairline cream ring around the rounded icon. */
  ring?: boolean;
  title?: string;
};

export function SchimitzMonogram({
  size = 36,
  variant: _variant,
  ring = false,
  title,
  className,
  style,
  ...rest
}: MonogramProps) {
  const radius = Math.round(size * (112 / 512));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={N5_BRAND.appIcon}
      width={size}
      height={size}
      alt={title || ''}
      aria-hidden={title ? undefined : true}
      className={className ? `n5-mark ${className}` : 'n5-mark'}
      decoding="async"
      draggable={false}
      style={{
        display: 'block',
        width: size,
        height: size,
        // Immune to container img rules (e.g. PDP carousel padding/max-size).
        padding: 0,
        maxWidth: 'none',
        maxHeight: 'none',
        objectFit: 'contain',
        flex: '0 0 auto',
        borderRadius: radius,
        ...(ring ? { boxShadow: '0 0 0 1px rgba(243,234,219,.22)' } : null),
        ...style,
      }}
      {...rest}
    />
  );
}

export function SchimitzWordmark({ className }: { className?: string }) {
  return (
    <span className={className ? `id-wordmark ${className}` : 'id-wordmark'}>
      Schimitz<i className="id-dot">.</i>
    </span>
  );
}
