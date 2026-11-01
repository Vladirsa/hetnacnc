// Tablero del taller: lo primero que ve al entrar a /seller.
//
// Responde en una pantalla las preguntas que un taller se hace de verdad:
// cuánto llevo del mes, qué me están viendo, qué me ven y no me compran,
// cómo voy contra los demás, y qué pasa con mis cotizaciones.
//
// Los datos vienen todos de GET /vendor/tablero, que ya los junta en el
// backend. Se usa fetch directo y no el cliente tipado por lo mismo que las
// pantallas de envíos y precios por cantidad: son rutas propias de HETNA que
// no pasan por el codegen de Mercur.
import { useCallback, useEffect, useState } from "react"
import { Link } from "react-router-dom"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

const Tablero = (props: { width?: number; height?: number }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    {...props}
  >
    <rect x="3" y="3" width="7" height="9" rx="1" />
    <rect x="14" y="3" width="7" height="5" rx="1" />
    <rect x="14" y="12" width="7" height="9" rx="1" />
    <rect x="3" y="16" width="7" height="5" rx="1" />
  </svg>
)

export const config: RouteConfig = {
  label: "Mi tablero",
  icon: Tablero,
  rank: 1,
}

// ---------------------------------------------------------------- tipos

type ProductoVisto = {
  producto_id: string
  titulo: string
  vistas: number
  unidades_vendidas: number
  ingresos: number
}

type Candidato = ProductoVisto & {
  conversion: number
  offer_id: string | null
  precio_actual: number | null
  razon: "sin_ventas" | "conversion_baja"
}

type RespuestaTablero = {
  moneda: string
  mes: string
  ventas: {
    ventana_dias: number
    total_pedidos: number
    ingresos_totales: number
    por_dia: { fecha: string; pedidos: number; ingresos: number }[]
    pedidos_mes: number
    ingresos_mes: number
    ticket_promedio: number
    ingresos_previos: number
    pedidos_previos: number
  }
  por_enviar: {
    order_id: string
    display_id: number | null
    creado: string
    horas: number
    tarde: boolean
    total: number
    piezas: string
  }[]
  stock: {
    producto_id: string
    titulo: string
    disponibles: number
    dias_restantes: number | null
    nivel: "agotado" | "bajo" | "se_acaba"
  }[]
  reputacion: {
    dias: number
    pedidos: number
    enviados: number
    cancelados: number
    devoluciones: number
    reclamos: number
    envio_promedio_horas: number | null
    enviados_tarde: number
    pedidos_sin_problema: number | null
    semaforo: "verde" | "ambar" | "rojo" | "sin_datos"
    consejos: string[]
  }
  meta: { mes: string; objetivo: number; puesta: boolean }
  vistas: { total: number; productos: ProductoVisto[]; conversion: number | null }
  descuentos: Candidato[]
  productos_top: { producto_id: string; titulo: string; cantidad: number; ingresos: number }[]
  resenas: { promedio: number | null; total: number }
  foro: {
    disponible: boolean
    usuario: string | null
    reputacion: number
    temas: number
    respuestas: number
    votos_recibidos: number
    mejores_respuestas: number
    motivo?: "sin_configurar" | "sin_abrir" | "sin_perfil" | "error"
  }
  cotizador: {
    vinculado: boolean
    plan: string | null
    cotizaciones: number
    enviadas: number
    aceptadas: number
    monto_aceptado: number
    monto_en_juego: number
    tasa_cierre: number | null
  }
  ranking: {
    posicion: number | null
    total_talleres: number
    puntuacion: number
    desglose: { ventas: number; foro: number; resenas: number }
  }
  catalogo_total: number
}

// ---------------------------------------------------------------- estilos

