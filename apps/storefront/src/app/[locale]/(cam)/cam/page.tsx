import { redirect } from "next/navigation"

// /cam abre el CAM Studio en su modo 2D
export default async function CamInicio({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  redirect(`/${locale}/cam/subir`)
}
