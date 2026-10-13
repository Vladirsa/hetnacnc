import { defineMiddlewares } from "@medusajs/medusa";
import { adminLearningArticlesMiddlewares } from "./admin/learning-articles/middlewares";
import { storeLearningArticlesMiddlewares } from "./store/learning-articles/middlewares";
import { vendorFondoBlancoMiddlewares } from "./vendor/fondo-blanco/middlewares";

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
        ...vendorFondoBlancoMiddlewares,
    ],
});
