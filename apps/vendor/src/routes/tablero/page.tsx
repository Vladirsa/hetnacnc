// Inicio del taller (antes "Mi tablero"): lo primero que ve al entrar a /seller.
// Arriba: resumen-inicio.tsx (saludo, siguiente paso, 3 números, solicitudes).
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

import { AvisoRequisitos } from "../../lib/requisitos"
import { ResumenInicio } from "./resumen-inicio"

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
  label: "Inicio",
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
  total_productos?: number
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
    background: "rgba(255,255,255,0.78)",
    WebkitBackdropFilter: "blur(14px) saturate(1.2)",
    backdropFilter: "blur(14px) saturate(1.2)",
    border: "1px solid rgba(20,32,51,0.06)",
    boxShadow: "0 8px 24px -12px rgba(20,32,51,0.18)",
    borderRadius: 16,
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

function AvisoAlta({ onEstado }: { onEstado?: (a: EstadoAlta | null) => void }) {
  const [alta, setAlta] = useState<EstadoAlta | null>(null)
  const [nota, setNota] = useState("")
  const [enviando, setEnviando] = useState(false)

  useEffect(() => {
    fetch("/vendor/hetna-alta", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: EstadoAlta | null) => {
        setAlta(d)
        onEstado?.(d)
      })
      .catch(() => {
        setAlta(null)
        onEstado?.(null)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

// "Invita a otro taller" (packages/api/src/lib/referidos.ts). Además, si este
// taller llegó por la liga de otro (cookie hetna_ref que guarda la tienda en
// /talleres/unete?ref=...), lo liga una sola vez con quien lo invitó.
type Referidos = {
  liga: string | null
  embajador: boolean
  para_embajador: number
  invitados: { nombre: string; estado: string; activo: boolean }[]
}

function InvitaTaller() {
  const [d, setD] = useState<Referidos | null>(null)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const m = document.cookie.match(/(?:^|; )hetna_ref=([a-z0-9_-]{1,80})/)
    const ligar = m
      ? fetch("/vendor/hetna-referidos", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref: m[1] }),
        })
          .catch(() => null)
          .finally(() => {
            document.cookie = "hetna_ref=; path=/; max-age=0"
          })
      : Promise.resolve(null)
    ligar
      .then(() => fetch("/vendor/hetna-referidos", { credentials: "include" }))
      .then((r) => (r.ok ? r.json() : null))
      .then(setD)
      .catch(() => setD(null))
  }, [])

  if (!d?.liga) return null
  const mensaje = `Te invito a HETNA CNC, el marketplace de talleres CNC de México: llegan solicitudes de clientes y publicar es gratis. Regístrate aquí: ${d.liga}`
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(d.liga!)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      /* sin portapapeles */
    }
  }
  const activos = d.invitados.filter((i) => i.activo).length
  return (
    <div style={{ ...S.card, background: "#EEF2FB", borderColor: "#C9DBF0" }}>
      <p style={{ ...S.h2, color: "#1a3a5c" }}>
        {d.embajador ? "🤝 Eres Taller embajador" : "🤝 Invita a otro taller"}
      </p>
      <p style={{ margin: "4px 0 10px", fontSize: 14, lineHeight: 1.5 }}>
        {d.embajador
          ? "Gracias por traer talleres de confianza. Tu perfil lleva la insignia y sales entre los primeros del directorio."
          : `Cuando un taller que invites quede activo y publique, recibes la insignia de Taller embajador y sales entre los primeros del directorio. Entre más talleres, más clientes llegan a todos.`}
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input readOnly value={d.liga} style={{ ...S.input, flex: "1 1 260px", minWidth: 0 }} onFocus={(e) => e.currentTarget.select()} />
        <button type="button" style={S.btn} onClick={() => void copiar()}>
          {copiado ? "¡Copiada!" : "Copiar liga"}
        </button>
        <a
          style={{ ...S.btn, background: "#1E7B3A", textDecoration: "none", display: "inline-block" }}
          href={`https://wa.me/?text=${encodeURIComponent(mensaje)}`}
          target="_blank"
          rel="noreferrer"
        >
          Mandar por WhatsApp
        </a>
      </div>
      {d.invitados.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <p style={S.etiqueta}>
            Talleres que invitaste: {d.invitados.length} ({activos} {activos === 1 ? "activo" : "activos"})
          </p>
          <ul style={{ margin: "6px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
            {d.invitados.slice(0, 10).map((i, n) => (
              <li key={n}>
                {i.nombre}: <span style={{ color: i.activo ? "#1E7B3A" : "#6B675C" }}>{i.estado}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// Comparador de proveedores (packages/api/src/lib/comparador-proveedores.ts):
// el taller escribe qué busca y recibe hasta 3 opciones comparadas.
type OpcionProveedor = { proveedor: string; producto: string; precio: string; envio: string; garantia: string; pais: string; url: string; nota: string }
function ComparadorProveedores() {
  const [consulta, setConsulta] = useState("")
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState("")
  const [r, setR] = useState<{ en_hetna: { nombre: string; liga: string }[]; opciones: OpcionProveedor[]; consejo: string } | null>(null)

  const buscar = async () => {
    setCargando(true)
    setError("")
    setR(null)
    try {
      const res = await fetch("/vendor/hetna-comparador", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consulta }),
      })
      const d = await res.json().catch(() => null)
      if (!res.ok) throw new Error(d?.message || "No se pudo buscar.")
      setR(d)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setCargando(false)
    }
  }

  return (
    <div style={{ ...S.card }}>
      <p style={S.h2}>🔧 ¿Buscas una máquina, refacción o herramienta?</p>
      <p style={{ margin: "4px 0 10px", fontSize: 14, lineHeight: 1.5 }}>
        Escribe qué necesitas y te comparamos hasta 3 opciones (precio, envío y garantía), primero en HETNA y luego con distribuidores.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          value={consulta}
          onChange={(e) => setConsulta(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && consulta.trim().length >= 3 && !cargando) void buscar()
          }}
          placeholder="Ej.: husillo 2.2 kW enfriado por agua, fresa compresión 1/4, láser de fibra 1500 W"
          style={{ ...S.input, flex: "1 1 300px", minWidth: 0 }}
        />
        <button type="button" style={{ ...S.btn, opacity: cargando || consulta.trim().length < 3 ? 0.5 : 1 }} disabled={cargando || consulta.trim().length < 3} onClick={() => void buscar()}>
          {cargando ? "Buscando (≈1 min)…" : "Comparar"}
        </button>
      </div>
      {error && <p style={{ color: "#B42318", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}
      {r && (
        <div style={{ marginTop: 12 }}>
          {r.en_hetna.length > 0 && (
            <p style={{ margin: "0 0 8px", fontSize: 14 }}>
              <b>En HETNA:</b>{" "}
              {r.en_hetna.slice(0, 3).map((p, i) => (
                <span key={p.liga}>
                  {i > 0 && " · "}
                  <a href={p.liga} target="_blank" rel="noreferrer">
                    {p.nombre}
                  </a>
                </span>
              ))}
            </p>
          )}
          {r.opciones.map((o) => (
            <div key={o.url} style={{ borderTop: "1px solid #E7E4DC", padding: "8px 0", fontSize: 14 }}>
              <p style={{ margin: 0, fontWeight: 700 }}>
                {o.proveedor} <span style={{ fontWeight: 400, color: "#6B675C" }}>({o.pais})</span>
              </p>
              <p style={{ margin: "2px 0" }}>{o.producto}</p>
              <p style={{ margin: "2px 0", color: "#40403A" }}>
                💲 {o.precio} · 🚚 {o.envio} · 🛡 {o.garantia}
              </p>
              <p style={{ margin: "2px 0", color: "#6B675C", fontSize: 13 }}>{o.nota}</p>
              <a href={o.url} target="_blank" rel="noreferrer nofollow" style={{ fontSize: 13 }}>
                Ver en su página ↗
              </a>
            </div>
          ))}
          {!r.opciones.length && !r.en_hetna.length && <p style={{ fontSize: 14 }}>No encontré opciones claras. Prueba con otras palabras o la marca y el modelo.</p>}
          {r.consejo && <p style={{ margin: "8px 0 0", fontSize: 14, background: "#F7F5F0", padding: 10, borderRadius: 8 }}>💡 {r.consejo}</p>}
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "#6B675C" }}>Precios tomados de las páginas de cada proveedor; confírmalos antes de comprar.</p>
        </div>
      )}
    </div>
  )
}

// Agente SEO (packages/api/src/lib/seo-titulos.ts): títulos sugeridos con lo
// que la gente busca en Google. El taller acepta o descarta cada uno.
type SugerenciaSeo = { id: string; titulo: string; sugerencia: { titulo_visible: string; titulo_seo: string; meta_description: string; keyword_principal: string; motivo: string } }
function SugerenciasSeo() {
  const [lista, setLista] = useState<SugerenciaSeo[]>([])
  const [ocupado, setOcupado] = useState("")
  const [hecho, setHecho] = useState(0)

  useEffect(() => {
    fetch("/vendor/hetna-seo", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setLista(d?.sugerencias || []))
      .catch(() => setLista([]))
  }, [])

  const responder = async (id: string, accion: "aceptar" | "descartar") => {
    setOcupado(id)
    try {
      const r = await fetch("/vendor/hetna-seo", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: id, accion }),
      })
      if (r.ok) {
        setLista((l) => l.filter((x) => x.id !== id))
        if (accion === "aceptar") setHecho((n) => n + 1)
      }
    } finally {
      setOcupado("")
    }
  }

  if (!lista.length && !hecho) return null
  return (
    <div style={{ ...S.card, background: "#F3F8F1", borderColor: "#CFE2C8" }}>
      <p style={S.h2}>🔎 Que te encuentren en Google</p>
      <p style={{ margin: "4px 0 10px", fontSize: 14, lineHeight: 1.5 }}>
        Revisamos lo que la gente escribe en Google y te sugerimos un mejor título para tus productos. La dirección de tu producto no cambia.
      </p>
      {hecho > 0 && <p style={{ margin: "0 0 10px", fontSize: 14, color: "#1E7B3A", fontWeight: 600 }}>✓ {hecho} título(s) actualizado(s).</p>}
      {lista.slice(0, 5).map((x) => (
        <div key={x.id} style={{ borderTop: "1px solid #DDE8D8", padding: "10px 0" }}>
          <p style={{ ...S.etiqueta, margin: 0 }}>Ahora: {x.titulo}</p>
          <p style={{ margin: "4px 0", fontSize: 15, fontWeight: 700 }}>Sugerido: {x.sugerencia.titulo_visible}</p>
          <p style={{ margin: "0 0 6px", fontSize: 13, color: "#55534C" }}>
            Se busca como «{x.sugerencia.keyword_principal}». {x.sugerencia.motivo}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" style={S.btn} disabled={ocupado === x.id} onClick={() => void responder(x.id, "aceptar")}>
              Usar este título
            </button>
            <button type="button" style={{ ...S.btn, background: "#fff", color: "#55534C", border: "1px solid #D9D6CC" }} disabled={ocupado === x.id} onClick={() => void responder(x.id, "descartar")}>
              No, gracias
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

// Buzón de opiniones (packages/api/src/lib/opiniones.ts): qué mejorarías de
// HETNA. Llega al dueño por Telegram y al panel de administración (Opiniones).
function QueMejorarias() {
  const [abierto, setAbierto] = useState(false)
  const [puntaje, setPuntaje] = useState<number | null>(null)
  const [comentario, setComentario] = useState("")
  const [estado, setEstado] = useState<"" | "enviando" | "listo">("")
  const [error, setError] = useState("")

  const enviar = async () => {
    setEstado("enviando")
    setError("")
    try {
      const r = await fetch("/vendor/hetna-opinion", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ puntaje, comentario, pagina: "Tablero del taller" }),
      })
      const d = await r.json().catch(() => null)
      if (!r.ok) throw new Error(d?.message || "No se pudo enviar. Intenta de nuevo.")
      setEstado("listo")
    } catch (e) {
      setEstado("")
      setError((e as Error).message)
    }
  }

  if (estado === "listo")
    return (
      <div style={{ ...S.card, background: "#F1F8F2", borderColor: "#CFE6D3" }}>
        <p style={{ ...S.h2, color: "#1E7B3A" }}>¡Gracias! Ya lo recibimos.</p>
        <p style={{ margin: "4px 0 0", fontSize: 14 }}>Lo lee directamente el equipo de HETNA. Si es una idea, te avisamos cuando la tengamos lista.</p>
      </div>
    )

  return (
    <div style={{ ...S.card, background: "#FBF7EE", borderColor: "#EADFC4" }}>
      <p style={S.h2}>💡 ¿Qué mejorarías de HETNA?</p>
      <p style={{ margin: "4px 0 10px", fontSize: 14, lineHeight: 1.5 }}>
        Estamos construyendo la plataforma con los talleres. Dinos qué te falta, qué no te gusta o qué te gustaría que inventáramos.
      </p>
      {!abierto ? (
        <button type="button" style={S.btn} onClick={() => setAbierto(true)}>
          Dar mi opinión
        </button>
      ) : (
        <>
          <p style={{ ...S.etiqueta, marginBottom: 6 }}>Del 0 al 10, ¿recomendarías HETNA a otro taller? (opcional)</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(11, 1fr)", gap: 4, maxWidth: 460 }}>
            {Array.from({ length: 11 }, (_, n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPuntaje(puntaje === n ? null : n)}
                style={{
                  height: 34,
                  borderRadius: 6,
                  border: "1px solid #E7E4DC",
                  fontWeight: 700,
                  cursor: "pointer",
                  background: puntaje === n ? "#C2560A" : n <= 6 ? "#FBF1EC" : n <= 8 ? "#FBF6E7" : "#EEF7EF",
                  color: puntaje === n ? "#fff" : "#1B1B18",
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <textarea
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
            maxLength={2000}
            rows={4}
            placeholder="Ej.: quiero recibir las solicitudes de mi ciudad por WhatsApp, o poder subir varios productos a la vez…"
            style={{ ...S.input, width: "100%", marginTop: 10, fontFamily: "inherit", boxSizing: "border-box" }}
          />
          {error && <p style={{ color: "#B42318", fontSize: 13, margin: "6px 0 0" }}>{error}</p>}
          <button
            type="button"
            style={{ ...S.btn, marginTop: 8, opacity: estado === "enviando" || (puntaje === null && comentario.trim().length < 3) ? 0.5 : 1 }}
            disabled={estado === "enviando" || (puntaje === null && comentario.trim().length < 3)}
            onClick={() => void enviar()}
          >
            {estado === "enviando" ? "Enviando…" : "Enviar"}
          </button>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- pantalla

// Avisos al celular del taller (packages/api/src/lib/push.ts): pedidos nuevos,
// solicitudes de fabricación, respuestas de clientes. Usa el service worker de
// la tienda (/sw.js), que vive en el mismo dominio que este panel.
const aBytes = (b64: string) => {
  const relleno = "=".repeat((4 - (b64.length % 4)) % 4)
  const crudo = atob((b64 + relleno).replace(/-/g, "+").replace(/_/g, "/"))
  return Uint8Array.from(crudo, (c) => c.charCodeAt(0))
}
const dispositivo = () => {
  const ua = navigator.userAgent
  return /iphone|ipad/i.test(ua) ? "iPhone/iPad" : /android/i.test(ua) ? "Android" : /windows/i.test(ua) ? "Windows" : /mac/i.test(ua) ? "Mac" : "Navegador"
}

function AvisosCelular() {
  const [estado, setEstado] = useState<"cargando" | "nada" | "ios" | "bloqueado" | "inactivo" | "activo" | "activando">("cargando")
  const [nota, setNota] = useState("")

  useEffect(() => {
    let vivo = true
    ;(async () => {
      const soporta = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window
      const ios = /iphone|ipad|ipod/i.test(navigator.userAgent)
      if (!soporta) return vivo && setEstado(ios ? "ios" : "nada")
      if (Notification.permission === "denied") return vivo && setEstado("bloqueado")
      try {
        const reg = await navigator.serviceWorker.getRegistration("/")
        const sub = reg ? await reg.pushManager.getSubscription() : null
        if (sub && Notification.permission === "granted") {
          const r = await fetch(`/vendor/hetna-push?endpoint=${encodeURIComponent(sub.endpoint)}`, { credentials: "include" })
          const d = (await r.json().catch(() => null)) as { activo?: boolean } | null
          if (d?.activo) return vivo && setEstado("activo")
        }
      } catch {
        /* inactivo */
      }
      if (vivo) setEstado("inactivo")
    })()
    return () => {
      vivo = false
    }
  }, [])

  const activar = async () => {
    setNota("")
    setEstado("activando")
    try {
      const permiso = await Notification.requestPermission()
      if (permiso !== "granted") return setEstado(permiso === "denied" ? "bloqueado" : "inactivo")
      const r0 = await fetch("/vendor/hetna-push", { credentials: "include" })
      const { llave } = ((await r0.json().catch(() => ({}))) || {}) as { llave?: string | null }
      if (!llave) {
        setNota("Los avisos todavía no están disponibles. Intenta más tarde.")
        return setEstado("inactivo")
      }
      const reg = (await navigator.serviceWorker.getRegistration("/")) || (await navigator.serviceWorker.register("/sw.js", { scope: "/" }))
      await navigator.serviceWorker.ready
      const sub = (await reg.pushManager.getSubscription()) || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: aBytes(llave) }))
      const r = await fetch("/vendor/hetna-push", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suscripcion: sub.toJSON(), dispositivo: dispositivo() }),
      })
      if (!r.ok) {
        const d = (await r.json().catch(() => null)) as { message?: string } | null
        setNota(d?.message || "No se pudieron activar.")
        return setEstado("inactivo")
      }
      setNota("Listo: te mandamos un aviso de prueba.")
      setEstado("activo")
    } catch {
      setNota("No se pudieron activar los avisos en este navegador.")
      setEstado("inactivo")
    }
  }

  const desactivar = async () => {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/")
      const sub = reg ? await reg.pushManager.getSubscription() : null
      if (sub)
        await fetch("/vendor/hetna-push", {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: sub.endpoint }),
        })
    } catch {
      /* nada */
    }
    setNota("")
    setEstado("inactivo")
  }

  if (estado === "cargando" || estado === "nada") return null
  const activo = estado === "activo"
  return (
    <div style={{ ...S.card, background: activo ? "#EEF8F2" : "#FFF8EE", borderColor: activo ? "#BFE3CF" : "#F2C98F" }}>
      <p style={S.h2}>{activo ? "🔔 Avisos activados en este dispositivo" : "🔔 Recibe tus pedidos en el celular"}</p>
      <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.5 }}>
        {estado === "ios"
          ? "En iPhone, abre hetnacnc.com/seller en Safari, toca Compartir y luego \"Agregar a inicio\". Entra desde ese icono y activa los avisos."
          : estado === "bloqueado"
            ? "Bloqueaste los avisos en este navegador. Actívalos en los ajustes del sitio (el candado junto a la dirección)."
            : "Te avisamos al momento de pedidos nuevos, solicitudes de fabricación, cuando ganas una y cuando un cliente te responde. Responder rápido te da más ventas."}
      </p>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
        {(estado === "inactivo" || estado === "activando") && (
          <button type="button" style={S.btn} disabled={estado === "activando"} onClick={() => void activar()}>
            {estado === "activando" ? "Activando..." : "Activar avisos"}
          </button>
        )}
        {activo && (
          <button type="button" style={{ background: "none", border: "none", textDecoration: "underline", cursor: "pointer", fontSize: 13 }} onClick={() => void desactivar()}>
            Desactivar
          </button>
        )}
        {nota && <span style={{ fontSize: 13 }}>{nota}</span>}
      </div>
    </div>
  )
}

