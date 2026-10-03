// MobileNet reconoce 1000 objetos genéricos (ImageNet). Aquí los traducimos a términos de tu catálogo.
const MAP: Array<{ keys: string[]; terms: string[] }> = [
  { keys: ['power drill', 'drill'], terms: ['fresa', 'broca', 'herramienta'] },
  { keys: ['chain saw', 'chainsaw', 'buzz saw', 'saw'], terms: ['sierra', 'cortadora'] },
  { keys: ['screw', 'nail', 'nut', 'bolt', 'screwdriver'], terms: ['tornillo', 'fijación', 'hardware'] },
  { keys: ['hammer', 'hatchet', 'wrench', 'spanner', 'pliers', 'tool kit', "carpenter's kit"], terms: ['herramienta', 'llave', 'kit de herramientas'] },
  { keys: ['plane', "carpenter's plane", 'woodworking plane'], terms: ['cepillo', 'madera'] },
  { keys: ['rule', 'ruler', 'slide rule'], terms: ['regla', 'calibrador', 'medición'] },
  { keys: ['lumbermill', 'sawmill', 'wood', 'plywood'], terms: ['madera', 'MDF', 'triplay'] },
  { keys: ['vacuum', 'vacuum cleaner'], terms: ['aspiradora', 'extractor de polvo'] },
  { keys: ['oil filter'], terms: ['filtro', 'aceite', 'lubricante'] },
  { keys: ['lathe', 'router', 'bearing'], terms: ['torno', 'router CNC', 'rodamiento'] },
];

export function generateSearchQuery(predictions: Array<{ className: string; probability: number }>, minProb = 0.05) {
  const found = new Map<string, number>();
  for (const { className, probability } of predictions) {
    if (probability < minProb) continue;
    const names = className.toLowerCase().split(',').map((s) => s.trim());
    for (const row of MAP) {
      if (names.some((n) => row.keys.includes(n))) {
        for (const t of row.terms) if ((found.get(t) ?? 0) < probability) found.set(t, probability);
      }
    }
  }
  const sorted = [...found.entries()].sort((a, b) => b[1] - a[1]);
  return {
    query: sorted[0]?.[0] ?? '',
    tags: sorted.map(([t]) => t),
    confidence: sorted.length ? Math.round(sorted[0][1] * 100) : 0,
  };
}
