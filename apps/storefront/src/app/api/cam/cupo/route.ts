// GET /api/cam/cupo -- qué incluye el plan de quien está viendo el CAM Studio y cuánto lleva en el mes.
import { NextResponse } from "next/server"

import { leerCupo } from "@/lib/cam/cupo-servidor"

export const dynamic = "force-dynamic"

export async function GET() {
  return NextResponse.json(await leerCupo(), { headers: { "Cache-Control": "no-store" } })
}
