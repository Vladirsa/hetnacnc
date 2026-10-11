import { defineMiddlewares } from "@medusajs/medusa";
import { adminLearningArticlesMiddlewares } from "./admin/learning-articles/middlewares";
import { storeLearningArticlesMiddlewares } from "./store/learning-articles/middlewares";
import { adminCoursesMiddlewares } from "./admin/courses/middlewares";
import { storeCoursesMiddlewares } from "./store/courses/middlewares";
import { vendorCoursesMiddlewares } from "./vendor/courses/middlewares";

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
    ],
});
