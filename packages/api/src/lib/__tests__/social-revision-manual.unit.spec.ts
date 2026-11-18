import { leerArticulo } from "../blog"
import { motivoSinIa, validarHorario } from "../social-hub"
import { FUENTES_PILOTO, pilotoPuedeProgramar } from "../social-telegram"

describe("Piloto automático: nunca programa lo retenido para revisión", () => {
  const promo = { estado: "borrador", origen: "manual", fuente: "promo", en_revision: null }
  it("programa los borradores generados por el sistema", () => {
    for (const fuente of FUENTES_PILOTO) expect(pilotoPuedeProgramar({ ...promo, fuente })).toBe(true)
  })
  it("excluye los retenidos para revisión aunque parezcan promoción", () => {
    expect(pilotoPuedeProgramar({ ...promo, en_revision: true })).toBe(false)
  })
  it("excluye anuncios de talleres y productos nuevos aunque su título empiece con Promo", () => {
    // Antes la reclasificación por título les ponía fuente = 'promo'
    expect(pilotoPuedeProgramar({ ...promo, origen: "taller" })).toBe(false)
    expect(pilotoPuedeProgramar({ ...promo, origen: "producto" })).toBe(false)
  })
  it("excluye lo que no es borrador o no tiene fuente conocida", () => {
    expect(pilotoPuedeProgramar({ ...promo, estado: "programada" })).toBe(false)
    expect(pilotoPuedeProgramar({ ...promo, fuente: null })).toBe(false)
    expect(pilotoPuedeProgramar({ ...promo, fuente: "estudio" })).toBe(false)
  })
})

describe("Horario del Social Hub", () => {
  const actual = { desde: 9, hasta: 20 }
  it("acepta un horario válido o sin cambios", () => {
    expect(validarHorario({ desde: 8, hasta: 22 }, actual)).toBeNull()
    expect(validarHorario(undefined, actual)).toBeNull()
    expect(validarHorario({ desde: 0, hasta: 24 }, actual)).toBeNull()
  })
  it("rechaza hasta <= desde con un mensaje", () => {
    expect(validarHorario({ desde: 20, hasta: 9 }, actual)).toMatch(/hora final/)
    expect(validarHorario({ desde: 10, hasta: 10 }, actual)).toMatch(/hora final/)
    // Sólo cambia una de las dos: se compara contra la que ya estaba
    expect(validarHorario({ desde: 21 }, actual)).toMatch(/hora final/)
  })
  it("rechaza valores que no son número", () => {
    expect(validarHorario({ desde: "abc", hasta: 20 }, actual)).toMatch(/número/)
  })
})

describe("Mensaje cuando no hay IA", () => {
  const antes = { llave: process.env.ANTHROPIC_API_KEY, social: process.env.SOCIAL_IA }
  afterEach(() => {
    if (antes.llave === undefined) delete process.env.ANTHROPIC_API_KEY
    else process.env.ANTHROPIC_API_KEY = antes.llave
    if (antes.social === undefined) delete process.env.SOCIAL_IA
    else process.env.SOCIAL_IA = antes.social
  })
  it("distingue la llave faltante de SOCIAL_IA=off", () => {
    delete process.env.ANTHROPIC_API_KEY
    expect(motivoSinIa()).toMatch(/ANTHROPIC_API_KEY/)
    process.env.ANTHROPIC_API_KEY = "x"
    process.env.SOCIAL_IA = "off"
    expect(motivoSinIa()).toMatch(/SOCIAL_IA=off/)
  })
})

describe("Blog: validación al crear y al editar", () => {
  const base = { title: "Cómo calibrar un router CNC", content_html: "x".repeat(60) }
  it("rechaza ligas de portada o video que no empiezan con http(s)", () => {
    expect(leerArticulo({ ...base, cover_image_url: "www.foto.com/a.jpg" }).error).toMatch(/portada/)
    expect(leerArticulo({ video_url: "youtube.com/x" }, true).error).toMatch(/video/)
  })
  it("vacío quita la liga sin error", () => {
    const r = leerArticulo({ cover_image_url: "", video_url: "" }, true)
    expect(r.error).toBeUndefined()
    expect(r.datos).toMatchObject({ cover_image_url: null, video_url: null })
    expect(leerArticulo({ ...base, cover_image_url: "https://x.com/a.jpg" }).datos?.cover_image_url).toBe("https://x.com/a.jpg")
  })
  it("al editar, el título también debe tener 8 letras si llega", () => {
    expect(leerArticulo({ title: "Corto" }, true).error).toMatch(/8 letras/)
    expect(leerArticulo({ title: "" }, true).error).toMatch(/8 letras/)
    expect(leerArticulo({ publicado: true }, true).error).toBeUndefined()
  })
})
