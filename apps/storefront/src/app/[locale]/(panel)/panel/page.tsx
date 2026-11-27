// HETNA Panel → Inicio: lo mismo que el Centro de control del dashboard,
// pero para leerlo en el celular en 30 segundos.
import { TS } from "@/i18n/TS"
import { Etiqueta, Kpi, Tarjeta, Titulo, Vacio } from "@/components/hetna/panel/ui"
import { adminFetch, exigirPagina, hace, pesos } from "@/lib/panel/sesion"

type Aviso = { nivel: "rojo" | "ambar" | "azul"; tipo: string; titulo: string; detalle?: string; url?: string; cuando?: string }
type Control = {
  ventas: { dias: number; moneda: string; pedidos: number; pedidos_antes: number; ingresos: number; ingresos_antes: number; ticket: number; comision: number; comision_antes: number; clientes_nuevos: number; clientes_total: number; talleres_nuevos: number }
  saldos: { skydropx?: { saldo?: number; alcanza_dias?: number; nivel?: string; texto?: string } | null } | null
  avisos: Aviso[]
  conteo: { rojo: number; ambar: number; azul: number }
}

const dif = (a: number, b: number) => (b > 0 ? `${a >= b ? "+" : ""}${Math.round(((a - b) / b) * 100)} % vs. antes` : a > 0 ? "nuevo" : "sin cambio")

export default async function PanelInicio({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ d?: string }> }) {
  const { locale } = await params
  await exigirPagina(locale, "inicio")
  const { d } = await searchParams
  const dias = [1, 7, 30, 90].includes(Number(d)) ? Number(d) : 7
  const SITIO = (process.env.NEXT_PUBLIC_BASE_URL || "https://hetnacnc.com").replace(/\/$/, "")
  let c: Control | null = null, error = ""
  try { c = await adminFetch<Control>(`/admin/hetna-control?dias=${dias}`) } catch (e) { error = (e as Error).message }

  return (
    <div className="grid gap-4">
      <div className="flex gap-2">
        {[1, 7, 30, 90].map((n) => (
          <a key={n} href={`/${locale}/panel?d=${n}`} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${dias === n ? "border-[#142033] bg-[#142033] text-white" : "border-[#E7E4DC] bg-white text-[#40403A]"}`}><TS>{n === 1 ? "Hoy" : `${n} días`}</TS></a>
        ))}
      </div>
      <Tarjeta>
        <Titulo><TS>Administrar</TS></Titulo>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["📦", "Productos", "/dashboard/products"], ["🧾", "Pedidos", "/dashboard/orders"], ["🏭", "Talleres", "/dashboard/sellers"],
            ["📋", "Solicitudes", "/dashboard/solicitudes"], ["🚚", "Envíos", "/dashboard/envios"], ["💳", "Saldos", "/dashboard/saldos"],
            ["🏷️", "Cupones", "/dashboard/promotions"], ["📰", "Blog", "/dashboard/blog"], ["📱", "App Cotizador", "/dashboard/cotizador"],
            ["🎛️", "Centro de control", "/dashboard/control"], ["👤", "Clientes", "/dashboard/customers"], ["⚙️", "Ajustes", "/dashboard/settings"],
          ].map(([ic, n, ruta]) => (
            <a key={ruta} href={`${SITIO}${ruta}`} target="_blank" rel="noreferrer" className="rounded-xl bg-[#F8F7F2] px-2 py-3 text-[12px] font-semibold text-[#142033] hover:bg-[#EFEDE6]">
              <span className="block text-xl"><TS>{ic}</TS></span>{n}
            </a>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#9A968B]"><TS>Abre el dashboard completo (mejor en tablet o computadora). Las acciones del día a día están en las pestañas de abajo.</TS></p>
      </Tarjeta>
      {error && <Vacio><TS>No pude leer el centro de control:</TS> <TS>{error}</TS></Vacio>}
      {c && (
        <>
          <Tarjeta>
            <Titulo><TS>Ventas ·</TS> <TS>{dias === 1 ? "hoy" : `${dias} días`}</TS></Titulo>
            <div className="grid grid-cols-2 gap-2">
              <Kpi etiqueta="Ingresos" valor={pesos(c.ventas.ingresos, c.ventas.moneda || "MXN")} antes={dif(c.ventas.ingresos, c.ventas.ingresos_antes)} />
              <Kpi etiqueta="Pedidos" valor={String(c.ventas.pedidos)} antes={dif(c.ventas.pedidos, c.ventas.pedidos_antes)} />
              <Kpi etiqueta="Comisión HETNA" valor={pesos(c.ventas.comision)} antes={dif(c.ventas.comision, c.ventas.comision_antes)} />
              <Kpi etiqueta="Ticket promedio" valor={pesos(c.ventas.ticket)} />
              <Kpi etiqueta="Clientes nuevos" valor={String(c.ventas.clientes_nuevos)} antes={`${c.ventas.clientes_total} en total`} />
              <Kpi etiqueta="Talleres nuevos" valor={String(c.ventas.talleres_nuevos)} />
            </div>
          </Tarjeta>
          {c.saldos?.skydropx && (
            <Tarjeta>
              <Titulo><TS>Saldo de envíos</TS></Titulo>
              <p className="text-sm text-[#40403A]"><TS>{c.saldos.skydropx.texto || `Skydropx: ${pesos(c.saldos.skydropx.saldo || 0)}`}</TS><TS>{typeof c.saldos.skydropx.alcanza_dias === "number" ? ` · alcanza ≈ ${c.saldos.skydropx.alcanza_dias} días` : ""}</TS></p>
            </Tarjeta>
          )}
          <Tarjeta>
            <Titulo extra={<span className="text-[12px] text-[#6B675C]"><TS>{c.conteo.rojo}</TS> <TS>urgentes ·</TS> <TS>{c.conteo.ambar}</TS> <TS>por revisar</TS></span>}><TS>Avisos</TS></Titulo>
            {c.avisos.length === 0 ? <Vacio><TS>Sin avisos. Todo en orden.</TS></Vacio> : (
              <ul className="divide-y divide-[#EFEDE6]">
                {c.avisos.slice(0, 30).map((a, i) => (
                  <li key={i} className="py-2.5">
                    <div className="flex items-start gap-2">
                      <Etiqueta color={a.nivel}><TS>{a.nivel === "rojo" ? "Urgente" : a.nivel === "ambar" ? "Revisar" : "Info"}</TS></Etiqueta>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-bold leading-snug text-[#142033]"><TS>{a.titulo}</TS></p>
                        {a.detalle && <p className="text-[12px] text-[#6B675C]"><TS>{a.detalle}</TS></p>}
                        <p className="text-[11px] text-[#9A968B]">{hace(a.cuando)}{a.url && <> · <a className="font-semibold text-[#C2560A]" href={a.url} target="_blank" rel="noreferrer"><TS>Abrir en el dashboard</TS></a></>}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Tarjeta>
        </>
      )}
    </div>
  )
}
