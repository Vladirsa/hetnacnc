# HETNA CNC — Especificación maestra de Licitaciones 3.0

> Documento de requisitos dictado por Roberto Vladimir Rivera Sánchez (dueño de HETNA CNC), 7 de noviembre de 2026.
> Se integra completo, sin omitir nada. Cada sección indica al final **qué existe hoy** en el código y **qué falta**.
> Antes de llevar a producción SafeDeal, HETNA Sign, los contratos y los cambios de privacidad, deben revisarlos un **abogado mercantil mexicano** (contrato, términos de uso, aviso de privacidad y mecanismo de firma electrónica).

---

## Índice

1. Privacidad inteligente de las licitaciones
2. Contrato de seguridad entre cliente y taller — HETNA SafeDeal
3. Ecosistema de redes sociales — HETNA Social Network y HETNA Social Hub
4. Comunidad industrial propia — HETNA Comunidad
5. Cómo se conectan todos los módulos
6. Fases de desarrollo
7. Búsqueda de proveedores por la empresa (cuando nadie se postula)
8. Sistema de reputación y ranking — HETNA Trust & Ranking
9. Actualización del modelo maestro (decisiones)
10. HETNA Sign — firma electrónica
11. Estado actual vs. lo que pide esta especificación
12. Decisiones que cambian reglas vigentes (requieren confirmación)
13. Criterios de aceptación por fase

---

## 1. Privacidad inteligente de las licitaciones

Cada cliente tendrá control sobre qué información quiere hacer pública y cuál desea mantener confidencial.

No se debe manejar la privacidad como una sola opción. Se divide por elementos.

### 1.1 Configuración de visibilidad

Cada proyecto tiene estos controles:

| Elemento | Opciones |
|---|---|
| Nombre del cliente | Público / Empresa visible / Anónimo |
| Presupuesto | Visible / Confidencial |
| Descripción | Pública / Solo participantes |
| Planos y archivos | Públicos / Privados / Bajo autorización |
| Fotografías | Públicas / Privadas |
| Ubicación | Ciudad / Estado / Confidencial |
| Datos de contacto | Ocultos / Compartidos por autorización |
| Nombre de la empresa | Público / Confidencial |

### 1.2 Modalidades de licitación

Cada proyecto tendrá una de tres modalidades:

- **Licitación pública:** cualquier taller compatible puede encontrarla.
- **Licitación privada:** solamente los talleres invitados pueden verla.
- **Licitación restringida:** aparece en el catálogo de oportunidades, pero los documentos técnicos completos requieren autorización del cliente.

### 1.3 Protección adicional en redes

Cuando una licitación se difunda en Facebook, LinkedIn u otras redes, HETNA debe generar una **publicación resumida**. Ejemplo:

> Empresa del sector industrial busca talleres CNC para fabricación de componentes de aluminio. Producción por lote. Proyecto disponible para cotización en HETNA CNC.

- No debe publicar automáticamente los planos, presupuestos confidenciales, teléfonos ni información sensible.
- **El cliente debe autorizar expresamente la difusión externa de su proyecto.**

**Hoy existe:** modos `abierta` y `directa`; el contacto del cliente nunca llega a los talleres (`ocultarContacto` en `packages/api/src/lib/licitacion.ts`); las abiertas se publican en `/trabajos` y en redes con datos públicos (`lib/difusion.ts` → `avisarRedes`), **sin pedir autorización del cliente**.
**Falta:** los 8 controles por elemento, la modalidad privada (por invitación) y restringida (documentos bajo autorización), solicitudes de acceso a documentos con aprobación del cliente, la casilla de autorización expresa para redes y el resumen anonimizado.

---

## 2. Contrato de seguridad entre cliente y taller — HETNA SafeDeal

**HETNA SafeDeal – Acuerdo de colaboración industrial.** Cuando el cliente selecciona un taller, ambos pueden formalizar su relación mediante un documento generado desde la plataforma.

### 2.1 Funcionamiento

1. **El cliente selecciona un taller.** El sistema registra qué propuesta fue seleccionada y quiénes son las partes.
2. **Se abre una etapa de negociación preliminar.** Cliente y taller conversan dentro de HETNA, intercambian aclaraciones y ajustan las condiciones.
3. **Se prepara el acuerdo.** El sistema genera un contrato con las condiciones definitivas que ambas partes hayan aprobado.
4. **Ambas partes aceptan y firman.** Se conserva una copia del documento, la identidad declarada de los firmantes, fecha, hora y evidencia de aceptación.
5. **Se habilita el intercambio de contactos.** Después de completar el acuerdo, las partes pueden compartir teléfono, correo, WhatsApp y otros medios.
6. **La negociación y ejecución quedan a cargo de las partes.** HETNA conserva el registro de la intermediación, pero no dirige la fabricación ni garantiza el cumplimiento comercial del contrato.

### 2.2 Contenido del contrato

| Apartado | Contenido |
|---|---|
| Identificación | Datos legales del cliente y taller |
| Objeto | Descripción del trabajo contratado |
| Especificaciones | Materiales, dimensiones, tolerancias y cantidades |
| Precio | Importe y moneda |
| Pagos | Anticipos y fechas acordadas |
| Entrega | Plazos y lugar |
| Calidad | Criterios de aceptación |
| Garantías | Condiciones pactadas |
| Propiedad intelectual | Titularidad y uso de planos y diseños |
| Confidencialidad | Protección de información industrial |
| Incumplimiento | Consecuencias y procedimientos |
| Controversias | Legislación y mecanismos de solución |

