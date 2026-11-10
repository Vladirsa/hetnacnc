import { defineMiddlewares } from "@medusajs/medusa";
import { authenticate } from "@medusajs/framework/http";
import { MAX_MB_LIBRO } from "../lib/publicar-libro";
import { MAX_MB_ARCHIVO as MAX_MB_ARCHIVO_CLOUD } from "../lib/cloud";
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
import { storeCotizadorVinculoMiddlewares } from "./store/cotizador-vinculo/middlewares";
import { storeVerificacionMiddlewares } from "./store/verificacion/middlewares";
import { storeCustomersMiddlewares } from "./store/customers/proteger-metadata";
import { storeHetnaPedidosMiddlewares } from "./store/hetna-pedidos/middlewares";
import { vendorAltaMiddlewares } from "./vendor/hetna-alta/middlewares";
import { storeCuponesMiddlewares } from "./store/hetna-cupones/middlewares";
import { corsAppMiddlewares } from "./api/cors-app";
import { storeRecomiendaMiddlewares } from "./store/hetna-recomienda/middlewares";
import { storeSolicitudesTallerMiddlewares } from "./store/solicitudes-taller/middlewares";

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
        {
            method: ["GET"],
            matcher: "/store/mi-membresia",
            middlewares: [authenticate("customer", ["session", "bearer"], { allowUnauthenticated: true })],
        },
        {
            method: ["POST", "DELETE"],
            matcher: "/store/hetna-push",
            middlewares: [authenticate("customer", ["session", "bearer"])],
        },
        ...vendorCoursesMiddlewares,
        ...storeCreditos3dMiddlewares,
        ...storeCotizadorMiddlewares,
        ...storeEscaneosMiddlewares,
        ...storeResenasMiddlewares,
        ...storeDescargasGratisMiddlewares,
        ...vendorFondoBlancoMiddlewares,
        ...camMiddlewares,
        ...vendorVerificacionMiddlewares,
        ...vendorAltaMiddlewares,
        ...storeSolicitudArchivosMiddlewares,
        // Factura del pedido (PDF + XML del CFDI) desde el panel del taller
        {
          method: ["POST"],
          matcher: "/vendor/hetna-facturas/:id",
          middlewares: [leerMultipart({ campos: { pdf: 1, xml: 1 }, maxMb: 10 })],
        },
        // Licitaciones 3.0 (Fase 3): certificado del taller (PDF o foto)
        // Marketing HETNA: tu video grabado para la Fábrica (hasta 95 MB, límite de Nginx 100 MB)
        {
          method: ["POST"],
          matcher: "/admin/hetna-fabrica/video",
          middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: 95 })],
        },
        // Marketing HETNA: videos de trabajos que suben los talleres (con autorización)
        {
          method: ["POST"],
          matcher: "/vendor/hetna-promocion/videos",
          middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: 60 })],
        },
        {
          method: ["POST"],
          matcher: "/vendor/hetna-certificaciones",
          middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: 15 })],
        },
        // Licitaciones 3.0: archivos adjuntos de la propuesta del taller
        {
          method: ["POST"],
          matcher: "/vendor/hetna-solicitudes/:id/adjunto",
          middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: 25 })],
        },
        // PDF de un libro de la Academia desde el panel del taller
        {
          method: ["POST"],
          matcher: "/vendor/hetna-libros/archivo",
          middlewares: [leerMultipart({ campos: { pdf: 1 }, maxMb: MAX_MB_LIBRO })],
        },
        // HetNa Cloud: archivos del taller (diseño, CAM, G-code, fotos; máx. 50 MB)
        {
          method: ["POST"],
          matcher: "/vendor/hetna-cloud/proyectos/:id/archivos",
          middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: MAX_MB_ARCHIVO_CLOUD, forma: "lista" })],
        },
        // Fotos de evidencia del paquete desde el panel del taller (máx. 15 MB)
        {
          method: ["POST"],
          matcher: "/vendor/hetna-guias/:id/evidencia",
          middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: 15, forma: "lista" })],
        },
        ...storeForoMiddlewares,
        ...storeRastreoMiddlewares,
        ...storeCotizadorVinculoMiddlewares,
        ...storeVerificacionMiddlewares,
        ...storeCustomersMiddlewares,
        ...storeHetnaPedidosMiddlewares,
        ...storeSolicitudesTallerMiddlewares,
        ...storeCuponesMiddlewares,
        ...storeRecomiendaMiddlewares,
        // CORS de la app del Cotizador en web (localhost:8080) para /api/cotizador-*
        ...corsAppMiddlewares,
        // Cotizador en línea de cada taller: el cliente sube su archivo (hetnacnc.com/t/<slug>)
        {
          method: ["POST"],
          matcher: "/api/taller-publico/:slug/solicitar",
          middlewares: [leerMultipart({ campos: { archivo: 1 }, maxMb: Number(process.env.COTIZADOR_SOLICITUD_MAX_MB || 50) })],
        },
        // CSD del taller (.cer y .key) para la factura electrónica: va directo a Facturapi
        {
          method: ["POST"],
          matcher: "/api/cotizador-cfdi/certificado",
          middlewares: [leerMultipart({ campos: { cer: 1, key: 1 }, maxMb: 1 })],
        },
    ],
});
