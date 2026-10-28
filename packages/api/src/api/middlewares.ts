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
    ],
});
