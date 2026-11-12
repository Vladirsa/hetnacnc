import { ALCANCES, partes } from "../tiktok"

describe("TikTok", () => {
  it("sube en una parte hasta 64 MB y en partes de 10 MB arriba de eso", () => {
    const MB = 1024 * 1024
    expect(partes(3 * MB)).toEqual({ chunk: 3 * MB, total: 1 })
    expect(partes(64 * MB)).toEqual({ chunk: 64 * MB, total: 1 })
    const g = partes(95 * MB)
    expect(g.chunk).toBe(10 * MB)
    expect(g.total).toBe(9) // la última parte se lleva el sobrante
  })
  it("pide sólo los permisos necesarios", () => {
    expect(ALCANCES.split(",").sort()).toEqual(["user.info.basic", "video.publish", "video.upload"])
  })
})
