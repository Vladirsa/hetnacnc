import type { Metadata } from 'next';
import localFont from 'next/font/local';

import './globals.css';

import { Toaster } from '@medusajs/ui';

import { Analytics } from '@/components/analytics/Analytics';
import { HtmlLangSetter } from '@/components/atoms/HtmlLangSetter/HtmlLangSetter';
import { Traductor } from '@/components/hetna/Traductor';
import { SCRIPT_VELO } from '@/i18n/idioma';
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000')
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

  // default lang updated by HtmlLangSetter
  const htmlLang = 'es-MX';

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
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
