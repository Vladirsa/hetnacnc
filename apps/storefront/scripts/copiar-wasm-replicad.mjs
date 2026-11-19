// Copia los motores WASM a public/wasm/ para servirlos como archivos estáticos.
// No se cometen al repo - se regeneran en cada instalación. Si un paquete no
// está instalado, se omite sin hacer fallar el install.
//   · OpenCascade de replicad (23 MB): cajas con chaflán y STEP del convertidor
//   · manifold-3d (~540 KB): partir modelos 3D. Va con la versión en el nombre
//     porque /wasm se sirve como inmutable (next.config); lib/generador/partir3d.ts
//     lo pide con ese mismo nombre.
import { existsSync, mkdirSync, copyFileSync, readFileSync } from "fs"
import { fileURLToPath } from "url"
import path from "path"

const aqui = path.dirname(fileURLToPath(import.meta.url))
const modulos = path.join(aqui, "..", "node_modules")
const destinoDir = path.join(aqui, "..", "public", "wasm")

function copiar(origen, nombre, etiqueta) {
  if (!existsSync(origen)) {
    console.log(`[${etiqueta}] wasm no encontrado en node_modules, se omite la copia.`)
    return
  }
  mkdirSync(destinoDir, { recursive: true })
  copyFileSync(origen, path.join(destinoDir, nombre))
  console.log(`[${etiqueta}] wasm copiado a public/wasm/${nombre}`)
}

copiar(path.join(modulos, "replicad-opencascadejs", "dist", "replicad_single.wasm"), "replicad_single.wasm", "replicad")

const manifold = path.join(modulos, "manifold-3d")
if (existsSync(path.join(manifold, "package.json"))) {
  const { version } = JSON.parse(readFileSync(path.join(manifold, "package.json"), "utf8"))
  copiar(path.join(manifold, "manifold.wasm"), `manifold-${version}.wasm`, "manifold")
}
