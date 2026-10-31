import { z } from "zod"

export const profilePasswordSchema = z.object({
  newPassword: z.string().nonempty("Escribe tu nueva contraseña"),
  confirmPassword: z.string().nonempty("Repite tu nueva contraseña"),
})

export type ProfilePasswordFormData = z.infer<typeof profilePasswordSchema>
