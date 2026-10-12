// Genera links de descarga temporales hacia el bucket privado de Backblaze B2
// donde se respaldan los archivos originales de los productos digitales (ver
// el workflow "HETNA Digital Factory - Respaldar archivo original" en n8n).
// Usa la API nativa de B2, no el protocolo S3: necesitamos un token de
// descarga con vigencia limitada (b2_get_download_authorization), que S3 no
// ofrece sin firmar la request a mano.

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
