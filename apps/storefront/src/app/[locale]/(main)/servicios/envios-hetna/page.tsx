import type { Metadata } from "next"

import CotizadorEnvio from "@/components/hetna/envios/CotizadorEnvio"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { ligaWhatsApp } from "@/lib/hetna/empresa"

export const metadata: Metadata = {
  title: "Envíos HETNA | Envíos para piezas, herramientas y materiales CNC en México",
  description:
    "Cotiza y envía piezas fabricadas, herramientas, materiales y pedidos técnicos a todo México. Compara paqueterías con precio final, días de entrega y recolección, paga en línea y recibe tu guía por correo.",
}

// Página del servicio de envíos. Responde en orden lo que pregunta quien llega:
// ¿es para mí?, ¿qué puedo enviar?, ¿por qué con HETNA y no directo con la
// paquetería?, ¿cómo empiezo? Todo lo que dice es lo que el servicio hace hoy
// (cotizador con Skydropx, pago con Mercado Pago, guía por correo; guías desde
// el panel del taller, protección SOS de Skydropx, que no es un seguro y así se dice).

const REJILLA =
  "repeating-linear-gradient(0deg,rgba(255,255,255,.06) 0 1px,transparent 1px 28px),repeating-linear-gradient(90deg,rgba(255,255,255,.06) 0 1px,transparent 1px 28px)"

const CAJA = "rounded-2xl border border-[#E7E4DC] bg-white p-6 sm:p-8"
const H2 = "text-2xl font-extrabold text-[#142033] sm:text-3xl"
const WHATSAPP_VOLUMEN = ligaWhatsApp("Hola, quiero cotizar envíos por volumen con Envíos HETNA. Envío aproximadamente ___ paquetes al mes desde ___.")
const WHATSAPP_AYUDA = ligaWhatsApp("Hola, tengo una duda con un envío de Envíos HETNA.")

const DIFERENTE = [
  "Tarifas negociadas y varias paqueterías en una sola cotización",
  "Hecho para piezas, materiales y pedidos técnicos",
  "Precio final, días de entrega, rastreo y soporte en México",
]

const PARA_QUIEN = [
  ["Talleres CNC", "Mandan piezas terminadas, maquila y prototipos a sus clientes."],
  ["Vendedores de herramientas", "Fresas, insertos, refacciones y accesorios a todo el país."],
  ["Proveedores de materiales", "Tableros, láminas, acrílico y perfiles, incluso en bulto."],
  ["Clientes que compran piezas", "Reciben su pedido o mandan una pieza de muestra al taller."],
  ["Empresas con envíos B2B", "Pedidos recurrentes entre plantas, sucursales y proveedores."],
] as const

const QUE_ENVIAR = [
  "Piezas fabricadas",
  "Prototipos",
  "Lotes de producción",
  "Herramientas y fresas",
  "Refacciones y accesorios",
  "Tableros, láminas y acrílico",
  "Perfiles y material en tramo",
  "Pedidos de tienda",
  "Letreros y piezas de corte láser",
]

const PASOS = [
  ["1", "Cotiza", "Código postal de origen y destino, medidas y peso del paquete ya embalado."],
  ["2", "Compara", "Ves cada paquetería con su precio final, días de entrega y si recolecta o lo llevas a sucursal."],
  ["3", "Genera tu guía", "Llenas los datos de quien envía y quien recibe y pagas en línea con Mercado Pago. Te mandamos la guía por correo."],
  ["4", "Rastrea", "Con el número de guía sigues tu paquete hasta que llega."],
] as const

const TIPOS = [
  {
    titulo: "Envío estándar",
    texto: "Cajas, sobres y tubos: piezas, herramientas, refacciones y pedidos de tienda.",
    accion: "Cotizar ahora",
    href: "#cotizar-envio",
  },
  {
    titulo: "Envío protegido",
    texto: "Piezas nuevas frágiles o de valor: al solicitar tu envío activa “Proteger mi envío” y declara el valor (hasta $100,000). Cubre daño, faltante, extravío o robo según las condiciones de la protección.",
    accion: "Cotizar envío protegido",
    href: "#cotizar-envio",
  },
  {
    titulo: "Piezas grandes y tarimas",
    texto: "Tableros, láminas, máquinas pequeñas y bultos. Elige “Tarima o bulto” al cotizar; si no sale opción para tu ruta, lo cotizamos contigo.",
    accion: "Cotizar pieza grande",
    href: "#cotizar-envio",
  },
  {
    titulo: "Volumen y B2B",
    texto: "Envías seguido o muchos paquetes al mes. Tarifa a la medida para tu volumen y rutas, y consolidamos varios pedidos al mismo destino en un solo envío.",
    accion: "Pedir tarifa por volumen",
    href: WHATSAPP_VOLUMEN,
  },
] as const

