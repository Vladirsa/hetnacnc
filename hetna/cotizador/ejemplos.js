// Archivos de ejemplo generados en el momento (no son de ningun cliente)
const EJEMPLOS = (() => {
  // Placa de montaje 200 x 120 mm: contorno con esquinas redondeadas,
  // 4 barrenos de 8 mm y una ranura de 60 x 10 mm.
  const dxf = () => {
    const L = [];
    const par = (c, v) => L.push(String(c), String(v));
    par(0, "SECTION"); par(2, "HEADER"); par(9, "$INSUNITS"); par(70, 4); par(0, "ENDSEC");
    par(0, "SECTION"); par(2, "ENTITIES");
    // contorno con radio 10 en esquinas (bulge = tan(90°/4))
    const b = Math.tan(Math.PI / 8);
    const v = [[10, 0, 0], [190, 0, b], [200, 10, 0], [200, 110, b], [190, 120, 0], [10, 120, b], [0, 110, 0], [0, 10, b]];
    par(0, "LWPOLYLINE"); par(8, "CORTE"); par(90, v.length); par(70, 1);
    for (const [x, y, bb] of v) { par(10, x); par(20, y); if (bb) par(42, bb); }
    for (const [x, y] of [[15, 15], [185, 15], [15, 105], [185, 105]]) {
      par(0, "CIRCLE"); par(8, "BARRENOS"); par(10, x); par(20, y); par(40, 4);
    }
    // ranura: dos lineas y dos arcos
    par(0, "LINE"); par(8, "CORTE"); par(10, 75); par(20, 55); par(11, 125); par(21, 55);
    par(0, "LINE"); par(8, "CORTE"); par(10, 125); par(20, 65); par(11, 75); par(21, 65);
    par(0, "ARC"); par(8, "CORTE"); par(10, 125); par(20, 60); par(40, 5); par(50, 270); par(51, 90);
    par(0, "ARC"); par(8, "CORTE"); par(10, 75); par(20, 60); par(40, 5); par(50, 90); par(51, 270);
    par(0, "ENDSEC"); par(0, "EOF");
    return L.join("\n");
  };

  // Soporte en L de 60 x 40 x 30 mm (STL binario)
  const stl = () => {
    const cajas = [[0, 0, 0, 60, 40, 8], [0, 0, 8, 10, 40, 30]];
    const tris = [];
    const cara = (a, b, c, d) => { tris.push([a, b, c], [a, c, d]); };
    for (const [x0, y0, z0, x1, y1, z1] of cajas) {
      const p = (i, j, k) => [i ? x1 : x0, j ? y1 : y0, k ? z1 : z0];
      cara(p(0, 0, 0), p(0, 1, 0), p(1, 1, 0), p(1, 0, 0));
      cara(p(0, 0, 1), p(1, 0, 1), p(1, 1, 1), p(0, 1, 1));
      cara(p(0, 0, 0), p(1, 0, 0), p(1, 0, 1), p(0, 0, 1));
      cara(p(0, 1, 0), p(0, 1, 1), p(1, 1, 1), p(1, 1, 0));
      cara(p(0, 0, 0), p(0, 0, 1), p(0, 1, 1), p(0, 1, 0));
      cara(p(1, 0, 0), p(1, 1, 0), p(1, 1, 1), p(1, 0, 1));
    }
    const buf = new ArrayBuffer(84 + tris.length * 50);
    const dv = new DataView(buf);
    dv.setUint32(80, tris.length, true);
    tris.forEach((t, i) => {
      const o = 84 + i * 50 + 12;
      t.flat().forEach((val, j) => dv.setFloat32(o + j * 4, val, true));
    });
    return buf;
  };
  return { dxf, stl };
})();
if (typeof module !== "undefined") module.exports = EJEMPLOS;