### 2.3 Cómo se deslinda HETNA

La cláusula debe explicar que:

- HETNA proporciona una infraestructura tecnológica para conectar clientes y proveedores.
- HETNA no fabrica los productos ni presta los servicios CNC contratados.
- HETNA no determina los precios ni negocia en representación de las partes.
- La selección del proveedor es decisión exclusiva del cliente.
- El cliente y el taller son responsables de verificar sus capacidades, obligaciones y acuerdos.
- HETNA no garantiza la calidad, entrega, solvencia o cumplimiento de las partes.
- Los conflictos derivados del contrato deben resolverse entre las partes conforme al acuerdo y la legislación aplicable.

**Distinción jurídica importante:** esta cláusula no debe pretender liberar a HETNA de sus propias obligaciones legales; por ejemplo, la protección de datos personales, la seguridad de la información y el cumplimiento de los servicios que efectivamente ofrece. La legislación mexicana vigente contempla obligaciones específicas en estas materias.

Un abogado mercantil mexicano debe revisar el contrato, los términos de uso, el aviso de privacidad y el mecanismo de firma electrónica antes de ponerlo en producción.

### 2.4 Dos documentos separados

1. **Términos de uso e intermediación tecnológica** entre HETNA y cada usuario.
2. **Contrato de fabricación o prestación de servicios** entre cliente y taller.

Así no se mezclan las responsabilidades de la plataforma con las de quienes celebran el negocio.

**Hoy existe:** elección de propuesta, preguntas públicas antes de proponer, cobro dentro de HETNA (directo al taller o vía HETNA), etapas de seguimiento, contacto siempre oculto.
**Falta:** mensajería privada cliente↔taller después de elegir, editor de condiciones aprobadas por ambos, generación del contrato PDF, firma (ver sección 10), intercambio de contactos tras la firma, expediente y los dos documentos legales separados.

---

## 3. Ecosistema de redes sociales — HETNA Social Network

Las redes no se usan solamente para publicar anuncios: son canales especializados que alimentan el ecosistema industrial de HETNA.

| Red social | Función dentro de HETNA |
|---|---|
| Facebook | Grupos CNC, comunidades, publicaciones y captación de talleres |
| LinkedIn | Empresas, compradores industriales y contratos B2B |
| Reddit | Comunidades técnicas, consultas, discusión de problemas y oportunidades |
| Instagram | Mostrar trabajos terminados, maquinaria y proyectos |
| TikTok | Videos de fabricación, procesos CNC y demostraciones |
| YouTube | Tutoriales, demostraciones, capacitación y casos de éxito |
| Discord | Comunidades técnicas, grupos de especialistas y soporte |
| WhatsApp | Notificaciones, comunicación y seguimiento comercial |
| Telegram | Canales de oportunidades y comunidades especializadas |
| Pinterest | Diseños, inspiración, productos y proyectos CNC |

No se conectan todas desde el primer día: algunas permiten integraciones oficiales y otras tienen restricciones para publicar o automatizar contenido.

### 3.1 HETNA Social Hub (central de distribución de contenido)

Módulo dentro del administrador de HETNA. Desde un solo panel el administrador podrá:

- Crear una publicación.
- Seleccionar las redes donde aparecerá.
- Adaptar el texto a cada red.
- Agregar fotografías y videos.
- Programar publicaciones.
- Publicar oportunidades industriales.
- Compartir proyectos terminados.
- Difundir nuevos talleres registrados.
- Medir visitas y registros provenientes de cada red.
- Identificar qué comunidades generan más clientes.

Cuando un cliente publique una licitación CNC, el sistema podrá generar automáticamente:

- Una publicación resumida para Facebook.
- Una publicación empresarial para LinkedIn.
- Una tarjeta gráfica para Instagram.
- Un aviso para canales de Telegram.
- Un enlace para compartir en WhatsApp.

Todo con autorización y conforme a las integraciones permitidas por cada red.

Se establecerá una **revisión periódica de las integraciones** de las redes sociales para mantener actualizado el Social Hub.

**Hoy existe:** `lib/hetna/avisar-redes.ts` / `avisarRedes` (aviso a redes de licitaciones y productos nuevos), subscriber `product-created-social-post`, pendiente #5 "Estudio de Publicidad" (IA para textos, imágenes y videos con calendario).
**Falta:** el panel Social Hub en el administrador, conexión por red, adaptación por red, calendario, medición por red (UTM) y la autorización del cliente.

---

## 4. Comunidad industrial propia — HETNA Comunidad

HETNA no debe depender exclusivamente de Facebook, LinkedIn o Reddit. Se construye una comunidad interna, **HETNA Comunidad**, con:

- Grupos especializados en router CNC.
- Grupos de torno y fresadora.
- Comunidades de láser y plasma.
- Impresión 3D.
- Diseño CAD/CAM.
- Automatización industrial.
- Fabricación de moldes.
- Compra y venta de maquinaria.
- Preguntas técnicas.
- Publicación de trabajos realizados.
- Búsqueda de socios industriales.
- Oportunidades de colaboración.

