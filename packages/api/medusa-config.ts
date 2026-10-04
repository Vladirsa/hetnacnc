import { loadEnv } from '@medusajs/framework/utils'
import { withMercur } from '@mercurjs/core'
import fs from 'fs'
import path from 'path'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const dashboardAppDir = (name: string) => {
  const bundled = path.join(__dirname, 'dashboards', name)
  return fs.existsSync(bundled) ? bundled : path.join(__dirname, `../../apps/${name}`)
}

// Mercado Pago solo se activa si existe el token; así el servidor arranca aunque falte
const pagos = process.env.MERCADOPAGO_ACCESS_TOKEN
  ? [
      {
        resolve: '@medusajs/medusa/payment',
        options: {
          providers: [
            {
              resolve: './src/modules/mercadopago',
              id: 'mercadopago',
              options: {
                accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
                storefrontUrl: process.env.STOREFRONT_URL || 'https://hetnacnc.com',
                statementDescriptor: 'HETNA CNC',
              },
            },
          ],
        },
      },
    ]
  : []

module.exports = withMercur({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      vendorCors: process.env.VENDOR_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET || "supersecret",
      cookieSecret: process.env.COOKIE_SECRET || "supersecret",
    }
  },
  featureFlags: {
    seller_registration: true
  },
  modules: [
    {
      resolve: "@medusajs/medusa/auth",
      options: {
        providers: [
          {
            resolve: "@medusajs/medusa/auth-emailpass",
            id: "emailpass",
            options: {
              autoRegister: true,
            },
          },
        ],
      },
    },
    {
      resolve: '@mercurjs/core/modules/admin-ui',
      options: {
        appDir: dashboardAppDir('admin'),
        path: '/dashboard',
      }
    },
    {
      resolve: '@mercurjs/core/modules/vendor-ui',
      options: {
        appDir: dashboardAppDir('vendor'),
        path: '/seller',
      }
    },
    {
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/file-local',
            id: 'local',
            options: {
              backend_url: process.env.FILE_BACKEND_URL || 'http://localhost:9000/static',
            },
          },
        ],
      },
    },
    // Portadas del carrusel principal (panel /dashboard/portadas)
    {
      resolve: './src/modules/portadas',
    },
    ...pagos,
  ],
})
