import { Fragment, type ReactNode } from "react"

// Muestra el texto de la IA con formato sencillo (negritas, listas, tablas, codigo)
// sin usar HTML crudo: todo se arma con elementos de React.

const enLinea = (t: string, base: string): ReactNode[] => {
  const partes = t.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g)
  return partes.map((p, i) => {
    const k = `${base}-${i}`
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) return <strong key={k}>{p.slice(2, -2)}</strong>
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2)
      return <code key={k} className="px-1 py-0.5 rounded bg-[#F1EEE7] text-[0.92em] font-mono">{p.slice(1, -1)}</code>
    const liga = p.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/)
    if (liga)
      return <a key={k} href={liga[2]} target="_blank" rel="noopener noreferrer" className="text-[#B34D07] underline underline-offset-2">{liga[1]}</a>
    return <Fragment key={k}>{p}</Fragment>
  })
}

export const Markdown = ({ texto }: { texto: string }) => {
  const lineas = texto.replace(/\r/g, "").split("\n")
  const bloques: ReactNode[] = []
  let i = 0
  let n = 0
  while (i < lineas.length) {
    const l = lineas[i]
    const k = `b${n++}`
    if (l.trim().startsWith("```")) {
      const cod: string[] = []
      i++
      while (i < lineas.length && !lineas[i].trim().startsWith("```")) cod.push(lineas[i++])
      i++
      bloques.push(
        <pre key={k} className="bg-[#142033] text-[#E6ECF5] rounded-[10px] p-3 text-[12.5px] overflow-x-auto font-mono leading-relaxed">{cod.join("\n")}</pre>
      )
      continue
    }
    if (l.trim().startsWith("|")) {
      const filas: string[][] = []
      while (i < lineas.length && lineas[i].trim().startsWith("|")) {
        const celdas = lineas[i].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
        if (!celdas.every((c) => /^:?-{2,}:?$/.test(c))) filas.push(celdas)
        i++
      }
      const [cab, ...resto] = filas
      bloques.push(
        <div key={k} className="overflow-x-auto">
          <table className="w-full text-[13.5px] border-collapse">
            {cab && (
              <thead>
                <tr>{cab.map((c, j) => <th key={j} className="text-left font-semibold border-b border-[#E7E4DC] px-2 py-1.5">{enLinea(c, `${k}h${j}`)}</th>)}</tr>
              </thead>
            )}
            <tbody>
              {resto.map((f, a) => (
                <tr key={a}>{f.map((c, j) => <td key={j} className="border-b border-[#F1EEE7] px-2 py-1.5 align-top">{enLinea(c, `${k}${a}${j}`)}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )
      continue
    }
    if (/^\s*([-*•]|\d+[.)])\s+/.test(l)) {
      const ordenada = /^\s*\d+[.)]\s+/.test(l)
      const items: string[] = []
      while (i < lineas.length && /^\s*([-*•]|\d+[.)])\s+/.test(lineas[i])) items.push(lineas[i++].replace(/^\s*([-*•]|\d+[.)])\s+/, ""))
      const Lista = ordenada ? "ol" : "ul"
      bloques.push(
        <Lista key={k} className={`m-0 pl-5 flex flex-col gap-1 ${ordenada ? "list-decimal" : "list-disc"}`}>
          {items.map((it, j) => <li key={j}>{enLinea(it, `${k}${j}`)}</li>)}
        </Lista>
      )
      continue
    }
    const h = l.match(/^#{1,4}\s+(.*)$/)
    if (h) {
      bloques.push(<p key={k} className="m-0 font-bold text-[15px]">{enLinea(h[1], k)}</p>)
      i++
      continue
    }
    if (!l.trim()) {
      i++
      continue
    }
    const par: string[] = []
    while (i < lineas.length && lineas[i].trim() && !/^\s*([-*•]|\d+[.)])\s+|^\s*\||^#{1,4}\s|^\s*```/.test(lineas[i])) par.push(lineas[i++])
    bloques.push(<p key={k} className="m-0">{enLinea(par.join(" "), k)}</p>)
  }
  return <div className="flex flex-col gap-2.5 leading-relaxed">{bloques}</div>
}
