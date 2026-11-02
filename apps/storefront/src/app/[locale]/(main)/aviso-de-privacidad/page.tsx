import type { Metadata } from "next"

import PaginaInfo from "@/components/hetna/PaginaInfo"
import { BotonPreferenciasCookies } from "@/components/hetna/AvisoCookies"
import { contactoPrivacidad, EMPRESA, responsableLegal, ubicacionEmpresa } from "@/lib/hetna/empresa"
import { avisoEn, avisoEs, HISTORIAL, type Bloque, type Datos } from "@/lib/hetna/legal/aviso-privacidad"
import { idiomaServidor } from "@/lib/helpers/idioma-servidor"

// El texto vive en src/lib/hetna/legal/aviso-privacidad.ts (español e inglés).
// Esta página solo elige el idioma y lo dibuja.

export async function generateMetadata(): Promise<Metadata> {
  const en = (await idiomaServidor()) === "en"
  return en
    ? {
        alternates: { canonical: "https://hetnacnc.com/mx/aviso-de-privacidad" },
        title: "Privacy Notice",
        description:
          "HETNA CNC privacy notice: what personal data we collect, why, who we share it with, cookies, and how to exercise your rights in Mexico, the United States and Latin America.",
      }
    : {
        alternates: { canonical: "https://hetnacnc.com/mx/aviso-de-privacidad" },
        title: "Aviso de privacidad",
        description:
          "Aviso de privacidad de HETNA CNC: qué datos recabamos, para qué, con quién los compartimos, cookies y cómo ejercer tus derechos ARCO.",
      }
}

const datos = (en: boolean): Datos => ({
  responsable: responsableLegal(en ? "en" : "es"),
  domicilio: EMPRESA.domicilioCompleto || ubicacionEmpresa(),
  rfc: EMPRESA.rfc,
  correo: contactoPrivacidad(),
  whatsapp: EMPRESA.whatsappVisible,
  telefono: EMPRESA.telefonoVisible,
})

function Tabla({ cab, filas }: { cab: string[]; filas: string[][] }) {
  return (
    <div className="not-prose my-4 overflow-x-auto rounded-xl border border-[#E7E4DC]">
      <table className="w-full min-w-[560px] text-left text-sm">
        <thead className="bg-[#F3F1EA] text-[#142033]">
          <tr>
            {cab.map((c) => (
              <th key={c} className="px-3 py-2 font-semibold">{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f[0]} className="border-t border-[#E7E4DC] align-top">
              {f.map((c, i) => (
                <td key={i} className={`px-3 py-2 ${i === 0 ? "font-medium text-[#142033]" : "text-[#40403A]"}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function Bloques({ bloques }: { bloques: Bloque[] }) {
  return (
    <>
      {bloques.map((b, i) => {
        if ("p" in b) return <p key={i}>{b.p}</p>
        if ("ul" in b)
          return (
            <ul key={i}>
              {b.ul.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          )
        if ("tabla" in b) return <Tabla key={i} cab={b.tabla.cab} filas={b.tabla.filas} />
        if ("nota" in b) return <p key={i} className="text-sm italic text-[#6B6A63]">{b.nota}</p>
        return (
          <p key={i}>
            <BotonPreferenciasCookies className="rounded-lg border border-[#142033] px-4 py-2 text-sm font-semibold text-[#142033] hover:bg-[#142033] hover:text-white" />
          </p>
        )
      })}
    </>
  )
}

export default async function AvisoDePrivacidad() {
  const en = (await idiomaServidor()) === "en"
  const secciones = en ? avisoEn(datos(true)) : avisoEs(datos(false))

  return (
    <PaginaInfo
      etiqueta={en ? "Legal" : "Legal"}
      titulo={en ? "Privacy Notice" : "Aviso de privacidad"}
      resumen={
        en
          ? "How HETNA CNC collects, uses and protects your personal data in Mexico, the United States and Latin America."
          : "Cómo HETNA CNC recaba, usa y protege tus datos personales en México, Estados Unidos y Latinoamérica."
      }
    >
      <p className="text-sm text-[#6B6A63]">
        {en
          ? `Version ${EMPRESA.privacidadVersion} · Effective ${EMPRESA.privacidadVigencia.en}`
          : `Versión ${EMPRESA.privacidadVersion} · Vigente desde el ${EMPRESA.privacidadVigencia.es}`}
      </p>

      <nav aria-label={en ? "Contents" : "Contenido"} className="not-prose my-6 rounded-xl border border-[#E7E4DC] bg-white p-4">
        <p className="mb-2 text-sm font-bold text-[#142033]">{en ? "Contents" : "Contenido"}</p>
        <ol className="grid gap-1 text-sm sm:grid-cols-2">
          {secciones.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="text-[#B34D07] hover:underline">{s.titulo}</a>
            </li>
          ))}
        </ol>
      </nav>

      {secciones.map((s) => (
        <section key={s.id} id={s.id} className="scroll-mt-24">
          <h2>{s.titulo}</h2>
          <Bloques bloques={s.bloques} />
        </section>
      ))}

      <h2>{en ? "Version history" : "Historial de versiones"}</h2>
      <ul>
        {HISTORIAL.map((h) => (
          <li key={h.version}>
            {h.version} · {h.fecha}
            {" · "}
            {en ? h.cambioEn : h.cambio}
          </li>
        ))}
      </ul>
    </PaginaInfo>
  )
}