Usos:
- Un taller publica un trabajo que realizó, recibe comentarios y demuestra su experiencia.
- Una empresa publica una necesidad y recibe recomendaciones de talleres.
- Un ingeniero comparte conocimientos y se convierte en especialista reconocido dentro de la comunidad.

Esto genera contenido, reputación y tráfico propio para HETNA.

**Hoy existe:** Foro CNC (`/mx/foro-cnc`) con secciones, perfiles, encuestas, mensajes, avisos, red de profesionales, empleos y eventos.
**Falta:** grupos por especialidad (automatización, moldes, compra-venta de maquinaria, socios industriales, colaboración), portafolio de trabajos realizados ligado a la reputación del taller, y "recomendar taller" en necesidades publicadas.

---

## 5. Cómo se conectan todos los módulos

```
REDES EXTERNAS
Facebook · LinkedIn · Reddit · Instagram · YouTube · TikTok
                     │
                     ▼
HETNA SOCIAL HUB
Difusión · Publicidad · Comunidades · Analítica
                     │
                     ▼
HETNA CNC
Licitaciones · Marketplace · Directorio de talleres · Comunidad industrial
Membresías · IA industrial · Cotizador CNC · SafeDeal
                     │
                     ▼
RED INDUSTRIAL
Clientes · Talleres · Fabricantes · Ingenieros · Proveedores
```

---

## 6. Fases de desarrollo

No se construye todo simultáneamente: una especificación maestra (este documento) y el desarrollo dividido en módulos.

| Fase | Desarrollo |
|---|---|
| 1 | Licitaciones y publicación de proyectos |
| 2 | Panel de talleres y presentación de propuestas |
| 3 | Membresías y verificaciones |
| 4 | Negociación, SafeDeal y contratos |
| 5 | Integración de redes sociales |
| 6 | HETNA Comunidad |
| 7 | IA para emparejamiento de proyectos y talleres |
| 8 | Expansión internacional |

Cada fase tendrá pruebas funcionales, seguridad, permisos y criterios de aceptación (sección 13).

---

## 7. Búsqueda de proveedores por la empresa

¿Qué pasa cuando una empresa publica una licitación y ningún taller se postula?

Segundo mecanismo: **HETNA busca proveedores por la empresa.**

- La IA analiza el proyecto y localiza talleres registrados que tengan las capacidades necesarias. Después les envía invitaciones personalizadas para participar.
- Modalidad de **búsqueda asistida por el equipo de HETNA** para encontrar proveedores fuera de la plataforma e invitarlos a registrarse.

Así HETNA no depende exclusivamente de los talleres conectados en ese momento.

**Hoy existe:** el job `cerrar-licitaciones` avisa a HETNA cuando una solicitud cierra sin propuestas; la difusión prioriza por municipio, material y estado (hasta 60 talleres).
**Falta:** emparejamiento con IA por capacidades, invitaciones personalizadas, panel de búsqueda asistida y registro de proveedores externos invitados.

---

## 8. Sistema de reputación y ranking — HETNA Trust & Ranking

Módulo independiente con dos sistemas de evaluación.

### 8.A Ranking de talleres (lo evalúa el cliente al completar un proyecto)

| Indicador | Evaluación |
|---|---|
| Calidad de fabricación | Calidad del producto terminado |
| Cumplimiento | Entregas en fechas acordadas |
| Comunicación | Atención y seguimiento |
| Precio | Correspondencia entre cotización y factura |
| Capacidad técnica | Cumplimiento de especificaciones |
| Profesionalismo | Trato y responsabilidad |
| Servicio posventa | Atención de garantías y reclamaciones |

### 8.B Ranking de clientes (lo evalúa el taller)

| Indicador | Evaluación |
|---|---|
| Claridad del proyecto | Especificaciones y requisitos |
| Comunicación | Respuesta a consultas |
| Cumplimiento de pagos | Pagos según lo acordado |
| Formalidad | Respeto de acuerdos |
| Cambios de alcance | Gestión de modificaciones |
| Profesionalismo | Trato hacia los proveedores |
| Cumplimiento contractual | Respeto de compromisos |

### 8.C Cómo se muestran (ejemplos ilustrativos, no son datos reales)

**Perfil de taller** — Verificado — Taller CNC Industrial — 4.8/5 — 38 proyectos evaluados
- Calidad de fabricación 4.9
- Cumplimiento de entregas 4.7
- Comunicación 4.8
- Servicio posventa 4.6

**Perfil de cliente** — Verificado — Empresa Industrial — 4.9/5 — 24 proyectos evaluados
- Claridad de solicitudes 4.9
- Cumplimiento de pagos 5.0
- Comunicación 4.8

### 8.D Reglas contra manipulación

1. Solamente proyectos con una relación comercial comprobable podrán generar evaluaciones verificadas.
2. Ambas partes podrán evaluar independientemente.
3. Las evaluaciones se publicarán cuando ambas hayan respondido o termine el periodo establecido.
4. No se permitirá comprar mejores posiciones en el ranking.
5. Las membresías pagadas no modificarán la puntuación.
6. Los usuarios podrán responder a evaluaciones.
7. Existirá un procedimiento de reclamación y revisión.
8. Se detectarán patrones sospechosos de evaluaciones falsas.
9. Los perfiles nuevos mostrarán que todavía no tienen suficiente historial.
10. El ranking distinguirá reputación comercial de certificaciones técnicas.

