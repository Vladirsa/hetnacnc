import { camposPara, formatoDe, idDe, normalizar } from "../social-estadisticas"

describe("Estadísticas de redes", () => {
  it("saca el id de Facebook de la liga cuando no se guardó", () => {
    expect(idDe("facebook", { ok: true, url: "https://www.facebook.com/109722907076187_123" })).toBe("109722907076187_123")
    expect(idDe("instagram", { ok: true, id: "1789" })).toBe("1789")
    expect(idDe("facebook", { ok: false, url: "https://www.facebook.com/1_2" })).toBeNull()
    expect(idDe("telegram", { ok: true, url: "https://t.me/hetna_cnc/5" })).toBeNull()
  })
  it("los campos pasan el filtro de n8n y van de más a menos métricas", () => {
    for (const c of [...camposPara("instagram", "1"), ...camposPara("facebook", "1_2"), ...camposPara("facebook", "9")]) expect(c).toMatch(/^[a-z_(),.0-9]+$/)
    expect(camposPara("facebook", "9")).toHaveLength(1)
  })
  it("normaliza Instagram y Facebook y pesa más compartir y guardar", () => {
    const ig = normalizar("instagram", { like_count: 10, comments_count: 2, insights: { data: [{ name: "reach", values: [{ value: 500 }] }, { name: "saved", values: [{ value: 3 }] }, { name: "shares", total_value: { value: 1 } }] } })
    expect(ig).toMatchObject({ me_gusta: 10, comentarios: 2, alcance: 500, guardados: 3, compartidos: 1, interaccion: 10 + 4 + 3 + 9 })
    const fb = normalizar("facebook", { reactions: { summary: { total_count: 7 } }, comments: { summary: { total_count: 1 } }, shares: { count: 2 } })
    expect(fb).toMatchObject({ me_gusta: 7, comentarios: 1, compartidos: 2, interaccion: 7 + 2 + 6 })
  })
  it("reconoce el formato por los medios", () => {
    expect(formatoDe([])).toBe("texto")
    expect(formatoDe([{ url: "https://x/a.jpg" }])).toBe("imagen")
    expect(formatoDe([{ url: "https://x/a.jpg" }, { url: "https://x/b.jpg" }])).toBe("carrusel")
    expect(formatoDe([{ url: "https://x/a.mp4" }])).toBe("video")
  })
})
