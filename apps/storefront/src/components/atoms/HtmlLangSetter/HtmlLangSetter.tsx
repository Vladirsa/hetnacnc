'use client';

import { useEffect } from 'react';

import { usePathname } from 'next/navigation';

import { leerIdioma } from '@/components/hetna/Traductor';
import { toHreflang } from '@/lib/helpers/hreflang';

export function HtmlLangSetter() {
  const pathname = usePathname();

  useEffect(() => {
    const localeMatch = pathname?.match(/^\/([a-z]{2})(?:\/|$)/i);
    const locale = localeMatch?.[1] || 'en';
    // En inglés (elegido, o /us sin elegir) la página es en-US; si no, español del país
    const htmlLang =
      leerIdioma() === 'en' ? 'en-US' : locale.toLowerCase() === 'us' ? 'es-US' : locale.toLowerCase() === 'mx' ? 'es-MX' : toHreflang(locale);

    if (typeof document !== 'undefined') {
      document.documentElement.lang = htmlLang;
    }
  }, [pathname]);

  return null;
}
