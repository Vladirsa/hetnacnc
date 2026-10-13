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

// Envíos HETNA (Skydropx) solo se activa si existen las llaves. Se registra junto al
// proveedor manual para no quitar los envíos que ya usan los talleres.
const envios = process.env.SKYDROPX_CLIENT_ID && process.env.SKYDROPX_CLIENT_SECRET
  ? [
      {
        resolve: '@medusajs/medusa/fulfillment',
        options: {
          providers: [
            { resolve: '@medusajs/medusa/fulfillment-manual', id: 'manual' },
            {
              resolve: './src/modules/skydropx',
              id: 'envios-hetna',
              options: {
                clientId: process.env.SKYDROPX_CLIENT_ID,
                clientSecret: process.env.SKYDROPX_CLIENT_SECRET,
                sandbox: process.env.SKYDROPX_SANDBOX === 'true',
                margenPct: Number(process.env.ENVIO_MARGEN_PCT || 0),
                origenCp: process.env.ENVIO_ORIGEN_CP || '',
                origenEstado: process.env.ENVIO_ORIGEN_ESTADO || '',
                origenMunicipio: process.env.ENVIO_ORIGEN_MUNICIPIO || '',
                origenColonia: process.env.ENVIO_ORIGEN_COLONIA || '',
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
      resolve: './src/modules/learning',
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
    ...pagos,
    ...envios,
  ],
})
