"use client"

import { T } from "@/components/hetna/i18n/Idioma"
import { useParams, useRouter } from "next/navigation"
import { useEffect, useState, useTransition } from "react"

import { guardarPerfil, usuarioDisponible } from "@/lib/foro/acciones"
import {
  ESTADOS_MX,
  MAX_ACERCA,
  MAX_USUARIO,
  MENSAJES,
  TIPOS_CUENTA,
  TODO_MEXICO,
  type TipoCuenta,
  limpiarUsuario,
  usuarioDeNombre,
} from "@/lib/foro/tipos"

import { SubirFotos } from "./SubirFotos"

export type DatosPerfil = {
  usuario: string
  nombre: string
  tipo: TipoCuenta
  bio: string
  ciudad: string
  estadoMx: string
  // Estados que atiende o "Todo México" (nunca domicilio exacto)
  zonas: string[]
  software: string[]
  foto: string | null
  portada: string | null
}

// Estados que se pueden marcar en "Zonas que atiende"
const ESTADOS_ZONA = ESTADOS_MX.filter((e) => e !== "Fuera de México")

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
  const portadaId = d.portada?.split("/").pop() || null
  const [portada, setPortada] = useState(d.portada && portadaId ? [{ id: portadaId, url: d.portada }] : [])
  const [verEstados, setVerEstados] = useState(d.zonas.length > 0 && !d.zonas.includes(TODO_MEXICO))
  // Liga sugerida con el nombre completo, sin cortar palabras
  const sugerida = usuarioDeNombre(d.nombre)

  const cambia = <K extends keyof DatosPerfil>(k: K, v: DatosPerfil[K]) => {
    setGuardado(false)
    setD((x) => ({ ...x, [k]: v }))
  }

  // el usuario se sugiere solo con el nombre, hasta que la persona lo cambie
  useEffect(() => {
    if (!usuarioTocado) setD((x) => ({ ...x, usuario: usuarioDeNombre(x.nombre) }))
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
      // Portada: sólo se manda si la persona ya puede subir fotos (perfil creado)
      const r = await guardarPerfil({ ...d, foto, ...(nuevo ? {} : { portada: portada[0]?.id ?? null }) })
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
        <legend className={`${etiqueta} mb-2`}><T>¿Qué eres?</T></legend>
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
              <span className="block text-[12.5px] text-[#6B6A63] leading-snug"><T>{TIPOS_CUENTA[t].descripcion}</T></span>
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
          <span className={etiqueta}><T>Usuario</T></span>
          <div className="flex items-center border border-[#E0DCD2] rounded-[10px] bg-white focus-within:border-[#C2560A] overflow-hidden">
            <span className="pl-3.5 text-[14px] text-[#9A978C] whitespace-nowrap"><T>foro-cnc/perfil/</T></span>
            <input
              value={d.usuario}
              onChange={(e) => {
                setUsuarioTocado(true)
                cambia("usuario", limpiarUsuario(e.target.value))
              }}
              maxLength={MAX_USUARIO}
              required
              className="flex-1 min-w-0 py-2.5 pr-3 text-[15px] focus:outline-none"
            />
          </div>
          {disponible === false && <span className="text-[12.5px] text-[#A42A2A]"><T>Ese usuario no está disponible.</T></span>}
          {disponible === true && <span className="text-[12.5px] text-[#16794F]"><T>Disponible</T></span>}
          {/* La liga quedó cortada (antes el límite era de 30 letras): se ofrece la completa.
              La vieja sigue funcionando y redirige a la nueva. */}
          {!nuevo && sugerida.length > d.usuario.length && sugerida.startsWith(d.usuario) && (
            <button
              type="button"
              onClick={() => { setUsuarioTocado(true); cambia("usuario", sugerida) }}
              className="self-start text-left text-[13px] font-semibold text-[#B34D07] hover:underline"
            >
              <T>Tu liga está cortada. Usar la completa:</T> {sugerida}
            </button>
          )}
        </label>
      </div>

      {!nuevo && (
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-4">
          <div className="flex flex-col gap-2">
            <span className={etiqueta}><T>Foto o logo</T></span>
            <SubirFotos fotos={fotos} onCambio={(f) => { setGuardado(false); setFotos(f.slice(-1)) }} max={1} etiqueta="Foto" />
          </div>
          <div className="flex flex-col gap-2">
            <span className={etiqueta}><T>Foto de portada</T></span>
            <SubirFotos fotos={portada} onCambio={(f) => { setGuardado(false); setPortada(f.slice(-1)) }} max={1} etiqueta="Portada" />
            <span className="text-[12.5px] text-[#6B6A63]"><T>Una foto ancha de tu taller o de tus máquinas. Se ve arriba de tu perfil.</T></span>
          </div>
        </div>
      )}

      <label className="flex flex-col gap-2">
        <span className={etiqueta}><T>Acerca de</T></span>
        <textarea
          value={d.bio}
          onChange={(e) => cambia("bio", e.target.value)}
          maxLength={MAX_ACERCA}
          rows={6}
          placeholder="Qué haces, en qué eres bueno, qué trabajos te gustan, desde cuándo, cuántas personas son…"
          className={`${campo} resize-y leading-relaxed`}
        />
        <span className="text-[12.5px] text-[#6B6A63]">
          {d.bio.length.toLocaleString("es-MX")} / {MAX_ACERCA.toLocaleString("es-MX")}<T>. No pongas teléfono, WhatsApp ni correo: se ocultan solos y los clientes te escriben por Mensaje.</T>
        </span>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="flex flex-col gap-2">
          <span className={etiqueta}><T>Ciudad</T></span>
          <input value={d.ciudad} onChange={(e) => cambia("ciudad", e.target.value)} maxLength={80} className={campo} />
        </label>
        <label className="flex flex-col gap-2">
          <span className={etiqueta}><T>Estado</T></span>
          <select value={d.estadoMx} onChange={(e) => cambia("estadoMx", e.target.value)} className={campo}>
            <option value="">Elige…</option>
            {ESTADOS_MX.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="border-0 p-0 m-0 flex flex-col gap-2">
        <legend className={`${etiqueta} mb-1`}><T>Zonas que atiendes</T></legend>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            aria-pressed={d.zonas.includes(TODO_MEXICO)}
            onClick={() => { setVerEstados(false); cambia("zonas", d.zonas.includes(TODO_MEXICO) ? [] : [TODO_MEXICO]) }}
            className={`min-h-[44px] rounded-full border px-4 text-[14.5px] font-semibold ${d.zonas.includes(TODO_MEXICO) ? "border-[#C2560A] bg-[#FDEEE1] text-[#B34D07]" : "border-[#E0DCD2] bg-white text-[#44433D]"}`}
          >
            <T>🇲🇽 Todo México</T>
          </button>
          <button
            type="button"
            aria-pressed={verEstados}
            onClick={() => { setVerEstados(true); if (d.zonas.includes(TODO_MEXICO)) cambia("zonas", []) }}
            className={`min-h-[44px] rounded-full border px-4 text-[14.5px] font-semibold ${verEstados ? "border-[#C2560A] bg-[#FDEEE1] text-[#B34D07]" : "border-[#E0DCD2] bg-white text-[#44433D]"}`}
          >
            <T>Sólo algunos estados</T>
          </button>
        </div>
        {verEstados && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {ESTADOS_ZONA.map((e) => {
              const sel = d.zonas.includes(e)
              return (
                <button
                  type="button"
                  key={e}
                  aria-pressed={sel}
                  onClick={() => cambia("zonas", sel ? d.zonas.filter((z) => z !== e) : [...d.zonas.filter((z) => z !== TODO_MEXICO), e])}
                  className={`min-h-[40px] rounded-full border px-3 text-[13.5px] ${sel ? "border-[#142033] bg-[#142033] text-white" : "border-[#E0DCD2] bg-white text-[#44433D]"}`}
                >
                  {e}
                </button>
              )
            })}
          </div>
        )}
        <span className="text-[12.5px] text-[#6B6A63]"><T>Sólo estado y ciudad: tu domicilio nunca se publica.</T></span>
      </fieldset>

      <div className="grid grid-cols-1 gap-4">
        <label className="flex flex-col gap-2">
          <span className={etiqueta}><T>Programas que usas</T></span>
          <input
            defaultValue={d.software.join(", ")}
            onChange={(e) => cambia("software", e.target.value.split(",").map((x) => x.trim()).filter(Boolean))}
            placeholder={SUGERENCIAS_SOFTWARE.slice(0, 4).join(", ")}
            className={campo}
          />
          <span className="text-[12.5px] text-[#6B6A63]"><T>Sepáralos con comas.</T></span>
        </label>
      </div>

      {error && <p role="alert" className="m-0 text-[14px] text-[#A42A2A]">{MENSAJES[error] || error}</p>}
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pendiente || disponible === false} className="min-h-[48px] w-full sm:w-auto bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-6 py-3 rounded-[10px] text-[15.5px] disabled:opacity-50">
          {pendiente ? "Guardando…" : nuevo ? "Crear mi perfil" : "Guardar cambios"}
        </button>
        {guardado && !nuevo && <span className="text-[14px] text-[#16794F]"><T>Guardado</T></span>}
      </div>
    </form>
  )
}
