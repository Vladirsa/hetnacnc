"use client"

import { T } from "@/components/hetna/i18n/Idioma"
import { useRouter } from "next/navigation"
import { useState } from "react"

const MAX_MB = 95

// Sube el escaneo y las fotos a la solicitud (uno por uno, con avance).
export function SubirArchivosEscanear({ id }: { id: string }) {
  const router = useRouter()
  const [estado, setEstado] = useState("")
  const [error, setError] = useState("")
  const [ocupado, setOcupado] = useState(false)

  function subirUno(archivo: File, tipo: "escaneo" | "foto") {
    return new Promise<string | null>((ok) => {
      const form = new FormData()
      form.append("tipo", tipo)
      form.append("archivo", archivo, archivo.name)
      const x = new XMLHttpRequest()
      x.open("POST", `/api/escanear/${id}/archivos`)
      x.upload.onprogress = (e) => e.lengthComputable && setEstado(`Subiendo ${archivo.name}: ${Math.round((e.loaded / e.total) * 100)}%`)
      x.onload = () => {
        let m = ""
        try {
          m = JSON.parse(x.responseText).message || ""
        } catch {}
        ok(x.status >= 200 && x.status < 300 ? null : m || "No se pudo subir el archivo.")
      }
      x.onerror = () => ok("Se cortó la conexión. Intenta de nuevo.")
      x.send(form)
    })
  }

  async function elegir(lista: FileList | null, tipo: "escaneo" | "foto") {
    if (!lista?.length) return
    setError("")
    setOcupado(true)
    for (const f of Array.from(lista)) {
      if (f.size > MAX_MB * 1024 * 1024) {
        setError(`${f.name} pasa de ${MAX_MB} MB. Exporta el escaneo simplificado (menos triángulos) o comprímelo en ZIP.`)
        continue
      }
      const e = await subirUno(f, tipo)
      if (e) setError(`${f.name}: ${e}`)
    }
    setOcupado(false)
    setEstado("")
    router.refresh()
  }

  const boton = "inline-flex cursor-pointer items-center rounded-[10px] border border-[#D9D5CC] bg-white px-4 py-2.5 text-[14px] font-semibold text-[#1B1B18] hover:border-[#C2560A]"
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <label className={`${boton} ${ocupado ? "pointer-events-none opacity-60" : ""}`}>
          <T>Subir escaneo (STL, OBJ, PLY, 3MF, ZIP)</T>
          <input type="file" className="sr-only" accept=".stl,.obj,.ply,.3mf,.zip" multiple onChange={(e) => elegir(e.target.files, "escaneo")} />
        </label>
        <label className={`${boton} ${ocupado ? "pointer-events-none opacity-60" : ""}`}>
          <T>Subir fotos</T>
          <input type="file" className="sr-only" accept="image/jpeg,image/png,image/webp" multiple onChange={(e) => elegir(e.target.files, "foto")} />
        </label>
      </div>
      <p className="m-0 text-[12.5px] text-[#6B6A63]"><T>Hasta</T> {MAX_MB} <T>MB por archivo. Si la pieza está rota, sube todos los fragmentos y, si existe, la pieza gemela sana.</T></p>
      {estado && <p className="m-0 text-[13px] text-[#0E2A5C]">{estado}</p>}
      {error && <p className="m-0 rounded-[10px] bg-[#FDECEC] px-3 py-2 text-[13.5px] text-[#9B1C1C]">{error}</p>}
    </div>
  )
}
