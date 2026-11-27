import { TS } from "@/i18n/TS"
import { metaEnIdioma } from "@/i18n/servidor"
import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import { contactoPrivacidad, EMPRESA, ligaWhatsApp } from "@/lib/hetna/empresa"
import { idiomaServidor } from "@/lib/helpers/idioma-servidor"

// Cómo pedir que se borre una cuenta de la app HETNA CNC (Cotizador) o de la
// tienda. Google Play pide esta página (formulario de seguridad de datos) y un
// botón dentro de la app que lleve aquí (menú Más → Eliminar mi cuenta).
// Lo que se borra y lo que se conserva está en el aviso de privacidad, sección 14.

async function generateMetadataEs(): Promise<Metadata> {
  const en = (await idiomaServidor()) === "en"
  return {
    alternates: { canonical: "https://hetnacnc.com/mx/eliminar-cuenta" },
    title: en ? "Delete your account" : "Eliminar tu cuenta",
    description: en
      ? "How to delete your HETNA CNC account (shop app and store): what is deleted, what is kept and how long it takes."
      : "Cómo eliminar tu cuenta de HETNA CNC (app para talleres y tienda): qué se borra, qué se conserva y en cuánto tiempo.",
  }
}

export default async function EliminarCuenta() {
  const en = (await idiomaServidor()) === "en"
  const correo = contactoPrivacidad()
  const asunto = en ? "Delete my HETNA CNC account" : "Eliminar mi cuenta de HETNA CNC"
  const cuerpo = en
    ? "Hello, I want to delete my HETNA CNC account.\nEmail of the account: \nShop name (if I am the administrator): "
    : "Hola, quiero eliminar mi cuenta de HETNA CNC.\nCorreo de la cuenta: \nNombre del taller (si soy el administrador): "
  const mailto = correo ? `mailto:${correo}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(cuerpo)}` : ""
  const wa = ligaWhatsApp(cuerpo)
  const boton = "inline-block rounded-lg px-4 py-2 text-sm font-semibold no-underline"

  return (
    <PaginaInfo
      etiqueta="Legal"
      titulo={en ? "Delete your account" : "Eliminar tu cuenta"}
      resumen={
        en
          ? "For the HETNA CNC shop app (Cotizador) and the hetnacnc.com store."
          : "Para la app HETNA CNC para talleres (Cotizador) y la tienda hetnacnc.com."
      }
    >
      <h2><TS>{en ? "How to request it" : "Cómo pedirlo"}</TS></h2>
      <ol>
        <li>
          <TS>{en
            ? "Write to us from the email of your account (or tell us that email if you use WhatsApp)."
            : "Escríbenos desde el correo de tu cuenta (o dinos ese correo si usas WhatsApp)."}</TS>
        </li>
        <li>
          <TS>{en
            ? "If you are the shop's administrator, tell us the shop's name: the whole shop is deleted, including its employees' accounts."
            : "Si eres el administrador del taller, dinos el nombre del taller: se borra todo el taller, con las cuentas de sus empleados."}</TS>
        </li>
        <li>
          <TS>{en
            ? "We confirm by the same channel that the request is yours and tell you when it is done."
            : "Te confirmamos por el mismo medio que la solicitud es tuya y te avisamos cuando quede hecho."}</TS>
        </li>
      </ol>
      <p className="not-prose flex flex-wrap gap-3">
        {mailto && (
          <a href={mailto} className={`${boton} bg-[#142033] text-white`}>
            <TS>{en ? "Request by email" : "Pedirlo por correo"}</TS>
          </a>
        )}
        <a href={wa} target="_blank" rel="noopener noreferrer" className={`${boton} border border-[#142033] text-[#142033]`}>
          <TS>{en ? "Request by WhatsApp" : "Pedirlo por WhatsApp"}</TS>
        </a>
      </p>
      <p>
        <TS>{en
          ? `You can also do it from the app: More menu → Delete my account. Contact: ${correo || EMPRESA.whatsappVisible}.`
          : `También puedes hacerlo desde la app: menú Más → Eliminar mi cuenta. Contacto: ${correo || EMPRESA.whatsappVisible}.`}</TS>
      </p>

      <h2><TS>{en ? "What is deleted" : "Qué se borra"}</TS></h2>
      <ul>
        <li><TS>{en ? "Your user, name, email and phone." : "Tu usuario, nombre, correo y teléfono."}</TS></li>
        <li>
          <TS>{en
            ? "If you are the shop's administrator: the shop's quotes, orders, customers, products, inventory, purchases, expenses, machines, employees and uploaded files."
            : "Si eres el administrador del taller: cotizaciones, pedidos, clientes, productos, inventario, compras, gastos, máquinas, empleados y archivos del taller."}</TS>
        </li>
        <li><TS>{en ? "The notification identifier of your devices." : "El identificador de notificaciones de tus teléfonos."}</TS></li>
      </ul>

      <h2><TS>{en ? "What is kept" : "Qué se conserva"}</TS></h2>
      <ul>
        <li>
          <TS>{en
            ? "Only what the law requires us to keep (for example, issued invoices), and for as long as it requires."
            : "Solo lo que la ley nos obligue a guardar (por ejemplo, facturas emitidas), y por el tiempo que lo exija."}</TS>
        </li>
        <li>
          <TS>{en
            ? "Encrypted backup copies are deleted when those backups are rotated."
            : "Las copias de respaldo cifradas se borran cuando esos respaldos se renuevan."}</TS>
        </li>
      </ul>

      <h2><TS>{en ? "How long it takes" : "En cuánto tiempo"}</TS></h2>
      <p>
        <TS>{en
          ? "We reply within 20 business days at most and, if it applies, we delete within 15 business days after replying (privacy notice, section 9)."
          : "Te respondemos en un máximo de 20 días hábiles y, si procede, lo borramos en un máximo de 15 días hábiles después de responderte (aviso de privacidad, sección 9)."}</TS>
      </p>
      <p>
        <a href="/mx/aviso-de-privacidad#app"><TS>{en ? "Privacy notice, section 14" : "Aviso de privacidad, sección 14"}</TS></a>
      </p>
    </PaginaInfo>
  )
}

// Título y descripción en el idioma de la página (src/i18n/servidor.ts)
export async function generateMetadata(...args: Parameters<typeof generateMetadataEs>) {
  return metaEnIdioma(await generateMetadataEs(...args))
}
