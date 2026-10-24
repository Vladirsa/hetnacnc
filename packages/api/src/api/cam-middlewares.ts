import {
  authenticate,
  validateAndTransformBody,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
  type MiddlewareRoute,
} from "@medusajs/framework/http"
import { AdminAddCamDeliverables, AdminUpdateCamJob } from "./admin/cam/validators"
import { archivosDe, leerMultipart } from "./cam-multipart"
import { StoreAddCamJobToCart, StoreCreateCamJob } from "./store/cam/validators"

const MAX_MODEL_MB = Number(process.env.CAM_MAX_UPLOAD_MB || 80)

const MODEL_EXT = /\.(stl|obj|step|stp|iges|igs)$/i

/** Rechaza extensiones que no son modelos 3D antes de procesar nada. */
function checkModelFile(campo: "model" | "file") {
  return (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const model = archivosDe(req)[campo]?.[0]
    if (!model) {
      res.status(400).json({ message: "Falta el archivo del modelo 3D" })
      return
    }
    if (!MODEL_EXT.test(model.originalname)) {
      res.status(400).json({ message: "Formato no soportado. Usa STL, OBJ, STEP o IGES." })
      return
    }
    next()
  }
}

/** Rutas del Laboratorio CAM (3, 4 y 5 ejes). Se agregan en src/api/middlewares.ts. */
export const camMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/store/cam/convert",
    middlewares: [leerMultipart({ campos: { file: 1 }, maxMb: MAX_MODEL_MB }), checkModelFile("file")],
  },
  {
    method: ["POST"],
    matcher: "/store/cam/jobs",
    middlewares: [
      authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true }),
      leerMultipart({ campos: { model: 1, gcode: 1 }, maxMb: MAX_MODEL_MB }),
      checkModelFile("model"),
      validateAndTransformBody(StoreCreateCamJob),
    ],
  },
  {
    method: ["GET"],
    matcher: "/store/cam/jobs",
    middlewares: [authenticate("customer", ["session", "bearer"])],
  },
  {
    method: ["GET"],
    matcher: "/store/cam/jobs/:id/files/:file_id",
    middlewares: [authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true })],
  },
  {
    method: ["POST"],
    matcher: "/store/cam/jobs/:id/cart",
    middlewares: [validateAndTransformBody(StoreAddCamJobToCart)],
  },
  {
    method: ["POST"],
    matcher: "/admin/cam/jobs/:id",
    middlewares: [validateAndTransformBody(AdminUpdateCamJob)],
  },
  {
    method: ["POST"],
    matcher: "/admin/cam/jobs/:id/deliverables",
    middlewares: [
      leerMultipart({ campos: { files: 6 }, maxMb: MAX_MODEL_MB, forma: "lista" }),
      validateAndTransformBody(AdminAddCamDeliverables),
    ],
  },
]
