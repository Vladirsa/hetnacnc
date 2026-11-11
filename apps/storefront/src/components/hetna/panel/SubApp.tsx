// Pestañas dentro de Panel → App: talleres de la app / referidos y distribuidores.
export function SubApp({ locale, actual }: { locale: string; actual: "talleres" | "distribuidores" }) {
  const op = [
    { clave: "talleres", nombre: "📱 Talleres de la app", ruta: `/${locale}/panel/cotizador` },
    { clave: "distribuidores", nombre: "🤝 Referidos y distribuidores", ruta: `/${locale}/panel/cotizador/distribuidores` },
  ]
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {op.map((o) => (
        <a key={o.clave} href={o.ruta} className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-semibold ${actual === o.clave ? "border-[#142033] bg-[#142033] text-white" : "border-[#E7E4DC] bg-white text-[#40403A]"}`}>
          {o.nombre}
        </a>
      ))}
    </div>
  )
}
