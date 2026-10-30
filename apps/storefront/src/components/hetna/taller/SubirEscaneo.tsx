"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"

import { crearEscaneo } from "@/lib/escaneos/acciones"

type Modo = "preview" | "scan"

// Los mismos mínimos que valida el backend. Se repiten aquí para avisar antes
// de que el taller suba 8 fotos y se lleve el rechazo al final.
const MINIMO = { preview: 1, scan: 15 } as const
const MAXIMO = { preview: 1, scan: 80 } as const

type EstadoFoto = {
  nombre: string
  estado: "esperando" | "subiendo" | "lista" | "error"
  storageKey?: string
  mensaje?: string
}

export const SubirEscaneo = ({ creditosPorEscaneo }: { creditosPorEscaneo: number }) => {
  const router = useRouter()
  const params = useParams()
  const locale = (params?.locale as string) || "mx"

  const [modo, setModo] = useState<Modo>("preview")
  const [titulo, setTitulo] = useState("")
  const [medida, setMedida] = useState("")
  const [fotos, setFotos] = useState<EstadoFoto[]>([])
  const [lote, setLote] = useState<string | undefined>()
  const [trabajando, setTrabajando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listas = fotos.filter((f) => f.estado === "lista")
  const medidaMm = Number(medida.replace(",", "."))
  const medidaValida = Number.isFinite(medidaMm) && medidaMm >= 5 && medidaMm <= 3000
  const suficientes = listas.length >= MINIMO[modo] && (modo === "preview" || medidaValida)

  const cambiarModo = (nuevo: Modo) => {
    setModo(nuevo)
    setError(null)
  }

  const elegir = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const elegidas = Array.from(e.target.files || [])
    // El input se limpia para que volver a elegir el mismo archivo dispare el
    // evento otra vez.
    e.target.value = ""
    if (!elegidas.length) return

    const cupo = MAXIMO[modo] - fotos.length
    if (cupo <= 0) {
      setError(`Ya tienes el máximo de ${MAXIMO[modo]} ${MAXIMO[modo] === 1 ? "foto" : "fotos"}.`)
      return
    }
    const aSubir = elegidas.slice(0, cupo)
    if (aSubir.length < elegidas.length) {
      setError(`Sólo caben ${MAXIMO[modo]} fotos; se tomaron las primeras.`)
    }

    const desde = fotos.length
    setFotos((p) => [...p, ...aSubir.map((f) => ({ nombre: f.name, estado: "esperando" as const }))])
    setTrabajando(true)

    // Se suben de una en una a propósito: cuarenta peticiones en paralelo
    // desde un celular con datos móviles fallan más de lo que avanzan, y así
    // se ve el progreso real.
    let loteActual = lote
    for (let i = 0; i < aSubir.length; i++) {
      const indice = desde + i
      setFotos((p) => p.map((f, j) => (j === indice ? { ...f, estado: "subiendo" } : f)))

      const form = new FormData()
      form.append("foto", aSubir[i])
      if (loteActual) form.append("lote", loteActual)

      try {
        const res = await fetch("/api/taller/escaneo-foto", { method: "POST", body: form })
        const cuerpo = await res.json().catch(() => ({}))
        if (!res.ok || !cuerpo.ok) {
          setFotos((p) =>
            p.map((f, j) =>
              j === indice ? { ...f, estado: "error", mensaje: cuerpo.mensaje || "No se pudo subir" } : f
            )
          )
          continue
        }
        // Todas las fotos de este escaneo van bajo la misma carpeta; la
        // primera respuesta decide cuál es.
        loteActual = loteActual || cuerpo.lote
        setFotos((p) =>
          p.map((f, j) => (j === indice ? { ...f, estado: "lista", storageKey: cuerpo.storage_key } : f))
        )
      } catch {
        setFotos((p) =>
          p.map((f, j) => (j === indice ? { ...f, estado: "error", mensaje: "Se cortó la conexión" } : f))
        )
      }
    }

    setLote(loteActual)
    setTrabajando(false)
  }

  const quitar = (indice: number) => setFotos((p) => p.filter((_, j) => j !== indice))

  const pedir = async () => {
    const llaves = listas.map((f) => f.storageKey!).filter(Boolean)
    if (llaves.length < MINIMO[modo]) {
      setError(`Faltan fotos: el mínimo es ${MINIMO[modo]}.`)
      return
    }

    if (modo === "scan" && !medidaValida) {
      setError("Escribe la medida real del lado más largo, en milímetros (entre 5 y 3000).")
      return
    }

    setTrabajando(true)
    setError(null)

    const res = await crearEscaneo({
      modo,
      titulo: titulo.trim() || null,
      fotos: llaves,
      medida_mm: modo === "scan" ? medidaMm : null,
    })

    if (!res.ok) {
      setTrabajando(false)
      setError(res.mensaje)
      return
    }
    router.push(`/${locale}/taller/escaneos/${res.datos.escaneo.id}`)
  }

  return (
    <div className="mt-8 max-w-[760px] flex flex-col gap-8">
      <fieldset className="border-0 p-0 m-0">
        <legend className="text-[18px] font-bold text-[#1B1B18] p-0">Qué necesitas</legend>
        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <OpcionModo
            activa={modo === "preview"}
            onClick={() => cambiarModo("preview")}
            titulo="Vista previa"
            precio="Gratis"
            descripcion="Una foto. Una IA adivina la forma: sirve para enseñársela a un cliente, no para fabricar."
          />
          <OpcionModo
            activa={modo === "scan"}
            onClick={() => cambiarModo("scan")}
            titulo="Escaneo profesional"
            precio={`${creditosPorEscaneo} ${creditosPorEscaneo === 1 ? "crédito" : "créditos"}`}
            descripcion="De 15 a 80 fotos girando alrededor. Mide la geometría real y entrega un archivo para maquinar."
          />
        </div>
      </fieldset>

      {modo === "scan" && (
        <div className="rounded-[12px] border border-[#E2D3B8] bg-[#FBF5E9] px-4 py-3.5 text-[14px] text-[#6B5A2E] leading-relaxed">
          <strong>Cómo salen bien las fotos:</strong> gira alrededor de la pieza sin moverla,
          cada toma traslapando con la anterior. Luz pareja y sin brillos. Si puedes, pon
          junto a la pieza algo de medida conocida (un calibrador, una moneda) para poder
          verificar la escala.
        </div>
      )}

      {modo === "scan" && (
        <label className="flex flex-col gap-1.5 max-w-[420px]">
          <span className="text-[13px] font-semibold text-[#4A4943]">Medida real del lado más largo (mm)</span>
          <input
            className="w-full rounded-[10px] border border-[#E7E4DC] bg-white px-3.5 py-2.5 text-[15px] text-[#1B1B18] outline-none focus:border-[#C2560A]"
            value={medida}
            onChange={(e) => setMedida(e.target.value.replace(/[^\d.,]/g, ""))}
            inputMode="decimal"
            placeholder="Ej. 125.4"
          />
          <span className="text-[12.5px] text-[#6B6A63] leading-snug">
            Mídelo con vernier o flexómetro. Las fotos dan la forma pero no el tamaño: con esta
            medida escalamos el archivo para que salga en milímetros reales.
          </span>
          {medida && !medidaValida && (
            <span className="text-[12.5px] text-[#9B3225]">Debe estar entre 5 y 3000 mm. ¿La escribiste en centímetros?</span>
          )}
        </label>
      )}

      <label className="flex flex-col gap-1.5 max-w-[420px]">
        <span className="text-[13px] font-semibold text-[#4A4943]">Nombre de la pieza</span>
        <input
          className="w-full rounded-[10px] border border-[#E7E4DC] bg-white px-3.5 py-2.5 text-[15px] text-[#1B1B18] outline-none focus:border-[#C2560A]"
          value={titulo}
          onChange={(e) => setTitulo(e.target.value)}
          placeholder="Engrane de la prensa"
        />
      </label>

      <div>
        <h2 className="text-[18px] font-bold text-[#1B1B18]">
          Fotos{" "}
          <span className="text-[14px] font-normal text-[#6B6A63]">
            ({listas.length} de {MINIMO[modo]} mínimo)
          </span>
        </h2>

        <label className="mt-3 inline-flex cursor-pointer border border-[#E7E4DC] hover:border-[#C2560A] text-[#1B1B18] font-semibold px-4 py-2.5 rounded-[10px] text-[14px]">
          {modo === "preview" ? "Elegir la foto" : "Agregar fotos"}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple={modo === "scan"}
            onChange={elegir}
            disabled={trabajando}
            className="hidden"
          />
        </label>

        {fotos.length > 0 && (
          <ul className="mt-4 flex flex-col gap-1.5">
            {fotos.map((f, i) => (
              <li
                key={`${f.nombre}-${i}`}
                className="flex items-center gap-3 rounded-[10px] border border-[#E7E4DC] bg-white px-3.5 py-2.5 text-[14px]"
              >
                <span className="flex-1 truncate text-[#1B1B18]">{f.nombre}</span>
                <span
                  className={
                    f.estado === "lista"
                      ? "text-[#276B2B] font-semibold"
                      : f.estado === "error"
                        ? "text-[#9B3225] font-semibold"
                        : "text-[#6B6A63]"
                  }
                >
                  {f.estado === "lista"
                    ? "Lista"
                    : f.estado === "subiendo"
                      ? "Subiendo…"
                      : f.estado === "error"
                        ? f.mensaje || "Error"
                        : "En espera"}
                </span>
                {!trabajando && (
                  <button
                    type="button"
                    onClick={() => quitar(i)}
                    className="text-[13px] font-semibold text-[#9B3225] hover:underline"
                  >
                    Quitar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="border-t border-[#E7E4DC] pt-6">
        <button
          type="button"
          onClick={pedir}
          disabled={trabajando || !suficientes}
          className="bg-[#C2560A] hover:bg-[#A84A08] disabled:opacity-60 text-white font-semibold px-6 py-3 rounded-[10px] text-[15px]"
        >
          {trabajando
            ? "Trabajando…"
            : modo === "preview"
              ? "Generar la vista previa"
              : `Escanear (${creditosPorEscaneo} ${creditosPorEscaneo === 1 ? "crédito" : "créditos"})`}
        </button>
        {modo === "scan" && (
          <p className="mt-2.5 text-[12px] text-[#6B6A63] leading-snug max-w-[520px]">
            Los créditos se descuentan al mandar el trabajo. Si el escaneo falla, se
            devuelven solos.
          </p>
        )}
        {error && <p role="alert" className="mt-3 text-[14px] font-medium text-[#9B3225]">{error}</p>}
      </div>
    </div>
  )
}

const OpcionModo = ({
  activa,
  onClick,
  titulo,
  precio,
  descripcion,
}: {
  activa: boolean
  onClick: () => void
  titulo: string
  precio: string
  descripcion: string
}) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={activa}
    className={`text-left rounded-[12px] border p-4 transition-colors ${
      activa ? "border-[#C2560A] bg-white" : "border-[#E7E4DC] bg-white hover:border-[#C2560A]"
    }`}
  >
    <span className="flex items-baseline justify-between gap-3">
      <span className="text-[16px] font-bold text-[#1B1B18]">{titulo}</span>
      <span className="text-[13px] font-semibold text-[#B34D07]">{precio}</span>
    </span>
    <span className="mt-1.5 block text-[13px] text-[#6B6A63] leading-relaxed">{descripcion}</span>
  </button>
)
