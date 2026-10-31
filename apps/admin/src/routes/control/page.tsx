// Dashboard > Centro de control: lo primero que hay que ver cada día.
// Arriba lo que necesita que alguien haga algo (rojo, ámbar, azul) y abajo las
// ventas del periodo contra el periodo anterior. Datos: GET /admin/hetna-control
// (packages/api/src/lib/centro-control.ts). Los mismos avisos llegan por correo
// cada mañana y, si aparece algo urgente, durante el día
// (jobs/centro-control-avisos.ts).
import { useCallback, useEffect, useState } from "react"
import type { CSSProperties } from "react"

type Nivel = "rojo" | "ambar" | "azul"
type Aviso = { nivel: Nivel; tipo: string; titulo: string; detalle?: string; url?: string; cuando?: string }
type Recarga = { id: number; plataforma: string; monto: string | number; origen: string; comprobante_url: string | null; nota: string | null; fecha: string }
type Saldo = {
  saldo: number
  gasto_dia: number
  dias_restantes: number | null
  minimo: number
  tope: number
  recargar: boolean
  sugerida: number
  url_recarga: string
}
type Datos = {
  generado: string
  saldos?: { skydropx: Saldo | null; recargas: Recarga[] } | null
  conteo: Record<Nivel, number>
  avisos: Aviso[]
  ventas: {
    dias: number
    moneda: string
    pedidos: number
    pedidos_antes: number
    ingresos: number
    ingresos_antes: number
    ticket: number
    ticket_antes: number
    comision: number
    comision_antes: number
    clientes_nuevos: number
    clientes_nuevos_antes: number
    clientes_total: number
    talleres_nuevos: number
    talleres_total: number
    carritos_abandonados: number
    valor_abandonado: number
    gasto_guias?: number
    por_dia: { dia: string; ingresos: number; pedidos: number }[]
    talleres_top: { nombre: string; pedidos: number; ingresos: number }[]
    productos_top: { titulo: string; piezas: number; ingresos: number }[]
  }
}

const MSG_SESION =
  "No se pudo verificar tu sesión de administrador. Cierra sesión en el dashboard, vuelve a entrar y recarga esta página."
const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
async function leer(dias: number): Promise<Datos> {
  let r: Response
  try {
    r = await fetch(`/admin/hetna-control?dias=${dias}`, { credentials: "include", headers: cabeceras() })
  } catch {
    throw new Error("No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.")
  }
  const d = (await r.json().catch(() => ({}))) as Datos & { message?: string }
  if (r.status === 401) throw new Error(MSG_SESION)
  if (!r.ok) throw new Error(d?.message || `Error ${r.status}`)
  return d
}

