// Manda un mensaje al Telegram del dueño (el chat que se vinculó en el Social
// Hub con /vincular), por el mismo flujo de n8n que usa el sitio.
//
//   bun scripts/avisar-telegram.mjs "texto"
//
// Lee DATABASE_URL, N8N_REDES_TOKEN y N8N_SOCIAL_URL / N8N_REDES_URL del .env de
// la API: no hay que copiar ninguna llave. Si algo falta, lo dice y sale con 1
// (quien lo llama no se detiene por eso).
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const API = resolve(RAIZ, "packages/api")
const texto = String(process.argv[2] || "").slice(0, 3800)
if (!texto) {
  console.error("uso: avisar-telegram.mjs \"texto\"")
  process.exit(1)
}

const env = {}
try {
  for (const linea of readFileSync(resolve(API, ".env"), "utf8").split("\n")) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(linea)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "")
  }
} catch {
  console.error("✗ No pude leer packages/api/.env")
  process.exit(1)
}

const url = env.N8N_SOCIAL_URL || (env.N8N_REDES_URL || "").replace(/redes-contenido-nuevo\/?$/, "social-hub-publicar")
if (!url || !env.N8N_REDES_TOKEN || !env.DATABASE_URL) {
  console.error("✗ Falta N8N_SOCIAL_URL/N8N_REDES_URL, N8N_REDES_TOKEN o DATABASE_URL en el .env de la API")
  process.exit(1)
}

// El chat del dueño vive en hetna_social_config (clave "telegram")
const { Client } = createRequire(resolve(API, "package.json"))("pg")
const db = new Client({ connectionString: env.DATABASE_URL })
let chat = ""
try {
  await db.connect()
  const r = await db.query("select valor from hetna_social_config where clave = 'telegram'")
  chat = String(r.rows[0]?.valor?.chat_id || "")
} catch (e) {
  console.error("✗ No pude leer el chat de Telegram:", e.message)
} finally {
  await db.end().catch(() => {})
}
if (!chat) {
  console.error("✗ Telegram no está vinculado (Social Hub → Telegram → /vincular)")
  process.exit(1)
}

const r = await fetch(url, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-hetna-token": env.N8N_REDES_TOKEN },
  body: JSON.stringify({ red: "telegram_privado", chat, texto }),
  signal: AbortSignal.timeout(30_000),
}).catch((e) => ({ ok: false, statusText: e.message }))
const cuerpo = r.ok ? await r.json().catch(() => ({})) : {}
if (!r.ok || cuerpo.ok === false) {
  console.error("✗ n8n no lo mandó:", cuerpo.error || r.statusText || r.status)
  process.exit(1)
}
console.log("✓ aviso enviado por Telegram")
