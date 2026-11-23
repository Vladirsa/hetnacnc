import type { Metadata } from "next"

import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { AccionesOrden } from "@/components/hetna/proveedor/AccionesOrden"
import { fechaSegura } from "@/lib/helpers/fecha-segura"
import { miPanelProveedor, type OrdenProveedor } from "@/lib/proveedor/acciones"

// Panel de proveedores: las órdenes de compra que los talleres le mandan desde
// la app del Cotizador. El proveedor entra con el correo que el taller le dio
// de alta (ya confirmado). Sólo ve sus órdenes; nada del inventario del taller.
export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Proveedores · Mis órdenes de compra", robots: { index: false, follow: false } }

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
  return <span className={`rounded-full px-2.5 py-1 text-[13px] font-semibold ${color}`}>{texto}</span>
}

function Orden({ o }: { o: OrdenProveedor }) {
  return (
    <article className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <span className="text-[12px] font-bold text-[#6B6A63]">{o.folio}</span>
          <span className="ml-2 text-[16px] font-semibold text-[#1B1B18]">{o.taller}</span>
        </div>
        <Estado o={o} />
      </header>
      <p className="m-0 mt-1 text-[13px] text-[#6B6A63]">
        {o.enviada_en && <>Te la mandaron el {fechaSegura(MOMENTO, o.enviada_en)}</>}
        {o.fecha_entrega && <> · La necesitan el {fechaSegura(DIA, o.fecha_entrega)}</>}
      </p>

      <table className="mt-3 w-full border-collapse text-[14px]">
        <thead>
          <tr className="text-left text-[12px] uppercase tracking-wide text-[#6B6A63]">
            <th className="py-1 pr-2 font-semibold">Cantidad</th>
            <th className="py-1 pr-2 font-semibold">Concepto</th>
            <th className="py-1 text-right font-semibold">Precio</th>
          </tr>
        </thead>
        <tbody>
          {o.renglones.map((r, i) => (
            <tr key={i} className="border-t border-[#F1F0EC]">
              <td className="py-1.5 pr-2 align-top whitespace-nowrap">
                {cant(r.cantidad)} {r.unidad || ""}
                {r.recibido > 0 && <span className="block text-[12px] text-[#0F7A4A]">recibido {cant(r.recibido)}</span>}
              </td>
              <td className="py-1.5 pr-2 align-top">{r.descripcion}</td>
              <td className="py-1.5 text-right align-top whitespace-nowrap">{r.costo_unitario > 0 ? `${PESOS.format(r.costo_unitario)} c/u` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {o.total > 0 && <p className="m-0 mt-2 text-right text-[15px] font-bold text-[#1B1B18]">Total {PESOS.format(o.total)}</p>}
      {o.notas && <p className="m-0 mt-2 rounded-[10px] bg-[#FAF9F6] px-3 py-2 text-[13.5px] text-[#40403A]">Nota del taller: {o.notas}</p>}

      {(o.confirmada_en || o.marcada_enviada_en) && (
        <p className="m-0 mt-3 text-[13.5px] text-[#0E2A5C]">
          {o.fecha_compromiso && <>Te comprometiste a entregar el {fechaSegura(DIA, o.fecha_compromiso)}. </>}
          {o.marcada_enviada_en && <>Marcaste que la enviaste el {fechaSegura(MOMENTO, o.marcada_enviada_en)}.</>}
          {o.nota_proveedor && <span className="block text-[#40403A]">Tu nota: {o.nota_proveedor}</span>}
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
        <h1 className="text-[24px] font-bold text-[#1B1B18]">{titulo}</h1>
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
        <p>Entra con el correo que te dio de alta el taller para ver sus órdenes de compra.</p>
        <LocalizedClientLink href="/login" className="mt-6 inline-block rounded-[10px] bg-[#C2560A] px-6 py-3 text-[15px] font-semibold text-white">
          Iniciar sesión
        </LocalizedClientLink>
        <p className="mt-4 text-[13.5px]">¿No tienes cuenta? <LocalizedClientLink href="/register" className="font-semibold text-[#B34D07] underline">Créala con ese mismo correo</LocalizedClientLink>.</p>
      </Caja>
    )
  }
  if (!r.ok) return <Caja titulo="Panel de proveedores"><p className="rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[#9B1C1C]">{r.mensaje}</p></Caja>
  const d = r.datos
  if (!d.correo_confirmado) {
    return (
      <Caja titulo="Confirma tu correo">
        <p>Para ver órdenes de compra necesitas confirmar tu correo{d.correo ? ` (${d.correo})` : ""}. Abre la liga que te mandamos al crear tu cuenta.</p>
      </Caja>
    )
  }
  if (!d.es_proveedor) {
    return (
      <Caja titulo="Todavía no tienes órdenes">
        <p>Ningún taller ha dado de alta el correo <b>{d.correo}</b> como proveedor. Pídele al taller que lo ponga tal cual en su lista de proveedores de la app HETNA Cotizador.</p>
      </Caja>
    )
  }
  const abiertas = d.ordenes.filter((o) => o.estado === "enviada" || o.estado === "parcial")
  const cerradas = d.ordenes.filter((o) => o.estado === "recibida" || o.estado === "cancelada")
  return (
    <main className="container">
      <div className="mx-auto max-w-[900px] py-10">
        <p className="m-0 text-[12px] font-bold uppercase tracking-[.2em] text-[#C2560A]">Proveedores</p>
        <h1 className="m-0 mt-1 text-[30px] font-bold leading-tight text-[#0E2A5C]">Órdenes de compra</h1>
        <p className="mt-2 max-w-[700px] text-[15.5px] leading-relaxed text-[#40403A]">
          Las órdenes que te mandan los talleres desde HETNA Cotizador. Confirma la fecha en que entregas y avisa cuando salgan: el taller lo ve en su app.
        </p>
        {!d.acciones_activas && (
          <p className="mt-3 rounded-[10px] border border-[#F2D9C4] bg-[#FFF8F1] px-4 py-3 text-[13.5px] text-[#6B4A2B]">Por ahora sólo puedes consultar las órdenes; las confirmaciones en línea se activan pronto.</p>
        )}
        <section className="mt-8">
          <h2 className="text-[19px] font-bold text-[#1B1B18]">Por surtir ({abiertas.length})</h2>
          {abiertas.length === 0 && <p className="text-[14.5px] text-[#6B6A63]">No tienes órdenes pendientes.</p>}
          <div className="mt-3 flex flex-col gap-3">{abiertas.map((o) => <Orden key={o.id} o={o} />)}</div>
        </section>
        {cerradas.length > 0 && (
          <section className="mt-10">
            <h2 className="text-[19px] font-bold text-[#1B1B18]">Historial</h2>
            <div className="mt-3 flex flex-col gap-3">{cerradas.map((o) => <Orden key={o.id} o={o} />)}</div>
          </section>
        )}
      </div>
    </main>
  )
}
