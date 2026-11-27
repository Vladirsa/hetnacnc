"use client"

// Vista 3D de las piezas de un diseño del catálogo (Boxes.py): toma el SVG del
// plano de corte, saca cada contorno cerrado (con sus huecos) y lo extruye al
// espesor del material, tendido sobre la mesa tal como sale de la hoja.
//
// Boxes.py no dice dónde va cada pieza al armarse, así que aquí no se arma la
// caja: se ven las tablas cortadas con su grosor real. Se carga sólo al abrir
// la pestaña (three.js pesa ~150 kB).
import { T } from "@/components/hetna/i18n/Idioma"
import { useEffect, useRef, useState } from "react"
import * as THREE from "three"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

type P = [number, number]

// Lee los contornos del SVG con el propio navegador: así se respetan todas las
// curvas y transformaciones de Boxes.py sin escribir un lector de SVG.
function contornos(svgTexto: string): { cerrados: P[][]; abiertos: P[][] } {
  const caja = document.createElement("div")
  caja.style.cssText = "position:absolute;left:-99999px;top:0;width:1000px;height:1000px;visibility:hidden"
  caja.innerHTML = svgTexto
  document.body.appendChild(caja)
  const svg = caja.querySelector("svg")
  const salida: P[][] = []
  // líneas sueltas (cortes de bisagra flexible, ranuras de una línea)
  const abiertos: P[][] = []
  try {
    if (!svg) return { cerrados: salida, abiertos }
    svg.setAttribute("width", "1000")
    svg.setAttribute("height", "1000")
    const raiz = svg.getScreenCTM()
    if (!raiz) return { cerrados: salida, abiertos }
    const inv = raiz.inverse()
    const pt = svg.createSVGPoint()
    svg.querySelectorAll("path").forEach((path) => {
      const m = path.getScreenCTM()
      if (!m) return
      const a = inv.multiply(m)
      const largo = path.getTotalLength()
      if (!(largo > 1)) return
      const paso = Math.max(0.25, largo / 6000)
      let actual: P[] = []
      let previo: P | null = null
      const cerrar = () => {
        if (actual.length > 3) {
          const [x0, y0] = actual[0]
          const [x1, y1] = actual[actual.length - 1]
          if (Math.hypot(x1 - x0, y1 - y0) < 1) salida.push(actual)
          else abiertos.push(actual)
        } else if (actual.length > 1) abiertos.push(actual)
        actual = []
      }
      for (let s = 0; s <= largo; s += paso) {
        const q = path.getPointAtLength(s)
        pt.x = q.x
        pt.y = q.y
        const w = pt.matrixTransform(a)
        const p: P = [w.x, -w.y] // el SVG tiene Y hacia abajo
        // un salto grande es otro subcontorno dentro del mismo <path>
        if (previo && Math.hypot(p[0] - previo[0], p[1] - previo[1]) > paso * 4) cerrar()
        actual.push(p)
        previo = p
      }
      cerrar()
    })
  } finally {
    caja.remove()
  }
  return { cerrados: salida, abiertos }
}

const area = (pts: P[]) => {
  let s = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) s += (pts[j][0] + pts[i][0]) * (pts[j][1] - pts[i][1])
  return Math.abs(s / 2)
}
const dentro = ([x, y]: P, pts: P[]) => {
  let c = false
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]
    const [xj, yj] = pts[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c
  }
  return c
}

// Cada contorno es pieza o hueco según cuántos lo rodean (par: pieza)
function piezas(lista: P[][]) {
  const orden = lista.map((pts) => ({ pts, a: area(pts) })).filter((x) => x.a > 1).sort((a, b) => b.a - a.a)
  const padre = orden.map((x, i) => {
    let mejor = -1
    for (let j = 0; j < i; j++) if (dentro(x.pts[0], orden[j].pts)) mejor = j
    return mejor
  })
  const nivel = orden.map((_, i) => {
    let n = 0
    for (let p = padre[i]; p >= 0; p = padre[p]) n++
    return n
  })
  return orden
    .map((x, i) => ({ ...x, i }))
    .filter((x) => nivel[x.i] % 2 === 0)
    .map((x) => ({ contorno: x.pts, huecos: orden.filter((_, k) => padre[k] === x.i && nivel[k] % 2 === 1).map((h) => h.pts) }))
}

