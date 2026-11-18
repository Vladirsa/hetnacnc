# Guía: seguridad de GitHub (18 nov 2026)

Quien entre a tu cuenta de GitHub puede meter código a tu sitio: el siguiente
despliegue lo pondría en producción. Esta guía son unos 15 minutos.

## 1. Verificación en dos pasos (obligatorio)

1. GitHub → tu foto (arriba a la derecha) → **Settings** → **Password and authentication**.
2. **Enable two-factor authentication**. Usa una app (Google Authenticator, Authy, 1Password) o una llave física.
3. Guarda los **códigos de recuperación** en tu gestor de contraseñas, no en la computadora.

## 2. ¿Repositorio público o privado? (decisión tuya)

Hoy `Vladirsa/hetnacnc` es **público**: cualquiera puede leer el código y los
informes de seguridad de `docs/seguridad/`. No hay llaves en el repositorio (se
revisó el historial completo), pero ver el código le ahorra trabajo a quien
busque fallas.

Lo que cambia con cada opción, según la documentación de GitHub (revisa la
página de precios antes de decidir, porque cambia):

| | Público (como hoy) | Privado, plan gratis | Privado, GitHub Pro (de pago, por usuario) |
|---|---|---|---|
| Cualquiera ve el código | Sí | No | No |
| Proteger `main` contra borrado y force-push | Sí | **No** | Sí |
| Aviso de llaves filtradas y bloqueo al subir una | Sí, gratis | **No** (es de pago en privados) | No (requiere plan Team o Enterprise) |
| Avisos de dependencias vulnerables (Dependabot) | Sí | Sí | Sí |
| Minutos de GitHub Actions | Sin límite | Con límite mensual | Más minutos |

**Recomendación:** privado. Si quieres además proteger `main`, GitHub Pro. La
protección contra llaves filtradas la cubren las revisiones que ya hacemos
(nunca hubo una llave en el historial).

Para hacerlo privado: **Settings** del repositorio → **General** → hasta abajo,
**Danger Zone** → **Change repository visibility** → **Change to private**.
El despliegue sigue funcionando: el servidor baja el código con su propia llave.

## 3. Proteger la rama `main` (si es público o tienes Pro)

**Settings** del repositorio → **Rules** → **Rulesets** → **New ruleset** → **New branch ruleset**:

- Nombre: `main`. **Enforcement status:** Active.
- **Target branches** → **Add target** → **Include default branch**.
- Marca **Restrict deletions** y **Block force pushes**.
- **No** marques "Require a pull request before merging" con aprobaciones: como
  eres el único dueño, no podrías fusionar tus propios cambios.
- **Create**.

## 4. Avisos de seguridad

**Settings** del repositorio → **Advanced Security** (o **Code security**):

- **Dependabot alerts:** Enable.
- **Secret Protection / Push protection:** Enable, si aparece disponible.

## 5. Limpiar accesos

- **Settings** (de tu cuenta) → **SSH and GPG keys:** borra las llaves que no reconozcas.
- **Settings** → **Applications** → **Authorized OAuth Apps** y **GitHub Apps:** revoca las que ya no uses.
- **Settings** → **Developer settings** → **Personal access tokens:** borra los que no uses.
- En el repositorio, **Settings** → **Deploy keys:** la del servidor debe estar
  **sin** "Allow write access" (el servidor sólo baja código, nunca sube).

## 6. Lo mismo para el Cotizador

`Vladirsa/Cotizador` ya es privado. Revisa ahí los puntos 3 a 5.
