"use client"

// Alta y edición de una fresa con su ficha técnica completa. Los parámetros de
// corte se pueden capturar a mano o pedir a la Calculadora CNC (el mismo motor
// de /calculadora-cnc), que los saca de la ficha, el material y la máquina.
import { useMemo, useState } from "react"

import { Boton, CampoNum, numero } from "@/components/hetna/estudio3d/Controles"
import { MAQUINAS_ROUTER, MAT_ROUTER, MATERIAL_FRESA, TIPOS_FRESA, calcRouter } from "@/lib/calculadora/router"
import type { FresaCam } from "@/lib/data/cam-maquinas"

type Texto = Record<"diametro" | "zanco" | "largoCorte" | "largoTotal" | "voladizo" | "filos" | "angulo" | "numero" | "pasada" | "traslape" | "rpm" | "avance" | "penetracion", string>
type Calculo = { carga: number; deflexion: number; avisos: string[] }

// Tipos que sólo usa el CAM de 3, 4 y 5 ejes, con el tipo de la calculadora que más se les parece
const TIPOS_3D: Record<string, { nombre: string; como: string }> = {
  toroidal: { nombre: "Toroidal (radio de esquina)", como: "upcut" },
  conica_bola: { nombre: "Cónica de bola", como: "bola" },
  broca: { nombre: "Broca", como: "recta" },
}
const s = (v?: number) => (v && v > 0 ? String(v) : "")
const campoTexto = "w-full rounded-[8px] bg-[#1C2431] px-2.5 py-2 text-[13px] text-white outline-none placeholder:text-[#8A97AB] focus:ring-1 focus:ring-[#C2560A]"

export const FRESA_NUEVA: FresaCam = { id: "", nombre: "", tipo: "upcut", diametro: 6, angulo: 90, zanco: 6, largoCorte: 22, largoTotal: 50, voladizo: 30, filos: 2, materialFresa: "carburo", numero: 1, notas: "" }

const NOMBRE_TIENDA: Partial<Record<FresaCam["tipo"], string>> = {
  recta: "fresa recta", upcut: "fresa espiral", downcut: "fresa downcut", compresion: "fresa compresion", un_filo: "fresa un filo",
  bola: "fresa punta bola", v: "fresa V", planeadora: "fresa planeadora", desbaste: "fresa desbaste", toroidal: "fresa toroidal", conica_bola: "fresa conica bola", broca: "broca",
}
/** Liga a la búsqueda de la tienda con la fresa de esta ficha, para comprarla. */
export function ligaTienda(f: Pick<FresaCam, "tipo" | "diametro" | "angulo">): string {
  const medida = f.tipo === "v" ? `${f.angulo} grados` : `${f.diametro} mm`
  return `/mx/categories?query=${encodeURIComponent(`${NOMBRE_TIENDA[f.tipo] ?? "fresa"} ${medida}`)}`
}

/** Revisa que las medidas de la ficha cuadren entre sí. */
export function avisosDeFicha(f: FresaCam): string[] {
  const a: string[] = []
  const { diametro: d, zanco = 0, largoCorte = 0, largoTotal = 0, voladizo = 0 } = f
  if (largoCorte && largoTotal && largoCorte > largoTotal) a.push("El largo de corte no puede ser mayor que el largo total.")
  if (voladizo && largoTotal && voladizo > largoTotal) a.push("El voladizo no puede ser mayor que el largo total.")
  if (voladizo && largoCorte && voladizo < largoCorte) a.push("El voladizo es menor que el largo de corte: parte del filo quedaría dentro del collet.")
  const dentro = largoTotal && voladizo ? largoTotal - voladizo : 0
  if (dentro && dentro < Math.max(12, (zanco || d) * 2)) a.push(`Solo quedan ${dentro.toFixed(0)} mm de zanco dentro del collet: lo sano es al menos ${Math.max(12, (zanco || d) * 2).toFixed(0)} mm.`)
  if (voladizo && d && voladizo > d * 6) a.push(`Voladizo largo para Ø${d} (más de 6 diámetros): la fresa se flexiona y vibra. Baja el avance o usa una más corta.`)
  return a
}

