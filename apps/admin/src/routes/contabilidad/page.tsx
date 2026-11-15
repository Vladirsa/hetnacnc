// Pantalla "Contabilidad" del dashboard (menú lateral).
// Departamento de contabilidad de HETNA (persona física, régimen 612):
//   Resumen   ISR provisional e IVA de cada mes (borrador para el contador).
//   Facturas  emitidas y recibidas: subir XML/ZIP y corregir cómo cuenta cada una.
//   Auditoría hallazgos del auditor fiscal y del forense, y el semáforo antes de pagar.
//   Excel     descargar con fórmulas, subir movimientos sin factura y la liga conectada.
//   Datos     RFC, régimen y código postal fiscal.
import { useCallback, useEffect, useRef, useState } from "react"
import type { CSSProperties } from "react"

const C = {
  borde: "var(--border-base, #e5e5e5)", fondo: "var(--bg-base, #ffffff)", suave: "var(--bg-subtle, #f7f7f5)",
  texto: "var(--fg-base, #1b1b18)", tenue: "var(--fg-subtle, #6b6a63)", azul: "#142033", naranja: "#C2560A", rojo: "#b42318", verde: "#1E7B3A", ambar: "#8A5A00",
}
const caja: CSSProperties = { background: C.fondo, border: `1px solid ${C.borde}`, borderRadius: 12, padding: 16, marginBottom: 14 }
const tenue: CSSProperties = { color: C.tenue, fontSize: 12 }
const input: CSSProperties = { border: `1px solid ${C.borde}`, borderRadius: 8, padding: "7px 10px", fontSize: 13, background: C.fondo, color: C.texto }
const boton = (tipo: "primario" | "normal" | "peligro" = "normal"): CSSProperties => ({
  cursor: "pointer", borderRadius: 10, padding: "8px 13px", fontSize: 13, fontWeight: 700,
  border: tipo === "normal" ? `1px solid ${C.borde}` : "none",
  background: tipo === "primario" ? C.azul : tipo === "peligro" ? C.rojo : C.fondo, color: tipo === "normal" ? C.texto : "#fff",
})
const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]
const pesos = (n: number) => `$${(n || 0).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const cabeceras = (): Record<string, string> => {
  try {
    const t = localStorage.getItem("medusa_auth_token")
    return t ? { authorization: `Bearer ${t}` } : {}
  } catch {
    return {}
  }
}
async function api<T>(ruta: string, opciones: { metodo?: string; cuerpo?: unknown; form?: FormData } = {}): Promise<T> {
  const r = await fetch(`/admin/hetna-conta${ruta}`, {
    credentials: "include",
    method: opciones.metodo || (opciones.cuerpo !== undefined || opciones.form ? "POST" : "GET"),
    headers: opciones.form ? cabeceras() : opciones.cuerpo !== undefined ? { ...cabeceras(), "content-type": "application/json" } : cabeceras(),
    body: opciones.form || (opciones.cuerpo !== undefined ? JSON.stringify(opciones.cuerpo) : undefined),
  })
  const d = await r.json().catch(() => ({}))
  if (r.status === 401) throw new Error("No se pudo verificar tu sesión. Cierra sesión, vuelve a entrar y recarga.")
  if (!r.ok) throw new Error((d as any)?.message || `Error ${r.status}`)
  return d as T
}
async function descargar(ruta: string, nombre: string) {
  const r = await fetch(`/admin/hetna-conta${ruta}`, { credentials: "include", headers: cabeceras() })
  if (!r.ok) {
    const d = await r.json().catch(() => ({}))
    throw new Error((d as any)?.message || `Error ${r.status}`)
  }
  const url = URL.createObjectURL(await r.blob())
  const a = document.createElement("a")
  a.href = url
  a.download = nombre
  a.click()
  URL.revokeObjectURL(url)
}

type Resumen = {
  contribuyente: { rfc: string; nombre: string | null; regimen: string; cp: string | null; excel_conectado: boolean } | null
  anio: number
  error: string | null
  meses: any[]
  facturas: Record<string, number>
  hallazgos: Record<string, number>
}

function Aviso({ msg }: { msg: { ok: boolean; t: string } | null }) {
  if (!msg) return null
  return <p style={{ margin: "8px 0 0", fontSize: 13, color: msg.ok ? C.verde : C.rojo }}>{msg.t}</p>
}

// ─────────────────────────── Datos fiscales ───────────────────────────
function Datos({ r, alGuardar }: { r: Resumen; alGuardar: () => void }) {
  const [rfc, setRfc] = useState(r.contribuyente?.rfc || "")
  const [nombre, setNombre] = useState(r.contribuyente?.nombre || "")
  const [cp, setCp] = useState(r.contribuyente?.cp || "")
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const guardar = async () => {
    setMsg(null)
    try {
      await api("", { cuerpo: { rfc, nombre, cp, regimen: "612" } })
      setMsg({ ok: true, t: "Guardado." })
      alGuardar()
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message })
    }
  }
  return (
    <div style={caja}>
      <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Datos fiscales de HETNA</p>
      <p style={{ ...tenue, margin: "0 0 12px" }}>Como vienen en tu Constancia de Situación Fiscal. El auditor revisa que las facturas que recibes traigan exactamente estos datos.</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
        <label style={tenue}>RFC<br /><input style={{ ...input, width: "100%" }} value={rfc} onChange={(e) => setRfc(e.target.value.toUpperCase())} maxLength={13} placeholder="XAXX010101000" /></label>
        <label style={tenue}>Nombre<br /><input style={{ ...input, width: "100%" }} value={nombre} onChange={(e) => setNombre(e.target.value)} /></label>
        <label style={tenue}>Código postal fiscal<br /><input style={{ ...input, width: "100%" }} value={cp} onChange={(e) => setCp(e.target.value.replace(/\D/g, "").slice(0, 5))} /></label>
        <label style={tenue}>Régimen<br /><input style={{ ...input, width: "100%" }} value="612 · Actividades empresariales y profesionales" disabled /></label>
      </div>
      <div style={{ marginTop: 12 }}><button type="button" style={boton("primario")} onClick={guardar}>Guardar</button></div>
      <Aviso msg={msg} />
    </div>
  )
}

// ─────────────────────────── Resumen ───────────────────────────
function VistaResumen({ r }: { r: Resumen }) {
  const t = r.meses.reduce((a, m) => ({ isr: a.isr + m.isr_a_pagar, iva: a.iva + m.iva_a_pagar, ing: a.ing + m.ingresos }), { isr: 0, iva: 0, ing: 0 })
  const ult = r.meses[r.meses.length - 1]
  return (
    <>
      {r.error && <div style={{ ...caja, borderColor: C.rojo, color: C.rojo }}>{r.error}</div>}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
        {[
          ["Ingresos del año", pesos(t.ing), "cobrados, sin IVA"],
          ["ISR provisional del año", pesos(t.isr), "suma de pagos mensuales"],
          ["IVA del año", pesos(t.iva), ult?.iva_saldo_favor ? `saldo a favor: ${pesos(ult.iva_saldo_favor)}` : "a pagar"],
          ["Facturas", `${r.facturas.emitido || 0} / ${r.facturas.recibido || 0}`, "emitidas / recibidas"],
          ["Hallazgos abiertos", String((r.hallazgos.alta || 0) + (r.hallazgos.media || 0) + (r.hallazgos.baja || 0)), r.hallazgos.alta ? `${r.hallazgos.alta} graves` : "ninguno grave"],
        ].map(([a, b, c]) => (
          <div key={a} style={{ ...caja, marginBottom: 0, flex: "1 1 170px" }}>
            <p style={{ ...tenue, margin: 0 }}>{a}</p>
            <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 700, color: a === "Hallazgos abiertos" && r.hallazgos.alta ? C.rojo : C.azul }}>{b}</p>
            <p style={{ ...tenue, margin: "2px 0 0" }}>{c}</p>
          </div>
        ))}
      </div>
      <div style={{ ...caja, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "right", color: C.tenue }}>
              {["Mes", "Ingresos", "Deducciones", "Depreciación", "Base ISR acum.", "ISR a pagar", "IVA cobrado", "IVA acreditable", "IVA retenido", "IVA a pagar", "Saldo a favor"].map((h, i) => (
                <th key={h} style={{ padding: "6px 8px", textAlign: i ? "right" : "left", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {r.meses.map((m) => (
              <tr key={m.mes} style={{ borderTop: `1px solid ${C.borde}`, textAlign: "right" }}>
                <td style={{ padding: "6px 8px", textAlign: "left", fontWeight: 700 }}>{MESES[m.mes - 1]}</td>
                <td style={{ padding: "6px 8px" }}>{pesos(m.ingresos)}</td>
                <td style={{ padding: "6px 8px" }}>{pesos(m.deducciones)}</td>
                <td style={{ padding: "6px 8px" }}>{pesos(m.depreciacion)}</td>
                <td style={{ padding: "6px 8px" }}>{pesos(m.base_acum)}</td>
                <td style={{ padding: "6px 8px", fontWeight: 700, color: C.azul }}>{pesos(m.isr_a_pagar)}</td>
                <td style={{ padding: "6px 8px" }}>{pesos(m.iva_trasladado)}</td>
                <td style={{ padding: "6px 8px" }}>{pesos(m.iva_acreditable)}</td>
                <td style={{ padding: "6px 8px" }}>{pesos(m.iva_retenido)}</td>
                <td style={{ padding: "6px 8px", fontWeight: 700, color: C.azul }}>{pesos(m.iva_a_pagar)}</td>
                <td style={{ padding: "6px 8px" }}>{pesos(m.iva_saldo_favor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ ...tenue, margin: "10px 0 0" }}>
          Borrador con base en lo cobrado y pagado (PUE en su fecha; PPD cuando llega su complemento de pago). Tarifa del art. 106 del Anexo 8 RMF 2026.
          No incluye pérdidas de años anteriores, PTU pagada ni estímulos. No se presenta solo ante el SAT: revísalo con tu contador antes del día 17.
        </p>
      </div>
      {r.meses.some((m) => m.detalle.no_deducibles.length) && (
        <div style={caja}>
          <p style={{ margin: "0 0 8px", fontWeight: 700 }}>Lo que no se dedujo y por qué</p>
          {r.meses.flatMap((m) => m.detalle.no_deducibles.map((n: any) => (
            <div key={m.mes + n.uuid + n.motivo} style={{ fontSize: 13, padding: "4px 0", borderBottom: `1px dashed ${C.borde}` }}>
              <strong>{MESES[m.mes - 1]}</strong> · {n.nombre} · {pesos(n.base)} — <span style={{ color: C.tenue }}>{n.motivo}</span>
            </div>
          )))}
        </div>
      )}
    </>
  )
}

// ─────────────────────────── Facturas ───────────────────────────
function Facturas({ anio, alCambiar }: { anio: number; alCambiar: () => void }) {
  const [datos, setDatos] = useState<{ cfdis: any[]; categorias: Record<string, string>; activos: Record<string, string> } | null>(null)
  const [dir, setDir] = useState("")
  const [mes, setMes] = useState(0)
  const [q, setQ] = useState("")
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const archivo = useRef<HTMLInputElement>(null)
  const cargar = useCallback(() => {
    api<any>(`/cfdi?anio=${anio}&mes=${mes}&direccion=${dir}&q=${encodeURIComponent(q)}`).then(setDatos).catch((e) => setMsg({ ok: false, t: e.message }))
  }, [anio, mes, dir, q])
  useEffect(() => { cargar() }, [cargar])
  const subir = async (lista: FileList | null) => {
    if (!lista?.length) return
    setSubiendo(true)
    setMsg(null)
    try {
      const form = new FormData()
      for (const f of Array.from(lista)) form.append("archivos", f)
      const r = await api<any>("/archivos", { form })
      setMsg({ ok: !r.errores.length, t: `${r.nuevos} nuevas, ${r.repetidos} ya estaban${r.ajenos.length ? `, ${r.ajenos.length} no son de tu RFC` : ""}${r.errores.length ? `. Con error: ${r.errores.join("; ")}` : ""}.` })
      cargar()
      alCambiar()
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message })
    } finally {
      setSubiendo(false)
      if (archivo.current) archivo.current.value = ""
    }
  }
  const cambiar = async (uuid: string, cambios: Record<string, unknown>) => {
    try {
      await api(`/cfdi/${uuid}`, { cuerpo: cambios })
      cargar()
      alCambiar()
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message })
    }
  }
  return (
    <>
      <div style={caja}>
        <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Subir facturas</p>
        <p style={{ ...tenue, margin: "0 0 10px" }}>XML sueltos o el ZIP que entrega el SAT (emitidas y recibidas). Si una ya estaba, se actualiza sin perder lo que corregiste.</p>
        <input ref={archivo} type="file" multiple accept=".xml,.zip" disabled={subiendo} onChange={(e) => subir(e.target.files)} />
        {subiendo && <span style={{ ...tenue, marginLeft: 8 }}>Subiendo…</span>}
        <Aviso msg={msg} />
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
        <select style={input} value={dir} onChange={(e) => setDir(e.target.value)}>
          <option value="">Emitidas y recibidas</option><option value="emitido">Emitidas</option><option value="recibido">Recibidas</option>
        </select>
        <select style={input} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          <option value={0}>Todo el año</option>{MESES.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
        </select>
        <input style={{ ...input, flex: "1 1 200px" }} placeholder="Buscar nombre, RFC o UUID" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div style={{ ...caja, overflowX: "auto" }}>
        {!datos ? <p style={tenue}>Cargando…</p> : !datos.cfdis.length ? <p style={tenue}>No hay facturas con este filtro.</p> : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead>
              <tr style={{ textAlign: "left", color: C.tenue }}>
                {["Fecha", "", "Con quién", "Tipo", "Método", "Total", "IVA", "Cuenta como", "SAT"].map((h) => <th key={h} style={{ padding: "6px" }}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {datos.cfdis.map((c) => (
                <tr key={c.uuid} style={{ borderTop: `1px solid ${C.borde}` }}>
                  <td style={{ padding: "6px", whiteSpace: "nowrap" }}>{String(c.fecha).slice(0, 10)}</td>
                  <td style={{ padding: "6px" }}>{c.direccion === "emitido" ? "↗︎" : "↙︎"}</td>
                  <td style={{ padding: "6px" }}>
                    <div style={{ fontWeight: 600 }}>{c.direccion === "emitido" ? c.receptor_nombre : c.emisor_nombre}</div>
                    <div style={tenue}>{c.direccion === "emitido" ? c.receptor_rfc : c.emisor_rfc} · {c.uuid.slice(0, 8)}</div>
                  </td>
                  <td style={{ padding: "6px" }}>{({ I: "Ingreso", E: "Nota crédito", P: "Pago", N: "Nómina", T: "Traslado" } as any)[c.tipo] || c.tipo}</td>
                  <td style={{ padding: "6px" }}>{c.metodo || "—"}</td>
                  <td style={{ padding: "6px", textAlign: "right" }}>{pesos(c.total_mxn)}</td>
                  <td style={{ padding: "6px", textAlign: "right" }}>{pesos(c.iva_trasladado)}</td>
                  <td style={{ padding: "6px" }}>
                    <select style={{ ...input, padding: "4px 6px", fontSize: 12 }} value={c.categoria} onChange={(e) => cambiar(c.uuid, { categoria: e.target.value })}>
                      {Object.entries(datos.categorias).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                    {c.categoria === "inversion" && (
                      <select style={{ ...input, padding: "4px 6px", fontSize: 12, marginTop: 4, display: "block", maxWidth: 260 }} value={c.tipo_activo || ""} onChange={(e) => cambiar(c.uuid, { tipo_activo: e.target.value || null })}>
                        <option value="">Tipo de activo (sugerido)</option>
                        {Object.entries(datos.activos).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                      </select>
                    )}
                  </td>
                  <td style={{ padding: "6px", color: c.estatus_sat === "cancelado" ? C.rojo : c.estatus_sat === "vigente" ? C.verde : C.tenue, fontWeight: 600 }}>
                    {c.estatus_sat === "cancelado" ? "Cancelada" : c.estatus_sat === "vigente" ? "Vigente" : c.estatus_sat === "no_encontrado" ? "No encontrada" : "Sin revisar"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  )
}

// ─────────────────────────── Auditoría ───────────────────────────
function Auditoria({ alCambiar }: { alCambiar: () => void }) {
  const [estado, setEstado] = useState("abierto")
  const [datos, setDatos] = useState<{ hallazgos: any[]; listas: any[] } | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  const [sem, setSem] = useState<any>(null)
  const cargar = useCallback(() => { api<any>(`/hallazgos?estado=${estado}`).then(setDatos).catch((e) => setMsg({ ok: false, t: e.message })) }, [estado])
  useEffect(() => { cargar() }, [cargar])
  const auditar = async (sat: boolean) => {
    setOcupado(true)
    setMsg(null)
    try {
      const r = await api<any>("/auditar", { cuerpo: { sat } })
      setMsg({ ok: true, t: `Revisadas ${r.revisadas} facturas: ${r.nuevos} hallazgos nuevos, ${r.cerrados} se resolvieron solos${sat ? `; SAT: ${r.estatus.revisados} consultadas, ${r.estatus.cancelados} canceladas` : ""}.` })
      cargar()
      alCambiar()
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message })
    } finally {
      setOcupado(false)
    }
  }
  const marcar = async (id: string, nuevo: string) => {
    try {
      await api(`/hallazgos/${id}`, { cuerpo: { estado: nuevo } })
      cargar()
      alCambiar()
    } catch (e) {
      setMsg({ ok: false, t: (e as Error).message })
    }
  }
  const semaforo = async (f: File | undefined) => {
    if (!f) return
    setSem({ cargando: true })
    try {
      const form = new FormData()
      form.append("archivo", f)
      setSem(await api<any>("/semaforo", { form }))
    } catch (e) {
      setSem({ error: (e as Error).message })
    }
  }
  const colorSev = (s: string) => (s === "alta" ? C.rojo : s === "media" ? C.ambar : C.tenue)
  return (
    <>
      <div style={{ ...caja, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 16 }}>
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>Loop de auditoría</p>
          <p style={{ ...tenue, margin: "0 0 10px" }}>Corre solo cada día a las 7:43. Revisa reglas fiscales (ISR, IVA, CFDI) y forenses (listas negras del SAT, facturas canceladas o inexistentes, duplicados, patrones raros).</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={boton("primario")} disabled={ocupado} onClick={() => auditar(false)}>Auditar ahora</button>
            <button type="button" style={boton()} disabled={ocupado} onClick={() => auditar(true)}>Auditar y consultar al SAT</button>
          </div>
          {ocupado && <p style={tenue}>Revisando… (se consultan hasta 20 facturas por clic; el resto lo revisa el loop diario)</p>}
          <Aviso msg={msg} />
          {datos?.listas?.length ? <p style={{ ...tenue, marginTop: 8 }}>Listas del SAT: {datos.listas.map((l: any) => `${l.lista === "69B" ? "69-B" : "No localizados"} ${Number(l.n).toLocaleString("es-MX")} RFC (${String(l.fecha).slice(0, 10)})`).join(" · ")}</p> : null}
        </div>
        <div>
          <p style={{ margin: "0 0 4px", fontWeight: 700 }}>🚦 Semáforo antes de pagar</p>
          <p style={{ ...tenue, margin: "0 0 10px" }}>Sube el XML que te mandó un proveedor: te dice si está vigente en el SAT, si el proveedor está en listas negras y si trae errores. No se guarda.</p>
          <input type="file" accept=".xml" onChange={(e) => semaforo(e.target.files?.[0])} />
          {sem?.cargando && <p style={tenue}>Revisando…</p>}
          {sem?.error && <p style={{ color: C.rojo, fontSize: 13 }}>{sem.error}</p>}
          {sem?.color && (
            <div style={{ marginTop: 10, padding: 10, borderRadius: 10, background: sem.color === "verde" ? "#E6F4EA" : sem.color === "amarillo" ? "#FFF6E0" : "#FDECEA" }}>
              <p style={{ margin: 0, fontWeight: 800, color: sem.color === "verde" ? C.verde : sem.color === "amarillo" ? C.ambar : C.rojo }}>
                {sem.color === "verde" ? "🟢 Puedes pagar" : sem.color === "amarillo" ? "🟡 Revisa antes de pagar" : "🔴 No pagues todavía"}
              </p>
              <p style={{ ...tenue, margin: "4px 0" }}>{sem.emisor} · {pesos(sem.total)} · SAT: {sem.estatus}</p>
              {sem.hallazgos.map((h: any) => <p key={h.clave} style={{ margin: "4px 0 0", fontSize: 12.5 }}>• {h.mensaje}</p>)}
            </div>
          )}
        </div>
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {[["abierto", "Abiertos"], ["resuelto", "Resueltos"], ["descartado", "Descartados"]].map(([v, t]) => (
          <button key={v} type="button" onClick={() => setEstado(v)} style={{ ...boton(), background: estado === v ? C.azul : C.fondo, color: estado === v ? "#fff" : C.texto }}>{t}</button>
        ))}
      </div>
      <div style={caja}>
        {!datos ? <p style={tenue}>Cargando…</p> : !datos.hallazgos.length ? <p style={tenue}>{estado === "abierto" ? "Sin hallazgos abiertos. 🎉" : "Nada aquí."}</p> : datos.hallazgos.map((h) => (
          <div key={h.id} style={{ padding: "10px 0", borderBottom: `1px solid ${C.borde}`, display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 11, fontWeight: 800, color: "#fff", background: colorSev(h.severidad), borderRadius: 999, padding: "2px 8px", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h.severidad}</span>
            <div style={{ flex: 1 }}>
              <p style={{ margin: 0, fontSize: 13.5 }}>{h.mensaje}</p>
              <p style={{ ...tenue, margin: "3px 0 0" }}>{h.auditor === "forense" ? "🔍 Forense" : "📘 Fiscal"} · {h.base_legal} · regla {h.regla}{h.nota ? ` · ${h.nota}` : ""}</p>
            </div>
            {estado === "abierto" ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" style={boton()} onClick={() => marcar(h.id, "resuelto")}>Resuelto</button>
                <button type="button" style={boton()} onClick={() => marcar(h.id, "descartado")}>Descartar</button>
              </div>
            ) : (
              <button type="button" style={boton()} onClick={() => marcar(h.id, "abierto")}>Reabrir</button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

// ─────────────────────────── Excel ───────────────────────────
function Excel({ r, alCambiar }: { r: Resumen; alCambiar: () => void }) {
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [liga, setLiga] = useState<string | null>(null)
  const archivo = useRef<HTMLInputElement>(null)
  const accion = async (f: () => Promise<void>) => {
    setMsg(null)
    try { await f() } catch (e) { setMsg({ ok: false, t: (e as Error).message }) }
  }
  const subir = (f: File | undefined) => accion(async () => {
    if (!f) return
    const form = new FormData()
    form.append("archivo", f)
    const x = await api<any>("/movimientos", { form })
    setMsg({ ok: !x.errores.length, t: `${x.nuevos} movimientos nuevos, ${x.repetidos} ya estaban.${x.errores.length ? ` Renglones con error: ${x.errores.map((e: any) => `${e.fila} (${e.error})`).join(", ")}` : ""}` })
    if (archivo.current) archivo.current.value = ""
    alCambiar()
  })
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 14 }}>
      <div style={caja}>
        <p style={{ margin: "0 0 4px", fontWeight: 700 }}>1. Descargar a Excel</p>
        <p style={{ ...tenue, margin: "0 0 10px" }}>Libro con fórmulas vivas: si corriges una cifra en Ingresos o Deducciones, el ISR y el IVA del Resumen se recalculan. Trae la tarifa oficial del SAT en su propia hoja. Ideal para mandárselo a tu contador.</p>
        <button type="button" style={boton("primario")} onClick={() => accion(() => descargar(`/excel?anio=${r.anio}`, `contabilidad-${r.anio}.xlsx`))}>Descargar Excel {r.anio}</button>
      </div>
      <div style={caja}>
        <p style={{ margin: "0 0 4px", fontWeight: 700 }}>2. Subir movimientos sin factura</p>
        <p style={{ ...tenue, margin: "0 0 10px" }}>Cobros que no facturaste (sí pagan impuestos) y gastos sin factura (sólo para tu control: no son deducibles). Si subes el mismo archivo dos veces no se duplica.</p>
        <button type="button" style={boton()} onClick={() => accion(() => descargar("/plantilla", "plantilla-movimientos.xlsx"))}>Bajar plantilla</button>
        <div style={{ marginTop: 10 }}><input ref={archivo} type="file" accept=".xlsx" onChange={(e) => subir(e.target.files?.[0])} /></div>
      </div>
      <div style={caja}>
        <p style={{ margin: "0 0 4px", fontWeight: 700 }}>3. Excel siempre conectado</p>
        <p style={{ ...tenue, margin: "0 0 10px" }}>Una liga privada de solo lectura con tus totales por mes. En Excel: Datos → Desde la web → pega la liga. En Google Sheets: <code>=IMPORTDATA("liga")</code>. Se actualiza sola. Si la compartes por error, cámbiala.</p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" style={boton("primario")} onClick={() => accion(async () => { const x = await api<any>("/token", { cuerpo: {} }); setLiga(x.liga); alCambiar() })}>
            {r.contribuyente?.excel_conectado ? "Cambiar liga" : "Crear liga"}
          </button>
          {r.contribuyente?.excel_conectado && (
            <button type="button" style={boton("peligro")} onClick={() => accion(async () => { await api("/token", { metodo: "DELETE" }); setLiga(null); alCambiar() })}>Desactivar</button>
          )}
        </div>
        {liga && <p style={{ margin: "10px 0 0", fontSize: 12, wordBreak: "break-all", background: C.suave, padding: 8, borderRadius: 8 }}>{liga}<br /><span style={tenue}>Cópiala ahora: por seguridad no se vuelve a mostrar.</span></p>}
      </div>
      <div style={{ gridColumn: "1 / -1" }}><Aviso msg={msg} /></div>
    </div>
  )
}

export default function Contabilidad() {
  const [anio, setAnio] = useState(new Date().getFullYear())
  const [pestana, setPestana] = useState("resumen")
  const [r, setR] = useState<Resumen | null>(null)
  const [error, setError] = useState<string | null>(null)
  const cargar = useCallback(() => {
    setError(null)
    api<Resumen>(`?anio=${anio}`).then(setR).catch((e) => setError(e.message))
  }, [anio])
  useEffect(() => { cargar() }, [cargar])
  const sinDatos = r && !r.contribuyente
  return (
    <div style={{ padding: 24, maxWidth: 1150, color: C.texto }}>
      <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>Contabilidad</h1>
      <p style={{ ...tenue, margin: "0 0 14px", fontSize: 13 }}>ISR e IVA de cada mes, tus facturas y un auditor que las revisa todos los días. Es un borrador para tu contador: no presenta nada ante el SAT.</p>
      {error && <p style={{ color: C.rojo }}>{error}</p>}
      {!r ? !error && <p style={tenue}>Cargando…</p> : sinDatos ? <Datos r={r} alGuardar={cargar} /> : (
        <>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginBottom: 14 }}>
            {[["resumen", "Resumen"], ["facturas", "Facturas"], ["auditoria", `Auditoría${r.hallazgos.alta ? ` (${r.hallazgos.alta} ⚠)` : ""}`], ["excel", "Excel"], ["datos", "Datos fiscales"]].map(([v, t]) => (
              <button key={v} type="button" onClick={() => setPestana(v)} style={{ cursor: "pointer", borderRadius: 999, padding: "6px 14px", fontSize: 13, fontWeight: 600, border: "none", background: pestana === v ? C.azul : C.suave, color: pestana === v ? "#fff" : C.texto }}>{t}</button>
            ))}
            <select style={{ ...input, marginLeft: "auto" }} value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
              {[0, 1, 2, 3, 4].map((i) => new Date().getFullYear() - i).map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          {pestana === "resumen" && <VistaResumen r={r} />}
          {pestana === "facturas" && <Facturas anio={anio} alCambiar={cargar} />}
          {pestana === "auditoria" && <Auditoria alCambiar={cargar} />}
          {pestana === "excel" && <Excel r={r} alCambiar={cargar} />}
          {pestana === "datos" && <Datos r={r} alGuardar={cargar} />}
        </>
      )}
    </div>
  )
}

export const config = {
  label: "Contabilidad",
  icon: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <path d="M8 6h8M8 10h2M12 10h2M16 10h0M8 14h2M12 14h2M8 18h2M12 18h4" />
    </svg>
  ),
}
