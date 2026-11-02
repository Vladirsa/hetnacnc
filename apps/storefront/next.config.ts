import type { NextConfig } from 'next';

// ---------------------------------------------------------------------
// CONTENT-SECURITY-POLICY (CSP): la lista de lugares desde donde el navegador
// puede cargar scripts, imágenes, videos, etc. Frena los ataques que inyectan
// código ajeno en la página.
//
// ETAPA 1 (hasta el 31 de octubre): modo "sólo reporte".
// ETAPA 2 (desde el 31 de octubre): bloquea, y cada cosa bloqueada se sigue
// anotando en /api/csp-reporte (pm2 logs hetna-web | grep csp).
//
// Lo que se fue agregando según el registro real: TalkJS (mensajería), Google
// Analytics / Tag Manager, Stripe y Mercado Pago (pagos), Facebook (pixel),
// jsDelivr (scripts y tipografías del generador de letreros), cdnjs (three.js
// del Laboratorio CAM, /cam-lab), www.google.com.mx (audiencias de Google Ads
// para visitantes de México) y 'unsafe-eval', que lo usa alguna librería de
// estadísticas.
//
// CUIDADO con los comodines: en CSP, `https://*.analytics.google.com` NO cubre
// `https://analytics.google.com`. El comodín exige un subdominio. Por eso GA4 y
// Google Ads estuvieron bloqueados sin que nadie se enterara: la regla parecía
// correcta de leerla. Los dominios de abajo salieron del log de /api/csp-reporte
// del 25 de octubre -- están puestos porque el navegador reportó que los
// bloqueó, uno por uno, no porque se parezcan a los que hacen falta.
// ---------------------------------------------------------------------
const politicaCSP = [
  "default-src 'self'",
  // Next.js necesita 'unsafe-inline' mientras no usemos nonces. Lo demás son
  // servicios que la tienda de verdad carga.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://static.cloudflareinsights.com https://sdk.mercadopago.com https://http2.mlstatic.com https://connect.facebook.net https://cdn.talkjs.com https://www.googletagmanager.com https://googleads.g.doubleclick.net https://www.googleadservices.com https://js.stripe.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "connect-src 'self' https://hetnacnc.com https://*.hetnacnc.com https://cloudflareinsights.com https://*.mercadopago.com https://*.mercadolibre.com https://www.facebook.com https://connect.facebook.net https://*.talkjs.com wss://*.talkjs.com https://www.googletagmanager.com https://www.google-analytics.com https://*.google-analytics.com https://analytics.google.com https://*.analytics.google.com https://www.google.com https://www.google.com.mx https://stats.g.doubleclick.net https://*.doubleclick.net https://www.googleadservices.com https://api.stripe.com https://*.stripe.com https://*.stripe.network https://cdn.jsdelivr.net",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://*.mercadopago.com https://*.mercadolibre.com https://*.talkjs.com https://www.facebook.com https://js.stripe.com https://*.stripe.com https://*.stripe.network",
  "media-src 'self' blob: https:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://*.mercadopago.com https://www.facebook.com",
  "frame-ancestors 'self'",
  "upgrade-insecure-requests",
  "report-uri /api/csp-reporte"
].join('; ');

// Encabezados de seguridad que el navegador recibe en cada página.
const encabezadosSeguridad = [
  // Obliga a usar siempre HTTPS (1 año).
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  // Evita que el navegador "adivine" tipos de archivo.
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Evita que otro sitio meta la tienda dentro de un marco (clickjacking).
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  // Al salir a otro sitio sólo se comparte el dominio, no la URL completa.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // Apaga funciones del navegador que el sitio no usa (micrófono, USB, etc.).
  // Cámara, ubicación y pagos se dejan como vienen: los usan el escaneo, el
  // "Enviar a" y Mercado Pago / PayPal.
  { key: 'Permissions-Policy', value: 'microphone=(), usb=(), serial=(), bluetooth=(), hid=(), midi=(), browsing-topics=()' },
  // ETAPA 2 (31 de octubre): ya bloquea. El registro de /api/csp-reporte sólo
  // traía audiencias de Google Ads de otros países (google.com.pe, etc.), que no
  // importan para México. Sigue reportando lo que bloquee.
  // Para volver a sólo-reporte sin tocar código: CSP_SOLO_REPORTE=1 y desplegar.
  {
    key: process.env.CSP_SOLO_REPORTE === '1' ? 'Content-Security-Policy-Report-Only' : 'Content-Security-Policy',
    value: politicaCSP
  }
];