### 8.E Clasificaciones independientes

- Mejores talleres CNC por especialidad.
- Talleres de corte láser.
- Talleres de plasma.
- Fresadoras y tornos.
- Router CNC.
- Impresión 3D.
- Fabricación de moldes.
- Talleres por región y país.
- Clientes industriales con mejor historial comercial.
- Proveedores con mayor cumplimiento.

Un taller pequeño especializado puede destacar por su calidad sin competir directamente con una fábrica de gran tamaño.

### 8.F Dos dimensiones independientes

El ranking tiene **reputación comercial** y **capacidad técnica** por separado, para que un taller con buenas valoraciones comerciales no aparezca automáticamente como especialista en una tecnología que no domina.

**Hoy existe:** reseña del cliente al cerrar una licitación con calidad, tiempo y trato (1–5) + comentario, que alimenta `seller.metadata.perfil.calificacion`; reseñas de producto con moderación y fotos; insignia de taller verificado (`/seller/verificacion`); ranking interno de talleres en el tablero (`lib/tablero-ranking.ts`).
**Falta:** los 7 indicadores del taller, la evaluación del taller al cliente (7 indicadores), publicación simultánea o al vencer el plazo, respuestas, reclamaciones, detección de patrones, "historial insuficiente", clasificaciones por especialidad/región y la separación comercial vs. técnica.

---

## 9. Actualización del modelo maestro (decisiones)

| Módulo | Decisión |
|---|---|
| Búsqueda de talleres | Registrados y búsqueda externa |
| SafeDeal | Opcional, recomendado |
| Redes sociales | Todas las redes compatibles |
| Presupuesto | Público o confidencial a elección del cliente |
| Identidad | Pública, empresarial o anónima |
| Documentación | Pública, privada o bajo autorización |
| Licitaciones | Públicas, privadas y restringidas |
| Membresías | Para talleres y clientes |
| Ranking | Para clientes y talleres |
| Verificación | Identidad y existencia empresarial |
| Certificación | Capacidades y documentación acreditada |
| Contratación | Directa entre cliente y taller |
| Comisiones | Sin comisión por la transacción comercial |

Recomendación: el ranking con dos dimensiones independientes, reputación comercial y capacidad técnica (ver 8.F).

Siguiente paso: este documento maestro de requisitos funcionales, arquitectura, base de datos, permisos, integraciones y pruebas de aceptación.

---

## 10. HETNA Sign — firma electrónica

### 10.1 Niveles

| Nivel | Funcionamiento | Aplicación |
|---|---|---|
| Firma electrónica simple | Aceptación expresa, identificación, autenticación y registro de evidencias | Contratos ordinarios de fabricación |
| Firma electrónica con verificación reforzada | Código OTP por correo o teléfono, identidad verificada y expediente de auditoría | Contratos de mayor importancia |
| Firma electrónica avanzada | Certificado digital y mecanismos criptográficos de autenticación e integridad | Operaciones que requieran mayores garantías |

Marco legal de referencia en México: el Código de Comercio reconoce las firmas electrónicas y establece criterios de atribución, integridad y conservación de mensajes de datos (artículos 89, 93 y 96-97). También se considera la **NOM-151-SCFI-2016** para la conservación de mensajes de datos y la intervención de prestadores de servicios de certificación cuando corresponda.

Recomendación: comenzar con **firma electrónica simple** y **verificación reforzada**, dejando preparada la arquitectura para integrar un proveedor de firma avanzada y certificación documental. No se desarrolla infraestructura criptográfica certificada propia.

### 10.2 Flujo de firma

1. **Cliente y taller llegan a un acuerdo:** precio, materiales, cantidades, entregas, garantías y condiciones.
2. **HETNA genera el contrato PDF** con los datos de ambas partes y las condiciones aprobadas.
3. **El cliente firma:** revisa el documento, acepta las condiciones y completa su autenticación.
4. **El taller firma:** recibe una notificación y firma exactamente la misma versión contractual.
5. **HETNA cierra el expediente:** documento definitivo, huella digital **SHA-256** y registro de evidencias.
6. **Ambas partes reciben su copia:** pueden consultar y descargar el contrato firmado desde sus cuentas.

### 10.3 Evidencias que conservará HETNA

- Identidad y cuenta de cada firmante.
- Nombre y representación empresarial declarada.
- Fecha y hora de cada aceptación.
- Método de autenticación utilizado.
- Dirección IP y datos técnicos pertinentes, con aviso de privacidad.
- Versión exacta del contrato.
- Huella criptográfica del documento.
- Historial de eventos y modificaciones.
- Constancia de conservación, cuando corresponda.

### 10.4 Reglas de integridad

- El documento firmado queda **bloqueado contra modificaciones**. Si se modifica una condición, se genera una **nueva versión** y se vuelven a obtener las firmas.
- **HETNA no podrá modificar unilateralmente un contrato ya firmado ni presentar una versión nueva como si fuera la original.**

---

## 11. Estado actual vs. lo que pide esta especificación