export function FichaFresa({ inicial, guardar, cancelar, grupos = [] }: { inicial?: FresaCam; guardar: (f: FresaCam) => void; cancelar?: () => void; grupos?: string[] }) {
  const base = inicial ?? FRESA_NUEVA
  const [nombre, setNombre] = useState(base.nombre)
  const [tipo, setTipo] = useState<FresaCam["tipo"]>(base.tipo)
  const [matFresa, setMatFresa] = useState<NonNullable<FresaCam["materialFresa"]>>(base.materialFresa ?? "carburo")
  const [notas, setNotas] = useState(base.notas ?? "")
  const [grupo, setGrupo] = useState(base.grupo ?? "")
  const [t, setT] = useState<Texto>({
    diametro: s(base.diametro), zanco: s(base.zanco), largoCorte: s(base.largoCorte), largoTotal: s(base.largoTotal), voladizo: s(base.voladizo), filos: s(base.filos), angulo: s(base.angulo), numero: s(base.numero),
    pasada: s(base.pasada), traslape: s(base.traslape), rpm: s(base.rpm), avance: s(base.avance), penetracion: s(base.penetracion),
  })
  const [material, setMaterial] = useState("mdf")
  const [maquina, setMaquina] = useState("taller")
  const [operacion, setOperacion] = useState<"perfil" | "cajeado">("perfil")
  const [calculo, setCalculo] = useState<Calculo | null>(null)
  const [error, setError] = useState("")
  const pon = (k: keyof Texto) => (v: string) => setT((x) => ({ ...x, [k]: v }))
  const n = (k: keyof Texto) => Math.max(0, numero(t[k]) || 0)

  const ficha = (): FresaCam => ({
    ...base, // conserva lo que esta ficha no edita (radio de esquina, portaherramienta…)
    id: base.id, nombre: nombre.trim(), tipo, materialFresa: matFresa, notas: notas.trim(), grupo: grupo.trim(),
    diametro: n("diametro"), angulo: n("angulo") || 90, zanco: n("zanco"), largoCorte: n("largoCorte"), largoTotal: n("largoTotal"), voladizo: n("voladizo"), filos: Math.round(n("filos")), numero: Math.round(n("numero")),
    pasada: n("pasada"), traslape: n("traslape"), rpm: n("rpm"), avance: n("avance"), penetracion: n("penetracion"),
  })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const avisos = useMemo(() => avisosDeFicha(ficha()), [t, tipo])

  const calcular = () => {
    const f = ficha()
    if (!(f.diametro > 0)) return setError("Captura primero el diámetro de corte.")
    setError("")
    const mq = MAQUINAS_ROUTER[maquina]
    const R = calcRouter({
      maquina, potencia_kw: mq.potencia_kw, rpm_min: mq.rpm_min, rpm_max: mq.rpm_max, avance_max: mq.avance_max, material,
      diametro: f.diametro, filos: f.filos || undefined, tipo_fresa: TIPOS_3D[tipo]?.como ?? tipo, material_fresa: matFresa, voladizo: f.voladizo || f.largoCorte || 25,
      operacion: tipo === "v" ? "grabado_v" : operacion,
    })
    const d = R.datos as Record<string, number>
    if (!d.rpm) return setError("La calculadora no pudo dar un resultado con estos datos.")
    // la profundidad por pasada nunca pasa del largo del filo
    const pasada = f.largoCorte ? Math.min(d.profundidad_pasada, f.largoCorte) : d.profundidad_pasada
    setT((x) => ({ ...x, rpm: String(d.rpm), avance: String(d.avance), penetracion: String(d.entrada), pasada: String(Math.round(pasada * 100) / 100), traslape: operacion === "cajeado" && d.paso ? String(Math.round(100 - (d.paso / f.diametro) * 100)) : x.traslape }))
    setCalculo({ carga: d.carga_viruta, deflexion: d.deflexion_mm, avisos: R.avisos })
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-[10px] border border-[#2B3648] bg-[#111722] p-3">
      <b className="text-[13px]">{inicial ? "Editar herramienta" : "Alta de herramienta"}</b>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre (ej. Compresión 1/4 2 filos)" maxLength={40} className={campoTexto} />
      <input value={grupo} onChange={(e) => setGrupo(e.target.value)} placeholder="Grupo (ej. Madera, Aluminio, Grabado)" maxLength={30} list="grupos-fresa" className={campoTexto} />
      <datalist id="grupos-fresa">
        {grupos.map((g) => (
          <option key={g} value={g} />
        ))}
      </datalist>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12.5px] text-[#C9D2E0]">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as FresaCam["tipo"])} className={campoTexto}>
            {Object.entries(TIPOS_FRESA).map(([k, v]) => (
              <option key={k} value={k}>{v.nombre}</option>
            ))}
            {Object.entries(TIPOS_3D).map(([k, v]) => (
              <option key={k} value={k}>{v.nombre}</option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1">
          <span className="text-[12.5px] text-[#C9D2E0]">Material de la fresa</span>
          <select value={matFresa} onChange={(e) => setMatFresa(e.target.value as NonNullable<FresaCam["materialFresa"]>)} className={campoTexto}>
            {Object.entries(MATERIAL_FRESA).map(([k, v]) => (
              <option key={k} value={k}>{v.nombre}</option>
            ))}
          </select>
        </label>
      </div>

      <span className="text-[12px] font-bold uppercase tracking-wide text-[#8A97AB]">Medidas</span>
      <div className="grid grid-cols-2 gap-2">
        <CampoNum etiqueta="Ø de corte" valor={t.diametro} cambiar={pon("diametro")} />
        <CampoNum etiqueta="Ø de zanco (collet)" valor={t.zanco} cambiar={pon("zanco")} />
        <CampoNum etiqueta="Largo de corte (filo)" valor={t.largoCorte} cambiar={pon("largoCorte")} />
        <CampoNum etiqueta="Largo total" valor={t.largoTotal} cambiar={pon("largoTotal")} />
        <CampoNum etiqueta="Voladizo (fuera del collet)" valor={t.voladizo} cambiar={pon("voladizo")} />
        <CampoNum etiqueta="Filos" valor={t.filos} cambiar={pon("filos")} sufijo="" />
        {tipo === "v" && <CampoNum etiqueta="Ángulo de la V" valor={t.angulo} cambiar={pon("angulo")} sufijo="°" />}
        <CampoNum etiqueta="Número en máquina (T)" valor={t.numero} cambiar={pon("numero")} sufijo="" />
      </div>
      {avisos.map((a) => (
        <span key={a} className="rounded-[8px] bg-[#2a1a0c] px-2.5 py-1.5 text-[12px] leading-snug text-[#F6C79B]">{a}</span>
      ))}

      <span className="text-[12px] font-bold uppercase tracking-wide text-[#8A97AB]">Avances y velocidades</span>
      <div className="flex flex-col gap-2 rounded-[8px] bg-[#151C27] p-2.5">
        <span className="text-[12px] leading-snug text-[#C9D2E0]">Calcúlalos con la Calculadora CNC a partir de esta ficha:</span>
        <div className="grid grid-cols-2 gap-2">
          <select value={material} onChange={(e) => setMaterial(e.target.value)} className={campoTexto} aria-label="Material a cortar">
            {Object.entries(MAT_ROUTER).map(([k, v]) => (
              <option key={k} value={k}>{v.nombre}</option>
            ))}
          </select>
          <select value={maquina} onChange={(e) => setMaquina(e.target.value)} className={campoTexto} aria-label="Tipo de máquina">
            {Object.entries(MAQUINAS_ROUTER).map(([k, v]) => (
              <option key={k} value={k}>{v.nombre}</option>
            ))}
          </select>
        </div>
        {tipo !== "v" && (
          <select value={operacion} onChange={(e) => setOperacion(e.target.value === "cajeado" ? "cajeado" : "perfil")} className={campoTexto} aria-label="Operación">
            <option value="perfil">Para perfilado o ranura (ancho completo)</option>
            <option value="cajeado">Para cajeado o desbaste de área</option>
          </select>
        )}
        <Boton tipo="primario" onClick={calcular}>Calcular avances y velocidades</Boton>
        {calculo && (
          <span className="text-[12px] leading-snug text-[#9BE3B8]">
            Carga de viruta {calculo.carga} mm por filo · la fresa se flexiona ≈ {calculo.deflexion} mm con ese voladizo.
          </span>
        )}
        {calculo?.avisos.map((a) => (
          <span key={a} className="text-[12px] leading-snug text-[#F6C79B]">{a}</span>
        ))}
        <a href="/mx/calculadora-cnc" target="_blank" rel="noreferrer" className="text-[12px] text-[#F28A3C] underline">
          Abrir la Calculadora CNC completa (potencia, par, tiempo…)
        </a>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CampoNum etiqueta="Husillo" valor={t.rpm} cambiar={pon("rpm")} sufijo="rpm" />
        <CampoNum etiqueta="Avance" valor={t.avance} cambiar={pon("avance")} sufijo="mm/min" />
        <CampoNum etiqueta="Bajada" valor={t.penetracion} cambiar={pon("penetracion")} sufijo="mm/min" />
        <CampoNum etiqueta="Prof. por pasada" valor={t.pasada} cambiar={pon("pasada")} />
        <CampoNum etiqueta="Traslape en cajeado" valor={t.traslape} cambiar={pon("traslape")} sufijo="%" />
      </div>
      <span className="text-[11.5px] leading-snug text-[#8A97AB]">Un campo vacío usa el valor recomendado para el material al generar el G-code.</span>
      <textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (marca, proveedor, para qué la usas…)" maxLength={200} rows={2} className={campoTexto} />
      {n("diametro") > 0 && (
        <a href={ligaTienda({ tipo, diametro: n("diametro"), angulo: n("angulo") || 90 })} target="_blank" rel="noreferrer" className="rounded-[8px] border border-[#2B3648] px-3 py-2 text-center text-[13px] font-semibold text-[#F28A3C] hover:border-[#F28A3C]">
          ¿No la tienes? Búscala en la tienda HETNA
        </a>
      )}
      {error && <span className="text-[12px] text-[#F6B8AE]">{error}</span>}
      <div className="flex gap-2">
        <Boton
          tipo="verde"
          onClick={() => {
            const f = ficha()
            if (!f.nombre) return setError("Ponle un nombre a la herramienta.")
            if (!(f.diametro > 0)) return setError("Captura el diámetro de corte.")
            setError("")
            guardar(f)
          }}
        >
          {inicial ? "Guardar cambios" : "Dar de alta"}
        </Boton>
        {cancelar && <Boton onClick={cancelar}>Cancelar</Boton>}
      </div>
    </div>
  )
}
