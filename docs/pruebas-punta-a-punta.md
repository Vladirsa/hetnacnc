# Pruebas de punta a punta (antes de anunciar)

Guía para probar en real todo lo que se construyó y nadie ha usado. Toma de 1.5 a 2 horas. Marca cada casilla. **Si algo falla, manda a Claude:**

- captura de pantalla;
- folio (HET-000xx);
- hora aproximada;
- con qué cuenta estabas.

## 0. Preparación (10 min)

- [ ] Desplegar lo último:

  ```bash
  cd /root/hetnacnc && bash scripts/desplegar.sh
  ```

- [ ] Tres sesiones separadas (usa ventanas de incógnito o navegadores distintos):
  - **Cliente:** un correo tuyo que no sea taller (por ejemplo, vladirsa@hotmail.com).
  - **Taller A:** una cuenta de vendedor en hetnacnc.com/seller.
  - **Admin:** hetnacnc.com/dashboard.
- [ ] Opcional, pero ayuda mucho: un **Taller B** para ver la comparación con dos propuestas.
- [ ] Ten a la mano el celular del cliente y el del taller, con notificaciones activadas en el navegador.

## 1. Licitación completa (45 min)

| # | Quién | Qué hacer | Qué debe pasar |
|---|---|---|---|
| 1 | Cliente | hetnacnc.com/mx/cotizar → Router CNC. Llena la solicitud y sube un DXF. | Correo de "recibimos tu solicitud" con liga privada. |
| 2 | Admin | /dashboard → Solicitudes → aprobar la nueva. | Los talleres que hacen ese trabajo reciben correo o push. Si nadie la aprueba, se aprueba sola en 24 h. |
| 3 | Taller A | /seller → Solicitudes → abrir → mandar propuesta (precio, días). | El cliente recibe correo. En su liga aparece la propuesta. |
| 4 | Taller B | Mandar otra propuesta más cara pero más rápida. | En la liga del cliente aparece la **tabla comparativa** con "✓ mejor" en precio y en tiempo. |
| 5 | Cliente | En la propuesta de A → **Contraoferta** (precio más bajo y un mensaje). | Taller A ve la etiqueta de contraoferta pendiente y recibe aviso. Si el mensaje trae un teléfono, debe salir oculto. |
| 6 | Taller A | Aceptar la contraoferta. | La propuesta pasa a versión 2 con el precio nuevo. El cliente ve el historial de versiones. |
| 7 | Taller B | Editar su propuesta y escribir un "Motivo del cambio". | El cliente recibe un correo con lo que cambió (antes → después). |
| 8 | Cliente | Elegir la propuesta de A. | Taller A recibe aviso de que ganó; B, de que no. |
| 9 | Cliente / Taller A | Probar SafeDeal: preparar condiciones, editar algo, aprobar los dos, pedir código y firmar los dos. | Se descargan el contrato y la constancia de firmas. Los PDF dicen "pendiente de revisión legal" (eso es correcto por ahora). Se comparten los contactos. |
| 10 | Cliente | Pagar. **Usa un monto chico** (por ejemplo, haz que el taller proponga $10) y después reembolsa desde Mercado Pago. | La etapa cambia a "En producción". |
| 11 | Taller A | En el pedido: marcar "Archivo aprobado" con una nota y subir 1 o 2 fotos. Mover la fecha de "Acabado". | El cliente recibe un aviso. En su liga ve la barra de avance, la línea de tiempo y las fotos (se abren en grande al tocarlas). |
| 12 | Taller A | Marcar todos los hitos y luego "Entregado". | El cliente puede confirmar de recibido. |
| 13 | Cliente | Confirmar de recibido y calificar al taller. | La calificación aparece en el perfil del taller junto con la reputación medida (respuesta, cumplimiento). |

## 2. Recordatorios automáticos (se revisan solos)

Salen todos los días a las **10:17 a. m. (hora del centro)**, por correo y al celular. No tienes que hacer nada. Basta con revisar en los días siguientes que lleguen en estos casos:

- [ ] Cliente que tiene propuestas y no elige: a los 2 y a los 5 días del cierre.
- [ ] Cliente que eligió y no paga: a 1 y a 3 días.
- [ ] Taller con una contraoferta sin responder: a las 24 y a las 72 horas.
- [ ] Taller con hitos atrasados: al día de atraso y luego cada 3 días.

Cada recordatorio sale **una sola vez**. Para apagarlos todos: `RECORDATORIOS_LICITACION=0` en el `.env` del servidor y reiniciar.

Prueba rápida: en el paso 5 de arriba, deja la contraoferta sin responder un día. Al día siguiente, a las 10:17, el Taller A debe recibir el recordatorio.

## 3. Candado de planes del CAM Studio (10 min)

- [ ] Entrar con **prueba2@hetnacnc.com** (plan Gratis).
- [ ] En el CAM Studio, descargar 5 programas distintos: deben salir.
- [ ] El sexto debe bloquearse y ofrecer subir de plan.

## 4. Cotización profesional desde el celular (20 min)

En la app del Cotizador (después de fusionar el PR de categorías):

- [ ] Nueva cotización → tipo **Profesional**.
- [ ] Agregar una pieza desde un DXF, más estas partidas: "Programación CAM", "Anodizado", "Envío por paquetería".
- [ ] Cada partida muestra **Categoría** y ya trae una sugerida. Cambia una a mano.
- [ ] Generar el PDF y revisar:
  - encabezado con logo, RFC y contacto;
  - conceptos agrupados por categoría;
  - "Resumen por categoría" junto al total;
  - anexos con planos al final.
- [ ] Mandar por WhatsApp. Desde otro celular, abrir la liga, **descargar el PDF** y aceptar la cotización.
- [ ] En Supabase, correr una vez `supabase/categoria_conceptos.sql` (SQL Editor → pegar → Run) para que la categoría elegida a mano se guarde. Sin ese paso la app funciona, pero al volver a abrir la cotización la categoría vuelve a la sugerida.

## 5. Tienda (cuando haya productos)

- [ ] Comprar un producto con Mercado Pago (monto chico) y reembolsarlo.
- [ ] Revisar que lleguen los correos de compra y que el pedido aparezca en /seller.
