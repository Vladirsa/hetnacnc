"use client"

// Bloque de los Diseños listos en la ficha (lib/disenos-listos): quién te lo
// imprime y en cuánto (HETNA y los talleres que ofrecen la pieza), el archivo
// gratis con tu correo (se arma en tu navegador con el mismo motor de la
// herramienta) y la liga para cambiar las medidas.
import { useEffect, useState } from "react"

import { useCartContext } from "@/components/providers"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import type { LeyendaTaller } from "@/lib/disenos-listos/ofertas"
import { mandarDisenoCorreo } from "@/lib/generador/correo"
import { convertToLocale } from "@/lib/helpers/money"
import { toast } from "@/lib/helpers/toast"

const CLAVE_CORREO = "hetna-correo-disenos"

export type DatosDisenoListo = {
  handle: string
  modelo: string
  valores: Record<string, number>
  medidasUrl: string
  material: string
  medidas: string
  gramos: number | null
}

export function DisenoListo({ d, leyendas, locale }: { d: DatosDisenoListo; leyendas: LeyendaTaller[]; locale: string }) {
  const { addToCart } = useCartContext()
  const [agregando, setAgregando] = useState("")
  const [correo, setCorreo] = useState("")
  const [pidiendo, setPidiendo] = useState(false)
  const [estado, setEstado] = useState<"" | "armando" | "listo" | "error">("")
  const [mensaje, setMensaje] = useState("")

  useEffect(() => {
    try {
      setCorreo(localStorage.getItem(CLAVE_CORREO) || "")
    } catch {}
  }, [])

  const pedir = async (l: LeyendaTaller) => {
    setAgregando(l.offerId)
    try {
      await addToCart({ offerId: l.offerId, quantity: 1, countryCode: locale })
      toast.success({ title: `Agregado: lo imprime ${l.taller}` })
    } catch {
      toast.error({ title: "No se pudo agregar al carrito" })
    } finally {
      setAgregando("")
    }
  }

  // El archivo se arma en el navegador: el motor sólo se baja al pedirlo
  const bajar = async () => {
    setEstado("armando")
    try {
      const [{ construirMalla, modeloPorId }, { mallaSTL }] = await Promise.all([import("@/lib/generador/modelos3d"), import("@/lib/generador/vectores")])
      const m = modeloPorId(d.modelo)
      if (!m) throw new Error("modelo")
      const malla = await construirMalla(m, d.valores)
      const url = URL.createObjectURL(new Blob([mallaSTL({ tris: malla.tris } as never)], { type: "model/stl" }))
      const a = document.createElement("a")
      a.href = url
      a.download = `${d.handle.replace(/^hetna-/, "")}.stl`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 2000)
      setEstado("listo")
    } catch {
      setEstado("error")
      setMensaje("No se pudo armar el archivo. Ábrelo en la herramienta con la liga de abajo.")
    }
  }

  const conCorreo = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const email = String(fd.get("email") || "").trim()
    if (fd.get("acepta") !== "1") return setMensaje("Marca la casilla para descargarlo.")
    setMensaje("")
    // El correo es para darle seguimiento; la descarga no depende de que salga
    void mandarDisenoCorreo({ email, acepta: true, sitio_web: String(fd.get("sitio_web") || ""), herramienta: "modelos-3d", archivo: d.handle.replace(/^hetna-/, ""), servicio: "Impresión 3D" }).catch(() => undefined)
    try {
      localStorage.setItem(CLAVE_CORREO, email)
    } catch {}
    setCorreo(email)
    setPidiendo(false)
    await bajar()
  }

  return (
    <section className="flex flex-col gap-3 rounded-[14px] border border-[#E7E4DC] bg-white p-4" data-testid="diseno-listo">
      <p className="m-0 text-[13px] text-[#6B6A63]">
        <b className="text-[#142033]">{d.material}</b> · {d.medidas}
        {d.gramos ? ` · unos ${d.gramos} g` : ""}
      </p>

      <div className="flex flex-col gap-2">
        <h2 className="m-0 text-[15px] font-bold text-[#142033]">Quién te lo imprime</h2>
        {leyendas.length ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0" data-testid="leyendas-talleres">
            {leyendas.map((l) => (
              <li key={l.offerId} className={`flex items-center gap-3 rounded-[10px] border px-3 py-2 ${l.destacado ? "border-[#F2C98F] bg-[#FFF8F1]" : "border-[#E7E4DC]"}`}>
                <div className="min-w-0 flex-1 text-[13.5px] text-[#2E2D29]">
                  {l.destacado && <span className="mr-1 rounded-full bg-[#C2560A] px-2 py-0.5 text-[10.5px] font-bold uppercase text-white">Destacado</span>}
                  <b>{l.taller}</b> te lo imprime en <b>{convertToLocale({ amount: l.precio, currency_code: l.moneda })}</b>
                  <span className="block text-[12px] text-[#6B6A63]">
                    {l.combinacion}
                    {l.combinaciones > 1 ? ` y ${l.combinaciones - 1} opción${l.combinaciones > 2 ? "es" : ""} más de color o calidad` : ""}
                    {l.dias ? ` · ${l.dias} días hábiles` : ""}
                    {l.envioGratisDesde ? ` · envío gratis desde ${convertToLocale({ amount: l.envioGratisDesde, currency_code: l.moneda })}` : ""}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => pedir(l)}
                  disabled={!!agregando}
                  className="shrink-0 rounded-[8px] bg-[#142033] px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-60"
                >
                  {agregando === l.offerId ? "Agregando…" : "Lo quiero"}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="m-0 text-[13px] text-[#6B6A63]">Pronto: los talleres de la red están por ofrecerla.</p>
        )}
        <p className="m-0 text-[12px] text-[#6B6A63]">
          ¿Lo quieres en otro color o calidad? Elígelo arriba: verás quién lo ofrece. ¿Imprimes en 3D?{" "}
          <LocalizedClientLink href="/talleres/unete" className="font-semibold text-[#B34D07] underline">
            Ofrece esta pieza
          </LocalizedClientLink>
        </p>
      </div>

      <div className="flex flex-col gap-2 border-t border-[#E7E4DC] pt-3">
        <h2 className="m-0 text-[15px] font-bold text-[#142033]">¿Tienes impresora?</h2>
        <div className="flex flex-wrap gap-2">
          {correo && !pidiendo ? (
            <button type="button" onClick={bajar} disabled={estado === "armando"} className="rounded-[8px] bg-[#C2560A] px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-60">
              {estado === "armando" ? "Armando el archivo…" : "Descargar el STL gratis"}
            </button>
          ) : !pidiendo ? (
            <button type="button" onClick={() => setPidiendo(true)} className="rounded-[8px] bg-[#C2560A] px-3 py-2 text-[13px] font-semibold text-white">
              Descargar el STL gratis
            </button>
          ) : null}
          <LocalizedClientLink href={d.medidasUrl} className="rounded-[8px] border border-[#E7E4DC] px-3 py-2 text-[13px] font-semibold text-[#142033] hover:border-[#C2560A]">
            Modifica las medidas
          </LocalizedClientLink>
        </div>
        {pidiendo && (
          <form onSubmit={conCorreo} className="grid gap-2">
            <input name="email" type="email" required autoComplete="email" placeholder="Tu correo" aria-label="Tu correo" className="rounded-[8px] border border-[#D9D5CA] px-3 py-2 text-[14px]" />
            <input name="sitio_web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />
            <label className="flex items-start gap-2 text-[12px] text-[#40403A]">
              <input type="checkbox" name="acepta" value="1" required className="mt-0.5 accent-[#C2560A]" />
              <span>Quiero el archivo gratis y que me escriban en unos días por si necesito que me lo impriman. Puedo darme de baja cuando quiera.</span>
            </label>
            <button type="submit" disabled={estado === "armando"} className="justify-self-start rounded-[8px] bg-[#C2560A] px-3 py-1.5 text-[13px] font-semibold text-white disabled:opacity-60">
              {estado === "armando" ? "Armando el archivo…" : "Descargar"}
            </button>
          </form>
        )}
        {estado === "listo" && <p className="m-0 text-[12.5px] text-[#16794F]">✓ Listo. Imprímelo en {d.material} con 3 paredes o más.</p>}
        {mensaje && <p className="m-0 text-[12.5px] text-[#B3261E]">{mensaje}</p>}
      </div>
    </section>
  )
}
