// Crea las llaves de las notificaciones al celular y las escribe en el .env
// de packages/api. No imprime la llave privada.
//   cd /root/hetnacnc/packages/api && NODE_ENV=production bunx medusa exec ./src/scripts/crear-llaves-push.ts
// Si ya existen, no hace nada (cambiarlas desconectaría a todos los celulares
// que ya aceptaron avisos).
import { appendFileSync, existsSync, readFileSync } from "node:fs"
import path from "node:path"

import webpush from "web-push"

export default async function crearLlavesPush() {
  const archivo = path.resolve(process.cwd(), ".env")
  const actual = existsSync(archivo) ? readFileSync(archivo, "utf8") : ""
  if (process.env.VAPID_PRIVATE_KEY || /^\s*VAPID_PRIVATE_KEY\s*=/m.test(actual)) {
    console.log("✔ Ya existen las llaves de notificaciones en .env. No cambié nada.")
    return
  }
  const { publicKey, privateKey } = webpush.generateVAPIDKeys()
  appendFileSync(
    archivo,
    `${actual.endsWith("\n") || !actual ? "" : "\n"}\n# Notificaciones al celular (lib/push.ts)\nVAPID_PUBLIC_KEY=${publicKey}\nVAPID_PRIVATE_KEY=${privateKey}\nVAPID_SUBJECT=mailto:hola@hetnacnc.com\n`
  )
  console.log("✔ Llaves creadas y guardadas en packages/api/.env")
  console.log("  Reinicia la API para que las tome: pm2 restart hetna-api --update-env")
}
