// /disenar/modelos-3d: el catálogo (igual que cualquier herramienta del estudio).
// Vive en su propia carpeta porque cada modelo tiene su página (./[modelo]).
import HerramientaDiseno, { generateMetadata as metaHerramienta } from "../[herramienta]/page"

type Props = { params: Promise<{ locale: string }> }

const conSlug = async (params: Props["params"]) => ({ ...(await params), herramienta: "modelos-3d" })

export const generateMetadata = ({ params }: Props) => metaHerramienta({ params: conSlug(params) })

export default function ModelosPagina({ params }: Props) {
  return <HerramientaDiseno params={conSlug(params)} />
}
