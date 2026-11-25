"use client"
import {
  FieldError,
  FieldValues,
  FormProvider,
  useForm,
  useFormContext,
} from "react-hook-form"
import { Button } from "@/components/atoms/Button/Button"
import { zodResolver } from "@/lib/helpers/zod-resolver"
import { LabeledInput } from "@/components/cells/LabeledInput/LabeledInput"
import LocalizedClientLink from "@/components/molecules/LocalizedLink/LocalizedLink"
import { registerFormSchema, RegisterFormData } from "./schema"
import { login, signup } from "@/lib/data/customer"
import { CampoCodigo } from "@/components/hetna/cuenta/CampoCodigo"
import { useEffect, useRef, useState, type FormEvent } from "react"
import { Container } from "@medusajs/ui"
import Link from "next/link"
import { PasswordValidator } from "@/components/cells/PasswordValidator/PasswordValidator"
import { toast } from "@/lib/helpers/toast"
import { copiarAutollenado } from "@/lib/helpers/autollenado"
import { destinoSeguro } from "@/lib/seguridad/destino-seguro"

// HETNA: a donde regresar despues de crear la cuenta (?volver=/mx/servicios/cotizador-cnc)
const leerVolver = () => {
  if (typeof window === "undefined") return null
  const v = new URLSearchParams(window.location.search).get("volver")
  return v ? destinoSeguro(v, "") || null : null
}

// Lada por país. México primero (casi todos los clientes); EE. UU. y Canadá
// comparten +1.
const LADAS: [string, string][] = [
  ["+52", "🇲🇽 MX"],
  ["+1", "🇺🇸 EE. UU."],
  ["+1", "🇨🇦 Canadá"],
  ["+502", "🇬🇹 GT"],
  ["+503", "🇸🇻 SV"],
  ["+504", "🇭🇳 HN"],
  ["+506", "🇨🇷 CR"],
  ["+507", "🇵🇦 PA"],
  ["+57", "🇨🇴 CO"],
  ["+51", "🇵🇪 PE"],
  ["+56", "🇨🇱 CL"],
  ["+54", "🇦🇷 AR"],
  ["+34", "🇪🇸 ES"],
]

export const RegisterForm = () => {
  const methods = useForm<RegisterFormData>({
    resolver: zodResolver(registerFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      lada: "+52",
      phone: "",
      email: "",
      password: "",
    },
  })

  return (
    <FormProvider {...methods}>
      <Form />
    </FormProvider>
  )
}

