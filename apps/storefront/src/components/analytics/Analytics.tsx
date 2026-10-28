'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

import { EVENTO_CONSENTIMIENTO, permiteRastreo } from '@/lib/hetna/consentimiento';

// Carga GA4 y/o Meta Pixel solo si:
//   1) sus IDs están configurados en el entorno, y
//   2) la persona aceptó las cookies de estadística y publicidad
//      (y su navegador no manda Global Privacy Control / Do Not Track).
// Sin eso no renderiza nada. Ver src/lib/hetna/consentimiento.ts y el aviso
// de privacidad (sección Cookies).
// VELOCIDAD: strategy="lazyOnload" para que no compitan con la tienda al cargar.
export function Analytics() {
  const ga4Id = process.env.NEXT_PUBLIC_GA4_ID;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const [permitido, setPermitido] = useState(false);

  useEffect(() => {
    setPermitido(permiteRastreo());
    const alCambiar = () => setPermitido(permiteRastreo());
    window.addEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
    return () => window.removeEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
  }, []);

  if (!permitido || (!ga4Id && !metaPixelId)) return null;

  return (
    <>
      {ga4Id && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${ga4Id}`}
            strategy="lazyOnload"
          />
          <Script id="ga4-init" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${ga4Id}');
            `}
          </Script>
        </>
      )}
      {metaPixelId && (
        <Script id="meta-pixel-init" strategy="lazyOnload">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${metaPixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}
