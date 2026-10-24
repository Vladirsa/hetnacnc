import { timingSafeEqual } from "crypto"

type JobLike = Record<string, unknown> & { access_token?: string; status?: string }

const PUBLIC_FIELDS = [
  "id", "status", "service", "tier", "model_name", "controller", "kinematics",
  "stats", "review_requested", "customer_notes", "created_at", "paid_at", "delivered_at",
]

/** Lo que el cliente puede ver de su trabajo. */
export function toStoreJob(job: JobLike, opts: { includeToken?: boolean } = {}) {
  const out: Record<string, unknown> = {}
  for (const key of PUBLIC_FIELDS) {
    if (key in job) {
      out[key] = job[key]
    }
  }
  if (opts.includeToken) {
    out.access_token = job.access_token
  }
  if (job.status === "delivered" || job.status === "in_review" || job.status === "paid") {
    out.deliverables = job.deliverables ?? []
  }
  return out
}

/** Ids de archivo que pertenecen al trabajo (para no servir archivos ajenos). */
export function jobFileIds(job: Record<string, unknown>, opts: { includeInputs: boolean }) {
  const ids: string[] = []
  if (opts.includeInputs) {
    for (const key of ["model_file_id", "gcode_file_id"]) {
      if (typeof job[key] === "string") {
        ids.push(job[key] as string)
      }
    }
  }
  const deliverables = Array.isArray(job.deliverables) ? (job.deliverables as { id?: string }[]) : []
  for (const d of deliverables) {
    if (d?.id) {
      ids.push(d.id)
    }
  }
  return ids
}

export function tokensMatch(a: string | undefined | null, b: string | undefined | null) {
  if (!a || !b || a.length !== b.length) {
    return false
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

/** Nombre de archivo seguro para guardar. */
export function safeFilename(name: string) {
  const base = name.replace(/[/\\?%*:|"<>]/g, "_").replace(/\s+/g, "_")
  return base.slice(-120) || "modelo.stl"
}
