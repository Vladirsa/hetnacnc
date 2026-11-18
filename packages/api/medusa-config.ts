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


// Secreto de sesiones (auditoría de seguridad del 15 nov 2026). Con el valor de
// la plantilla ("supersecret") cualquiera puede fabricar sesiones de
// administrador: pasó en producción (18 nov 2026) porque pm2 tenía guardado el
// valor de ejemplo y el del .env nunca se usó (lo que ya está en el entorno del
// proceso le gana al .env).
//
// Por eso en producción NUNCA se arranca con un secreto débil: si falta, es el
// de ejemplo o es corto, se usa uno al azar para este arranque. El sitio sigue
// funcionando y nadie puede fabricar sesiones; el costo es que las sesiones se
// cierran en cada reinicio hasta que se ponga uno propio (openssl rand -hex 64).
const secretosDeArranque: Record<string, string> = {}
function secretoSesion(nombre: "JWT_SECRET" | "COOKIE_SECRET"): string {
  const v = process.env[nombre]
  if (v && v !== "supersecret" && v.length >= 32) return v
  if (process.env.NODE_ENV !== "production") return v || "supersecret"
  secretosDeArranque[nombre] ??= require("crypto").randomBytes(48).toString("hex")
  console.error(
    `[seguridad] ${nombre} falta, es "supersecret" o es muy corto. Se usa uno al azar para este arranque (las sesiones se cierran en cada reinicio). ` +
      "Revisa con ./scripts/revisar-seguridad.sh de dónde sale el valor: pm2 y .env.production le ganan al .env."
  )
  // Lo que lee el resto del código (firmas de ligas de correo, etc.) también usa el bueno
  process.env[nombre] = secretosDeArranque[nombre]
  return secretosDeArranque[nombre]
}
module.exports = withMercur({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    // Sesiones en Redis (contenedor hetnacnc-redis, solo en 127.0.0.1). Sin esto
    // quedaban en la memoria de la API: cada despliegue cerraba la sesión de
    // todos y la memoria crecía sin parar. Si REDIS_URL no está, vuelve a memoria.
    ...(process.env.REDIS_URL ? { redisUrl: process.env.REDIS_URL, redisPrefix: 'hetna:' } : {}),
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      vendorCors: process.env.VENDOR_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: secretoSesion("JWT_SECRET"),
      cookieSecret: secretoSesion("COOKIE_SECRET"),
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
            // El file-local de Medusa con filtro: rechaza .html, .svg, scripts e
            // instaladores (lo que suben talleres y panel se sirve desde /static
            // en el dominio propio). Ver src/modules/archivo-local-seguro.
            resolve: './src/modules/archivo-local-seguro',
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
