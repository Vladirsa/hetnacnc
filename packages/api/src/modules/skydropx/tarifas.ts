// Reglas para elegir la tarifa de Skydropx que se le muestra al cliente.
// Así el cliente puede escoger entre una opción económica y una express.

// Tarifas realmente usables (mismas reglas que la opción económica de client.ts).
export function tarifasUsables(cot: any) {
  const permitidas = (process.env.ENVIO_PAQUETERIAS || "")
    .split(",").map((x) => x.trim().toLowerCase()).filter(Boolean)
  const minimo = Number(process.env.ENVIO_TARIFA_MINIMA || 20)
  return (cot?.rates || []).filter((x: any) => {
    const nombre = `${x.provider_display_name} ${x.provider_service_name}`.toLowerCase()
    if (x.success !== true || Number(x.total) < minimo) return false
    if (/sin recolecci|ltl|plataforma|punto/.test(nombre)) return false
    if (permitidas.length && !permitidas.some((p) => nombre.includes(p))) return false
    return true
  })
}

// La más rápida (menos días). Si hay empate, la más barata. Le suma el margen de HETNA (%).
export function tarifaRapida(cot: any, margenPct = 0) {
  const ok = tarifasUsables(cot).filter((x: any) => Number.isFinite(Number(x.days)))
  if (!ok.length) return null
  ok.sort((a: any, b: any) => Number(a.days) - Number(b.days) || Number(a.total) - Number(b.total))
  const t = ok[0]
  return {
    paqueteria: t.provider_display_name,
    servicio: t.provider_service_name,
    dias: t.days,
    costo: Number(t.total),
    precio: Math.ceil(Number(t.total) * (1 + margenPct / 100)),
  }
}

// Arma el paquete a cotizar con el peso y las medidas reales de los productos del carrito.
// Convención para los talleres: peso en KILOS y medidas en CENTÍMETROS.
// Protección: si alguien capturó gramos (peso mayor a 500) o milímetros (medida mayor a 300),
// se convierte solo. Si un producto no tiene datos, se usa el paquete base.
export function armarPaquete(items: any[], base: { largo: number; ancho: number; alto: number; peso: number }) {
  let peso = 0
  let largo = 0
  let ancho = 0
  let alto = 0
  let conDatos = 0
  for (const it of items || []) {
    const v = it?.variant || {}
    const p = it?.product || {}
    const cant = Number(it?.quantity || 1)
    let w = Number(v.weight ?? p.weight ?? 0)
    let l = Number(v.length ?? p.length ?? 0)
    let a = Number(v.width ?? p.width ?? 0)
    let h = Number(v.height ?? p.height ?? 0)
    if (!(w > 0)) continue
    if (w > 500) w = w / 1000
    if (l > 300 || a > 300 || h > 300) { l = l / 10; a = a / 10; h = h / 10 }
    conDatos++
    peso += w * cant
    largo = Math.max(largo, l || base.largo)
    ancho = Math.max(ancho, a || base.ancho)
    alto += (h || base.alto) * cant // las piezas se apilan
  }
  if (!conDatos) return { paquete: base, real: false }
  return {
    paquete: {
      largo: Math.max(1, Math.ceil(largo)),
      ancho: Math.max(1, Math.ceil(ancho)),
      alto: Math.max(1, Math.ceil(alto)),
      peso: Math.max(1, Math.ceil(peso * 10) / 10), // mínimo 1 kg
    },
    real: true,
  }
}
