import type { NextConfig } from 'next';

// ---------------------------------------------------------------------
// CONTENT-SECURITY-POLICY (CSP): lista de lugares desde donde el navegador
// puede cargar scripts, imágenes, videos, etc. Frena ataques que inyectan
// código ajeno en la página.
//
// ETAPA 1 (ahora): modo "solo reporte". No bloquea nada; cada cosa que
// incumpla se anota en el registro del servidor (/api/csp-reporte).
// ETAPA 2: cuando el registro quede limpio, se cambia el encabezado a
// 'Content-Security-Policy' (cambiar la clave de abajo) y empieza a bloquear.
//
// Etapa 1b: según el registro se agregaron TalkJS (mensajería) y Google
// Analytics / Tag Manager (estadísticas).
// Etapa 1c: según el registro real de clientes se agregaron Stripe (pagos),
// Facebook (pixel de anuncios), jsDelivr (scripts y tipografías del generador
// de letreros) y 'unsafe-eval' (lo usa alguna librería de estadísticas).
// ---------------------------------------------------------------------
const politicaCSP = [
  "default-src 'self'",
  // Next.js necesita 'unsafe-inline' mientras no usemos nonces. Lo demás son servicios que usa la tienda.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://sdk.mercadopago.com https://http2.mlstatic.com https://connect.facebook.net https://cdn.talkjs.com https://www.googletagmanager.com https://js.stripe.com https://cdn.jsdelivr.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "connect-src 'self' https://hetnacnc.com https://*.hetnacnc.com https://cloudflareinsights.com https://*.mercadopago.com https://*.mercadolibre.com https://www.facebook.com https://connect.facebook.net https://*.talkjs.com wss://*.talkjs.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://stats.g.doubleclick.net https://api.stripe.com https://*.stripe.com https://*.stripe.network https://cdn.jsdelivr.net",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://*.mercadopago.com https://*.mercadolibre.com https://*.talkjs.com https://www.facebook.com https://js.stripe.com https://*.stripe.com https://*.stripe.network",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.mercadopago.com https://www.facebook.com",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
  "report-uri /api/csp-reporte"
].join('; ');

// Encabezados de seguridad que el navegador recibe en cada pagina.
const encabezadosSeguridad = [
  // Obliga a usar siempre HTTPS (1 año)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Evita que el navegador "adivine" tipos de archivo
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Evita que otros sitios metan tu tienda dentro de un marco (clickjacking)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Al salir a otro sitio solo se comparte el dominio, no la URL completa
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Solo reporte: no bloquea. Para activar de verdad, cambiar por 'Content-Security-Policy'
  { key: 'Content-Security-Policy-Report-Only', value: politicaCSP }
];

const nextConfig: NextConfig = {
  // Sin output: "standalone" a propósito. Ese modo empaqueta un servidor
  // aparte en .next/standalone y rompe `next start`, que es justo con lo que
  // PM2 arranca el storefront en el VPS -- truena con ENOENT buscando
  // prerender-manifest.json y Next lo dice claro: "next start does not work
  // with output: standalone". Sirve para imágenes de Docker, y aquí no se
  // despliega así: el repo vive en el servidor con sus node_modules.
  trailingSlash: false,
  reactStrictMode: true,
  // Oculta el encabezado "x-powered-by: Next.js" (no regalar pistas a atacantes)
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: encabezadosSeguridad }];
  },
  experimental: {
    // @medusajs/ui (y lodash) no se parten por componente/función al importar
    // desde su punto de entrada principal: esto le pide a Next que reescriba
    // esos imports a sus archivos internos para no cargar toda la librería
    // (p. ej. el DataTable de @medusajs/ui, que el storefront no usa) en cada página.
    optimizePackageImports: ["@medusajs/ui", "lodash"],
  },
  logging: {
    fetches: {
      fullUrl: true
    }
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'medusa-public-images.s3.eu-west-1.amazonaws.com'
      },
      {
        protocol: 'https',
        hostname: 'mercur-connect.s3.eu-central-1.amazonaws.com'
      },
      {
        protocol: 'https',
        hostname: 'api.mercurjs.com'
      },
      {
        protocol: 'http',
        hostname: 'localhost'
      },
      {
        protocol: 'https',
        hostname: 'api-sandbox.mercurjs.com',
        pathname: '/static/**'
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com'
      },
      {
        protocol: 'https',
        hostname: 's3.eu-central-1.amazonaws.com'
      },
      {
        protocol: "https",
        hostname: "mercur-testing.up.railway.app",
      },
      {
        protocol: 'https',
        hostname: '**'
      }
    ]
  },
  typescript: {
    ignoreBuildErrors: true
  },
  // replicad-opencascadejs (el motor B-rep del generador de caja) es un bundle
  // de Emscripten que sirve para Node y para el navegador: trae un
  // import("node:module") dentro de su rama de Node. Esa rama nunca se ejecuta
  // en el navegador, pero webpack recorre el módulo entero al construir y
  // truena con "UnhandledSchemeError: Reading from node:module", aunque el
  // import de la librería ya sea dinámico.
  //
  // El prefijo node: lo atiende webpack antes de llegar a resolve.alias, por
  // eso un alias a false no basta: hay que quitarle el prefijo primero
  // (NormalModuleReplacementPlugin) y recién entonces fallback puede
  // resolverlo a un módulo vacío. Sólo para el bundle del navegador -- del
  // lado del servidor esos módulos sí existen y hay que dejarlos pasar.
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.plugins.push(
        new webpack.NormalModuleReplacementPlugin(/^node:/, (recurso: { request: string }) => {
          recurso.request = recurso.request.replace(/^node:/, "")
        })
      )
      config.resolve.fallback = {
        ...config.resolve.fallback,
        module: false,
        fs: false,
        path: false,
        crypto: false,
        url: false,
        worker_threads: false,
      }
    }
    return config
  }
};

export default nextConfig;
