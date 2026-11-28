// Mandar una pieza (STL) al Laboratorio CAM 3, 4 y 5 ejes (/cam/lab) sin que el
// cliente tenga que descargarla y volverla a subir. Se guarda un momento en el
// navegador (IndexedDB, porque un relieve pesa decenas de MB), se abre el
// laboratorio y su marco se la entrega cuando el laboratorio avisa que está
// listo. Nada sale del navegador hasta que el cliente pida el servicio.

const IDB = "hetna-laboratorio"
const ALMACEN = "piezas"
const VIGENCIA = 30 * 60 * 1000 // media hora

const abrir = () =>
  new Promise<IDBDatabase>((ok, mal) => {
    const r = indexedDB.open(IDB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(ALMACEN)
    r.onsuccess = () => ok(r.result)
    r.onerror = () => mal(r.error)
  })

export async function mandarALaboratorio(nombre: string, stl: ArrayBuffer, locale: string): Promise<boolean> {
  try {
    const db = await abrir()
    await new Promise<void>((ok, mal) => {
      const tx = db.transaction(ALMACEN, "readwrite")
      tx.objectStore(ALMACEN).put({ nombre, datos: stl, t: Date.now() }, "pendiente")
      tx.oncomplete = () => ok()
      tx.onerror = () => mal(tx.error)
    })
    db.close()
    window.location.href = `/${locale}/cam/lab?pieza=1`
    return true
  } catch {
    return false
  }
}

/** La pieza que dejó un generador, si sigue vigente (y se borra). */
export async function tomarPiezaParaLaboratorio(): Promise<{ nombre: string; datos: ArrayBuffer } | null> {
  try {
    const db = await abrir()
    const fila = await new Promise<{ nombre: string; datos: ArrayBuffer; t: number } | undefined>((ok, mal) => {
      const tx = db.transaction(ALMACEN, "readwrite")
      const st = tx.objectStore(ALMACEN)
      const r = st.get("pendiente")
      r.onsuccess = () => {
        st.delete("pendiente")
        ok(r.result)
      }
      r.onerror = () => mal(r.error)
    })
    db.close()
    if (!fila || Date.now() - fila.t > VIGENCIA) return null
    return { nombre: fila.nombre, datos: fila.datos }
  } catch {
    return null
  }
}

// ---- CAM Studio 2D (corte láser o router: perfiles, cajas, barrenos) ----
// Igual que la pieza 3D: el DXF se guarda un momento y el CAM 2D lo abre solo.
// Extra (del diseñador de vectores): el espesor de la hoja y que el CAM arme una
// operación por capa (corte, cajeado, grabado, barrenos).
export type ExtraCam2D = { espesor?: number; porCapas?: boolean }

export async function mandarACam2D(nombre: string, dxf: string, locale: string, extra?: ExtraCam2D): Promise<boolean> {
  try {
    const db = await abrir()
    await new Promise<void>((ok, mal) => {
      const tx = db.transaction(ALMACEN, "readwrite")
      tx.objectStore(ALMACEN).put({ nombre, datos: dxf, t: Date.now(), extra: extra || null }, "pendiente2d")
      tx.oncomplete = () => ok()
      tx.onerror = () => mal(tx.error)
    })
    db.close()
    window.location.href = `/${locale}/cam/subir?pieza=1`
    return true
  } catch {
    return false
  }
}

/** El DXF que dejó un generador para el CAM 2D, si sigue vigente (y se borra). */
export async function tomarPiezaParaCam2D(): Promise<{ nombre: string; dxf: string; extra?: ExtraCam2D } | null> {
  try {
    const db = await abrir()
    const fila = await new Promise<{ nombre: string; datos: string; t: number; extra?: ExtraCam2D | null } | undefined>((ok, mal) => {
      const tx = db.transaction(ALMACEN, "readwrite")
      const st = tx.objectStore(ALMACEN)
      const r = st.get("pendiente2d")
      r.onsuccess = () => {
        st.delete("pendiente2d")
        ok(r.result)
      }
      r.onerror = () => mal(r.error)
    })
    db.close()
    if (!fila || typeof fila.datos !== "string" || Date.now() - fila.t > VIGENCIA) return null
    const extra = fila.extra && typeof fila.extra === "object" ? { espesor: Number(fila.extra.espesor) > 0 ? Number(fila.extra.espesor) : undefined, porCapas: fila.extra.porCapas === true } : undefined
    return { nombre: fila.nombre, dxf: fila.datos, extra }
  } catch {
    return null
  }
}
