// HETNA Panel → App → Referidos y distribuidores.
//   · Códigos de distribuidor (codigos_promo): crear, pausar, ver usos y su página.
//   · Meses a favor: talleres que pagan y ganaron meses por invitar; se aplican
//     a mano en su cobro y aquí se marcan.
//   · Solicitudes de distribuidor (formulario de /distribuidores): crear su
//     código y mandárselo por correo, o descartarla.
//   · Referidos: quién invita más y los últimos que llegaron.
import { AtenderSolicitud, BotonCodigo, MesAplicado, NuevoCodigo } from "@/components/hetna/panel/Distribuidores"
import { SubApp } from "@/components/hetna/panel/SubApp"
import { Etiqueta, Kpi, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { puedeActuar } from "@/lib/panel/roles"
import { adminFetch, exigirPagina, fechaCorta, hace } from "@/lib/panel/sesion"

type Codigo = { codigo: string; nombre: string; dias_regalo: number; activo: boolean; usos: number; max_usos: number | null; vence: string | null; created_at: string | null }
type Solicitud = { id: number; empresa: string; contacto: string; correo: string; telefono: string | null; ciudad: string | null; maquinas: string | null; ventas_mes: string | null; mensaje: string | null; estado: string; codigo: string | null; created_at: string }
type Datos = {
  instalado: boolean
  solicitudes?: Solicitud[]
  codigos: Codigo[]
  meses_a_favor: { id: string; nombre: string; correo: string | null; telefono: string | null; plan: string; meses: number }[]
  referidos: {
    por_taller: { id: string; nombre: string; invitados: number; completaron: number }[]
    por_distribuidor: number
    total: number
    completaron: number
    ultimos: { nombre: string; codigo: string; fecha: string; de: string; completo: boolean }[]
  }
}

export default async function PanelDistribuidores({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const yo = await exigirPagina(locale, "cotizador")
  const actuar = puedeActuar(yo.rol, "distribuidores")
  let d: Datos | null = null, error = ""
  try { d = await adminFetch<Datos>("/admin/hetna-distribuidores") } catch (e) { error = (e as Error).message }
  const SITIO = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")
  const wa = (t: string | null) => `https://wa.me/${String(t || "").replace(/\D/g, "").replace(/^(\d{10})$/, "52$1")}`

  return (
    <div className="grid gap-4">
      <SubApp locale={locale} actual="distribuidores" />
      {error && <Vacio>No pude leer los referidos: {error}</Vacio>}
      {d && !d.instalado && (
        <Vacio>Falta correr <b>supabase/referidos.sql</b> en el Supabase del Cotizador. Mientras, aquí no hay datos.</Vacio>
      )}
      {d && (d.solicitudes || []).length > 0 && (
        <Tarjeta>
          <Titulo extra={<span className="text-[11px] text-[#6B675C]">del formulario de /distribuidores</span>}>Solicitudes de distribuidor</Titulo>
          <ul className="divide-y divide-[#EFEDE6]">
            {(d.solicitudes || []).map((s) => (
              <li key={s.id} className="py-3">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-[14px] font-extrabold">{s.empresa}</p>
                  <Etiqueta color={s.estado === "nueva" ? "ambar" : s.estado === "atendida" ? "verde" : "gris"}>{s.estado === "atendida" && s.codigo ? s.codigo : s.estado}</Etiqueta>
                </div>
                <p className="text-[12px] text-[#40403A]">{s.contacto} · {s.correo}{s.telefono ? ` · ${s.telefono}` : ""}</p>
                <p className="text-[12px] text-[#6B675C]">{[s.maquinas, s.ventas_mes ? `${s.ventas_mes} al mes` : "", s.ciudad].filter(Boolean).join(" · ")}</p>
                {s.mensaje && <p className="mt-1 text-[12px] italic text-[#6B675C]">“{s.mensaje}”</p>}
                <p className="text-[11px] text-[#9A968B]">{hace(s.created_at)}</p>
                {actuar && s.estado === "nueva" && <AtenderSolicitud id={s.id} empresa={s.empresa} />}
              </li>
            ))}
          </ul>
        </Tarjeta>
      )}
      {d && (
        <>
          <Tarjeta>
            <Titulo>Referidos</Titulo>
            <div className="grid grid-cols-3 gap-2">
              <Kpi etiqueta="Invitados por talleres" valor={String(d.referidos.total)} />
              <Kpi etiqueta="Completaron arranque" valor={String(d.referidos.completaron)} antes={d.referidos.total ? `${Math.round((d.referidos.completaron / d.referidos.total) * 100)} %` : undefined} />
              <Kpi etiqueta="Por distribuidor" valor={String(d.referidos.por_distribuidor)} />
            </div>
            {d.referidos.por_taller.length > 0 && (
              <>
                <p className="mt-3 text-[12px] font-bold text-[#6B675C]">Talleres que más invitan</p>
                <ul className="mt-1 divide-y divide-[#EFEDE6]">
                  {d.referidos.por_taller.slice(0, 10).map((t) => (
                    <li key={t.id} className="flex items-center justify-between py-2 text-[13px]">
                      <span className="font-semibold">{t.nombre}</span>
                      <span className="text-[#6B675C]">{t.invitados} invitados · {t.completaron} completaron</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {d.referidos.ultimos.length > 0 && (
              <>
                <p className="mt-3 text-[12px] font-bold text-[#6B675C]">Últimos que llegaron con código</p>
                <ul className="mt-1 divide-y divide-[#EFEDE6]">
                  {d.referidos.ultimos.map((r, i) => (
                    <li key={i} className="py-2 text-[13px]">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-semibold">{r.nombre}</span>
                        <Etiqueta color={r.completo ? "verde" : "gris"}>{r.completo ? "completó" : "en arranque"}</Etiqueta>
                      </div>
                      <p className="text-[11px] text-[#9A968B]">vía {r.de} ({r.codigo}) · {hace(r.fecha)}</p>
                    </li>
                  ))}
                </ul>
              </>
            )}
            {d.referidos.total === 0 && d.referidos.por_distribuidor === 0 && <Vacio>Todavía nadie ha llegado con código.</Vacio>}
          </Tarjeta>

          <Tarjeta>
            <Titulo extra={<a href={`/${locale}/distribuidores`} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-[#C2560A]">Página para distribuidores →</a>}>Códigos de distribuidor</Titulo>
            {actuar && d.instalado && <NuevoCodigo />}
            {d.codigos.length === 0 && <div className="mt-2"><Vacio>Sin códigos todavía. Crea uno por distribuidor (ej. BAJIO90 = 90 días).</Vacio></div>}
            <ul className="mt-2 divide-y divide-[#EFEDE6]">
              {d.codigos.map((c) => {
                const liga = `${SITIO}/${locale}/distribuidores/${c.codigo}`
                const agotado = c.max_usos != null && c.usos >= c.max_usos
                const vencido = !!c.vence && new Date(c.vence + "T23:59:59") < new Date()
                return (
                  <li key={c.codigo} className="py-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[15px] font-black tracking-wider text-[#142033]">{c.codigo}</p>
                      <Etiqueta color={!c.activo ? "gris" : agotado || vencido ? "ambar" : "verde"}>
                        {!c.activo ? "pausado" : agotado ? "agotado" : vencido ? "vencido" : "activo"}
                      </Etiqueta>
                    </div>
                    <p className="text-[13px] font-semibold">{c.nombre}</p>
                    <p className="text-[12px] text-[#6B675C]">
                      {c.dias_regalo} días · {c.usos}{c.max_usos != null ? ` de ${c.max_usos}` : ""} usos{c.vence ? ` · vence ${fechaCorta(c.vence)}` : ""}
                    </p>
                    {actuar && <BotonCodigo codigo={c.codigo} activo={c.activo} liga={liga} />}
                  </li>
                )
              })}
            </ul>
          </Tarjeta>

          <Tarjeta>
            <Titulo extra={<span className="text-[11px] text-[#6B675C]">talleres que ya pagan</span>}>Meses a favor</Titulo>
            <p className="mb-2 text-[12px] text-[#6B675C]">
              Ganaron estos meses invitando talleres. Como su cobro lo lleva Mercado Pago o PayPal, aplícalos en su siguiente renovación (o como cortesía) y márcalos aquí.
            </p>
            {d.meses_a_favor.length === 0 && <Vacio>Nadie tiene meses pendientes.</Vacio>}
            <ul className="divide-y divide-[#EFEDE6]">
              {d.meses_a_favor.map((n) => (
                <li key={n.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="text-[14px] font-extrabold">{n.nombre}</p>
                    <Etiqueta color="azul">{n.meses} {n.meses === 1 ? "mes" : "meses"}</Etiqueta>
                  </div>
                  <p className="text-[12px] text-[#6B675C]">plan {n.plan}{n.correo ? ` · ${n.correo}` : ""}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {n.telefono && <a href={wa(n.telefono)} target="_blank" rel="noreferrer" className="rounded-lg bg-[#E6F4EA] px-3 py-1.5 text-[12px] font-bold text-[#0F7A4A]">WhatsApp</a>}
                    {actuar && <MesAplicado id={n.id} nombre={n.nombre} />}
                  </div>
                </li>
              ))}
            </ul>
          </Tarjeta>
        </>
      )}
    </div>
  )
}
