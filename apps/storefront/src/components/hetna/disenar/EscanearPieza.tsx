import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { SubirEscaneo } from "@/components/hetna/taller/SubirEscaneo"
import { retrieveCustomer } from "@/lib/data/customer"
import { listarEscaneos } from "@/lib/escaneos/acciones"

// Escaneo 3D dentro del espacio "Diseñar y escanear". Antes vivía sólo en
// /taller/escaneos/nuevo, detrás de la sesión. Aquí quien no ha entrado ve qué
// es y cómo funciona, y entra sin perder la página (volver=…).
const PASOS = [
  { t: "Toma las fotos", d: "Alrededor de la pieza, con buena luz y sin moverla. Para la vista previa basta una." },
  { t: "Súbelas aquí", d: "Elige vista previa (gratis) o escaneo con medidas reales (con créditos)." },
  { t: "Baja tu modelo 3D", d: "Queda guardado en tu perfil: lo descargas las veces que quieras." },
]

export const EscanearPieza = async ({ locale }: { locale: string }) => {
  const cliente = await retrieveCustomer().catch(() => null)
  const volver = encodeURIComponent(`/${locale}/disenar/escanear-pieza`)

  let creditos = 5
  if (cliente) {
    // El precio viene del listado del backend, para no tener una copia propia
    // que se desincronice.
    const res = await listarEscaneos({ limite: 1 })
    if (res.ok) creditos = res.datos.creditos_por_escaneo
  }

  return (
    <div className="px-4 lg:px-8 pt-4 pb-12">
      <span className="inline-block text-[12px] font-bold tracking-wide uppercase bg-[#F3F1EA] text-[#6B675C] px-3 py-1 rounded-full">
        Vista previa gratis · escaneo con créditos
      </span>
      <h1 className="font-display text-[26px] lg:text-[34px] font-bold m-0 mt-2 text-[#1B1B18]">Escanear una pieza</h1>
      <p className="m-0 mt-1 text-[15px] text-[#6B6A63] max-w-[680px]">
        Sube fotos de una pieza que ya existe y recibe su archivo 3D. El resultado queda guardado en tu perfil: no se manda
        por correo ni por un link que caduca.
      </p>

      {cliente ? (
        <>
          <SubirEscaneo creditosPorEscaneo={creditos} />
          <p className="mt-6 text-[14px] text-[#4A4943]">
            ¿Ya escaneaste antes?{" "}
            <LocalizedClientLink href="/taller/escaneos" className="font-semibold text-[#B34D07] hover:underline">
              Ver mis escaneos
            </LocalizedClientLink>
          </p>
        </>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] items-start">
          <ol className="grid gap-3 sm:grid-cols-3">
            {PASOS.map((p, i) => (
              <li key={p.t} className="rounded-[14px] border border-[#E7E4DC] bg-white p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FDEEE1] text-[13px] font-bold text-[#B34D07]">
                  {i + 1}
                </span>
                <p className="mt-2 text-[15px] font-bold text-[#1B1B18]">{p.t}</p>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#4A4943]">{p.d}</p>
              </li>
            ))}
          </ol>
          <div className="rounded-[14px] bg-[#142033] p-5 text-white">
            <p className="text-[17px] font-bold">Entra para escanear</p>
            <p className="mt-1.5 text-[14px] leading-relaxed text-white/75">
              El escaneo se guarda en tu cuenta, por eso necesitas entrar. Si no tienes cuenta, la creas en un minuto.
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <a
                href={`/${locale}/login?volver=${volver}`}
                className="inline-flex justify-center bg-[#C2560A] hover:bg-[#A84A08] text-white font-semibold px-5 py-3 rounded-[10px] text-[15px]"
              >
                Iniciar sesión
              </a>
              <a
                href={`/${locale}/register?volver=${volver}`}
                className="inline-flex justify-center border border-white/30 hover:bg-white hover:text-[#142033] font-semibold px-5 py-3 rounded-[10px] text-[15px]"
              >
                Crear cuenta gratis
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
