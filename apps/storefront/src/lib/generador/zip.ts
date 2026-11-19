// ZIP sencillo (sin comprimir) para bajar varios archivos de una vez.
const TABLA = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(b: Uint8Array) {
  let c = 0xffffffff
  for (let i = 0; i < b.length; i++) c = TABLA[(c ^ b[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

export function hacerZip(archivos: { nombre: string; texto: string }[]): Uint8Array {
  const enc = new TextEncoder()
  const locales: Uint8Array[] = []
  const centrales: Uint8Array[] = []
  let pos = 0
  const ahora = new Date()
  const hora = (ahora.getHours() << 11) | (ahora.getMinutes() << 5) | (ahora.getSeconds() >> 1)
  const fecha = ((ahora.getFullYear() - 1980) << 9) | ((ahora.getMonth() + 1) << 5) | ahora.getDate()
  for (const a of archivos) {
    const nombre = enc.encode(a.nombre)
    const datos = enc.encode(a.texto)
    const crc = crc32(datos)
    const loc = new Uint8Array(30 + nombre.length + datos.length)
    const v = new DataView(loc.buffer)
    v.setUint32(0, 0x04034b50, true)
    v.setUint16(4, 20, true)
    v.setUint16(6, 0x0800, true) // nombres en UTF-8
    v.setUint16(8, 0, true) // sin comprimir
    v.setUint16(10, hora, true)
    v.setUint16(12, fecha, true)
    v.setUint32(14, crc, true)
    v.setUint32(18, datos.length, true)
    v.setUint32(22, datos.length, true)
    v.setUint16(26, nombre.length, true)
    loc.set(nombre, 30)
    loc.set(datos, 30 + nombre.length)
    const cen = new Uint8Array(46 + nombre.length)
    const w = new DataView(cen.buffer)
    w.setUint32(0, 0x02014b50, true)
    w.setUint16(4, 20, true)
    w.setUint16(6, 20, true)
    w.setUint16(8, 0x0800, true)
    w.setUint16(10, 0, true)
    w.setUint16(12, hora, true)
    w.setUint16(14, fecha, true)
    w.setUint32(16, crc, true)
    w.setUint32(20, datos.length, true)
    w.setUint32(24, datos.length, true)
    w.setUint16(28, nombre.length, true)
    w.setUint32(42, pos, true)
    cen.set(nombre, 46)
    locales.push(loc)
    centrales.push(cen)
    pos += loc.length
  }
  const tamCentral = centrales.reduce((t, c) => t + c.length, 0)
  const fin = new Uint8Array(22)
  const f = new DataView(fin.buffer)
  f.setUint32(0, 0x06054b50, true)
  f.setUint16(8, archivos.length, true)
  f.setUint16(10, archivos.length, true)
  f.setUint32(12, tamCentral, true)
  f.setUint32(16, pos, true)
  const total = new Uint8Array(pos + tamCentral + 22)
  let o = 0
  for (const x of [...locales, ...centrales, fin]) {
    total.set(x, o)
    o += x.length
  }
  return total
}
