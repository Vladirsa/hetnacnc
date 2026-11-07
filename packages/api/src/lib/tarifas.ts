// Lista de precios y comisiones de HETNA: una sola fuente para los Términos
// para vendedores (storefront, GET /store/hetna-tarifas) y la portada del
// panel del taller (GET /vendor/hetna-tarifas).
//
// Lo que ya vive en el código se lee de ahí (paquetes de créditos, comisión
// del cobro en línea del cotizador, modelo con IA, escaneo) y la comisión de la
// Academia se lee del motor de comisiones de Mercur, así la lista dice lo que
// de verdad se cobra. Los planes de la App y los espacios de publicidad se
// copian de apps/storefront/src/lib/hetna/app-taller.ts y
// apps/storefront/src/lib/publicidad/precios.ts: si cambias uno, cambia aquí.
import type { MedusaContainer } from "@medusajs/framework/types"
import { MercurModules } from "@mercurjs/types"

import { COMISION_TOPE, comisionPct } from "./cotizacion-liga"
import { CUPO_GB } from "./cloud"
import { PAQUETES } from "./creditos-compra"
import { creditosDe, creditosModeloIa, previewsGratisPorMes } from "../workflows/create-escaneo/steps/create-escaneo"

export type FilaTarifa = { concepto: string; precio: string; nota?: string }
export type GrupoTarifas = { id: string; titulo: string; texto?: string; filas: FilaTarifa[] }

const pesos = (n: number) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n)

const PLANES_APP = [
  { nombre: "Gratis", precio: 0, plan: "gratis" },
  { nombre: "Taller", precio: 299, plan: "taller" },
  { nombre: "Pro", precio: 599, plan: "pro" },
  { nombre: "Industrial", precio: 1199, plan: "industrial" },
]

const PUBLICIDAD: [string, number][] = [
  ["Carrusel principal de la portada", 1500],
  ["Banner de promoción", 900],
  ["Franja en la portada", 700],
  ["Banner en herramientas", 500],
  ["Lateral del foro", 400],
  ["Lateral de categorías", 400],
]

async function comisionAcademia(container: MedusaContainer, code: string): Promise<number | null> {
  try {
    const svc = container.resolve(MercurModules.COMMISSION) as any
    const [r] = await svc.listCommissionRates({ code })
    return r && r.is_enabled !== false ? Number(r.value) : null
  } catch {
    return null
  }
}

async function comisionGlobal(container: MedusaContainer): Promise<number | null> {
  try {
    const svc = container.resolve(MercurModules.COMMISSION) as any
    const [r] = await svc.listCommissionRates({ is_default: true })
    return r && r.is_enabled !== false ? Number(r.value) : null
  } catch {
    return null
  }
}

export async function tarifasHetna(container: MedusaContainer): Promise<{ actualizado: string; grupos: GrupoTarifas[] }> {
  const [cursos, libros, general, maquinas] = await Promise.all([
    comisionAcademia(container, "cursos"),
    comisionAcademia(container, "libros"),
    comisionGlobal(container),
    comisionAcademia(container, "maquinas"),
  ])
  const pct = (n: number | null) => (n === null ? "Según tu panel" : `${n}% por venta`)

  const grupos: GrupoTarifas[] = [
    {
      id: "ventas",
      titulo: "Ventas en la tienda HETNA",
      texto: "Publicar productos es gratis. Sólo se cobra una comisión cuando vendes, sobre el precio del producto (sin envío).",
      filas: [
        { concepto: "Publicar productos", precio: "Gratis" },
        { concepto: "Máquinas CNC", precio: pct(maquinas), nota: "Routers, láser, plasma, tornos e impresoras 3D" },
        { concepto: "Todo lo demás", precio: pct(general), nota: "Fresas, refacciones, materiales, piezas, servicios y archivos" },
        { concepto: "Licitaciones de fabricación", precio: "Sin comisión", nota: "Lo que el cliente te paga es completo para ti; sólo pagas tu plan" },
      ],
    },
    {
      id: "academia",
      titulo: "Academia HETNA: cursos y libros",
      texto: "Publicar es gratis. Sólo se cobra cuando vendes; lo gratis no paga nada.",
      filas: [
        { concepto: "Publicar cursos, libros y PDF", precio: "Gratis" },
        { concepto: "Venta de un curso", precio: pct(cursos), nota: "El resto llega a tu saldo al confirmarse el pago" },
        { concepto: "Venta de un libro o PDF", precio: pct(libros), nota: "Entrega automática al comprador" },
        { concepto: "Cursos y libros gratis", precio: "Sin comisión" },
      ],
    },
    {
      id: "cotizador",
      titulo: "App HETNA Cotizador para talleres",
      texto: "Planes mensuales. Incluyen HetNa Cloud (tu nube de clientes, proyectos y piezas). La comisión aplica sólo a los cobros en línea que hagas con la app, con tope por cobro.",
      filas: PLANES_APP.map((p) => ({
        concepto: `Plan ${p.nombre}`,
        precio: p.precio ? `${pesos(p.precio)} al mes` : "$0",
        nota: `HetNa Cloud ${CUPO_GB[p.plan] ?? 1} GB incluido · cobro en línea: ${comisionPct(p.plan)}% (tope ${pesos(COMISION_TOPE)} por cobro)`,
      })),
    },
    {
      id: "creditos",
      titulo: "Créditos HETNA",
      texto: "Para las herramientas de paga (modelo con IA y escaneo 3D). No caducan.",
      filas: [
        ...PAQUETES.map((p) => ({ concepto: p.titulo, precio: pesos(p.precio) })),
        {
          concepto: "Imagen a 3D con IA",
          precio: `${previewsGratisPorMes()} gratis al mes`,
          nota: `Después, ${creditosModeloIa()} ${creditosModeloIa() === 1 ? "crédito" : "créditos"} por modelo`,
        },
        { concepto: "Escaneo 3D profesional (medidas reales)", precio: `${creditosDe("scan")} créditos por escaneo` },
      ],
    },
    {
      id: "publicidad",
      titulo: "Publicidad en HETNA",
      texto: "Precio por 30 días. Contratando 3 meses, 10% menos.",
      filas: PUBLICIDAD.map(([c, p]) => ({ concepto: c, precio: `${pesos(p)} / 30 días` })),
    },
  ]

  return { actualizado: new Date().toISOString().slice(0, 10), grupos }
}
