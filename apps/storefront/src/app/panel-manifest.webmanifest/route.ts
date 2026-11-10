// Manifiesto del HETNA Panel (app instalable, distinta de la tienda)
import { NextResponse } from "next/server"

export function GET() {
  return NextResponse.json(
    {
      name: "HETNA Panel",
      short_name: "HETNA Panel",
      description: "Control de HETNA CNC: ventas, pedidos, licitaciones, talleres y la app",
      id: "/panel",
      start_url: "/panel",
      scope: "/",
      display: "standalone",
      orientation: "portrait",
      background_color: "#142033",
      theme_color: "#142033",
      icons: [
        { src: "/icons/panel-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/panel-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icons/panel-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "content-type": "application/manifest+json", "cache-control": "public, max-age=3600" } }
  )
}
