// ===== HetNa Cotizador: interfaz =====
(() => {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const dinero = (n) => "$" + (Math.round(n * 100) / 100).toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const num = (v) => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
  const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("es-MX", { maximumFractionDigits: d });

  // ---------- Configuracion guardada (solo en este celular) ----------
  const MATERIALES_BASE = [
    { id: "MDF", precio: DATOS.servicios.find((s) => s.clave === "carpinteria")?.tarifas.material_mdf_m2 ?? null, origen: "Tu app: Carpintería (material MDF por m²)" },
    { id: "Triplay", precio: DATOS.servicios.find((s) => s.clave === "carpinteria")?.tarifas.material_triplay_m2 ?? null, origen: "Tu app: Carpintería (material triplay por m²)" },
    { id: "Madera sólida", precio: DATOS.servicios.find((s) => s.clave === "carpinteria")?.tarifas.material_madera_m2 ?? null, origen: "Tu app: Carpintería (material madera por m²)" },
    { id: "Acrílico", precio: null, origen: "Falta precio" },
    { id: "Acero al carbón", precio: null, origen: "Falta precio" },
    { id: "Acero inoxidable", precio: null, origen: "Falta precio" },
    { id: "Aluminio", precio: null, origen: "Falta precio" },
    { id: "Cuero", precio: null, origen: "Falta precio" },
    { id: "Tela", precio: null, origen: "Falta precio" },
  ];
  const grupoMaterial = (nombre) => {
    const n = (nombre || "").toLowerCase();
    if (n.includes("mdf")) return "MDF";
    if (n.includes("triplay")) return "Triplay";
    if (/pino|cedro|parota|encino|madera/.test(n)) return "Madera sólida";
    if (n.includes("acril")) return "Acrílico";
    if (n.includes("inox")) return "Acero inoxidable";
    if (n.includes("acero")) return "Acero al carbón";
    if (n.includes("alumin")) return "Aluminio";
    if (n.includes("cuero")) return "Cuero";
    if (n.includes("tela")) return "Tela";
    return null;
  };

  const inicial = () => ({
    taller: { nombre: "Mi taller CNC", whatsapp: "", vigencia: 15, minimo: 150, logo: null, condiciones: "Precios sujetos a revisión del archivo final. El tiempo de entrega corre a partir de tu confirmación y anticipo." },
    costos: { ...DATOS.costos },
    tarifas: Object.fromEntries(DATOS.servicios.map((s) => [s.clave, { ...s.tarifas }])),
    materiales: Object.fromEntries(MATERIALES_BASE.map((m) => [m.id, m.precio])),
    historial: [],
    folio: 1,
  });
  // Modo de trabajo: "cuenta" (dentro de hetnacnc.com con sesión), "demo" (sin cuenta) o "local" (vista previa suelta)
  const PUENTE = (() => { try { return window.parent !== window && window.parent.HETNA_PUENTE ? window.parent.HETNA_PUENTE : null; } catch (e) { return null; } })();
  const MODO = PUENTE ? PUENTE.modo : "local";
  const cuenta = { plan: "local", usadas: 0, limite: null, pruebaDias: 0, correo: "" };
  let cotActual = null;
  let conf = inicial();
  try {
    const g = JSON.parse(localStorage.getItem("hetna-cotizador") || "null");
    if (g && g.tarifas) conf = { ...inicial(), ...g, taller: { ...inicial().taller, ...g.taller }, costos: { ...DATOS.costos, ...g.costos } };
  } catch (e) { /* sin almacenamiento: se trabaja en memoria */ }
  let tGuardar = null;
  const guardarConf = () => {
    if (MODO === "cuenta") {
      clearTimeout(tGuardar);
      tGuardar = setTimeout(() => {
        const { historial, folio, ...resto } = conf;
        Promise.resolve(PUENTE.guardarConfig(resto)).then((r) => { if (r && r.ok === false && r.mensaje) aviso(r.mensaje); }).catch(() => aviso("No se pudieron guardar tus ajustes. Revisa tu conexión."));
      }, 800);
      return;
    }
    if (MODO === "demo") return;
    try { localStorage.setItem("hetna-cotizador", JSON.stringify(conf)); } catch (e) {}
  };

  // ---------- Estado de la cotizacion ----------
  const st = {
    datos: null, medidas: null, formato: null, nombreArchivo: "", mmPorUnidad: 1, manual: false,
    servicio: null, tipoIdx: 0, campos: {}, camposArchivo: {}, cantidad: 1, material: "",
    pone: "taller", acabadoIdx: 0, iva: true, extras: {}, elegida: "estandar", resultado: null,
  };
  const servicio = () => DATOS.servicios.find((s) => s.clave === st.servicio);
  const tipo = () => (tiposVisibles()[st.tipoIdx] || tiposVisibles()[0]);

  const SERV_2D = ["laser_co2", "plasma", "router", "laser_fibra", "herreria", "carpinteria", "diseno"];
  const SERV_3D = ["impresion_3d", "router", "carpinteria", "diseno"];
  const serviciosVisibles = () => {
    const tipoArchivo = st.medidas?.tipo;
    const lista = tipoArchivo === "2d" ? SERV_2D : tipoArchivo === "3d" ? SERV_3D : DATOS.servicios.map((s) => s.clave);
    return DATOS.servicios.filter((s) => lista.includes(s.clave));
  };
  const sugerido = () => (st.medidas?.tipo === "3d" ? "impresion_3d" : st.medidas?.tipo === "2d" ? "laser_co2" : null);
  const tiposVisibles = () => {
    const s = servicio();
    if (!s) return [];
    const t = st.medidas?.tipo;
    if (t === "2d" && ["router", "carpinteria"].includes(s.clave)) return s.tipos.filter((x) => ["por_area", "por_pieza", "precio_fijo"].includes(x.f));
    if (t === "3d" && ["router", "carpinteria"].includes(s.clave)) return s.tipos.filter((x) => ["por_volumen", "por_pieza", "precio_fijo"].includes(x.f));
    return s.tipos;
  };

  // ---------- Archivo ----------
  const UNIDADES_2D = [["auto", "Automático"], ["1", "Milímetros"], ["10", "Centímetros"], ["25.4", "Pulgadas"], [String(25.4 / 96), "Pixeles (96 ppp)"], [String(25.4 / 72), "Pixeles (72 ppp)"]];
  const UNIDADES_3D = [["1", "Milímetros"], ["10", "Centímetros"], ["25.4", "Pulgadas"], ["1000", "Metros"]];

  const cargarArchivo = async (nombre, contenido) => {
    const ext = (nombre.split(".").pop() || "").toLowerCase();
    try {
      let d;
      if (ext === "dxf") d = GEO.leerDXF(typeof contenido === "string" ? contenido : new TextDecoder().decode(contenido));
      else if (ext === "svg") d = GEO.leerSVG(typeof contenido === "string" ? contenido : new TextDecoder().decode(contenido), $("svg-host"));
      else if (ext === "stl") d = GEO.leerSTL(contenido);
      else if (ext === "obj") d = GEO.leerOBJ(typeof contenido === "string" ? contenido : new TextDecoder().decode(contenido));
      else throw new Error("Ese tipo de archivo todavía no se puede leer. Usa DXF, SVG, STL u OBJ.");
      st.datos = d; st.formato = d.formato; st.nombreArchivo = nombre; st.manual = false;
      st.unidadSel = d.tipo === "2d" ? "auto" : "1";
      aplicarUnidad();
      st.servicio = sugerido(); st.tipoIdx = 0; st.extras = {};
      $("zona-subir").hidden = true; $("zona-manual").hidden = true; $("zona-archivo").hidden = false;
      pintarArchivo();
      pintarTrabajo();
    } catch (e) {
      aviso(e.message || "No se pudo leer el archivo.");
    }
  };
  const aplicarUnidad = () => {
    const d = st.datos;
    if (!d) return;
    if (d.tipo === "2d") {
      st.mmPorUnidad = st.unidadSel === "auto" ? (d.unidadSugerida || 1) : num(st.unidadSel);
      st.medidas = GEO.medir2D(d, st.mmPorUnidad);
    } else {
      st.mmPorUnidad = num(st.unidadSel) || 1;
      st.medidas = GEO.medir3D(d, st.mmPorUnidad);
    }
    const m = st.medidas;
    st.camposArchivo = m.tipo === "2d"
      ? { largo: m.largoMm / 10, ancho: m.anchoMm / 10, metros: m.corteMm / 1000 }
      : { largo: m.largoMm / 10, ancho: m.anchoMm / 10, alto: m.altoMm / 10 };
    st.campos = { ...st.camposArchivo };
  };

  const pintarArchivo = () => {
    const m = st.medidas, d = st.datos;
    $("vista-etq").textContent = st.formato;
    $("archivo-nombre").textContent = st.nombreArchivo;
    const u = d.tipo === "2d" ? UNIDADES_2D : UNIDADES_3D;
    $("unidad").innerHTML = u.map(([v, t]) => `<option value="${v}" ${v === st.unidadSel ? "selected" : ""}>${t}${v === "auto" && d.unidadSugerida ? " (" + nombreUnidad(d.unidadSugerida) + ")" : ""}</option>`).join("");
    const celdas = m.tipo === "2d"
      ? [["Medidas", `${fmt(m.largoMm)} × ${fmt(m.anchoMm)} mm`], ["Corte total", `${fmt(m.corteMm / 1000, 2)} m`], ["Perforaciones", `${m.perforaciones}`], ["Área de lámina", `${fmt((m.largoMm * m.anchoMm) / 1e6, 3)} m²`]]
      : [["Medidas", `${fmt(m.largoMm)} × ${fmt(m.anchoMm)} × ${fmt(m.altoMm)} mm`], ["Volumen real", `${fmt(m.volumenCm3, 1)} cm³`], ["Superficie", `${fmt(m.areaCm2, 1)} cm²`], ["Triángulos", m.triangulos.toLocaleString("es-MX")]];
    $("medidas").innerHTML = celdas.map(([a, b]) => `<div class="medida"><small>${a}</small><b>${b}</b></div>`).join("");
    const av = [];
    if (d.tipo === "2d" && !d.unidadSugerida && d.formato === "DXF") av.push("El DXF no dice en qué unidades está; lo tomé en milímetros. Si las medidas se ven raras, cambia las unidades.");
    if (d.ignoradas && Object.keys(d.ignoradas).length) av.push("No se cobran: " + Object.entries(d.ignoradas).map(([k, v]) => `${k} (${v})`).join(", ") + ". Si eran cortes, conviértelos a líneas.");
    if (m.tipo === "2d" && (m.largoMm < 1 || m.largoMm > 20000)) av.push("Las medidas se ven fuera de lo normal. Revisa las unidades del archivo.");
    if (m.tipo === "3d" && !m.cerrada) av.push("La malla parece abierta: el volumen puede no ser exacto.");
    $("avisos-archivo").innerHTML = av.map((t) => `<div class="aviso">${esc(t)}</div>`).join("");
    prepararVista();
  };
  const nombreUnidad = (f) => (Math.abs(f - 1) < 1e-9 ? "mm" : Math.abs(f - 10) < 1e-9 ? "cm" : Math.abs(f - 25.4) < 1e-9 ? "pulgadas" : Math.abs(f - 1000) < 1e-9 ? "m" : Math.abs(f - 25.4 / 96) < 1e-6 ? "px 96 ppp" : f.toFixed(3) + " mm por unidad");

  // ---------- Vista previa y simulador ----------
  const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const colores = () => { const cs = getComputedStyle(document.documentElement); return { acento: cs.getPropertyValue("--accent").trim() || "#C2560A", tinta: cs.getPropertyValue("--navy-ink").trim() || "#E9EEF6", fondo: cs.getPropertyValue("--navy").trim() || "#142033" }; };
  const hexRgb = (h) => { const m = h.replace("#", ""); const v = m.length === 3 ? m.split("").map((x) => x + x).join("") : m; return [0, 2, 4].map((i) => parseInt(v.slice(i, i + 2), 16) || 0); };
  const sim = { activo: false, t: 0, vel: 1, ultimo: 0, orden: null, largoTotal: 0 };

  // ----- 2D: dibujo y simulacion del corte -----
  const prepararRuta2D = () => {
    const d = st.datos;
    // agujeros e interiores primero, contorno exterior al final (como se corta en taller)
    const cajaP = (p) => { let a = Infinity, b = Infinity, c = -Infinity, e = -Infinity; for (const [x, y] of p.pts) { a = Math.min(a, x); b = Math.min(b, y); c = Math.max(c, x); e = Math.max(e, y); } return (c - a) * (e - b); };
    // une trazos sueltos que se tocan (lineas y arcos de un mismo contorno) en una sola cadena
    const tol = Math.max(1e-6, Math.hypot(st.medidas.caja.x1 - st.medidas.caja.x0, st.medidas.caja.y1 - st.medidas.caja.y0) * 1e-5);
    const igual = (p, q) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol;
    const abiertas = d.polis.filter((p) => !p.cerrada).map((p) => p.pts.slice());
    const cadenas = d.polis.filter((p) => p.cerrada).map((p) => ({ pts: p.pts, cerrada: true }));
    while (abiertas.length) {
      let c = abiertas.shift();
      let crecio = true;
      while (crecio) {
        crecio = false;
        for (let i = 0; i < abiertas.length; i++) {
          const q = abiertas[i], fin = c[c.length - 1], ini = c[0];
          if (igual(fin, q[0])) c = c.concat(q.slice(1));
          else if (igual(fin, q[q.length - 1])) c = c.concat(q.slice(0, -1).reverse());
          else if (igual(ini, q[q.length - 1])) c = q.slice(0, -1).concat(c);
          else if (igual(ini, q[0])) c = q.slice(1).reverse().concat(c);
          else continue;
          abiertas.splice(i, 1); crecio = true; break;
        }
      }
      cadenas.push({ pts: c, cerrada: false });
    }
    const polis = cadenas.map((p) => ({ ...p, area: cajaP(p) })).sort((a, b) => a.area - b.area);
    const tramos = [];
    let previo = null, total = 0;
    for (const p of polis) {
      const pts = p.cerrada ? [...p.pts, p.pts[0]] : p.pts;
      if (previo) { const L = Math.hypot(pts[0][0] - previo[0], pts[0][1] - previo[1]); tramos.push({ tipo: "rapido", pts: [previo, pts[0]], L }); total += L; }
      let L = 0;
      for (let i = 1; i < pts.length; i++) L += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      tramos.push({ tipo: "corte", pts, L });
      total += L;
      previo = pts[pts.length - 1];
    }
    sim.orden = tramos; sim.largoTotal = total;
  };
  const dibujar2D = (ctx, W, H) => {
    const d = st.datos, { acento, tinta } = colores();
    const c = st.medidas.caja, pad = 28;
    const s = Math.min((W - pad * 2) / Math.max(1e-9, c.x1 - c.x0), (H - pad * 2) / Math.max(1e-9, c.y1 - c.y0));
    const ox = (W - (c.x1 - c.x0) * s) / 2, oy = (H - (c.y1 - c.y0) * s) / 2;
    const X = (x) => ox + (x - c.x0) * s, Y = (y) => H - (oy + (y - c.y0) * s);
    const trazar = (pts, hasta) => {
      ctx.beginPath();
      let rec = 0, fin = null;
      for (let i = 0; i < pts.length; i++) {
        const [x, y] = pts[i];
        if (i === 0) { ctx.moveTo(X(x), Y(y)); fin = [x, y]; continue; }
        const [px, py] = pts[i - 1];
        const l = Math.hypot(x - px, y - py);
        if (hasta !== undefined && rec + l > hasta) { const f = (hasta - rec) / l; fin = [px + (x - px) * f, py + (y - py) * f]; ctx.lineTo(X(fin[0]), Y(fin[1])); return fin; }
        rec += l; ctx.lineTo(X(x), Y(y)); fin = [x, y];
      }
      return fin;
    };
    if (!sim.activo) {
      ctx.strokeStyle = acento; ctx.lineWidth = 1.6; ctx.lineJoin = "round";
      for (const p of d.polis) { trazar(p.cerrada ? [...p.pts, p.pts[0]] : p.pts); ctx.stroke(); }
    } else {
      ctx.strokeStyle = "rgba(233,238,246,0.22)"; ctx.lineWidth = 1.2;
      for (const p of d.polis) { trazar(p.cerrada ? [...p.pts, p.pts[0]] : p.pts); ctx.stroke(); }
      let resta = sim.t * sim.largoTotal, cabeza = null, perf = 0, cortado = 0;
      for (const tr of sim.orden) {
        if (resta <= 0) break;
        const hasta = Math.min(resta, tr.L);
        if (tr.tipo === "rapido") { ctx.setLineDash([4, 4]); ctx.strokeStyle = "rgba(233,238,246,0.55)"; ctx.lineWidth = 1; }
        else { ctx.setLineDash([]); ctx.strokeStyle = acento; ctx.lineWidth = 2.4; perf += 1; cortado += hasta; }
        cabeza = trazar(tr.pts, hasta); ctx.stroke();
        resta -= tr.L;
      }
      ctx.setLineDash([]);
      if (cabeza) {
        ctx.fillStyle = "rgba(255,210,150,0.35)"; ctx.beginPath(); ctx.arc(X(cabeza[0]), Y(cabeza[1]), 9, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#FFE3C2"; ctx.beginPath(); ctx.arc(X(cabeza[0]), Y(cabeza[1]), 3.5, 0, Math.PI * 2); ctx.fill();
      }
      const f = st.mmPorUnidad;
      $("sim-dato").textContent = `Perforación ${Math.min(perf, st.medidas.perforaciones)} de ${st.medidas.perforaciones} · ${fmt((cortado * f) / 1000, 2)} de ${fmt(st.medidas.corteMm / 1000, 2)} m`;
    }
    ctx.fillStyle = tinta; ctx.font = "500 11px 'IBM Plex Mono', monospace"; ctx.textAlign = "center";
    ctx.fillText(`${fmt(st.medidas.largoMm)} mm`, W / 2, H - 8);
    ctx.save(); ctx.translate(12, H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(`${fmt(st.medidas.anchoMm)} mm`, 0, 0); ctx.restore();
  };

  // ----- 3D con WebGL (three.js) -----
  const v3 = { listo: false, renderer: null, scene: null, camera: null, pieza: null, bloque: null, planoPieza: null, planoBloque: null, orb: { th: 0.8, ph: 1.05, dist: 100 }, altura: 1, girando: !quieto, usado: false };
  const crear3D = () => {
    if (!window.THREE) return false;
    if (v3.listo) return true;
    try {
      const T = window.THREE;
      v3.renderer = new T.WebGLRenderer({ canvas: $("lienzo3d"), antialias: true, preserveDrawingBuffer: true });
      v3.renderer.localClippingEnabled = true;
      v3.scene = new T.Scene();
      v3.camera = new T.PerspectiveCamera(40, 1, 0.1, 100000);
      v3.scene.add(new T.HemisphereLight(0xdfe8f5, 0x1a2230, 0.9));
      const sol = new T.DirectionalLight(0xffffff, 0.85); sol.position.set(1, 2, 1.5); v3.scene.add(sol);
      const sol2 = new T.DirectionalLight(0xffffff, 0.3); sol2.position.set(-1.5, 0.5, -1); v3.scene.add(sol2);
      v3.listo = true;
      return true;
    } catch (e) { return false; }
  };
  const cargar3D = () => {
    if (!crear3D()) return false;
    const T = window.THREE, d = st.datos, f = st.mmPorUnidad, c = st.medidas.caja;
    const { acento } = colores();
    [v3.pieza, v3.bloque, v3.cama].forEach((o) => { if (o) { v3.scene.remove(o); o.geometry.dispose(); o.material.dispose(); } });
    const n = d.tris.length;
    const pos = new Float32Array(n);
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2;
    for (let i = 0; i < n; i += 3) {
      // Z del archivo hacia arriba (eje Y de la escena), base de la pieza en 0
      pos[i] = (d.tris[i] - cx) * f;
      pos[i + 1] = (d.tris[i + 2] - c.z0) * f;
      pos[i + 2] = -(d.tris[i + 1] - cy) * f;
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(pos, 3));
    g.computeVertexNormals();
    v3.planoPieza = new T.Plane(new T.Vector3(0, -1, 0), 1e9);
    v3.planoBloque = new T.Plane(new T.Vector3(0, 1, 0), 1e9);
    v3.pieza = new T.Mesh(g, new T.MeshStandardMaterial({ color: new T.Color(acento), roughness: 0.55, metalness: 0.08, side: T.DoubleSide, clippingPlanes: [v3.planoPieza] }));
    v3.scene.add(v3.pieza);
    const L = st.medidas.largoMm, A = st.medidas.anchoMm, H = st.medidas.altoMm;
    const bg = new T.BoxGeometry(L * 1.06, H * 1.03, A * 1.06); bg.translate(0, (H * 1.03) / 2, 0);
    v3.bloque = new T.Mesh(bg, new T.MeshStandardMaterial({ color: 0xc9b89a, roughness: 0.9, transparent: true, opacity: 0.55, depthWrite: false, clippingPlanes: [v3.planoBloque] }));
    v3.bloque.visible = false;
    v3.scene.add(v3.bloque);
    const R = Math.max(L, A, H) || 10;
    v3.cama = new T.GridHelper(R * 1.6, 16, 0x3a4a63, 0x243247);
    v3.scene.add(v3.cama);
    v3.orb = { th: 0.8, ph: 1.05, dist: R * 2.3 };
    v3.centro = new T.Vector3(0, H / 2, 0);
    v3.altura = H;
    v3.renderer.setClearColor(new T.Color(colores().fondo));
    return true;
  };
  const render3D = () => {
    if (!v3.listo || !v3.pieza) return;
    const caja = $("vista"), W = caja.clientWidth, H = caja.clientHeight;
    if (!W || !H) return;
    v3.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    v3.renderer.setSize(W, H, false);
    v3.camera.aspect = W / H; v3.camera.updateProjectionMatrix();
    const o = v3.orb, cc = v3.centro;
    v3.camera.position.set(cc.x + o.dist * Math.sin(o.ph) * Math.sin(o.th), cc.y + o.dist * Math.cos(o.ph), cc.z + o.dist * Math.sin(o.ph) * Math.cos(o.th));
    v3.camera.lookAt(cc);
    // simulacion: impresion sube por capas; maquinado baja quitando material del bloque
    const h = v3.altura;
    if (sim.activo) {
      const imprime = servicio()?.clave === "impresion_3d";
      const nivel = imprime ? sim.t * h : h * (1 - sim.t);
      v3.planoPieza.constant = imprime ? nivel : 1e9;
      v3.planoBloque.constant = -nivel;
      v3.bloque.visible = !imprime;
      const capa = 0.2;
      $("sim-dato").textContent = imprime
        ? `Capa ${Math.max(1, Math.ceil(nivel / capa))} de ${Math.max(1, Math.ceil(h / capa))} (0.2 mm) · altura ${fmt(nivel, 1)} mm`
        : `Profundidad ${fmt(h - nivel, 1)} de ${fmt(h, 1)} mm · desbaste por niveles`;
    } else {
      v3.planoPieza.constant = 1e9; v3.bloque.visible = false;
    }
    v3.renderer.render(v3.scene, v3.camera);
  };

  // ----- Respaldo 3D sin WebGL: dibujo en canvas -----
  let rot = { x: -0.6, y: 0.7 };
  const dibujar3DCanvas = (ctx, W, H) => {
    const t = st.datos.tris, c = st.medidas.caja, { acento } = colores();
    const cx = (c.x0 + c.x1) / 2, cy = (c.y0 + c.y1) / 2, cz = (c.z0 + c.z1) / 2;
    const R = Math.max(c.x1 - c.x0, c.y1 - c.y0, c.z1 - c.z0) || 1;
    const k0 = (Math.min(W, H) * 0.62) / R;
    const n = t.length / 9, paso = Math.max(1, Math.ceil(n / 25000));
    const sx = Math.sin(rot.x), cxr = Math.cos(rot.x), sy = Math.sin(rot.y), cyr = Math.cos(rot.y);
    const lim = sim.activo ? c.z0 + (c.z1 - c.z0) * sim.t : Infinity;
    const tr = (x, y, z) => { x -= cx; y -= cy; z -= cz; const X = x * cyr - y * sy, Yp = x * sy + y * cyr; return [W / 2 + X * k0, H / 2 - (Yp * sx + z * cxr) * k0, Yp * cxr - z * sx]; };
    const caras = [];
    for (let i = 0; i < n; i += paso) {
      const o = i * 9;
      if (Math.min(t[o + 2], t[o + 5], t[o + 8]) > lim) continue;
      const a = tr(t[o], t[o + 1], t[o + 2]), b = tr(t[o + 3], t[o + 4], t[o + 5]), d = tr(t[o + 6], t[o + 7], t[o + 8]);
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
      const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
      caras.push([a, b, d, (a[2] + b[2] + d[2]) / 3, Math.abs((nx * 0.3 - ny * 0.5 + nz * 0.8) / (Math.hypot(nx, ny, nz) || 1))]);
    }
    caras.sort((p, q) => p[3] - q[3]);
    const rgb = hexRgb(acento);
    for (const [a, b, d, , luz] of caras) {
      const k = 0.35 + 0.65 * luz;
      ctx.fillStyle = `rgb(${Math.round(rgb[0] * k)},${Math.round(rgb[1] * k)},${Math.round(rgb[2] * k)})`;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(d[0], d[1]); ctx.closePath(); ctx.fill();
    }
    if (sim.activo) $("sim-dato").textContent = `Altura ${fmt((lim - c.z0) * st.mmPorUnidad, 1)} de ${fmt(st.medidas.altoMm, 1)} mm`;
  };

  const usa3D = () => st.datos?.tipo === "3d" && v3.listo && v3.pieza;
  const dibujar = () => {
    const d = st.datos;
    const es3D = d?.tipo === "3d" && usa3D();
    $("lienzo").hidden = es3D; $("lienzo3d").hidden = !es3D;
    $("vista-gira").hidden = d?.tipo !== "3d";
    if (es3D) { render3D(); return; }
    const cv = $("lienzo"), caja = $("vista");
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = caja.clientWidth, H = caja.clientHeight;
    if (!W || !H) return;
    cv.width = W * dpr; cv.height = H * dpr;
    const ctx = cv.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = colores().fondo; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(233,238,246,0.07)"; ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 20) { ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 20) { ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    if (!d) return;
    if (d.tipo === "2d") dibujar2D(ctx, W, H); else dibujar3DCanvas(ctx, W, H);
  };
  const prepararVista = () => {
    detenerSim();
    if (st.datos?.tipo === "3d") cargar3D(); else prepararRuta2D();
    requestAnimationFrame(dibujar);
  };

  // ----- Controles: girar, acercar, pellizcar -----
  const vista = $("vista");
  const punteros = new Map();
  let distPellizco = 0;
  vista.addEventListener("pointerdown", (e) => { if (st.datos?.tipo !== "3d") return; punteros.set(e.pointerId, [e.clientX, e.clientY]); vista.setPointerCapture(e.pointerId); v3.usado = true; });
  vista.addEventListener("pointermove", (e) => {
    if (!punteros.has(e.pointerId)) return;
    const prev = punteros.get(e.pointerId);
    punteros.set(e.pointerId, [e.clientX, e.clientY]);
    if (punteros.size === 2) {
      const [a, b] = [...punteros.values()];
      const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (distPellizco) acercar(distPellizco / d);
      distPellizco = d;
      return;
    }
    const dx = e.clientX - prev[0], dy = e.clientY - prev[1];
    v3.orb.th -= dx * 0.01; v3.orb.ph = Math.min(3.0, Math.max(0.12, v3.orb.ph - dy * 0.01));
    rot.y += dx * 0.01; rot.x += dy * 0.01;
    dibujar();
  });
  const soltar = (e) => { punteros.delete(e.pointerId); if (punteros.size < 2) distPellizco = 0; };
  vista.addEventListener("pointerup", soltar); vista.addEventListener("pointercancel", soltar);
  const acercar = (f) => { v3.orb.dist = Math.min(v3.orb.dist * 8, Math.max(1, v3.orb.dist * f)); dibujar(); };
  vista.addEventListener("wheel", (e) => { if (st.datos?.tipo !== "3d") return; e.preventDefault(); acercar(e.deltaY > 0 ? 1.1 : 0.9); }, { passive: false });

  // ----- Simulador -----
  const detenerSim = () => { sim.activo = false; sim.t = 0; $("sim-panel").hidden = true; $("btn-sim").textContent = st.datos?.tipo === "3d" ? (servicio()?.clave === "impresion_3d" ? "Simular impresión" : "Simular maquinado") : "Simular corte"; };
  const minutosSim = () => {
    const r = st.resultado;
    if (!r || !(r.tiempoHoras > 0)) return null;
    return (r.tiempoHoras * 60) / Math.max(1, st.cantidad);
  };
  $("btn-sim").addEventListener("click", () => {
    if (!st.datos) return;
    if (sim.activo) { detenerSim(); dibujar(); return; }
    sim.activo = true; sim.t = quieto ? 1 : 0; sim.ultimo = 0;
    $("sim-panel").hidden = false; $("btn-sim").textContent = "Detener simulación";
    const m = minutosSim();
    $("sim-tiempo").textContent = m ? `Tiempo de máquina estimado: ${m < 1 ? fmt(m * 60, 0) + " s" : fmt(m, 1) + " min"} por pieza` : "";
    dibujar();
  });
  $("sim-vel").addEventListener("click", () => { sim.vel = sim.vel >= 4 ? 1 : sim.vel * 2; $("sim-vel").textContent = sim.vel + "×"; });
  $("sim-repetir").addEventListener("click", () => { sim.t = 0; dibujar(); });

  // Bucle de animacion
  const bucle = (ts) => {
    const visible = !document.hidden && !$("zona-archivo").hidden && !$("vista-cotizar").hidden;
    if (visible && st.datos) {
      if (sim.activo && sim.t < 1) {
        const dt = sim.ultimo ? (ts - sim.ultimo) / 1000 : 0;
        sim.t = Math.min(1, sim.t + (dt * sim.vel) / 9);
        dibujar();
      } else if (st.datos.tipo === "3d" && !sim.activo && !v3.usado && !quieto && punteros.size === 0) {
        v3.orb.th += 0.004; rot.y += 0.006;
        if (usa3D() || st.datos.tris.length / 9 < 20000) dibujar();
      }
    }
    sim.ultimo = ts;
    requestAnimationFrame(bucle);
  };
  requestAnimationFrame(bucle);
  window.addEventListener("resize", () => st.datos && dibujar());

  // Imagen de la pieza para el PDF
  const imagenPieza = () => {
    const estaba = sim.activo;
    sim.activo = false;
    try {
      dibujar();
      return usa3D() ? $("lienzo3d").toDataURL("image/jpeg", 0.9) : $("lienzo").toDataURL("image/jpeg", 0.9);
    } catch (e) { return null; }
    finally { sim.activo = estaba; dibujar(); }
  };

  // ---------- Paso 2: trabajo ----------
  const CAMPOS = { largo: ["Largo (cm)", 0.1], ancho: ["Ancho (cm)", 0.1], alto: ["Alto (cm)", 0.1], metros: ["Metros de corte", 0.01], horas: ["Horas de trabajo", 0.25], minutos: ["Minutos de máquina", 1], peso: ["Peso (kg)", 0.1] };
  const pintarTrabajo = () => {
    const vis = serviciosVisibles();
    if (!vis.find((s) => s.clave === st.servicio)) st.servicio = vis[0]?.clave;
    const sug = sugerido();
    $("servicios").innerHTML = vis.map((s) => `<button type="button" class="chip" data-s="${s.clave}" aria-pressed="${s.clave === st.servicio}">${esc(nombreServicio(s))}${s.clave === sug ? '<span class="sug">sugerido</span>' : ""}</button>`).join("");
    const tv = tiposVisibles();
    if (st.tipoIdx >= tv.length) st.tipoIdx = 0;
    $("tipo").innerHTML = tv.map((t, i) => `<option value="${i}" ${i === st.tipoIdx ? "selected" : ""}>${esc(t.n)}</option>`).join("");
    const s = servicio();
    // materiales
    const mats = s.materiales || [];
    const esImp = s.clave === "impresion_3d";
    $("campo-material").hidden = !mats.length || s.clave === "diseno";
    const matsOpc = esImp ? mats.filter((m) => !/resina/i.test(m)) : mats;
    if (!matsOpc.includes(st.material)) st.material = matsOpc[0] || "";
    $("material").innerHTML = matsOpc.map((m) => `<option ${m === st.material ? "selected" : ""}>${esc(m)}</option>`).join("");
    // acabados
    $("campo-acabado").hidden = !(s.acabados || []).length;
    if (st.acabadoIdx >= (s.acabados || []).length) st.acabadoIdx = 0;
    $("acabado").innerHTML = (s.acabados || []).map((a, i) => `<option value="${i}" ${i === st.acabadoIdx ? "selected" : ""}>${esc(a.n)}${a.p ? " (+" + dinero(a.p) + ")" : ""}</option>`).join("");
    pintarCampos();
    pintarOpcionesServicio();
    calcular();
    detenerSim();
    if (st.datos) requestAnimationFrame(dibujar);
  };
  const nombreServicio = (s) => ({ "Laser CO2": "Láser CO2", Impresion: "Impresión 3D", "Impresion 3D": "Impresión 3D", Carpinteria: "Carpintería", Herreria: "Herrería", "Diseno Digital": "Diseño digital" }[s.nombre] || s.nombre);

  const pintarCampos = () => {
    const t = tipo();
    const nec = t ? t.nec.filter((k) => CAMPOS[k]) : [];
    if (t && t.f === "por_metro" && !nec.includes("metros")) nec.push("metros");
    $("campos-medidas").innerHTML = nec.map((k) => {
      const v = st.campos[k] ?? "";
      const desdeArchivo = st.camposArchivo[k] !== undefined && Math.abs(num(st.camposArchivo[k]) - num(v)) < 1e-9;
      return `<div class="campo"><label for="c-${k}">${CAMPOS[k][0]}</label><input id="c-${k}" data-campo="${k}" type="number" min="0" step="${CAMPOS[k][1]}" inputmode="decimal" value="${v === "" ? "" : Math.round(num(v) * 100) / 100}">${desdeArchivo ? '<span class="del-archivo">Leído del archivo</span>' : ""}</div>`;
    }).join("");
    $("bloque-material").hidden = !servicio() || ["diseno", "impresion_3d"].includes(servicio().clave) || t?.f === "por_hora";
    pintarInfoMaterial();
  };

  const check = (id, texto, sub) => `<label class="check"><input type="checkbox" data-extra="${id}" ${st.extras[id] ? "checked" : ""}> <span>${texto}${sub ? `<br><small class="ayuda">${sub}</small>` : ""}</span></label>`;
  const pintarOpcionesServicio = () => {
    const s = servicio(), t = tipo();
    const T = conf.tarifas[s.clave];
    let campos = "", extras = "";
    if (s.clave === "laser_co2") {
      campos += sel("materialLaser", "Material en el láser", [["mdf_fino", "MDF delgado (3 mm)"], ["mdf_medio", "MDF medio (6 mm)"], ["otros", "Acrílico u otro"]]);
      if (/grab/i.test(t.n)) campos += sel("densidadLaser", "Grabado", [["ligero", "Ligero"], ["normal", "Normal"], ["denso", "Denso"]]);
    }
    if (s.clave === "plasma") {
      campos += sel("calibre", "Calibre", ["Cal 20", "Cal 18", "Cal 16", "Cal 14", "Cal 12", "Cal 10", "Cal 8", '3/16"', '1/4"'].map((c) => [c, c]), "Cal 14");
      extras += check("llevaLimpieza", "Limpieza de piezas", dinero(T.limpieza_pieza || 80) + " por pieza");
      extras += check("llevaFlete", "Flete y maniobra", "Según el tamaño total del pedido");
      extras += check("llevaDisenoPlasma", st.datos ? "Preparar el archivo del cliente" : "Diseñar la pieza", st.datos ? dinero(T.setup_archivo || 75) : dinero(T.tarifa_diseno_hora || 250) + " por hora");
    }
    if (s.clave === "router" || s.clave === "laser_co2") extras += check("llevaDiseno", "Diseño adicional", dinero(T.costo_diseno || 300));
    if (s.clave === "laser_fibra") {
      extras += check("llevaPlantilla", "Plantilla de sujeción", dinero(T.setup_plantilla || 150));
      extras += check("llevaRotativo", "Eje rotativo", dinero(T.cargo_rotativo || 25) + " por pieza");
    }
    if (s.clave === "impresion_3d") campos += sel("materialImpresion", "Filamento", [["pla", "PLA"], ["abs", "ABS"], ["petg", "PETG"], ["tpu", "TPU flexible"]]);
    if (s.clave === "diseno") {
      extras += check("clienteTraeArchivo", "El cliente trae archivo");
      extras += check("archivoEsVector", "Su archivo ya es vector (DXF/SVG)", "Solo se cobra preparación");
      extras += check("entregaUrgente", "Entrega urgente", "+" + (T.cargo_urgente || 40) + "%");
      extras += check("archivoEditableAlCliente", "Entregar archivo editable", "+" + (T.cargo_archivo_editable || 200) + "%");
      campos += `<div class="campo"><label for="o-revisionesExtra">Revisiones extra</label><input id="o-revisionesExtra" data-opc="revisionesExtra" type="number" min="0" step="1" value="${st.extras.revisionesExtra || 0}"></div>`;
    }
    if (t && t.f === "precio_fijo") campos += `<div class="campo"><label for="o-precioFijo">Precio por pieza</label><input id="o-precioFijo" data-opc="precioFijo" type="number" min="0" step="10" value="${st.extras.precioFijo || ""}" placeholder="Precio acordado"></div>`;
    $("campos-servicio").innerHTML = campos;
    $("extras").innerHTML = extras;
  };
  const sel = (id, etiqueta, opciones, def) => {
    if (st.extras[id] === undefined) st.extras[id] = def ?? opciones[0][0];
    return `<div class="campo"><label for="o-${id}">${etiqueta}</label><select id="o-${id}" data-opc="${id}">${opciones.map(([v, t]) => `<option value="${esc(v)}" ${v === st.extras[id] ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></div>`;
  };

  const precioMaterial = () => {
    const g = grupoMaterial(st.material);
    return g ? { grupo: g, precio: conf.materiales[g] } : { grupo: null, precio: null };
  };
  const pintarInfoMaterial = () => {
    $("mat-taller").setAttribute("aria-pressed", st.pone === "taller");
    $("mat-cliente").setAttribute("aria-pressed", st.pone === "cliente");
    if (st.pone === "cliente") { $("mat-info").textContent = "No se cobra material."; return; }
    const { grupo, precio } = precioMaterial();
    const area = (num(st.campos.largo) * num(st.campos.ancho)) / 10000;
    if (!grupo) $("mat-info").textContent = "Este material no tiene precio en tu lista. Agrégalo en Mi taller → Precios de materiales.";
    else if (!(precio > 0)) $("mat-info").innerHTML = `Falta el precio de <b>${esc(grupo)}</b>. Agrégalo en Mi taller → Precios de materiales para cobrarlo.`;
    else $("mat-info").innerHTML = `${esc(grupo)} a ${dinero(precio)}/m² × ${fmt(area, 3)} m² por pieza, más 15% de merma.`;
  };

  // ---------- Calculo con el motor de Vlado ----------
  const calcular = () => {
    const s = servicio(), t = tipo();
    if (!s || !t) return;
    const tarifas = { ...conf.tarifas[s.clave] };
    if (t.f === "precio_fijo") tarifas.precio_fijo = num(st.extras.precioFijo);
    const costos = { ...conf.costos, get costoHoraTotal() { return this.costoHoraTaller + this.costoHoraMaquina + this.costoHoraOperador; } };
    const { grupo, precio } = precioMaterial();
    const areaPieza = (num(st.campos.largo) * num(st.campos.ancho)) / 10000;
    const usaMaterial = !["diseno", "impresion_3d"].includes(s.clave) && t.f !== "por_hora";
    const tipoLaser = /corte/i.test(t.n) && /grab/i.test(t.n) ? "ambos" : /grab/i.test(t.n) ? "grabado" : "corte";
    const matPlasma = /inox/i.test(st.material) ? "inox" : /alumin/i.test(st.material) ? "aluminio" : "acero_negro";
    const acabado = (s.acabados || [])[st.acabadoIdx];
    const m = st.medidas;
    const archivoDe = (k) => st.campos[k] !== undefined && st.camposArchivo[k] !== undefined && Math.abs(num(st.campos[k]) - num(st.camposArchivo[k])) < 1e-9;
    const p = {
      cfg: { tarifas, rangos: s.rangos },
      costos,
      tipo: { nombre: t.n, formula: t.f, factor: t.k },
      nombreServicio: nombreServicio(s), emojiServicio: s.emoji,
      largo: num(st.campos.largo), ancho: num(st.campos.ancho), alto: num(st.campos.alto),
      peso: num(st.campos.peso), metros: num(st.campos.metros), horas: num(st.campos.horas), minutos: num(st.campos.minutos),
      cantidad: Math.max(1, Math.round(st.cantidad)),
      clienteTraeMaterial: st.pone === "cliente",
      materialLibreNombre: grupo || st.material,
      materialLibrePrecio: usaMaterial && st.pone === "taller" && precio > 0 ? areaPieza * precio : 0,
      acabado: acabado ? { nombre: acabado.n, precio: acabado.p } : null,
      aplicarIva: false,
      extrasSeleccionados: [],
      clienteTraeArchivo: !!st.extras.clienteTraeArchivo, archivoEsVector: !!st.extras.archivoEsVector,
      entregaUrgente: !!st.extras.entregaUrgente, revisionesExtra: Math.max(0, Math.round(num(st.extras.revisionesExtra))),
      archivoEditableAlCliente: !!st.extras.archivoEditableAlCliente,
      llevaDiseno: !!st.extras.llevaDiseno,
      calibre: st.extras.calibre || "Cal 14", material: matPlasma,
      llevaLimpieza: !!st.extras.llevaLimpieza, llevaFlete: !!st.extras.llevaFlete,
      llevaDisenoPlasma: !!st.extras.llevaDisenoPlasma, clienteTraeArchivoDXF: !!st.datos,
      materialLaser: st.extras.materialLaser || "mdf_fino", densidadLaser: st.extras.densidadLaser || "normal", tipoLaser,
      llevaPlantilla: !!st.extras.llevaPlantilla, llevaRotativo: !!st.extras.llevaRotativo,
      materialImpresion: st.extras.materialImpresion || "pla",
      perimetroRealMm: m?.tipo === "2d" && archivoDe("largo") && archivoDe("ancho") ? m.corteMm : 0,
      volumenRealCm3: m?.tipo === "3d" && archivoDe("largo") && archivoDe("ancho") && archivoDe("alto") ? m.volumenCm3 : 0,
    };
    let r;
    try { r = calcular_motor(p); } catch (e) { r = null; }
    st.resultado = r;
    pintarPrecio(r, p);
  };
  const calcular_motor = (p) => calcular_hetna(p);

  const NO_DINERO = new Set(["area_m2", "material_factor", "volumen_cm3", "gramos_estimados", "tiempo_min", "factor_tipo", "tiempo_estimado_ref", "horas_diseno", "minutos_estimados", "metros"]);
  const ETIQ = {
    area_m2: "Área por pieza (m²)", tarifa_m2: "Tarifa por m²", minimo_apertura: "Mínimo de apertura", material_factor: "Factor de material",
    mano_obra_lijado: "Lijado", mano_obra_barnizado: "Barnizado", diseno_adicional: "Diseño adicional", volumen_cm3: "Volumen (cm³)",
    gramos_estimados: "Filamento (g)", tiempo_min: "Minutos de impresión", precio_minimo: "Precio mínimo", precio_rango_base: "Precio base por tamaño",
    factor_tipo: "Factor del trabajo", tiempo_estimado_ref: "Horas estimadas", setup_montaje: "Preparación del archivo", vectorizacion_imagen: "Vectorizar imagen",
    horas_diseno: "Horas de diseño", tarifa_hora: "Tarifa por hora", cargo_urgente: "Cargo urgente", revisiones_extra: "Revisiones extra",
    archivo_editable: "Archivo editable", material_estimado: "Material estimado", desgaste_tubo: "Desgaste del tubo", minutos_estimados: "Minutos de máquina",
    tarifa_min: "Tarifa por minuto", metros: "Metros de corte", tarifa_metro: "Tarifa por metro", tarifa_por_pieza: "Tarifa por pieza",
    plantilla_sujecion: "Plantilla de sujeción", eje_rotativo: "Eje rotativo", limpieza_pieza: "Limpieza", flete_maniobra: "Flete y maniobra",
    setup_dxf: "Preparar DXF", diseno_plasma: "Diseño",
  };

  // Cobro minimo por trabajo: si el Estandar queda abajo, se suben las 3 opciones en la misma proporcion
  const factorMinimo = (r) => (conf.taller.minimo > 0 && r.pvRecomendado > 0 && r.pvRecomendado < conf.taller.minimo ? conf.taller.minimo / r.pvRecomendado : 1);
  const opcionesPrecio = (r) => {
    const f = (st.iva ? 1 + conf.costos.ivaPct / 100 : 1) * factorMinimo(r);
    return [
      { id: "economico", nombre: "Económico", total: r.pvMinimo * f, nota: "Sin prioridad" },
      { id: "estandar", nombre: "Estándar", total: r.pvRecomendado * f, nota: "Tiempo normal" },
      { id: "express", nombre: "Express", total: r.pvPremium * f, nota: "Con prioridad" },
    ];
  };

  const pintarPrecio = (r, p) => {
    $("precio-nota").textContent = st.iva ? "con IVA" : "sin IVA";
    if (!r || !(r.pvRecomendado > 0)) {
      $("opciones").innerHTML = "";
      $("aviso-precio").innerHTML = `<div class="aviso">Faltan datos para calcular: revisa las medidas${tipo()?.f === "precio_fijo" ? " o el precio por pieza" : ""}.</div>`;
      $("kpis").innerHTML = ""; $("desglose").innerHTML = "";
      actualizarMensaje();
      return;
    }
    $("aviso-precio").innerHTML = factorMinimo(r) > 1 ? `<div class="aviso">Se aplicó tu cobro mínimo de ${dinero(conf.taller.minimo)} + IVA (el cálculo dio ${dinero(r.pvRecomendado)}). Lo cambias en Mi taller.</div>` : "";
    $("opciones").innerHTML = opcionesPrecio(r).map((o) => `<button type="button" class="opc" data-opc-precio="${o.id}" aria-pressed="${o.id === st.elegida}"><small>${o.nombre}</small><b>${dinero(o.total)}</b><span>${o.nota}</span></button>`).join("");
    const enTarifa = !(r.utilidad > 0.005);
    const estandar = opcionesPrecio(r).find((o) => o.id === "estandar").total;
    $("kpis").innerHTML = [
      ["Subtotal sin IVA", dinero(r.pvRecomendado * factorMinimo(r))],
      ["Material", r.cm > 0 ? dinero(r.cm) : "—"],
      [enTarifa ? "Utilidad" : "Utilidad", enTarifa ? "En tu tarifa" : dinero(r.utilidad)],
      ["Tiempo", fmt(r.tiempoHoras, 2) + " h"],
      [enTarifa ? "Margen" : "Margen", enTarifa ? "En tu tarifa" : fmt(r.margenReal, 1) + "%"],
      ["Por pieza", dinero(estandar / p.cantidad)],
    ].map(([a, b]) => `<div class="kpi"><small>${a}</small><b>${b}</b></div>`).join("");
    const filas = Object.entries(r.detalle).filter(([, v]) => v !== 0).map(([k, v]) => `<tr><td>${esc(ETIQ[k] || k)}</td><td>${NO_DINERO.has(k) ? fmt(v, 3) : dinero(v)}</td></tr>`);
    if (r.cm > 0) filas.push(`<tr><td>Material${r.materialNombre ? " (" + esc(r.materialNombre) + ")" : ""}</td><td>${dinero(r.cm)}</td></tr>`);
    if (r.ca > 0) filas.push(`<tr><td>Acabado</td><td>${dinero(r.ca)}</td></tr>`);
    filas.push(`<tr><td><b>Subtotal Estándar sin IVA</b></td><td><b>${dinero(r.pvRecomendado)}</b></td></tr>`);
    $("desglose").innerHTML = filas.join("");
    actualizarMensaje();
  };

  // ---------- Mensaje de WhatsApp ----------
  const firmaActual = () => JSON.stringify([st.servicio, st.tipoIdx, st.cantidad, st.material, st.pone, st.campos, st.extras, st.iva, st.acabadoIdx, st.nombreArchivo, st.resultado && st.resultado.pvRecomendado, $("cli-nombre").value.trim(), $("cli-tel").value.trim(), $("cli-nota").value.trim()]);
  const folioActual = () => {
    if (MODO === "local") return `COT-${new Date().toISOString().slice(2, 10).replace(/-/g, "")}-${String(conf.folio).padStart(3, "0")}`;
    return cotActual && cotActual.firma === firmaActual() ? cotActual.folio : "";
  };
  const textoMensaje = (folioForzado) => {
    const r = st.resultado, s = servicio(), t = tipo();
    if (!r || !(r.pvRecomendado > 0)) return "";
    const ops = opcionesPrecio(r);
    const m = st.medidas;
    const cli = $("cli-nombre").value.trim();
    const med = m ? (m.tipo === "2d" ? `${fmt(m.largoMm)} × ${fmt(m.anchoMm)} mm` : `${fmt(m.largoMm)} × ${fmt(m.anchoMm)} × ${fmt(m.altoMm)} mm`) : (st.campos.largo ? `${fmt(num(st.campos.largo))} × ${fmt(num(st.campos.ancho))} cm` : "");
    const vig = new Date(Date.now() + conf.taller.vigencia * 864e5).toLocaleDateString("es-MX", { day: "numeric", month: "long" });
    const L = [];
    const fol = folioForzado !== undefined ? folioForzado : folioActual();
    L.push(fol ? `*Cotización ${fol}*` : "*Cotización*");
    L.push(`${conf.taller.nombre}`);
    if (cli) L.push(`Para: ${cli}`);
    L.push("");
    L.push(`Trabajo: ${nombreServicio(s)} · ${t.n}`);
    if (st.nombreArchivo) L.push(`Archivo: ${st.nombreArchivo}`);
    if (med) L.push(`Medidas: ${med}`);
    if (st.material && !$("campo-material").hidden) L.push(`Material: ${st.material}${st.pone === "cliente" ? " (lo pone el cliente)" : ""}`);
    L.push(`Cantidad: ${st.cantidad} ${st.cantidad === 1 ? "pieza" : "piezas"}`);
    L.push("");
    for (const o of ops) L.push(`${o.id === st.elegida ? "▶ " : "• "}${o.nombre}: *${dinero(o.total)}*`);
    L.push(st.iva ? "Precios con IVA incluido." : "Precios más IVA.");
    const nota = $("cli-nota").value.trim();
    if (nota) { L.push(""); L.push(nota); }
    L.push("");
    L.push(`Vigencia: hasta el ${vig}.`);
    L.push("Responde con la opción que prefieres para apartar tu trabajo.");
    return L.join("\n");
  };
  const actualizarMensaje = () => {
    const t = textoMensaje();
    $("mensaje").textContent = t || "Completa los datos para armar el mensaje.";
    const tel = ($("cli-tel").value || "").replace(/\D/g, "");
    const destino = tel.length === 10 ? "52" + tel : tel.length > 10 ? tel : "";
    $("btn-wa").href = t ? `https://wa.me/${destino}?text=${encodeURIComponent(t)}` : "#";
    $("btn-wa").setAttribute("aria-disabled", t ? "false" : "true");
  };

  // ---------- Historial ----------
  // Registra la cotizacion en la cuenta (cuenta el limite del plan). Devuelve true si se puede continuar.
  const asegurarRegistro = async () => {
    const r = st.resultado;
    if (!r || !(r.pvRecomendado > 0)) { aviso("Primero completa la cotización."); return false; }
    if (MODO === "local") return true;
    if (MODO === "demo") { abrirModal("registro"); return false; }
    const firma = firmaActual();
    if (cotActual && cotActual.firma === firma) return true;
    const ops = opcionesPrecio(r);
    const m = st.medidas;
    let res = null;
    try {
      res = await PUENTE.registrar({
        cliente: $("cli-nombre").value.trim(), tel: $("cli-tel").value.trim(),
        servicio: nombreServicio(servicio()), tipo: tipo().n, archivo: st.nombreArchivo, cantidad: st.cantidad,
        elegida: st.elegida, opciones: ops.map((o) => ({ n: o.nombre, t: o.total })), totalEstandar: ops[1].total,
        mensaje: textoMensaje("{{FOLIO}}"),
        datos: { material: st.material, pone: st.pone, iva: st.iva, medidas: m ? { tipo: m.tipo, largoMm: m.largoMm, anchoMm: m.anchoMm, altoMm: m.altoMm, corteMm: m.corteMm, perforaciones: m.perforaciones, volumenCm3: m.volumenCm3 } : null },
      });
    } catch (e) { aviso("No se pudo guardar. Revisa tu conexión."); return false; }
    if (!res || !res.ok) {
      if (res && res.cuenta) { Object.assign(cuenta, res.cuenta); pintarCuenta(); }
      if (res && res.motivo === "limite") abrirModal("limite");
      else if (res && res.motivo === "sin_sesion") abrirModal("registro");
      else aviso((res && res.mensaje) || "No se pudo guardar la cotización.");
      return false;
    }
    cotActual = { firma, folio: res.folio, id: res.id };
    Object.assign(cuenta, res.cuenta);
    conf.historial.unshift(res.registro);
    pintarCuenta();
    actualizarMensaje();
    return true;
  };
  const guardarHist = async () => {
    const r = st.resultado;
    if (!r || !(r.pvRecomendado > 0)) { aviso("Primero completa la cotización."); return; }
    if (MODO !== "local") {
      if (await asegurarRegistro()) aviso(`Guardada con folio ${cotActual.folio}.`);
      return;
    }
    const ops = opcionesPrecio(r);
    conf.historial.unshift({
      folio: folioActual(), fecha: Date.now(), cliente: $("cli-nombre").value.trim(), tel: $("cli-tel").value.trim(),
      servicio: nombreServicio(servicio()), tipo: tipo().n, archivo: st.nombreArchivo, cantidad: st.cantidad,
      opciones: ops.map((o) => ({ n: o.nombre, t: o.total })), elegida: st.elegida, mensaje: textoMensaje(), estado: "Enviada",
    });
    conf.folio += 1;
    guardarConf();
    aviso("Guardada en el historial.");
    actualizarMensaje();
  };
  const pintarHist = () => {
    $("hist-cuenta").textContent = conf.historial.length ? `${conf.historial.length}` : "";
    if (!conf.historial.length) { $("historial").innerHTML = `<div class="vacio">Aún no guardas cotizaciones. Cuando cotices, toca <b>Guardar en historial</b>.</div>`; return; }
    $("historial").innerHTML = conf.historial.map((h, i) => {
      const el = h.opciones.find((o) => o.n.toLowerCase().startsWith(h.elegida.slice(0, 4))) || h.opciones[1];
      const cls = h.estado === "Aceptada" ? "ok" : h.estado === "Perdida" ? "warn" : "";
      const tel = (h.tel || "").replace(/\D/g, "");
      return `<div class="item">
        <div class="item-h"><b>${esc(h.folio)}</b><span class="pill ${cls}">${esc(h.estado)}</span><span class="fecha">${new Date(h.fecha).toLocaleDateString("es-MX", { day: "numeric", month: "short" })}</span></div>
        <div>${esc(h.cliente || "Sin nombre")} · ${esc(h.servicio)} · ${h.cantidad} pza</div>
        <div class="ayuda">${esc(h.tipo)}${h.archivo ? " · " + esc(h.archivo) : ""} · ${el.n}: <b>${dinero(el.t)}</b></div>
        <div class="fila-btn">
          <a class="btn chico" href="https://wa.me/${tel.length === 10 ? "52" + tel : tel}?text=${encodeURIComponent(h.mensaje)}" target="_blank" rel="noopener">Reenviar</a>
          <button class="btn chico" type="button" data-estado="${i}" data-v="Aceptada">Aceptada</button>
          <button class="btn chico" type="button" data-estado="${i}" data-v="Perdida">Perdida</button>
          <button class="btn chico fantasma" type="button" data-borrar="${i}">Borrar</button>
        </div></div>`;
    }).join("");
  };
  $("historial").addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    if (b.dataset.estado !== undefined) {
      const h = conf.historial[+b.dataset.estado];
      h.estado = b.dataset.v;
      if (MODO === "cuenta" && h.id) PUENTE.estado(h.id, h.estado); else guardarConf();
      pintarHist();
    }
    if (b.dataset.borrar !== undefined) {
      if (b.dataset.seguro) {
        const [h] = conf.historial.splice(+b.dataset.borrar, 1);
        if (MODO === "cuenta" && h && h.id) PUENTE.borrar(h.id); else guardarConf();
        pintarHist();
      }
      else { b.dataset.seguro = "1"; b.textContent = "¿Borrar? Toca otra vez"; }
    }
  });

  // ---------- Mi taller ----------
  const pintarTaller = () => {
    $("t-condiciones").value = conf.taller.condiciones || "";
    $("logo-prev").innerHTML = conf.taller.logo ? `<img src="${conf.taller.logo}" alt="Logo del taller" style="max-height:56px">` : "<span class='ayuda'>Sin logo</span>";
    $("t-nombre").value = conf.taller.nombre; $("t-wa").value = conf.taller.whatsapp; $("t-vigencia").value = conf.taller.vigencia; $("t-minimo").value = conf.taller.minimo;
    const C = [["margenMinimo", "Margen mínimo (%)"], ["margenRecomendado", "Margen recomendado (%)"], ["costoHoraMaquina", "Costo máquina por hora"], ["costoHoraOperador", "Costo operador por hora"], ["costoHoraTaller", "Costo fijo del taller por hora"], ["ivaPct", "IVA (%)"]];
    $("costos").innerHTML = C.map(([k, t]) => `<div class="campo"><label for="k-${k}">${t}</label><input id="k-${k}" data-costo="${k}" type="number" step="0.01" value="${conf.costos[k]}"></div>`).join("");
    $("materiales").innerHTML = MATERIALES_BASE.map((m) => `<div class="mat-fila"><label for="m-${m.id}">${esc(m.id)}<small>${conf.materiales[m.id] > 0 ? (conf.materiales[m.id] === m.precio ? esc(m.origen) : "Tu precio") : "Falta precio"}</small></label><div class="campo"><input id="m-${esc(m.id)}" data-mat="${esc(m.id)}" type="number" min="0" step="1" inputmode="decimal" placeholder="$ por m²" value="${conf.materiales[m.id] ?? ""}"></div></div>`).join("");
    $("tarifas").innerHTML = DATOS.servicios.map((s) => `<details><summary>${esc(nombreServicio(s))}</summary><div class="dentro">${Object.keys(s.tarifas).map((k) => `<div class="tarifa"><label for="tf-${s.clave}-${k}">${esc(s.etiquetas[k] || k)}</label><input id="tf-${s.clave}-${k}" data-tarifa="${s.clave}|${k}" type="number" step="0.01" value="${conf.tarifas[s.clave][k]}"></div>`).join("")}</div></details>`).join("");
    $("pill-taller").textContent = conf.taller.nombre;
  };
  $("vista-taller").addEventListener("input", (e) => {
    const el = e.target;
    if (el.id === "t-nombre") { conf.taller.nombre = el.value || "Mi taller CNC"; $("pill-taller").textContent = conf.taller.nombre; }
    if (el.id === "t-wa") conf.taller.whatsapp = el.value;
    if (el.id === "t-vigencia") conf.taller.vigencia = Math.max(1, Math.round(num(el.value)) || 15);
    if (el.id === "t-minimo") conf.taller.minimo = Math.max(0, num(el.value));
    if (el.id === "t-condiciones") conf.taller.condiciones = el.value;
    if (el.dataset.costo) conf.costos[el.dataset.costo] = num(el.value);
    if (el.dataset.mat) conf.materiales[el.dataset.mat] = el.value === "" ? null : num(el.value);
    if (el.dataset.tarifa) { const [s, k] = el.dataset.tarifa.split("|"); conf.tarifas[s][k] = num(el.value); }
    guardarConf();
    pintarInfoMaterial();
    calcular();
  });
  $("t-logo").addEventListener("change", (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    const lector = new FileReader();
    lector.onload = () => {
      const img = new Image();
      img.onload = () => {
        const k = Math.min(1, 300 / Math.max(img.width, img.height));
        const cv = document.createElement("canvas");
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
        conf.taller.logo = cv.toDataURL("image/png");
        guardarConf(); pintarTaller(); aviso("Logo guardado. Sale en tus PDF.");
      };
      img.onerror = () => aviso("Esa imagen no se pudo leer. Usa PNG o JPG.");
      img.src = lector.result;
    };
    lector.readAsDataURL(f);
  });
  $("quitar-logo").addEventListener("click", () => { conf.taller.logo = null; guardarConf(); pintarTaller(); });
  $("restaurar").addEventListener("click", () => { $("restaurar-conf").hidden = false; });
  $("restaurar-no").addEventListener("click", () => { $("restaurar-conf").hidden = true; });
  $("restaurar-si").addEventListener("click", () => {
    conf.tarifas = inicial().tarifas; conf.costos = { ...DATOS.costos };
    guardarConf(); pintarTaller(); calcular(); $("restaurar-conf").hidden = true; aviso("Tarifas restauradas.");
  });

  // ---------- Eventos de la cotizacion ----------
  const leerArchivo = (f) => {
    if (!f) return;
    const r = new FileReader();
    r.onload = () => cargarArchivo(f.name, r.result);
    r.onerror = () => aviso("No se pudo abrir el archivo.");
    r.readAsArrayBuffer(f);
  };
  $("archivo").addEventListener("change", (e) => { leerArchivo(e.target.files[0]); e.target.value = ""; });
  const zona = $("soltar");
  ["dragenter", "dragover"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.add("encima"); }));
  ["dragleave", "drop"].forEach((ev) => zona.addEventListener(ev, (e) => { e.preventDefault(); zona.classList.remove("encima"); }));
  zona.addEventListener("drop", (e) => leerArchivo(e.dataTransfer.files[0]));
  $("ej-2d").addEventListener("click", () => cargarArchivo("placa-montaje-ejemplo.dxf", EJEMPLOS.dxf()));
  $("ej-3d").addEventListener("click", () => cargarArchivo("soporte-L-ejemplo.stl", EJEMPLOS.stl()));
  $("sin-archivo").addEventListener("click", () => {
    st.datos = null; st.medidas = null; st.nombreArchivo = ""; st.manual = true; st.camposArchivo = {}; st.campos = { largo: 60, ancho: 40, alto: 5, metros: 2, horas: 2, minutos: 10 };
    $("zona-subir").hidden = true; $("zona-manual").hidden = false; $("zona-archivo").hidden = true;
    pintarTrabajo();
  });
  const volverASubir = () => { $("zona-subir").hidden = false; $("zona-manual").hidden = true; $("zona-archivo").hidden = true; };
  $("volver-subir").addEventListener("click", volverASubir);
  $("cambiar-archivo").addEventListener("click", () => { volverASubir(); $("archivo").click(); });
  $("unidad").addEventListener("change", (e) => { st.unidadSel = e.target.value; aplicarUnidad(); pintarArchivo(); pintarTrabajo(); });
  $("servicios").addEventListener("click", (e) => {
    const b = e.target.closest("[data-s]");
    if (!b) return;
    st.servicio = b.dataset.s; st.tipoIdx = 0; st.extras = {}; st.acabadoIdx = 0;
    pintarTrabajo();
  });
  $("tipo").addEventListener("change", (e) => { st.tipoIdx = +e.target.value; pintarCampos(); pintarOpcionesServicio(); calcular(); });
  $("campos-medidas").addEventListener("input", (e) => { const k = e.target.dataset.campo; if (!k) return; st.campos[k] = e.target.value; pintarInfoMaterial(); calcular(); });
  $("cantidad").addEventListener("input", (e) => { st.cantidad = Math.max(1, Math.round(num(e.target.value)) || 1); calcular(); });
  $("menos").addEventListener("click", () => { st.cantidad = Math.max(1, st.cantidad - 1); $("cantidad").value = st.cantidad; calcular(); });
  $("mas").addEventListener("click", () => { st.cantidad += 1; $("cantidad").value = st.cantidad; calcular(); });
  $("material").addEventListener("change", (e) => { st.material = e.target.value; pintarInfoMaterial(); calcular(); });
  $("mat-taller").addEventListener("click", () => { st.pone = "taller"; pintarInfoMaterial(); calcular(); });
  $("mat-cliente").addEventListener("click", () => { st.pone = "cliente"; pintarInfoMaterial(); calcular(); });
  $("acabado").addEventListener("change", (e) => { st.acabadoIdx = +e.target.value; calcular(); });
  $("iva").addEventListener("change", (e) => { st.iva = e.target.checked; calcular(); });
  $("campos-servicio").addEventListener("input", (e) => { const k = e.target.dataset.opc; if (!k) return; st.extras[k] = e.target.value; calcular(); });
  $("extras").addEventListener("change", (e) => { const k = e.target.dataset.extra; if (!k) return; st.extras[k] = e.target.checked; calcular(); });
  $("opciones").addEventListener("click", (e) => { const b = e.target.closest("[data-opc-precio]"); if (!b) return; st.elegida = b.dataset.opcPrecio; pintarPrecio(st.resultado, { cantidad: st.cantidad }); });
  ["cli-nombre", "cli-tel", "cli-nota"].forEach((id) => $(id).addEventListener("input", actualizarMensaje));
  $("btn-wa").addEventListener("click", async (e) => {
    if ($("btn-wa").getAttribute("aria-disabled") === "true") { e.preventDefault(); aviso("Completa la cotización primero."); return; }
    if (MODO === "local") return;
    e.preventDefault();
    if (MODO === "demo") { abrirModal("registro"); return; }
    const ventana = cotActual && cotActual.firma === firmaActual() ? null : window.open("", "_blank");
    const ok = await asegurarRegistro();
    if (!ok) { if (ventana) ventana.close(); return; }
    actualizarMensaje();
    const url = $("btn-wa").href;
    if (ventana) ventana.location.href = url;
    else { const w = window.open(url, "_blank", "noopener"); if (!w) window.top.location.href = url; }
  });
  $("btn-copiar").addEventListener("click", async () => {
    const t = textoMensaje();
    if (!t) { aviso("Completa la cotización primero."); return; }
    try { await navigator.clipboard.writeText(t); aviso("Mensaje copiado."); }
    catch (e) { const d = $("mensaje").closest("details"); d.open = true; const r = document.createRange(); r.selectNodeContents($("mensaje")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); aviso("Selecciona y copia el mensaje."); }
  });
  $("btn-guardar").addEventListener("click", guardarHist);

  // ---------- PDF de la cotizacion ----------
  let descargas = null;
  if (window.claude && window.claude.use) window.claude.use("downloads").then((d) => { descargas = d; }).catch(() => {});

  const lineasDetalle = () => {
    const s = servicio(), t = tipo(), m = st.medidas;
    const filas = [["Servicio", `${nombreServicio(s)} · ${t.n}`]];
    if (st.nombreArchivo) filas.push(["Archivo", st.nombreArchivo]);
    if (m && m.tipo === "2d") {
      filas.push(["Medidas", `${fmt(m.largoMm)} × ${fmt(m.anchoMm)} mm`]);
      filas.push(["Corte", `${fmt(m.corteMm / 1000, 2)} m · ${m.perforaciones} perforaciones`]);
    } else if (m && m.tipo === "3d") {
      filas.push(["Medidas", `${fmt(m.largoMm)} × ${fmt(m.anchoMm)} × ${fmt(m.altoMm)} mm`]);
      filas.push(["Volumen", `${fmt(m.volumenCm3, 1)} cm³`]);
    } else if (st.campos.largo) {
      filas.push(["Medidas", `${fmt(num(st.campos.largo))} × ${fmt(num(st.campos.ancho))} cm`]);
    }
    if (st.material && !$("campo-material").hidden) filas.push(["Material", `${st.material}${st.pone === "cliente" ? " (lo pone el cliente)" : ""}`]);
    const ac = (s.acabados || [])[st.acabadoIdx];
    if (ac && ac.p) filas.push(["Acabado", ac.n]);
    filas.push(["Cantidad", `${st.cantidad} ${st.cantidad === 1 ? "pieza" : "piezas"}`]);
    return filas;
  };

  const generarPDF = async () => {
    const r = st.resultado;
    if (!r || !(r.pvRecomendado > 0)) { aviso("Primero completa la cotización."); return; }
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) { aviso("No se pudo cargar el generador de PDF. Revisa tu conexión e intenta de nuevo."); return; }
    const enArtifact = !!(window.claude && window.claude.use);
    const dl = enArtifact ? (descargas || await window.claude.use("downloads").catch(() => null)) : null;
    if (enArtifact && !dl) { aviso("Descargar archivos no está disponible en esta vista."); return; }
    if (!(await asegurarRegistro())) return;
    const conMarca = MODO === "demo" || (MODO === "cuenta" && cuenta.plan === "gratis");

    const doc = new J({ unit: "mm", format: "letter" });
    const W = 215.9, M = 16;
    const NAVY = [20, 32, 51], NAR = [194, 86, 10], GRIS = [90, 101, 118], LINEA = [216, 222, 231], SUAVE = [251, 233, 220];
    const folio = folioActual();
    const hoy = new Date();
    const vig = new Date(Date.now() + conf.taller.vigencia * 864e5);
    const fecha = (d) => d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
    const limpio = (t) => String(t).replace(/·/g, "-").replace(/³/g, "3").replace(/²/g, "2").replace(/[^\x00-\xFF]/g, "");
    const txt = (t, x, y, o = {}) => { doc.setFont("helvetica", o.b ? "bold" : "normal"); doc.setFontSize(o.s || 10); doc.setTextColor(...(o.c || [19, 26, 37])); doc.text(limpio(t), x, y, o.a ? { align: o.a } : undefined); };

    // Encabezado
    doc.setFillColor(...NAVY); doc.rect(0, 0, W, 30, "F");
    let xNombre = M;
    if (conf.taller.logo && !conMarca) {
      try { doc.setFillColor(255, 255, 255); doc.roundedRect(M, 6, 18, 18, 2, 2, "F"); doc.addImage(conf.taller.logo, "PNG", M + 1.5, 7.5, 15, 15); xNombre = M + 23; } catch (e) {}
    }
    txt(conf.taller.nombre, xNombre, 15, { b: true, s: 16, c: [255, 255, 255] });
    if (conf.taller.whatsapp) txt(`WhatsApp ${conf.taller.whatsapp}`, xNombre, 21.5, { s: 9.5, c: [201, 210, 224] });
    txt("COTIZACIÓN", W - M, 13, { b: true, s: 15, c: NAR, a: "right" });
    txt(folio, W - M, 19.5, { s: 10, c: [255, 255, 255], a: "right" });

    // Cliente y fechas
    let y = 40;
    txt("CLIENTE", M, y, { b: true, s: 8, c: GRIS });
    txt("FECHA", 120, y, { b: true, s: 8, c: GRIS });
    txt("VÁLIDA HASTA", 165, y, { b: true, s: 8, c: GRIS });
    y += 5.5;
    txt($("cli-nombre").value.trim() || "—", M, y, { b: true, s: 11.5 });
    txt(fecha(hoy), 120, y, { s: 10 });
    txt(fecha(vig), 165, y, { s: 10 });
    const tel = $("cli-tel").value.trim();
    if (tel) txt(`WhatsApp ${tel}`, M, y + 5, { s: 9.5, c: GRIS });
    y += 12;
    doc.setDrawColor(...LINEA); doc.line(M, y, W - M, y);
    y += 7;

    // Pieza y detalle
    txt("TRABAJO", M, y, { b: true, s: 8, c: GRIS });
    y += 3;
    const img = st.datos ? imagenPieza() : null;
    let xDet = M;
    if (img) {
      try { doc.addImage(img, "JPEG", M, y, 76, 57); xDet = M + 84; } catch (e) {}
    }
    let yd = y + 5;
    for (const [k, v] of lineasDetalle()) {
      txt(k, xDet, yd, { s: 8.5, c: GRIS });
      const lineas = doc.splitTextToSize(limpio(v), W - M - xDet - 26);
      txt(lineas[0], xDet + 26, yd, { s: 10 });
      for (let i = 1; i < lineas.length; i++) { yd += 4.6; txt(lineas[i], xDet + 26, yd, { s: 10 }); }
      yd += 7;
    }
    y = Math.max(y + (img ? 57 : 0), yd) + 8;

    // Opciones de precio
    txt("OPCIONES", M, y, { b: true, s: 8, c: GRIS });
    y += 3;
    const ops = opcionesPrecio(r);
    const entregas = { economico: "Sin prioridad", estandar: "Tiempo normal", express: "Con prioridad" };
    doc.setFillColor(246, 248, 251); doc.rect(M, y, W - 2 * M, 8, "F");
    txt("Opción", M + 3, y + 5.4, { b: true, s: 9, c: GRIS });
    txt("Entrega", 95, y + 5.4, { b: true, s: 9, c: GRIS });
    txt("Por pieza", 145, y + 5.4, { b: true, s: 9, c: GRIS, a: "right" });
    txt(st.iva ? "Total con IVA" : "Total más IVA", W - M - 3, y + 5.4, { b: true, s: 9, c: GRIS, a: "right" });
    y += 8;
    for (const o of ops) {
      const elegida = o.id === st.elegida;
      if (elegida) { doc.setFillColor(...SUAVE); doc.rect(M, y, W - 2 * M, 11, "F"); doc.setFillColor(...NAR); doc.rect(M, y, 1.4, 11, "F"); }
      txt(o.nombre + (elegida ? "  (sugerida)" : ""), M + 4, y + 7, { b: elegida, s: 10.5, c: elegida ? NAR : [19, 26, 37] });
      txt(entregas[o.id], 95, y + 7, { s: 9.5, c: GRIS });
      txt(dinero(o.total / st.cantidad), 145, y + 7, { s: 10, a: "right" });
      txt(dinero(o.total), W - M - 3, y + 7, { b: true, s: 11.5, a: "right" });
      doc.setDrawColor(...LINEA); doc.line(M, y + 11, W - M, y + 11);
      y += 11;
    }
    y += 5;
    txt(st.iva ? `Precios en pesos mexicanos con IVA (${conf.costos.ivaPct}%) incluido.` : "Precios en pesos mexicanos más IVA.", M, y, { s: 9, c: GRIS });
    y += 9;

    // Nota y condiciones
    const bloque = (titulo, texto) => {
      if (!texto) return;
      txt(titulo, M, y, { b: true, s: 8, c: GRIS }); y += 5;
      const ls = doc.splitTextToSize(limpio(texto), W - 2 * M);
      doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(19, 26, 37);
      doc.text(ls, M, y); y += ls.length * 4.4 + 5;
    };
    bloque("NOTA", $("cli-nota").value.trim());
    bloque("CONDICIONES", conf.taller.condiciones);

    // Pie
    doc.setDrawColor(...LINEA); doc.line(M, 262, W - M, 262);
    txt("Para confirmar, responde por WhatsApp con la opción que prefieres.", M, 268, { s: 9, c: GRIS });
    if (conMarca || MODO === "local") txt("Hecha con HetNa Cotizador · hetnacnc.com", W - M, 268, { s: 8.5, c: NAR, a: "right" });

    const blob = doc.output("blob");
    const nombre = `Cotizacion-${folio || "HetNa"}.pdf`;
    if (!enArtifact) {
      // En la pagina: compartir directo (celular) o descargar
      try {
        const archivo = new File([blob], nombre, { type: "application/pdf" });
        if (navigator.canShare && navigator.canShare({ files: [archivo] })) { await navigator.share({ files: [archivo], title: nombre }); return; }
      } catch (e) { if (e && e.name === "AbortError") return; }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
      aviso("PDF descargado. Compártelo por WhatsApp.");
      return;
    }
    try {
      await dl.save({ filename: nombre, data: blob });
      aviso("PDF listo. Compártelo por WhatsApp desde tus descargas.");
    } catch (e) {
      const code = e && e.code;
      if (code === "declined") return;
      if (code === "rate_limited") { aviso("Ya hay una descarga pendiente. Intenta en un momento."); return; }
      aviso("No se pudo descargar el PDF en esta vista.");
    }
  };
  $("btn-pdf").addEventListener("click", generarPDF);

  // Pestañas
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((x) => x.setAttribute("aria-selected", x === t));
    const v = t.dataset.vista;
    $("vista-cotizar").hidden = v !== "cotizar"; $("vista-historial").hidden = v !== "historial"; $("vista-taller").hidden = v !== "taller";
    if (v === "historial") pintarHist();
    if (v === "taller") pintarTaller();
    if (v === "cotizar") { pintarTrabajo(); if (st.datos) requestAnimationFrame(dibujar); }
    window.scrollTo(0, 0);
  }));

  let tAviso = null;
  const aviso = (t) => { const el = $("toast"); el.textContent = t; el.hidden = false; clearTimeout(tAviso); tAviso = setTimeout(() => (el.hidden = true), 2600); };

  // ---------- Cuenta, plan y ventanas ----------
  const NOMBRE_PLAN = { prueba: "Prueba Pro", gratis: "Plan Gratis", taller: "Plan Taller", pro: "Plan Pro", industrial: "Plan Industrial" };
  const pintarCuenta = () => {
    const b = $("banner-plan");
    if (MODO === "local") { b.hidden = true; return; }
    b.hidden = false;
    let texto = "", boton = "Ver planes", accion = "planes", cls = "";
    if (MODO === "demo") { texto = "Estás probando sin cuenta. Calcula todo lo que quieras; para guardar, enviar o sacar PDF crea tu cuenta gratis."; boton = "Crear cuenta gratis"; accion = "registro"; }
    else if (cuenta.plan === "prueba") texto = `Prueba Pro: te quedan ${cuenta.pruebaDias} ${cuenta.pruebaDias === 1 ? "día" : "días"} con todo abierto.`;
    else if (cuenta.plan === "gratis") { texto = `Plan Gratis: llevas ${cuenta.usadas} de ${cuenta.limite} cotizaciones este mes.`; if (cuenta.usadas >= (cuenta.limite || 10) - 2) cls = "warn"; }
    else { texto = `${NOMBRE_PLAN[cuenta.plan] || "Tu plan"} activo.`; boton = ""; }
    b.className = "banner " + cls;
    b.innerHTML = `<span>${esc(texto)}</span>${boton ? `<button type="button" class="btn chico ${accion === "registro" ? "primario" : ""}" data-modal="${accion}">${boton}</button>` : ""}`;
  };
  const PLANES = [
    ["Taller", "$299/mes", "Cotizaciones ilimitadas, PDF con tu logo y sin marca, historial ilimitado."],
    ["Pro", "$599/mes", "Todo lo de Taller y, muy pronto, órdenes de trabajo, inventario, máquinas y reportes."],
    ["Industrial", "$1,199/mes", "Todo lo de Pro, usuarios ilimitados y, pronto, facturación electrónica."],
  ];
  const abrirModal = (tipo) => {
    const tel = (PUENTE && PUENTE.whatsappHetna) || "522461217072";
    const quien = cuenta.correo ? ` Mi cuenta: ${cuenta.correo}.` : "";
    const planes = PLANES.map(([n, p, d]) => `<div class="plan"><div><b>${n}</b> <span class="precio">${p}</span><p class="ayuda">${d}</p></div><a class="btn chico primario" target="_blank" rel="noopener" href="https://wa.me/${tel}?text=${encodeURIComponent(`Hola HETNA CNC, quiero contratar el plan ${n} de HetNa Taller.${quien}`)}">Contratar</a></div>`).join("");
    let h = "";
    if (tipo === "registro") h = `<h3>Crea tu cuenta gratis</h3><p>Guarda tus tarifas, envía cotizaciones por WhatsApp y descarga el PDF. Tienes 14 días con todo abierto y luego 10 cotizaciones gratis cada mes, sin tarjeta.</p><div class="fila-btn"><button class="btn primario" type="button" data-ir="registro">Crear cuenta gratis</button><button class="btn" type="button" data-ir="entrar">Ya tengo cuenta</button></div>`;
    else if (tipo === "limite") h = `<h3>Llegaste a tus ${cuenta.limite || 10} cotizaciones de este mes</h3><p>Puedes seguir calculando precios. Para guardar, enviar o sacar el PDF, cambia de plan o espera al próximo mes.</p>${planes}<p class="ayuda">El pago en línea llega muy pronto; por ahora te atendemos por WhatsApp.</p>`;
    else h = `<h3>Planes de HetNa Taller</h3>${planes}<p class="ayuda">El pago en línea con Mercado Pago y PayPal llega muy pronto; por ahora te atendemos por WhatsApp.</p>`;
    $("modal-cuerpo").innerHTML = h;
    $("modal").hidden = false;
  };
  $("modal").addEventListener("click", (e) => {
    if (e.target.id === "modal" || e.target.closest("[data-cerrar]")) { $("modal").hidden = true; return; }
    const ir = e.target.closest("[data-ir]");
    if (ir && PUENTE) PUENTE.irA(ir.dataset.ir);
  });
  $("banner-plan").addEventListener("click", (e) => { const b = e.target.closest("[data-modal]"); if (b) abrirModal(b.dataset.modal); });
  if (PUENTE) {
    const v = $("volver-tienda");
    v.hidden = false;
    v.addEventListener("click", () => PUENTE.irA(MODO === "demo" ? "cerrar" : "tienda"));
    v.textContent = MODO === "demo" ? "Cerrar" : "Tienda";
  }

  // Arranque: abre con el ejemplo 2D cargado para mostrar cómo funciona
  const arrancar = () => {
    $("pill-taller").textContent = conf.taller.nombre;
    if (MODO !== "cuenta") $("cli-nombre").value = "Cliente de ejemplo";
    pintarCuenta();
    cargarArchivo("placa-montaje-ejemplo.dxf", EJEMPLOS.dxf());
  };
  if (MODO === "cuenta") {
    Promise.resolve(PUENTE.cargar()).then((d) => {
      if (d && d.ok) {
        const base = inicial(), c = d.config || {};
        conf = {
          ...base, ...c,
          taller: { ...base.taller, nombre: c.taller?.nombre || base.taller.nombre, ...(c.taller || {}) },
          costos: { ...DATOS.costos, ...(c.costos || {}) },
          tarifas: Object.fromEntries(Object.entries(base.tarifas).map(([k, v]) => [k, { ...v, ...((c.tarifas || {})[k] || {}) }])),
          materiales: { ...base.materiales, ...(c.materiales || {}) },
          historial: d.historial || [],
        };
        Object.assign(cuenta, d.cuenta);
      } else if (d && d.motivo === "sin_sesion") {
        abrirModal("registro");
      }
      arrancar();
    }).catch(() => { aviso("No se pudo abrir tu cuenta. Revisa tu conexión."); arrancar(); });
  } else {
    arrancar();
  }
})();
