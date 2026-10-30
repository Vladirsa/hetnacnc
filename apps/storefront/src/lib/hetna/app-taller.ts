// La app HETNA CNC para talleres (repo Vladirsa/Cotizador, Flutter).
//  - Web: la sube el workflow "build-web" a https://hetnacnc.com/cotizador/
//  - Android: el workflow "build" publica el APK y el AAB en cada release de GitHub;
//    /app/android (next.config) redirige al APK más reciente.
//  - iPhone: mientras no esté en App Store, se agrega a la pantalla de inicio desde Safari.
// Los planes y precios son los mismos que lib/services/planes.dart de la app.

export const APP_TALLER = {
  web: "/cotizador/",
  // ?registro=1: la app abre directo la pantalla "Registrar mi taller" (si no lo
  // reconoce, muestra el inicio de sesión, que tiene el mismo botón)
  registro: "/cotizador/?registro=1",
  android: "/app/android",
  androidDirecto: "https://github.com/Vladirsa/Cotizador/releases/latest/download/HetnaCNC_arm64.apk",
}

export type PlanApp = { nombre: string; precio: string; nota: string; para: string; destacado?: boolean; puntos: string[] }

export const PLANES_APP: PlanApp[] = [
  {
    nombre: "Gratis",
    precio: "$0",
    nota: "para siempre",
    para: "Para empezar a cotizar hoy.",
    puntos: ["5 cotizaciones al mes", "PDF con marca de agua HETNA CNC", "1 cotización profesional de muestra", "Clientes, productos y avances", "Alertas y seguimiento por WhatsApp", "Calculadora CNC, envíos, tienda y foro", "1 usuario"],
  },
  {
    nombre: "Taller",
    precio: "$299",
    nota: "al mes",
    para: "Para el taller que cotiza todos los días.",
    destacado: true,
    puntos: ["Cotizaciones ilimitadas", "Cotización profesional en PDF con tu logo, sin marca de agua", "Sube DXF, SVG, STL u OBJ: plano con medidas en la cotización", "Simulador de costos con 3 precios", "Costos del taller: fijos, máquinas y mano de obra", "Gastos y compras", "2 usuarios"],
  },
  {
    nombre: "Pro",
    precio: "$599",
    nota: "al mes",
    para: "Para crecer con control y datos.",
    puntos: ["Todo lo del plan Taller", "Inventario", "Marketing: cupones y plantillas de WhatsApp", "Reportes en Excel", "Dashboard de utilidad, gastos y conversión", "5 usuarios"],
  },
  {
    nombre: "Industrial",
    precio: "$1,199",
    nota: "al mes",
    para: "Para empresas con varias máquinas y sistemas.",
    puntos: ["Todo lo del plan Pro", "Facturación electrónica (CFDI)", "Llave de API para conectar tu sistema", "Usuarios ilimitados"],
  },
]
