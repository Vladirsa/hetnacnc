import { defineMiddlewares } from "@medusajs/medusa";
import { adminLearningArticlesMiddlewares } from "./admin/learning-articles/middlewares";
import { storeLearningArticlesMiddlewares } from "./store/learning-articles/middlewares";
import { adminCoursesMiddlewares } from "./admin/courses/middlewares";
import { storeCoursesMiddlewares } from "./store/courses/middlewares";
import { vendorCoursesMiddlewares } from "./vendor/courses/middlewares";
import { storeCreditos3dMiddlewares } from "./store/creditos-3d/middlewares";
import { storeCotizadorMiddlewares } from "./store/cotizador/middlewares";
import { storeEscaneosMiddlewares } from "./store/escaneos/middlewares";
import { storeResenasMiddlewares } from "./store/resenas/middlewares";
import { storeDescargasGratisMiddlewares } from "./store/descargas-gratis/middlewares";
import { vendorFondoBlancoMiddlewares } from "./vendor/fondo-blanco/middlewares";
import { camMiddlewares } from "./cam-middlewares";
import { vendorVerificacionMiddlewares } from "./vendor/hetna-verificacion/middlewares";
import { storeSolicitudArchivosMiddlewares } from "./store/solicitud-archivos/middlewares";
import { leerMultipart } from "./cam-multipart";
import { storeForoMiddlewares } from "./store/foro/middlewares";
import { storeRastreoMiddlewares } from "./store/hetna-rastreo/middlewares";

export default defineMiddlewares({
    routes: [
        {
            matcher: "/api/auth/*",
            middlewares: [],
        },
        {
            matcher: "/api/admin/*",
            middlewares: [],
        },
        {
            matcher: "/api/store/*",
            middlewares: [],
        },
        ...adminLearningArticlesMiddlewares,
        ...storeLearningArticlesMiddlewares,
        ...adminCoursesMiddlewares,
        ...storeCoursesMiddlewares,
        ...vendorCoursesMiddlewares,
        ...storeCreditos3dMiddlewares,
        ...storeCotizadorMiddlewares,
        ...storeEscaneosMiddlewares,
        ...storeResenasMiddlewares,
        ...storeDescargasGratisMiddlewares,
        ...vendorFondoBlancoMiddlewares,
        ...camMiddlewares,
        ...vendorVerificacionMiddlewares,
        ...storeSolicitudArchivosMiddlewares,
        // Factura del pedido (PDF + XML del CFDI) desde el panel del taller
        {
          method: ["POST"],
          matcher: "/vendor/hetna-facturas/:id",
          middlewares: [leerMultipart({ campos: { pdf: 1, xml: 1 }, maxMb: 10 })],
        },
        // Fotos de evidencia del paquete desde el panel del taller (máx. 15 MB)
        {
          method: ["POST"],
          matcher: "/vendor/hetna-guias/:id/evidencia",
          middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: 15, forma: "lista" })],
        },
        ...storeForoMiddlewares,
        ...storeRastreoMiddlewares,
    ],
});