// Taller aprobado y sin un solo producto: la invitación más importante del
// tablero. Sin productos no hay ventas, así que va arriba de todo.
function PrimerProducto() {
  return (
    <div role="status" style={{ ...S.card, background: "#FFF3E8", borderColor: "#F5C8A0" }}>
      <p style={{ ...S.h2, color: "#A84A08" }}>Publica tu primer producto en 2 minutos</p>
      <p style={{ margin: "4px 0 0", fontSize: 14, lineHeight: 1.5 }}>
        Tu tienda ya está lista, pero los clientes todavía no encuentran nada tuyo. Sube una foto, ponle precio y
        listo: HETNA lo anuncia en Google, en el catálogo y en los correos de novedades, sin costo. Sólo pagas comisión
        cuando vendes.
      </p>
      <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 13.5, lineHeight: 1.6 }}>
        <li>Piezas, refacciones, fresas, materiales o trabajos que ya fabricas.</li>
        <li>Archivos (DXF, STL, G-code), cursos y libros en PDF también cuentan.</li>
        <li>Con 3 productos o más, tu tienda sale mejor posicionada.</li>
      </ul>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
        <Link to="/publicar" style={{ ...S.btn, textDecoration: "none", display: "inline-block" }}>
          Publicar mi primer producto
        </Link>
      </div>
    </div>
  )
}


