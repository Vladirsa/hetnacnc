import { existsSync, readFileSync } from "fs"
import { join } from "path"

import { DEL_2D, DEL_3D, HERRAMIENTAS } from "../fabrica/promociones"

// Las herramientas del 2D Studio que se promueven en redes deben existir en la
// tienda (su página y su imagen); si alguien renombra una, esta prueba avisa.
describe("promoción de herramientas del 2D Studio", () => {
  const tienda = join(__dirname, "../../../../../apps/storefront")
  const catalogo = readFileSync(join(tienda, "src/lib/hetna/disenar.ts"), "utf8")

  it("salen en el grupo del Studio (martes, jueves y domingo)", () => {
    for (const c of DEL_2D) expect(DEL_3D).toContain(c)
  })

  it("cada una apunta a una herramienta y una imagen que existen", () => {
    for (const c of DEL_2D) {
      const h = HERRAMIENTAS.find((x) => x.clave === c)
      expect(h).toBeDefined()
      const slug = h!.ruta.replace(/^\/mx\/disenar\//, "")
      expect(catalogo.includes(`slug: "${slug}"`)).toBe(true)
      const archivo = (h!.imagen || "").replace(/^.*\/img\//, "img/")
      expect(existsSync(join(tienda, "public", archivo))).toBe(true)
      expect(h!.en?.texto).toBeTruthy()
    }
  })
})
