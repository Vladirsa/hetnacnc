'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';

import { EVENTO_CONSENTIMIENTO, permiteRastreo, senalNoRastrear } from '@/lib/hetna/consentimiento';

// Google Analytics usa el Modo de consentimiento v2 de Google: el gtag carga
// siempre, pero arranca con todo "denied" (sin cookies ni identificadores);
// así GA cuenta visitas de forma anónima y sin cookies hasta que la persona
// acepta, y entonces pasa a "granted". Antes GA sólo cargaba al aceptar y,
// como casi nadie acepta, dejó de medir desde el 31-oct-2026.
// Meta Pixel y Microsoft Clarity siguen cargando SÓLO con el consentimiento.
// Si el navegador manda Global Privacy Control / Do Not Track no se carga nada.
// Ver src/lib/hetna/consentimiento.ts y el aviso de privacidad (sección Cookies).
// VELOCIDAD: strategy="lazyOnload" para que no compitan con la tienda al cargar.
export function Analytics() {
  const ga4Id = process.env.NEXT_PUBLIC_GA4_ID;
  const metaPixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  // Google Ads (AW-...): remarketing dinámico y conversiones. Opcional.
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  const gtagId = ga4Id || adsId;
  // Microsoft Clarity (mapas de calor y grabaciones). Oculta lo que se
  // escribe en formularios. Sólo letras y números: va dentro del script.
  const clarityCrudo = process.env.NEXT_PUBLIC_CLARITY_ID || '';
  const clarityId = /^[a-z0-9]{6,20}$/i.test(clarityCrudo) ? clarityCrudo : '';
  const [permitido, setPermitido] = useState(false);
  const [noRastrear, setNoRastrear] = useState(true);

  useEffect(() => {
    setNoRastrear(senalNoRastrear());
    setPermitido(permiteRastreo());
    const alCambiar = () => {
      const si = permiteRastreo();
      setPermitido(si);
      // Avisa a Google del cambio sin recargar la página
      const w = window as unknown as { gtag?: (...a: unknown[]) => void };
      w.gtag?.('consent', 'update', estadoConsentimiento(si));
    };
    window.addEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
    return () => window.removeEventListener(EVENTO_CONSENTIMIENTO, alCambiar);
  }, []);

  if (noRastrear || (!gtagId && !metaPixelId && !clarityId)) return null;

  return (
    <>
      {gtagId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gtagId}`}
            strategy="lazyOnload"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('consent', 'default', ${JSON.stringify(estadoConsentimiento(false))});
              ${permitido ? `gtag('consent', 'update', ${JSON.stringify(estadoConsentimiento(true))});` : ''}
              gtag('js', new Date());
              ${ga4Id ? `gtag('config', '${ga4Id}');` : ''}
              ${adsId ? `gtag('config', '${adsId}', { allow_enhanced_conversions: true });` : ''}
            `}
          </Script>
        </>
      )}
      {permitido && metaPixelId && (
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
      {permitido && clarityId && (
        <Script id="clarity-init" strategy="lazyOnload">
          {`
            (function(c,l,a,r,i,t,y){
              c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
              t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
              y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
            })(window, document, "clarity", "script", "${clarityId}");
          `}
        </Script>
      )}
    </>
  );
}

// Señales del Modo de consentimiento v2 de Google
function estadoConsentimiento(aceptado: boolean) {
  const v = aceptado ? 'granted' : 'denied';
  return { ad_storage: v, analytics_storage: v, ad_user_data: v, ad_personalization: v };
}
