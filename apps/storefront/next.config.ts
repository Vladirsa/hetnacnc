import type { NextConfig } from 'next';

// Encabezados de seguridad que el navegador recibe en cada pagina.
// (Se dejo fuera Content-Security-Policy a proposito: es estricto y, mal
// configurado, puede romper el pago, el chat o la analitica. Se agrega
// despues, probandolo con calma.)
const encabezadosSeguridad = [
  // Obliga a usar siempre HTTPS (1 año)
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Evita que el navegador "adivine" tipos de archivo
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Evita que otros sitios metan tu tienda dentro de un marco (clickjacking)
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Al salir a otro sitio solo se comparte el dominio, no la URL completa
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
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
