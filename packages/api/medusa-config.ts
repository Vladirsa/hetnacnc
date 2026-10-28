import { loadEnv } from '@medusajs/framework/utils'
import { withMercur } from '@mercurjs/core'
import fs from 'fs'
import path from 'path'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

const dashboardAppDir = (name: string) => {
  const bundled = path.join(__dirname, 'dashboards', name)
  return fs.existsSync(bundled) ? bundled : path.join(__dirname, `../../apps/${name}`)
}

// Cada forma de pago solo se activa si existen sus llaves; así el servidor arranca aunque falten.
// Todas van dentro de UN solo módulo de pagos (Medusa no admite dos).
const proveedoresPago: Record<string, unknown>[] = []

if (process.env.MERCADOPAGO_ACCESS_TOKEN) {
  proveedoresPago.push({
    resolve: './src/modules/mercadopago',
    id: 'mercadopago',
    options: {
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
      storefrontUrl: process.env.STOREFRONT_URL || 'https://hetnacnc.com',
      statementDescriptor: 'HETNA CNC',
    },
  })
}

if (process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET) {
  proveedoresPago.push({
    resolve: './src/modules/paypal',
    id: 'paypal',
    options: {
      clientId: process.env.PAYPAL_CLIENT_ID,
      clientSecret: process.env.PAYPAL_CLIENT_SECRET,
      // PAYPAL_SANDBOX=true usa el modo de pruebas de PayPal (sin dinero real)
      sandbox: process.env.PAYPAL_SANDBOX === 'true',
      storefrontUrl: process.env.STOREFRONT_URL || 'https://hetnacnc.com',
      marca: 'HETNA CNC',
    },
  })
}

const pagos = proveedoresPago.length
  ? [
      {
        resolve: '@medusajs/medusa/payment',
        options: { providers: proveedoresPago },
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
    seller_registration: true,
    // Los productos y ediciones de los talleres se publican sin aprobación del
    // administrador (decisión de HETNA, 28 oct 2026). La confianza se da con la
    // verificación del taller (INE y fotos), no revisando cada producto.
    product_request: false,
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
      resolve: './src/modules/course',
    },
    {
      resolve: './src/modules/enrollment',
    },
    {
      resolve: './src/modules/credit',
    },
    {
      resolve: './src/modules/cotizador',
    },
    {
      resolve: './src/modules/escaneo',
    },
    {
      // Laboratorio CAM 3/4/5 ejes: trabajos que el cliente manda desde /cam/lab
      resolve: './src/modules/cam',
    },
    {
      // Conteo de vistas de ficha, agregado por día. Es de dónde sale "qué
      // productos visitan" en el tablero del taller: GA4 y el Pixel viven en
      // el navegador y no se pueden desglosar por vendedor.
      resolve: './src/modules/vistas',
    },
    {
      // Metas de venta que cada taller se pone para el mes, en el tablero.
      resolve: './src/modules/tablero',
    },
    {
      // Archivos gratis que baja cada cliente: de aquí sale el cupo semanal.
      resolve: './src/modules/descargas',
    },
    {
      // Verificación de talleres: INE y fotos del taller (archivos privados)
      resolve: './src/modules/verificacion',
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