// Lista de precios y comisiones de HETNA (GET /vendor/hetna-tarifas, la misma
// de los Términos para vendedores). Plegada para no estorbar el tablero.
type GrupoTarifas = { id: string; titulo: string; texto?: string; filas: { concepto: string; precio: string; nota?: string }[] }

function Tarifas() {
  const [grupos, setGrupos] = useState<GrupoTarifas[] | null>(null)
  useEffect(() => {
    fetch("/vendor/hetna-tarifas", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setGrupos(d?.grupos || []))
      .catch(() => setGrupos([]))
  }, [])
  if (!grupos?.length) return null
  return (
    <div style={S.card}>
      <h2 style={S.h2}>Precios y comisiones de HETNA</h2>
      <p style={S.nota}>
        Lo que cuesta cada servicio. Es la misma lista de los{" "}
        <a href="https://hetnacnc.com/mx/terminos-vendedores#tarifas" target="_blank" rel="noreferrer" style={{ color: "#B34D07" }}>
          Términos para vendedores
        </a>
        .
      </p>
      {grupos.map((g) => (
        <details key={g.id} style={{ borderTop: "1px solid #F1EEE7", padding: "8px 0" }}>
          <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>{g.titulo}</summary>
          {g.texto && <p style={{ ...S.nota, margin: "6px 0 4px" }}>{g.texto}</p>}
          {g.filas.map((f) => (
            <div key={f.concepto} style={S.fila}>
              <span style={{ fontSize: 13.5 }}>
                {f.concepto}
                {f.nota && <span style={{ display: "block", color: "#8A857A", fontSize: 12 }}>{f.nota}</span>}
              </span>
              <strong style={{ fontSize: 13.5, whiteSpace: "nowrap" }}>{f.precio}</strong>
            </div>
          ))}
        </details>
      ))}
    </div>
  )
}

export default function TableroPage() {
  const [datos, setDatos] = useState<RespuestaTablero | null>(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState("")
  const [puedePublicar, setPuedePublicar] = useState(false)

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
      <ResumenInicio datos={datos} />

      <AvisoAlta onEstado={(a) => setPuedePublicar(!!a?.puede_publicar)} />
      <AvisoRequisitos />

      {puedePublicar && datos.total_productos === 0 && <PrimerProducto />}

      <AvisosCelular />

      <InvitaTaller />
      <SugerenciasSeo />
      <ComparadorProveedores />
      <QueMejorarias />

      <h2 style={{ ...S.h2, fontSize: 17, margin: "8px 0 2px" }}>Tu taller en {nombreDelMes(datos.mes)}</h2>
      <p style={S.sub}>Las gráficas y los conteos son de los últimos {v.ventana_dias} días.</p>

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

      <Tarifas />
    </div>
  )
}
