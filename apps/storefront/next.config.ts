import type { NextConfig } from 'next';

const politicaCSP = [
  "default-src 'self'",
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

const encabezadosSeguridad = [
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Content-Security-Policy-Report-Only', value: politicaCSP }
];

const nextConfig: NextConfig = {
  trailingSlash: false,
  reactStrictMode: true,
  poweredByHeader: false,
  swcMinify: true,
  compress: true,
  productionBrowserSourceMaps: false,
  onDemandEntries: {
    maxInactiveAge: 60 * 60 * 1000,
    pagesBufferLength: 5,
  },
  async headers() {
    return [
      { source: '/:path*', headers: encabezadosSeguridad },
      { source: '/public/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] }
    ];
  },
  experimental: { optimizePackageImports: ["@medusajs/ui", "lodash"] },
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
  typescript: { ignoreBuildErrors: true },
  webpack: (config, { isServer, webpack }) => {
    if (!isServer) {
      config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^node:/, (r: any) => { r.request = r.request.replace(/^node:/, "") }));
      config.resolve.fallback = { ...config.resolve.fallback, module: false, fs: false, path: false, crypto: false, url: false, worker_threads: false };
    }
    return config;
  }
};

export default nextConfig;
