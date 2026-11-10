// HETNA Panel → Inicio: lo mismo que el Centro de control del dashboard,
// pero para leerlo en el celular en 30 segundos.
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
          <a key={n} href={`/${locale}/panel?d=${n}`} className={`rounded-full border px-3 py-1.5 text-[12px] font-semibold ${dias === n ? "border-[#142033] bg-[#142033] text-white" : "border-[#E7E4DC] bg-white text-[#40403A]"}`}>{n === 1 ? "Hoy" : `${n} días`}</a>
        ))}
      </div>
      <Tarjeta>
        <Titulo>Administrar</Titulo>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            ["📦", "Productos", "/dashboard/products"], ["🧾", "Pedidos", "/dashboard/orders"], ["🏭", "Talleres", "/dashboard/sellers"],
            ["📋", "Solicitudes", "/dashboard/solicitudes"], ["🚚", "Envíos", "/dashboard/envios"], ["💳", "Saldos", "/dashboard/saldos"],
            ["🏷️", "Cupones", "/dashboard/promotions"], ["📰", "Blog", "/dashboard/blog"], ["📱", "App Cotizador", "/dashboard/cotizador"],
            ["🎛️", "Centro de control", "/dashboard/control"], ["👤", "Clientes", "/dashboard/customers"], ["⚙️", "Ajustes", "/dashboard/settings"],
          ].map(([ic, n, ruta]) => (
            <a key={ruta} href={`${SITIO}${ruta}`} target="_blank" rel="noreferrer" className="rounded-xl bg-[#F8F7F2] px-2 py-3 text-[12px] font-semibold text-[#142033] hover:bg-[#EFEDE6]">
              <span className="block text-xl">{ic}</span>{n}
            </a>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-[#9A968B]">Abre el dashboard completo (mejor en tablet o computadora). Las acciones del día a día están en las pestañas de abajo.</p>
      </Tarjeta>
      {error && <Vacio>No pude leer el centro de control: {error}</Vacio>}
      {c && (
        <>
          <Tarjeta>
            <Titulo>Ventas · {dias === 1 ? "hoy" : `${dias} días`}</Titulo>
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
              <Titulo>Saldo de envíos</Titulo>
              <p className="text-sm text-[#40403A]">{c.saldos.skydropx.texto || `Skydropx: ${pesos(c.saldos.skydropx.saldo || 0)}`}{typeof c.saldos.skydropx.alcanza_dias === "number" ? ` · alcanza ≈ ${c.saldos.skydropx.alcanza_dias} días` : ""}</p>
            </Tarjeta>
          )}
          <Tarjeta>
            <Titulo extra={<span className="text-[12px] text-[#6B675C]">{c.conteo.rojo} urgentes · {c.conteo.ambar} por revisar</span>}>Avisos</Titulo>
            {c.avisos.length === 0 ? <Vacio>Sin avisos. Todo en orden.</Vacio> : (
              <ul className="divide-y divide-[#EFEDE6]">
                {c.avisos.slice(0, 30).map((a, i) => (
                  <li key={i} className="py-2.5">
                    <div className="flex items-start gap-2">
                      <Etiqueta color={a.nivel}>{a.nivel === "rojo" ? "Urgente" : a.nivel === "ambar" ? "Revisar" : "Info"}</Etiqueta>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-bold leading-snug text-[#142033]">{a.titulo}</p>
                        {a.detalle && <p className="text-[12px] text-[#6B675C]">{a.detalle}</p>}
                        <p className="text-[11px] text-[#9A968B]">{hace(a.cuando)}{a.url && <> · <a className="font-semibold text-[#C2560A]" href={a.url} target="_blank" rel="noreferrer">Abrir en el dashboard</a></>}</p>
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
