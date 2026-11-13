export const toHreflang = (code: string): string => {
  const map: Record<string, string> = {
    // HETNA: las versiones por país se sirven en español, salvo /us (inglés).
    // Sin este mapa Google recibía "mx", "ar", "bo", "co"... (que no son
    // idiomas, o son árabe, tibetano, corso).
    mx: "es-MX",
    ar: "es-AR",
    bo: "es-BO",
    cl: "es-CL",
    co: "es-CO",
    cr: "es-CR",
    do: "es-DO",
    ec: "es-EC",
    sv: "es-SV",
    gt: "es-GT",
    hn: "es-HN",
    ni: "es-NI",
    pa: "es-PA",
    py: "es-PY",
    pe: "es-PE",
    uy: "es-UY",
    ve: "es-VE",
    pr: "es-PR",
    us: "en-US", // /us se sirve en inglés a quien no ha elegido idioma
    ca: "es-CA",
    gb: "en-GB",
    au: "en-AU",
    ie: "en-IE",
    pl: "pl-PL",
    de: "de-DE",
    fr: "fr-FR",
    es: "es-ES",
    it: "it-IT",
    nl: "nl-NL",
    se: "sv-SE",
    no: "nb-NO",
    dk: "da-DK",
    cz: "cs-CZ",
    sk: "sk-SK",
    pt: "pt-PT",
    br: "pt-BR",
    at: "de-AT",
    ch: "de-CH",
    cn: "zh-CN",
    jp: "ja-JP",
    kr: "ko-KR",
    tw: "zh-TW",
    hk: "zh-HK",
    sg: "en-SG",
    my: "ms-MY",
  }
  return map[code] || code
}

const DEFAULT_REGION = process.env.NEXT_PUBLIC_DEFAULT_REGION || "us"

// The storefront serves every page under a locale prefix (/de, /se, ...);
// requests without one are 307-redirected by the middleware. x-default must
// therefore resolve to a locale that actually returns 200, never the bare path.
export const resolveXDefaultLocale = (locales: string[]): string => {
  if (!locales.length) return DEFAULT_REGION
  for (const preferred of [DEFAULT_REGION, "us", "gb"]) {
    if (locales.includes(preferred)) return preferred
  }
  return locales[0]
}

export const getStorefrontLocales = (
  regions: { countries?: { iso_2?: string | null }[] | null }[] | null
): string[] =>
  Array.from(
    new Set(
      (regions || []).flatMap(
        (r) => r.countries?.map((c) => c.iso_2).filter(Boolean) || []
      )
    )
  ) as string[]

type HreflangAlternates = {
  canonical: string
  languages: Record<string, string>
}

// Canonical y hreflang (auditoría SEO del 13 nov 2026).
//
// Todas las versiones por país (/hn, /ar, /us…) sirven el MISMO contenido en
// español: antes cada una se declaraba canónica de sí misma y anunciaba 18
// alternativas, así que cada producto existía 19 veces para Google. Ahora:
//   - la URL principal de todo es /mx (dominio sin www);
//   - hreflang sólo une /mx y /us en la PORTADA, la única con versión en inglés
//     propia (título, descripción e imagen). En lo demás /us es la misma
//     página traducida en el navegador y su canónica es /mx.
// Cuando haya páginas traducidas de verdad, se agregan aquí sus pares.
export const SITIO_CANONICO = "https://hetnacnc.com"

export const buildHreflangAlternates = ({
  path,
  locale,
}: {
  baseUrl?: string
  // Path after the locale segment, starting with "/" (empty string for home).
  path: string
  locale: string
  locales?: string[]
}): HreflangAlternates => {
  const mx = `${SITIO_CANONICO}/mx${path}`
  if (path === "" || path === "/") {
    const us = `${SITIO_CANONICO}/us`
    return {
      canonical: locale.toLowerCase() === "us" ? us : `${SITIO_CANONICO}/mx`,
      languages: { "es-MX": `${SITIO_CANONICO}/mx`, "en-US": us, "x-default": `${SITIO_CANONICO}/mx` },
    }
  }
  return { canonical: mx, languages: { "es-MX": mx, "x-default": mx } }
}
