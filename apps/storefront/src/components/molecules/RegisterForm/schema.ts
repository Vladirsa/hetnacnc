import { z } from 'zod';

export const registerFormSchema = z.object({
  firstName: z
    .string()
    .nonempty('Escribe tu nombre')
    .max(50, 'Máximo 50 caracteres'),
  lastName: z
    .string()
    .nonempty('Escribe tus apellidos')
    .max(50, 'Máximo 50 caracteres'),
  email: z
    .string()
    .nonempty('Escribe tu correo')
    .email('Revisa tu correo')
    .max(60, 'Máximo 60 caracteres'),
  password: z
    .string()
    .nonempty('Escribe una contraseña')
    .min(8, 'Al menos 8 caracteres')
    .regex(/^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`])/, {
      message:
        'Debe tener una mayúscula, un número y un símbolo'
    })
    .max(64, 'Máximo 64 caracteres'),
  // Lada del país (+52 México, +1 EE. UU./Canadá...) y el número, por separado
  lada: z.string().regex(/^\+\d{1,4}$/, 'Elige el país'),
  phone: z
    .string()
    .transform((v) => v.replace(/[\s()-]/g, ''))
    .pipe(
      z
        .string()
        .regex(/^\d+$/, 'Solo números, sin la lada')
        .min(7, 'Escribe tu teléfono')
        .max(15, 'Máximo 15 dígitos')
    )
});

export type RegisterFormData = z.infer<typeof registerFormSchema>;