const S: Record<string, React.CSSProperties> = {
  page: { maxWidth: 1040, margin: "0 auto", padding: "24px 16px 80px", fontFamily: "inherit" },
  h1: { fontSize: 22, fontWeight: 700, margin: 0 },
  sub: { color: "#6B675C", fontSize: 14, margin: "4px 0 20px" },
  card: {
    background: "#fff",
    border: "1px solid #E7E4DC",
    borderRadius: 12,
    padding: 18,
    marginBottom: 14,
  },
  h2: { fontSize: 15, fontWeight: 700, margin: "0 0 2px" },
  nota: { color: "#6B675C", fontSize: 12.5, margin: "0 0 14px" },
  rejilla: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
    gap: 12,
    marginBottom: 14,
  },
  dosColumnas: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
    gap: 14,
  },
  cifra: { fontSize: 24, fontWeight: 700, margin: "2px 0 0", lineHeight: 1.1 },
  cifraChica: { fontSize: 18, fontWeight: 700, margin: "2px 0 0", lineHeight: 1.1 },
  etiqueta: { color: "#6B675C", fontSize: 12, fontWeight: 600, margin: 0 },
  pie: { color: "#8A857A", fontSize: 11.5, margin: "3px 0 0" },
  barraFuera: { background: "#F1EEE7", borderRadius: 999, height: 12, overflow: "hidden" },
  barraDentro: { background: "#C2560A", height: "100%", borderRadius: 999, transition: "width .3s" },
  fila: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "9px 0",
    borderTop: "1px solid #F1EEE7",
  },
  input: {
    width: 160,
    height: 40,
    border: "1px solid #D9D5C9",
    borderRadius: 8,
    padding: "0 10px",
    fontSize: 16,
    boxSizing: "border-box",
    background: "#fff",
  },
  btn: {
    background: "#C2560A",
    color: "#fff",
    border: 0,
    borderRadius: 8,
    padding: "10px 18px",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  btnPlano: {
    background: "transparent",
    color: "#C2560A",
    border: 0,
    padding: "10px 4px",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
  },
  vacio: { color: "#8A857A", fontSize: 13, margin: "6px 0 0" },
  err: { color: "#9B3225", fontSize: 13, fontWeight: 600, margin: "8px 0 0" },
  ok: { color: "#1F5B29", fontSize: 13, fontWeight: 600, margin: "8px 0 0" },
  pildora: {
    display: "inline-block",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11.5,
    fontWeight: 700,
  },
}

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
]

const nombreDelMes = (mes: string) => {
  const n = Number(mes.split("-")[1])
  return MESES[n - 1] || mes
}

const pesos = (n: number | null | undefined, moneda = "MXN") =>
  typeof n === "number"
    ? n.toLocaleString("es-MX", {
        style: "currency",
        currency: moneda.toUpperCase(),
        maximumFractionDigits: 0,
      })
    : "—"

const porcentaje = (n: number | null | undefined, decimales = 1) =>
  typeof n === "number" ? `${(n * 100).toFixed(decimales)}%` : "—"

// ---------------------------------------------------------------- piezas

function Tarjeta({
  etiqueta,
  valor,
  pie,
}: {
  etiqueta: string
  valor: string
  pie?: string
}) {
  return (
    <div style={S.card}>
      <p style={S.etiqueta}>{etiqueta}</p>
      <p style={S.cifra}>{valor}</p>
      {pie && <p style={S.pie}>{pie}</p>}
    </div>
  )
}

// Gráfica de barras de las ventas por día. Va a mano en SVG en vez de meter
// una librería de gráficas: son treinta barras y el panel ya carga bastante.
function Ventas30({ dias, moneda }: { dias: RespuestaTablero["ventas"]["por_dia"]; moneda: string }) {
  const tope = Math.max(...dias.map((d) => d.ingresos), 1)
  const alto = 90

  return (
    <div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: alto }}>
        {dias.map((dia) => {
          const altura = Math.max(2, Math.round((dia.ingresos / tope) * alto))
          return (
            <div
              key={dia.fecha}
              title={`${dia.fecha}: ${pesos(dia.ingresos, moneda)} · ${dia.pedidos} pedido${
                dia.pedidos === 1 ? "" : "s"
              }`}
              style={{
                flex: 1,
                height: altura,
                background: dia.ingresos > 0 ? "#C2560A" : "#EDEAE3",
                borderRadius: 3,
                minWidth: 4,
              }}
            />
          )
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          color: "#8A857A",
          fontSize: 11,
          marginTop: 6,
        }}
      >
        <span>hace {dias.length} días</span>
        <span>máximo del día: {pesos(tope, moneda)}</span>
        <span>hoy</span>
      </div>
    </div>
  )
}

