import { readdirSync, readFileSync } from "fs"
import { join } from "path"

import { leerGuiaMd, textoAHtml } from "../guias-md"

const carpeta = join(__dirname, "../../../../../docs/guias-blog")

describe("guías del blog en docs/guias-blog", () => {
  it("las 4 se leen completas, con sección válida y sin texto de la cabecera en el contenido", () => {
    const archivos = readdirSync(carpeta).filter((f) => f.endsWith(".md"))
    expect(archivos.length).toBeGreaterThanOrEqual(4)
    for (const f of archivos) {
      const g = leerGuiaMd(readFileSync(join(carpeta, f), "utf8"))
      expect({ f, ok: !!g }).toEqual({ f, ok: true })
      expect(g!.excerpt.length).toBeGreaterThan(40)
      expect(g!.content_html).toMatch(/<h2>/)
      expect(g!.content_html).not.toMatch(/Dirección \(slug\)|CONTENIDO/)
      expect((g!.seo_title || "").length).toBeLessThanOrEqual(70)
      expect((g!.seo_description || "").length).toBeLessThanOrEqual(170)
    }
  })
  it("la guía de fresas tiene la dirección a la que redirigen los artículos viejos", () => {
    const g = leerGuiaMd(readFileSync(join(carpeta, "03-fresa-para-mdf.md"), "utf8"))!
    expect(g.slug).toBe("que-fresa-usar-para-mdf-router-cnc")
    expect(g.categoria).toBe("router-cnc")
  })
  it("convierte texto simple igual que el panel y escapa HTML", () => {
    expect(textoAHtml("## Hola\n\n- **a**\n- [b](https://x.mx)\n\n<script>")).toBe('<h2>Hola</h2>\n<ul><li><strong>a</strong></li><li><a href="https://x.mx">b</a></li></ul>\n<p>&lt;script&gt;</p>')
  })
})
