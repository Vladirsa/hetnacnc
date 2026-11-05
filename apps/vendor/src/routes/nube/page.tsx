// @ts-nocheck
// Panel del taller > HetNa Cloud: la nube organizada como se trabaja.
//
//   CLIENTE → PROYECTO → PIEZA → ARCHIVOS (revisión + estado)
//
// Todo vive en el bucket privado (ligas firmadas de 1 hora). Las licitaciones
// que gana el taller entran solas como proyecto con los archivos del cliente.
// Rutas: /vendor/hetna-cloud/* (packages/api/src/api/vendor/hetna-cloud).
import { useEffect, useMemo, useState } from "react"
import { Badge, Button, Container, Heading, Input, Label, Text, Textarea, toast } from "@medusajs/ui"
import { CloudArrowUp } from "@medusajs/icons"
import type { RouteConfig } from "@mercurjs/dashboard-sdk"

import { svgQR } from "../../lib/qr"

export const config: RouteConfig = {
  label: "HetNa Cloud",
  icon: CloudArrowUp,
  rank: 5,
}

const API = "/vendor/hetna-cloud"
const MAX_MB = 50
const GB = 1024 ** 3

const ESTADOS = { borrador: "Borrador", probado: "Probado en máquina", liberado: "Liberado" }
const COLOR_ESTADO = { borrador: "grey", probado: "orange", liberado: "green" }
const ESTADOS_PROYECTO = { activo: "Activo", produccion: "En producción", entregado: "Entregado", archivado: "Archivado" }
const CATEGORIAS = {
  plano: "Plano",
  modelo: "Modelo 3D",
  vector: "Vector",
  cam: "CAM",
  gcode: "G-code",
  foto: "Foto",
  documento: "Documento",
  otro: "Otro",
}

const SELECT = {
  height: 32,
  borderRadius: 6,
  border: "1px solid var(--border-base, #E4E4E7)",
  background: "var(--bg-field, #fff)",
  padding: "0 8px",
  fontSize: 13,
}

const tamano = (b: number) =>
  b >= GB ? `${(b / GB).toFixed(2)} GB` : b >= 1024 ** 2 ? `${(b / 1024 ** 2).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`
const fecha = (s: string) => new Date(s).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })

async function api(ruta: string, init: RequestInit = {}) {
  const r = await fetch(`${API}${ruta}`, {
    credentials: "include",
    ...init,
    headers: init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json", ...(init.headers || {}) } : init.headers,
  })
  const d = await r.json().catch(() => ({}))
  if (!r.ok) {
    if (r.status === 413 && !d.message) throw new Error(`El archivo pesa más de ${MAX_MB} MB.`)
    throw new Error(d.message || "Algo salió mal. Intenta de nuevo.")
  }
  return d
}

// ---------------------------------------------------------------------
// Página
// ---------------------------------------------------------------------