export default function Piezas3D({ svg, espesor }: { svg: string; espesor: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const [info, setInfo] = useState<string>("Armando las piezas…")

  useEffect(() => {
    const el = ref.current
    if (!el || !svg) return
    const { cerrados, abiertos } = contornos(svg)
    const lista = piezas(cerrados)
    if (!lista.length) {
      setInfo("No se encontraron piezas cerradas en este plano.")
      return
    }
    const t = espesor > 0 ? espesor : 3

    const escena = new THREE.Scene()
    escena.background = new THREE.Color(0x10151d)
    const camara = new THREE.PerspectiveCamera(40, 1, 0.5, 50000)
    const render = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true })
    render.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    render.shadowMap.enabled = true
    el.appendChild(render.domElement)
    const controles = new OrbitControls(camara, render.domElement)
    controles.enableDamping = true

    escena.add(new THREE.HemisphereLight(0xffffff, 0x223044, 0.7))
    const luz = new THREE.DirectionalLight(0xffffff, 1.5)
    luz.castShadow = true
    luz.shadow.mapSize.set(2048, 2048)
    escena.add(luz)

    const material = new THREE.MeshStandardMaterial({ color: 0xc9a27a, roughness: 0.85, metalness: 0 })
    const bordes = new THREE.LineBasicMaterial({ color: 0x3b2716, transparent: true, opacity: 0.6 })
    const grupo = new THREE.Group()
    for (const p of lista) {
      const forma = new THREE.Shape(p.contorno.map(([x, y]) => new THREE.Vector2(x, y)))
      for (const h of p.huecos) forma.holes.push(new THREE.Path(h.map(([x, y]) => new THREE.Vector2(x, y))))
      const geo = new THREE.ExtrudeGeometry(forma, { depth: t, bevelEnabled: false, curveSegments: 1 })
      geo.rotateX(-Math.PI / 2) // tendida sobre la mesa, Y es arriba
      const malla = new THREE.Mesh(geo, material)
      malla.castShadow = true
      malla.receiveShadow = true
      grupo.add(malla)
      grupo.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 30), bordes))
    }
    // Cortes de una sola línea, dibujados sobre la cara de arriba
    if (abiertos.length) {
      const v: number[] = []
      for (const l of abiertos) for (let i = 1; i < l.length; i++) v.push(l[i - 1][0], t + 0.05, -l[i - 1][1], l[i][0], t + 0.05, -l[i][1])
      const g = new THREE.BufferGeometry()
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3))
      grupo.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x2a1a0e })))
    }
    // centrar en el origen, apoyado en y = 0
    const caja = new THREE.Box3().setFromObject(grupo)
    const centro = caja.getCenter(new THREE.Vector3())
    grupo.position.set(-centro.x, -caja.min.y, -centro.z)
    escena.add(grupo)
    const tam = caja.getSize(new THREE.Vector3())
    const lado = Math.max(tam.x, tam.z, 1)

    const piso = new THREE.Mesh(new THREE.PlaneGeometry(lado * 4, lado * 4), new THREE.ShadowMaterial({ opacity: 0.35 }))
    piso.rotation.x = -Math.PI / 2
    piso.receiveShadow = true
    escena.add(piso)
    escena.add(new THREE.GridHelper(Math.ceil(lado * 2), 30, 0x2e3a4e, 0x1a2230))
    luz.position.set(lado * 0.6, lado * 1.4, lado * 0.9)
    const sc = luz.shadow.camera
    sc.left = sc.bottom = -lado
    sc.right = sc.top = lado
    sc.far = lado * 5
    sc.updateProjectionMatrix()

    camara.position.set(lado * 0.7, lado * 0.95, lado * 1.15)
    camara.near = lado / 1000
    camara.far = lado * 50
    controles.target.set(0, 0, 0)
    controles.update()

    const ajustar = () => {
      const w = el.clientWidth || 300
      const h = el.clientHeight || 300
      render.setSize(w, h)
      camara.aspect = w / h
      camara.updateProjectionMatrix()
    }
    const obs = new ResizeObserver(ajustar)
    obs.observe(el)
    ajustar()

    setInfo(`${lista.length} piezas · ${t} mm de espesor · ${Math.round(tam.x)} × ${Math.round(tam.z)} mm de hoja`)

    let cuadro = 0
    const animar = () => {
      cuadro = requestAnimationFrame(animar)
      controles.update()
      render.render(escena, camara)
    }
    animar()

    return () => {
      cancelAnimationFrame(cuadro)
      obs.disconnect()
      controles.dispose()
      escena.traverse((o) => {
        const m = o as THREE.Mesh
        m.geometry?.dispose?.()
      })
      material.dispose()
      bordes.dispose()
      render.forceContextLoss()
      render.dispose()
      render.domElement.remove()
    }
  }, [svg, espesor])

  return (
    <div className="absolute inset-0">
      <div ref={ref} className="absolute inset-0" />
      <p className="pointer-events-none absolute left-3 top-3 m-0 rounded-[8px] bg-[#0B1017]/85 px-2.5 py-1 text-[12px] text-[#C9D2E0]">{info}</p>
      <p className="pointer-events-none absolute bottom-3 left-1/2 m-0 hidden -translate-x-1/2 rounded-[8px] bg-[#0B1017]/85 px-3 py-1 text-center text-[11.5px] text-[#8A97AB] sm:block">
        <T>Piezas cortadas con su grosor real, tendidas como salen de la hoja · arrastra para girar</T>
      </p>
    </div>
  )
}