const Form = () => {
  // Sólo para pintar la lista de requisitos; la validación real la hace el
  // esquema (schema.ts) con lo que dice el campo al enviar.
  const [, setPasswordError] = useState({
    isValid: false,
    lower: false,
    upper: false,
    "8chars": false,
    symbolOrDigit: false,
  })
  const [volver, setVolver] = useState<string | null>(null)
  useEffect(() => setVolver(leerVolver()), [])
  // Cuenta creada: falta confirmar el correo (no hay sesión hasta entonces)
  const [revisa, setRevisa] = useState<string | null>(null)
  // Trampa para robots (campo escondido que una persona nunca llena)
  const trampa = useRef<HTMLInputElement>(null)

  const {
    handleSubmit,
    register,
    watch,
    getValues,
    setValue,
    formState: { errors, isSubmitting },
  } = useFormContext<RegisterFormData>()

  // Algo falta o está mal: además del texto en rojo bajo el campo (y el cursor
  // en el primero), un aviso arriba para que no parezca que el botón no sirve.
  const faltan = () => {
    toast.error({ title: "Revisa los campos marcados en rojo." })
  }

  const enviar = (e: FormEvent<HTMLFormElement>) => {
    copiarAutollenado(e.currentTarget, getValues, setValue)
    return handleSubmit(submit, faltan)(e)
  }

  const submit = async (data: RegisterFormData) => {
    const formData = new FormData()
    formData.append("email", data.email)
    formData.append("password", data.password)
    formData.append("first_name", data.firstName)
    formData.append("last_name", data.lastName)
    // Con la lada del país: "+52 2217076014". Así se distingue México de
    // EE. UU. (+1) y de otros países al llamar o mandar WhatsApp.
    formData.append("phone", `${data.lada} ${data.phone}`)
    formData.append("sitio_web", trampa.current?.value || "")

    let res: Awaited<ReturnType<typeof signup>>
    try {
      res = await signup(formData)
    } catch {
      // Casi siempre: la página se abrió antes de una actualización del sitio
      toast.error({ title: "No se pudo crear la cuenta. Recarga la página e intenta de nuevo." })
      return
    }

    if (res && typeof res === "object" && "verificar" in res) {
      setRevisa(res.verificar)
      window.scrollTo({ top: 0, behavior: "smooth" })
      return
    }

    if (res && typeof res === "object" && "id" in res && res.id) {
      window.location.href = leerVolver() || "/user"
      return
    }

    if (res) {

      toast.error({ title: String(res) })
    }
  }

  // Con el código ya confirmado: entra solo con el correo y la contraseña que acaba de escribir
  const entrarTrasConfirmar = async () => {
    const fd = new FormData()
    fd.append("email", getValues("email"))
    fd.append("password", getValues("password"))
    const r = await login(fd).catch(() => null)
    const destino = leerVolver() || "/user"
    window.location.href = r && r.success ? destino : `/login?volver=${encodeURIComponent(destino)}`
  }

  if (revisa) {
    return (
      <main className="container" data-testid="register-page">
        <Container className="border max-w-xl mx-auto mt-8 p-6 text-center" data-testid="register-revisa-correo">
          <p className="text-[44px] leading-none m-0" aria-hidden="true">📧</p>
          <h1 className="heading-md text-primary uppercase mt-4 mb-3">Revisa tu correo</h1>
          <p className="text-md m-0">
            Te mandamos una liga y un código a <b>{revisa}</b> para confirmar tu cuenta. Abre la liga, o escribe aquí el código.
          </p>
          <CampoCodigo email={revisa} alConfirmar={entrarTrasConfirmar} />
          <p className="text-md text-secondary mt-3 mb-0">
            Si no llega en unos minutos, revisa spam o promociones. Desde &quot;Iniciar sesión&quot; puedes pedir que te la
            mandemos otra vez.
          </p>
          <Link href={volver ? `/login?volver=${encodeURIComponent(volver)}` : "/login"} className="block mt-6">
            <Button className="w-full flex justify-center uppercase">Ir a iniciar sesión</Button>
          </Link>
        </Container>
      </main>
    )
  }

  return (
    <main className="container" data-testid="register-page">
      <Container className="border max-w-xl mx-auto mt-8 p-4" data-testid="register-form-container">
        <h1 className="heading-md text-primary uppercase mb-8">
          Crear cuenta
        </h1>
        <form onSubmit={enviar} noValidate data-testid="register-form">
          {/* Trampa para robots: fuera de la vista y del teclado; si llega llena, no se crea la cuenta */}
          <div aria-hidden="true" style={{ position: "absolute", left: "-10000px", width: 1, height: 1, overflow: "hidden" }}>
            <label>
              Sitio web
              <input ref={trampa} type="text" name="sitio_web" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <LabeledInput
              className="md:w-1/2"
              label="Nombre"
              placeholder="Tu nombre"
              error={errors.firstName as FieldError}
              data-testid="register-first-name-input"
              {...register("firstName")}
            />
            <LabeledInput
              className="md:w-1/2"
              label="Apellidos"
              placeholder="Tus apellidos"
              error={errors.lastName as FieldError}
              data-testid="register-last-name-input"
              {...register("lastName")}
            />
          </div>
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <LabeledInput
              className="md:w-1/2"
              label="Correo electrónico"
              placeholder="Tu correo electrónico"
              error={errors.email as FieldError}
              data-testid="register-email-input"
              {...register("email")}
            />
            <label className="label-sm block md:w-1/2">
              <p className={errors.phone || errors.lada ? "text-negative" : undefined}>Teléfono (WhatsApp)</p>
              <div className="mt-2 flex gap-2">
                <select
                  aria-label="Lada del país"
                  className={`w-[118px] shrink-0 rounded-sm border bg-component-secondary px-2 py-[12px] focus:border-primary focus:outline-none ${errors.lada ? "border-negative" : ""}`}
                  data-testid="register-lada-select"
                  {...register("lada")}
                >
                  {LADAS.map(([lada, pais]) => (
                    <option key={pais} value={lada}>
                      {pais} {lada}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel-national"
                  placeholder="10 dígitos"
                  className={`w-full min-w-0 rounded-sm border bg-component-secondary px-[16px] py-[12px] focus:border-primary focus:outline-none ${errors.phone ? "border-negative" : ""}`}
                  data-testid="register-phone-input"
                  {...register("phone")}
                />
              </div>
              {(errors.phone || errors.lada) && (
                <p className="label-sm text-negative">{(errors.phone || errors.lada)?.message as string}</p>
              )}
            </label>
          </div>
          <div>
            <LabeledInput
              className="mb-4"
              label="Contraseña"
              placeholder="Tu contraseña"
              type="password"
              error={errors.password as FieldError}
              data-testid="register-password-input"
              {...register("password")}
            />
            <PasswordValidator
              password={watch("password")}
              setError={setPasswordError}
            />
          </div>

          <Button
            className="w-full flex justify-center mt-8 uppercase"
            disabled={isSubmitting}
            loading={isSubmitting}
            data-testid="register-submit-button"
          >
            Crear cuenta
          </Button>
          {/* Aviso de privacidad simplificado (LFPDPPP art. 16): responsable, finalidades y dónde leer el integral */}
          <p className="mt-4 text-xs leading-relaxed text-secondary">
            Al crear tu cuenta aceptas los{" "}
            <LocalizedClientLink href="/terminos-y-condiciones" className="underline">Términos y condiciones</LocalizedClientLink>.
            HETNA CNC usa tus datos para administrar tu cuenta, tus compras y cotizaciones, y para darte soporte. Consulta
            el{" "}
            <LocalizedClientLink href="/aviso-de-privacidad" className="underline">Aviso de privacidad</LocalizedClientLink>{" "}
            para conocer tus derechos y cómo negarte a recibir promociones.
          </p>
        </form>
      </Container>
      <Container className="border max-w-xl mx-auto mt-8 p-4">
        <h2 className="heading-md text-primary uppercase mb-8">
          ¿Ya tienes cuenta?
        </h2>
        <Link href={volver ? `/login?volver=${encodeURIComponent(volver)}` : "/login"} data-testid="register-login-link">
          <Button
            variant="tonal"
            className="w-full flex justify-center mt-8 uppercase"
          >
            Iniciar sesión
          </Button>
        </Link>
      </Container>
    </main>
  )
}