export default function NubePage() {
  const [datos, setDatos] = useState(null)
  const [error, setError] = useState("")
  const [abierto, setAbierto] = useState<string | null>(null)
  const [buscar, setBuscar] = useState("")
  const [filtroEstado, setFiltroEstado] = useState("vigentes")
  const [nuevo, setNuevo] = useState(false)
  const [trayendo, setTrayendo] = useState(false)

  const cargar = async (sel?: string) => {
    try {
      const d = await api("")
      setDatos(d)
      if (d.importadas > 0) toast.success(`Se agregaron ${d.importadas} trabajos de licitaciones que ganaste.`)
      if (sel) setAbierto(sel)
    } catch (e) {
      setError(e.message)
    }
  }
  useEffect(() => {
    cargar()
  }, [])

  const clientes = datos?.clientes || []
  const nombreCliente = (id) => clientes.find((c) => c.id === id)?.nombre || ""
  const proyectos = useMemo(() => {
    const q = buscar.trim().toLowerCase()
    return (datos?.proyectos || []).filter((p) => {
      if (filtroEstado === "vigentes" && p.estado === "archivado") return false
      if (filtroEstado !== "vigentes" && filtroEstado !== "todos" && p.estado !== filtroEstado) return false
      return !q || p.nombre.toLowerCase().includes(q) || nombreCliente(p.cliente_id).toLowerCase().includes(q)
    })
  }, [datos, buscar, filtroEstado])

  if (error) {
    return (
      <Container className="p-6">
        <Heading>HetNa Cloud</Heading>
        <Text className="mt-2 text-ui-fg-error">{error}</Text>
      </Container>
    )
  }
  if (!datos) {
    return (
      <Container className="p-6">
        <Text>Cargando tu nube…</Text>
      </Container>
    )
  }

  if (abierto) {
    return (
      <Proyecto
        id={abierto}
        clientes={clientes}
        uso={datos.uso}
        onVolver={() => {
          setAbierto(null)
          cargar()
        }}
        onCambio={() => cargar(abierto)}
      />
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <Container className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Heading>HetNa Cloud</Heading>
            <Text className="mt-1 text-ui-fg-subtle">
              Tus planos, modelos, proyectos CAM y G-code ordenados por cliente, proyecto y pieza, con revisiones y estado (borrador → probado → liberado).
              Las licitaciones que ganas y tus trabajos del servicio CAM de HETNA se agregan solos.
            </Text>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              isLoading={trayendo}
              onClick={async () => {
                setTrayendo(true)
                try {
                  const r = await api("/importar-pedidos", { method: "POST" })
                  toast.success(r.importados ? `Se agregaron ${r.importados} pedidos como proyectos.` : "No hay pedidos pagados nuevos (últimos 90 días).")
                  cargar()
                } catch (e) {
                  toast.error(e.message)
                } finally {
                  setTrayendo(false)
                }
              }}
            >
              Traer mis pedidos
            </Button>
            <Button onClick={() => setNuevo(!nuevo)}>{nuevo ? "Cancelar" : "Nuevo proyecto"}</Button>
          </div>
        </div>
        <Uso uso={datos.uso} />
        {nuevo && (
          <FormProyecto
            clientes={clientes}
            onListo={(p) => {
              setNuevo(false)
              cargar(p.id)
            }}
          />
        )}
      </Container>

      <Container className="p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Input placeholder="Buscar proyecto o cliente" value={buscar} onChange={(e) => setBuscar(e.target.value)} className="max-w-xs" />
          <select value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)} style={SELECT} aria-label="Estado">
            <option value="vigentes">Vigentes</option>
            {Object.entries(ESTADOS_PROYECTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
            <option value="todos">Todos</option>
          </select>
        </div>
        {proyectos.length ? (
          <div className="flex flex-col divide-y divide-ui-border-base">
            {proyectos.map((p) => (
              <button
                key={p.id}
                onClick={() => setAbierto(p.id)}
                className="flex flex-wrap items-center justify-between gap-2 py-3 text-left hover:bg-ui-bg-base-hover"
              >
                <div className="min-w-0">
                  <Text weight="plus" className="truncate">
                    {p.nombre}
                  </Text>
                  <Text size="small" className="text-ui-fg-subtle">
                    {[nombreCliente(p.cliente_id), `${p.archivos} archivo${p.archivos === 1 ? "" : "s"}`, p.bytes ? tamano(p.bytes) : "", `actualizado ${fecha(p.updated_at)}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </Text>
                </div>
                <div className="flex gap-2">
                  {p.origen_tipo === "licitacion" && <Badge size="2xsmall">Licitación</Badge>}
                  {p.origen_tipo === "cam" && <Badge size="2xsmall" color="purple">CAM</Badge>}
                  {p.origen_tipo === "pedido" && <Badge size="2xsmall" color="blue">Pedido</Badge>}
                  <Badge size="2xsmall" color={p.estado === "entregado" ? "green" : p.estado === "produccion" ? "orange" : "grey"}>
                    {ESTADOS_PROYECTO[p.estado] || p.estado}
                  </Badge>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <Text className="text-ui-fg-subtle">
            {datos.proyectos.length ? "Ningún proyecto con ese filtro." : "Todavía no tienes proyectos. Crea el primero o gana una licitación y aparece aquí."}
          </Text>
        )}
      </Container>

      <Clientes clientes={clientes} onCambio={() => cargar()} />
    </div>
  )
}

function Uso({ uso }) {
  const pct = Math.min(100, (uso.usado / uso.cupo) * 100)
  return (
    <div className="mt-4">
      <div className="flex justify-between">
        <Text size="small">
          {tamano(uso.usado)} de {uso.cupo / GB} GB usados · plan {uso.plan}
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          Gratis 1 GB · Taller 10 GB · Pro 50 GB · Industrial 200 GB
        </Text>
      </div>
      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-ui-bg-component">
        <div style={{ width: `${pct}%`, background: pct > 90 ? "#DC2626" : "#C2560A", height: "100%" }} />
      </div>
    </div>
  )
}

function FormProyecto({ clientes, inicial = null, onListo }) {
  const [nombre, setNombre] = useState(inicial?.nombre || "")
  const [clienteId, setClienteId] = useState(inicial?.cliente_id || "")
  const [estado, setEstado] = useState(inicial?.estado || "activo")
  const [notas, setNotas] = useState(inicial?.notas || "")
  const [ocupado, setOcupado] = useState(false)
  const guardar = async () => {
    setOcupado(true)
    try {
      const d = await api("/proyectos", {
        method: "POST",
        body: JSON.stringify({ id: inicial?.id, nombre, cliente_id: clienteId || null, estado, notas }),
      })
      toast.success("Proyecto guardado")
      onListo(d.proyecto)
    } catch (e) {
      toast.error(e.message)
    } finally {
      setOcupado(false)
    }
  }
  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-ui-border-base p-4 sm:grid-cols-2">
      <div>
        <Label>Nombre del proyecto</Label>
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Letreros Restaurante Sol" />
      </div>
      <div>
        <Label>Cliente</Label>
        <select value={clienteId} onChange={(e) => setClienteId(e.target.value)} style={{ ...SELECT, width: "100%" }}>
          <option value="">Sin cliente</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nombre}
              {c.empresa ? ` (${c.empresa})` : ""}
            </option>
          ))}
        </select>
      </div>
      {inicial && (
        <div>
          <Label>Estado</Label>
          <select value={estado} onChange={(e) => setEstado(e.target.value)} style={{ ...SELECT, width: "100%" }}>
            {Object.entries(ESTADOS_PROYECTO).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <Label>Notas (material, medidas, acuerdos con el cliente)</Label>
        <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} />
      </div>
      <div>
        <Button onClick={guardar} isLoading={ocupado} disabled={nombre.trim().length < 2}>
          Guardar
        </Button>
      </div>
    </div>
  )
}

function Clientes({ clientes, onCambio }) {
  const [editando, setEditando] = useState(null)
  const [f, setF] = useState({ nombre: "", empresa: "", correo: "", telefono: "", notas: "" })
  const abrir = (c) => {
    setEditando(c?.id || "nuevo")
    setF({ nombre: c?.nombre || "", empresa: c?.empresa || "", correo: c?.correo || "", telefono: c?.telefono || "", notas: c?.notas || "" })
  }
  const guardar = async () => {
    try {
      await api("/clientes", { method: "POST", body: JSON.stringify({ ...f, id: editando === "nuevo" ? undefined : editando }) })
      toast.success("Cliente guardado")
      setEditando(null)
      onCambio()
    } catch (e) {
      toast.error(e.message)
    }
  }
  return (
    <Container className="p-6">
      <div className="flex items-center justify-between">
        <Heading level="h2">Clientes</Heading>
        <Button variant="secondary" size="small" onClick={() => (editando ? setEditando(null) : abrir(null))}>
          {editando ? "Cancelar" : "Agregar cliente"}
        </Button>
      </div>
      {editando && (
        <div className="mt-3 grid gap-3 rounded-lg border border-ui-border-base p-4 sm:grid-cols-2">
          {[
            ["nombre", "Nombre"],
            ["empresa", "Empresa"],
            ["correo", "Correo"],
            ["telefono", "Teléfono"],
          ].map(([k, l]) => (
            <div key={k}>
              <Label>{l}</Label>
              <Input value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} />
            </div>
          ))}
          <div className="sm:col-span-2">
            <Label>Notas</Label>
            <Textarea value={f.notas} onChange={(e) => setF({ ...f, notas: e.target.value })} rows={2} />
          </div>
          <div>
            <Button onClick={guardar} disabled={f.nombre.trim().length < 2}>
              Guardar cliente
            </Button>
          </div>
        </div>
      )}
      {clientes.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {clientes.map((c) => (
            <button key={c.id} onClick={() => abrir(c)} className="rounded-full border border-ui-border-base px-3 py-1 text-sm hover:bg-ui-bg-base-hover">
              {c.nombre}
              {c.empresa ? ` · ${c.empresa}` : ""}
            </button>
          ))}
        </div>
      ) : (
        !editando && <Text className="mt-2 text-ui-fg-subtle">Aún no tienes clientes guardados.</Text>
      )}
    </Container>
  )
}

// ---------------------------------------------------------------------
// Un proyecto: piezas, archivos con revisiones, ligas y hoja de taller
// ---------------------------------------------------------------------

function Proyecto({ id, clientes, uso, onVolver, onCambio }) {
  const [d, setD] = useState(null)
  const [editar, setEditar] = useState(false)
  const [piezaNueva, setPiezaNueva] = useState({ nombre: "", material: "", cantidad: "" })
  const [destino, setDestino] = useState("")
  const [subiendo, setSubiendo] = useState("")
  const [verViejas, setVerViejas] = useState({})
  const [dias, setDias] = useState(7)
  const [soloLiberados, setSoloLiberados] = useState(true)

  const cargar = async () => {
    try {
      setD(await api(`/proyectos/${id}`))
    } catch (e) {
      toast.error(e.message)
      onVolver()
    }
  }
  useEffect(() => {
    cargar()
  }, [id])
  if (!d) return <Container className="p-6"><Text>Cargando proyecto…</Text></Container>
  const p = d.proyecto

  const agregarPieza = async () => {
    try {
      await api(`/proyectos/${id}/piezas`, { method: "POST", body: JSON.stringify(piezaNueva) })
      setPiezaNueva({ nombre: "", material: "", cantidad: "" })
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }

  const subir = async (archivos: File[]) => {
    for (const [i, a] of archivos.entries()) {
      if (a.size > MAX_MB * 1024 * 1024) {
        toast.error(`${a.name} pesa más de ${MAX_MB} MB.`)
        continue
      }
      setSubiendo(`Subiendo ${i + 1} de ${archivos.length}: ${a.name}`)
      const fd = new FormData()
      fd.append("archivo", a)
      if (destino) fd.append("pieza_id", destino)
      try {
        const r = await api(`/proyectos/${id}/archivos`, { method: "POST", body: fd })
        if (r.archivo?.revision > 1) toast.info(`${a.name}: se guardó como revisión ${r.archivo.revision}.`)
      } catch (e) {
        toast.error(`${a.name}: ${e.message}`)
      }
    }
    setSubiendo("")
    cargar()
    onCambio?.()
  }

  const cambiar = async (a, cambios) => {
    try {
      await api(`/archivos/${a.id}`, { method: "POST", body: JSON.stringify(cambios) })
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }
  const borrar = async (a) => {
    if (!window.confirm(`¿Borrar ${a.nombre} (revisión ${a.revision})? No se puede deshacer.`)) return
    try {
      await api(`/archivos/${a.id}`, { method: "DELETE" })
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }
  const descargar = async (a) => {
    try {
      const r = await api(`/archivos/${a.id}/descarga`)
      window.open(r.url, "_blank", "noopener")
    } catch (e) {
      toast.error(e.message)
    }
  }
  const compartir = async () => {
    try {
      const r = await api(`/proyectos/${id}/ligas`, { method: "POST", body: JSON.stringify({ dias, solo_liberados: soloLiberados }) })
      await navigator.clipboard?.writeText(r.url).catch(() => {})
      toast.success("Liga creada y copiada")
      cargar()
    } catch (e) {
      toast.error(e.message)
    }
  }
  const revocar = async (token) => {
    await api(`/ligas/${token}`, { method: "DELETE" }).catch((e) => toast.error(e.message))
    cargar()
  }

  // Archivos agrupados por pieza y por nombre (última revisión primero)
  const grupos = [...d.piezas.map((x) => ({ pieza: x, id: x.id })), { pieza: null, id: "" }]
    .map((g) => {
      const por = new Map()
      for (const a of d.archivos.filter((a) => (a.pieza_id || "") === g.id)) {
        const k = a.nombre.toLowerCase()
        por.set(k, [...(por.get(k) || []), a])
      }
      return { ...g, archivos: [...por.values()] }
    })
    .filter((g) => g.pieza || g.archivos.length)

  return (
    <div className="flex flex-col gap-3">
      <Container className="p-6">
        <button onClick={onVolver} className="text-sm text-ui-fg-interactive">
          ← Todos los proyectos
        </button>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <Heading>{p.nombre}</Heading>
            <Text className="text-ui-fg-subtle">
              {[d.cliente?.nombre, ESTADOS_PROYECTO[p.estado], `creado ${fecha(p.created_at)}`].filter(Boolean).join(" · ")}
            </Text>
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="small"
              onClick={async () => {
                // La ventana se abre en el clic (si no, el navegador la bloquea) y se llena después
                const w = window.open("", "_blank")
                if (!w) return toast.error("Permite las ventanas emergentes para imprimir la hoja.")
                w.document.write("<p style='font:14px system-ui;margin:24px'>Preparando la hoja…</p>")
                // El QR lleva a una liga de sólo archivos liberados; si no hay, se crea una de 90 días
                let liga = d.ligas.find((l) => l.solo_liberados) || null
                if (!liga) {
                  try {
                    const r = await api(`/proyectos/${id}/ligas`, { method: "POST", body: JSON.stringify({ dias: 90, solo_liberados: true }) })
                    liga = { url: r.url, vence: new Date(Date.now() + 90 * 86400_000).toISOString() }
                    cargar()
                  } catch {
                    liga = null
                  }
                }
                hojaDeTaller(d, w, liga)
              }}
            >
              Hoja de taller
            </Button>
            <Button variant="secondary" size="small" onClick={() => setEditar(!editar)}>
              {editar ? "Cancelar" : "Editar"}
            </Button>
          </div>
        </div>
        {p.notas && !editar && <Text className="mt-3 whitespace-pre-line">{p.notas}</Text>}
        {editar && (
          <FormProyecto
            clientes={clientes}
            inicial={p}
            onListo={() => {
              setEditar(false)
              cargar()
              onCambio?.()
            }}
          />
        )}
      </Container>

      <Container className="p-6">
        <Heading level="h2">Archivos</Heading>
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-ui-border-strong p-4">
          <select value={destino} onChange={(e) => setDestino(e.target.value)} style={SELECT} aria-label="Pieza">
            <option value="">Del proyecto (sin pieza)</option>
            {d.piezas.map((x) => (
              <option key={x.id} value={x.id}>
                Pieza: {x.nombre}
              </option>
            ))}
          </select>
          <label className="cursor-pointer rounded-md bg-ui-button-inverted px-3 py-1.5 text-sm font-medium text-ui-fg-on-inverted">
            {subiendo ? "Subiendo…" : "Subir archivos"}
            <input
              type="file"
              multiple
              hidden
              disabled={Boolean(subiendo)}
              onChange={(e) => {
                // Se limpia para poder volver a elegir el mismo archivo (revisión nueva)
                const lista = Array.from(e.target.files || [])
                e.target.value = ""
                subir(lista)
              }}
            />
          </label>
          <Text size="small" className="text-ui-fg-subtle">
            {subiendo || `DXF, SVG, STEP, STL, CAM, G-code, PDF, fotos… hasta ${MAX_MB} MB. Mismo nombre = revisión nueva.`}
          </Text>
        </div>
        <Text size="small" className="mt-1 text-ui-fg-subtle">
          Tu nube: {tamano(uso.usado)} de {uso.cupo / GB} GB.
        </Text>

        {grupos.map((g) => (
          <div key={g.id || "sin"} className="mt-5">
            <Text weight="plus">
              {g.pieza ? `Pieza: ${g.pieza.nombre}` : "Archivos del proyecto"}
              {g.pieza && (g.pieza.material || g.pieza.cantidad) && (
                <span className="font-normal text-ui-fg-subtle"> · {[g.pieza.material, g.pieza.cantidad && `${g.pieza.cantidad} pzas`].filter(Boolean).join(" · ")}</span>
              )}
            </Text>
            {g.archivos.length === 0 && <Text size="small" className="text-ui-fg-subtle">Sin archivos todavía.</Text>}
            {g.archivos.map((revs) => {
              const a = revs[0]
              const k = `${g.id}|${a.nombre.toLowerCase()}`
              return (
                <div key={k} className="mt-2 rounded-lg border border-ui-border-base p-3">
                  <Fila a={a} actual onCambiar={cambiar} onBorrar={borrar} onDescargar={descargar} />
                  {revs.length > 1 && (
                    <>
                      <button className="mt-1 text-xs text-ui-fg-interactive" onClick={() => setVerViejas({ ...verViejas, [k]: !verViejas[k] })}>
                        {verViejas[k] ? "Ocultar" : "Ver"} {revs.length - 1} revisión{revs.length > 2 ? "es" : ""} anterior{revs.length > 2 ? "es" : ""}
                      </button>
                      {verViejas[k] &&
                        revs.slice(1).map((v) => (
                          <div key={v.id} className="mt-2 border-t border-ui-border-base pt-2 opacity-80">
                            <Fila a={v} onCambiar={cambiar} onBorrar={borrar} onDescargar={descargar} />
                          </div>
                        ))}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </Container>

      <Container className="p-6">
        <Heading level="h2">Piezas</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Separa los archivos de cada pieza (número de parte, material y cantidad).
        </Text>
        <div className="mt-3 grid gap-2 sm:grid-cols-[2fr_1.5fr_1fr_auto]">
          <Input placeholder="Nombre o número de pieza" value={piezaNueva.nombre} onChange={(e) => setPiezaNueva({ ...piezaNueva, nombre: e.target.value })} />
          <Input placeholder="Material" value={piezaNueva.material} onChange={(e) => setPiezaNueva({ ...piezaNueva, material: e.target.value })} />
          <Input placeholder="Cantidad" inputMode="numeric" value={piezaNueva.cantidad} onChange={(e) => setPiezaNueva({ ...piezaNueva, cantidad: e.target.value })} />
          <Button variant="secondary" onClick={agregarPieza} disabled={!piezaNueva.nombre.trim()}>
            Agregar
          </Button>
        </div>
      </Container>

      <Container className="p-6">
        <Heading level="h2">Compartir</Heading>
        <Text size="small" className="text-ui-fg-subtle">
          Una liga para tu cliente o tu operador: ve las piezas y descarga la última revisión de cada archivo. No necesita cuenta. Puedes revocarla cuando quieras.
        </Text>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <select value={dias} onChange={(e) => setDias(Number(e.target.value))} style={SELECT} aria-label="Vigencia">
            {[1, 3, 7, 15, 30, 90].map((n) => (
              <option key={n} value={n}>
                Vence en {n} día{n === 1 ? "" : "s"}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={soloLiberados} onChange={(e) => setSoloLiberados(e.target.checked)} />
            Sólo archivos liberados
          </label>
          <Button size="small" onClick={compartir}>
            Crear liga
          </Button>
        </div>
        {d.ligas.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {d.ligas.map((l) => {
              const url = l.url
              return (
                <div key={l.token} className="flex flex-wrap items-center gap-2 text-sm">
                  <code className="rounded bg-ui-bg-component px-2 py-1 text-xs">{url}</code>
                  <Text size="small" className="text-ui-fg-subtle">
                    vence {fecha(l.vence)} · {l.solo_liberados ? "liberados" : "todo"} · {l.vistas} vista{l.vistas === 1 ? "" : "s"}
                  </Text>
                  <button className="text-xs text-ui-fg-interactive" onClick={() => navigator.clipboard?.writeText(url).then(() => toast.success("Copiada"))}>
                    Copiar
                  </button>
                  <button className="text-xs text-ui-fg-error" onClick={() => revocar(l.token)}>
                    Revocar
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </Container>
    </div>
  )
}

function Fila({ a, actual = false, onCambiar, onBorrar, onDescargar }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="min-w-0">
        <Text weight={actual ? "plus" : "regular"} className="truncate">
          {a.nombre} <span className="text-ui-fg-subtle">· rev. {a.revision}</span>
        </Text>
        <Text size="small" className="text-ui-fg-subtle">
          {[CATEGORIAS[a.categoria] || a.categoria, a.tamano ? tamano(Number(a.tamano)) : "", fecha(a.created_at), a.notas]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge size="2xsmall" color={COLOR_ESTADO[a.estado] || "grey"}>
          {ESTADOS[a.estado] || a.estado}
        </Badge>
        <select value={a.estado} onChange={(e) => onCambiar(a, { estado: e.target.value })} style={SELECT} aria-label="Estado del archivo">
          {Object.entries(ESTADOS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <Button size="small" variant="secondary" onClick={() => onDescargar(a)}>
          Descargar
        </Button>
        <button className="text-xs text-ui-fg-error" onClick={() => onBorrar(a)}>
          Borrar
        </button>
      </div>
    </div>
  )
}

// Hoja de taller para imprimir y pegar junto a la máquina: piezas, material,
// cantidad y la revisión vigente de cada archivo.
function hojaDeTaller(d, w, liga) {
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c])
  const p = d.proyecto
  const ultimos = new Map()
  for (const a of d.archivos) {
    const k = `${a.pieza_id || ""}|${a.nombre.toLowerCase()}`
    if (!ultimos.has(k)) ultimos.set(k, a)
  }
  const filas = (piezaId) =>
    [...ultimos.values()]
      .filter((a) => (a.pieza_id || "") === piezaId)
      .map((a) => `<tr><td>${esc(a.nombre)}</td><td>${esc(CATEGORIAS[a.categoria] || a.categoria)}</td><td>${a.revision}</td><td>${esc(ESTADOS[a.estado])}</td></tr>`)
      .join("")
  const bloques = [...d.piezas.map((x) => ({ ...x })), { id: "", nombre: "Archivos del proyecto" }]
    .map((x) => {
      const f = filas(x.id)
      if (!f && !x.material && !x.cantidad && !x.id) return ""
      return `<h2>${esc(x.id ? `Pieza: ${x.nombre}` : x.nombre)}</h2>
        ${x.material || x.cantidad ? `<p>${[x.material && `Material: ${esc(x.material)}`, x.cantidad && `Cantidad: ${x.cantidad}`].filter(Boolean).join(" · ")}</p>` : ""}
        ${f ? `<table><thead><tr><th>Archivo</th><th>Tipo</th><th>Rev.</th><th>Estado</th></tr></thead><tbody>${f}</tbody></table>` : "<p>Sin archivos.</p>"}
        <p class="firma">Operador: ____________________ &nbsp; Fecha: __________ &nbsp; Piezas buenas: ______</p>`
    })
    .join("")
  let qr = ""
  try {
    if (liga?.url)
      qr = `<div class="qr">${svgQR(liga.url, 132)}<div>Escanea para bajar los archivos liberados<br/>(vence ${esc(fecha(liga.vence))})</div></div>`
  } catch {
    qr = ""
  }
  w.document.open()
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Hoja de taller · ${esc(p.nombre)}</title>
    <style>body{font:14px/1.4 system-ui,sans-serif;color:#111;margin:24px}h1{font-size:22px;margin:0}h2{font-size:16px;margin:22px 0 6px;border-bottom:2px solid #C2560A;padding-bottom:4px}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:6px;text-align:left}th{background:#f3f1ea}.sub{color:#555}.firma{margin-top:10px;color:#333}
    pre{white-space:pre-wrap;font:inherit;background:#f7f7f5;padding:8px;border-radius:6px}@media print{button{display:none}}
    .qr{float:right;margin:0 0 8px 16px;text-align:center;font-size:11px;color:#444;max-width:150px}.qr svg{display:block;margin:0 auto 4px}</style></head><body>
    <button onclick="print()" style="float:right;padding:8px 14px;margin-left:12px">Imprimir</button>
    ${qr}
    <h1>${esc(p.nombre)}</h1>
    <p class="sub">${[d.cliente?.nombre, ESTADOS_PROYECTO[p.estado], new Date().toLocaleDateString("es-MX")].filter(Boolean).map(esc).join(" · ")}</p>
    ${p.notas ? `<pre>${esc(p.notas)}</pre>` : ""}
    ${bloques}
    <p class="sub" style="margin-top:24px">Usa sólo archivos en estado <b>Liberado</b> para producción. HetNa Cloud · hetnacnc.com</p>
    </body></html>`)
  w.document.close()
}
