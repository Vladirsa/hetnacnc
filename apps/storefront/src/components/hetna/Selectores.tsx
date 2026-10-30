"use client"

import { useEffect, useMemo, useState } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import { HttpTypes } from "@medusajs/types"

import { updateRegionWithValidation } from "@/lib/data/cart"
import { toast } from "@/lib/helpers/toast"

import { COOKIE_IDIOMA } from "@/i18n/idioma"

import { leerIdioma } from "./Traductor"

// ---------- Idioma: ES / EN ----------
export const IdiomaSelector = ({ oscuro = false }: { oscuro?: boolean }) => {
  const [idioma, setIdioma] = useState<"es" | "en">("es")
  useEffect(() => setIdioma(leerIdioma()), [])

  const cambiar = (nuevo: "es" | "en") => {
    if (nuevo === idioma) return
    document.cookie = `${COOKIE_IDIOMA}=${nuevo}; path=/; max-age=31536000; samesite=lax`
    window.location.reload()
  }

  const base = "px-1.5 py-0.5 rounded text-[12px] font-semibold"
  const activo = oscuro ? "bg-white/15 text-white" : "bg-[#142033] text-white"
  const inactivo = oscuro
    ? "text-[#9FACC2] hover:text-white"
    : "text-[#6B6A63] hover:text-[#1B1B18]"

  return (
    <div className="flex items-center gap-0.5" role="group" aria-label="Idioma">
      {(["es", "en"] as const).map((l) => (
        <button
          key={l}
          type="button"
          onClick={() => cambiar(l)}
          aria-pressed={idioma === l}
          className={`${base} ${idioma === l ? activo : inactivo}`}
        >
          {l.toUpperCase()}
        </button>
      ))}
    </div>
  )
}

// ---------- Moneda: una opcion por region (MXN, USD...) ----------
type Opcion = { pais: string; moneda: string; regionId: string }

const PAIS_PREFERIDO: Record<string, string> = { mxn: "mx", usd: "us" }

export const MonedaSelector = ({
  regions,
  oscuro = false,
}: {
  regions: HttpTypes.StoreRegion[]
  oscuro?: boolean
}) => {
  const { locale } = useParams() as { locale?: string }
  const pathname = usePathname()
  const router = useRouter()
  const [cambiando, setCambiando] = useState(false)

  const opciones: Opcion[] = useMemo(
    () =>
      (regions || [])
        .map((r) => {
          const moneda = (r.currency_code || "").toLowerCase()
          const paises = (r.countries || []).map((c) => c.iso_2 || "").filter(Boolean)
          const pais = paises.includes(PAIS_PREFERIDO[moneda])
            ? PAIS_PREFERIDO[moneda]
            : paises[0]
          return { pais, moneda, regionId: r.id }
        })
        .filter((o) => o.pais && o.moneda),
    [regions]
  )

  const actual =
    (regions || []).find((r) =>
      (r.countries || []).some((c) => c.iso_2 === locale)
    )?.id || opciones[0]?.regionId

  const estilo = oscuro
    ? "bg-transparent text-[#C9D2E0] border border-[#23324A] hover:text-white"
    : "bg-white text-[#1B1B18] border border-[#E7E4DC]"

  if (opciones.length <= 1) {
    const m = (opciones[0]?.moneda || "mxn").toUpperCase()
    return <span className={`whitespace-nowrap ${oscuro ? "text-[#C9D2E0]" : "text-[13px] font-semibold text-[#1B1B18]"}`}>{m} $</span>
  }

  const cambiar = async (regionId: string) => {
    const destino = opciones.find((o) => o.regionId === regionId)
    if (!destino || regionId === actual) return
    setCambiando(true)
    try {
      const rutaActual = pathname.split(`/${locale}`)[1] || ""
      const res = await updateRegionWithValidation(destino.pais, rutaActual)
      if (res.removedItems.length > 0) {
        toast.info({
          title: "Carrito actualizado",
          description: `Se quitaron productos que no están disponibles en ${destino.moneda.toUpperCase()}: ${res.removedItems.join(", ")}`,
        })
      }
      router.push(res.newPath)
      router.refresh()
    } catch (e: any) {
      toast.error({
        title: "Error al cambiar de moneda",
        description: e?.message || "Intenta de nuevo.",
      })
    } finally {
      setCambiando(false)
    }
  }

  return (
    <label className="flex items-center gap-1">
      <span className="sr-only">Moneda</span>
      <select
        value={actual}
        disabled={cambiando}
        onChange={(e) => cambiar(e.target.value)}
        className={`rounded px-1.5 py-0.5 text-[12px] font-semibold cursor-pointer ${estilo}`}
      >
        {opciones.map((o) => (
          <option key={o.regionId} value={o.regionId} className="text-[#1B1B18]">
            {o.moneda.toUpperCase()} $
          </option>
        ))}
      </select>
    </label>
  )
}