const C = {
  borde: "var(--border-base, #e5e5e5)",
  fondo: "var(--bg-base, #ffffff)",
  suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)",
  tenue: "var(--fg-subtle, #6b6a63)",
  naranja: "#C2560A",
  verde: "#1E7B3A",
  rojo: "#B42318",
}
const NIVEL: Record<Nivel, { nombre: string; fondo: string; color: string }> = {
  rojo: { nombre: "Urgente", fondo: "#FEF3F2", color: "#B42318" },
  ambar: { nombre: "Revisar", fondo: "#FFFAEB", color: "#B54708" },
  azul: { nombre: "Para saber", fondo: "#EFF8FF", color: "#1D4F8C" },
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const pesos = (n: number) => `$${Math.round(n || 0).toLocaleString("es-MX")}`
const cuando = (s?: string) =>
  s ? new Date(s).toLocaleString("es-MX", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : ""

function Cambio({ ahora, antes }: { ahora: number; antes: number }) {
  if (!antes && !ahora) return <span style={{ color: C.tenue }}>sin cambio</span>
  if (!antes) return <span style={{ color: C.verde, fontWeight: 700 }}>nuevo</span>
  const pct = Math.round(((ahora - antes) / antes) * 100)
  const sube = pct >= 0
  return (
    <span style={{ color: sube ? C.verde : C.rojo, fontWeight: 700 }}>
      {sube ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  )
}

function Cifra({ titulo, valor, ahora, antes, nota }: { titulo: string; valor: string; ahora?: number; antes?: number; nota?: string }) {
  return (
    <div style={{ ...caja, marginBottom: 0, flex: "1 1 170px" }}>
      <div style={{ fontSize: 12, color: C.tenue, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4 }}>{titulo}</div>
      <div style={{ fontSize: 26, fontWeight: 800, marginTop: 4 }}>{valor}</div>
      <div style={{ fontSize: 12, color: C.tenue, marginTop: 2 }}>
        {ahora !== undefined && antes !== undefined && (
          <>
            <Cambio ahora={ahora} antes={antes} /> vs. periodo anterior
          </>
        )}
        {nota}
      </div>
    </div>
  )
}

// Barras de ingresos por día, con los pedidos al pasar el mouse
function Grafica({ dias }: { dias: Datos["ventas"]["por_dia"] }) {
  const max = Math.max(1, ...dias.map((d) => d.ingresos))
  const total = dias.reduce((s, d) => s + d.ingresos, 0)
  return (
    <div style={caja}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>Ventas por día</h2>
        <span style={{ fontSize: 13, color: C.tenue }}>Total {pesos(total)}</span>
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 160, marginTop: 14 }}>
        {dias.map((d) => (
          <div
            key={d.dia}
            title={`${new Date(d.dia + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}: ${pesos(d.ingresos)} · ${d.pedidos} pedido(s)`}
            style={{
              flex: 1,
              minWidth: 2,
              height: `${Math.max(2, (d.ingresos / max) * 100)}%`,
              background: d.ingresos ? C.naranja : C.borde,
              borderRadius: "3px 3px 0 0",
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: C.tenue, marginTop: 4 }}>
        <span>{dias[0] && new Date(dias[0].dia + "T12:00:00").toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span>
        <span>hoy</span>
      </div>
    </div>
  )
}

// Sube un archivo (foto o PDF de la nota) con el endpoint de Medusa y devuelve su URL
async function subirArchivo(archivo: File): Promise<string> {
  const fd = new FormData()
  fd.append("files", archivo)
  const r = await fetch("/admin/uploads", { method: "POST", credentials: "include", headers: cabeceras(), body: fd })
  const d = (await r.json().catch(() => ({}))) as { files?: { url: string }[]; message?: string }
  if (!r.ok || !d.files?.[0]?.url) throw new Error(d.message || "No se pudo subir el archivo.")
  return d.files[0].url
}
async function guardarRecarga(datos: Record<string, unknown>) {
  const r = await fetch("/admin/hetna-control/recargas", {
    method: "POST",
    credentials: "include",
    headers: { ...cabeceras(), "Content-Type": "application/json" },
    body: JSON.stringify(datos),
  })
  const d = (await r.json().catch(() => ({}))) as { message?: string }
  if (!r.ok) throw new Error(d.message || "No se pudo guardar.")
}

function SubirNota({ alListo, texto = "Subir nota" }: { alListo: (url: string) => Promise<void>; texto?: string }) {
  const [subiendo, setSubiendo] = useState(false)
  return (
    <label style={{ color: C.naranja, fontWeight: 700, fontSize: 13, cursor: "pointer", whiteSpace: "nowrap" }}>
      {subiendo ? "Subiendo…" : texto}
      <input
        type="file"
        accept="image/*,application/pdf"
        style={{ display: "none" }}
        disabled={subiendo}
        onChange={async (e) => {
          const a = e.target.files?.[0]
          e.target.value = ""
          if (!a) return
          setSubiendo(true)
          try {
            await alListo(await subirArchivo(a))
          } catch (err) {
            alert((err as Error).message)
          } finally {
            setSubiendo(false)
          }
        }}
      />
    </label>
  )
}

function Saldos({ datos, recargar }: { datos: NonNullable<Datos["saldos"]>; recargar: () => void }) {
  const s = datos.skydropx
  const [plataforma, setPlataforma] = useState("")
  const [monto, setMonto] = useState("")
  const [error, setError] = useState("")
  return (
    <div style={caja}>
      <h2 style={{ margin: "0 0 10px", fontSize: 16 }}>Saldos y recargas</h2>
      {s ? (
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            flexWrap: "wrap",
            padding: 12,
            borderRadius: 10,
            background: s.recargar ? NIVEL.rojo.fondo : C.suave,
            marginBottom: 12,
          }}
        >
          <div style={{ flex: "1 1 220px" }}>
            <div style={{ fontSize: 12, color: C.tenue, fontWeight: 700, textTransform: "uppercase" }}>Saldo Skydropx</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: s.recargar ? C.rojo : C.texto }}>{pesos(s.saldo)}</div>
            <div style={{ fontSize: 12, color: C.tenue }}>
              Gastas ≈{pesos(s.gasto_dia)} al día
              {s.dias_restantes !== null ? ` · alcanza para ≈${s.dias_restantes} días` : ""} · mínimo {pesos(s.minimo)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            {s.recargar && (
              <div style={{ fontSize: 13, marginBottom: 6 }}>
                Sugerido: <b>{pesos(s.sugerida)}</b> (tope {pesos(s.tope)})
              </div>
            )}
            <a
              href={s.url_recarga}
              target="_blank"
              rel="noreferrer"
              style={{ background: C.naranja, color: "#fff", borderRadius: 10, padding: "9px 14px", fontWeight: 700, textDecoration: "none", fontSize: 14 }}
            >
              Recargar en Skydropx
            </a>
          </div>
        </div>
      ) : (
        <p style={{ color: C.tenue, fontSize: 13 }}>No se pudo leer el saldo de Skydropx (revisa las llaves SKYDROPX_CLIENT_ID y SKYDROPX_CLIENT_SECRET).</p>
      )}
      <p style={{ fontSize: 13, color: C.tenue, margin: "0 0 8px" }}>
        Cuando recargas, el sistema detecta solo la recarga. Súbele la nota de compra (foto o PDF) para tener tus comprobantes juntos.
      </p>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr style={{ textAlign: "left", color: C.tenue }}>
            <th style={{ padding: "6px 4px" }}>Fecha</th>
            <th style={{ padding: "6px 4px" }}>Plataforma</th>
            <th style={{ padding: "6px 4px" }}>Monto</th>
            <th style={{ padding: "6px 4px" }}>Nota de compra</th>
          </tr>
        </thead>
        <tbody>
          {datos.recargas.map((r) => (
            <tr key={r.id} style={{ borderTop: `1px solid ${C.borde}` }}>
              <td style={{ padding: "6px 4px" }}>{cuando(r.fecha)}</td>
              <td style={{ padding: "6px 4px", textTransform: "capitalize" }}>
                {r.plataforma}
                {r.origen === "detectada" ? <span style={{ color: C.tenue }}> · detectada</span> : null}
              </td>
              <td style={{ padding: "6px 4px", fontWeight: 700 }}>{pesos(Number(r.monto))}</td>
              <td style={{ padding: "6px 4px" }}>
                {r.comprobante_url ? (
                  <a href={r.comprobante_url} target="_blank" rel="noreferrer" style={{ color: C.verde, fontWeight: 700 }}>
                    ✓ Ver nota
                  </a>
                ) : (
                  <SubirNota alListo={async (url) => { await guardarRecarga({ id: r.id, comprobante_url: url }); recargar() }} />
                )}
              </td>
            </tr>
          ))}
          {datos.recargas.length === 0 && (
            <tr>
              <td colSpan={4} style={{ padding: 8, color: C.tenue }}>
                Todavía no hay recargas anotadas.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <details style={{ marginTop: 10 }}>
        <summary style={{ cursor: "pointer", fontSize: 13, color: C.tenue }}>Anotar una recarga de otra plataforma</summary>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 8 }}>
          <input
            placeholder="Plataforma (ej. Resend, hosting)"
            value={plataforma}
            onChange={(e) => setPlataforma(e.target.value)}
            style={{ height: 34, border: `1px solid ${C.borde}`, borderRadius: 8, padding: "0 10px" }}
          />
          <input
            placeholder="Monto"
            inputMode="decimal"
            value={monto}
            onChange={(e) => setMonto(e.target.value.replace(/[^0-9.]/g, ""))}
            style={{ height: 34, width: 110, border: `1px solid ${C.borde}`, borderRadius: 8, padding: "0 10px" }}
          />
          <SubirNota
            texto="Subir nota y guardar"
            alListo={async (url) => {
              setError("")
              try {
                await guardarRecarga({ plataforma: plataforma || "otra", monto: Number(monto), comprobante_url: url })
                setPlataforma("")
                setMonto("")
                recargar()
              } catch (e) {
                setError((e as Error).message)
              }
            }}
          />
        </div>
        {error && <p style={{ color: C.rojo, fontSize: 13 }}>{error}</p>}
      </details>
    </div>
  )
}

function Lista<T>({ titulo, filas, vacio, render }: { titulo: string; filas: T[]; vacio: string; render: (f: T) => [string, string] }) {
  return (
    <div style={{ ...caja, flex: "1 1 320px" }}>
      <h2 style={{ margin: "0 0 8px", fontSize: 16 }}>{titulo}</h2>
      {filas.length === 0 && <p style={{ color: C.tenue, fontSize: 13, margin: 0 }}>{vacio}</p>}
      {filas.map((f, i) => {
        const [izq, der] = render(f)
        return (
          <div key={i} style={{ display: "flex", justifyContent: "space-between", gap: 10, padding: "7px 0", borderTop: i ? `1px solid ${C.borde}` : 0, fontSize: 13 }}>
            <span>{izq}</span>
            <b style={{ whiteSpace: "nowrap" }}>{der}</b>
          </div>
        )
      })}
    </div>
  )
}

export default function CentroControl() {
  const [dias, setDias] = useState(30)
  const [datos, setDatos] = useState<Datos | null>(null)
  const [error, setError] = useState("")
  const [cargando, setCargando] = useState(false)
  const [filtro, setFiltro] = useState<Nivel | "">("")

  const cargar = useCallback(async () => {
    setError("")
    setCargando(true)
    try {
      setDatos(await leer(dias))
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }, [dias])
  useEffect(() => {
    void cargar()
  }, [cargar])
  // Se actualiza solo cada 5 minutos mientras está abierto
  useEffect(() => {
    const id = setInterval(() => void cargar(), 5 * 60_000)
    return () => clearInterval(id)
  }, [cargar])

  const v = datos?.ventas
  const avisos = (datos?.avisos || []).filter((a) => !filtro || a.nivel === filtro)

  return (
    <div style={{ padding: 20, color: C.texto, maxWidth: 1150 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22 }}>Centro de control</h1>
          <p style={{ margin: "4px 0 16px", color: C.tenue, fontSize: 14 }}>
            Lo que necesita tu atención y cómo van las ventas. Los avisos urgentes también te llegan por correo.
            {datos && ` Actualizado ${cuando(datos.generado)}.`}
          </p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[7, 30, 90].map((n) => (
            <button
              key={n}
              onClick={() => setDias(n)}
              style={{
                cursor: "pointer",
                borderRadius: 10,
                padding: "8px 12px",
                border: `1px solid ${dias === n ? C.naranja : C.borde}`,
                background: dias === n ? C.naranja : C.fondo,
                color: dias === n ? "#fff" : C.texto,
                fontWeight: 700,
              }}
            >
              {n} días
            </button>
          ))}
          <button
            onClick={() => void cargar()}
            disabled={cargando}
            style={{ cursor: "pointer", borderRadius: 10, padding: "8px 14px", border: `1px solid ${C.borde}`, background: C.fondo, color: C.texto, fontWeight: 700 }}
          >
            {cargando ? "Actualizando…" : "Actualizar"}
          </button>
        </div>
      </div>

      {error && <p style={{ color: C.rojo }}>{error}</p>}
      {!datos && !error && <p style={{ color: C.tenue }}>Cargando…</p>}

      {datos && v && (
        <>
          {/* ---- Avisos ---- */}
          <div style={caja}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h2 style={{ margin: 0, fontSize: 16 }}>Lo que necesita tu atención</h2>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {(["", "rojo", "ambar", "azul"] as const).map((n) => (
                  <button
                    key={n || "todos"}
                    onClick={() => setFiltro(n)}
                    style={{
                      cursor: "pointer",
                      borderRadius: 999,
                      padding: "4px 12px",
                      fontSize: 12,
                      fontWeight: 700,
                      border: `1px solid ${filtro === n ? C.texto : C.borde}`,
                      background: n ? NIVEL[n].fondo : C.suave,
                      color: n ? NIVEL[n].color : C.texto,
                    }}
                  >
                    {n ? `${NIVEL[n].nombre} (${datos.conteo[n]})` : `Todo (${datos.avisos.length})`}
                  </button>
                ))}
              </div>
            </div>
            {avisos.length === 0 && (
              <p style={{ background: "#E6F4EC", color: "#14683F", borderRadius: 10, padding: 12, margin: "12px 0 0", fontWeight: 600 }}>
                ✓ Todo en orden: no hay nada pendiente aquí.
              </p>
            )}
            <div style={{ marginTop: 10 }}>
              {avisos.map((a, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    gap: 12,
                    alignItems: "flex-start",
                    padding: "10px 12px",
                    borderRadius: 10,
                    background: NIVEL[a.nivel].fondo,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      background: NIVEL[a.nivel].color,
                      color: "#fff",
                      borderRadius: 6,
                      padding: "2px 8px",
                      fontSize: 11,
                      fontWeight: 800,
                      whiteSpace: "nowrap",
                      marginTop: 2,
                    }}
                  >
                    {NIVEL[a.nivel].nombre}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{a.titulo}</div>
                    {a.detalle && <div style={{ fontSize: 13, color: C.tenue, marginTop: 2, overflowWrap: "anywhere" }}>{a.detalle}</div>}
                    {a.cuando && <div style={{ fontSize: 12, color: C.tenue, marginTop: 2 }}>{cuando(a.cuando)}</div>}
                  </div>
                  {a.url && (
                    <a
                      href={a.url}
                      target={a.url.startsWith("http") && !a.url.includes(window.location.host) ? "_blank" : undefined}
                      rel="noreferrer"
                      style={{ color: C.naranja, fontWeight: 700, fontSize: 13, whiteSpace: "nowrap", textDecoration: "none" }}
                    >
                      Abrir →
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>

          {datos.saldos && <Saldos datos={datos.saldos} recargar={() => void cargar()} />}

          {/* ---- Ventas ---- */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <Cifra titulo="Ventas" valor={pesos(v.ingresos)} ahora={v.ingresos} antes={v.ingresos_antes} />
            <Cifra titulo="Pedidos pagados" valor={String(v.pedidos)} ahora={v.pedidos} antes={v.pedidos_antes} />
            <Cifra titulo="Comisión HETNA" valor={pesos(v.comision)} ahora={v.comision} antes={v.comision_antes} />
            <Cifra titulo="Ticket promedio" valor={pesos(v.ticket)} ahora={v.ticket} antes={v.ticket_antes} />
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
            <Cifra titulo="Clientes nuevos" valor={String(v.clientes_nuevos)} ahora={v.clientes_nuevos} antes={v.clientes_nuevos_antes} />
            <Cifra titulo="Talleres" valor={String(v.talleres_total)} nota={`${v.talleres_nuevos} nuevos en el periodo`} />
            <Cifra titulo="Carritos abandonados" valor={String(v.carritos_abandonados)} nota={`${pesos(v.valor_abandonado)} que no se cobraron`} />
            <Cifra titulo="Gasto en guías" valor={pesos(v.gasto_guias || 0)} nota="Lo que se descontó de tu saldo de Skydropx" />
          </div>

          <Grafica dias={v.por_dia} />

          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <Lista
              titulo="Talleres que más venden"
              filas={v.talleres_top}
              vacio="Todavía no hay ventas en este periodo."
              render={(t) => [`${t.nombre} · ${t.pedidos} pedido(s)`, pesos(t.ingresos)]}
            />
            <Lista
              titulo="Productos que más venden"
              filas={v.productos_top}
              vacio="Todavía no hay ventas en este periodo."
              render={(p) => [`${p.titulo} · ${p.piezas} pza`, pesos(p.ingresos)]}
            />
          </div>
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Centro de control",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 12h4l3-8 4 16 3-8h4" />
    </svg>
  ),
}
