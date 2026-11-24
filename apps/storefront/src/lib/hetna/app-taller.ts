// La app HETNA CNC para talleres (repo Vladirsa/Cotizador, Flutter).
//  - Web: la sube el workflow "build-web" a https://hetnacnc.com/cotizador/
//  - Android: el workflow "build" publica el APK y el AAB en cada release de GitHub;
//    /app/android (next.config) redirige al APK más reciente.
//  - iPhone: mientras no esté en App Store, se agrega a la pantalla de inicio desde Safari.
// Los planes y precios son los mismos que lib/services/planes.dart de la app.

export const APP_TALLER = {
  web: "/cotizador/",
  // Una sola cuenta: el taller nuevo se registra con la cuenta de la tienda y de
  // ahí entra al Cotizador (activar con 14 días de prueba), sin otra contraseña.
  registro: "/mx/register?volver=%2Fapi%2Fapp%2Fentrar-cotizador",
  android: "/app/android",
  androidDirecto: "https://github.com/Vladirsa/Cotizador/releases/latest/download/HetnaCNC_arm64.apk",
}

// ── Planes del Cotizador: ÚNICA fuente ────────────────────────────────
// Auditoría del 20 nov 2026: todas las páginas que hablan de los planes
// (landing del Cotizador, calculadora, panel del taller, cuenta, tienda)
// leen de aquí. Cada función tiene un estado inequívoco:
//   disponible    probada y funcionando (Vlado, 20 nov 2026)
//   beta          funciona, pero todavía en pruebas
//   proximamente  se anuncia, pero NO se vende como incluida
// y en cada plan vale:  false = no incluida · true = incluida · "texto" = el límite.
// No se pasa nada a "disponible" sin haber pasado sus pruebas de aceptación.
// La app (repo Vladirsa/Cotizador, lib/services/planes.dart) debe decir lo mismo.

export type EstadoFuncion = "disponible" | "beta" | "proximamente"
export const ETIQUETA_ESTADO: Record<EstadoFuncion, string> = { disponible: "Disponible", beta: "Beta", proximamente: "Próximamente" }

export const LIMITE_COTIZACIONES_GRATIS = 5
export const DIAS_PRUEBA = 14

type Celda = boolean | string
export type FuncionPlan = { nombre: string; estado: EstadoFuncion; planes: [Celda, Celda, Celda, Celda] }

