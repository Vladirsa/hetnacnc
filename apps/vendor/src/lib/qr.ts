// Generador de códigos QR sin dependencias (modo byte, corrección M).
//
// Basado en el algoritmo público de "QR Code generator library" de Project
// Nayuki (licencia MIT): elige la versión más chica en la que cabe el texto,
// agrega la corrección de errores Reed-Solomon, prueba las 8 máscaras y se
// queda con la de menor penalización. Devuelve la matriz de módulos y un SVG.
//
// Se escribió aquí en lugar de instalar una librería para no mover el
// lockfile del monorepo (bun reacomodaba otras dependencias del panel).

const ECC_POR_BLOQUE_M = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28]
const BLOQUES_M = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49]
const FORMATO_M = 0 // bits de nivel de corrección M en el formato

function modulosDatos(ver: number): number {
  let r = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2
    r -= (25 * n - 10) * n - 55
    if (ver >= 7) r -= 36
  }
  return r
}

const capacidadBytes = (ver: number) => Math.floor(modulosDatos(ver) / 8) - ECC_POR_BLOQUE_M[ver] * BLOQUES_M[ver]

// ---- Reed-Solomon sobre GF(256) ------------------------------------------

function multiplicar(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}

function divisor(grado: number): number[] {
  const r = new Array<number>(grado).fill(0)
  r[grado - 1] = 1
  let raiz = 1
  for (let i = 0; i < grado; i++) {
    for (let j = 0; j < r.length; j++) {
      r[j] = multiplicar(r[j], raiz)
      if (j + 1 < r.length) r[j] ^= r[j + 1]
    }
    raiz = multiplicar(raiz, 0x02)
  }
  return r
}

function residuo(datos: number[], div: number[]): number[] {
  const r = div.map(() => 0)
  for (const b of datos) {
    const factor = b ^ (r.shift() as number)
    r.push(0)
    div.forEach((c, i) => (r[i] ^= multiplicar(c, factor)))
  }
  return r
}

// ---- Matriz --------------------------------------------------------------

type Matriz = { tam: number; mod: boolean[][]; fijo: boolean[][] }

function poner(m: Matriz, x: number, y: number, oscuro: boolean) {
  m.mod[y][x] = oscuro
  m.fijo[y][x] = true
}

function patronesFijos(m: Matriz, ver: number) {
  const t = m.tam
  for (let i = 0; i < t; i++) {
    poner(m, 6, i, i % 2 === 0)
    poner(m, i, 6, i % 2 === 0)
  }
  const buscador = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && xx < t && yy >= 0 && yy < t) poner(m, xx, yy, d !== 2 && d !== 4)
      }
  }
  buscador(3, 3)
  buscador(t - 4, 3)
  buscador(3, t - 4)

  // Patrones de alineación
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2
    const paso = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2
    const pos = [6]
    for (let p = t - 7; pos.length < n; p -= paso) pos.splice(1, 0, p)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue
        for (let dy = -2; dy <= 2; dy++)
          for (let dx = -2; dx <= 2; dx++) poner(m, pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
  }

  formato(m, 0) // reserva las zonas de formato
  if (ver >= 7) {
    let r = ver
    for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25)
    const bits = (ver << 12) | r
    for (let i = 0; i < 18; i++) {
      const b = ((bits >>> i) & 1) !== 0
      const a = t - 11 + (i % 3)
      const c = Math.floor(i / 3)
      poner(m, a, c, b)
      poner(m, c, a, b)
    }
  }
}

function formato(m: Matriz, mascara: number) {
  const datos = (FORMATO_M << 3) | mascara
  let r = datos
  for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537)
  const bits = ((datos << 10) | r) ^ 0x5412
  const b = (i: number) => ((bits >>> i) & 1) !== 0
  const t = m.tam
  for (let i = 0; i <= 5; i++) poner(m, 8, i, b(i))
  poner(m, 8, 7, b(6))
  poner(m, 8, 8, b(7))
  poner(m, 7, 8, b(8))
  for (let i = 9; i < 15; i++) poner(m, 14 - i, 8, b(i))
  for (let i = 0; i < 8; i++) poner(m, t - 1 - i, 8, b(i))
  for (let i = 8; i < 15; i++) poner(m, 8, t - 15 + i, b(i))
  poner(m, 8, t - 8, true)
}

