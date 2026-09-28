"use client"
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
          <h2>¡Algo salió mal!</h2>
          <button onClick={() => reset()} data-testid="global-error-retry-button">Intentar de nuevo</button>
        </div>
      </body>
    </html>
  )
}