const nextConfig: NextConfig = {
  // Carpeta del build. desplegar.sh alterna entre .next-a y .next-b: construye
  // en la que NO está sirviendo el sitio y sólo cambia al reiniciar. Así el
  // build no borra lo que el sitio en vivo está usando (eso tumbaba páginas
  // durante el despliegue y a veces rompía el propio build con
  // "ENOENT pages-manifest.json"). Sin la variable, la de siempre.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // NO agregar output: "standalone". Ese modo empaqueta un servidor aparte en
  // .next/standalone y rompe `next start`, que es justo con lo que PM2 arranca
  // el storefront en el VPS: truena con ENOENT buscando prerender-manifest.json
  // y Next lo dice tal cual, "next start does not work with output: standalone".
  // Ya tiró el sitio una vez por esto. Sirve para imágenes de Docker, y aquí no
  // se despliega así: el repo vive en el servidor con sus node_modules.
  trailingSlash: false,
  reactStrictMode: true,
  // Oculta el encabezado "x-powered-by: Next.js" (no regalar pistas).
  poweredByHeader: false,
  // Comprime las respuestas que sirve Node. (No va `swcMinify`: Next 15 ya
  // minifica siempre y esa llave sólo salía como advertencia en cada build.)
  compress: true,
  productionBrowserSourceMaps: false,
  // Sólo afecta al modo desarrollo: cuántas páginas compiladas se guardan en
  // memoria y por cuánto tiempo, para no recompilar a cada rato.
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 5,
  },
  async headers() {
    return [
      { source: '/:path*', headers: encabezadosSeguridad },
      // Caché de los archivos de public/. Antes esta regla decía
      // '/public/:path*' y no cacheaba nada: Next sirve public/ en la raíz, o
      // sea /images/foo.webp, no /public/images/foo.webp. Se nombran las
      // carpetas una por una a propósito, porque public/sw.js es el service
      // worker y ése NO se puede cachear: quedaría pegada una versión vieja de
      // la tienda en los teléfonos.
      {
        // El WASM lo versiona el build, así que puede ser inmutable.
        source: '/wasm/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }]
      },
      {
        // Imágenes e iconos: una semana, y mientras se revalida se sirve la que
        // ya está (el visitante no espera). No van como inmutables porque estos
        // archivos se reemplazan a mano con el mismo nombre; si hay que cambiar
        // uno YA, se sube con otro nombre.
        source: '/:carpeta(images|icons)/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }
        ]
      }
    ];
  },
  experimental: {
    // @medusajs/ui (y lodash) no se parten por componente al importarlos desde
    // su punto de entrada: esto le pide a Next que reescriba esos imports a los
    // archivos internos, para no cargar la librería completa (por ejemplo el
    // DataTable de @medusajs/ui, que la tienda no usa) en cada página.
    optimizePackageImports: ["@medusajs/ui", "lodash"]
  },
  logging: { fetches: { fullUrl: true } },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: 'attachment',
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    minimumCacheTTL: 31536000,
    remotePatterns: [
      { protocol: 'https', hostname: 'medusa-public-images.s3.eu-west-1.amazonaws.com' },
      { protocol: 'https', hostname: 'mercur-connect.s3.eu-central-1.amazonaws.com' },
      { protocol: 'https', hostname: 'api.mercurjs.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'api-sandbox.mercurjs.com', pathname: '/static/**' },
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: 's3.eu-central-1.amazonaws.com' },
      { protocol: "https", hostname: "mercur-testing.up.railway.app" },
      { protocol: 'https', hostname: '**' }
    ]
  },
  // URLs viejas que siguen circulando y daban 404.
  //
  // El 25 de octubre el log de GA mostró una visita real a
  // /mx/producto/<handle> con el título "404 | HETNA CNC". La ruta de la tienda
  // es /products/<handle>; nada en este repo genera la forma singular, así que
  // viene de afuera -- un post, un enlace compartido, un buscador. Esos enlaces
  // ya están publicados y no se pueden retractar, así que la URL tiene que
  // funcionar en vez de que persigamos la fuente.
  //
  // Permanente (308) porque el destino es el definitivo: así el buscador
  // transfiere el posicionamiento en lugar de indexar dos direcciones.
  async redirects() {
    return [
      // La app HETNA CNC para talleres: enlaces cortos para QR, volantes y WhatsApp.
      // /app → la página de la app; /app/android → el APK más reciente (release
      // de GitHub del repo Vladirsa/Cotizador); /app/ios → cómo instalarla en iPhone.
      { source: "/app", destination: "/mx/servicios/cotizador-cnc", permanent: false },
      { source: "/app/android", destination: "https://github.com/Vladirsa/Cotizador/releases/latest/download/HetnaCNC_arm64.apk", permanent: false },
      { source: "/app/ios", destination: "/mx/servicios/cotizador-cnc#instalar", permanent: false },
      // Herramientas CNC: /cam y la página del Generador se juntaron en
      // /herramientas-cnc; el servicio de maquinado ahora vive en Fabricación.
      // Las herramientas de programación (/cam/subir, /cam/lab, /cam/torno) no
      // cambian de dirección.
      { source: "/:locale([a-z]{2})/cam", destination: "/:locale/herramientas-cnc", permanent: true },
      { source: "/cam", destination: "/mx/herramientas-cnc", permanent: true },
      // Diseñar y escanear: los generadores y el escaneo 3D viven juntos en
      // /disenar (un solo espacio de trabajo con el menú de herramientas).
      { source: "/:locale([a-z]{2})/servicios/generador-2d-3d", destination: "/:locale/disenar", permanent: true },
      {
        source:
          "/:locale/servicios/generador-2d-3d/:herramienta(caja-con-juntas|letreros|vectorizador|despiece-muebles|plantillas-empaque|grabado-foto|litofania-relieve|patrones-radiales|convertidor)",
        destination: "/:locale/disenar/:herramienta",
        permanent: true,
      },
      { source: "/:locale([a-z]{2})/taller/escaneos/nuevo", destination: "/:locale/disenar/escanear-pieza", permanent: true },
      // /taller (el cotizador web viejo) se quitó: el cotizador es la app
      // (/cotizador/) y los escaneos pasaron a "Mi cuenta". Direcciones
      // viejas en correos, favoritos y buscadores siguen funcionando.
      { source: "/:locale([a-z]{2})/taller/escaneos", destination: "/:locale/user/escaneos", permanent: true },
      { source: "/:locale([a-z]{2})/taller/escaneos/:id", destination: "/:locale/user/escaneos/:id", permanent: true },
      { source: "/:locale([a-z]{2})/taller", destination: "/:locale/servicios/cotizador-cnc", permanent: true },
      { source: "/:locale([a-z]{2})/taller/:ruta*", destination: "/:locale/servicios/cotizador-cnc", permanent: true },
      { source: "/:locale([a-z]{2})/servicios/laboratorio-cam/:resto*", destination: "/:locale/fabricacion", permanent: true },
      {
        source: "/:locale([a-z]{2})/producto/:handle",
        destination: "/:locale/products/:handle",
        permanent: true,
      },
      {
        source: "/producto/:handle",
        destination: "/mx/products/:handle",
        permanent: true,
      },
    ]
  },

  typescript: { ignoreBuildErrors: true },
  // Alguna dependencia importa módulos de Node con el prefijo nuevo
  // ("node:module"), que el bundler del navegador no entiende. Se le quita el
  // prefijo y luego se marcan esos módulos como ausentes. Tiene que ser este
  // plugin: con resolve.alias no funciona, porque el prefijo se resuelve antes.
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, (r: any) => { r.request = r.request.replace(/^node:/, "") }));
      config.resolve.fallback = { ...config.resolve.fallback, module: false, fs: false, path: false, crypto: false, url: false, worker_threads: false };
    }
    return config;
  }
};

export default nextConfig;
