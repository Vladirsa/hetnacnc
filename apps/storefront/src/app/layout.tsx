import type { Metadata } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';

import './globals.css';

import { Toaster } from '@medusajs/ui';
import Head from 'next/head';

import { Analytics } from '@/components/analytics/Analytics';
import { HtmlLangSetter } from '@/components/atoms/HtmlLangSetter/HtmlLangSetter';
import { Traductor } from '@/components/hetna/Traductor';
import { SCRIPT_VELO } from '@/i18n/idioma';
import { retrieveCart } from '@/lib/data/cart';

import { InstallPrompt } from '@/components/mobile/InstallPrompt';
import { MobileBottomNav } from '@/components/mobile/MobileBottomNav';

import { Providers } from './providers';

const funnelDisplay = Inter({
  variable: '--font-body',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700']
});

const hetnaDisplay = Space_Grotesk({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700']
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
      <Head>
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://fonts.gstatic.com"
        />
        <link
          rel="preconnect"
          href="https://fonts.googleapis.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://fonts.googleapis.com"
        />
        <link
          rel="preconnect"
          href="https://i.imgur.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://i.imgur.com"
        />
        {/* Image origins for faster LCP */}
        <link
          rel="preconnect"
          href="https://medusa-public-images.s3.eu-west-1.amazonaws.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://medusa-public-images.s3.eu-west-1.amazonaws.com"
        />
        <link
          rel="preconnect"
          href="https://mercur-connect.s3.eu-central-1.amazonaws.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://mercur-connect.s3.eu-central-1.amazonaws.com"
        />
        <link
          rel="preconnect"
          href="https://s3.eu-central-1.amazonaws.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://s3.eu-central-1.amazonaws.com"
        />
        <link
          rel="preconnect"
          href="https://api.mercurjs.com"
          crossOrigin="anonymous"
        />
        <link
          rel="dns-prefetch"
          href="https://api.mercurjs.com"
        />
      </Head>
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
