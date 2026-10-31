import { z } from "zod"

export const forgotPasswordSchema = z.object({
  email: z.string().nonempty("Escribe tu correo").email("Revisa tu correo"),
})

export type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>
