import { EstudioModeloIA, type InfoModeloIa } from "@/components/hetna/escaneos/EstudioModeloIA"
import { saldoBreve } from "@/lib/creditos/acciones"
import { retrieveCustomer } from "@/lib/data/customer"
import { type Escaneo, listarEscaneos } from "@/lib/escaneos/acciones"

// Escaneo 3D dentro del espacio "Diseñar y escanear". Antes vivía sólo en
// /taller/escaneos/nuevo, detrás de la sesión. Aquí quien no ha entrado ve qué
// es y cómo funciona, y entra sin perder la página (volver=…).
const PASOS = [
  { t: "Toma una foto", d: "La pieza completa, con buena luz y fondo liso. Puedes agregar más vistas." },
  { t: "Genera el modelo", d: "La IA lo reconstruye con textura en 3 a 5 minutos." },
  { t: "Descárgalo", d: "GLB con color o STL para imprimir y maquinar, las veces que quieras." },
]

export const EscanearPieza = async ({ locale }: { locale: string }) => {
  const cliente = await retrieveCustomer().catch(() => null)
  const volver = encodeURIComponent(`/${locale}/disenar/escanear-pieza`)

  let modeloIa: InfoModeloIa = { gratis_por_mes: 1, usados_mes: 0, creditos: 2 }
  let recientes: Escaneo[] = []
  let saldo: { saldo: number; ilimitado: boolean } | null = null
  if (cliente) {
    // Precios y cupo gratis vienen del backend, para no tener una copia propia
    // que se desincronice.
    const [res, s] = await Promise.all([listarEscaneos({ limite: 8 }), saldoBreve()])
    if (res.ok) {
      if (res.datos.modelo_ia) modeloIa = res.datos.modelo_ia
      recientes = res.datos.escaneos
    }
    saldo = s
  }

  if (cliente) {
    return (
      <>
        <h1 className="sr-only">Imagen a 3D con IA</h1>
        <EstudioModeloIA modeloIa={modeloIa} saldo={saldo} recientes={recientes} />
      </>
    )
  }

  return (
    <div className="flex flex-1 items-center bg-[#0D1015] px-4 py-10 text-white lg:px-10">
      <div className="mx-auto grid w-full max-w-[1100px] items-center gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div>
          <span className="inline-block rounded-full bg-[#F07A1A]/15 px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-[#F59A4A]">
            Imagen a 3D con IA · 1 gratis al mes
          </span>
          <h1 className="m-0 mt-3 text-[30px] font-bold leading-tight lg:text-[42px]">De una foto a un modelo 3D</h1>
          <p className="m-0 mt-3 max-w-[620px] text-[16px] leading-relaxed text-white/65">
            Sube la foto de una pieza, figura o producto y la IA crea el modelo con textura en minutos. Descárgalo en GLB (con
            color) o STL (para imprimir o maquinar). Todo queda guardado en tu cuenta.
          </p>
          <ol className="m-0 mt-7 grid list-none gap-3 p-0 sm:grid-cols-3">
            {PASOS.map((p, i) => (
              <li key={p.t} className="rounded-[14px] border border-white/10 bg-white/[0.03] p-4">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#F07A1A]/20 text-[13px] font-bold text-[#F59A4A]">
                  {i + 1}
                </span>
                <p className="m-0 mt-2 text-[15px] font-bold">{p.t}</p>
                <p className="m-0 mt-1 text-[13.5px] leading-relaxed text-white/60">{p.d}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-[16px] border border-white/10 bg-[#12161D] p-5">
          <p className="m-0 text-[18px] font-bold">Entra para crear tu modelo</p>
          <p className="m-0 mt-1.5 text-[14px] leading-relaxed text-white/60">
            Tus modelos se guardan en tu cuenta. Si no tienes, la creas en un minuto.
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <a
              href={`/${locale}/login?volver=${volver}`}
              className="inline-flex justify-center rounded-[10px] bg-gradient-to-r from-[#F07A1A] to-[#E0480F] px-5 py-3 text-[15px] font-semibold text-white hover:brightness-110"
            >
              Iniciar sesión
            </a>
            <a
              href={`/${locale}/register?volver=${volver}`}
              className="inline-flex justify-center rounded-[10px] border border-white/20 px-5 py-3 text-[15px] font-semibold hover:bg-white hover:text-[#0D1015]"
            >
              Crear cuenta gratis
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