const VENTAJAS = [
  ["Tarifas negociadas", "Precios de plataforma con varias paqueterías, sin abrir cuentas ni firmar contratos por tu lado."],
  ["Comparas en un solo lugar", "No hay que cotizar paquetería por paquetería: ves todas las opciones de tu ruta juntas."],
  ["Precio final antes de pagar", "Ya incluye el peso volumétrico: si tu paquete es grande y ligero, te lo decimos antes, no después."],
  ["Direcciones validadas", "El código postal y la colonia salen del catálogo de Correos de México: menos paquetes devueltos."],
  ["Soporte si algo sale mal", "Con tu folio te ayudamos a dar seguimiento con la paquetería por WhatsApp."],
  ["Pensado para piezas técnicas", "Sabemos de piezas maquinadas, tableros y herramientas: te orientamos en cómo embalarlas."],
  ["Consolidamos pedidos", "¿Varios pedidos al mismo destino o envíos cada semana? Los juntamos para que pagues menos por pieza."],
  ["Integrado a la tienda", "Si vendes en HETNA, el envío se calcula solo en el checkout y la guía sale desde tu panel."],
] as const

const CONFIANZA = [
  ["🇲🇽", "Cobertura nacional"],
  ["📦", "Rastreo con número de guía"],
  ["💳", "Pago seguro con Mercado Pago"],
  ["💬", "Soporte por WhatsApp"],
  ["✉️", "Guía directo a tu correo"],
] as const

const TALLERES = [
  "El costo del envío se calcula solo en cada pedido, con el peso y las medidas de tus productos",
  "Generas la guía desde tu panel, en Guías, con la paquetería que pagó el cliente",
  "El cliente recibe la guía por correo y ve el rastreo en Mis pedidos",
  "El pedido se marca como entregado cuando la paquetería lo entrega",
  "Sin contratar paqueterías ni abrir cuentas por tu lado",
]

const PREGUNTAS: [string, string][] = [
  [
    "¿Qué paqueterías manejan?",
    "Comparamos varias paqueterías nacionales en una sola cotización. Las que aparecen dependen de la ruta, el tamaño y el peso del paquete. En cada opción ves el precio final, los días de entrega y si pasan a recolectar o hay que llevarlo a sucursal.",
  ],
  [
    "¿Puedo enviar piezas grandes, pesadas o frágiles?",
    "Sí. Para piezas grandes elige “Tarima o bulto” al cotizar y escribe las medidas y el peso ya embalado (con la tarima incluida); si el paquete es grande y ligero, las paqueterías cobran por peso volumétrico y te lo decimos antes de pagar. Para piezas frágiles o de valor activa la protección del envío. Si para tu ruta no sale ninguna opción, escríbenos y lo cotizamos contigo.",
  ],
  [
    "¿Hacen envíos a todo México?",
    "Sí, a cualquier código postal donde llegue la paquetería. Algunas zonas alejadas tienen menos opciones o tardan más días; lo ves en la cotización.",
  ],
  [
    "¿Cuánto tarda la entrega?",
    "Cada opción muestra los días hábiles estimados. Dependen de la paquetería, el servicio (económico o rápido) y el destino.",
  ],
  [
    "¿Qué pasa si la paquetería dice que mi paquete pesa más?",
    "La paquetería vuelve a pesar y medir cada paquete. Si encuentra más peso o medidas que las cotizadas, cobra la diferencia (sobrepeso) y esa diferencia la paga quien envía. Para evitarlo: mide y pesa el paquete ya embalado (con la tarima, si va en tarima) y, antes de entregarlo, toma 4 fotos con la guía pegada y visible: alto, largo y ancho con la cinta métrica, y el paquete en la báscula. Con esas fotos se puede pelear un cobro injusto.",
  ],
  [
    "¿Cómo pago y cuándo recibo mi guía?",
    "Pagas en línea con Mercado Pago. En cuanto se confirma el pago generamos la guía y te la mandamos por correo con el número de rastreo. La cotización es válida por 12 horas.",
  ],
  [
    "¿Qué pasa si mi paquete se daña o se pierde?",
    "Escríbenos con tu folio (ENV-…) y te ayudamos a levantar y dar seguimiento al reporte con la paquetería. Para piezas maquinadas o frágiles usa caja doble, esquineros y relleno: es lo que más evita daños.",
  ],
  [
    "¿Puedo proteger mi envío?",
    "Sí. Al solicitar tu envío activa “Proteger mi envío” y declara el valor real de lo que mandas (hasta $100,000 MXN, sin IVA, comprobable con factura). No es un seguro: es la SOS Protección de Skydropx, que cubre daño, faltante, extravío o robo durante el traslado. El costo depende del valor declarado y lo ves antes de pagar. No cubre artículos usados, celulares, tablets, laptops ni computadoras, equipo médico o científico, artículos prohibidos ni paquetes mal embalados.",
  ],
  [
    "¿Cómo reclamo si mi envío protegido llega dañado o no llega?",
    "Si el empaque viene abierto o alterado, recházalo con la paquetería y que quede constancia. Toma fotos y video del paquete con la guía visible y del contenido, y escríbenos con tu folio y la factura del producto dentro de las 48 horas hábiles después de recibirlo (si no llega, cuando el rastreo diga extraviado o pasen 15 días hábiles sin movimiento). Nosotros hacemos el reclamo con Skydropx; el reembolso depende de su resolución (25%, 50% o 100% según el daño, sin IVA ni costo de guía) y te lo regresamos en cuanto lo acreditan.",
  ],
  [
    "¿Qué no se puede enviar?",
    "Materiales peligrosos (inflamables, químicos, gases, baterías sueltas), armas y cualquier cosa que las paqueterías prohíben. Si tienes duda con tu pieza, pregúntanos antes.",
  ],
  [
    "¿Puedo usarlo si vendo en HETNA?",
    "Sí. Tus productos calculan el envío solos en el checkout y tú generas la guía desde tu panel, en Guías. El cliente recibe la guía por correo y el pedido se marca entregado cuando llega.",
  ],
  [
    "¿Puedo usarlo si tengo mi propia tienda o vendo por fuera?",
    "Sí. Cotiza aquí cualquier envío aunque no sea una venta en HETNA: solo necesitas una cuenta gratis para pagarlo y recibir tu guía.",
  ],
]