| Tema | Hoy en HETNA | Lo que pide la especificación |
|---|---|---|
| Modalidades | Abierta y directa | Pública, privada (invitados) y restringida (documentos bajo autorización) |
| Privacidad | Contacto siempre oculto | 8 controles por elemento elegidos por el cliente |
| Difusión en redes | Automática para abiertas, sin pedir permiso | Sólo con autorización expresa y con resumen anonimizado |
| Revisión de HETNA | Sí (24 h, se aprueba sola) | No se menciona: se conserva |
| Preguntas | Públicas para todos los talleres | Se conservan; se suma la conversación privada después de elegir |
| Cobro | Dentro de HETNA (directo al taller o vía HETNA) con comisión 2–5 % según plan | Contratación directa, sin comisión por la transacción |
| Contacto | Nunca se comparte | Se comparte después del acuerdo firmado |
| Contrato | No existe | SafeDeal + HETNA Sign |
| Reseñas | El cliente califica calidad, tiempo y trato | 7 indicadores de taller + 7 de cliente, publicación simultánea, respuestas y reclamaciones |
| Ranking | Interno en el tablero del taller | Público, por especialidad, región, comercial vs. técnico |
| Sin propuestas | Aviso a HETNA | IA busca e invita talleres; búsqueda asistida externa |
| Membresías | Planes de talleres (Gratis, Taller, Pro, Industrial) | Para talleres **y clientes** |
| Verificación | Insignia de taller verificado | Identidad y existencia empresarial; certificación de capacidades aparte |
| Comunidad | Foro CNC | HETNA Comunidad con grupos industriales y portafolios |
| Redes | Avisos automáticos | Social Hub con 10 redes, calendario y analítica |

---

## 12. Decisiones del dueño (confirmadas el 7 nov 2026)

1. **Sin comisiones en licitaciones.** HETNA cobra sólo **planes**, **verificación** y **certificaciones**. Aplicado en el código el 7 nov 2026: la comisión por plan quedó en 0 % y los textos dicen "sin comisión". (La comisión de ventas de la tienda, 6 %, no cambia.)
2. **Posicionamiento.** Un taller con plan, verificación y certificaciones **aparece mejor posicionado** ante los clientes (orden y visibilidad en búsquedas, directorio y emparejamiento). Esto **no altera su puntuación de reputación**: la calificación sólo sale de operaciones reales (regla 8.D-5).
3. **Ranking de clientes.** Si un cliente quiere acceder a los mejores talleres, **debe tener ranking** (buena reputación como cliente). Los talleres podrán ver y filtrar por la reputación del cliente.
4. **SafeDeal opcional, con alerta.** No es obligatorio, pero al elegir propuesta se muestra una **alerta destacada** a ambas partes explicando que el acuerdo es para el bienestar de los dos (protege pagos, entregas, calidad y propiedad intelectual) e invitándolos a formalizarlo.
5. **Redes sociales.** Se mantiene la difusión de oportunidades en redes **para atraer más talleres** a la plataforma, siempre con el **resumen anonimizado** y respetando la privacidad que elija el cliente (nunca planos, presupuesto confidencial ni contacto).
6. **Pendiente de confirmar:** en qué momento se comparten los contactos cuando las partes **no** usan SafeDeal. Propuesta por defecto (según 1.1): "compartidos por autorización" — el cliente decide si los libera al elegir la propuesta.

## 13. Criterios de aceptación por fase

**Fase 1 — Licitaciones y publicación de proyectos**
- El cliente elige modalidad (pública, privada, restringida) y los 8 controles de visibilidad al publicar.
- Ningún dato marcado confidencial aparece en el tablero público, en correos a talleres, en redes ni en la API pública (pruebas automáticas por cada control).
- En privada, sólo los talleres invitados ven la solicitud; un taller no invitado recibe 404.
- En restringida, el taller ve el resumen y pide acceso; el cliente aprueba o rechaza; sólo los aprobados descargan planos.
- La difusión a redes sólo ocurre con autorización expresa y usa el resumen anonimizado.

**Fase 2 — Panel de talleres y propuestas**
- El taller ve sólo lo que la configuración le permite; pide acceso a documentos desde su panel.
- Invitaciones a licitaciones privadas visibles en el panel con aviso por correo y celular.

**Fase 3 — Membresías y verificaciones**
- Membresías para talleres y clientes; verificación de identidad y existencia empresarial; certificaciones técnicas separadas.
- Pagar membresía no altera la puntuación del ranking (prueba automática).

**Fase 4 — Negociación, SafeDeal y contratos (con HETNA Sign)**
- Mensajería privada cliente↔taller tras elegir, con contacto oculto hasta firmar.
- Contrato PDF con los 12 apartados; firma simple y reforzada (OTP); SHA-256; expediente de evidencias; versión firmada inmutable; nueva versión exige nuevas firmas.
- Revisión por abogado antes de producción.

**Fase 5 — Redes sociales (Social Hub)**
- Publicación por red con texto adaptado, programación, UTM y medición de visitas y registros por red.

**Fase 6 — HETNA Comunidad**
- Grupos por especialidad, portafolio de trabajos, recomendaciones de talleres.

**Fase 7 — IA de emparejamiento**
- Cuando una licitación no recibe propuestas en X días, la IA propone talleres compatibles y envía invitaciones; panel de búsqueda asistida para el equipo de HETNA.

**Fase 8 — Expansión internacional**
- Monedas, idiomas, países y legislación aplicable por país.

