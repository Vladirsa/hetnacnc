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
// ---------------------------------------------------------------------
const politicaCSP = [
  "default-src 'self'",
  // Next.js necesita 'unsafe-inline' mientras no usemos nonces. Lo demás son servicios que usa la tienda.
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com https://sdk.mercadopago.com https://http2.mlstatic.com https://connect.facebook.net",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com",
  "connect-src 'self' https://hetnacnc.com https://*.hetnacnc.com https://cloudflareinsights.com https://*.mercadopago.com https://*.mercadolibre.com https://www.facebook.com https://connect.facebook.net",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://*.mercadopago.com https://*.mercadolibre.com",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.mercadopago.com",
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
  output: "standalone",
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
  }
};

export default nextConfig;
