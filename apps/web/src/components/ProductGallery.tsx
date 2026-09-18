'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  clampGalleryIndex,
  galleryAriaLabel,
  galleryCloseLabel,
  galleryCounterLabel,
  galleryOpenLabel,
  galleryZoomHint,
  nextGalleryIndex,
  type GalleryImage,
} from '@/lib/product-gallery';
import { pdpGalleryTapOpensLightbox } from '@/lib/pdp-gallery-layout';

type Props = {
  images: GalleryImage[];
  productName: string;
};

export function ProductGallery({ images, productName }: Props) {
  const [idx, setIdx] = useState(0);
  const [lightbox, setLightbox] = useState(false);
  const [zoomed, setZoomed] = useState(false);
  const [portalReady, setPortalReady] = useState(false);
  const carouselRef = useRef<HTMLDivElement | null>(null);
  const lightboxTrackRef = useRef<HTMLDivElement | null>(null);
  const scrollSyncLock = useRef(false);
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const tapOrigin = useRef<{ x: number; y: number } | null>(null);

  const total = images.length;

  const scrollToIndex = useCallback((el: HTMLDivElement | null, n: number, smooth: boolean) => {
    if (!el) return;
    const w = el.clientWidth || 1;
    scrollSyncLock.current = true;
    el.scrollTo({ left: n * w, behavior: smooth ? 'smooth' : 'auto' });
    window.setTimeout(() => {
      scrollSyncLock.current = false;
    }, 350);
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const target = clampGalleryIndex(next, total);
      setIdx(target);
      scrollToIndex(carouselRef.current, target, true);
      if (lightbox) scrollToIndex(lightboxTrackRef.current, target, true);
    },
    [lightbox, scrollToIndex, total],
  );

  const go = useCallback(
    (delta: number) => {
      if (total <= 0) return;
      goTo(nextGalleryIndex(idx, total, delta));
    },
    [goTo, idx, total],
  );

  const onTrackScroll = useCallback(
    (el: HTMLDivElement | null, setter = true) => {
      if (scrollSyncLock.current || !el) return;
      const w = el.clientWidth || 1;
      const next = Math.round(el.scrollLeft / w);
      if (setter) setIdx((cur) => (cur === next ? cur : next));
    },
    [],
  );

  const openLightbox = useCallback(() => {
    if (!total) return;
    setZoomed(false);
    setLightbox(true);
  }, [total]);

  const closeLightbox = useCallback(() => {
    setLightbox(false);
    setZoomed(false);
  }, []);

  const requestCloseLightbox = useCallback(() => {
    if (typeof window !== 'undefined' && window.history.state?.pdpLightbox) {
      window.history.back();
      return;
    }
    closeLightbox();
  }, [closeLightbox]);

  const onPhotoPointerDown = useCallback((e: React.PointerEvent) => {
    tapOrigin.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onPhotoPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const origin = tapOrigin.current;
      tapOrigin.current = null;
      if (!origin) return;
      if (!pdpGalleryTapOpensLightbox(e.clientX - origin.x, e.clientY - origin.y)) return;
      openLightbox();
    },
    [openLightbox],
  );

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    setIdx(0);
    setLightbox(false);
    setZoomed(false);
    const el = carouselRef.current;
    if (el) el.scrollTo({ left: 0, behavior: 'auto' });
  }, [productName, total, images[0]?.url]);

  useEffect(() => {
    if (!lightbox) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();
    scrollToIndex(lightboxTrackRef.current, idx, false);
    if (!window.history.state?.pdpLightbox) {
      window.history.pushState({ ...(window.history.state || {}), pdpLightbox: true }, '');
    }
    const onPop = () => closeLightbox();
    window.addEventListener('popstate', onPop);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('popstate', onPop);
    };
    // idx/scroll only on open; photo changes use goTo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lightbox, closeLightbox, scrollToIndex]);

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        requestCloseLightbox();
        return;
      }
      if (zoomed) return;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        go(1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        go(-1);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, lightbox, requestCloseLightbox, zoomed]);

  function onLightboxTouchStart(e: React.TouchEvent) {
    if (zoomed) return;
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  }

  function onLightboxTouchEnd(e: React.TouchEvent) {
    if (zoomed || touchStartX.current == null) return;
    const x = e.changedTouches[0]?.clientX ?? touchStartX.current;
    const dx = x - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 40) return;
    go(dx < 0 ? 1 : -1);
  }

  const lightboxNode =
    lightbox && total ? (
      <div
        className="pdp-lightbox"
        role="dialog"
        aria-modal="true"
        aria-label={galleryAriaLabel(productName, idx, total)}
        onClick={requestCloseLightbox}
      >
        <div
          className="pdp-lightbox-inner"
          onClick={(e) => e.stopPropagation()}
          onTouchStart={onLightboxTouchStart}
          onTouchEnd={onLightboxTouchEnd}
        >
          <div className="pdp-lightbox-toolbar">
            <span className="pdp-lightbox-count">{galleryCounterLabel(idx, total)}</span>
            <div className="pdp-lightbox-actions">
              <button
                type="button"
                className="pdp-lightbox-btn"
                onClick={() => setZoomed((z) => !z)}
              >
                {galleryZoomHint(zoomed)}
              </button>
              <button
                type="button"
                className="pdp-lightbox-close"
                ref={closeBtnRef}
                onClick={requestCloseLightbox}
                aria-label={galleryCloseLabel()}
              >
                ×
              </button>
            </div>
          </div>

          <div
            className={`pdp-lightbox-stage${zoomed ? ' is-zoomed' : ''}`}
            ref={lightboxTrackRef}
            onScroll={() => {
              if (zoomed) return;
              onTrackScroll(lightboxTrackRef.current);
            }}
          >
            {images.map((img, i) => (
              <div
                className="pdp-lightbox-slide"
                key={`lb-${img.url}-${i}`}
                onClick={requestCloseLightbox}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={img.url}
                  alt={img.alt}
                  className={`pdp-lightbox-img${zoomed ? ' is-zoomed' : ''}`}
                  width={1200}
                  height={1200}
                  decoding="async"
                  draggable={false}
                  onClick={(e) => {
                    e.stopPropagation();
                    setZoomed((z) => !z);
                  }}
                />
              </div>
            ))}
          </div>

          {total > 1 && !zoomed ? (
            <>
              <button
                type="button"
                className="pdp-lightbox-nav pdp-lightbox-prev"
                aria-label="Foto anterior"
                onClick={() => go(-1)}
              >
                ‹
              </button>
              <button
                type="button"
                className="pdp-lightbox-nav pdp-lightbox-next"
                aria-label="Próxima foto"
                onClick={() => go(1)}
              >
                ›
              </button>
            </>
          ) : null}
        </div>
      </div>
    ) : null;

  return (
    <div className="pdp-gallery">
      <div
        className="pdp-carousel card"
        onKeyDown={(e) => {
          if (total <= 1) return;
          if (e.key === 'ArrowRight') {
            e.preventDefault();
            go(1);
          } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            go(-1);
          }
        }}
        tabIndex={total > 1 ? 0 : undefined}
        aria-roledescription="carrossel"
        aria-label={galleryAriaLabel(productName, idx, total)}
      >
        <div
          className="pdp-carousel-track"
          ref={carouselRef}
          onScroll={() => onTrackScroll(carouselRef.current)}
        >
          {total ? (
            images.map((img, i) => (
              <div className="pdp-carousel-slide" key={`${img.url}-${i}`}>
                <div
                  className="pdp-gallery-open"
                  role="button"
                  tabIndex={0}
                  onPointerDown={onPhotoPointerDown}
                  onPointerUp={onPhotoPointerUp}
                  onClick={openLightbox}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      openLightbox();
                    }
                  }}
                  aria-label={galleryOpenLabel()}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.alt}
                    width={800}
                    height={800}
                    sizes="(max-width: 768px) 100vw, 480px"
                    loading={i === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                    draggable={false}
                    onError={(e) => {
                      e.currentTarget.style.visibility = 'hidden';
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div className="pdp-carousel-slide pdp-carousel-empty pdp-carousel-ph" aria-label="Imagem em breve">
              <span className="pdp-carousel-ph-mark">
                LOJAS <em>SCHIMITZ</em>
              </span>
              <span className="pdp-carousel-ph-hint">Imagem em breve</span>
            </div>
          )}
        </div>
        {total ? (
          <button
            type="button"
            className="pdp-gallery-zoomchip"
            onClick={openLightbox}
            aria-label={galleryOpenLabel()}
          >
            Ampliar
          </button>
        ) : null}
        {total > 1 ? (
          <>
            <button
              type="button"
              className="pdp-carousel-nav pdp-carousel-prev"
              aria-label="Foto anterior"
              onClick={() => go(-1)}
            >
              ‹
            </button>
            <button
              type="button"
              className="pdp-carousel-nav pdp-carousel-next"
              aria-label="Próxima foto"
              onClick={() => go(1)}
            >
              ›
            </button>
            <div className="pdp-carousel-dots" aria-hidden>
              {images.map((_, i) => (
                <span key={i} className={`pdp-carousel-dot${i === idx ? ' active' : ''}`} />
              ))}
            </div>
          </>
        ) : null}
      </div>

      {total > 1 ? (
        <div className="pdp-thumbs" role="list">
          {images.map((img, i) => (
            <button
              key={`${img.url}-${i}`}
              type="button"
              className={`pdp-thumb${i === idx ? ' active' : ''}`}
              onClick={() => goTo(i)}
              aria-label={`Foto ${i + 1}`}
              aria-current={i === idx ? 'true' : undefined}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt=""
                width={80}
                height={80}
                sizes="80px"
                loading="lazy"
                decoding="async"
              />
            </button>
          ))}
        </div>
      ) : null}

      {portalReady && lightboxNode ? createPortal(lightboxNode, document.body) : null}
    </div>
  );
}