function MetaDelMes({
  datos,
  onGuardar,
}: {
  datos: RespuestaTablero
  onGuardar: (objetivo: number) => Promise<void>
}) {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(String(datos.meta.objetivo || ""))
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState("")

  const objetivo = datos.meta.objetivo
  const llevado = datos.ventas.ingresos_mes
  const avance = objetivo > 0 ? Math.min(1, llevado / objetivo) : 0
  const falta = Math.max(0, objetivo - llevado)

  const guardar = async () => {
    const n = Number(valor)
    if (!Number.isFinite(n) || n < 0) {
      setError("Escribe un número, sin comas ni signo de pesos.")
      return
    }
    setGuardando(true)
    setError("")
    try {
      await onGuardar(n)
      setEditando(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar.")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 12 }}>
        <div>
          <h2 style={S.h2}>Tu meta de {nombreDelMes(datos.mes)}</h2>
          <p style={S.nota}>
            {objetivo > 0
              ? `Llevas ${pesos(llevado, datos.moneda)} de ${pesos(objetivo, datos.moneda)}.`
              : "Ponte una meta de venta para el mes y aquí ves qué tanto llevas."}
          </p>
        </div>
        {!editando && (
          <button type="button" style={S.btnPlano} onClick={() => setEditando(true)}>
            {objetivo > 0 ? "Cambiar meta" : "Poner meta"}
          </button>
        )}
      </div>

      {objetivo > 0 && (
        <>
          <div style={S.barraFuera}>
            <div style={{ ...S.barraDentro, width: `${avance * 100}%` }} />
          </div>
          <p style={S.pie}>
            {avance >= 1
              ? "Meta cumplida. Ponte una más alta el mes que entra."
              : `Te faltan ${pesos(falta, datos.moneda)} · ${(avance * 100).toFixed(0)}% recorrido`}
          </p>
        </>
      )}

      {editando && (
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
          <input
            style={S.input}
            type="number"
            min={0}
            step={100}
            value={valor}
            placeholder="30000"
            onChange={(e) => setValor(e.target.value)}
          />
          <button type="button" style={S.btn} onClick={guardar} disabled={guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </button>
          <button
            type="button"
            style={S.btnPlano}
            onClick={() => {
              setEditando(false)
              setError("")
              setValor(String(objetivo || ""))
            }}
          >
            Cancelar
          </button>
        </div>
      )}
      {error && <p style={S.err}>{error}</p>}
    </div>
  )
}

function Ranking({ datos }: { datos: RespuestaTablero }) {
  const { ranking } = datos
  const d = ranking.desglose

  // Mientras el foro no exista, esa parte vale 0 para todos. Enseñar la barra
  // en "0 de 25" le diría al taller que no participa en algo que ni siquiera
  // abrió, y además ningún taller podría pasar de 75 de 100.
  const foroCuenta =
    datos.foro.motivo !== "sin_abrir" && datos.foro.motivo !== "sin_configurar"

  const partes = [
    { nombre: "Ventas", puntos: d.ventas, tope: 50 },
    ...(foroCuenta ? [{ nombre: "Foro", puntos: d.foro, tope: 25 }] : []),
    { nombre: "Reseñas", puntos: d.resenas, tope: 25 },
  ]
  const topeTotal = partes.reduce((suma, p) => suma + p.tope, 0)

  return (
    <div style={S.card}>
      <h2 style={S.h2}>Tu lugar entre los talleres</h2>
      <p style={S.nota}>
        {foroCuenta
          ? "Se mezcla lo que vendes, lo que aportas en el foro y cómo te califican. Vender no es lo único que sube."
          : "Se mezcla lo que vendes y cómo te califican. Cuando abra el Foro CNC, lo que aportes ahí también va a contar."}
      </p>

      {ranking.posicion ? (
        <p style={S.cifra}>
          #{ranking.posicion}{" "}
          <span style={{ fontSize: 14, fontWeight: 600, color: "#6B675C" }}>
            de {ranking.total_talleres} talleres
          </span>
        </p>
      ) : (
        <p style={S.vacio}>
          Todavía no hay con quién compararte. En cuanto haya más talleres con movimiento, aquí
          aparece tu lugar.
        </p>
      )}

      <div style={{ marginTop: 14 }}>
        {partes.map((parte) => (
          <div key={parte.nombre} style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5 }}>
              <span style={{ fontWeight: 600 }}>{parte.nombre}</span>
              <span style={{ color: "#6B675C" }}>
                {parte.puntos.toFixed(1)} de {parte.tope}
              </span>
            </div>
            <div style={{ ...S.barraFuera, height: 8, marginTop: 3 }}>
              <div
                style={{
                  ...S.barraDentro,
                  width: `${Math.min(100, (parte.puntos / parte.tope) * 100)}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <p style={S.pie}>
        Puntuación total: {ranking.puntuacion.toFixed(1)} de {topeTotal}
      </p>
    </div>
  )
}

function Descuentos({ datos }: { datos: RespuestaTablero }) {
  return (
    <div style={S.card}>
      <h2 style={S.h2}>Te ven y no te compran</h2>
      <p style={S.nota}>
        Productos con visitas suficientes para opinar y casi ninguna venta. Aquí es donde te está
        costando el precio o la ficha.
      </p>

      {datos.descuentos.length === 0 && (
        <p style={S.vacio}>
          Nada por ahora. Cuando algún producto junte visitas sin vender, aparece aquí.
        </p>
      )}

      {datos.descuentos.map((p) => (
        <div key={p.producto_id} style={S.fila}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5 }}>{p.titulo}</p>
            <p style={S.pie}>
              {p.vistas} visita{p.vistas === 1 ? "" : "s"} ·{" "}
              {p.razon === "sin_ventas"
                ? "ninguna venta"
                : `${p.unidades_vendidas} vendida${p.unidades_vendidas === 1 ? "" : "s"} (${porcentaje(
                    p.conversion
                  )})`}
              {p.precio_actual !== null && ` · hoy a ${pesos(p.precio_actual, datos.moneda)}`}
            </p>
          </div>
          <span
            style={{
              ...S.pildora,
              background: p.razon === "sin_ventas" ? "#FDEDE8" : "#FDF6E3",
              color: p.razon === "sin_ventas" ? "#9B3225" : "#7A5B14",
              whiteSpace: "nowrap",
            }}
          >
            {p.razon === "sin_ventas" ? "Bájale el precio" : "Revísalo"}
          </span>
        </div>
      ))}

      {datos.descuentos.length > 0 && (
        <p style={S.pie}>
          Para ponerles precio por cantidad, ve a <strong>Precios por cantidad</strong> en el menú.
        </p>
      )}
    </div>
  )
}

// "+18% vs. los 30 días anteriores". Sin ventas antes no hay porcentaje que
// valga: se dice tal cual.
function contraAntes(actual: number, previo: number, dias: number) {
  if (!previo && !actual) return `sin ventas en los ${dias} días anteriores tampoco`
  if (!previo) return `los ${dias} días anteriores no tuviste ventas`
  const cambio = (actual - previo) / previo
  const signo = cambio > 0 ? "▲" : cambio < 0 ? "▼" : "="
  return `${signo} ${Math.abs(cambio * 100).toFixed(0)}% contra los ${dias} días anteriores`
}

const horasATexto = (h: number) => (h >= 48 ? `${Math.floor(h / 24)} días` : `${h} h`)

function PorEnviar({ datos }: { datos: RespuestaTablero }) {
  const lista = datos.por_enviar
  const tarde = lista.filter((p) => p.tarde).length
  return (
    <div style={tarde ? { ...S.card, border: "1px solid #E8B4A8" } : S.card}>
      <h2 style={S.h2}>
        Pedidos por enviar{" "}
        {lista.length > 0 && (
          <span style={{ ...S.pildora, background: tarde ? "#FDEDE8" : "#EEF4FB", color: tarde ? "#9B3225" : "#2B4C7E" }}>
            {lista.length}
          </span>
        )}
      </h2>
      <p style={S.nota}>
        Pagados y sin guía. Envía antes de 48 h: es lo que más cuida tu calificación.
      </p>
      {lista.length === 0 && <p style={S.ok}>Todo enviado. Vas al día.</p>}
      {lista.slice(0, 8).map((p) => (
        <div key={p.order_id} style={S.fila}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5 }}>
              <Link to={`/orders/${p.order_id}`} style={{ color: "inherit" }}>
                Pedido #{p.display_id ?? "—"}
              </Link>{" "}
              · {pesos(p.total, datos.moneda)}
            </p>
            <p style={S.pie}>{p.piezas}</p>
          </div>
          <span
            style={{
              ...S.pildora,
              whiteSpace: "nowrap",
              background: p.tarde ? "#FDEDE8" : "#F1EEE7",
              color: p.tarde ? "#9B3225" : "#6B675C",
            }}
          >
            {p.tarde ? `Tarde · ${horasATexto(p.horas)}` : `hace ${horasATexto(p.horas)}`}
          </span>
        </div>
      ))}
      {lista.length > 8 && <p style={S.pie}>Y {lista.length - 8} más en Pedidos.</p>}
    </div>
  )
}

const ETIQUETA_STOCK = {
  agotado: { texto: "Agotado", fondo: "#FDEDE8", color: "#9B3225" },
  se_acaba: { texto: "Se acaba pronto", fondo: "#FDF6E3", color: "#7A5B14" },
  bajo: { texto: "Quedan pocas", fondo: "#FDF6E3", color: "#7A5B14" },
}

function Existencias({ datos }: { datos: RespuestaTablero }) {
  return (
    <div style={S.card}>
      <h2 style={S.h2}>Existencias</h2>
      <p style={S.nota}>
        Lo agotado no se puede comprar, y vender lo que no tienes termina en cancelación. Calculado
        con lo que vendiste en los últimos 30 días.
      </p>
      {datos.stock.length === 0 && (
        <p style={S.ok}>Nada por resurtir. (Los productos que fabricas bajo pedido no aparecen aquí.)</p>
      )}
      {datos.stock.map((p) => {
        const e = ETIQUETA_STOCK[p.nivel]
        return (
          <div key={p.producto_id} style={S.fila}>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5 }}>
                <Link to={`/products/${p.producto_id}`} style={{ color: "inherit" }}>
                  {p.titulo}
                </Link>
              </p>
              <p style={S.pie}>
                {p.disponibles} disponible{p.disponibles === 1 ? "" : "s"}
                {p.dias_restantes !== null && p.disponibles > 0
                  ? ` · te alcanza para unos ${p.dias_restantes} día${p.dias_restantes === 1 ? "" : "s"}`
                  : ""}
              </p>
            </div>
            <span style={{ ...S.pildora, whiteSpace: "nowrap", background: e.fondo, color: e.color }}>{e.texto}</span>
          </div>
        )
      })}
    </div>
  )
}

const SEMAFORO = {
  verde: { texto: "Excelente", fondo: "#E8F3EA", color: "#1F5B29" },
  ambar: { texto: "Cuidado", fondo: "#FDF6E3", color: "#7A5B14" },
  rojo: { texto: "Atiende esto", fondo: "#FDEDE8", color: "#9B3225" },
  sin_datos: { texto: "Sin pedidos aún", fondo: "#F1EEE7", color: "#6B675C" },
}

function Reputacion({ datos }: { datos: RespuestaTablero }) {
  const r = datos.reputacion
  const s = SEMAFORO[r.semaforo]
  const cifra = (etiqueta: string, valor: string, pie?: string) => (
    <div>
      <p style={S.etiqueta}>{etiqueta}</p>
      <p style={S.cifraChica}>{valor}</p>
      {pie && <p style={S.pie}>{pie}</p>}
    </div>
  )
  return (
    <div style={S.card}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h2 style={S.h2}>Tu reputación como vendedor</h2>
        <span style={{ ...S.pildora, background: s.fondo, color: s.color }}>{s.texto}</span>
      </div>
      <p style={S.nota}>
        Últimos {r.dias} días. Es lo que hace que un cliente vuelva a comprarte, y lo que HETNA revisa
        para destacar talleres.
      </p>
      {r.pedidos > 0 && (
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
          {cifra(
            "Pedidos sin problema",
            porcentaje(r.pedidos_sin_problema, 0),
            `de ${r.pedidos} pedido${r.pedidos === 1 ? "" : "s"}`
          )}
          {cifra(
            "Envías en",
            r.envio_promedio_horas !== null ? horasATexto(r.envio_promedio_horas) : "—",
            "en promedio"
          )}
          {cifra("Enviados tarde", String(r.enviados_tarde), "más de 48 h")}
          {cifra("Cancelados", String(r.cancelados))}
          {cifra("Devoluciones", String(r.devoluciones))}
          {cifra("Reclamos", String(r.reclamos))}
        </div>
      )}
      {r.consejos.map((c) => (
        <p key={c} style={{ ...S.pie, fontSize: 12.5, color: "#4A463D" }}>
          • {c}
        </p>
      ))}
      {r.pedidos > 0 && r.consejos.length === 0 && <p style={S.ok}>Sin pendientes. Sigue así.</p>}
    </div>
  )
}

function Lista({
  titulo,
  nota,
  vacio,
  filas,
}: {
  titulo: string
  nota: string
  vacio: string
  filas: { clave: string; nombre: string; detalle: string }[]
}) {
  return (
    <div style={S.card}>
      <h2 style={S.h2}>{titulo}</h2>
      <p style={S.nota}>{nota}</p>
      {filas.length === 0 && <p style={S.vacio}>{vacio}</p>}
      {filas.map((f) => (
        <div key={f.clave} style={S.fila}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 13.5, minWidth: 0 }}>{f.nombre}</p>
          <p style={{ ...S.pie, margin: 0, whiteSpace: "nowrap" }}>{f.detalle}</p>
        </div>
      ))}
    </div>
  )
}

function Foro({ datos }: { datos: RespuestaTablero }) {
  const f = datos.foro

  return (
    <div style={S.card}>
      <h2 style={S.h2}>Tu actividad en el foro</h2>
      <p style={S.nota}>
        Contestar dudas te sube en el ranking y te trae clientes que te buscan por nombre.
      </p>

      {f.motivo === "sin_configurar" && (
        <p style={S.vacio}>El foro no está conectado a este panel todavía.</p>
      )}
      {f.motivo === "sin_abrir" && (
        <p style={S.vacio}>
          El Foro CNC todavía no abre. Cuando abra, lo que contestes ahí cuenta para tu
          ranking.
        </p>
      )}
      {f.motivo === "error" && (
        <p style={S.vacio}>No se pudo leer el foro en este momento. Vuelve a cargar más tarde.</p>
      )}
      {f.motivo === "sin_perfil" && (
        <p style={S.vacio}>
          Todavía no tienes perfil en el foro. Crearlo es gratis y es la forma más barata de que te
          conozcan.
        </p>
      )}

      {f.disponible && !f.motivo && (
        <>
          <p style={S.cifraChica}>
            {f.reputacion} <span style={{ fontSize: 13, fontWeight: 600, color: "#6B675C" }}>de reputación</span>
          </p>
          <p style={S.pie}>
            {f.usuario ? `@${f.usuario} · ` : ""}
            {f.temas} tema{f.temas === 1 ? "" : "s"} · {f.respuestas} respuesta
            {f.respuestas === 1 ? "" : "s"} · {f.votos_recibidos} voto
            {f.votos_recibidos === 1 ? "" : "s"} a favor
          </p>
          {f.mejores_respuestas > 0 && (
            <p style={S.ok}>
              {f.mejores_respuestas} de tus respuestas quedaron como la mejor del tema.
            </p>
          )}
        </>
      )}
    </div>
  )
}

function Cotizador({ datos }: { datos: RespuestaTablero }) {
  const c = datos.cotizador

  return (
    <div style={S.card}>
      <h2 style={S.h2}>Tus cotizaciones</h2>
      <p style={S.nota}>
        Lo que cotizas y lo que vendes, juntos: una cotización aceptada es venta que ya está
        comprometida.
      </p>

      {!c.vinculado && (
        <p style={S.vacio}>
          Tu cuenta de taller no está ligada al Cotizador. Se liga sola cuando entras al Cotizador
          con el mismo correo que usas aquí.
        </p>
      )}

      {c.vinculado && (
        <>
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap", marginBottom: 10 }}>
            <div>
              <p style={S.etiqueta}>Cerrado</p>
              <p style={S.cifraChica}>{pesos(c.monto_aceptado, datos.moneda)}</p>
              <p style={S.pie}>
                {c.aceptadas} de {c.enviadas} enviadas
              </p>
            </div>
            <div>
              <p style={S.etiqueta}>En juego</p>
              <p style={S.cifraChica}>{pesos(c.monto_en_juego, datos.moneda)}</p>
              <p style={S.pie}>enviadas y sin responder</p>
            </div>
            <div>
              <p style={S.etiqueta}>Tasa de cierre</p>
              <p style={S.cifraChica}>{porcentaje(c.tasa_cierre, 0)}</p>
              <p style={S.pie}>plan {c.plan || "gratis"}</p>
            </div>
          </div>
          {c.monto_en_juego > 0 && (
            <p style={S.pie}>
              Tienes {pesos(c.monto_en_juego, datos.moneda)} esperando respuesta. Darle seguimiento
              al día 3 es lo que más sube la tasa de cierre.
            </p>
          )}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- alta del taller

type EstadoAlta = {
  estado: string
  correo_confirmado: boolean
  correo: string
  puede_publicar: boolean
  mensaje: string | null
}

// Aviso arriba del tablero mientras la tienda no esté aprobada: primero que
// confirme su correo, luego que espere la revisión (lib/alta-taller.ts).
function AvisoAlta() {
  const [alta, setAlta] = useState<EstadoAlta | null>(null)
  const [nota, setNota] = useState("")
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetch("/vendor/hetna-alta", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EstadoAlta | null) => setAlta(d))
      .catch(() => setAlta(null))
  }, [])

  if (!alta || alta.puede_publicar || !alta.mensaje) return null

  const reenviar = async () => {
    setEnviando(true)
    setNota("")
    try {
      const r = await fetch("/vendor/hetna-alta/reenviar", { method: "POST", credentials: "include" })
      const d = (await r.json().catch(() => null)) as { message?: string; ya?: boolean } | null
      if (!r.ok) setNota(d?.message || "No se pudo mandar el correo.")
      else if (d?.ya) setNota("Tu correo ya está confirmado. Recarga la página.")
      else setNota(`Listo: te mandamos una liga nueva a ${alta.correo}. Revisa también spam.`)
    } finally {
      setEnviando(false)
    }
  }

  const sinCorreo = !alta.correo_confirmado && alta.estado === "pending_approval"
  return (
    <div
      role="status"
      style={{
        ...S.card,
        background: sinCorreo ? "#FFF6DB" : "#EEF4FB",
        borderColor: sinCorreo ? "#F0D58A" : "#C9DBF0",
      }}
    >
      <p style={{ ...S.h2, color: sinCorreo ? "#8A5A00" : "#1F4E79" }}>
        {sinCorreo ? "Confirma tu correo para continuar" : "Tu tienda está en revisión"}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.5 }}>{alta.mensaje}</p>
      {sinCorreo && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <button type="button" style={S.btn} disabled={enviando} onClick={() => void reenviar()}>
            {enviando ? "Enviando..." : "Reenviar la liga"}
          </button>
          {nota && <span style={{ fontSize: 13 }}>{nota}</span>}
        </div>
      )}
      {!sinCorreo && (
        <p style={{ ...S.nota, margin: "8px 0 0" }}>
          Mientras tanto puedes completar tu perfil y pedir la insignia de taller verificado.
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- pantalla

export default function TableroPage() {
  const [datos, setDatos] = useState<RespuestaTablero | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")

  // Sin setCargando(true) aquí: el estado ya arranca cargando, y ponerlo
  // desde el efecto dispara un render en cascada. Quien recarga a mano lo
  // enciende antes de llamar.
  const cargar = useCallback(() => {
    return fetch("/vendor/tablero", { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error("No se pudo cargar tu tablero.")
        return r.json()
      })
      .then((d: RespuestaTablero) => {
        setDatos(d)
        setError("")
      })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "Error al cargar."))
      .finally(() => setCargando(false))
  }, [])

  useEffect(() => {
    void cargar()
  }, [cargar])

  const guardarMeta = async (objetivo: number) => {
    const r = await fetch("/vendor/tablero/meta", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ objetivo }),
    })
    if (!r.ok) {
      const cuerpo = (await r.json().catch(() => null)) as { message?: string } | null
      throw new Error(cuerpo?.message || "No se pudo guardar la meta.")
    }
    await cargar()
  }

  if (cargando && !datos) {
    return (
      <div style={S.page}>
        <p style={S.sub}>Cargando tu tablero...</p>
      </div>
    )
  }

  if (error && !datos) {
    return (
      <div style={S.page}>
        <p style={S.err}>{error}</p>
        <button
          type="button"
          style={S.btn}
          onClick={() => {
            setCargando(true)
            void cargar()
          }}
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (!datos) return null

  const v = datos.ventas

  return (
    <div style={S.page}>
      <h1 style={S.h1}>Mi tablero</h1>
      <p style={S.sub}>
        Tu taller en {nombreDelMes(datos.mes)}. Las gráficas y los conteos son de los últimos{" "}
        {v.ventana_dias} días.
      </p>

      <AvisoAlta />

      <MetaDelMes datos={datos} onGuardar={guardarMeta} />

      <div style={S.dosColumnas}>
        <PorEnviar datos={datos} />
        <Existencias datos={datos} />
      </div>

      <div style={S.rejilla}>
        <Tarjeta
          etiqueta="Vendido este mes"
          valor={pesos(v.ingresos_mes, datos.moneda)}
          pie={`${v.pedidos_mes} pedido${v.pedidos_mes === 1 ? "" : "s"}`}
        />
        <Tarjeta
          etiqueta={`Vendido (${v.ventana_dias} días)`}
          valor={pesos(v.ingresos_totales, datos.moneda)}
          pie={contraAntes(v.ingresos_totales, v.ingresos_previos, v.ventana_dias)}
        />
        <Tarjeta
          etiqueta={`Pedidos (${v.ventana_dias} días)`}
          valor={String(v.total_pedidos)}
          pie={contraAntes(v.total_pedidos, v.pedidos_previos, v.ventana_dias)}
        />
        <Tarjeta
          etiqueta="Ticket promedio"
          valor={pesos(v.ticket_promedio, datos.moneda)}
          pie="por pedido"
        />
        <Tarjeta
          etiqueta="Visitas a tus fichas"
          valor={datos.vistas.total.toLocaleString("es-MX")}
          pie={`${datos.catalogo_total} producto${datos.catalogo_total === 1 ? "" : "s"} publicado${
            datos.catalogo_total === 1 ? "" : "s"
          }`}
        />
        <Tarjeta
          etiqueta="De cada 100 visitas"
          valor={
            datos.vistas.conversion !== null
              ? `${(datos.vistas.conversion * 100).toFixed(1)} piezas`
              : "—"
          }
          pie="terminan en venta"
        />
        <Tarjeta
          etiqueta="Tu calificación"
          valor={datos.resenas.promedio !== null ? `${datos.resenas.promedio} ★` : "—"}
          pie={
            datos.resenas.total
              ? `${datos.resenas.total} reseña${datos.resenas.total === 1 ? "" : "s"}`
              : "sin reseñas todavía"
          }
        />
      </div>

      <div style={S.card}>
        <h2 style={S.h2}>Lo que vendiste día por día</h2>
        <p style={S.nota}>Pasa el cursor sobre una barra para ver el día.</p>
        <Ventas30 dias={v.por_dia} moneda={datos.moneda} />
      </div>

      <Reputacion datos={datos} />

      <Descuentos datos={datos} />

      <div style={S.dosColumnas}>
        <Lista
          titulo="Lo que más te visitan"
          nota="Tus fichas con más visitas en los últimos 30 días."
          vacio="Todavía nadie entra a tus fichas, o el contador acaba de empezar a correr."
          filas={datos.vistas.productos.map((p) => ({
            clave: p.producto_id,
            nombre: p.titulo,
            detalle: `${p.vistas} visitas · ${p.unidades_vendidas} vendida${
              p.unidades_vendidas === 1 ? "" : "s"
            }`,
          }))}
        />
        <Lista
          titulo="Lo que más vendes"
          nota="Por piezas vendidas en los últimos 30 días."
          vacio="Todavía no tienes ventas en este periodo."
          filas={datos.productos_top.map((p) => ({
            clave: p.producto_id,
            nombre: p.titulo,
            detalle: `${p.cantidad} pieza${p.cantidad === 1 ? "" : "s"} · ${pesos(
              p.ingresos,
              datos.moneda
            )}`,
          }))}
        />
      </div>

      <div style={S.dosColumnas}>
        <Ranking datos={datos} />
        <Foro datos={datos} />
      </div>

      <Cotizador datos={datos} />
    </div>
  )
}
