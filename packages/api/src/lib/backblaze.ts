// Genera links de descarga temporales hacia el bucket privado de Backblaze B2
// donde se respaldan los archivos originales de los productos digitales (ver
// el workflow "HETNA Digital Factory - Respaldar archivo original" en n8n).
// Usa la API nativa de B2, no el protocolo S3: necesitamos un token de
// descarga con vigencia limitada (b2_get_download_authorization), que S3 no
// ofrece sin firmar la request a mano.

import { createHash } from "node:crypto"

const B2_AUTHORIZE_URL = "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"

export type SignedDownloadResult =
  | { ok: true; url: string; expiresAt: string }
  | { ok: false; reason: string }

export async function getSignedDownloadUrl(
  storageKey: string,
  validDurationSeconds = 604800 // 7 dias
): Promise<SignedDownloadResult> {
  const keyId = process.env.B2_KEY_ID
  const applicationKey = process.env.B2_APPLICATION_KEY
  const bucketName = process.env.B2_PRIVATE_BUCKET_NAME

  if (!keyId || !applicationKey || !bucketName) {
    return {
      ok: false,
      reason: "B2_KEY_ID, B2_APPLICATION_KEY o B2_PRIVATE_BUCKET_NAME no configurados",
    }
  }

  const basicAuth = Buffer.from(`${keyId}:${applicationKey}`).toString("base64")

  const authRes = await fetch(B2_AUTHORIZE_URL, {
    headers: { Authorization: `Basic ${basicAuth}` },
  })
  if (!authRes.ok) {
    return { ok: false, reason: `b2_authorize_account respondio ${authRes.status}` }
  }
  const auth = await authRes.json()

  const bucketsRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: auth.accountId, bucketName }),
  })
  if (!bucketsRes.ok) {
    return { ok: false, reason: `b2_list_buckets respondio ${bucketsRes.status}` }
  }
  const bucketsBody = await bucketsRes.json()
  const bucket = bucketsBody.buckets?.[0]
  if (!bucket) {
    return { ok: false, reason: `No se encontro el bucket '${bucketName}' en la cuenta de B2` }
  }

  const downloadAuthRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_get_download_authorization`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({
      bucketId: bucket.bucketId,
      fileNamePrefix: storageKey,
      validDurationInSeconds: validDurationSeconds,
    }),
  })
  if (!downloadAuthRes.ok) {
    return { ok: false, reason: `b2_get_download_authorization respondio ${downloadAuthRes.status}` }
  }
  const downloadAuth = await downloadAuthRes.json()

  const encodedPath = storageKey
    .split("/")
    .map((segment: string) => encodeURIComponent(segment))
    .join("/")

  const url = `${auth.downloadUrl}/file/${bucketName}/${encodedPath}?Authorization=${downloadAuth.authorizationToken}`
  const expiresAt = new Date(Date.now() + validDurationSeconds * 1000).toISOString()

  return { ok: true, url, expiresAt }
}


// --- Subida ---
//
// Las fotos de un escaneo 3D se suben aquí y RunPod las baja después con una
// URL firmada (getSignedDownloadUrl). Van al mismo bucket privado: nada de
// esto es público, ni las fotos del cliente ni la pieza resultante.
//
// La subida nativa de B2 pide tres pasos -- autorizar, encontrar el bucket,
// pedir una URL de subida -- y el SHA1 del contenido, que B2 verifica del otro
// lado: si no coincide rechaza el archivo en vez de guardar algo corrupto en
// silencio.

type Autorizacion = {
  apiUrl: string
  token: string
  downloadUrl: string
  bucketId: string
  bucketName: string
}

async function autorizarBucket(): Promise<{ ok: true; auth: Autorizacion } | { ok: false; reason: string }> {
  const keyId = process.env.B2_KEY_ID
  const applicationKey = process.env.B2_APPLICATION_KEY
  const bucketName = process.env.B2_PRIVATE_BUCKET_NAME

  if (!keyId || !applicationKey || !bucketName) {
    return {
      ok: false,
      reason: "B2_KEY_ID, B2_APPLICATION_KEY o B2_PRIVATE_BUCKET_NAME no configurados",
    }
  }

  const basicAuth = Buffer.from(`${keyId}:${applicationKey}`).toString("base64")

  const authRes = await fetch(B2_AUTHORIZE_URL, { headers: { Authorization: `Basic ${basicAuth}` } })
  if (!authRes.ok) {
    return { ok: false, reason: `b2_authorize_account respondio ${authRes.status}` }
  }
  const auth = await authRes.json()

  const bucketsRes = await fetch(`${auth.apiUrl}/b2api/v2/b2_list_buckets`, {
    method: "POST",
    headers: { Authorization: auth.authorizationToken, "Content-Type": "application/json" },
    body: JSON.stringify({ accountId: auth.accountId, bucketName }),
  })
  if (!bucketsRes.ok) {
    return { ok: false, reason: `b2_list_buckets respondio ${bucketsRes.status}` }
  }
  const bucket = (await bucketsRes.json()).buckets?.[0]
  if (!bucket) {
    return { ok: false, reason: `No se encontro el bucket '${bucketName}' en la cuenta de B2` }
  }

  return {
    ok: true,
    auth: {
      apiUrl: auth.apiUrl,
      token: auth.authorizationToken,
      downloadUrl: auth.downloadUrl,
      bucketId: bucket.bucketId,
      bucketName,
    },
  }
}

export type UploadTicket =
  | { ok: true; uploadUrl: string; token: string; storageKey: string }
  | { ok: false; reason: string }

// Un permiso de subida de un solo archivo, para que quien tiene los bytes los
// mande directo a B2. Así las fotos no pasan por el backend: subir 40 fotos
// por aquí sería mover decenas de megas a través del proceso de Medusa para
// nada. Las credenciales de B2 nunca salen de este lado -- lo que se entrega
// es un permiso para un archivo y una ruta, no la llave de la cuenta.
export async function getUploadTicket(storageKey: string): Promise<UploadTicket> {
  const autorizacion = await autorizarBucket()
  if (!autorizacion.ok) {
    return autorizacion
  }

  const res = await fetch(`${autorizacion.auth.apiUrl}/b2api/v2/b2_get_upload_url`, {
    method: "POST",
    headers: { Authorization: autorizacion.auth.token, "Content-Type": "application/json" },
    body: JSON.stringify({ bucketId: autorizacion.auth.bucketId }),
  })
  if (!res.ok) {
    return { ok: false, reason: `b2_get_upload_url respondio ${res.status}` }
  }
  const destino = await res.json()

  return { ok: true, uploadUrl: destino.uploadUrl, token: destino.authorizationToken, storageKey }
}

export type UploadResult = { ok: true; storageKey: string } | { ok: false; reason: string }

// Sube bytes que ya están en memoria de este lado. Para las fotos del escaneo
// se usa getUploadTicket; esta sirve cuando el backend sí tiene el archivo.
export async function uploadFile(
  contenido: Buffer,
  storageKey: string,
  contentType = "b2/x-auto"
): Promise<UploadResult> {
  const boleto = await getUploadTicket(storageKey)
  if (!boleto.ok) {
    return boleto
  }
  return subirConBoleto(boleto, contenido, contentType)
}

// El paso final de la subida, compartido por quien tenga un boleto.
export async function subirConBoleto(
  boleto: { uploadUrl: string; token: string; storageKey: string },
  contenido: Buffer,
  contentType = "b2/x-auto"
): Promise<UploadResult> {
  const subida = await fetch(boleto.uploadUrl, {
    method: "POST",
    headers: {
      Authorization: boleto.token,
      // El nombre va percent-encoded por segmento: B2 lo exige y así un
      // nombre con espacios o acentos no rompe la petición.
      "X-Bz-File-Name": boleto.storageKey.split("/").map(encodeURIComponent).join("/"),
      "Content-Type": contentType,
      "Content-Length": String(contenido.length),
      "X-Bz-Content-Sha1": createHash("sha1").update(contenido).digest("hex"),
    },
    body: new Uint8Array(contenido),
  })
  if (!subida.ok) {
    const detalle = await subida.text().catch(() => "")
    return { ok: false, reason: `b2_upload_file respondio ${subida.status}: ${detalle.slice(0, 200)}` }
  }
  return { ok: true, storageKey: boleto.storageKey }
}
