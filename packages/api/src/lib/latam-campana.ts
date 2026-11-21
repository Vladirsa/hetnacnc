// Preparar el terreno en Latinoamérica (fase 5): una publicación por semana en
// cada país que el dueño prendió en "Mercados" de la configuración de redes,
// invitando a talleres y clientes al pre-registro (hetnacnc.com/mx/latinoamerica/<país>).
//
// Los textos son fijos por país (con su forma de hablar y su moneda): la IA sólo
// los adapta a cada red; no inventa beneficios ni fechas de apertura.
import { STORE_URL } from "./licitacion"
import { T_POST, asegurarSocial, crearPublicacion, dentroDeHorario, leerConfig, zonaDe } from "./social-hub"

type Pais = { nombre: string; tu: "tu" | "vos"; cotizador?: string }

// Países con mercado en las redes (social-hub MERCADOS) y pre-registro abierto
export const PAISES_CAMPANA: Record<string, Pais> = {
  co: { nombre: "Colombia", tu: "tu", cotizador: "pesos colombianos e IVA del 19%" },
  cl: { nombre: "Chile", tu: "tu", cotizador: "pesos chilenos e IVA del 19%" },
  pe: { nombre: "Perú", tu: "tu", cotizador: "soles e IGV del 18%" },
  ar: { nombre: "Argentina", tu: "vos" },
}

/** Texto de la semana para un país (3 enfoques que se turnan: taller, cliente, herramientas). */
export function textoCampana(clave: string, semana: number): { titulo: string; texto: string; url: string } | null {
  const p = PAISES_CAMPANA[clave]
  if (!p) return null
  const url = `${STORE_URL}/mx/latinoamerica/${clave}?utm_source=redes&utm_medium=social&utm_campaign=latam_${clave}`
  const vos = p.tu === "vos"
  const tienes = vos ? "tenés" : "tienes"
  const apuntate = vos ? "Anotate" : "Apúntate"
  const enfoque = semana % 3
  if (enfoque === 0)
    return {
      titulo: `Talleres fundadores en ${p.nombre}`,
      url,
      texto:
        `¿${vos ? "Tenés" : "Tienes"} un taller CNC en ${p.nombre}? HETNA CNC, la red de talleres de router, láser y plasma de México, se prepara para abrir en ${p.nombre}. ` +
        `${apuntate} gratis como taller fundador: los primeros talleres de cada país entran antes que nadie a recibir solicitudes de fabricación.` +
        (p.cotizador ? ` Y el Cotizador para talleres ya funciona en ${p.nombre}, con ${p.cotizador}.` : ""),
    }
  if (enfoque === 1)
    return {
      titulo: `Piezas CNC en ${p.nombre}`,
      url,
      texto:
        `¿Necesitás piezas de corte láser, router o plasma en ${p.nombre}?`.replace("Necesitás", vos ? "Necesitás" : "Necesitas") +
        ` En HETNA CNC subes tu archivo y varios talleres te mandan su propuesta. Estamos por abrir en ${p.nombre}: ${apuntate.toLowerCase()} y te avisamos primero.`.replace("subes", vos ? "subís" : "subes"),
    }
  return {
    titulo: `Herramientas CNC gratis para ${p.nombre}`,
    url,
    texto:
      `Calculadora CNC, generadores de cajas y letreros para láser, y CAM 2D y 3D: gratis desde hoy en hetnacnc.com, también en ${p.nombre}. ` +
      `¿${tienes.charAt(0).toUpperCase() + tienes.slice(1)} taller? ${apuntate} como taller fundador para cuando abramos en tu país.`,
  }
}

const semanaDel = (d = new Date()) => Math.floor(d.getTime() / (7 * 86_400_000))

/** Crea la publicación de la semana en cada país prendido (una por país y semana). */
export async function campanaLatam(knex: any, logger?: any) {
  await asegurarSocial(knex)
  const cfg = await leerConfig(knex)
  const paises = (cfg.mercados_redes || []).filter((m: string) => PAISES_CAMPANA[m])
  const semana = semanaDel()
  const hechas: string[] = []
  for (const m of paises) {
    const t = textoCampana(m, semana)
    if (!t) continue
    const titulo = `${t.titulo} · semana ${semana}`
    if (await knex(T_POST).where({ titulo, mercado: m }).first("id").catch(() => null)) continue
    const cuando = dentroDeHorario(new Date(Date.now() + 60 * 60_000), cfg.horario, zonaDe(m))
    await crearPublicacion(knex, { origen: "manual", titulo, texto_base: t.texto, url: t.url, redes: ["facebook", "linkedin", "telegram"], estado: "programada", programada_para: cuando, mercado: m }, logger)
    hechas.push(m)
  }
  return { paises: hechas }
}
