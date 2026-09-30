"use client"

import { useParams, useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import { guardarPerfil, usuarioDisponible } from "@/lib/foro/acciones"
import { ESTADOS_MX, MENSAJES, REDES, type Red, TIPOS_CUENTA, type TipoCuenta } from "@/lib/foro/tipos"

import { SubirFotos } from "./SubirFotos"

export type DatosPerfil = {
  usuario: string
  nombre: string
  tipo: TipoCuenta
  bio: string
  ciudad: string
  estadoMx: string
  redes: Partial<Record<Red, string>>
  maquinas: string[]
  software: string[]
  foto: string | null
}

const aUsuario = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 30)

const SUGERENCIAS_SOFTWARE = ["Vectric Aspire", "VCarve", "Fusion 360", "ArtCAM", "LightBurn", "Mach3", "GRBL", "SolidWorks", "AutoCAD", "Cura"]

export function FormPerfil({ inicial, nuevo, siguiente }: { inicial: DatosPerfil; nuevo: boolean; siguiente?: string }) {
  const router = useRouter()
  const { locale } = useParams() as { locale?: string }
  const [d, setD] = useState<DatosPerfil>(inicial)
  const [usuarioTocado, setUsuarioTocado] = useState(!nuevo)
  const [disponible, setDisponible] = useState<boolean | null>(null)
  const [error, setError] = useState("")
  const [guardado, setGuardado] = useState(false)
  const [pendiente, iniciar] = useTransition()
  const fotoId = d.foto?.split("/").pop() || null
  const [fotos, setFotos] = useState(d.foto && fotoId ? [{ id: fotoId, url: d.foto }] : [])

  const cambia = <K extends keyof DatosPerfil>(k: K, v: DatosPerfil[K]) => {
    setGuardado(false)
    setD((x) => ({ ...x, [k]: v }))
  }

  // el usuario se sugiere solo con el nombre, hasta que la persona lo cambie
  useEffect(() => {
    if (!usuarioTocado) setD((x) => ({ ...x, usuario: aUsuario(x.nombre) }))
  }, [d.nombre, usuarioTocado])

  useEffect(() => {
    if (d.usuario.length < 3) return setDisponible(null)
    const t = setTimeout(() => usuarioDisponible(d.usuario).then((r) => setDisponible(r.disponible)), 400)
    return () => clearTimeout(t)
  }, [d.usuario])

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    iniciar(async () => {
      const foto = fotos[0]?.id ?? null
      const r = await guardarPerfil({ ...d, foto })
      if (!r.ok) return setError(r.error)
      setGuardado(true)
      if (nuevo) router.push(`/${locale || "mx"}${siguiente || "/foro-cnc"}`)
      else router.refresh()
    })
  }

  const campo = "w-full border border-[#E0DCD2] rounded-[10px] px-3.5 py-2.5 text-[15px] bg-white focus:outline-none focus:border-[#C2560A]"
  const etiqueta = "text-[14px] font-bold text-[#1B1B18]"

  return (
    <form onSubmit={enviar} className="flex flex-col gap-6">
      <fieldset className="border-0 p-0 m-0 flex flex-col gap-2">
        <legend className={`${etiqueta} mb-2`}>¿Qué eres?</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {(Object.keys(TIPOS_CUENTA) as TipoCuenta[]).map((t) => (
            <button
              type="button"
              key={t}
              onClick={() => cambia("tipo", t)}
              aria-pressed={d.tipo === t}
              className={`text-left rounded-[10px] border px-3 py-2.5 ${d.tipo === t ? "border-[#C2560A] bg-[#FDEEE1]" : "border-[#E0DCD2] bg-white hover:border-[#C2560A]"}`}
            >
              <span className="block text-[14.5px] font-bold text-[#1B1B18]">{TIPOS_CUENTA[t].nombre}</span>
              <span className="block text-[12.5px] text-[#6B6A63] leading-snug">{TIPOS_CUENTA[t].descripcion}</span>
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className={etiqueta}>{["taller", "proveedor", "marca"].includes(d.tipo) ? "Nombre del negocio" : "Tu nombre"}</span>
          <input value={d.nombre} onChange={(e) => cambia("nombre", e.target.value)} maxLength={80} required className={campo} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={etiqueta}>Usuario</span>
          <div className="flex items-center border border-[#E0DCD2] rounded-[10px] bg-white focus-within:border-[#C2560A] overflow-hidden">
            <span className="pl-3.5 text-[14px] text-[#9A978C] whitespace-nowrap">foro-cnc/perfil/</span>
            <input
              value={d.usuario}
              onChange={(e) => {
                setUsuarioTocado(true)
                cambia("usuario", aUsuario(e.target.value))
              }}
              maxLength={30}
              required
              className="flex-1 min-w-0 py-2.5 pr-3 text-[15px] focus:outline-none"
            />
          </div>
          {disponible === false && <span className="text-[12.5px] text-[#A42A2A]">Ese usuario no está disponible.</span>}
          {disponible === true && <span className="text-[12.5px] text-[#16794F]">Disponible</span>}
        </label>
      </div>

      {!nuevo && (
        <div className="flex flex-col gap-2">
          <span className={etiqueta}>Foto o logo</span>
          <SubirFotos fotos={fotos} onCambio={(f) => { setGuardado(false); setFotos(f.slice(-1)) }} max={1} etiqueta="Foto" />
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className={etiqueta}>Sobre ti o tu negocio</span>
        <textarea
          value={d.bio}
          onChange={(e) => cambia("bio", e.target.value)}
          maxLength={1000}
          rows={4}
          placeholder="Qué haces, en qué eres bueno, qué materiales trabajas, desde cuándo…"
          className={`${campo} resize-y leading-relaxed`}
        />
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className={etiqueta}>Ciudad</span>
          <input value={d.ciudad} onChange={(e) => cambia("ciudad", e.target.value)} maxLength={80} className={campo} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={etiqueta}>Estado</span>
          <select value={d.estadoMx} onChange={(e) => cambia("estadoMx", e.target.value)} className={campo}>
            <option value="">Elige…</option>
            {ESTADOS_MX.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className={etiqueta}>Máquinas que tienes</span>
          <input
            defaultValue={d.maquinas.join(", ")}
            onChange={(e) => cambia("maquinas", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))}
            placeholder="Router 1325, láser CO2 100 W, plasma 1530"
            className={campo}
          />
          <span className="text-[12.5px] text-[#6B6A63]">Sepáralas con comas.</span>
        </label>
        <label className="flex flex-col gap-2">
          <span className={etiqueta}>Programas que usas</span>
          <input
            defaultValue={d.software.join(", ")}
            onChange={(e) => cambia("software", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))}
            placeholder={SUGERENCIAS_SOFTWARE.slice(0, 4).join(", ")}
            className={campo}
          />
          <span className="text-[12.5px] text-[#6B6A63]">Sepáralos con comas.</span>
        </label>
      </div>

      <fieldset className="border-0 p-0 m-0 flex flex-col gap-3">
        <legend className={`${etiqueta} mb-1`}>Tus redes y página</legend>
        <p className="m-0 text-[13px] text-[#6B6A63]">
          Pon la liga completa o solo tu @usuario. Por seguridad no se publican teléfonos ni WhatsApp: los clientes te escriben por el chat de HETNA.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(Object.keys(REDES) as Red[]).map((r) => (
            <label key={r} className="flex items-center gap-2 border border-[#E0DCD2] rounded-[10px] bg-white focus-within:border-[#C2560A] px-3">
              <span className="text-[13px] font-semibold text-[#44433D] w-[92px] shrink-0">{REDES[r].nombre}</span>
              <input
                value={d.redes[r] || ""}
                onChange={(e) => cambia("redes", { ...d.redes, [r]: e.target.value })}
                placeholder={r === "web" ? "https://tupagina.com" : "@usuario"}
                maxLength={200}
                className="flex-1 min-w-0 py-2.5 text-[14.5px] focus:outline-none"
              />
            </label>
          ))}
        </div>
      </fieldset>

      {error && <p role="alert" className="m-0 text-[14px] text-[#A42A2A]">{MENSAJES[error] || error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pendiente || disponible === false} className="bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-6 py-3 rounded-[10px] text-[15px] disabled:opacity-50">
          {pendiente ? "Guardando…" : nuevo ? "Crear mi perfil" : "Guardar cambios"}
        </button>
        {guardado && !nuevo && <span className="text-[14px] text-[#16794F]">Guardado</span>}
      </div>
    </form>
  )
}
