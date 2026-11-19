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
