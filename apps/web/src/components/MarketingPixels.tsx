import Script from 'next/script';
import { gaMeasurementId, metaPixelId } from '@/lib/marketing';

/**
 * GA4 and Meta Pixel load only when the matching env id is valid.
 * Missing or malformed values render nothing — there is no default id.
 */
export function MarketingPixels() {
  const ga = gaMeasurementId(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID);
  const pixel = metaPixelId(process.env.NEXT_PUBLIC_META_PIXEL_ID);
  if (!ga && !pixel) return null;

  return (
    <>
      {ga ? (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="sch-ga4" strategy="afterInteractive">
            {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config',${JSON.stringify(ga)});`}
          </Script>
        </>
      ) : null}
      {pixel ? (
        <Script id="sch-meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init',${JSON.stringify(pixel)});fbq('track','PageView');`}
        </Script>
      ) : null}
    </>
  );
}
