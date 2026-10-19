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
