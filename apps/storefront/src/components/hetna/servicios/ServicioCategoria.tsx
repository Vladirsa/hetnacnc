// Pasa por ImagenSegura: estas direcciones vienen de la base o del
// navegador, y next/image TRUENA con las que no empiezan en "/" o
// "https://" (una vista previa "blob:", por ejemplo).
import { ImagenSegura as Image } from '@/components/hetna/ImagenSegura'
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { TarjetaTrabajo } from "@/components/hetna/trabajos/TarjetaTrabajo"
import { listarTalleres, ubicacion } from "@/lib/hetna/talleres"
import { trabajosAbiertos } from "@/lib/trabajos/datos"

// Página de las categorías de Servicios. Un servicio no es un producto con
// precio fijo: quien llega aquí busca QUIÉN le fabrique algo, y casi nunca sabe
// cuánto cuesta. La página le contesta eso en orden:
//
//   1. qué es esto y los tres caminos según lo que ya sabe (precio al
//      instante, publicar su trabajo para que los talleres compitan, o ir
//      directo a un taller);
//   2. que hay movimiento real: trabajos abiertos de otros clientes;
//   3. con quién: los talleres de ese servicio;
//   4. cómo se paga y qué pasa con sus datos, que es lo que frena a publicar;
//   5. preguntas frecuentes, que también son lo que Google lee.
//
// Los trabajos abiertos le hablan también al taller que cae aquí buscando
// trabajo: es la mitad del mercado que esta página tiene que atraer.

type Info = { titulo: string; texto: string; servicio: string; coincide: string[]; calculadora?: string }

const SERVICIOS: Record<string, Info> = {
  servicios: {
    titulo: "Servicios de fabricación CNC",
    texto: "Corte, maquinado, diseño e impresión 3D con talleres de todo México. Describe tu pieza, recibe propuestas y elige la mejor.",
    servicio: "",
    coincide: [],
  },
  "diseno-2d-3d": {
    titulo: "Diseño 2D / 3D",
    texto: "Convierte tu idea, foto o boceto en un archivo DXF, SVG o STL listo para cortar o maquinar.",
    servicio: "Diseño CAD/CAM",
    coincide: ["Diseño CAD/CAM"],
  },
  "programacion-cam": {
    titulo: "Programación CAM",
    texto: "Trayectorias y G-code para tu máquina: router, fresadora, torno, láser o plasma.",
    servicio: "Diseño CAD/CAM",
    coincide: ["Diseño CAD/CAM"],
  },
  "corte-laser": {
    titulo: "Corte láser",
    texto: "Corte y grabado láser en MDF, madera, acrílico y más. Por pieza o por lote.",
    servicio: "Corte láser",
    coincide: ["Corte láser", "Grabado"],
    calculadora: "/cotizar/corte-laser",
  },
  "corte-plasma": {
    titulo: "Corte plasma",
    texto: "Corte de lámina y placa de acero, inoxidable y aluminio con plasma CNC.",
    servicio: "Corte plasma",
    coincide: ["Corte plasma"],
    calculadora: "/cotizar/corte-plasma",
  },
  "router-cnc": {
    titulo: "Router CNC",
    texto: "Corte y tallado de tableros grandes en MDF, triplay, madera sólida y acrílico.",
    servicio: "Corte CNC",
    coincide: ["Corte CNC", "Fresado de madera", "Maquinado"],
    calculadora: "/cotizar/router-cnc",
  },
  "maquinado-cnc": {
    titulo: "Maquinado CNC",
    texto: "Fresado de piezas en madera, plástico y metal con router o centro de maquinado.",
    servicio: "Maquinado",
    coincide: ["Maquinado", "Fresado de metal", "Fresado de madera", "Corte CNC"],
    calculadora: "/cotizar/router-cnc",
  },
  "torneado-cnc": {
    titulo: "Torneado CNC",
    texto: "Piezas cilíndricas, flechas, bujes y roscas en torno CNC.",
    servicio: "Maquinado",
    coincide: ["Maquinado", "Fresado de metal"],
  },
  "maquinado-4-y-5-ejes": {
    titulo: "Maquinado 4 y 5 ejes",
    texto: "Piezas complejas, moldes y relieves que necesitan 4.º o 5.º eje.",
    servicio: "Maquinado",
    coincide: ["Maquinado", "Fresado de metal"],
  },
  "impresion-3d": {
    titulo: "Impresión 3D",
    texto: "Prototipos y piezas funcionales en PLA, PETG, resina y más.",
    servicio: "Impresión 3D",
    coincide: ["Impresión 3D"],
    calculadora: "/cotizar/impresion-3d",
  },
  prototipado: {
    titulo: "Prototipado",
    texto: "De la idea a la primera pieza: diseño, ajuste y fabricación de prototipos.",
    servicio: "Otro",
    coincide: ["Diseño CAD/CAM", "Impresión 3D", "Maquinado", "Corte CNC"],
  },
  maquila: {
    titulo: "Maquila CNC",
    texto: "Producción por lotes con talleres de la red: corte, maquinado y acabados.",
    servicio: "Corte CNC",
    coincide: ["Corte CNC", "Maquinado", "Corte láser", "Corte plasma"],
  },
}

