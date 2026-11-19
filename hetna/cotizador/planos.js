// ===== HetNa Cotizador: juego de planos en PDF =====
// Hoja 1: lista de corte (piezas, cantidades, medidas, corte o volumen, totales).
// Una hoja por pieza: dibujo a escala con cotas generales y cuadro de datos.
//   · 2D: contornos del archivo; los barrenos redondos se marcan y se agrupan
//     por diámetro ("4× Ø5").
//   · 3D: tres vistas (planta, frente y lateral) a la misma escala, sombreadas.
// Son planos ilustrativos hechos del archivo: sirven para cotizar, revisar y
// armar; no sustituyen al plano de ingeniería.
const PLANOS = (() => {
  const W = 215.9, H = 279.4, M = 12;
  const NAVY = [20, 32, 51], NAR = [194, 86, 10], GRIS = [90, 101, 118], LINEA = [216, 222, 231], TINTA = [19, 26, 37];
  const ESCALAS = [10, 5, 4, 2, 1, 1 / 2, 1 / 2.5, 1 / 5, 1 / 10, 1 / 20, 1 / 25, 1 / 50, 1 / 100, 1 / 200, 1 / 500];
  const nombreEscala = (k) => (k >= 1 ? `${Math.round(k * 10) / 10}:1` : `1:${Math.round((1 / k) * 10) / 10}`);
  const fmt = (n, d = 1) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString("es-MX", { maximumFractionDigits: d });
  const limpio = (t) => String(t ?? "").replace(/·/g, "-").replace(/³/g, "3").replace(/²/g, "2").replace(/[^\x00-\xFF]/g, "");

  /** La escala normal más grande con la que la pieza cabe en el área. */
  const escalaPara = (anchoMm, altoMm, areaW, areaH) => {
    const max = Math.min(areaW / Math.max(anchoMm, 1e-6), areaH / Math.max(altoMm, 1e-6));
    return ESCALAS.find((k) => k <= max) || max;
  };

  // ---------- 2D ----------
  // Barrenos: contornos cerrados casi circulares (caja cuadrada y área ≈ π r²)
  const barrenos = (polis, f) => {
    const out = [];
    for (const p of polis) {
      if (!p.cerrada || p.pts.length < 8) continue;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, a = 0;
      for (let i = 0; i < p.pts.length; i++) {
        const [x, y] = p.pts[i], [u, v] = p.pts[(i + 1) % p.pts.length];
        x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
        a += x * v - u * y;
      }
      const w = x1 - x0, h = y1 - y0;
      if (!(w > 0) || Math.abs(w - h) / w > 0.04) continue;
      const circ = Math.PI * (w / 2) ** 2;
      if (Math.abs(Math.abs(a / 2) - circ) / circ > 0.06) continue;
      out.push({ cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, d: ((w + h) / 2) * f });
    }
    return out;
  };

  // ---------- 3D: vista sombreada en un lienzo ----------
  // vista: [eje horizontal, eje vertical, eje de profundidad (hacia el observador)]
  const VISTAS = { planta: [0, 1, 2], frente: [0, 2, -1], lateral: [1, 2, 0] };
  const pintarVista = (tris, f, vista, caja, px) => {
    const [ih, iv, ip] = vista;
    const prof = Math.abs(ip), signo = ip < 0 || Object.is(ip, -0) ? -1 : 1;
    const ancho = (caja.max[ih] - caja.min[ih]) * f, alto = (caja.max[iv] - caja.min[iv]) * f;
    const cw = Math.max(2, Math.round(ancho * px)), ch = Math.max(2, Math.round(alto * px));
    const cv = document.createElement("canvas");
    cv.width = cw; cv.height = ch;
    const g = cv.getContext("2d");
    g.fillStyle = "#ffffff"; g.fillRect(0, 0, cw, ch);
    const n = tris.length / 9;
    const orden = new Uint32Array(n).map((_, i) => i);
    const dz = new Float32Array(n);
    for (let i = 0; i < n; i++) dz[i] = signo * (tris[i * 9 + prof] + tris[i * 9 + 3 + prof] + tris[i * 9 + 6 + prof]);
    orden.sort((a, b) => dz[a] - dz[b]); // de atrás hacia adelante
    const X = (v) => (v - caja.min[ih]) * f * px, Y = (v) => ch - (v - caja.min[iv]) * f * px;
    for (const i of orden) {
      const o = i * 9;
      const ux = tris[o + 3] - tris[o], uy = tris[o + 4] - tris[o + 1], uz = tris[o + 5] - tris[o + 2];
      const vx = tris[o + 6] - tris[o], vy = tris[o + 7] - tris[o + 1], vz = tris[o + 8] - tris[o + 2];
      const nn = [uy * vz - uz * vy, uz * vx - ux * vz, ux * vy - uy * vx];
      const l = Math.hypot(nn[0], nn[1], nn[2]) || 1;
      const luz = Math.abs(nn[prof] / l) * 0.75 + Math.abs(nn[iv] / l) * 0.15;
      const c = Math.round(118 + 112 * Math.min(1, luz));
      g.fillStyle = g.strokeStyle = `rgb(${c},${c},${Math.min(255, c + 6)})`;
      g.beginPath();
      g.moveTo(X(tris[o + ih]), Y(tris[o + iv]));
      g.lineTo(X(tris[o + 3 + ih]), Y(tris[o + 3 + iv]));
      g.lineTo(X(tris[o + 6 + ih]), Y(tris[o + 6 + iv]));
      g.closePath(); g.fill(); g.lineWidth = 0.6; g.stroke();
    }
    // contorno de la silueta: se oscurece el borde con un trazo del canal alfa
    return { url: cv.toDataURL("image/png"), ancho, alto };
  };
  const cajaTris = (tris) => {
    const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < tris.length; i += 3) for (let e = 0; e < 3; e++) { const v = tris[i + e]; if (v < min[e]) min[e] = v; if (v > max[e]) max[e] = v; }
    return { min, max };
  };

  function generar(J, piezas, info) {
    const doc = new J({ unit: "mm", format: "letter" });
    const txt = (t, x, y, o = {}) => { doc.setFont("helvetica", o.b ? "bold" : "normal"); doc.setFontSize(o.s || 10); doc.setTextColor(...(o.c || TINTA)); doc.text(limpio(t), x, y, { ...(o.a ? { align: o.a } : {}), ...(o.ang ? { angle: o.ang } : {}) }); };
    const total = piezas.length + 1;
    const hoy = new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });

    const encabezado = (titulo, hoja) => {
      doc.setFillColor(...NAVY); doc.rect(0, 0, W, 18, "F");
      txt(info.taller, M, 11.5, { b: true, s: 12, c: [255, 255, 255] });
      txt(titulo, W - M, 8.5, { b: true, s: 10.5, c: NAR, a: "right" });
      txt(`${info.proyecto}${info.folio ? " · " + info.folio : ""} · Hoja ${hoja} de ${total}`, W - M, 14, { s: 8.5, c: [201, 210, 224], a: "right" });
    };
    const pie = () => {
      doc.setDrawColor(...LINEA); doc.line(M, H - 12, W - M, H - 12);
      txt("Plano ilustrativo hecho del archivo. Medidas en milímetros. Verifica contra el archivo antes de fabricar.", M, H - 7, { s: 7.5, c: GRIS });
      if (info.marca) txt("Hecho con HetNa Cotizador · hetnacnc.com", W - M, H - 7, { s: 7.5, c: NAR, a: "right" });
    };
    // cota: línea con remates y texto centrado (horizontal o vertical)
    const cota = (x1, y1, x2, y2, texto, vertical) => {
      doc.setDrawColor(...NAR); doc.setLineWidth(0.25);
      doc.line(x1, y1, x2, y2);
      const r = 1.6;
      if (vertical) { doc.line(x1 - r, y1, x1 + r, y1); doc.line(x2 - r, y2, x2 + r, y2); txt(texto, x1 - 1.6, (y1 + y2) / 2, { s: 8.5, c: NAR, a: "center", ang: 90 }); }
      else { doc.line(x1, y1 - r, x1, y1 + r); doc.line(x2, y2 - r, x2, y2 + r); txt(texto, (x1 + x2) / 2, y1 - 1.4, { s: 8.5, c: NAR, a: "center" }); }
      doc.setLineWidth(0.2);
    };

    // ----- Hoja 1: lista de corte -----
    encabezado("LISTA DE CORTE", 1);
    let y = 28;
    txt("PROYECTO", M, y, { b: true, s: 8, c: GRIS }); txt("SERVICIO", 95, y, { b: true, s: 8, c: GRIS }); txt("FECHA", 160, y, { b: true, s: 8, c: GRIS });
    y += 5;
    txt(info.proyecto, M, y, { b: true, s: 11 }); txt(info.servicio || "—", 95, y, { s: 10 }); txt(hoy, 160, y, { s: 10 });
    y += 5;
    if (info.material) txt(`Material: ${info.material}`, M, y, { s: 9.5, c: GRIS });
    if (info.juegos > 1) txt(`Juegos completos: ${info.juegos} (las cantidades ya los incluyen)`, 95, y, { s: 9.5, c: GRIS });
    y += 8;
    const es2D = piezas[0] && piezas[0].medidas.tipo === "2d";
    const cols = es2D ? [["#", M + 2], ["Pieza", M + 9], ["Cant.", 102, "right"], ["Medidas (mm)", 106], ["Corte", 168, "right"], ["Barrenos", W - M - 2, "right"]]
      : [["#", M + 2], ["Pieza", M + 9], ["Cant.", 102, "right"], ["Medidas (mm)", 106], ["Volumen", W - M - 2, "right"]];
    const filaTitulos = () => {
      doc.setFillColor(246, 248, 251); doc.rect(M, y, W - 2 * M, 7, "F");
      for (const [t, x, a] of cols) txt(t, x, y + 4.8, { b: true, s: 8.5, c: GRIS, a });
      y += 7;
    };
    filaTitulos();
    let tCorte = 0, tArea = 0, tVol = 0, tPiezas = 0, tBarr = 0;
    piezas.forEach((p, i) => {
      if (y > H - 30) { pie(); doc.addPage(); encabezado("LISTA DE CORTE (sigue)", 1); y = 28; filaTitulos(); }
      const m = p.medidas, q = p.cantidad;
      const nb = es2D ? barrenos(p.datos.polis, p.mmPorUnidad).length : 0;
      txt(String(i + 1), M + 2, y + 4.3, { s: 9, c: GRIS });
      txt(doc.splitTextToSize(limpio(p.nombre), 78)[0], M + 9, y + 4.3, { s: 9 });
      txt(String(q), 102, y + 4.3, { s: 9, a: "right" });
      txt(m.tipo === "2d" ? `${fmt(m.largoMm)} x ${fmt(m.anchoMm)}` : `${fmt(m.largoMm)} x ${fmt(m.anchoMm)} x ${fmt(m.altoMm)}`, 106, y + 4.3, { s: 9 });
      if (es2D) { txt(`${fmt(m.corteMm / 1000, 2)} m`, 168, y + 4.3, { s: 9, a: "right" }); txt(nb ? String(nb) : "—", W - M - 2, y + 4.3, { s: 9, a: "right" }); }
      else txt(`${fmt(m.volumenCm3, 1)} cm3`, W - M - 2, y + 4.3, { s: 9, a: "right" });
      doc.setDrawColor(...LINEA); doc.line(M, y + 6, W - M, y + 6);
      y += 6;
      tPiezas += q; tCorte += (m.corteMm || 0) * q; tArea += (m.largoMm * m.anchoMm * q) / 1e6; tVol += (m.volumenCm3 || 0) * q; tBarr += nb * q;
    });
    y += 6;
    const resumen = es2D
      ? [["Piezas", String(tPiezas)], ["Corte total", `${fmt(tCorte / 1000, 2)} m`], ["Lámina (sin anidar)", `${fmt(tArea, 3)} m2`], ["Barrenos", String(tBarr)]]
      : [["Piezas", String(tPiezas)], ["Volumen total", `${fmt(tVol, 1)} cm3`], ["Filamento aprox. (PLA, 20%)", `${fmt(tVol * 0.2 * 1.24, 0)} g`]];
    resumen.forEach(([k, v], i) => {
      const x = M + i * ((W - 2 * M) / resumen.length);
      doc.setFillColor(246, 248, 251); doc.roundedRect(x, y, (W - 2 * M) / resumen.length - 3, 15, 2, 2, "F");
      txt(k, x + 3, y + 5.5, { s: 8, c: GRIS }); txt(v, x + 3, y + 11.5, { b: true, s: 11 });
    });
    if (info.nota) { y += 23; txt("NOTA", M, y, { b: true, s: 8, c: GRIS }); const ls = doc.splitTextToSize(limpio(info.nota), W - 2 * M); doc.setFont("helvetica", "normal"); doc.setFontSize(9.5); doc.setTextColor(...TINTA); doc.text(ls, M, y + 5); }
    pie();

    // ----- Una hoja por pieza -----
    const area = { x: M + 8, y: 30, w: W - 2 * M - 16, h: 175 };
    piezas.forEach((p, i) => {
      doc.addPage();
      encabezado("PLANO DE PIEZA", i + 2);
      txt(p.nombre, M, 26, { b: true, s: 12 });
      const m = p.medidas, f = p.mmPorUnidad;
      let escala = 1, notas = [];
      if (m.tipo === "2d") {
        const c = m.caja;
        escala = escalaPara(m.largoMm, m.anchoMm, area.w, area.h - 10);
        const dw = m.largoMm * escala, dh = m.anchoMm * escala;
        const ox = area.x + (area.w - dw) / 2, oy = area.y + 8 + (area.h - 10 - dh) / 2 + dh;
        const X = (x) => ox + (x - c.x0) * f * escala, Y = (yy) => oy - (yy - c.y0) * f * escala;
        doc.setDrawColor(...TINTA); doc.setLineWidth(0.25);
        for (const pl of p.datos.polis) {
          const pts = pl.pts, paso = Math.max(1, Math.floor(pts.length / 1500));
          for (let j = paso; j < pts.length; j += paso) doc.line(X(pts[j - paso][0]), Y(pts[j - paso][1]), X(pts[j][0]), Y(pts[j][1]));
          if (pl.cerrada && pts.length > 1) doc.line(X(pts[pts.length - 1][0]), Y(pts[pts.length - 1][1]), X(pts[0][0]), Y(pts[0][1]));
        }
        cota(ox, oy + 7, ox + dw, oy + 7, `${fmt(m.largoMm)}`);
        cota(ox - 7, oy, ox - 7, oy - dh, `${fmt(m.anchoMm)}`, true);
        const bs = barrenos(p.datos.polis, f);
        doc.setDrawColor(...NAR); doc.setLineWidth(0.15);
        for (const b of bs) { const x = X(b.cx), yy = Y(b.cy), r = Math.max(1.2, (b.d * escala) / 2 + 1); doc.line(x - r, yy, x + r, yy); doc.line(x, yy - r, x, yy + r); }
        const grupos = {};
        for (const b of bs) { const k = fmt(b.d, 1); grupos[k] = (grupos[k] || 0) + 1; }
        notas = Object.entries(grupos).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${n}× barreno Ø${d}`);
        notas.unshift(`Corte: ${fmt(m.corteMm / 1000, 2)} m · ${m.perforaciones} perforaciones`);
      } else {
        const tris = p.datos.tris, caja = cajaTris(tris);
        const L = m.largoMm, A = m.anchoMm, Hh = m.altoMm; // X, Y, Z
        // planta (L x A) arriba, frente (L x H) abajo, lateral (A x H) a la derecha del frente
        const gap = 22;
        escala = escalaPara(L + A + gap, A + Hh + gap, area.w - 16, area.h - 16);
        const pxmm = Math.min(6, 1800 / Math.max(L, A, Hh) / 1);
        const ox = area.x + 12 + (area.w - 16 - (L + A + gap) * escala) / 2, oy = area.y + 10;
        const vistas = [
          ["PLANTA", VISTAS.planta, ox, oy, L, A],
          ["FRENTE", VISTAS.frente, ox, oy + A * escala + gap * escala, L, Hh],
          ["LATERAL", VISTAS.lateral, ox + L * escala + gap * escala, oy + A * escala + gap * escala, A, Hh],
        ];
        for (const [nom, v, x, yy, w, h] of vistas) {
          const derecha = nom === "LATERAL"; // su cota vertical va a la derecha para no chocar con el frente
          const img = pintarVista(tris, f, v, caja, pxmm);
          try { doc.addImage(img.url, "PNG", x, yy, w * escala, h * escala); } catch (e) {}
          doc.setDrawColor(...TINTA); doc.setLineWidth(0.2); doc.rect(x, yy, w * escala, h * escala);
          txt(nom, x, yy - 1.5, { b: true, s: 7.5, c: GRIS });
          cota(x, yy + h * escala + 5, x + w * escala, yy + h * escala + 5, fmt(w));
          if (derecha) cota(x + w * escala + 7, yy + h * escala, x + w * escala + 7, yy, fmt(h), true);
          else cota(x - 5, yy + h * escala, x - 5, yy, fmt(h), true);
        }
        notas = [`Volumen: ${fmt(m.volumenCm3, 1)} cm3 · superficie ${fmt(m.areaCm2, 1)} cm2`];
      }
      // cuadro de datos
      const cy = H - 62;
      doc.setDrawColor(...LINEA); doc.setLineWidth(0.3); doc.rect(M, cy, W - 2 * M, 46);
      doc.line(M, cy + 23, W - M, cy + 23); doc.line(M + 62, cy, M + 62, cy + 46); doc.line(M + 124, cy, M + 124, cy + 46);
      const celda = (k, v, x, yy) => { txt(k, x + 3, yy + 5.5, { b: true, s: 7.5, c: GRIS }); txt(doc.splitTextToSize(limpio(v), 56)[0], x + 3, yy + 13, { s: 10.5 }); };
      celda("PIEZA", p.nombre, M, cy); celda("CANTIDAD", `${p.cantidad} ${p.cantidad === 1 ? "pieza" : "piezas"}`, M + 62, cy); celda("ESCALA (en carta)", nombreEscala(escala), M + 124, cy);
      celda("MATERIAL", info.material || "—", M, cy + 23); celda("MEDIDAS (mm)", m.tipo === "2d" ? `${fmt(m.largoMm)} x ${fmt(m.anchoMm)}` : `${fmt(m.largoMm)} x ${fmt(m.anchoMm)} x ${fmt(m.altoMm)}`, M + 62, cy + 23); celda("TALLER · FECHA", `${info.taller} · ${hoy}`, M + 124, cy + 23);
      notas.slice(0, 3).forEach((n, k) => txt(n, M, cy - 10 + k * 4.6 - (notas.length - 1) * 4.6, { s: 8.5, c: GRIS }));
      pie();
    });
    return doc;
  }

  return { generar, barrenos, escalaPara, nombreEscala };
})();
if (typeof module !== "undefined") module.exports = PLANOS;
