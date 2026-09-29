// ===== Lectura de archivos: DXF, SVG, STL, OBJ =====
// Todo se mide en el navegador del taller; nada se sube a ningun servidor.

const GEO = (() => {
  const TAU = Math.PI * 2;

  // ---------- utilidades 2D ----------
  const dist = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  const largoPolilinea = (p) => {
    let s = 0;
    for (let i = 1; i < p.pts.length; i++) s += dist(p.pts[i - 1], p.pts[i]);
    if (p.cerrada && p.pts.length > 2) s += dist(p.pts[p.pts.length - 1], p.pts[0]);
    return s;
  };
  const arco = (cx, cy, r, a0, a1, pasos) => {
    const n = pasos || Math.max(8, Math.ceil((Math.abs(a1 - a0) / TAU) * 72));
    const pts = [];
    for (let k = 0; k <= n; k++) {
      const a = a0 + ((a1 - a0) * k) / n;
      pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
    return pts;
  };
  const bulge = (p1, p2, b) => {
    const th = 4 * Math.atan(b);
    const dx = p2[0] - p1[0], dy = p2[1] - p1[1];
    const c = Math.hypot(dx, dy);
    if (c === 0 || Math.abs(b) < 1e-9) return [p2];
    const r = c / (2 * Math.sin(th / 2));
    const h = r * Math.cos(th / 2);
    const mx = (p1[0] + p2[0]) / 2, my = (p1[1] + p2[1]) / 2;
    const cx = mx + (-dy / c) * h, cy = my + (dx / c) * h;
    const a1 = Math.atan2(p1[1] - cy, p1[0] - cx);
    const n = Math.max(2, Math.ceil(Math.abs(th) / (Math.PI / 36)));
    const pts = [];
    for (let k = 1; k <= n; k++) {
      const a = a1 + (th * k) / n;
      pts.push([cx + Math.abs(r) * Math.cos(a), cy + Math.abs(r) * Math.sin(a)]);
    }
    return pts;
  };

  // B-spline (de Boor), racional si trae pesos
  const bspline = (ctrl, grado, nudos, pesos) => {
    const n = ctrl.length;
    if (n < 2) return ctrl.slice();
    const p = Math.min(grado || 3, n - 1);
    let U = nudos && nudos.length === n + p + 1 ? nudos : null;
    if (!U) {
      U = [];
      for (let i = 0; i <= n + p; i++) U.push(i <= p ? 0 : i >= n ? 1 : (i - p) / (n - p));
    }
    const w = pesos && pesos.length === n ? pesos : ctrl.map(() => 1);
    const t0 = U[p], t1 = U[n];
    const muestras = Math.min(400, Math.max(24, n * 12));
    const pts = [];
    for (let s = 0; s <= muestras; s++) {
      let t = t0 + ((t1 - t0) * s) / muestras;
      if (t >= t1) t = t1 - 1e-9;
      let k = p;
      while (k < n - 1 && U[k + 1] <= t) k++;
      const d = [];
      for (let j = 0; j <= p; j++) {
        const c = ctrl[j + k - p], ww = w[j + k - p];
        d.push([c[0] * ww, c[1] * ww, ww]);
      }
      for (let r = 1; r <= p; r++) {
        for (let j = p; j >= r; j--) {
          const i = j + k - p;
          const den = U[i + p - r + 1] - U[i];
          const a = den === 0 ? 0 : (t - U[i]) / den;
          d[j] = [
            (1 - a) * d[j - 1][0] + a * d[j][0],
            (1 - a) * d[j - 1][1] + a * d[j][1],
            (1 - a) * d[j - 1][2] + a * d[j][2],
          ];
        }
      }
      pts.push([d[p][0] / d[p][2], d[p][1] / d[p][2]]);
    }
    return pts;
  };

  // Une trazos abiertos que comparten extremos para contar contornos (perforaciones)
  const contarContornos = (polis, tol) => {
    const padre = polis.map((_, i) => i);
    const raiz = (i) => (padre[i] === i ? i : (padre[i] = raiz(padre[i])));
    const unir = (a, b) => { a = raiz(a); b = raiz(b); if (a !== b) padre[a] = b; };
    const celda = new Map();
    const clave = (pt) => Math.round(pt[0] / tol) + "," + Math.round(pt[1] / tol);
    polis.forEach((p, i) => {
      if (p.cerrada || p.pts.length < 2) return;
      for (const pt of [p.pts[0], p.pts[p.pts.length - 1]]) {
        const k = clave(pt);
        if (celda.has(k)) unir(i, celda.get(k));
        else celda.set(k, i);
      }
    });
    const grupos = new Set();
    polis.forEach((p, i) => { if (p.pts.length >= 2) grupos.add(raiz(i)); });
    return grupos.size;
  };

  const caja2D = (polis) => {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const p of polis) for (const [x, y] of p.pts) {
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    return { x0, y0, x1, y1 };
  };

  // ---------- DXF ----------
  const UNIDADES_DXF = { 1: 25.4, 2: 304.8, 4: 1, 5: 10, 6: 1000, 13: 0.001 };

  const leerDXF = (texto) => {
    if (/^AutoCAD Binary DXF/.test(texto)) throw new Error("Este DXF está en formato binario. Guárdalo como DXF de texto (ASCII) y vuelve a subirlo.");
    const lin = texto.split(/\r\n|\r|\n/);
    const pares = [];
    for (let i = 0; i + 1 < lin.length; i += 2) {
      const c = parseInt(lin[i].trim(), 10);
      if (Number.isNaN(c)) continue;
      pares.push([c, lin[i + 1].trim()]);
    }
    let insunits = 0;
    for (let i = 0; i < pares.length - 1; i++) {
      if (pares[i][0] === 9 && pares[i][1] === "$INSUNITS") { insunits = parseInt(pares[i + 1][1], 10) || 0; break; }
    }
    // secciones BLOCKS y ENTITIES
    const bloques = {};
    const entidades = [];
    let seccion = null, bloque = null, actual = null;
    const cerrarActual = () => {
      if (!actual) return;
      if (seccion === "ENTITIES") entidades.push(actual);
      else if (seccion === "BLOCKS" && bloque && !["BLOCK", "ENDBLK"].includes(actual.tipo)) bloque.ents.push(actual);
      actual = null;
    };
    for (let i = 0; i < pares.length; i++) {
      const [c, v] = pares[i];
      if (c === 0 && v === "SECTION") { cerrarActual(); seccion = pares[i + 1] ? pares[i + 1][1] : null; i++; continue; }
      if (c === 0 && v === "ENDSEC") { cerrarActual(); seccion = null; continue; }
      if (seccion !== "ENTITIES" && seccion !== "BLOCKS") continue;
      if (c === 0) {
        cerrarActual();
        if (seccion === "BLOCKS" && v === "BLOCK") {
          bloque = { nombre: "", base: [0, 0], ents: [] };
          actual = { tipo: "BLOCK", g: [] };
          // leer cabecera del bloque
          let j = i + 1;
          while (j < pares.length && pares[j][0] !== 0) {
            if (pares[j][0] === 2) bloque.nombre = pares[j][1];
            if (pares[j][0] === 10) bloque.base[0] = parseFloat(pares[j][1]);
            if (pares[j][0] === 20) bloque.base[1] = parseFloat(pares[j][1]);
            j++;
          }
          bloques[bloque.nombre] = bloque;
          actual = null;
          i = j - 1;
          continue;
        }
        if (seccion === "BLOCKS" && v === "ENDBLK") { bloque = null; continue; }
        actual = { tipo: v, g: [] };
        continue;
      }
      if (actual) actual.g.push([c, v]);
    }
    cerrarActual();

    const ignoradas = {};
    const polis = [];

    const convertir = (lista, T, prof) => {
      for (let i = 0; i < lista.length; i++) {
        const e = lista[i];
        const g = e.g;
        const num = (code, def = 0) => { const x = g.find((q) => q[0] === code); return x ? parseFloat(x[1]) : def; };
        const agregar = (pts, cerrada) => { if (pts.length >= 2) polis.push({ pts: pts.map(T), cerrada }); };
        switch (e.tipo) {
          case "LINE":
            agregar([[num(10), num(20)], [num(11), num(21)]], false);
            break;
          case "LWPOLYLINE": {
            const flags = num(70);
            const vs = [];
            for (const [c, v] of g) {
              if (c === 10) vs.push({ x: parseFloat(v), y: 0, b: 0 });
              else if (c === 20 && vs.length) vs[vs.length - 1].y = parseFloat(v);
              else if (c === 42 && vs.length) vs[vs.length - 1].b = parseFloat(v);
            }
            const cerrada = (flags & 1) === 1;
            const pts = [];
            vs.forEach((q, k) => {
              if (k === 0) pts.push([q.x, q.y]);
              else pts.push(...bulge([vs[k - 1].x, vs[k - 1].y], [q.x, q.y], vs[k - 1].b));
            });
            if (cerrada && vs.length > 1) {
              const u = vs[vs.length - 1];
              if (Math.abs(u.b) > 1e-9) pts.push(...bulge([u.x, u.y], [vs[0].x, vs[0].y], u.b).slice(0, -1));
            }
            agregar(pts, cerrada);
            break;
          }
          case "POLYLINE": {
            const flags = num(70);
            if (flags & 16 || flags & 64) { ignoradas["Malla 3D"] = (ignoradas["Malla 3D"] || 0) + 1; while (i + 1 < lista.length && lista[i + 1].tipo !== "SEQEND") i++; i++; break; }
            const vs = [];
            while (i + 1 < lista.length && lista[i + 1].tipo === "VERTEX") {
              i++;
              const gv = lista[i].g;
              const n2 = (code) => { const x = gv.find((q) => q[0] === code); return x ? parseFloat(x[1]) : 0; };
              vs.push({ x: n2(10), y: n2(20), b: n2(42) });
            }
            if (i + 1 < lista.length && lista[i + 1].tipo === "SEQEND") i++;
            const cerrada = (flags & 1) === 1;
            const pts = [];
            vs.forEach((q, k) => {
              if (k === 0) pts.push([q.x, q.y]);
              else pts.push(...bulge([vs[k - 1].x, vs[k - 1].y], [q.x, q.y], vs[k - 1].b));
            });
            if (cerrada && vs.length > 1) {
              const u = vs[vs.length - 1];
              if (Math.abs(u.b) > 1e-9) pts.push(...bulge([u.x, u.y], [vs[0].x, vs[0].y], u.b).slice(0, -1));
            }
            agregar(pts, cerrada);
            break;
          }
          case "CIRCLE": {
            const pts = arco(num(10), num(20), num(40), 0, TAU, 72);
            pts.pop();
            agregar(pts, true);
            break;
          }
          case "ARC": {
            let a0 = (num(50) * Math.PI) / 180, a1 = (num(51) * Math.PI) / 180;
            if (a1 <= a0) a1 += TAU;
            agregar(arco(num(10), num(20), num(40), a0, a1), false);
            break;
          }
          case "ELLIPSE": {
            const cx = num(10), cy = num(20), mx = num(11), my = num(21), ratio = num(40, 1);
            let t0 = num(41, 0), t1 = num(42, TAU);
            if (t1 <= t0) t1 += TAU;
            const completa = Math.abs(t1 - t0 - TAU) < 1e-6;
            const n = Math.max(12, Math.ceil(((t1 - t0) / TAU) * 96));
            const pts = [];
            for (let k = 0; k <= n; k++) {
              const t = t0 + ((t1 - t0) * k) / n;
              pts.push([cx + mx * Math.cos(t) - ratio * my * Math.sin(t), cy + my * Math.cos(t) + ratio * mx * Math.sin(t)]);
            }
            if (completa) pts.pop();
            agregar(pts, completa);
            break;
          }
          case "SPLINE": {
            const flags = num(70);
            const grado = num(71, 3);
            const nudos = [], ctrl = [], ajuste = [], pesos = [];
            for (const [c, v] of g) {
              if (c === 40) nudos.push(parseFloat(v));
              else if (c === 41) pesos.push(parseFloat(v));
              else if (c === 10) ctrl.push([parseFloat(v), 0]);
              else if (c === 20 && ctrl.length) ctrl[ctrl.length - 1][1] = parseFloat(v);
              else if (c === 11) ajuste.push([parseFloat(v), 0]);
              else if (c === 21 && ajuste.length) ajuste[ajuste.length - 1][1] = parseFloat(v);
            }
            const pts = ctrl.length >= 2 ? bspline(ctrl, grado, nudos, pesos) : ajuste;
            agregar(pts, (flags & 1) === 1);
            break;
          }
          case "INSERT": {
            const nombre = (g.find((q) => q[0] === 2) || [0, ""])[1];
            const b = bloques[nombre];
            if (!b || prof > 4) break;
            const ix = num(10), iy = num(20), sx = num(41, 1), sy = num(42, 1), rot = (num(50) * Math.PI) / 180;
            const cs = Math.cos(rot), sn = Math.sin(rot);
            const T2 = (p) => {
              const x = (p[0] - b.base[0]) * sx, y = (p[1] - b.base[1]) * sy;
              return T([ix + x * cs - y * sn, iy + x * sn + y * cs]);
            };
            convertir(b.ents, T2, prof + 1);
            break;
          }
          case "POINT": case "SEQEND": case "VERTEX": case "ATTRIB": case "ATTDEF":
            break;
          default: {
            const nombres = { TEXT: "Textos", MTEXT: "Textos", DIMENSION: "Cotas", HATCH: "Rellenos (hatch)", LEADER: "Flechas", SOLID: "Sólidos", "3DFACE": "Caras 3D", IMAGE: "Imágenes" };
            const k = nombres[e.tipo] || e.tipo;
            ignoradas[k] = (ignoradas[k] || 0) + 1;
          }
        }
      }
    };
    convertir(entidades, (p) => p, 0);
    if (!polis.length) throw new Error("No encontré líneas de corte en este DXF. Revisa que el dibujo no esté vacío o solo tenga textos.");
    return { tipo: "2d", formato: "DXF", polis, unidadSugerida: UNIDADES_DXF[insunits] || null, insunits, ignoradas };
  };

  // ---------- SVG (usa el motor del navegador) ----------
  const UNIDAD_CSS = { mm: 1, cm: 10, in: 25.4, pt: 25.4 / 72, pc: 25.4 / 6, px: 25.4 / 96, "": 25.4 / 96 };
  const leerSVG = (texto, host) => {
    const doc = new DOMParser().parseFromString(texto, "image/svg+xml");
    const raiz = doc.documentElement;
    if (!raiz || raiz.nodeName.toLowerCase() !== "svg" || doc.getElementsByTagName("parsererror").length) {
      throw new Error("Este SVG no se pudo leer. Ábrelo en tu programa de diseño y guárdalo de nuevo como SVG.");
    }
    host.innerHTML = "";
    const svg = document.importNode(raiz, true);
    svg.querySelectorAll("script,foreignObject").forEach((n) => n.remove());
    host.appendChild(svg);
    // milimetros por unidad de usuario
    let mmPorUnidad = 25.4 / 96;
    const w = (raiz.getAttribute("width") || "").trim();
    const m = w.match(/^([\d.]+)\s*(mm|cm|in|pt|pc|px)?$/i);
    const vb = svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width ? svg.viewBox.baseVal : null;
    if (m) {
      const ancho_mm = parseFloat(m[1]) * UNIDAD_CSS[(m[2] || "").toLowerCase()];
      mmPorUnidad = vb ? ancho_mm / vb.width : UNIDAD_CSS[(m[2] || "").toLowerCase()];
    }
    const inv = svg.getScreenCTM() ? svg.getScreenCTM().inverse() : null;
    const polis = [];
    let subtrayectos = 0;
    const formas = svg.querySelectorAll("path,line,polyline,polygon,rect,circle,ellipse");
    formas.forEach((el) => {
      if (el.closest("defs,clipPath,mask,symbol,marker,pattern")) return;
      let L = 0;
      try { L = el.getTotalLength(); } catch (e) { return; }
      if (!(L > 0) || !inv) return;
      const M = inv.multiply(el.getScreenCTM());
      const n = Math.min(900, Math.max(12, Math.ceil(L / 1.5)));
      const paso = L / n;
      let actual = [];
      let previo = null;
      const cerradaForma = ["polygon", "rect", "circle", "ellipse"].includes(el.nodeName.toLowerCase());
      for (let k = 0; k <= n; k++) {
        const q = el.getPointAtLength(Math.min(L, k * paso));
        if (previo && Math.hypot(q.x - previo.x, q.y - previo.y) > paso * 1.6) {
          if (actual.length >= 2) polis.push({ pts: actual, cerrada: false });
          actual = [];
        }
        actual.push([M.a * q.x + M.c * q.y + M.e, M.b * q.x + M.d * q.y + M.f]);
        previo = q;
      }
      if (actual.length >= 2) polis.push({ pts: actual, cerrada: cerradaForma });
      if (el.nodeName.toLowerCase() === "path") subtrayectos += ((el.getAttribute("d") || "").match(/[Mm]/g) || []).length;
    });
    host.innerHTML = "";
    if (!polis.length) throw new Error("No encontré trazos en este SVG. Si tiene textos, conviértelos a curvas antes de exportar.");
    // SVG tiene Y hacia abajo: se invierte para dibujar igual que en CAD
    polis.forEach((p) => p.pts.forEach((pt) => (pt[1] = -pt[1])));
    return { tipo: "2d", formato: "SVG", polis, unidadSugerida: mmPorUnidad, ignoradas: {} };
  };

  // Resumen 2D en milimetros
  const medir2D = (datos, mmPorUnidad) => {
    const f = mmPorUnidad;
    const c = caja2D(datos.polis);
    const anchoU = c.x1 - c.x0, altoU = c.y1 - c.y0;
    const tol = Math.max(1e-6, Math.hypot(anchoU, altoU) * 1e-5);
    let largo = 0;
    for (const p of datos.polis) largo += largoPolilinea(p);
    return {
      tipo: "2d",
      largoMm: anchoU * f,
      anchoMm: altoU * f,
      corteMm: largo * f,
      perforaciones: contarContornos(datos.polis, tol),
      trazos: datos.polis.length,
      caja: c,
    };
  };

  // ---------- STL / OBJ ----------
  const leerSTL = (buf) => {
    const dv = new DataView(buf);
    let tris;
    const esBinario = buf.byteLength >= 84 && 84 + dv.getUint32(80, true) * 50 === buf.byteLength;
    if (esBinario) {
      const n = dv.getUint32(80, true);
      tris = new Float32Array(n * 9);
      for (let i = 0; i < n; i++) {
        const o = 84 + i * 50 + 12;
        for (let j = 0; j < 9; j++) tris[i * 9 + j] = dv.getFloat32(o + j * 4, true);
      }
    } else {
      const texto = new TextDecoder().decode(buf);
      const re = /vertex\s+([-+\d.eE]+)\s+([-+\d.eE]+)\s+([-+\d.eE]+)/g;
      const v = [];
      let m;
      while ((m = re.exec(texto))) v.push(+m[1], +m[2], +m[3]);
      tris = new Float32Array(v.length - (v.length % 9));
      tris.set(v.slice(0, tris.length));
    }
    if (!tris.length) throw new Error("Este STL no tiene triángulos. Exporta de nuevo la pieza desde tu programa 3D.");
    return { tipo: "3d", formato: "STL", tris };
  };

  const leerOBJ = (texto) => {
    const vs = [];
    const t = [];
    for (const lin of texto.split(/\r?\n/)) {
      const s = lin.trim();
      if (s.startsWith("v ")) {
        const [, x, y, z] = s.split(/\s+/);
        vs.push([+x, +y, +z]);
      } else if (s.startsWith("f ")) {
        const idx = s.split(/\s+/).slice(1).map((tok) => {
          const k = parseInt(tok.split("/")[0], 10);
          return k < 0 ? vs.length + k : k - 1;
        });
        for (let k = 1; k + 1 < idx.length; k++) {
          const a = vs[idx[0]], b = vs[idx[k]], c = vs[idx[k + 1]];
          if (a && b && c) t.push(...a, ...b, ...c);
        }
      }
    }
    if (!t.length) throw new Error("Este OBJ no tiene caras. Exporta la pieza como malla (con caras) desde tu programa 3D.");
    return { tipo: "3d", formato: "OBJ", tris: new Float32Array(t) };
  };

  const medir3D = (datos, mmPorUnidad) => {
    const t = datos.tris, f = mmPorUnidad;
    let vol = 0, area = 0;
    let x0 = Infinity, y0 = Infinity, z0 = Infinity, x1 = -Infinity, y1 = -Infinity, z1 = -Infinity;
    for (let i = 0; i < t.length; i += 9) {
      const ax = t[i], ay = t[i + 1], az = t[i + 2];
      const bx = t[i + 3], by = t[i + 4], bz = t[i + 5];
      const cx = t[i + 6], cy = t[i + 7], cz = t[i + 8];
      vol += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx - ax, vy = cy - ay, vz = cz - az;
      area += Math.hypot(uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx) / 2;
      for (const [x, y, z] of [[ax, ay, az], [bx, by, bz], [cx, cy, cz]]) {
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; if (z < z0) z0 = z; if (z > z1) z1 = z;
      }
    }
    return {
      tipo: "3d",
      largoMm: (x1 - x0) * f,
      anchoMm: (y1 - y0) * f,
      altoMm: (z1 - z0) * f,
      volumenCm3: (Math.abs(vol) * f * f * f) / 1000,
      areaCm2: (area * f * f) / 100,
      triangulos: t.length / 9,
      cerrada: Math.abs(vol) > 1e-9,
      caja: { x0, y0, z0, x1, y1, z1 },
    };
  };

  return { leerDXF, leerSVG, leerSTL, leerOBJ, medir2D, medir3D, _bulge: bulge };
})();
if (typeof module !== "undefined") module.exports = GEO;