export const esCategoriaServicio = (handle?: string | null) => Boolean(handle && SERVICIOS[handle])

const CALCULADORAS = [
  { href: "/cotizar/corte-laser", texto: "Corte láser" },
  { href: "/cotizar/router-cnc", texto: "Router CNC" },
]

// Lo que de verdad pasa hoy, sin prometer de más: ver lib licitacion del API.
export const PREGUNTAS_FABRICACION: { p: string; r: string }[] = [
  {
    p: "¿Qué archivos aceptan?",
    r: "Para corte y grabado: DXF, DWG, SVG, AI, EPS, PDF o CDR. Para impresión 3D y maquinado: STL, STEP, IGES, 3MF u OBJ. También fotos, bocetos y ZIP. Puedes subir hasta 5 archivos de 25 MB, y se guardan privados: sólo los ven los talleres que cotizan tu trabajo.",
  },
  {
    p: "¿Puedo pedir solo una pieza?",
    r: "Sí. Muchos talleres hacen piezas sueltas y prototipos. En una sola pieza el precio unitario sale más alto que en lote, porque preparar la máquina cuesta lo mismo para una que para cien.",
  },
  {
    p: "¿Qué pasa si no tengo diseño?",
    r: "Elige \"No tengo archivo, necesito diseño\" y describe la pieza con medidas, para qué sirve y, si puedes, una foto o boceto. Los talleres que también diseñan te cotizan el diseño junto con la fabricación.",
  },
  {
    p: "¿Cuánto tarda la cotización?",
    r: "En corte láser, router, plasma e impresión 3D ves un precio estimado al instante con la calculadora. Si pides propuestas, los talleres reciben tu solicitud en el momento y tienen 7 días para mandarte precio y tiempo; te avisamos por correo cada vez que llega una.",
  },
  {
    p: "¿Hacen envíos?",
    r: "Sí, a todo México por paquetería. Cada taller dice en su propuesta si el precio ya incluye el envío. Si prefieres recoger o que te lo entreguen, indícalo en el formulario.",
  },
  {
    p: "¿Puedo pedir producción recurrente?",
    r: "Sí. En \"¿Cada cuánto lo necesitas?\" elige \"Cada mes\" o \"Producción recurrente\" y pon el volumen aproximado. Así te cotizan los talleres con capacidad para sostener pedidos que se repiten.",
  },
  {
    p: "¿Cómo se calcula el precio?",
    r: "Depende del material, el tiempo de máquina, la cantidad, el acabado y el envío. La calculadora te da un rango aproximado; el precio formal lo pone cada taller en su propuesta, con IVA y tiempo de entrega, y tú comparas.",
  },
  {
    p: "¿Puedo hablar directamente con el taller?",
    r: "Puedes elegir un taller del directorio y pedirle la cotización sólo a él. Para cuidar a las dos partes, los datos de contacto no se comparten: las dudas del taller te llegan por HETNA (correo o WhatsApp), y el pago se hace dentro de la plataforma.",
  },
  {
    p: "¿Quién ve mis datos?",
    r: "Tu nombre, correo y WhatsApp sólo los ve HETNA. Los talleres ven el trabajo (qué, cuánto, dónde y para cuándo) y tus archivos, nunca tus datos de contacto.",
  },
  {
    p: "¿Cuánto cuesta pedir cotización?",
    r: "Nada. Pedir y recibir propuestas es gratis; sólo pagas si eliges una, dentro de HETNA con Mercado Pago.",
  },
]