**Trust & Ranking** (transversal, a partir de la fase 4)
- Las 10 reglas anti-manipulación verificables con pruebas; clasificaciones por especialidad y región; dimensiones comercial y técnica separadas.

---

## 14. Complementos de la Master Product Specification v1.0 (skill "licitacion-hetna")

Lo siguiente viene de la especificación maestra del dueño y se suma a las secciones anteriores.

**Visión.** HETNA CNC será un ecosistema industrial internacional (no sólo marketplace ni directorio) que conecta empresas, compradores, talleres CNC, fabricantes, proveedores, ingenieros y especialistas para: publicar necesidades de fabricación, crear licitaciones industriales, buscar proveedores, recibir cotizaciones formales, comparar propuestas, negociar directamente, formalizar contratos, evaluar clientes y proveedores, participar en comunidades, difundir oportunidades en redes y contratar fabricación nacional e internacional. Mercados iniciales: **México, Estados Unidos y Latinoamérica**; la arquitectura debe permitir más países.

**Modalidades adicionales de licitación:** públicas, privadas, restringidas, **invitaciones directas**, **proyectos individuales**, **fabricación por lotes** y **contratos de producción recurrente**.

**Campos de cada publicación:** nombre del proyecto, descripción técnica, archivos CAD/CAM, fotografías, tipo de maquinaria, materiales, dimensiones, tolerancias, cantidades, presupuesto, plazo de entrega, ubicación, requisitos de calidad y certificaciones requeridas.

**Motor de búsqueda de talleres.** (A) Interna: talleres registrados compatibles. (B) Externa: localizar proveedores fuera de HETNA mediante **fuentes legítimas** e invitarlos a registrarse. La IA analiza maquinaria, tecnología CNC, materiales, dimensiones de trabajo, capacidad productiva, especialización, ubicación, experiencia, certificaciones y disponibilidad declarada. **No afirmar capacidades sin evidencia.**

**Propuesta formal del taller:** precio, **moneda**, materiales, **operaciones**, tiempo de fabricación, **fecha estimada de entrega**, **condiciones de pago**, **garantías**, **observaciones técnicas** y **archivos adjuntos**. El cliente compara todas; la IA explica diferencias y detecta omisiones, pero **nunca adjudica automáticamente**.

**Membresías.** Talleres: gratuito, profesional, empresarial. Clientes: cuenta gratuita y membresía empresarial. Ofrecen visibilidad adicional, herramientas de gestión, analítica, invitaciones privadas, acceso a proveedores verificados y funciones empresariales. **Nunca modifican puntuaciones ni impiden elegir libremente proveedor. Sin comisión por la transacción entre cliente y taller como modelo base.**

**Verificación y certificaciones:** tres conceptos separados — identidad verificada, certificaciones documentales acreditadas y reputación basada en operaciones reales. Se guarda evidencia de cada verificación. Una membresía pagada no es una certificación.

**Ranking de clientes (versión de la especificación):** claridad de proyectos, comunicación, cumplimiento de pagos, formalidad, gestión de cambios y cumplimiento contractual (se suma "profesionalismo" del documento del dueño, sección 8.B). Puntuaciones independientes por especialidad.

**SafeDeal es opcional**, no condición universal. **HETNA Sign:** firma electrónica, autenticación del firmante, OTP, fecha y hora, SHA-256, historial de eventos, versionado, bloqueo de firmados, descarga e integración futura con prestadores de certificación y firma avanzada.

**Social Hub:** usar **APIs oficiales e integraciones autorizadas** de cada red; **no depender de publicaciones automáticas en grupos donde no estén autorizadas**; toda difusión respeta la privacidad elegida por el cliente.

**HETNA Comunidad:** además de los grupos de la sección 4 — discusiones técnicas, tutoriales, perfiles, publicaciones, comentarios, reacciones, moderación y reputación comunitaria.

**IA industrial:** clasificación de proyectos, análisis de requisitos, emparejamiento, preparación de solicitudes técnicas, identificación de información faltante, comparación de cotizaciones, resúmenes, **traducción español/inglés**, difusión y búsqueda de proveedores. **La IA no inventa certificaciones, capacidades, precios ni garantías.**

**Seguridad y privacidad:** control de acceso por roles, permisos por proyecto, protección de archivos, cifrado de información sensible, registro de accesos, autenticación segura, control de descargas, consentimientos de difusión, protección de datos personales, auditoría de acciones administrativas, copias de seguridad y políticas de conservación y eliminación.

**Criterios de desarrollo de cada módulo:** requerimientos funcionales y no funcionales, modelo de datos, permisos, flujos de usuario, validaciones, manejo de errores, seguridad, pruebas y criterios de aceptación. Un módulo no está terminado por tener sólo interfaz: debe funcionar de extremo a extremo y estar probado.

**Reglas de trabajo:** auditar primero; conservar lo existente; no inventar tecnologías ni integraciones; no programar todo a la vez; presentar el diseño técnico y **esperar aprobación del dueño antes de implementar cada fase**.

---

## 15. Auditoría del sistema actual (7 nov 2026)

