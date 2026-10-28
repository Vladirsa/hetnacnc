import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { cookies, headers } from 'next/headers';

import './globals.css';

import { Toaster } from '@medusajs/ui';

import { Analytics } from '@/components/analytics/Analytics';
import { HtmlLangSetter } from '@/components/atoms/HtmlLangSetter/HtmlLangSetter';
import { AvisoCookies } from '@/components/hetna/AvisoCookies';
import { Traductor } from '@/components/hetna/Traductor';
import { COOKIE_IDIOMA, SCRIPT_VELO } from '@/i18n/idioma';
import { toHreflang } from '@/lib/helpers/hreflang';
import { retrieveCart } from '@/lib/data/cart';

import { InstallPrompt } from '@/components/mobile/InstallPrompt';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

import { Providers } from './providers';

// Las tipografías viven en el repo (src/fonts), no se bajan de Google al
// construir. next/font/google hace esa descarga en cada build, y eso vuelve el
// despliegue dependiente de una red ajena: el 19 de octubre tumbó una
// publicación con "Cannot read properties of null" en next/font, teniendo el
// sitio abajo y sin que el código tuviera nada malo.
//
// Son las versiones variables: un archivo cubre todo el rango de grosores, así
// que pesan menos que un archivo por grosor. Ver src/fonts/LEEME.md.
const funnelDisplay = localFont({
  src: '../fonts/Inter-variable-latin.woff2',
  variable: '--font-body',
  weight: '300 700',
  display: 'swap'
});

const hetnaDisplay = localFont({
  src: '../fonts/SpaceGrotesk-variable-latin.woff2',
  variable: '--font-display',
  weight: '500 700',
  display: 'swap'
});

export const metadata: Metadata = {
  title: {
    template: `%s | ${
      process.env.NEXT_PUBLIC_SITE_NAME || 'HETNA CNC - Marketplace de CNC en México'
    }`,
    default: process.env.NEXT_PUBLIC_SITE_NAME || 'HETNA CNC - Marketplace de CNC en México'
  },
  description:
    process.env.NEXT_PUBLIC_SITE_DESCRIPTION || 'HETNA CNC - Marketplace de CNC en México',
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'),
  applicationName: 'HETNA CNC',
  openGraph: {
    siteName: 'HETNA CNC',
    type: 'website',
    locale: 'es_MX',
    images: [{ url: '/og-hetna.png', width: 1200, height: 630, alt: 'HETNA CNC' }]
  },
  twitter: { card: 'summary_large_image', images: ['/og-hetna.png'] },
  // Verificación de Search Console / Bing: se pone el código en el .env del VPS
  // (GOOGLE_SITE_VERIFICATION, BING_SITE_VERIFICATION). Sin código no se imprime nada.
  verification: {
    ...(process.env.GOOGLE_SITE_VERIFICATION ? { google: process.env.GOOGLE_SITE_VERIFICATION } : {}),
    ...(process.env.BING_SITE_VERIFICATION
      ? { other: { 'msvalidate.01': process.env.BING_SITE_VERIFICATION } }
      : {})
  }
};

export const viewport = { themeColor: '#142033', viewportFit: 'cover' as const };

// Nota: aqui habia un bloque <Head> de 'next/head' con "preconnect" a fuentes
// e imagenes. En el App Router de Next.js ese componente no hace nada (no se
// imprime en la pagina), asi que se quito. Las fuentes ya las sirve el propio
// sitio via next/font, sin pasar por Google Fonts.

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cart = await retrieveCart();

  // Idioma de la página desde el servidor (lo que lee Google):
  // la cookie elegida manda; sin elección, /us es inglés y lo demás español del país.
  const locale = (await headers()).get('x-hetna-locale') || '';
  const elegido = (await cookies()).get(COOKIE_IDIOMA)?.value;
  const enIngles = elegido ? elegido === 'en' : locale === 'us';
  const htmlLang = enIngles
    ? 'en-US'
    : locale === 'us'
      ? 'es-US'
      : locale && locale !== 'mx'
        ? toHreflang(locale)
        : 'es-MX';

  return (
    <html
      lang={htmlLang}
      className=""
    >
      <body className={`${funnelDisplay.className} ${hetnaDisplay.variable} relative bg-primary text-secondary antialiased pb-16 md:pb-0`}>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_VELO }} />
        <Analytics />
        <HtmlLangSetter />
        <Traductor />
        <Providers cart={cart}>
          {children}
          <MobileBottomNav cartCount={(cart?.items ?? []).reduce((s: number, i: any) => s + (i.quantity ?? 0), 0)} />
          <InstallPrompt />
        </Providers>
        <AvisoCookies />
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
