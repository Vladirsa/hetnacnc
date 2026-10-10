import { defineLink } from "@medusajs/framework/utils"
import ProductModule from "@medusajs/medusa/product"

import CourseModule from "../modules/course"

// Un curso = un producto vendible (el instructor es el seller de ese
// producto, vía el link product_seller que ya trae Mercur). Un producto
// tiene a lo más un curso.
export default defineLink(ProductModule.linkable.product, CourseModule.linkable.course)