// Orden de columnas: Gratis, Taller, Pro, Industrial
export const FUNCIONES_PLANES: FuncionPlan[] = [
  { nombre: "Cotizaciones", estado: "disponible", planes: [`${LIMITE_COTIZACIONES_GRATIS} al mes`, "Sin límite", "Sin límite", "Sin límite"] },
  { nombre: "PDF de la cotización", estado: "disponible", planes: ["Con marca de agua HETNA CNC", "Con tu logo, sin marca de agua", "Con tu logo, sin marca de agua", "Con tu logo, sin marca de agua"] },
  // Configuración → Diseño de tu cotización (Cotizador, PR #62 y #65)
  { nombre: "Plantillas de cotización", estado: "disponible", planes: ["2: ticket para WhatsApp y clásica", "4, con QR para aceptar en línea", "Las 10: visual, por volumen, bilingüe, corporativa…", "Las 10: visual, por volumen, bilingüe, corporativa…"] },
  { nombre: "Cotización profesional (formato internacional)", estado: "disponible", planes: ["1 de muestra", "Sin límite", "Sin límite", "Sin límite"] },
  { nombre: "Sube DXF, SVG, STL u OBJ: medidas, plano y precio desde el archivo", estado: "disponible", planes: ["En la cotización de muestra", true, true, true] },
  { nombre: "Clientes, productos y avances", estado: "disponible", planes: [true, true, true, true] },
  { nombre: "Alertas y seguimiento por WhatsApp", estado: "disponible", planes: [true, true, true, true] },
  { nombre: "Simulador de costos", estado: "disponible", planes: [false, true, true, true] },
  { nombre: "Costos del taller: fijos, máquinas y mano de obra", estado: "disponible", planes: [false, true, true, true] },
  { nombre: "Costo real y utilidad de cada pedido", estado: "disponible", planes: [false, true, true, true] },
  { nombre: "Mantenimiento de máquinas con avisos", estado: "disponible", planes: [false, true, true, true] },
  { nombre: "Gastos y compras", estado: "disponible", planes: [false, true, true, true] },
  // Pospuesta a Cotizador 3.0 (falta el CSD): no se vende como incluida
  { nombre: "Factura electrónica CFDI", estado: "proximamente", planes: [false, "30 al mes", "150 al mes", "Sin límite"] },
  { nombre: "Inventario", estado: "disponible", planes: [false, false, true, true] },
  { nombre: "Marketing: segmentos de clientes y plantillas de WhatsApp", estado: "disponible", planes: [false, false, true, true] },
  { nombre: "Marketing en piloto automático", estado: "disponible", planes: [false, false, true, true] },
  { nombre: "Reportes en Excel", estado: "disponible", planes: [false, false, true, true] },
  { nombre: "Dashboard de utilidad, gastos y conversión", estado: "disponible", planes: [false, false, true, true] },
  { nombre: "Rentabilidad por máquina y por cliente", estado: "disponible", planes: [false, false, true, true] },
  { nombre: "Propuestas a solicitudes de clientes", estado: "disponible", planes: ["1 al mes", "5 al mes", "Sin límite", "Sin límite"] },
  { nombre: "CAM Studio 2D y 3D (3 ejes)", estado: "disponible", planes: ["5 programas al mes", "Sin límite", "Sin límite", "Sin límite"] },
  { nombre: "Torno CNC", estado: "disponible", planes: [false, "30 programas al mes", "Sin límite, con grabado 2D y 3D sobre la pieza", "Sin límite, con grabado 2D y 3D sobre la pieza"] },
  { nombre: "CAM de 4 y 5 ejes", estado: "disponible", planes: [false, false, false, "Sin límite"] },
  { nombre: "Llave de API para conectar tu sistema", estado: "proximamente", planes: [false, false, false, true] },
  { nombre: "Usuarios", estado: "disponible", planes: ["1", "2", "5", "Sin límite"] },
]

// Lo que va aparte de los planes, para decirlo junto a la tabla.
export const NOTA_PLANES = "En el CAM Studio calcular y simular siempre es gratis: el plan cuenta los programas que descargas. Imagen a 3D con IA y el escaneo 3D se pagan con créditos. Las solicitudes de fabricación no cobran comisión: sólo pagas tu plan."

export type PuntoPlan = { texto: string; estado: EstadoFuncion }
export type PlanApp = { clave: "gratis" | "taller" | "pro" | "industrial"; nombre: string; precio: string; nota: string; para: string; destacado?: boolean; puntos: PuntoPlan[] }

const BASE_PLANES: Omit<PlanApp, "puntos">[] = [
  { clave: "gratis", nombre: "Gratis", precio: "$0", nota: "para siempre", para: "Para empezar a cotizar hoy." },
  { clave: "taller", nombre: "Taller", precio: "$299", nota: "al mes", para: "Para el taller que cotiza todos los días.", destacado: true },
  { clave: "pro", nombre: "Pro", precio: "$599", nota: "al mes", para: "Para crecer con control y datos." },
  { clave: "industrial", nombre: "Industrial", precio: "$1,199", nota: "al mes", para: "Para empresas con varias máquinas y sistemas." },
]

const textoPunto = (f: FuncionPlan, c: Celda) => (c === true ? f.nombre : `${f.nombre}: ${c}`)

/** Las tarjetas: el plan Gratis lista todo lo que trae; los demás, "Todo lo del plan X" y lo que cambia. */
export const PLANES_APP: PlanApp[] = BASE_PLANES.map((b, i) => {
  const puntos: PuntoPlan[] = i > 0 ? [{ texto: `Todo lo del plan ${BASE_PLANES[i - 1].nombre}`, estado: "disponible" }] : []
  for (const f of FUNCIONES_PLANES) {
    const c = f.planes[i]
    if (c === false) continue
    if (i > 0 && c === f.planes[i - 1]) continue
    puntos.push({ texto: textoPunto(f, c), estado: f.estado })
  }
  return { ...b, puntos }
})

/** Precio por clave de plan ("$299"), para el panel del taller y la cuenta. */
export const PRECIO_PLAN: Record<string, string> = Object.fromEntries(BASE_PLANES.map((p) => [p.clave, p.precio]))

