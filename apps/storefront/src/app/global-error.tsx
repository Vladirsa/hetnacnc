"use client"
import { T } from "@/components/hetna/i18n/Idioma"
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div data-testid="global-error">
          <h2><T>¡Algo salió mal!</T></h2>
          <button onClick={() => reset()} data-testid="global-error-retry-button"><T>Intentar de nuevo</T></button>
        </div>
      </body>
    </html>
  )
}