export default async function ServicioCategoria({ handle }: { handle: string }) {
  const info = SERVICIOS[handle]
  if (!info) return null

  const raiz = handle === "servicios"
  const servicioTrabajos = info.servicio && info.servicio !== "Otro" ? info.servicio : undefined

  const [todosTalleres, deEsteServicio, recientes] = await Promise.all([
    listarTalleres(),
    servicioTrabajos ? trabajosAbiertos({ servicio: servicioTrabajos, limit: 6 }) : Promise.resolve(null),
    trabajosAbiertos({ limit: 6 }),
  ])
  // Si de este servicio no hay trabajos abiertos se enseñan los recientes de
  // todos: lo que tiene que ver el cliente es que la red se mueve.
  const trabajos = deEsteServicio?.trabajos.length ? deEsteServicio : recientes
  const soloEste = Boolean(deEsteServicio?.trabajos.length)

  const talleres = todosTalleres
    .filter((t) => !info.coincide.length || t.perfil.servicios.some((s) => info.coincide.includes(s)))
    .sort((a, b) => Number(b.verificado) - Number(a.verificado))
    .slice(0, 6)
  const cotizar = `/cotizar${info.servicio ? `?servicio=${encodeURIComponent(info.servicio)}` : ""}`

  const caminos = [
    {
      titulo: "No sé cuánto cuesta",
      texto: "Publica tu trabajo gratis y los talleres te mandan su precio y tiempo de entrega. Comparas y eliges.",
      cta: "Publicar mi trabajo",
      href: cotizar,
      principal: true,
    },
    ...(info.calculadora || raiz
      ? [
          {
            titulo: "Es algo sencillo",
            texto: "Pon medidas, material y cantidad y ve el precio al instante.",
            cta: "Precio al instante",
            href: info.calculadora || CALCULADORAS[0].href,
            principal: false,
          },
        ]
      : []),
    {
      titulo: "Ya sé con quién",
      texto: "Busca un taller por servicio, máquina o ciudad y pídele cotización directo.",
      cta: "Ver talleres",
      href: "/talleres",
      principal: false,
    },
  ]

  return (
    <section className="mb-8 grid gap-6">
      {/* 1. Qué es y los caminos */}
      <div className="overflow-hidden rounded-3xl bg-[#142033] p-6 text-white sm:p-10">
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Servicio</p>
        <h2 className="mt-1 text-3xl font-extrabold sm:text-4xl">
          {raiz ? "¿Necesitas que te fabriquen algo?" : info.titulo}
        </h2>
        <p className="mt-2 max-w-2xl text-white/75">
          {raiz
            ? "Dinos qué necesitas y talleres de todo México compiten por hacerlo. Comparas precio y tiempo de entrega, eliges y pagas dentro de HETNA."
            : info.texto}
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {caminos.map((c) => (
            <LocalizedClientLink
              key={c.titulo}
              href={c.href}
              className={`flex flex-col gap-1 rounded-2xl p-4 transition ${
                c.principal ? "bg-[#C2560A] hover:brightness-110" : "bg-white/10 hover:bg-white/15"
              }`}
            >
              <span className="text-xs font-bold uppercase tracking-wide text-white/70">{c.titulo}</span>
              <span className="text-sm text-white/90">{c.texto}</span>
              <span className="mt-1 font-bold">{c.cta} →</span>
            </LocalizedClientLink>
          ))}
        </div>
      </div>

      {/* 2. Movimiento real */}
      {trabajos.trabajos.length > 0 && (
        <div>
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-extrabold text-[#142033]">
              {soloEste ? `Trabajos de ${info.titulo.toLowerCase()} buscando taller` : "Trabajos buscando taller ahora"}
            </h3>
            <LocalizedClientLink
              href={soloEste && servicioTrabajos ? `/trabajos?servicio=${encodeURIComponent(servicioTrabajos)}` : "/trabajos"}
              className="text-sm font-semibold text-[#C2560A]"
            >
              Ver los {trabajos.total} →
            </LocalizedClientLink>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trabajos.trabajos.map((t) => (
              <TarjetaTrabajo key={t.folio} trabajo={t} />
            ))}
          </div>
          <p className="mt-3 text-sm text-[#6B675C]">
            ¿Tienes taller?{" "}
            <a href="/seller/solicitudes" className="font-semibold text-[#C2560A]">
              Entra a tu panel y manda tu propuesta
            </a>
            . Registrarte es gratis.
          </p>
        </div>
      )}

      {/* 3. Con quién */}
      {talleres.length > 0 && (
        <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-lg font-extrabold text-[#142033]">
              {raiz ? "Talleres de la red" : `Talleres que ofrecen ${info.titulo.toLowerCase()}`}
            </h3>
            <LocalizedClientLink href="/talleres" className="text-sm font-semibold text-[#C2560A]">
              Ver todos →
            </LocalizedClientLink>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {talleres.map((t) => (
              <LocalizedClientLink
                key={t.id}
                href={`/talleres/${t.handle}`}
                className="flex items-center gap-3 rounded-xl border border-[#E7E4DC] p-3 transition hover:shadow-md"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#142033] font-extrabold text-white">
                  {t.logo ? (
                    <Image src={t.logo} alt="" className="h-full w-full object-cover" width={300} height={300} />
                  ) : (
                    t.nombre.slice(0, 2).toUpperCase()
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate font-bold text-[#142033]">{t.nombre}</span>
                    {t.verificado && (
                      <span title="Verificado por HETNA" className="shrink-0 text-xs font-bold text-[#1F5A2B]">
                        ✓
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-[#6B675C]">{ubicacion(t.perfil) || "México"}</span>
                </span>
              </LocalizedClientLink>
            ))}
          </div>
        </div>
      )}

      {/* 4. Cómo funciona y qué pasa con sus datos */}
      <ol className="grid gap-3 sm:grid-cols-3">
        {[
          ["1", "Describe tu trabajo", "Material, medidas, cantidad y, si lo tienes, tu archivo. Es gratis."],
          ["2", "Recibe propuestas", "Los talleres ven tu trabajo, nunca tus datos, y te mandan precio y tiempo de entrega."],
          ["3", "Elige y paga en HETNA", "Pagas con Mercado Pago dentro de la plataforma, sin tratar dinero por fuera."],
        ].map(([n, t, d]) => (
          <li key={n} className="flex gap-3 rounded-2xl border border-[#E7E4DC] bg-white p-4">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#FFF1E6] font-extrabold text-[#C2560A]">{n}</span>
            <span>
              <span className="block font-bold text-[#142033]">{t}</span>
              <span className="text-sm text-[#6B675C]">{d}</span>
            </span>
          </li>
        ))}
      </ol>

      {/* 5. Preguntas frecuentes (también para Google) */}
      <div className="rounded-2xl border border-[#E7E4DC] bg-white p-5 sm:p-6">
        <h3 className="mb-2 text-lg font-extrabold text-[#142033]">Preguntas frecuentes</h3>
        {PREGUNTAS_FABRICACION.map((q) => (
          <details key={q.p} className="border-t border-[#E7E4DC] py-3 first:border-t-0">
            <summary className="cursor-pointer font-semibold text-[#142033]">{q.p}</summary>
            <p className="mt-2 text-sm text-[#44433D]">{q.r}</p>
          </details>
        ))}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "FAQPage",
              mainEntity: PREGUNTAS_FABRICACION.map((q) => ({
                "@type": "Question",
                name: q.p,
                acceptedAnswer: { "@type": "Answer", text: q.r },
              })),
            }).replace(/</g, "\\u003c"),
          }}
        />
      </div>
    </section>
  )
}