### 15.1 Arquitectura existente
- **Backend:** Mercur (marketplace multivendedor) sobre **MedusaJS v2**, Node/TypeScript, en `packages/api`. Rutas propias en `src/api`, librerías en `src/lib`, tareas programadas en `src/jobs`, suscriptores de eventos en `src/subscribers`.
- **Base de datos:** PostgreSQL (tablas de Medusa/Mercur + tablas propias `hetna_*`, creadas por código). Foro y app Cotizador en **Supabase** (Postgres aparte).
- **Frontend tienda:** Next.js 15 (`apps/storefront`), en español, rutas `/mx/...`.
- **Panel del taller:** Vite/React de Mercur (`apps/vendor`, en `/seller`). **Panel de administración:** `apps/admin` (en `/dashboard`).
- **App Cotizador:** Flutter + Supabase (repositorio aparte `Vladirsa/Cotizador`).
- **Autenticación:** Medusa (clientes, vendedores/miembros, administradores) con sesión y JWT.
- **Archivos:** Backblaze B2 (bucket privado, ligas firmadas; subida directa hasta 500 MB) y fotos pequeñas en Postgres.
- **Pagos:** Mercado Pago y PayPal (cuentas de HETNA y de cada taller).
- **Correo:** Resend (`hola@hetnacnc.com`). **Avisos al celular:** Web Push (VAPID). **Redes:** `avisarRedes`.
- **Hosting:** VPS Hostinger con pm2 (`hetna-api`, `hetna-web`), nginx y Cloudflare; despliegue con `scripts/desplegar.sh`.

### 15.2 Funcionalidades disponibles para licitaciones
Solicitud abierta/directa; revisión de HETNA (24 h); difusión hasta 60 talleres priorizada por municipio, material y estado; tablero público `/trabajos`; preguntas públicas; propuestas con precio, días, vigencia, envío, condiciones y anticipo; cupo por plan; cierre a 7 días; comparación y elección; aviso a no elegidos con rango de precio; cobro (directo al taller o vía HETNA) con comisión por plan; seguimiento por etapas; entrega con guía; confirmación de recibido y liquidación; reseña de 3 criterios; contacto oculto; archivos grandes con visor de planos; avisos por correo y celular.

### 15.3 Funcionalidades faltantes
Las listadas como "Falta" en las secciones 1, 2, 3, 4, 7 y 8, más: moneda y campos técnicos completos en propuestas (operaciones, garantías, fecha de entrega, adjuntos), modalidades por lotes y producción recurrente, membresías para clientes, verificación empresarial de clientes, certificaciones documentales separadas, IA de emparejamiento y comparación, traducción español/inglés, registro de accesos y control de descargas por proyecto, auditoría de acciones administrativas.

### 15.4 Dependencias
- Fase 1 (privacidad y modalidades) no depende de nada nuevo.
- SafeDeal depende de mensajería privada y de la decisión sobre comisiones/contactos (sección 12).
- HETNA Sign depende de SafeDeal; OTP por correo usa Resend; OTP por SMS requiere un proveedor (p. ej. Twilio) — **por contratar**.
- Social Hub depende de cuentas de empresa y permisos de API de cada red (Meta, LinkedIn, TikTok, etc.) — **por gestionar**.
- IA de emparejamiento depende de perfiles de taller completos (maquinaria, materiales, área de trabajo).
- Búsqueda externa depende de fuentes legítimas (directorios públicos, Google Maps API con licencia) — **por definir**.
- Revisión legal (abogado mercantil) antes de producir SafeDeal/Sign y cambios de privacidad.

### 15.5 Riesgos
- **Ingresos:** quitar la comisión de licitaciones sin tener membresías de clientes listas deja ese módulo sin ingreso.
- **Fuga de clientes:** liberar contactos antes de un acuerdo facilita negociar fuera de la plataforma.
- **Legal:** contratos y firma sin revisión de abogado; NOM-151 si se requiere conservación certificada.
- **Privacidad:** cada control de visibilidad debe probarse en todas las salidas (web, correo, push, redes, API, `/trabajos`, sitemap).
- **Redes:** políticas de cada plataforma cambian; publicar en grupos sin autorización puede bloquear cuentas.
- **Reputación:** con pocos proyectos, rankings poco representativos; mostrar "historial insuficiente".

### 15.6 Plan de implementación (propuesto)
1. **Fase 1:** privacidad por elemento + modalidades pública/privada/restringida + autorización de difusión + resumen anonimizado + solicitudes de acceso a documentos.
2. **Fase 2:** propuesta formal completa (moneda, operaciones, garantías, fecha, adjuntos) + invitaciones + comparador con IA (sin adjudicar).
3. **Fase 3:** membresías de clientes, verificación empresarial, certificaciones separadas.
4. **Fase 4:** mensajería privada + SafeDeal + HETNA Sign (simple y OTP) + Trust & Ranking bilateral.
5. **Fase 5:** Social Hub (empezando por las redes con API oficial disponible).
6. **Fase 6:** HETNA Comunidad sobre el foro actual.
7. **Fase 7:** IA de emparejamiento y búsqueda asistida/externa.
8. **Fase 8:** internacional (USD, inglés, EE. UU. y Latinoamérica).

### 15.7 Estimación de complejidad
| Fase | Complejidad | Notas |
|---|---|---|
| 1 | Media | Cambios en formulario, API, correos, `/trabajos`, difusión y permisos |
| 2 | Media | Extiende propuestas y panel del taller |
| 3 | Media-alta | Cobro de membresías de clientes y flujo de verificación |
| 4 | Alta | Mensajería, contratos PDF, firma, evidencias, ranking bilateral, revisión legal |
| 5 | Alta | Una integración por red, permisos de cada plataforma |
| 6 | Media | Sobre el foro existente |
| 7 | Media-alta | IA con perfiles completos y fuentes externas legítimas |
| 8 | Alta | Monedas, idiomas, impuestos y legislación por país |

