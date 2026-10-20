# Desplegar hetnacnc.com

```bash
cd ~/hetnacnc && ./scripts/desplegar.sh
```

Eso es todo. No hay segunda forma.

## Las reglas

**Producción vive en `main`.** Una sola rama. El guion se niega a desplegar
desde cualquier otra.

**El servidor nunca mezcla.** El guion avanza en línea recta (`--ff-only`). Si
el servidor tiene commits propios, se detiene y lo dice en vez de crear una
mezcla silenciosa. Así es exactamente como se formaron las tres ramas
divergentes del 19 de octubre.

**No se edita en el servidor.** Si hay cambios sin guardar, el guion se para.
Un archivo editado directo en producción es una rama divergente que todavía no
sabe que lo es.

**Si el build falla, no se reinicia nada.** El sitio sigue sirviendo lo
anterior, que funciona. Un sitio con el código de ayer es infinitamente mejor
que un sitio caído.

## Cómo trabajar sin romper esto

1. El trabajo se hace en una rama, no en `main` directo.
2. Cuando esté listo y compile, se mezcla a `main` y se sube.
3. En el servidor: `./scripts/desplegar.sh`.

Entre el paso 2 y el 3 que pase el menor tiempo posible. Lo que nos costó la
tarde del 19 de octubre no fue ningún error difícil: fueron **46 commits
acumulados sin desplegar**. Cada uno traía su falla escondida y salieron todas
juntas.

Desplegar seguido aunque sea poco. Un cambio que llega el mismo día falla solo
y se arregla en minutos.

## Si algo sale mal

El guion imprime el comando exacto para volver atrás. Es, en esencia:

```bash
git reset --hard <el commit que imprimió>
bun run build && pm2 restart hetna-api hetna-web
```

## Lo que el guion NO hace

- No instala el motor del Laboratorio CAM (`infra/cam/README.md`).
- No toca las variables de entorno. Si un despliegue trae variables nuevas,
  hay que ponerlas a mano antes; el código nuevo las lee pero no las inventa.
- No hace respaldo de la base. Las migraciones de Medusa son aditivas, pero
  antes de un cambio grande de esquema conviene respaldar aparte.