export default function EnviosHetnaPage() {
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: PREGUNTAS.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
  }

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 py-8 lg:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faq).replace(/</g, "\\u003c") }} />

      {/* Hero */}
      <header className="overflow-hidden rounded-3xl bg-[#142033] p-8 text-white sm:p-14" style={{ backgroundImage: REJILLA }}>
        <p className="text-xs font-bold uppercase tracking-[.2em] text-[#F2A25F]">Envíos HETNA</p>
        <h1 className="mt-2 max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">Envíos especializados para productos CNC y manufactura</h1>
        <p className="mt-3 max-w-2xl text-lg text-white/80">
          Envía piezas, herramientas, materiales y pedidos técnicos a todo México. Compara paqueterías, paga en línea y recibe tu guía por
          correo.
        </p>
        <ul className="mt-5 grid max-w-3xl gap-2 sm:grid-cols-3">
          {DIFERENTE.map((x) => (
            <li key={x} className="flex gap-2 text-sm text-white/90">
              <span className="font-bold text-[#F2A25F]">✓</span>
              {x}
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-wrap gap-3">
          <a href="#cotizar-envio" className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110">
            Cotizar mi envío
          </a>
          <a href="#talleres" className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10">
            Vendo en HETNA
          </a>
        </div>
      </header>

      <CotizadorEnvio />

      {/* Cómo funciona */}
      <section className="mt-12">
        <h2 className={H2}>Cómo funciona</h2>
        <ol className="mt-5 grid gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {PASOS.map(([n, t, d]) => (
            <li key={n} className="list-none rounded-2xl border border-[#E7E4DC] bg-white p-6">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-[#C2560A] font-extrabold text-white">{n}</span>
              <h3 className="mt-3 text-lg font-extrabold text-[#142033]">{t}</h3>
              <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Para quién y qué enviar */}
      <section className="mt-12 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className={CAJA}>
          <h2 className="text-xl font-extrabold text-[#142033]">¿Para quién es?</h2>
          <ul className="mt-4 grid gap-3">
            {PARA_QUIEN.map(([t, d]) => (
              <li key={t} className="flex gap-3">
                <span className="mt-0.5 font-bold text-[#C2560A]">✓</span>
                <span>
                  <strong className="block text-[#142033]">{t}</strong>
                  <span className="text-sm text-[#6B675C]">{d}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className={CAJA}>
          <h2 className="text-xl font-extrabold text-[#142033]">¿Qué puedes enviar?</h2>
          <ul className="mt-4 flex flex-wrap gap-2 p-0">
            {QUE_ENVIAR.map((x) => (
              <li key={x} className="list-none rounded-full bg-[#F3F1EA] px-3 py-1.5 text-sm font-medium text-[#40403A]">
                {x}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-[#6B675C]">
            No se envían materiales peligrosos (inflamables, químicos, gases, baterías sueltas). ¿Duda con tu pieza?{" "}
            <a href={WHATSAPP_AYUDA} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#C2560A] underline">
              Pregúntanos
            </a>
            .
          </p>
        </div>
      </section>

      {/* Tipos de envío */}
      <section className="mt-12">
        <h2 className={H2}>Tipos de envío</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TIPOS.map((t) => (
            <div key={t.titulo} className="flex flex-col rounded-2xl border border-[#E7E4DC] bg-white p-6">
              <h3 className="text-lg font-extrabold text-[#142033]">{t.titulo}</h3>
              <p className="mt-2 flex-1 text-sm text-[#6B675C]">{t.texto}</p>
              <a
                href={t.href}
                {...(t.href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="mt-4 inline-flex justify-center rounded-xl border border-[#C2560A] px-4 py-2.5 text-sm font-semibold text-[#C2560A] hover:bg-[#FFF1E6]"
              >
                {t.accion}
              </a>
            </div>
          ))}
        </div>
      </section>

      {/* Por qué con HETNA */}
      <section className="mt-12 rounded-3xl bg-[#F3F1EA] p-6 sm:p-10">
        <h2 className={H2}>¿Por qué con HETNA y no directo con la paquetería?</h2>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {VENTAJAS.map(([t, d]) => (
            <div key={t} className="rounded-2xl bg-white p-5">
              <p className="font-bold text-[#142033]">{t}</p>
              <p className="mt-1 text-sm text-[#6B675C]">{d}</p>
            </div>
          ))}
        </div>
        <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-2 p-0 text-sm font-semibold text-[#142033]">
          {CONFIANZA.map(([i, t]) => (
            <li key={t} className="list-none">
              <span aria-hidden="true">{i}</span> {t}
            </li>
          ))}
        </ul>
      </section>

      {/* Para talleres */}
      <section id="talleres" className={`${CAJA} mt-12 scroll-mt-28`}>
        <div className="grid gap-6 md:grid-cols-[1fr_auto] md:items-end">
          <div>
            <h2 className="text-xl font-extrabold text-[#142033] sm:text-2xl">Si vendes en HETNA, los envíos ya vienen incluidos</h2>
            <ul className="mt-4 grid gap-2 p-0">
              {TALLERES.map((x) => (
                <li key={x} className="flex list-none gap-2 text-[#40403A]">
                  <span className="font-bold text-[#C2560A]">✓</span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <div className="flex flex-col gap-2">
            <LocalizedClientLink
              href="/talleres/unete"
              className="rounded-xl bg-[#142033] px-5 py-3 text-center font-semibold text-white hover:brightness-125"
            >
              Registrar mi taller
            </LocalizedClientLink>
            <a href="/seller" className="text-center text-sm font-semibold text-[#C2560A] hover:underline">
              Ya vendo: ir a mi panel
            </a>
          </div>
        </div>
      </section>

      {/* Preguntas frecuentes */}
      <section className="mt-12">
        <h2 className={H2}>Preguntas frecuentes</h2>
        <div className="mt-5 grid gap-3">
          {PREGUNTAS.map(([q, a]) => (
            <details key={q} className="group rounded-2xl border border-[#E7E4DC] bg-white p-5 open:shadow-sm">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-bold text-[#142033]">
                {q}
                <span className="text-xl text-[#C2560A] transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 text-[#40403A]">{a}</p>
            </details>
          ))}
        </div>
      </section>

      {/* CTA final */}
      <section className="mt-12 rounded-3xl bg-[#142033] p-8 text-center text-white sm:p-12" style={{ backgroundImage: REJILLA }}>
        <h2 className="text-2xl font-extrabold sm:text-3xl">¿Listo para enviar?</h2>
        <p className="mx-auto mt-2 max-w-xl text-white/80">Cotiza en un minuto, compara paqueterías y recibe tu guía por correo.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a href="#cotizar-envio" className="rounded-xl bg-[#C2560A] px-6 py-3 font-semibold text-white hover:brightness-110">
            Cotizar mi envío
          </a>
          <a
            href={WHATSAPP_AYUDA}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-white/30 px-6 py-3 font-semibold text-white hover:bg-white/10"
          >
            Hablar con nosotros
          </a>
        </div>
      </section>
    </main>
  )
}