function colocarDatos(m: Matriz, datos: number[]) {
  const t = m.tam
  let i = 0
  for (let der = t - 1; der >= 1; der -= 2) {
    if (der === 6) der = 5
    for (let v = 0; v < t; v++)
      for (let j = 0; j < 2; j++) {
        const x = der - j
        const sube = ((der + 1) & 2) === 0
        const y = sube ? t - 1 - v : v
        if (!m.fijo[y][x] && i < datos.length * 8) {
          m.mod[y][x] = ((datos[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0
          i++
        }
      }
  }
}

function aplicarMascara(m: Matriz, k: number) {
  const t = m.tam
  for (let y = 0; y < t; y++)
    for (let x = 0; x < t; x++) {
      if (m.fijo[y][x]) continue
      let inv: boolean
      switch (k) {
        case 0: inv = (x + y) % 2 === 0; break
        case 1: inv = y % 2 === 0; break
        case 2: inv = x % 3 === 0; break
        case 3: inv = (x + y) % 3 === 0; break
        case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
        case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break
        case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
        default: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
      }
      if (inv) m.mod[y][x] = !m.mod[y][x]
    }
}

function penalizacion(m: Matriz): number {
  const t = m.tam
  const g = m.mod
  let p = 0
  // Corridas del mismo color y patrones parecidos a los buscadores
  const linea = (get: (i: number) => boolean) => {
    let color = false
    let corrida = 0
    const hist = [0, 0, 0, 0, 0, 0, 0]
    const agregar = (n: number) => {
      if (hist[0] === 0) n += t
      hist.pop()
      hist.unshift(n)
    }
    const contar = () => {
      const n = hist[1]
      const core = n > 0 && hist[2] === n && hist[3] === n * 3 && hist[4] === n && hist[5] === n
      return (core && hist[0] >= n * 4 && hist[6] >= n ? 1 : 0) + (core && hist[6] >= n * 4 && hist[0] >= n ? 1 : 0)
    }
    for (let i = 0; i < t; i++) {
      if (get(i) === color) {
        corrida++
        if (corrida === 5) p += 3
        else if (corrida > 5) p++
      } else {
        agregar(corrida)
        if (!color) p += contar() * 40
        color = get(i)
        corrida = 1
      }
    }
    // Cierre de la línea
    if (color) {
      agregar(corrida)
      corrida = 0
    }
    corrida += t
    agregar(corrida)
    p += contar() * 40
  }
  for (let y = 0; y < t; y++) linea((x) => g[y][x])
  for (let x = 0; x < t; x++) linea((y) => g[y][x])
  // Bloques 2×2
  for (let y = 0; y < t - 1; y++)
    for (let x = 0; x < t - 1; x++) {
      const c = g[y][x]
      if (c === g[y][x + 1] && c === g[y + 1][x] && c === g[y + 1][x + 1]) p += 3
    }
  // Balance de oscuros
  let oscuros = 0
  for (const fila of g) for (const c of fila) if (c) oscuros++
  const total = t * t
  const k = Math.ceil(Math.abs(oscuros * 20 - total * 10) / total) - 1
  p += k * 10
  return p
}

/** Matriz de módulos (true = negro) del QR para ese texto. */
export function codigoQR(texto: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(texto))
  let ver = 1
  for (; ver <= 40; ver++) {
    const bitsLargo = ver <= 9 ? 8 : 16
    if (4 + bitsLargo + bytes.length * 8 <= capacidadBytes(ver) * 8) break
  }
  if (ver > 40) throw new Error("El texto es demasiado largo para un QR.")

  // Flujo de bits: modo byte (0100), largo, datos, terminador y relleno
  const bits: number[] = []
  const agregar = (valor: number, n: number) => {
    for (let i = n - 1; i >= 0; i--) bits.push((valor >>> i) & 1)
  }
  agregar(0b0100, 4)
  agregar(bytes.length, ver <= 9 ? 8 : 16)
  for (const b of bytes) agregar(b, 8)
  const capBits = capacidadBytes(ver) * 8
  agregar(0, Math.min(4, capBits - bits.length))
  agregar(0, (8 - (bits.length % 8)) % 8)
  for (let relleno = 0xec; bits.length < capBits; relleno ^= 0xec ^ 0x11) agregar(relleno, 8)
  const datos: number[] = []
  for (let i = 0; i < bits.length; i += 8) datos.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0))

  // Bloques con su corrección de errores, intercalados
  const nBloques = BLOQUES_M[ver]
  const eccLen = ECC_POR_BLOQUE_M[ver]
  const totalBytes = Math.floor(modulosDatos(ver) / 8)
  const cortos = nBloques - (totalBytes % nBloques)
  const largoCorto = Math.floor(totalBytes / nBloques)
  const div = divisor(eccLen)
  const bloques: number[][] = []
  for (let i = 0, k = 0; i < nBloques; i++) {
    const n = largoCorto - eccLen + (i < cortos ? 0 : 1)
    const dat = datos.slice(k, k + n)
    k += n
    const ecc = residuo(dat, div)
    if (i < cortos) dat.push(0)
    bloques.push(dat.concat(ecc))
  }
  const final: number[] = []
  for (let i = 0; i < bloques[0].length; i++)
    bloques.forEach((b, j) => {
      if (i !== largoCorto - eccLen || j >= cortos) final.push(b[i])
    })

  const tam = ver * 4 + 17
  const nueva = (): Matriz => ({
    tam,
    mod: Array.from({ length: tam }, () => new Array<boolean>(tam).fill(false)),
    fijo: Array.from({ length: tam }, () => new Array<boolean>(tam).fill(false)),
  })
  const base = nueva()
  patronesFijos(base, ver)
  colocarDatos(base, final)

  // Prueba las 8 máscaras y se queda con la de menor penalización
  let mejor: boolean[][] | null = null
  let menor = Infinity
  for (let k = 0; k < 8; k++) {
    const m: Matriz = { tam, mod: base.mod.map((f) => f.slice()), fijo: base.fijo.map((f) => f.slice()) }
    aplicarMascara(m, k)
    formato(m, k)
    const p = penalizacion(m)
    if (p < menor) {
      menor = p
      mejor = m.mod
    }
  }
  return mejor as boolean[][]
}

/** SVG del QR (con margen de 4 módulos), listo para incrustar en HTML. */
export function svgQR(texto: string, lado = 160): string {
  const m = codigoQR(texto)
  const n = m.length + 8
  let ruta = ""
  m.forEach((fila, y) =>
    fila.forEach((oscuro, x) => {
      if (oscuro) ruta += `M${x + 4},${y + 4}h1v1h-1z`
    })
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${n} ${n}" shape-rendering="crispEdges"><rect width="${n}" height="${n}" fill="#fff"/><path d="${ruta}" fill="#000"/></svg>`
}
