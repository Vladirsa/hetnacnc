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

// Lo que va aparte de los planes, para decirlo junto a la tabla.
export const NOTA_PLANES = "En el CAM Studio calcular y simular siempre es gratis: el plan cuenta los programas que descargas. Imagen a 3D con IA y el escaneo 3D se pagan con créditos. Las solicitudes de fabricación no cobran comisión: sólo pagas tu plan."

export type PlanApp = { nombre: string; precio: string; nota: string; para: string; destacado?: boolean; puntos: string[] }

export const PLANES_APP: PlanApp[] = [
  {
    nombre: "Gratis",
    precio: "$0",
    nota: "para siempre",
    para: "Para empezar a cotizar hoy.",
    puntos: ["5 cotizaciones al mes", "PDF con marca de agua HETNA CNC", "1 cotización profesional de muestra", "Clientes, productos y avances", "Alertas y seguimiento por WhatsApp", "1 propuesta al mes a solicitudes de clientes", "CAM Studio 2D y 3D (3 ejes): 5 programas al mes", "Cotizador en línea, estudios de diseño 2D y 3D y Calculadora CNC gratis", "Envíos, tienda y foro", "1 usuario"],
  },
  {
    nombre: "Taller",
    precio: "$299",
    nota: "al mes",
    para: "Para el taller que cotiza todos los días.",
    destacado: true,
    puntos: ["Cotizaciones ilimitadas", "Cotización profesional en PDF con tu logo, sin marca de agua", "Sube DXF, SVG, STL u OBJ: medidas, plano y precio desde el archivo", "Simulador de costos con 3 precios", "Costos del taller: fijos, máquinas y mano de obra", "Costo real y utilidad de cada pedido", "Factura electrónica CFDI: 30 al mes", "Mantenimiento de máquinas con avisos", "Gastos y compras", "5 propuestas al mes a solicitudes de clientes", "CAM Studio 2D y 3D (3 ejes): programas sin límite", "Torno CNC: 30 programas al mes", "2 usuarios"],
  },
  {
    nombre: "Pro",
    precio: "$599",
    nota: "al mes",
    para: "Para crecer con control y datos.",
    puntos: ["Todo lo del plan Taller", "Inventario", "Marketing: segmentos de clientes y plantillas de WhatsApp", "Reportes en Excel", "Dashboard de utilidad, gastos y conversión", "Rentabilidad por máquina y por cliente", "Factura electrónica CFDI: 150 al mes", "Marketing en piloto automático", "Propuestas sin límite a solicitudes de clientes", "Torno CNC sin límite, con grabado 2D y 3D sobre la pieza", "5 usuarios"],
  },
  {
    nombre: "Industrial",
    precio: "$1,199",
    nota: "al mes",
    para: "Para empresas con varias máquinas y sistemas.",
    puntos: ["Todo lo del plan Pro", "Factura electrónica CFDI sin límite", "CAM de 4 y 5 ejes: todo el CAM Studio sin límite", "Llave de API para conectar tu sistema (próximamente)", "Usuarios ilimitados"],
  },
]
