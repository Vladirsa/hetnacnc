import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: "standalone",
  trailingSlash: false,
  reactStrictMode: true,
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
