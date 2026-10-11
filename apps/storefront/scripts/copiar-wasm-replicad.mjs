// Copia el motor OpenCascade (WASM) de replicad a public/, para servirlo como
// archivo estático. No se comete al repo (23 MB) - se regenera en cada
// instalación. Si el paquete no está instalado (p.ej. build sin esta feature
// todavía resuelta), no falla el install.
import { existsSync, mkdirSync, copyFileSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"

const aqui = path.dirname(fileURLToPath(import.meta.url))
const origen = path.join(aqui, "..", "node_modules", "replicad-opencascadejs", "dist", "replicad_single.wasm")
const destinoDir = path.join(aqui, "..", "public", "wasm")
const destino = path.join(destinoDir, "replicad_single.wasm")

if (!existsSync(origen)) {
  console.log("[replicad] wasm no encontrado en node_modules, se omite la copia.")
  process.exit(0)
}

mkdirSync(destinoDir, { recursive: true })
copyFileSync(origen, destino)
console.log("[replicad] wasm copiado a public/wasm/replicad_single.wasm")
