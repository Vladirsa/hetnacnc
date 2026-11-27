// HETNA Panel → App → Latinoamérica: pre-registros por país (Fase 5) para
// decidir qué país abrir primero.
import { TS } from "@/i18n/TS"
import { SubApp } from "@/components/hetna/panel/SubApp"
import { Etiqueta, Kpi, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { adminFetch, exigirPagina, hace } from "@/lib/panel/sesion"

type Datos = {
  paises: Record<string, { nombre: string; moneda: string; bandera: string }>
  conteo: Record<string, { talleres: number; clientes: number }>
  ultimos: { id: number; pais: string; tipo: string; nombre: string; empresa: string | null; correo: string; telefono: string | null; ciudad: string | null; maquinas: string | null; mensaje: string | null; created_at: string }[]
}

export default async function PanelLatam({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  await exigirPagina(locale, "cotizador")
  let d: Datos | null = null, error = ""
  try { d = await adminFetch<Datos>("/admin/hetna-latam") } catch (e) { error = (e as Error).message }
  const filas = d ? Object.entries(d.paises).map(([k, p]) => ({ k, p, c: d!.conteo[k] || { talleres: 0, clientes: 0 } })).sort((a, b) => b.c.talleres + b.c.clientes - (a.c.talleres + a.c.clientes)) : []
  const tot = filas.reduce((a, f) => ({ t: a.t + f.c.talleres, c: a.c + f.c.clientes }), { t: 0, c: 0 })
  return (
    <div className="grid gap-4">
      <SubApp locale={locale} actual="latam" />
      {error && <Vacio><TS>No pude leer los registros:</TS> {error}</Vacio>}
      {d && (
        <>
          <Tarjeta>
            <Titulo extra={<a href={`/${locale}/latinoamerica`} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[#C2560A]"><TS>Página pública →</TS></a>}><TS>Latinoamérica: pre-registros</TS></Titulo>
            <div className="grid grid-cols-2 gap-2">
              <Kpi etiqueta="Talleres fundadores" valor={String(tot.t)} />
              <Kpi etiqueta="Clientes" valor={String(tot.c)} />
            </div>
            <ul className="mt-3 divide-y divide-[#EFEDE6]">
              {filas.map(({ k, p, c }) => (
                <li key={k} className="flex items-center justify-between py-2 text-[13px]">
                  <span className="font-semibold">{p.bandera} {p.nombre} <span className="font-normal text-[#6B675C]">({p.moneda})</span></span>
                  <span className="text-[#40403A]">{c.talleres} <TS>talleres ·</TS> {c.clientes} <TS>clientes</TS></span>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-[#6B675C]"><TS>Para abrir un país: crear su región en la tienda (moneda, impuestos y envíos) y avisar a sus registrados.</TS></p>
          </Tarjeta>
          <Tarjeta>
            <Titulo><TS>Últimos registros</TS></Titulo>
            {d.ultimos.length === 0 && <Vacio><TS>Todavía nadie se ha registrado.</TS></Vacio>}
            <ul className="divide-y divide-[#EFEDE6]">
              {d.ultimos.map((r) => (
                <li key={r.id} className="py-2.5 text-[13px]">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-bold">{d!.paises[r.pais]?.bandera} {r.empresa || r.nombre}</span>
                    <Etiqueta color={r.tipo === "taller" ? "verde" : "azul"}>{r.tipo}</Etiqueta>
                  </div>
                  <p className="text-[12px] text-[#40403A]">{[r.nombre, r.ciudad, r.correo, r.telefono].filter(Boolean).join(" · ")}</p>
                  {r.maquinas && <p className="text-[12px] text-[#6B675C]">{r.maquinas}</p>}
                  {r.mensaje && <p className="text-[12px] italic text-[#6B675C]">“<TS>{r.mensaje}</TS>”</p>}
                  <p className="text-[11px] text-[#9A968B]">{hace(r.created_at)}</p>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </>
      )}
    </div>
  )
}
