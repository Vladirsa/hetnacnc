import { metaEnIdioma } from "@/i18n/servidor"
import { TS } from "@/i18n/TS"
import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { AccionesOrden } from "@/components/hetna/proveedor/AccionesOrden"
import { fechaSegura } from "@/lib/helpers/fecha-segura"
import { miPanelProveedor, type OrdenProveedor } from "@/lib/proveedor/acciones"

// Panel de proveedores: las órdenes de compra que los talleres le mandan desde
// la app del Cotizador. El proveedor entra con el correo que el taller le dio
// de alta (ya confirmado). Sólo ve sus órdenes; nada del inventario del taller.
export const dynamic = "force-dynamic"
const metadataEs: Metadata = { title: "Proveedores · Mis órdenes de compra", robots: { index: false, follow: false } }

// Las fechas de entrega son de calendario (sin hora): se leen en UTC para que no se recorran un día.
const DIA = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" })
const MOMENTO = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" })
const PESOS = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" })
const cant = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2))

function Estado({ o }: { o: OrdenProveedor }) {
  const [texto, color] =
    o.estado === "recibida" ? ["Recibida", "bg-[#E7F6EE] text-[#0F7A4A]"]
    : o.estado === "cancelada" ? ["Cancelada", "bg-[#F1F0EC] text-[#6B6A63]"]
    : o.marcada_enviada_en ? ["Enviada por ti", "bg-[#EEF1F6] text-[#0E2A5C]"]
    : o.confirmada_en ? ["Confirmada", "bg-[#EEF1F6] text-[#0E2A5C]"]
    : o.estado === "parcial" ? ["Recibida en parte", "bg-[#FFF1E5] text-[#B34D07]"]
    : ["Por confirmar", "bg-[#FFF1E5] text-[#B34D07]"]
  return <span className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${color}`}><TS>{texto}</TS></span>
}

function Orden({ o }: { o: OrdenProveedor }) {
  return (
    <article className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[12px] font-bold text-[#6B6A63]"><TS>{o.folio}</TS></span>
          <span className="ml-2 text-[16px] font-semibold text-[#1B1B18]"><TS>{o.taller}</TS></span>
        </div>
        <Estado o={o} />
      </header>
      <p className="m-0 mt-1 text-[13px] text-[#6B6A63]">
        {o.enviada_en && <><TS>Te la mandaron el</TS> {fechaSegura(MOMENTO, o.enviada_en)}</>}
        {o.fecha_entrega && <> <TS>· La necesitan el</TS> {fechaSegura(DIA, o.fecha_entrega)}</>}
      </p>

      <table className="mt-3 w-full border-collapse text-[14px]">
        <thead>
          <tr className="text-left text-[12px] uppercase tracking-wide text-[#6B6A63]">
            <th className="py-1 pr-2 font-semibold"><TS>Cantidad</TS></th>
            <th className="py-1 pr-2 font-semibold"><TS>Concepto</TS></th>
            <th className="py-1 text-right font-semibold"><TS>Precio</TS></th>
          </tr>
        </thead>
        <tbody>
          {o.renglones.map((r, i) => (
            <tr key={i} className="border-t border-[#F1F0EC]">
              <td className="py-1.5 pr-2 align-top whitespace-nowrap">
                {cant(r.cantidad)} <TS>{r.unidad || ""}</TS>
                {r.recibido > 0 && <span className="block text-[12px] text-[#0F7A4A]"><TS>recibido</TS> {cant(r.recibido)}</span>}
              </td>
              <td className="py-1.5 pr-2 align-top"><TS>{r.descripcion}</TS></td>
              <td className="py-1.5 text-right align-top whitespace-nowrap"><TS>{r.costo_unitario > 0 ? `${PESOS.format(r.costo_unitario)} c/u` : "—"}</TS></td>
            </tr>
          ))}
        </tbody>
      </table>
      {o.total > 0 && <p className="m-0 mt-2 text-right text-[15px] font-bold text-[#1B1B18]"><TS>Total</TS> {PESOS.format(o.total)}</p>}
      {o.notas && <p className="m-0 mt-2 rounded-[10px] bg-[#FAF9F6] px-3 py-2 text-[13.5px] text-[#40403A]"><TS>Nota del taller:</TS> <TS>{o.notas}</TS></p>}

      {(o.confirmada_en || o.marcada_enviada_en) && (
        <p className="m-0 mt-3 text-[13.5px] text-[#0E2A5C]">
          {o.fecha_compromiso && <><TS>Te comprometiste a entregar el</TS> {fechaSegura(DIA, o.fecha_compromiso)}. </>}
          {o.marcada_enviada_en && <><TS>Marcaste que la enviaste el</TS> {fechaSegura(MOMENTO, o.marcada_enviada_en)}.</>}
          {o.nota_proveedor && <span className="block text-[#40403A]"><TS>Tu nota:</TS> <TS>{o.nota_proveedor}</TS></span>}
        </p>
      )}

      <AccionesOrden
        id={o.id}
        puedeConfirmar={o.puede_confirmar}
        puedeMarcarEnviada={o.puede_marcar_enviada}
        fechaPedida={o.fecha_entrega}
        fechaCompromiso={o.fecha_compromiso}
        nota={o.nota_proveedor}
      />
    </article>
  )
}

function Caja({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <main className="container">
      <div className="mx-auto max-w-[560px] py-16 text-center">
        <h1 className="text-[24px] font-bold text-[#1B1B18]"><TS>{titulo}</TS></h1>
        <div className="mt-3 text-[15px] leading-relaxed text-[#40403A]">{children}</div>
      </div>
    </main>
  )
}

export default async function ProveedorPage() {
  const r = await miPanelProveedor()
  if (!r.ok && r.noAutenticado) {
    return (
      <Caja titulo="Panel de proveedores">
        <p><TS>Entra con el correo que te dio de alta el taller para ver sus órdenes de compra.</TS></p>
        <LocalizedClientLink href="/login" className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white">
          <TS>Iniciar sesión</TS>
        </LocalizedClientLink>
        <p className="mt-4 text-[13.5px]"><TS>¿No tienes cuenta?</TS> <LocalizedClientLink href="/register" className="font-semibold text-[#B34D07] underline"><TS>Créala con ese mismo correo</TS></LocalizedClientLink>.</p>
      </Caja>
    )
  }
  if (!r.ok) return <Caja titulo="Panel de proveedores"><p className="rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[#9B1C1C]"><TS>{r.mensaje}</TS></p></Caja>
  const d = r.datos
  if (!d.correo_confirmado) {
    return (
      <Caja titulo="Confirma tu correo">
        <p><TS>Para ver órdenes de compra necesitas confirmar tu correo</TS><TS>{d.correo ? ` (${d.correo})` : ""}</TS><TS>. Abre la liga que te mandamos al crear tu cuenta.</TS></p>
      </Caja>
    )
  }
  if (!d.es_proveedor) {
    return (
      <Caja titulo="Todavía no tienes órdenes">
        <p><TS>Ningún taller ha dado de alta el correo</TS> <b><TS>{d.correo}</TS></b> <TS>como proveedor. Pídele al taller que lo ponga tal cual en su lista de proveedores de la app HETNA Cotizador.</TS></p>
      </Caja>
    )
  }
  const abiertas = d.ordenes.filter((o) => o.estado === "enviada" || o.estado === "parcial")
  const cerradas = d.ordenes.filter((o) => o.estado === "recibida" || o.estado === "cancelada")
  return (
    <main className="container">
      <div className="mx-auto max-w-[900px] py-10">
        <p className="m-0 text-[12px] font-bold uppercase tracking-[.2em] text-[#C2560A]"><TS>Proveedores</TS></p>
        <h1 className="m-0 mt-1 text-[30px] font-bold leading-tight text-[#0E2A5C]"><TS>Órdenes de compra</TS></h1>
        <p className="mt-2 max-w-[700px] text-[15.5px] leading-relaxed text-[#40403A]">
          <TS>Las órdenes que te mandan los talleres desde HETNA Cotizador. Confirma la fecha en que entregas y avisa cuando salgan: el taller lo ve en su app.</TS>
        </p>
        {!d.acciones_activas && (
          <p className="mt-3 rounded-[10px] border border-[#F2D9C4] bg-[#FFF8F1] px-4 py-3 text-[13.5px] text-[#6B4A2B]"><TS>Por ahora sólo puedes consultar las órdenes; las confirmaciones en línea se activan pronto.</TS></p>
        )}
        <section className="mt-8">
          <h2 className="text-[19px] font-bold text-[#1B1B18]"><TS>Por surtir (</TS><TS>{abiertas.length}</TS>)</h2>
          {abiertas.length === 0 && <p className="text-[14.5px] text-[#6B6A63]"><TS>No tienes órdenes pendientes.</TS></p>}
          <div className="mt-3 flex flex-col gap-3">{abiertas.map((o) => <Orden key={o.id} o={o} />)}</div>
        </section>
        {cerradas.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[19px] font-bold text-[#1B1B18]"><TS>Historial</TS></h2>
            <div className="mt-3 flex flex-col gap-3">{cerradas.map((o) => <Orden key={o.id} o={o} />)}</div>
          </section>
        )}
      </div>
    </main>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata() {
  return metaEnIdioma(metadataEs)
}