### 15.8 Criterios de aceptación
Ver sección 13; cada fase se da por terminada sólo cuando funciona de extremo a extremo y pasa sus pruebas en el entorno de producción.

---

## 16. Estrategia de monetización y retención (investigación del 7 nov 2026)

### 16.1 Hallazgos
- **Cobrar comisión aumenta la fuga.** Un estudio empírico encontró que introducir comisiones elevó las transacciones fuera de la plataforma ~4 puntos porcentuales (casi el doble). Sin comisión, el incentivo a irse por fuera baja mucho.
- **Los grandes B2B industriales sin comisión cobran suscripción al proveedor:** IndiaMART (95 % de su negocio son suscripciones de proveedores; el comprador es gratis; los planes dan **prioridad en búsquedas** y **créditos de oportunidades**). MFG.com: el proveedor paga membresía anual (≈ USD 5,000 históricamente) y filtra los RFQ que quiere; el comprador es gratis.
- **Pago por propuesta (modelo Upwork "Connects"):** el proveedor gasta créditos para mandar cada propuesta; los planes incluyen créditos al mes.
- **Retención por valor, no por castigo:** lo que más retiene es lo que sólo existe dentro de la plataforma: reputación, protección de pago, contrato, facturación, historial, seguimiento y resolución de disputas. Ocultar el contacto antes de cerrar trato (BlaBlaCar, Airbnb) también ayuda.

### 16.2 Modelo propuesto (sin comisión por transacción)
**Talleres (pagan por oportunidades y visibilidad):**
| Beneficio | Gratis | Taller | Pro | Industrial |
|---|---|---|---|---|
| Propuestas a licitaciones abiertas/mes | 1 | 5 | Ilimitadas | Ilimitadas |
| Ver la licitación al publicarse | +24 h | +12 h | Al momento | Al momento |
| Ver presupuesto (si el cliente lo hizo visible a planes) | No | Sí | Sí | Sí |
| Ver ranking del cliente | Sí | Sí | Sí | Sí |
| Prioridad en búsquedas, directorio y emparejamiento | Base | + | ++ | +++ |
| Invitaciones a licitaciones privadas | No | Sí | Sí | Sí |
| Analítica (vistas, tasa de ganadas) | No | Básica | Completa | Completa + equipo |
| SafeDeal reforzado (OTP) | — | Por contrato | Incluido | Incluido |
- **Créditos de propuesta extra** (paquetes) para quien no quiere subir de plan.
- La prioridad del plan afecta **orden y visibilidad**, nunca la **calificación** (regla 8.D-5).

**Clientes:** cuenta gratuita (licitación pública, comparación básica). **Membresía empresarial:** licitaciones privadas y restringidas ilimitadas, varios usuarios, comparador con IA, SafeDeal reforzado, acceso a proveedores verificados/certificados y **búsqueda asistida por HETNA** (sección 7).

**Servicios con cobro único o anual:** verificación de identidad y empresa, certificaciones documentales, búsqueda asistida de proveedores (por proyecto), publicidad y destacados.

### 16.3 Retención (que se queden)
1. **El contacto sólo se libera al elegir propuesta** (con casilla de autorización del cliente). Antes, todo es por chat dentro de HETNA con contacto oculto.
2. **La reputación sólo crece con trabajos registrados en HETNA**: cada trabajo cerrado dentro suma al ranking de ambos; lo que se haga por fuera no cuenta.
3. **Botón "Volver a contratar"**: la segunda compra con el mismo taller se hace en un clic dentro de HETNA y también suma al ranking.
4. **Valor que sólo existe dentro:** SafeDeal y HETNA Sign, expediente del proyecto, seguimiento, garantía y reclamaciones, factura (CFDI en la app), pago protegido opcional.
5. **Sin castigos agresivos:** como no hay comisión, no se banea a nadie por tratar directo; el ingreso viene de que el taller renueve su plan porque HETNA le sigue trayendo clientes nuevos.
6. **Medir la fuga:** propuestas elegidas que nunca registran entrega; si sube, se ajusta.

### 16.4 Fuentes
- Hagiu y Wright, "Marketplace Leakage", Management Science 2024 — https://econpapers.repec.org/RePEc:inm:ormnsc:v:70:y:2024:i:3:p:1529-1553
- Sharetribe, cómo desalentar pagos por fuera — https://www.sharetribe.com/academy/how-to-discourage-people-from-going-around-your-payment-system/
- Hokodo, desintermediación en B2B — https://hokodo.co/resources/how-to-prevent-disintermediation-on-your-b2b-marketplace
- Applico, prevenir la fuga en marketplaces — https://applicoinc.com/?p=8851
- IndiaMART, modelo de suscripción de proveedores — https://www.markhub24.com/post/indiamart-s-supplier-subscription-business-model
- MFG.com, membresía de proveedores — https://www.controleng.com/online-solution-unites-buyers-suppliers-in-sourcing-marketplace/
- Upwork, Connects y política de circunvención — https://support.upwork.com/hc/en-us/articles/360048105134
