# Manual del panel de administración de HETNA CNC

**Para:** el dueño y el equipo de HETNA CNC · **Versión:** 18 de noviembre de 2026

Este manual explica cómo usar el panel de administración de hetnacnc.com (`hetnacnc.com/dashboard`), página por página. El capítulo más largo es el de **Social Hub**, donde se maneja el marketing en redes.

Se escribió leyendo el código del panel, así que describe lo que de verdad hace cada botón. Donde algo no se pudo comprobar sin abrir la pantalla, dice **(verificar)**.

## Cómo leer este manual

- Los textos en **negritas** son los que ves en pantalla, tal cual.
- Los horarios están en **hora del centro de México**.
- Las "variables del servidor" son ajustes del archivo `packages/api/.env` del servidor. Para cambiar una hay que volver a desplegar (`./scripts/desplegar.sh`). Aquí sólo aparece su nombre, para qué sirve y su valor si no se pone; nunca sus valores reales.
- Al final está el **Apéndice: cosas que hoy no funcionan como dice la pantalla**. Léelo antes de usar Solicitudes, Envíos y Social Hub.

## Contenido

1. **Primeros pasos y secciones básicas**: entrar, el menú, Pedidos, Productos, Tiendas (talleres), Clientes, Comisiones, Pagos, Promociones y Configuraciones.
2. **Social Hub**: conectar redes, crear y programar publicaciones, aprobar borradores, el plan semanal, comentarios, estadísticas, Telegram y lo que pasa solo.
3. **Páginas del panel (parte A)**: Centro de control, Resultados, Publicidad, Blog, Contabilidad, Pagos a talleres, Envíos y Cargar productos.
4. **Páginas del panel (parte B)**: Solicitudes, Verificaciones, Cotizador, Trabajos CAM, Trabajos reales, Fundadores y Categorías ocultas.
5. **Apéndice**: cosas que hoy no funcionan como dice la pantalla.

## Tu día a día, en 5 minutos

1. **Centro de control**: lo urgente del día (pagos por revisar, talleres nuevos, envíos con problemas).
2. **Social Hub › Pendientes**: aprueba o descarta los borradores de la semana.
3. **Solicitudes**: las solicitudes de fabricación que esperan revisión.
4. **Pedidos**: los pedidos nuevos y su estado de envío.
5. Una vez por semana: **Resultados** y **Social Hub › Resultados**, para ver qué está vendiendo y qué publicación funcionó.

---
# Capítulo 1 · Primeros pasos y secciones básicas del panel

Este capítulo tiene dos partes:

1. **Primeros pasos**: cómo entrar al panel y cómo está acomodado el menú.
2. **Secciones básicas**: las que trae Mercur de fábrica y que vas a usar casi todos los días: pedidos, productos, tiendas (talleres), clientes, comisiones, pagos, promociones y configuración.

Las páginas que hicimos sólo para HETNA (Solicitudes, Verificaciones, Cotizador, etc.) están en los capítulos 2, 3 y 4.

Los nombres en **negritas** son los textos exactos que ves en pantalla.

---

## Parte 1 · Primeros pasos

### Las dos direcciones que necesitas

| Panel | Dirección | Para qué |
|---|---|---|
| **Panel de administración** | **hetnacnc.com/dashboard** | Manejas todo el marketplace: talleres, pedidos, clientes, comisiones y las páginas de HETNA. |
| **Panel de vendedor** | **hetnacnc.com/seller** | Es el panel de cada taller. Ahí sólo se ve la propia tienda. |

Tú tienes acceso a los dos con **el mismo correo**:

- En **/dashboard** eres el administrador de todo el marketplace.
- En **/seller** eres dueño de la tienda **Hetna CNC**. Ahí publicas y vendes los productos propios de HETNA, igual que cualquier otro taller.

Son dos sesiones distintas. Puedes tenerlas abiertas en dos pestañas al mismo tiempo.

### Entrar al panel

1. Abre **hetnacnc.com/dashboard** en tu navegador (Chrome, Edge, Safari o Firefox).
2. Verás **Bienvenido a HETNA CNC** y **Inicia sesión en el panel de administración.**
3. Escribe tu correo y tu contraseña.
4. Da clic en el botón para entrar.

¿Olvidaste tu contraseña? En la pantalla de entrada hay una opción para restablecerla (verificar el texto exacto). Te llega un correo con una liga. **La liga dura sólo 15 minutos.** Si se vence, pide otra.

¿Alguien nuevo va a ayudarte en el panel? Invítalo desde **Configuraciones → Usuarios → Invitar Usuario**. No encontramos en el sistema un correo automático de invitación: si no le llega, copia la liga de la invitación desde esa misma pantalla y mándasela tú (verificar).

**Para salir:** abre el menú de tu nombre (abajo a la izquierda) o el menú de arriba a la izquierda, y elige **Cerrar sesión** (verificar en cuál de los dos aparece).

### Cómo está acomodado el menú

El menú está a la izquierda. Arriba hay un buscador (**⌘K** en Mac, **Ctrl+K** en Windows) para saltar rápido a cualquier pedido, producto o página.

Le dimos a HETNA un menú agrupado en secciones. Las secciones y su contenido son:

| Sección | Opciones |
|---|---|
| **Principal** | **Centro de control** · **Pedidos** · **Solicitudes** (fabricación) |
| **Marketplace** | **Tiendas** (los talleres) · **Verificaciones** · **Fundadores** · **Productos** · **Inventario** · **Listas de Precios** |
| **Clientes y promoción** | **Clientes** · **Promociones** · **Publicidad** · **Social Hub** · **Blog** |
| **Dinero y envíos** | **Pagos** · **Pagos a talleres** · **Envíos** |
| **Apps HETNA** | **Cotizador** · **Trabajos CAM** |
| Al final, sin título | **Contabilidad**, **Cargar productos**, **Resultados**, **Trabajos reales**, **Categorías ocultas** (verificar el orden exacto) |

Algunas opciones tienen subopciones que se abren al darles clic:

- **Productos** → **Ofertas**, **Colecciones**, **Categorías**
- **Inventario** → **Reservas**
- **Clientes** → **Grupos de Clientes**
- **Promociones** → **Campañas**
- **Tiendas** → **Reviews** (reseñas; es probable que salga en inglés porque Mercur no lo tradujo, verificar)

Hasta abajo está **Configuraciones** (el engrane). Ahí están los ajustes generales y las **Comisiones**.

Si achicas el menú (sólo íconos), los títulos de sección se ocultan.

### Diccionario rápido: cómo se llama cada cosa en pantalla

Mercur usa nombres distintos a los que usamos en HETNA. Tenlo a la mano:

| En HETNA decimos… | En el panel dice… |
|---|---|
| Talleres, vendedores | **Tiendas** |
| Pagos a vendedores (payouts) | **Pagos** |
| Comisiones | **Configuraciones → Comisiones** |
| Taller suspendido | Estado **Inactiva** |
| Taller activo | Estado **Activo** |
| Taller por aprobar | Estado **Pendiente** |
| Taller dado de baja para siempre | Estado **Finalizada** |
| Reseñas | **Reviews** |

> No confundas: la página **Solicitudes** del menú es de HETNA (pedidos de fabricación). Mercur también usa la palabra "solicitud" para las altas de tiendas y de productos. Ésas aparecen dentro de **Tiendas** y **Productos**, no en esa página.

### Idioma

El panel viene en español. Si algún día lo ves en inglés, cámbialo en **Configuraciones → Perfil** (verificar el nombre del campo de idioma).

---

## Parte 2 · Secciones básicas del panel

### Pedidos

**Para qué sirve.** Aquí ves todos los pedidos de la tienda, de todos los talleres.

Una compra puede traer productos de varios talleres. En ese caso, al pagar, el sistema la **divide en un pedido por taller**. Todos esos pedidos quedan unidos en un **grupo de pedidos** con el mismo número para mostrar. Tú ves el grupo completo; cada taller sólo ve su parte en **/seller**.

**Qué ves.** La lista de pedidos con número, fecha, cliente, tienda, estado del pago y estado del envío. La lista agrupa los pedidos que vienen de la misma compra (verificar cómo se ve el grupo en pantalla).

**Tareas que haces aquí:**

1. **Revisar un pedido.** Da clic en él. Verás los productos, el cliente, la dirección, el pago, el envío y el historial.
2. **Ver de qué taller es.** En el detalle aparece la tienda que lo vende. Si viene de una compra con varios talleres, ahí ves el grupo completo.
3. **Reembolsar.** En el detalle del pedido, en la parte del pago, usa **Reembolso** y luego **Crear reembolso**. Elige el monto y confirma.
   - Ojo: la pantalla puede avisarte que algunos pagos son "pagos del sistema" que HETNA CNC no captura ni reembolsa solo. Si el cliente pagó con Mercado Pago o PayPal, confirma en esa plataforma que el dinero sí se devolvió (verificar).
4. **Cancelar un pedido.** Desde el menú del pedido. Verás **"Estás a punto de cancelar el pedido… Esta acción no puede deshacerse."** Hazlo sólo si estás seguro.

**Cuidado.**

- Normalmente el envío lo prepara y lo marca **el taller** desde su panel. Tú intervienes sólo cuando hay un problema.
- Los pedidos de **fabricación a la medida** no están aquí: están en la página **Solicitudes**.

---

### Productos

**Para qué sirve.** Aquí está el **catálogo**: los productos que se ven en la tienda.

En Mercur, cada taller vende un producto por medio de una **oferta**: su propio precio, existencias y envío. Sin oferta, el producto se ve en la tienda pero **no se puede comprar**.

**Cómo está configurado en HETNA:**

- Los productos y los cambios que hacen los talleres **se publican sin tu aprobación**. Así lo decidió HETNA el 28 de octubre de 2026. La confianza se gana con la verificación del taller, no revisando cada producto.
- Cuando un taller borra su propio producto, se aprueba solo (si nadie más vende ese producto).
- Aun así, Mercur puede dejar algunas solicitudes de cambio en revisión. Si en el detalle de un producto ves un cuadro **Solicitud de producto** o **Solicitud de actualización de producto**, decide ahí (verificar si todavía aparecen).

**Tareas que haces aquí:**

1. **Buscar un producto y revisarlo.** Entra a **Productos**, usa el buscador y da clic en el producto. Verás fotos, descripción, variantes, categoría y qué talleres lo venden.
2. **Corregir un producto** (título, fotos, categoría). Da clic en **Editar** en la sección que quieras cambiar y guarda.
3. **Ver o quitar ofertas.** Entra a **Productos → Ofertas** para ver precio y existencias de cada taller.
4. **Atender una solicitud de producto** (si te sale alguna). En el detalle del producto tienes tres botones:
   - **Confirmar**: se publica.
   - **Solicitar actualización**: le pides cambios al taller. Escribe la nota (por ejemplo, "faltan fotos") y da clic en **Enviar**.
   - **Rechazar**: no se publica. Escribe por qué.

Estados de un producto: **Borrador**, **Publicado**, **Propuesto**, **Rechazado**.

**Cuidado.**

- Para que un producto salga en la tienda debe estar **Publicado** y tener al menos una oferta con precio y existencias.
- Las categorías vacías se esconden solas de la tienda. Consulta cuáles en **Categorías ocultas**.
- Para cargar muchos productos de una vez usa la página **Cargar productos** (capítulo 3).

---

### Tiendas (talleres / vendedores)

**Para qué sirve.** Aquí manejas a los talleres: los apruebas, los suspendes, editas sus datos y ves sus productos, pedidos y usuarios.

Estados de una tienda:

| Estado en pantalla | Qué significa |
|---|---|
| **Pendiente** | Se registró, pero todavía no está aprobada. No puede publicar. |
| **Activo** | Puede publicar, vender y cobrar. |
| **Inactiva** | Suspendida. Sus productos siguen en el catálogo, pero no se pueden comprar. Se puede reactivar. |
| **Finalizada** | Cerrada para siempre. No tiene marcha atrás. |

#### Cómo entra un taller nuevo en HETNA (alta automática)

HETNA tiene su propio proceso de alta, encima del de Mercur:

1. El taller se registra en **/seller**. Queda en **Pendiente**.
2. Le llega un correo para **confirmar su correo**. Mientras no lo confirme, no puede publicar.
3. Al confirmarlo, **queda aprobado solo** (pasa a **Activo**). Esto lo activó HETNA el 17 de noviembre de 2026 para que haya más productos.
4. El taller recibe un correo de bienvenida con sus primeros pasos.
5. **A ti te llega un correo**: "Taller nuevo (aprobado automáticamente): [nombre]". Trae su nombre, correo, teléfono y fecha de registro.
6. Al aprobarse, se crea un anuncio del taller nuevo para redes, programado para un día después (así alcanza a llenar su perfil). Queda **en borrador** en el **Social Hub** hasta que lo revises.

Tu trabajo es **revisarlo después**: sus datos y sus primeros productos. Si algo no cuadra, lo suspendes.

Si la aprobación automática falla, o si se apaga, el correo que te llega es **"Taller nuevo por aprobar: [nombre]"**, con un botón para aprobarlo. Ese botón abre una página para confirmar: abrir el correo no aprueba nada.

Los talleres registrados antes del 2 de noviembre de 2026 no tienen que confirmar su correo.

**Tareas que haces aquí:**

1. **Revisar un taller nuevo.**
   1. Entra a **Tiendas**. Puedes filtrar por **Estado**.
   2. Da clic en el taller. Revisa nombre, correo, teléfono, dirección, productos y pedidos.
   3. Si está bien, no tienes que hacer nada más.
   4. Te sirve también revisar sus documentos en **Verificaciones**.

2. **Suspender a un taller.**
   1. Entra a **Tiendas** y abre el taller.
   2. Da clic en **Editar** (en la parte de arriba, junto al estado; verificar la posición exacta).
   3. En **Estado**, elige **Inactiva**.
   4. Guarda.
   5. Si el taller intenta publicar, verá: "Tu tienda está suspendida. Escríbenos por WhatsApp para revisarlo."

   Para reactivarlo, haz lo mismo y elige **Activo**.

3. **Aprobar a mano un taller que se quedó en Pendiente.**
   1. Abre el taller en **Tiendas**.
   2. Si ves el cuadro **Solicitud de tienda**, da clic en **Confirmar**. Puedes dejarle una nota.
   3. Si no quieres aprobarlo, da clic en **Rechazar** y explica por qué. Rechazar lo deja **Inactiva** (suspendida).

4. **Editar datos o agregar un usuario a una tienda.**
   - Datos (nombre, logo, portada, dirección): botón **Editar** en cada sección.
   - Marca **Destacada**: le pone una insignia especial a la tienda.
   - Usuarios: en la sección de usuarios, **Añadir usuario** o **Invitar**.

**Cuidado.**

- **Aprobar con Confirmar desde el panel no es igual que la aprobación automática.** Con **Confirmar** no sale el correo de bienvenida de HETNA ni el anuncio para redes. Además, el taller queda activo aunque no haya confirmado su correo (verificar). Si apruebas a mano, escríbele tú.
- **Finalizada no se puede deshacer.** Sólo se puede cuando el taller ya no tiene pedidos ni pagos pendientes. Para pausar a un taller usa siempre **Inactiva**.
- **Eliminar una tienda tampoco se puede deshacer.** Mejor suspéndela.
- **El botón "Revisar o suspender en el panel" del correo de alta automática puede llevarte a una página que no existe** (la dirección usa /sellers y en el panel la sección es /stores). Si te pasa, entra a **Tiendas** y busca al taller por su nombre.
- **Para encender o apagar la aprobación automática**, pide que cambien estas variables del servidor:

| Variable | Para qué sirve | De fábrica |
|---|---|---|
| `ALTA_AUTOMATICA` | Si vale `false`, vuelves a aprobar a mano a cada taller nuevo. | Encendida |
| `ALTA_TALLER_AVISAR` | Correo(s) que reciben el aviso de taller nuevo. | Si está vacía, usa `CONTROL_AVISOS_PARA` o el primer correo de la casa |
| `ALTA_TALLER_DESDE` | Fecha a partir de la cual los talleres nuevos deben confirmar su correo. | 2 de noviembre de 2026 |

---

### Clientes

**Para qué sirve.** Aquí están las personas y empresas que compran o cotizan en la tienda.

**Tareas que haces aquí:**

1. **Buscar a un cliente.** Entra a **Clientes** y búscalo por nombre o correo. En su detalle ves sus datos, sus direcciones y sus pedidos.
2. **Corregir sus datos.** Da clic en **Editar** y guarda.
3. **Agruparlos.** En **Clientes → Grupos de Clientes** puedes crear grupos (por ejemplo, "Mayoristas"). Los grupos te sirven para darles promociones o listas de precios especiales.

**Cuidado.**

- La **Membresía Empresarial** de un cliente no se activa aquí, sino en **Verificaciones** (capítulo 4).
- Los clientes de las solicitudes de fabricación aparecen con su contacto dentro de la página **Solicitudes**.

---

### Comisiones

**Para qué sirve.** Aquí defines cuánto se queda HETNA de cada venta de un taller. Está en **Configuraciones → Comisiones**.

Cómo funciona:

- Hay una **Comisión global**: es la que se aplica cuando no hay una regla más específica.
- Puedes crear **reglas de comisión** para casos especiales: por **Tienda**, por **Tipo de producto**, por **Categoría**, o combinados (**Tienda + Categoría**, **Tienda + Tipo de producto**).
- Si varias reglas aplican a una venta, gana **la más específica**. Una regla de "Tienda + Categoría" gana sobre una de sólo "Categoría", y ésta gana sobre la global.
- La comisión puede ser un **porcentaje** de la venta o una **cantidad fija** por pedido.
- Puedes decidir si se calcula con el **impuesto incluido** y con el **envío incluido**. Si no lo incluyes, el impuesto o el envío van completos al taller.

**Tareas que haces aquí:**

1. **Cambiar la comisión global.**
   1. Entra a **Configuraciones → Comisiones**.
   2. En **Comisión global**, da clic en editar (**Editar comisión global**).
   3. Cambia el valor y guarda.
2. **Crear una comisión especial** (por ejemplo, menos comisión para un taller fundador).
   1. Da clic en **Crear regla de comisión**.
   2. Ponle nombre y código.
   3. Elige el **Tipo** de alcance (por ejemplo, **Tienda**) y elige la tienda.
   4. Elige porcentaje o fijo y escribe el valor.
   5. Deja **Habilitado** encendido y guarda.
3. **Pausar una regla.** Ábrela, apaga **Habilitado** y guarda. Para borrarla, usa **Eliminar regla de comisión**. No se puede deshacer.

**Cuidado.**

- **Los cambios aplican a las ventas nuevas.** Los pedidos que ya se calcularon guardan la comisión que tenían.
- **Esta comisión es la que se le descuenta al taller en Pagos a talleres** (productos − comisión de HETNA + envío).
- **Un error de traducción de Mercur:** en el tipo de comisión, la opción de porcentaje dice **"Valor de la promoción"**. Es el porcentaje; la otra opción es **Fijo**.
- La comisión del **Cotizador** (anticipos con PayPal) es otra cosa y se cobra sola el día 1 de cada mes. No se configura aquí.

---

### Pagos (payouts)

**Para qué sirve.** En Mercur, **Pagos** es la lista de transferencias automáticas del dinero de cada venta a la cuenta del taller, ya sin la comisión. Cada pago tiene un estado: **Pendiente**, **Procesando**, **Pagado**, **Fallido** o **Cancelado**.

**Cómo funciona en HETNA.** Esos pagos automáticos necesitan un proveedor de pagos a vendedores (como Stripe Connect). HETNA cobra con **Mercado Pago** y **PayPal**, y **no tiene ese proveedor configurado**. Lo más probable es que esta lista esté vacía (verificar).

**Lo que sí usas para pagarle a los talleres** es la página **Pagos a talleres** (capítulo 3): ahí ves cuánto se le debe a cada uno, le transfieres por SPEI a la cuenta que guardó en su perfil y lo marcas como pagado con la clave de rastreo.

**Tareas que haces aquí:**

1. **Revisar si hay algún pago.** Entra a **Pagos** y da clic en uno para ver su detalle (taller, monto, estado).
2. **Si ves alguno Fallido**, avisa a soporte técnico. No intentes repetirlo desde aquí.

---

### Promociones

**Para qué sirve.** Aquí creas códigos de descuento y ofertas para la tienda.

**Tareas que haces aquí:**

1. **Crear un código de descuento.**
   1. Entra a **Promociones** y da clic en crear.
   2. Elige el tipo (por ejemplo, porcentaje de descuento o cantidad fija).
   3. Escribe el código que va a teclear el cliente (por ejemplo, BUENFIN10).
   4. Define a qué aplica y las condiciones (productos, monto mínimo, etc.).
   5. Guarda y actívala.
2. **Agrupar promociones en una campaña** con fechas y presupuesto: **Promociones → Campañas**.
3. **Pausar o editar una promoción.** Ábrela y cambia su estado o sus datos.
4. **Precios especiales** para un grupo de clientes o por temporada: usa **Listas de Precios** (en la sección Marketplace del menú).

**Cuidado.**

- Una promoción mal configurada puede descontar más de lo que quieres. Pruébala con un carrito antes de anunciarla.
- Quién absorbe el descuento (HETNA o el taller) depende de la configuración de Mercur (verificar antes de lanzar una promoción grande).
- Las publicaciones automáticas de productos en redes (página **Publicidad** y **Social Hub**) no son descuentos: no tienen que ver con esta sección.

---

### Configuraciones

**Para qué sirve.** Aquí están los ajustes generales del marketplace. Casi no vas a entrar, salvo para comisiones y usuarios.

Está hasta abajo del menú (el engrane). Tiene tres grupos:

**General:**

| Opción | Para qué la usas |
|---|---|
| **Marketplace** | Datos generales del marketplace: nombre, monedas. |
| **Usuarios** | Invitar o quitar personas que entran al panel. |
| **Regiones** | Países y monedas en los que vende la tienda (México, pesos). |
| **Regiones Impositivas** | Impuestos (IVA). |
| **Razones de Devolución** / **Motivos de reembolso** | Las opciones que se eligen al devolver o reembolsar. |
| **Canales de Venta** | Dónde se venden los productos (la tienda en línea). |
| **Tipos de Producto** / **Etiquetas de Producto** / **Atributos de producto** | Cómo se clasifican y describen los productos. |
| **Ubicaciones & Envío** | Almacenes y opciones de envío. |
| **Comisiones** | Ver la sección **Comisiones** de arriba. |

**Desarrollador:** **Claves API Publicables** y **Claves API Secretas**. **No las toques** sin soporte técnico: si borras una, la tienda o alguna automatización deja de funcionar.

**Mi cuenta:** **Perfil**, para tu nombre, tu idioma y tus preferencias.

**Tareas que haces aquí:**

1. **Invitar a alguien al panel.** **Configuraciones → Usuarios → Invitar Usuario**. Escribe su correo. Si no le llega correo, copia la liga de la invitación y mándasela tú (verificar).
2. **Quitarle el acceso a alguien.** **Configuraciones → Usuarios**, abre a la persona y elimínala.
3. **Cambiar comisiones.** **Configuraciones → Comisiones**.

**Cuidado.**

- Cambiar **Regiones**, **Regiones Impositivas** o **Ubicaciones & Envío** afecta precios, impuestos y envíos de **todos** los talleres. Si tienes duda, pregunta antes.
- Cada persona que invites puede ver todo el marketplace: datos de clientes, talleres y dinero. Invita sólo a gente de confianza.


---

# Capítulo 2. Social Hub

> Dónde está: en el panel de administración, menú lateral → **Social Hub** (verificar la dirección exacta de tu panel).
> Lo que dice este capítulo sale del código del sistema. Lo que conviene confirmar en la práctica está marcado con "(verificar)".

---

## 1. Qué es y para qué sirve

El Social Hub es la central de redes sociales de HETNA. Desde una sola pantalla creas publicaciones, las programas, las publicas, contestas comentarios y ves qué publicación trajo clics, registros y ventas.

No tienes que escribir todo tú. Muchas publicaciones llegan solas: cuando un cliente autoriza difundir su licitación, cuando entra un taller nuevo, cuando se sube un producto o cuando alguien abre un tema en el foro. Además, cada domingo el sistema arma el plan de la semana siguiente y escribe los borradores. La inteligencia artificial (IA) adapta cada texto al estilo de cada red y nunca debe inventar precios ni datos.

Cada publicación lleva su propia **liga medida** (una liga corta del tipo `hetnacnc.com/r/xxxxxxx`, una por red). Así el sistema sabe cuántas personas dieron clic desde cada red y qué hicieron después: si se registraron, si pidieron cotización o si compraron. Con eso puedes repetir lo que vende y dejar de hacer lo que no.

---

## 2. Antes de empezar: conectar las redes

### 2.1 Qué redes hay y cómo sale cada una

Hay dos tipos de red:

- **Automáticas**: el sistema publica solo.
- **A mano** (en pantalla se marcan con ✋): el sistema te deja el texto listo con su liga medida y tú lo copias y lo pegas en la red.

| Red (como aparece en pantalla) | Cómo sale | Qué necesita |
|---|---|---|
| Facebook (página) | Automática, por n8n | Conexión a Facebook en n8n |
| Instagram | Automática, por n8n | **Imagen o video obligatorio.** La liga no se puede tocar: el texto dice "liga en la bio" |
| Instagram (historia) | Automática, por n8n | Imagen o video obligatorio. El texto no se publica |
| Telegram (canal) | Automática, por n8n | Conexión en n8n |
| LinkedIn (empresa) | Automática, por n8n | Conexión en n8n |
| Discord | Automática, por n8n | Conexión en n8n |
| Threads | Automática **sólo si** el servidor tiene `THREADS_TOKEN`; si no, a mano | Token de Threads (ver 2.3) |
| TikTok | Si conectas TikTok y la publicación tiene **video**, llega como **borrador** a la app de TikTok; tú le pones sonido y le das publicar. Si no, a mano | Botón **Conectar TikTok** (ver 2.3) |
| Pinterest | Si conectas Pinterest y la publicación tiene **imagen**, sale sola como pin. Con video, a mano | Botón **Conectar Pinterest** y elegir tablero |
| YouTube (Shorts) | Automática **sólo si** marcas la casilla de YouTube en Configuración; si no, a mano | YouTube conectado en n8n |
| Google (ficha de Maps) | A mano | — |
| Grupos de Facebook | A mano | — |
| WhatsApp (compartir) | A mano | — |
| Reddit | A mano | — |

Si una red **automática** que pide imagen (Instagram, Instagram historia, y YouTube cuando su casilla está encendida) no tiene imagen ni video, marca el error "Esta red necesita una imagen.". TikTok sin video y Pinterest sin imagen no marcan error: simplemente quedan como "✓ lista para pegar" (a mano). Google siempre es a mano.

### 2.2 n8n: el "cartero" que publica

Casi todo lo automático (Facebook, Instagram, Telegram, LinkedIn, Discord, YouTube, leer comentarios y estadísticas, mensajes privados de Telegram) pasa por un flujo de n8n llamado **"Social Hub - Publicar"**. Las conexiones con Facebook e Instagram (tokens, permisos) viven **dentro de n8n**, no en el panel (verificar en tu n8n).

Para que funcione, el servidor necesita en `packages/api/.env`:

- `N8N_REDES_URL` (o `N8N_SOCIAL_URL`): la dirección del flujo.
- `N8N_REDES_TOKEN`: la contraseña compartida entre el servidor y n8n.

**Cómo revisarlo:** ve a la pestaña **Configuración** y baja hasta el final. Si dice **"✓ Conectado a n8n (flujo Social Hub - Publicar)."** está bien. Si dice **"✗ Falta configurar N8N_REDES_URL en el servidor."** falta esa variable (sirve también `N8N_SOCIAL_URL`; el letrero sólo menciona la primera).

> Ojo: ese letrero sólo revisa que la variable exista, no que n8n conteste. Para probar de verdad usa los botones **Probar Instagram** y **Probar YouTube** (ver abajo).

### 2.3 Paso a paso para conectar cada red

Todo esto está en la pestaña **Configuración**, arriba, en la sección "Redes para las publicaciones automáticas".

**Instagram**
1. Aprieta **Probar Instagram**.
2. Si sale "✓ Instagram conectado (@usuario). Ya puedes activarlo abajo.", ya está.
3. Si sale "✗" con un error, el problema está en la conexión de n8n (ver sección 8).

**Threads**
1. Pon el token de Threads en `packages/api/.env` como `THREADS_TOKEN` y vuelve a desplegar el servidor.
2. Aprieta **Probar Threads**. Debe decir "✓ Threads conectado (@usuario)".
3. El token de Threads dura 60 días. El sistema lo renueva solo cada lunes. Si cambias el token del `.env`, el sistema usa el nuevo.

**YouTube**
1. Conecta YouTube dentro de n8n (verificar).
2. Aprieta **Probar YouTube**. Debe decir "✓ YouTube conectado (canal, N suscriptores)".
3. Marca la casilla **"YouTube conectado en n8n: los videos verticales salen solos como Shorts"** y aprieta **Guardar**. Sin esa casilla, YouTube queda para copiar y pegar.

**TikTok**
1. El servidor necesita `TIKTOK_CLIENT_KEY` y `TIKTOK_CLIENT_SECRET`. Si faltan, la tarjeta dice **"Faltan las llaves en el servidor"**.
2. Aprieta **Conectar TikTok**. Se abre TikTok en otra pestaña.
3. Entra con la cuenta de HETNA y acepta.
4. Cuando la página diga "TikTok conectado", regresa y aprieta **Probar**. Debe decir "✓ Conectado como …".
5. Botones extra: **Volver a conectar** y **Desconectar**.
6. Importante: el video llega como **borrador** a la bandeja de la app de TikTok. El texto para pegar te llega **por Telegram** (necesitas tener Telegram vinculado, ver 4.7).

**Pinterest**
1. El servidor necesita `PINTEREST_APP_ID` y `PINTEREST_APP_SECRET`. Si faltan, la tarjeta te dice también qué "URI de redireccionamiento" poner en la app de Pinterest.
2. Aprieta **Conectar Pinterest**, entra con la cuenta de HETNA y acepta.
3. Regresa y aprieta **Probar**.
4. En la lista **Elige el tablero**, escoge dónde saldrán los pines. Sale "✓ Tablero guardado".

**WhatsApp** (tarjeta "💬 WhatsApp")
Esta tarjeta no publica en redes. Sirve para el WhatsApp de HETNA que manda avisos a talleres y clientes verificados. Ver la sección 3.12.

### 2.4 Qué revisar antes de usarlo en serio

- [ ] Abajo de Configuración dice "✓ Conectado a n8n".
- [ ] **Probar Instagram** sale con ✓.
- [ ] En **Redes para las publicaciones automáticas** sólo están encendidas (en azul oscuro) las redes que de verdad funcionan.
- [ ] Telegram vinculado (para aprobar desde el celular).
- [ ] Hay llave de IA (`ANTHROPIC_API_KEY`). Sin ella, los textos salen con plantillas fijas, **🧠 Mejorar con IA** no funciona y los comentarios no reciben respuesta propuesta.

---

## 3. Recorrido por la pantalla

Arriba ves el título **Social Hub** y una fila de pestañas. Al abrir la pantalla siempre empieza en **Pendientes**. Las pestañas, en el orden de la pantalla, son:

**Referencias · Fábrica · Estrategia · Radar · Pendientes · Videos de talleres · Calendario · Publicadas · Conversaciones · Resultados · Campañas Ads · Configuración**

**Pendientes** y **Calendario** muestran entre paréntesis cuántas publicaciones tienen.

### 3.1 Referencias

Aquí le "enseñas" al sistema lo que te gusta.

- Campo **"¿Qué te gusta de esta pieza?"**: escribe qué te gusta (el humor, el ritmo, la infografía…).
- **+ Subir imagen o video**: sube una pieza de cualquier marca. Si el video es grande, usa uno de menos de 25 MB.
- Campo **"…o pega una liga (TikTok, YouTube, Instagram)"** y botón **Agregar liga**. Ojo: de las ligas el agente no puede ver el video. Descríbelo bien en la nota.
- Sección **📘 Guía de estilo HETNA**:
  - **🧠 Armar guía con mis referencias**: la IA escribe la guía con lo que subiste.
  - **Guardar cambios**: guarda lo que edites a mano en el cuadro de texto.
  - Según la pantalla, todos los agentes leen esta guía antes de escribir o diseñar (verificar).
- Sección **Tus referencias (N)**: cada pieza muestra su análisis (Formato, Gancho, Estructura, Estilo visual, etc.). Botones **Volver a analizar** y **Quitar**. Mientras se analiza dice "⏳ Analizando…". La lista se actualiza sola cada 15 segundos.

Recomendación de la propia pantalla: sube de 5 a 10 piezas para empezar.

### 3.2 Fábrica

Es la fábrica de contenido: produce videos e imágenes. Arriba puede salir un aviso:
- "Falta FFmpeg en el servidor…": no se pueden hacer videos cortos.
- Estado de **RunPod** (la computadora con GPU para voz, imágenes con IA y video largo). Si dice "RunPod sin configurar", la Fábrica funciona pero sin voz, sin imágenes con IA y sin video largo.

**Del guion a todas las redes**
- Cuadro **Guion**: pega lo que quieres explicar. Debajo te dice cuántas palabras llevas y cuánto duraría el video largo (unas 145 palabras por minuto).
- Campo **"…o sólo el tema"**: si no tienes guion.
- Listas **Público**, **Mercado**, **Fondo**, **Voz** y casilla **Imágenes con IA en el video largo**.
- **Producir paquete**: hace 5 cortos verticales, un carrusel, la publicación de cada red, el material del video largo de YouTube y un artículo para Aprendizaje CNC. Todo queda en borrador.

**🎥 Sube tu video grabado**
- **+ Elegir video**: hasta 95 MB (MP4, MOV o WebM). La IA lo transcribe, le pone subtítulos y saca los 5 mejores momentos como cortos. Usa el Público, Mercado y Voz que elegiste arriba.

**🎬 Estudio diario (video con IA)**
- Casilla **Hacer uno cada día (de madrugada)**.
- **🎬 Hacer el de hoy**, **Hacer uno educativo / de novela**, **Actualizar**.
- Muestra si está "Listo para trabajar" o qué falta, y el gasto del día y del mes en dólares.
- Sub-sección **📊 Datos**: **Conectar Google (YouTube)**, **Revisar tendencias**, **Revisar retención**, y campo para **Agregar referencia**. Necesita `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET` en el servidor.

**📅 Fechas especiales: videos de productos**
- Cada fecha (Día de las Madres, Muertos, Navidad…) muestra cuántos días faltan, si está "En temporada" y cuántos productos tienen su etiqueta.
- Casilla **Activa**, botón **🎬 Hacer video ahora**, botón **📨 Invitar a talleres** (aparece cuando faltan 45 días o menos).
- Campo **Etiquetas o categorías** con su botón **Guardar**.
- Si ningún producto tiene la etiqueta, no se hace video. Ponle la etiqueta al producto en Productos.

**🛍️ Buen Fin**
- Casilla **Activo**, fechas **Del … al …**, campo **Descuento**, campo **Cupón** (debe existir en Promociones), campo **Etiqueta de los productos con descuento**, botones **Guardar** y **🎬 Hacer ahora**.
- Sin fechas y descuento no se publica nada. Nada sale después del último día.

**Paquetes**
- Botones para promover: **🛒 Promover un producto**, **📚 Promover un artículo**, **💰 Promover el Cotizador**, **🧊 Promover 3D Studio (foto a STL)**, **🇺🇸 Cotizador en inglés**, **🇺🇸 3D Studio en inglés**, **🧰 Promover una herramienta**, **📡 Radar por estado (para talleres)**, **🏭 Talleres listos (para clientes)**. En 1 a 10 minutos aparecen en Pendientes.
- **Generar piezas semanales ahora**.
- **🎵 Biblioteca de fondos y música**: sube fondos por tema (**+ Subir foto**, **✨ Generar 4 con IA** si hay RunPod) y música con licencia (**+ Subir audio (MP3)**). Anota siempre la fuente y la liga de la licencia.
- Cada paquete muestra su estado: **En cola**, **Produciendo…**, **Listo** o **Error**. Botones **Revisar borradores →**, **Reintentar** / **Producir de nuevo**, **⬇ Descargar video largo**, **⬇ Descargar tu video con subtítulos**. La lista se actualiza sola cada 8 segundos mientras algo se produce.

> El detalle interno de la Fábrica está fuera de este capítulo (verificar en el capítulo de Fábrica si existe).

### 3.3 Estrategia

Arriba está el **Plan de la semana**. Abajo, la configuración de la estrategia.

**Plan de la semana del (fecha)**
- Al abrir, muestra la **semana siguiente**.
- **◀** y **▶**: semana anterior o siguiente.
- **1. Armar plan**: crea los "huecos" de la semana (qué red, día, hora, público, tema y formato). Si ya había plan, dice "Esa semana ya tenía plan.".
- **2. Escribir borradores (N)**: el agente escribe un borrador por cada hueco vacío. Puede tardar un par de minutos. Se apaga si no hay huecos vacíos.
- **📚 Todo el temario**: casillas por público con "(pendientes de total)" y botón **Generar todo el temario ahora (N)**. Hace un borrador por cada tema que no ha salido en 30 días, uno por día a las 7 pm (hora del centro), empezando mañana. **Estos no se aprueban solos**: los revisas tú.
- La tabla muestra cada hueco: hora, red, formato, público, tema y estado. Si el hueco ya tiene borrador, el estado es un enlace (por ejemplo **Borrador por revisar →**) que te lleva a Pendientes o Calendario.

**Mercados**
- Un porcentaje por país (0 = apagado). Todos salen en las mismas cuentas de HETNA, cada uno en su idioma y a su hora local.

**Guía por red (lo que premia cada algoritmo)**
- Tabla con: qué premia la red, formatos y días, dónde va la liga y cuántos hashtags.
- Puedes cambiar **Por semana** (cuántas publicaciones) y **Horas (local)** (separadas por comas).

**Públicos y temas**
- Un cuadro por público (Empresas, Particulares, Talleres, Proveedores…). **Un tema por línea.**

**Guardar estrategia**: guarda todo. Dice "Guardado. Se aplica al próximo plan.".

### 3.4 Radar

Cada mañana el Radar busca en internet clientes que necesitan fabricar, talleres para invitar, temas de contenido, competencia, ferias y menciones de HETNA. Sólo información pública.

- Filtros por tipo: **Todos**, **🎯 Clientes**, **🏭 Talleres**, **💡 Contenido**, **👀 Competencia**, **📅 Eventos**, **🔔 Menciones**.
- Lista desplegable: **Nuevos**, **Guardados**, **Convertidos en publicación**, **Descartados**.
- **⚙ Búsquedas**: abre la lista de búsquedas. Cada una tiene casilla de activa, tipo, mercado, texto, **Buscar ahora** y **✕**. Abajo: **+ Agregar búsqueda** y **Guardar búsquedas**. "Buscar ahora" tiene un costo pequeño en tu cuenta de Claude.
- Cada hallazgo muestra estrellas de relevancia, **Fuente ↗**, la acción sugerida y, si hay, **Mensaje sugerido para escribirles** con **Copiar mensaje**.
- Botones: **Crear publicación** (sólo en contenido, eventos, competencia y menciones; crea un borrador en Pendientes), **Guardar**, **Descartar**.
- Las invitaciones a talleres o clientes las mandas tú, una por una.

### 3.5 Pendientes (la pestaña principal)

Aquí está todo lo que necesita tu atención: publicaciones en **Borrador**, **Error** o **Parcial**.

**Nueva publicación** (la caja de arriba)
- **Título interno**: sólo lo ves tú (ej. "Promoción de corte láser").
- **¿Qué quieres decir?**: el texto base. La IA lo adapta a cada red. La liga medida se agrega sola.
- **Liga de destino en hetnacnc.com**: a dónde lleva el clic. Debe empezar con `https://`. Por defecto `https://hetnacnc.com/mx`.
- **Botones de redes**: en azul oscuro las elegidas. Vienen marcadas las de Configuración. La ✋ indica "copiar y pegar". Si pasas el mouse encima te dice cómo sale.
- **Mercado**: el país. La IA escribe en el idioma y modismos de ese país.
- **+ Imagen**: sube una imagen JPG, PNG o WebP. Cambia a "✓ Imagen lista".
- **Programar (opcional)**: fecha y hora.
- **Crear**: se activa cuando hay título y texto. Mientras trabaja dice "Preparando textos…". Al terminar: "Lista. Revisa abajo el texto de cada red.".
  - **Sin fecha** → queda como **Borrador** en Pendientes.
  - **Con fecha** → queda directamente **Programada** (se va al Calendario, sin pasar por borrador).

**Filtrar**
- Botones por red (**Todas**, Facebook, Instagram…) con su conteo.
- **Todos los países** / un país.
- **Con o sin material**, **🎬 Con video**, **🖼️ Carrusel**, **🖼 Con imagen**, **⚠ Sin imagen ni video**.

**La tarjeta de cada publicación**
En la línea de arriba ves: estado (en color), de dónde viene (Manual, Licitación, Taller nuevo, Producto, Foro, Video de taller, Promociones), etiquetas como **❤ emoción** o **🅰 Prueba A/B**, el título, la fecha y los clics y conversiones. Haz clic en esa línea para abrirla o cerrarla (▼/▲). Los borradores y los errores vienen abiertos.

Al abrirla:
- Vista de la imagen o el video.
- Si es de otro país: "🌎 Mercado: XX".
- **🎬 Notas** (por ejemplo, el guion del video; no se publica).
- **+ Agregar imagen o video** / **Cambiar imagen o video**: sube el archivo y lo guarda al momento.
- **Botones de redes**: puedes quitar o agregar redes.
- **Un cuadro de texto por red**, con:
  - el nombre de la red,
  - **Algoritmo NN**: el puntaje (verde 80 o más, ámbar 55 a 79, rojo menos de 55). Clic para ver qué cumple ✓ y qué falla ✗ con su consejo,
  - "✋ copiar y pegar" si es manual,
  - el resultado de la última publicación: "✓ publicada", "✓ lista para pegar", "⏳ Instagram la está procesando…" o "✗ el error",
  - **ver ↗** para abrir la publicación en la red,
  - el conteo de **caracteres** (en rojo si se pasa del máximo de la red),
  - **Copiar**: copia el texto ya con la liga medida puesta. Ojo: las ligas medidas se crean **al publicar**. Antes de publicar, "Copiar" te da el texto con `{{liga}}` literal y la tabla de ligas está vacía. Para las redes a mano: primero publica (o "Lo antes posible") y después copia.
  - **No borres `{{liga}}`** del texto: ahí el sistema pone la liga medida al publicar.
- Botones de acción:
  - **Guardar cambios**: guarda textos y redes. **Aprieta Guardar cambios antes de usar ✨, 🧠 o ↩**: esos botones trabajan con lo guardado y reemplazan lo que tengas en los cuadros.
  - **✨ Reescribir textos**: vuelve a escribir todos los textos desde el texto base. **Borra lo que hayas editado a mano** y no se puede deshacer con "Deshacer mejora".
  - **🧠 Mejorar con IA**: el revisor corrige gancho, llamada a la acción, largo y hashtags sin inventar datos. Tarda de 10 a 30 segundos. Las redes que mejoró se pintan de verde con "🧠 mejorado por la IA". Sólo guarda una red si su puntaje no baja.
  - **↩ Deshacer mejora**: aparece después de una mejora. Regresa a los textos de antes.
  - **Campo de fecha y hora** + **⏰ Programar** (si pusiste fecha) o **⏰ Lo antes posible** (si lo dejaste vacío). Primero guarda y luego programa.
  - **🚀 Publicar ahora**: guarda y publica en ese momento.
  - **Descartar** (rojo): la manda a "Descartada" y desaparece de las listas. Ninguna pestaña muestra las descartadas: no se pueden recuperar desde la pantalla.
- **Liga medida para pegar en un grupo o comunidad**: escribe el nombre del grupo (ej. "CNC México FB") y aprieta **Crear y copiar**. Te crea una liga sólo para ese grupo y la copia. Así sabes qué grupo trae más gente.
- **Tabla de ligas**: cada liga con su red o 👥 grupo, la dirección, los clics y lo que pasó después (registros, solicitudes, ventas).
- Mensaje verde o rojo con el resultado de la última acción.

Si no hay nada: "Nada pendiente: todo lo automático está saliendo solo.".

### 3.6 Videos de talleres

Videos que suben los talleres desde "Promociona tu taller", con su autorización registrada.

- Cada video muestra: el taller, la descripción, el tamaño, cuándo autorizó y qué versión del texto de autorización aceptó.
- **Botones de redes**: dónde saldrá (vienen las de Configuración).
- **✓ Aprobar y programar**: crea la publicación con crédito y liga al perfil del taller. Queda **programada para 15 minutos después** (dentro del horario). Al taller le llega un correo.
- Campo **Motivo (si lo rechazas)** + **Rechazar**. Si escribes motivo, se lo mandan por correo al taller.
- Antes de aprobar revisa que no salga información confidencial del cliente ni música con derechos.

### 3.7 Calendario

Todas las publicaciones **Programadas**, agrupadas por día y en orden de hora. Cada una es la misma tarjeta de Pendientes (puedes editarla, reprogramarla, publicarla ya o descartarla). Tiene los mismos filtros.

### 3.8 Publicadas

Las publicaciones con estado **Publicada** (todas las redes automáticas salieron bien). Mismas tarjetas y filtros. Las **Parcial** no están aquí: están en Pendientes.

### 3.9 Conversaciones

Comentarios de Instagram y Facebook con la respuesta que propone la IA.

- Filtros: **Por responder** (el que abre por defecto), **Respondidos**, **Ignorados**, **Con error**, **Todos**.
- **Leer comentarios ahora**: no esperes los 15 minutos. Te dice "Comentarios nuevos: N.".
- Cada comentario muestra: 📸 Instagram o 📘 Facebook, el autor, la categoría (❓ pregunta frecuente, ❓ pregunta, 👏 elogio, ⚠️ queja, 🚫 spam, 💬 otro) y en qué publicación fue.
- Cuadro **Escribe la respuesta**: viene con la propuesta de la IA; puedes cambiarla.
- **✅ Enviar respuesta**: la publica debajo del comentario.
- **🗑 Ignorar**.
- Los respondidos muestran "✓ Respondido: …".

### 3.10 Resultados

De arriba hacia abajo:

1. **💰 Qué publicación vende (últimos 90 días o más)**: cuadros con totales de **Clics**, **Registros**, **Pruebas Cotizador**, **Pagos** e **Ingresos**, y tabla de las 20 publicaciones que más venden. Los pagos que llegan después se cuentan a la publicación por la que esa persona se registró (hasta 120 días).
2. **📣 Anuncios en Meta (impulsar lo que ya funcionó)**: ver 3.10.1.
3. **🧠 Lo que estamos aprendiendo (Facebook e Instagram)**: botón **Leer estadísticas ahora**. Muestra frases con conclusiones (sólo cuando hay 3 o más publicaciones por grupo), y tablas **Por formato**, **Por mercado**, **Por hora (local)** y **Por emoción**, más **Publicaciones con más interacción**. "Puntos de interacción" = me gusta + comentarios×2 + compartidos×3 + guardados×3.
4. Botones **7 días**, **30 días**, **90 días**: cambian el periodo de las tres tablas de abajo. (La sección 💰 siempre usa al menos 90 días y la de aprendizaje al menos 60.)
5. **Por red**: clics, clientes nuevos, talleres nuevos, solicitudes y ventas (con monto) por red.
6. **Comunidades que más traen**: las ligas de grupos que creaste con "Crear y copiar".
7. **Publicaciones que más traen**: clics y conversiones por publicación.

#### 3.10.1 Anuncios en Meta

**Esto sí cuesta dinero.** Nada se lanza sin que lo apruebes.

- Si falta `META_ADS_TOKEN` en el servidor sale en rojo: "Falta el token de anuncios…". Mientras falte no se propone ni se lanza nada.
- Casilla **Prendido**.
- **Cuenta publicitaria**: el número de tu cuenta de anuncios de Meta.
- **Presupuesto por semana (MXN)** y **Días por anuncio** (3 a 14).
- **Guardar**.
- **Buscar propuesta ahora**: sólo funciona si está prendido.
- Debajo te dice el mínimo diario de Meta y el tope del sistema. Si pones menos del mínimo semanal, no se puede prender.
- Cada anuncio: estado (**Propuesta: falta tu aprobación**, **Lanzando…**, **Activo**, **Terminado**, **Rechazado**, **Error (quedó en pausa, no gasta)**), gasto diario, días, máximo total, motivo y resultados (gasto, alcance, clics).
  - En propuesta: **Aprobar y lanzar** (te pide confirmar el máximo) o **Rechazar**.
  - Activo: **Pausar ya**.

### 3.11 Campañas Ads

El motor arma una campaña completa con los datos reales del sistema. **No se gasta nada hasta que tú la actives.**

- Campos: **Qué vender**, **Objetivo** (Visitas (clics), Registros, Ventas), **Zona**, **Presupuesto por día (MXN)**, **Días**.
- Casillas de plataforma: **Meta (Facebook e Instagram)**, **Google Ads (búsqueda)**, **TikTok Ads**.
- **Generar campaña**: tarda 1 o 2 minutos. La lista se actualiza sola cada 10 segundos.
- Cada campaña: estado (**Armando…**, **Lista**, **Creada en Meta (en pausa)**, **Error**), **Ver campaña** / **Cerrar**, **Borrar**.
- Dentro:
  - **Meta**: 3 versiones de texto. **Crear en Meta (en pausa)** la crea en tu cuenta en pausa. Luego aparece **Abrir en el Administrador de anuncios →**.
  - **Google Ads**: grupos, palabras clave, títulos y descripciones. **Descargar para Google Ads Editor** baja un archivo; ábrelo en Google Ads Editor: Cuenta → Importar → Desde archivo.
  - **TikTok Ads**: textos con **Copiar** y la liga con **Copiar liga** para pegar en TikTok Ads Manager.
- Para Meta necesitas el token y la cuenta de la sección Anuncios en Meta (pestaña Resultados).

### 3.12 Configuración

De arriba hacia abajo:

1. **Redes para las publicaciones automáticas**
   - **Probar Instagram**, **Probar Threads**, **Probar YouTube**.
   - Tarjetas **🎵 TikTok**, **📌 Pinterest** y **💬 WhatsApp** (ver abajo).
   - **Botones de redes**: las que quedan en azul oscuro son las redes por defecto para lo automático y para "Nueva publicación". Al inicio vienen Facebook y Telegram.

2. **¿Qué sale solo y qué espera tu visto bueno?** Una casilla por tipo:
   - **Licitación**, **Taller nuevo**, **Producto**, **Foro**, **Promociones diarias (producto, blog y herramientas con imagen y video)**.
   - Marcada = "se publica sola". Sin marcar = "queda en borrador para que la revises".
   - Al inicio: las cuatro primeras marcadas y Promociones sin marcar.
   - La casilla de Promociones también decide si salen solas las piezas del Estudio diario y las de Fechas especiales (verificar).
   - Las licitaciones sólo se publican si el cliente lo autorizó, y siempre con el resumen sin datos privados.

3. **Horario de publicación (centro de México)**: **de** (hora) **a** (hora) y **esperar N min antes de publicar lo automático**. Al inicio: de 9 a 20 h y 10 minutos. Cada país usa este mismo horario pero en su hora local.

4. **🤖 Piloto automático**
   - **Activar piloto automático · puntaje mínimo** (40 a 100; al inicio 75, apagado).
   - Casillas:
     - **Primer comentario automático con la liga en Facebook** (necesita el permiso `pages_manage_engagement`). Encendida al inicio.
     - **Imágenes con el estilo nuevo**. Encendida al inicio.
     - **Videos animados (estilo «¿Máquina parada?»)**. Apagada al inicio.
     - **YouTube conectado en n8n: los videos verticales salen solos como Shorts**. Apagada al inicio.
     - **Respuestas automáticas: la IA contesta sola las preguntas frecuentes y los elogios**. Apagada al inicio.

5. **📲 Aprobar desde Telegram**
   - Si no está vinculado: **Generar código** → te da un código de 6 dígitos → **Ya lo mandé**.
   - Si está vinculado: "✓ Tu Telegram está vinculado.", **Mandarme los borradores ahora** y **Desvincular**.
   - **Mándame los borradores del día a las N h (centro de México)**. Al inicio 8.

6. **Guardar**: guarda todo lo de esta pestaña (menos Telegram, TikTok, Pinterest y WhatsApp, que se guardan con sus propios botones).

7. Al final, el letrero de n8n.

**Tarjeta 💬 WhatsApp** (no publica en redes; manda avisos a quien verificó su número):
- Estado: **Conectado**, **Desconectado (…)** o **Faltan las llaves en el servidor**. Cuántos números verificados, talleres, clientes y bajas.
- **Reconectar (QR)** / **Ver estado**: muestra un código QR. Escanéalo desde el celular de HETNA: WhatsApp → ⋮ → Dispositivos vinculados → Vincular un dispositivo.
- **Recibir mensajes**: hace que los mensajes que llegan pasen al sistema (verificación, BAJA y fotos).
- Campo **Tu celular a 10 dígitos** + **Mandar prueba**.
- Casilla **Agente de ventas**: contesta a quien escribe como un vendedor, sólo con datos reales. Los clientes calientes te llegan por Telegram. Si contestas tú desde el celular, se calla 12 horas en ese chat. Muestra respuestas de hoy y clientes calientes.
- **📨 Invitar a verificar su WhatsApp**: manda correo y aviso en la plataforma (no por WhatsApp) a talleres y clientes, un lote al día, una vez por persona.
- Tope: hasta 250 avisos al día (cambiable con `WHATSAPP_TOPE_DIA`).

---

## 4. Tareas paso a paso

### 4.1 Crear y programar una publicación

1. Ve a **Pendientes**.
2. En **Nueva publicación**, escribe el **Título interno**.
3. Escribe en **¿Qué quieres decir?** el mensaje. No pongas la liga: se agrega sola.
4. Revisa la **Liga de destino** (debe empezar con `https://`).
5. Elige las redes con los botones.
6. Elige el **Mercado** si no es México.
7. Si vas a publicar en Instagram o Pinterest, aprieta **+ Imagen** y sube una. Este botón sólo acepta imágenes: para TikTok o YouTube (que piden video), crea la publicación y luego súbele el video desde la tarjeta con **+ Agregar imagen o video**.
8. Elige la fecha y hora en **Programar (opcional)**.
9. Aprieta **Crear**.
10. Ve a **Calendario**, abre la tarjeta y revisa el texto de cada red. Corrige lo que quieras y aprieta **Guardar cambios**.

Si prefieres revisar antes de programar: deja la fecha vacía en el paso 8. Quedará como borrador en Pendientes. Revísala y luego usa el campo de fecha de la tarjeta + **⏰ Programar**.

> Si la hora que eliges cae fuera del horario de publicación, el sistema la recorre sola a la siguiente hora permitida.

### 4.2 Publicar ya

1. Abre la tarjeta (en Pendientes o Calendario).
2. Revisa los textos.
3. Aprieta **🚀 Publicar ahora**.
4. Espera el mensaje "Publicación enviada." y mira el resultado de cada red (✓, ⏳ o ✗).
5. En las redes con ✋ aprieta **Copiar** y pégalo tú en la red.

Notas:
- **Publicar ahora ignora el horario**: sale en ese momento.
- Instagram a veces tarda en procesar (sobre todo videos). Si ves "⏳ Instagram la está procesando", no hagas nada: se publica sola en unos minutos.
- Si sale "Se está publicando en este momento.", espera y recarga.

### 4.3 Revisar y aprobar borradores

Los borradores llegan de varios lados:
- Lo automático cuando su casilla está **sin marcar** en Configuración.
- El plan semanal, el temario, la Fábrica, el Radar y el reciclaje.
- **Borradores "en revisión"**: aunque la casilla esté marcada, algunos borradores **siempre** quedan esperando tu visto bueno:
  - **Taller nuevo** que entró por **alta automática** (confirmó su correo y quedó aprobado sin que nadie lo revisara). Su anuncio queda en borrador hasta que lo revises.
  - **Producto** de un taller que **no ha verificado su tarjeta** (y no está exento). Los de talleres verificados o creados por HETNA siguen la casilla normal.
  - Los productos importados de distribuidores y los productos sin imagen no generan publicación.

Pasos:
1. Ve a **Pendientes**. Usa **Filtrar** si hay muchos (por ejemplo **⚠ Sin imagen ni video** para ver los que no pueden salir en Instagram).
2. Abre cada borrador.
3. Para un taller nuevo o un producto: la tarjeta no muestra la liga de destino y el borrador todavía no tiene ligas medidas. Busca el taller (en Vendedores/Talleres) o el producto (en Productos) por el nombre que trae el título de la tarjeta, y revisa que se vea bien y sea serio.
4. Mira el **Algoritmo NN** de cada red. Si está en rojo o ámbar, aprieta **🧠 Mejorar con IA**. Si no te gusta, **↩ Deshacer mejora**.
5. Corrige a mano lo que quieras y aprieta **Guardar cambios**.
6. Decide:
   - **⏰ Programar** con fecha, o **⏰ Lo antes posible** (sale en unos 2 minutos, dentro del horario),
   - **🚀 Publicar ahora**, o
   - **Descartar**.

Desde el celular puedes hacer lo mismo con Telegram (4.7).

### 4.4 Plan semanal

Lo normal es que se haga solo cada domingo en la tarde. Si quieres hacerlo a mano:

1. Ve a **Estrategia**. Ya muestra la semana siguiente (usa ◀ ▶ para cambiar).
2. Aprieta **1. Armar plan**. Verás cuántas publicaciones se crearon.
3. Aprieta **2. Escribir borradores (N)**. Espera un par de minutos. Sale "Listo: N borradores para revisar en Pendientes.".
4. Los huecos de video (reel, video, short, largo) quedan en **Falta video**. Súbeles un video desde la tarjeta (**+ Agregar imagen o video**) o usa un video de taller.
5. Ve a **Pendientes** y revisa los borradores (4.3).

Para cambiar qué se planea: en **Estrategia** ajusta **Mercados**, **Por semana**, **Horas (local)** y **Públicos y temas**, y aprieta **Guardar estrategia**. Se aplica al siguiente plan.

**Piloto automático:** si lo activas, los borradores del plan, promociones, Fábrica, reciclaje y fechas especiales se programan solos cuando:
- ya tienen imagen o video,
- tienen fecha en las próximas 36 horas, y
- su puntaje (el más bajo entre sus redes) llega al mínimo.

Si no llegan, el revisor con IA les da una oportunidad de mejorar y se vuelven a medir. Lo que no pasa se queda en borrador para ti. **El temario nunca se aprueba solo.**

### 4.5 Responder comentarios

1. Ve a **Conversaciones**. Abre en **Por responder**.
2. Si quieres ver lo más reciente, aprieta **Leer comentarios ahora**.
3. Lee el comentario y la respuesta propuesta.
4. Cámbiala si hace falta.
5. Aprieta **✅ Enviar respuesta**, o **🗑 Ignorar**.
6. Si falla, el comentario pasa a **Con error** con el motivo. Puedes corregir y volver a enviar desde ahí.

Notas:
- Sólo se leen comentarios de publicaciones de los **últimos 14 días** y hasta 25 por publicación.
- El spam y lo que la IA decide no contestar se van solos a **Ignorados**. Revisa esa lista de vez en cuando.
- Si activas **Respuestas automáticas**, las preguntas frecuentes y los elogios se contestan solos. Las quejas y preguntas específicas siempre esperan tu aprobación.
- **Sin llave de IA**, los comentarios nuevos no reciben propuesta y sólo aparecen en el filtro **Todos**. También te llega un aviso por Telegram para que los contestes en la app de la red.
- También puedes contestar desde Telegram (4.7).

### 4.6 Ver estadísticas

1. Ve a **Resultados**.
2. Arriba, en **💰 Qué publicación vende**, ve qué publicaciones trajeron pagos e ingresos.
3. En **🧠 Lo que estamos aprendiendo**, aprieta **Leer estadísticas ahora** si quieres datos frescos (también se leen solas cada 6 horas). Lee las frases de conclusión.
4. Elige **7 días**, **30 días** o **90 días** para las tablas **Por red**, **Comunidades que más traen** y **Publicaciones que más traen**.
5. Para medir grupos de Facebook: en la tarjeta de una publicación usa **Liga medida para pegar en un grupo o comunidad**. Después la verás en "Comunidades que más traen".

Las estadísticas de alcance y "me gusta" sólo existen para **Facebook e Instagram**. Los clics y ventas existen para todas las redes, porque salen de la liga medida.

### 4.7 Aprobar desde Telegram

**Vincular (una sola vez):**
1. Ve a **Configuración** → **📲 Aprobar desde Telegram**.
2. Aprieta **Generar código**.
3. Abre en Telegram el bot de HETNA (el que publica en tu canal) y mándale: `/vincular 123456` (con tu código). El código dura **15 minutos**.
4. El bot contesta "✅ Listo: este chat quedó vinculado…".
5. Regresa al panel y aprieta **Ya lo mandé**. Debe decir "✓ Tu Telegram está vinculado.".
6. Elige la hora en **Mándame los borradores del día a las N h** y aprieta **Guardar**.

**Uso diario:**
- Cada día, a la hora elegida (llega al minuto 31; por ejemplo, con 8 h llega como a las 8:31), el bot te manda un resumen y los borradores de las próximas 24 horas (hasta 12), cada uno con su imagen o video y estos botones:
  - **✅ Aprobar**: queda programada para su hora (o en 3 minutos si ya pasó), dentro del horario.
  - **🚀 Publicar ya**: publica y te avisa el resultado de cada red.
  - **✏️ Cambiar**: escríbele qué cambiar ("más corto y con pregunta al inicio") o el texto nuevo completo. La IA lo reescribe y te manda cómo quedó. `/cancelar` para salir.
  - **🗑 Descartar**.
- Para comentarios llegan botones para enviar la respuesta, cambiarla o ignorar el comentario.
- Comandos que puedes escribirle al bot:
  - `/pendientes`: borradores de las próximas 24 h.
  - `/semana`: los de los próximos 7 días (hasta 25).
  - `/resumen`: cómo nos fue en los últimos 7 días.
  - `/cancelar`: salir de ✏️ Cambiar.
  - `/ayuda`: la lista de comandos.
- Botón del panel **Mandarme los borradores ahora**: te los manda en ese momento.
- El bot sólo obedece al chat vinculado. A cualquier otra persona le dice "Este bot es privado de HETNA CNC.".

### 4.8 Qué hacer si una publicación falla

1. Ve a **Pendientes**. Las fallidas están en **Error** (no salió en ninguna red automática) o **Parcial** (salió en algunas).
2. Abre la tarjeta. Junto a cada red verás "✗" y el motivo.
3. Corrige la causa (ver sección 8). Lo más común:
   - "Esta red necesita una imagen." → agrega imagen o video.
   - "…token de Facebook vencido…" → renueva el token en n8n.
   - "Falta N8N_REDES_URL…" → falta la variable en el servidor.
4. Aprieta **🚀 Publicar ahora**. **Sólo se reintentan las redes que fallaron**; las que ya salieron bien no se repiten.
5. Si no se puede arreglar, quita esa red con su botón, **Guardar cambios** y vuelve a publicar, o **Descartar**.

Importante:
- **Las publicaciones en Error no se reintentan solas.** Lo único que se reintenta solo es Instagram cuando está "procesando" (hasta 24 horas).
- Si el servidor se reinicia mientras publicaba, después de 30 minutos la publicación vuelve sola a la cola de programadas.
- Cada lunes llega un correo "Social Hub: revisa las conexiones con redes" si hubo errores en la semana o no hay conexión con n8n (sólo si está configurado `HETNA_LEADS_EMAIL`).

---

## 5. Qué pasa solo (automatizaciones)

Horas en hora del centro de México. El servidor programa las tareas en hora UTC; aquí ya están convertidas (verificar si el servidor no corre en UTC).

| Qué | Cuándo | Qué necesitas hacer tú |
|---|---|---|
| Publicación automática al **difundir una licitación** (sólo si el cliente autorizó redes y es abierta) | Al aprobarse/difundirse la solicitud | Nada si la casilla **Licitación** está marcada; si no, revisar el borrador |
| Publicación de **taller nuevo** | Al aprobar el taller; se programa 24 h después | Si entró por alta automática: revisar el borrador en Pendientes |
| Publicación de **producto nuevo** (con imagen, no importado) | Al crear el producto | Si el taller no verificó su tarjeta: revisar el borrador |
| Publicación de **tema del foro** | Cuando la tienda avisa de un tema nuevo | Nada si la casilla **Foro** está marcada |
| Lo automático "que sale solo" | Se programa con la espera configurada (10 min por defecto), dentro del horario | Nada |
| **Publicar lo programado** (hasta 5 por vez), terminar Instagram pendiente, descartar lo de fechas especiales vencidas | Cada 5 minutos | Nada; revisar errores en Pendientes |
| **Revisor con IA** (mejora hasta 4 borradores generados por vez) | Cada 5 minutos, con la tarea anterior | Nada; puedes deshacer en la tarjeta |
| **Piloto automático** (programa borradores listos) | Cada 5 minutos, si está activo | Activarlo y elegir el puntaje mínimo |
| **Leer comentarios** de Instagram y Facebook y proponer respuesta | Cada 15 minutos | Aprobar en Conversaciones o Telegram |
| **Aviso diario por Telegram** con los borradores | Una vez al día, a la hora elegida, minuto 31 | Aprobar o descartar desde Telegram |
| **Leer estadísticas** (alcance, me gusta, etc.) y decidir pruebas A/B | Cada 6 horas: 0:17, 6:17, 12:17 y 18:17 | Nada |
| **Prueba A/B**: 36 h después de publicar la versión A, si rindió al menos la mediana de su red, la B se descarta sola | Con las estadísticas | Nada |
| **Plan semanal**: arma el plan de la semana siguiente y escribe hasta 80 borradores | Domingo 17:37 | Revisar borradores el lunes; subir videos a los de "Falta video" |
| **Reciclaje**: hasta 2 publicaciones con más interacción de hace 45 a 120 días vuelven como borrador con otro gancho | Lunes 9:07 | Revisar el borrador ♻ |
| **Resumen semanal** por Telegram (y correo si hay `HETNA_LEADS_EMAIL`) | Lunes 9:07 | Leerlo |
| **Renovar el token de Threads** | Lunes 9:07 | Nada |
| **Revisión de conexiones** (correo si hay errores o no hay n8n) | Lunes 9:41 | Arreglar lo que diga el correo |
| Fábrica: retoma trabajos y hace imágenes/videos de borradores | Cada 2 minutos (verificar) | Nada |
| Promociones diarias (producto, blog, herramienta) | Diario 10:29 (verificar) | Revisar si la casilla Promociones está sin marcar |
| Anuncios en Meta: revisa gasto; los martes deja una propuesta | Diario 10:17 (verificar) | Aprobar o rechazar la propuesta |
| Radar: búsquedas web | Diario por la mañana (verificar hora) | Revisar hallazgos |
| Estudio diario y videos de fechas especiales / Buen Fin | De madrugada, entre 3 y 4 am (verificar) | Tenerlos activados |

---

## 6. Estados

### 6.1 Estados de una publicación

| Estado (en pantalla) | Qué significa | Dónde la ves |
|---|---|---|
| **Borrador** | Espera tu revisión. No sale sola (salvo que el piloto automático la programe) | Pendientes |
| **Programada** | Tiene fecha y hora; sale sola cuando toque, dentro del horario | Calendario |
| **Publicando…** | Se está publicando ahora mismo | No aparece en ninguna lista (dura poco) |
| **Publicada** | Salió bien en todas las redes automáticas (o sólo tenía redes a mano) | Publicadas |
| **Parcial** | Salió en algunas redes, falló en otras, o Instagram sigue procesando | Pendientes |
| **Error** | No salió en ninguna red automática | Pendientes |
| **Descartada** | La descartaste tú, o se venció su fecha especial, o perdió en una prueba A/B | No aparece en las listas |

Resultado por red dentro de la tarjeta:
- **✓ publicada**: salió.
- **✓ lista para pegar**: red a mano; copia y pega.
- **⏳ Instagram la está procesando**: se termina sola.
- **✗ motivo**: falló.

### 6.2 Estados de un hueco del plan semanal (pestaña Estrategia)

| Estado | Qué significa |
|---|---|
| **Sin contenido** | Hueco vacío; falta "2. Escribir borradores" |
| **Borrador por revisar** | Ya tiene borrador en Pendientes |
| **Falta video** | El formato pide video y todavía no tiene. Cuando le subes uno, pasa a "Borrador por revisar" |
| **Programada** | Su publicación ya está programada |
| **Publicada** | Ya salió |
| **Parcial** | Salió en parte |
| **Descartada** | Se descartó |

---

## 7. Configuración del servidor (variables de entorno)

Estas variables van en el archivo **`packages/api/.env` del servidor**. Después de cambiarlas hay que **volver a desplegar (redeploy) / reiniciar el servidor** para que tomen efecto. Nunca compartas sus valores por chat ni correo.

| Variable | Para qué sirve | Valor por defecto |
|---|---|---|
| `N8N_REDES_URL` | Dirección del webhook de n8n. Si termina en `redes-contenido-nuevo`, el Social Hub deduce la del flujo "Social Hub - Publicar" cambiando ese final por `social-hub-publicar`. Si termina distinto, necesitas `N8N_SOCIAL_URL` | Ninguno (sin ella no se publica nada automático) |
| `N8N_SOCIAL_URL` | Dirección directa del flujo "Social Hub - Publicar". Si existe, gana sobre la anterior | Ninguno |
| `N8N_REDES_TOKEN` | Contraseña compartida con n8n (en los dos sentidos: para publicar y para que n8n mande los mensajes de Telegram y avisos del foro) | Ninguno (sin ella n8n y el bot de Telegram son rechazados) |
| `ANTHROPIC_API_KEY` | Llave de IA: adaptar textos, Mejorar con IA, plan semanal, respuestas a comentarios, cambios por Telegram | Ninguno (sin ella: plantillas fijas y sin revisor) |
| `SOCIAL_IA` | Si vale `off`, apaga la IA del Social Hub aunque haya llave | Encendida |
| `IA_MODELO` | Qué modelo de IA se usa | `claude-haiku-5-5` |
| `THREADS_TOKEN` | Token de Threads. Con él, Threads publica solo | Ninguno (Threads a mano) |
| `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET` | Llaves de la app de TikTok para el botón Conectar TikTok | Ninguno |
| `TIKTOK_REDIRECT_URI` | Dirección de regreso de TikTok | `https://hetnacnc.com/r/tiktok-callback` |
| `PINTEREST_APP_ID`, `PINTEREST_APP_SECRET` | Llaves de la app de Pinterest | Ninguno |
| `PINTEREST_REDIRECT_URI` | Dirección de regreso de Pinterest | `https://hetnacnc.com/r/pinterest-callback` |
| `STOREFRONT_URL` | Dirección de la tienda (para las ligas medidas y destinos) | `https://hetnacnc.com` |
| `HETNA_LEADS_EMAIL` | Correo que recibe la revisión semanal de conexiones y el resumen semanal | Ninguno (no se manda correo) |
| `ALTA_AUTOMATICA` | Si vale `false`, los talleres se aprueban a mano. Si está encendida, sus anuncios en redes quedan en borrador para revisión | Encendida |
| `N8N_PRODUCT_CREATED_WEBHOOK_URL` | Aviso extra a n8n de producto nuevo (sólo talleres verificados), aparte del Social Hub | Ninguno |
| `META_ADS_TOKEN` | Token para Anuncios en Meta y Campañas Ads en Meta | Ninguno (no se propone ni lanza nada) |
| `META_PAGE_ID` | Página de Facebook que usan los anuncios | Trae la página de HETNA por defecto |
| `META_GRAPH_VERSION` | Versión de la API de Meta para anuncios | `v26.0` |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Conectar YouTube en el Estudio diario (tendencias y retención) | Ninguno |
| `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE` | Conexión del WhatsApp de HETNA (Evolution API) | Ninguno (sale "Faltan las llaves en el servidor") (verificar cuáles exige) |
| `WHATSAPP_API_URL` o `EVOLUTION_API_URL_PUBLICA` | Dirección del servidor de WhatsApp | `https://whatsapp.hetnacnc.com` |
| `WHATSAPP_HETNA` (o `OWNER_WHATSAPP_NUMBER`, `WHATSAPP_NUMBER`) | Número de WhatsApp de HETNA que se muestra para verificar | Ninguno |
| `WHATSAPP_TOPE_DIA` | Máximo de avisos de WhatsApp al día | `250` |
| `IA_MODELO_WHATSAPP` | Modelo de IA del agente de ventas de WhatsApp | Uno más potente hasta el 1 de diciembre de 2026; después, el de `IA_MODELO` |

Lo que **no** va en el `.env`, porque se guarda desde el panel: redes por defecto, qué sale solo, horario, piloto automático, casillas, hora del aviso de Telegram, vinculación de Telegram, conexión de TikTok y Pinterest (sus tokens se renuevan solos), estrategia, y la configuración de anuncios.

Los tokens de **Facebook e Instagram** no están en el `.env`: viven en las credenciales de **n8n** (verificar).

---

## 8. Problemas comunes y solución

| Lo que ves | Qué significa | Qué hacer |
|---|---|---|
| "No se pudo verificar tu sesión. Cierra sesión en el dashboard, vuelve a entrar y recarga." | Tu sesión del panel venció | Cierra sesión, entra de nuevo y recarga la página |
| "No se pudo conectar con el servidor." | El servidor no contesta | Revisa tu internet; si sigue, revisa que el servidor esté arriba |
| "Escribe un título y el texto." | Falta título o texto en Nueva publicación | Llena los dos campos |
| "La liga debe empezar con https://" | La liga de destino está mal | Escríbela completa, con `https://` |
| "No se pudo subir la imagen." | Falló la subida del archivo | Prueba con otro archivo (JPG, PNG o WebP) más ligero |
| "✗ Esta red necesita una imagen." | Instagram, Pinterest, TikTok, YouTube o Google sin imagen ni video | **+ Agregar imagen o video** y vuelve a publicar, o quita esa red |
| "Falta N8N_REDES_URL o N8N_SOCIAL_URL en el servidor." | No está la dirección de n8n | Agrega la variable al `.env` y redeploy |
| "n8n respondió 401" u otro número | n8n rechazó o falló | Revisa que `N8N_REDES_TOKEN` sea igual en el servidor y en n8n, y que el flujo esté activo (verificar) |
| "…Suele ser el token de Facebook vencido: pon uno nuevo en n8n (credencial "Facebook Graph account 2")." | Meta rechazó la publicación (casi siempre token vencido o sin permiso) | Renueva el token de Facebook en n8n y vuelve a publicar |
| "Instagram no terminó de procesar el archivo en 24 horas." | Instagram no aceptó el video o la imagen | Prueba con otro archivo (vertical, más corto) y vuelve a publicar |
| "Se está publicando en este momento." | Ya se está publicando, **o** era de una fecha especial ya vencida | Espera unos minutos y recarga; si es de fecha especial vencida, ya no se puede publicar |
| "Fecha no válida." | La fecha de programación está mal | Elige otra fecha en el calendario |
| "Falta la llave de IA (ANTHROPIC_API_KEY) en el servidor." | Mejorar con IA sin llave, **o** con `SOCIAL_IA=off` | Agrega la llave al `.env` (y quita `SOCIAL_IA=off` si está) y redeploy |
| "Esta publicación ya no se puede cambiar." | Mejorar con IA en una Publicada, Parcial o Descartada | Sólo se mejora en Borrador, Programada o Error |
| "La IA no mejoró el texto; quedó como estaba." | La IA no encontró una versión con mejor o igual puntaje, o no respondió | Edita a mano o inténtalo después |
| "No hay versión anterior." | Deshacer sin una mejora previa | Nada que hacer |
| "Código incorrecto o vencido. Genera uno nuevo en Admin → Social Hub → Configuración." (en Telegram) | El código de vinculación venció (15 min) o está mal | **Generar código** de nuevo y mándalo enseguida |
| "Telegram no está vinculado." | Se quiso mandar algo a Telegram sin vincular | Vincula Telegram (4.7) |
| "Faltan las llaves en el servidor" (TikTok, Pinterest o WhatsApp) | Faltan las variables de esa red | Agrega las variables de la sección 7 y redeploy |
| "La liga para conectar ya venció. Vuelve a apretar 'Conectar TikTok'." | Tardaste más de 15 min en aceptar en TikTok | Aprieta **Conectar TikTok** de nuevo |
| "TikTok no está conectado. Aprieta 'Conectar TikTok' en Configuración." | Se intentó subir video sin conexión | Conecta TikTok |
| "No se pudo leer el estado: … ¿Ya se desplegó la versión con TikTok?" | El servidor no contestó por TikTok | Revisa que el servidor tenga la versión nueva desplegada |
| "Falta THREADS_TOKEN en el .env del backend." | Probar Threads sin token | Agrega `THREADS_TOKEN` y redeploy |
| "Ese comentario ya se respondió." / "No hay respuesta que enviar." | Doble envío o respuesta vacía | Recarga; escribe una respuesta antes de enviar |
| Comentario en **Con error** | La red no aceptó la respuesta | Revisa el motivo, corrige y vuelve a **✅ Enviar respuesta** |
| "No hay propuesta: revisa que esté prendido, con cuenta, presupuesto y token…" (Anuncios) | No se pudo armar una propuesta | Revisa casilla Prendido, cuenta, presupuesto, `META_ADS_TOKEN`, que no haya otro anuncio abierto y que haya publicaciones de Facebook recientes con resultados |
| "Escribe un celular de México a 10 dígitos." (WhatsApp) | Número de prueba mal escrito | Escribe 10 dígitos |
| Guardas el horario, dice "Guardado." y no cambia | La hora "a" quedó igual o antes que la hora "de" | El sistema ignora en silencio los horarios imposibles y deja el anterior. Pon "a" mayor que "de" |
| No aparecen comentarios en "Por responder" | No hay llave de IA, o la IA los clasificó como spam / no contestar | Mira en **Todos** e **Ignorados** |
| "Este video ya no está pendiente." (Videos de talleres) | Alguien ya lo aprobó o rechazó | Recarga la pestaña |

---

*Fin del capítulo 2.*


---

# Capítulo 3 · Páginas del panel (parte A)

Este capítulo explica ocho páginas del menú lateral del panel de administración (`hetnacnc.com/dashboard`). Para cada una vas a encontrar:

- **Para qué sirve.**
- **Qué ves en la pantalla**: cada bloque, botón y campo.
- **Tareas paso a paso** para lo que haces seguido.
- **Qué pasa solo**: lo que el sistema hace por su cuenta.
- **Cuidado / problemas comunes**: errores que puedes ver y cómo salir de ellos.

Los nombres en **negritas** son los textos exactos que ves en pantalla. Los horarios están en **hora del centro de México**.

Algunas páginas dependen de "variables del servidor". Son ajustes que viven en el archivo `.env` de `packages/api` (el backend). Aquí sólo te decimos el **nombre**, **qué controla** y su **valor si no la pones**. Nunca escribas ni compartas sus valores reales. Para cambiar una, pídeselo a quien administra el servidor y que reinicie el backend.

Un mensaje que puede salir en casi todas las páginas:

> **No se pudo verificar tu sesión de administrador. Cierra sesión en el dashboard, vuelve a entrar y recarga esta página.**

Significa que tu sesión venció. Haz justo eso: cierra sesión, entra otra vez y recarga.

---

## Centro de control

### Para qué sirve

Es la primera página que debes abrir cada día. Arriba te dice **lo que necesita que alguien haga algo**, ordenado por urgencia. Abajo te muestra **cómo van las ventas** contra el periodo anterior. También te enseña el saldo de Skydropx (las guías de envío) y el estado de los servicios que pagas (anuncios, correos, dominio, servidor…).

### Qué ves en la pantalla

**Encabezado**

- Título **Centro de control** y la hora de la última actualización (**Actualizado …**).
- Botones **7 días**, **30 días**, **90 días**: eligen el periodo de las cifras de ventas. Por omisión: 30 días. El periodo anterior es del mismo largo (por ejemplo, con 30 días se compara contra los 30 días de antes).
- Botón **Actualizar**: vuelve a leer todo en ese momento. Mientras lee dice **Actualizando…**.
- La página se actualiza sola **cada 5 minutos** mientras la tengas abierta.

**Bloque "Lo que necesita tu atención"**

Lista de avisos. Cada uno trae una etiqueta de color:

| Etiqueta | Color | Qué significa |
|---|---|---|
| **Urgente** | rojo | Afecta a un cliente o a la marca hoy. |
| **Revisar** | ámbar | Hay que verlo pronto. |
| **Para saber** | azul | Sólo para que estés al tanto. |

Arriba a la derecha hay botones para filtrar: **Todo (n)**, **Urgente (n)**, **Revisar (n)**, **Para saber (n)**. El número es cuántos hay de cada tipo.

Cada aviso trae título, detalle, fecha (si aplica) y una liga **Abrir →** que te lleva a donde se resuelve (el pedido, la página de Envíos, Skydropx, etc.).

Si no hay nada, ves: **✓ Todo en orden: no hay nada pendiente aquí.**

Qué avisos pueden salir (según el código):

| Aviso | Nivel | Cuándo sale |
|---|---|---|
| **Pedido #N lleva X sin enviarse** | Urgente | Pedido pagado, sin envío, con más de 48 horas (ajustable) y menos de 60 días. |
| **Reclamo de un cliente (taller)** | Urgente | Un cliente abrió un reclamo en el periodo (le faltó algo, le llegó otra cosa, llegó dañado). |
| **Reseña de 1 o 2 estrella(s)…** | Urgente | Reseña mala a un taller o producto en el periodo. |
| **Recarga saldo en Skydropx: no se pudieron comprar guías** | Urgente | En los últimos 7 días fallaron guías por falta de saldo. |
| **Recarga saldo en Skydropx** | Urgente | Tu saldo está por debajo del mínimo o te alcanza para menos de 3 días. |
| **No se pudo generar una guía (taller)** | Urgente | Una guía falló por otro motivo en los últimos 7 días. |
| **Pedido #N cancelado** | Revisar | Cancelación dentro del periodo. |
| **Devolución en un pedido de…** | Revisar | Devolución con su motivo. |
| **N guía(s) sin las fotos del paquete** | Revisar | Guías de más de 24 horas sin las 4 fotos de evidencia. Sin fotos no se puede pelear un sobrepeso. |
| **N sobrepeso(s) pendientes por $…** | Revisar | Hay sobrepesos "Por cobrar" o "En disputa" (ver página **Envíos**). |
| **Skydropx cobró N cargo(s) extra…** | Revisar | Skydropx te cobró cargos extra (sobrepesos, reexpediciones) en el periodo. |
| **N publicación(es) en redes con error** | Revisar | Publicaciones del Social Hub fallidas en los últimos 3 días. |
| **N taller(es) nuevo(s) esperan que los apruebes** | Revisar | Talleres que ya confirmaron su correo y esperan aprobación. Mientras no los apruebes no pueden publicar. |
| **N pedido(s) sin pagar de esta semana** | Para saber | Pedidos de hace 1 a 7 días que no se pagaron. |
| **N taller(es) esperan que revises su verificación** | Para saber | Verificaciones en revisión. |
| **N taller(es) del Cotizador por vencer o en el límite** | Para saber | Pruebas o planes del Cotizador por terminar. |
| **N recarga(s) sin nota de compra** | Para saber | Recargas sin comprobante subido. |
| **Radar: N oportunidad(es) CNC para revisar** | Para saber | El Radar encontró oportunidades nuevas con relevancia alta. |
| **N borrador(es) del plan salen en menos de 2 días** | Para saber | Borradores del Social Hub próximos a salir. |
| Avisos de servicios (saldos, límites, vencimientos) | Urgente o Revisar | Vienen del bloque **Servicios** (ver abajo). |
| **No se pudo revisar (servicio)** | Para saber | Un servicio no respondió; revisa sus llaves en el servidor. |

Nota: los avisos de pedidos, cancelaciones, reclamos, reseñas y devoluciones dependen del periodo que elegiste (7, 30 o 90 días). Si cambias a 90 días verás más.

**Bloque "Saldos y recargas"**

- **Saldo Skydropx**: cuánto dinero tienes para comprar guías. Abajo: **Gastas ≈$X al día** (promedio de las guías de los últimos 14 días), **alcanza para ≈N días** y **mínimo $…**. Si está en rojo, debes recargar.
- **Sugerido: $X (tope $Y)**: cuánto te conviene recargar. Sale sólo cuando hay que recargar. Se calcula para que te alcance unos 10 días, con mínimo $500 y sin pasar del tope.
- Botón **Recargar en Skydropx**: abre la página de Skydropx para recargar.
- Si no se pudo leer el saldo, ves: **No se pudo leer el saldo de Skydropx (revisa las llaves SKYDROPX_CLIENT_ID y SKYDROPX_CLIENT_SECRET).**
- Tabla de recargas: **Fecha**, **Plataforma**, **Monto**, **Nota de compra**. Las que el sistema encontró solo dicen **· detectada**. Si ya tiene comprobante: **✓ Ver nota**. Si no: **Subir nota**.
- Desplegable **Anotar una recarga de otra plataforma**: campos **Plataforma (ej. Resend, hosting)**, **Monto** y el botón **Subir nota y guardar**.

**Bloque "Servicios: saldos, límites y vencimientos"**

Sale sólo si hay servicios configurados. Está dividido en tres grupos:

- **Saldos** (botón **Recargar**): RunPod (escaneo 3D), Meta Ads, Google Ads.
- **Uso y límites** (botón **Ver uso**): Resend (correos), disco del servidor, Cloudflare R2 (archivos), Supabase (app del taller) y consultas por hora de Supabase.
- **Vencimientos** (botón **Renovar**): dominios, certificados SSL, servicios de Hostinger y tu lista manual de fechas.

Cada renglón tiene un punto de color: verde (bien), naranja (revisar), rojo (urgente), gris (no se pudo leer). El botón se pinta de naranja cuando el renglón está en rojo o naranja.

Abajo hay un desplegable **N servicio(s) sin configurar**. Te dice qué variable falta agregar en el `.env` del servidor para cada uno.

**Cifras de ventas** (del periodo elegido, con **▲/▼ %** contra el periodo anterior)

- **Ventas**: suma de pedidos pagados (no cancelados).
- **Pedidos pagados**.
- **Comisión HETNA**: lo que ganó HETNA en comisiones.
- **Ticket promedio**: ventas entre pedidos.
- **Clientes nuevos**: clientes que crearon cuenta.
- **Talleres**: total de talleres, con **N nuevos en el periodo**.
- **Carritos abandonados**: carritos con productos que no terminaron la compra, y **$… que no se cobraron**.
- **Gasto en guías**: **Lo que se descontó de tu saldo de Skydropx**.

Si el periodo anterior estaba en cero, en lugar del porcentaje sale **nuevo**.

**Gráfica "Ventas por día"**: una barra por día, con el total arriba. Pasa el mouse por una barra para ver el monto y los pedidos de ese día.

**Listas "Talleres que más venden" y "Productos que más venden"**: los 8 primeros por ingresos del periodo.

### Tareas paso a paso

**Revisar el día (5 minutos)**

1. Abre **Centro de control**.
2. Toca **Urgente** para ver sólo lo rojo.
3. En cada aviso toca **Abrir →** y resuélvelo (enviar el pedido, contestar el reclamo, recargar…).
4. Regresa y toca **Actualizar**. Lo que resolviste debe desaparecer.
5. Repite con **Revisar** y luego con **Para saber**.

**Recargar Skydropx y guardar el comprobante**

1. En **Saldos y recargas** mira el **Sugerido**.
2. Toca **Recargar en Skydropx** y haz la recarga en su página.
3. Espera. El sistema detecta la recarga solo cuando vuelve a leer el saldo (máximo una vez por hora) y aparece en la tabla con **· detectada**.
4. En ese renglón toca **Subir nota** y elige la foto o el PDF de la factura o el recibo.
5. Listo: el renglón cambia a **✓ Ver nota**.

**Anotar una recarga de otra plataforma (por ejemplo, el hosting)**

1. Abre **Anotar una recarga de otra plataforma**.
2. Escribe la **Plataforma** y el **Monto**.
3. Toca **Subir nota y guardar** y elige la foto o PDF del comprobante. Se guarda al terminar de subir.

**Ver cómo van las ventas del trimestre**

1. Toca **90 días**.
2. Lee las cifras y fíjate en las flechas ▲ (sube) o ▼ (baja).
3. Revisa **Talleres que más venden** y **Productos que más venden**.

### Qué pasa solo

- **Informe diario por correo (7:40 a. m.)**: llega un correo **Informe diario · …** con todos los avisos (urgentes y de revisar), las cifras de ayer y una sección **Más datos de ayer** (pedidos contra antier, sin pagar, clientes nuevos, carritos abandonados, reseñas nuevas, totales históricos y talleres que vendieron).
- **Revisiones durante el día (9:40, 11:40, 13:40, 15:40, 17:40, 19:40 y 21:40)**: si aparece algo **Urgente nuevo**, te llega:
  - una **notificación al celular** de la cuenta de la casa (si tiene avisos activados). Si no hay celular con avisos, se espera al correo del día siguiente;
  - o un **correo** "⚠ HETNA: …", sólo si activaste esa opción (ver variables);
  - y además un mensaje por **Telegram**, si tu chat ya está vinculado en el Social Hub.
- Cada aviso urgente se manda **una sola vez**. Si después de 30 días sigue igual, puede volver a avisarse. Ojo: si el título del aviso cambia (por ejemplo "lleva 3 días" pasa a "lleva 4 días"), el sistema lo toma como aviso nuevo y te lo vuelve a mandar.
- **Detección de recargas**: cuando el saldo de Skydropx sube más de $50 entre una lectura y otra, se anota una recarga "detectada" por la diferencia. Las lecturas se guardan como máximo una vez por hora.
- **Servicios**: se consultan cuando abres la página o corre la revisión, y el resultado se guarda 10 minutos. No hay un proceso aparte que los revise cada 10 minutos (aunque la pantalla diga "Se revisa cada 10 minutos").

### Variables del servidor

| Variable | Qué controla | Si no la pones |
|---|---|---|
| `CONTROL_AVISOS` | `off` apaga el correo de la mañana y los avisos urgentes (correo, celular y Telegram). | Encendido |
| `CONTROL_AVISOS_PARA` | A qué correo(s) llega el informe. Puedes poner varios separados por comas. | Usa `RESUMEN_DIARIO_PARA` o el correo de la cuenta de la casa |
| `CONTROL_URGENTES_CORREO` | `on` manda los urgentes del día por correo en vez de al celular. | Al celular |
| `CONTROL_TELEGRAM` | `off` apaga los avisos urgentes por Telegram. | Encendido |
| `CONTROL_HORAS_SIN_ENVIAR` | Horas para que un pedido pagado sin enviar sea urgente. | 48 |
| `RESEND_API_KEY` | Llave de correos. Sin ella no corre ningún aviso automático (tampoco celular ni Telegram). | — |
| `ADMIN_PANEL_URL` | Dirección del panel que se pone en las ligas de los avisos. | La tienda + `/dashboard` |
| `SKYDROPX_CLIENT_ID`, `SKYDROPX_CLIENT_SECRET` | Acceso a Skydropx para leer el saldo. | Sin saldo |
| `SKYDROPX_SALDO_MINIMO` | Saldo mínimo antes de pedir recarga (pesos). | 800 |
| `SKYDROPX_DIAS_COLCHON` | Días de guías que debe cubrir la recarga sugerida. | 10 |
| `RECARGA_TOPE` | Máximo que se sugiere recargar (pesos). | 2700 |
| `SKYDROPX_URL_RECARGA` | Página que abre **Recargar en Skydropx**. | pro.skydropx.com |
| `VIGILANCIA_DIAS_AVISO` | Días antes de un vencimiento para avisar. | 15 |
| `VIGILANCIA_PCT_AMBAR` / `VIGILANCIA_PCT_ROJO` | % de uso para naranja / rojo. | 80 / 90 |
| `VENCIMIENTOS` | Tu lista manual de fechas. Formato `Nombre=AAAA-MM-DD` o `Nombre=mensual:DÍA`, separadas por `;`. | Vacía |
| `VIGILAR_DOMINIOS`, `VIGILAR_SSL` | Dominios y certificados a vigilar (separados por coma). | hetnacnc.com |
| `RUNPOD_SALDO_MINIMO` | Saldo mínimo de RunPod (dólares). | 10 |
| `META_ADS_SALDO_MINIMO`, `GOOGLE_ADS_SALDO_MINIMO` | Saldo mínimo de anuncios. | 200 |
| `RESEND_LIMITE_MES`, `RESEND_LIMITE_DIA` | Límite de correos de tu plan. | 3000 / 100 |
| `R2_LIMITE_GB` | Espacio de archivos contratado. | 10 |
| `SUPABASE_LIMITE_BD_MB`, `SUPABASE_LIMITE_ARCHIVOS_MB` | Límites de Supabase. | 500 / 1024 |
| `SUPABASE_CONSULTAS_HORA_AMBAR` / `_ROJO` | Consultas por hora que indican un proceso en bucle. | 3000 / 10000 |
| Llaves de cada servicio (`RUNPOD_API_KEY`, `META_ADS_TOKEN`, `META_AD_ACCOUNT_ID`, `GOOGLE_ADS_*`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `HOSTINGER_API_TOKEN`, `COTIZADOR_SUPABASE_URL` / `_SERVICE_KEY`) | Permiten leer cada servicio. Sin ellas, sale en **sin configurar**. | — |

### Cuidado / problemas comunes

- **No se pudo armar el centro de control.** Falló el servidor al juntar los datos. Toca **Actualizar**; si sigue, avisa a soporte técnico.
- **No se pudo conectar con el servidor. Revisa tu internet e intenta de nuevo.** Problema de conexión de tu lado.
- **Escribe el monto de la recarga.** Al anotar una recarga manual, el monto debe ser mayor a cero. Escríbelo **antes** de tocar **Subir nota y guardar**, porque se guarda en cuanto termina de subir el archivo.
- **No se pudo subir el archivo.** El comprobante no subió; intenta con una foto más ligera o un PDF.
- Una sección en blanco no rompe la página: si un módulo falla, las demás secciones salen igual. Si te falta un bloque (por ejemplo, **Servicios**), puede ser que no esté configurado.
- La gráfica **Ventas por día** agrupa por día en horario universal (UTC). Las ventas de la noche (después de las 6 p. m.) pueden aparecer en la barra del día siguiente.
- La página no presenta ni paga nada: sólo te avisa. Las recargas las haces tú en cada plataforma.

---

## Resultados

En pantalla el título es **Resultados de licitaciones**.

### Para qué sirve

Te muestra cómo van las **licitaciones** (las solicitudes de trabajo que los clientes mandan para que los talleres coticen): cuántas llegan a cada paso, dónde se pierden, cuánto tarda cada paso, si los recordatorios funcionan y cuáles están **atoradas hoy** para que actúes.

### Qué ves en la pantalla

- Botones **7 días**, **30 días**, **90 días**: toman las solicitudes **creadas** en ese periodo. Por omisión, 30 días.

**Bloque "Embudo"**: seis barras, cada una con su número y el **% del anterior**:

1. **Solicitudes**: las que se crearon.
2. **Enviadas a talleres**: ya salieron a los talleres.
3. **Con al menos una propuesta**.
4. **Eligieron taller**.
5. **Pagadas**.
6. **Entregadas** (barra verde).

Abajo puede salir: **Donde más se pierde: de … a … (sólo pasa el N%)**. Es el paso con peor conversión (sólo cuenta pasos con 3 o más solicitudes).

**Tarjetas de tiempos** (mediana: el valor de en medio, no el promedio):

- **Hasta la primera propuesta**: desde que se envía a talleres.
- **De la primera propuesta a elegir**.
- **De elegir a pagar**.
- **Propuestas por solicitud**: de las que recibieron alguna.
- **Talleres avisados**: promedio por solicitud y **cotiza el N%** (cuántos de los avisados mandaron propuesta).

Menos de 48 horas se muestran en horas; más, en días. Un **—** quiere decir que todavía no hay datos.

**Bloque "Dónde se quedaron"**: cuántas solicitudes del periodo se quedaron en cada punto:

- **Esperan revisión de HETNA**
- **Abiertas, todavía sin propuestas**
- **Cerraron sin ninguna propuesta**
- **Tienen propuestas y no eligen**
- **Eligieron y no pagan**
- **Canceladas**

**Bloque "¿Sirven los recordatorios?"**: cuántos recordatorios salieron de cada tipo y cuántos avanzaron después:

- **Cliente: propuestas sin elegir** → eligieron después.
- **Cliente: elegida sin pagar** → pagaron después.
- **Taller: contraoferta sin responder** → respondieron.
- **Taller: hito atrasado** → lo marcaron listo.

Debajo: **Ampliadas por falta de propuestas**: cuántas solicitudes se mandaron a más talleres y cuántas **recibieron propuesta después**.

**Bloque "Por qué los talleres no cotizan"**: los motivos que dan los talleres cuando rechazan, del más común al menos común.

**Bloque "Por semana"**: barras de las últimas 8 semanas. Gris: solicitudes de la semana. Verde: las que se pagaron. Pasa el mouse para ver los números.

**Bloque "Atoradas hoy (N)"**: tabla con **Folio**, **Qué pasa**, **Días** (en rojo si son 5 o más), **Cliente** y la liga **Ver lo que ve el cliente**. Los motivos posibles:

- **Abierta sin propuestas** (más de 2 días abierta y nadie ha propuesto).
- **Tiene propuestas y no elige**.
- **Eligió y no paga** (más de 1 día).
- **Producción atrasada** (un hito pasó su fecha sin marcarse listo).

Si no hay ninguna: **Nada atorado. 🎉**

### Tareas paso a paso

**Rescatar solicitudes atoradas**

1. Abre **Resultados** y baja a **Atoradas hoy**.
2. Empieza por las de más **Días** (en rojo).
3. Toca **Ver lo que ve el cliente** para entender en qué está.
4. Ve a la página **Solicitudes**, búscala por el **Folio** y escríbele al cliente o cambia la etapa desde ahí.

**Saber dónde se te van los clientes**

1. Elige **30 días** o **90 días**.
2. Lee la frase **Donde más se pierde**.
3. Revisa **Dónde se quedaron** y **Por qué los talleres no cotizan** para entender el motivo.
4. Si el problema es "sin propuestas", invita a más talleres de ese tipo de trabajo.

### Qué pasa solo

- **Cada hora (al minuto 41)**: si HETNA no revisa una solicitud en 24 horas (ajustable), se aprueba sola. También se cierran las entregas que el cliente no confirmó en el plazo, salvo las que tienen una disputa abierta.
- **Cada hora (al minuto 53)**: las solicitudes abiertas sin ninguna propuesta se mandan a más talleres a las 48 horas; y a 24 horas del cierre se amplían 3 días y se avisa al cliente y a HETNA.
- **Cada hora (al minuto 23)**: las solicitudes que pasaron su fecha de cierre (7 días) dejan de recibir propuestas. Si tienen propuestas, siguen abiertas para que el cliente elija y se le avisa una vez. Si no tienen, pasan a cerradas y se avisa a HETNA para buscar taller a mano.
- **Diario a las 10:17 a. m.**: recordatorios por correo y celular (push y WhatsApp si la persona lo verificó): al cliente por propuestas sin elegir o elegida sin pagar; al taller por contraofertas sin responder o hitos atrasados.

### Variables del servidor

| Variable | Qué controla | Si no la pones |
|---|---|---|
| `AMPLIAR_LICITACIONES` | `0` apaga la ampliación automática. | Encendida |
| `RECORDATORIOS_LICITACION` | `0` apaga los recordatorios diarios. | Encendidos |
| `LICITACION_REVISION_HORAS` | Horas para aprobar sola una solicitud no revisada. | 24 |
| `DIAS_PARA_CERRAR` | Días para cerrar una entrega que el cliente no confirma. | (verificar) |

### Cuidado / problemas comunes

- **No se pudo verificar tu sesión. Cierra sesión, vuelve a entrar y recarga.** Sesión vencida.
- **Atoradas hoy** no depende del botón de 7/30/90 días: siempre muestra lo atorado **ahora**, de cualquier fecha.
- En **¿Sirven los recordatorios?** los "avanzaron" sólo se cuentan para solicitudes creadas en el periodo, así que el porcentaje puede verse más bajo de lo real (verificar).
- Las "pagadas" de **Por semana** usan una regla más estricta que la del embudo; los números pueden no coincidir exactamente.
- Esta página sólo muestra. Para actuar sobre una solicitud usa la página **Solicitudes**.

---

## Publicidad

En pantalla el título es **Publicidad y banners**.

### Para qué sirve

Aquí cambias las imágenes grandes del sitio (el carrusel del inicio, tarjetas promocionales, banners) y administras a tus **anunciantes**: imagen, textos, a dónde lleva el clic, fechas, orden, pausar, borrar, y ver **vistas** y **clics**. Los cambios se ven en el sitio en menos de un minuto.

### Qué ves en la pantalla

**Lista principal**

- Botón **+ Nuevo anuncio** (arriba a la derecha). Abre el formulario con el espacio **Publicidad: franja del inicio** ya elegido.
- Una sección por cada **espacio** del sitio, con su nombre, la medida recomendada y **N de M activos**. Cada sección tiene el botón **+ Agregar aquí**.

Los espacios son:

| Espacio | Medida | Caben | Dónde sale |
|---|---|---|---|
| **Carrusel principal del inicio** | 1920 × 700 px (celular opcional 800 × 900) | 8 | Imágenes grandes de arriba en el inicio. Si activas al menos una, reemplazan las diapositivas de texto. |
| **Banner promocional (2 tarjetas)** | 1200 × 600 px | 2 | Debajo de la barra de confianza. Orden 1 = izquierda, 2 = derecha. |
| **Publicidad: franja del inicio** | 1200 × 300 px | 2 | Debajo de las tarjetas promocionales. Ideal para anunciantes de pago. |
| **Banner de herramientas** | 1920 × 800 px | 1 | Fondo del bloque de herramientas CNC. Los textos vacíos conservan los de siempre. |
| **Publicidad: columna derecha del foro** | 600 × 500 px | 3 | Columna derecha del foro, debajo de la Calculadora CNC. |
| **Publicidad: categorías** | 970 × 250 px | 2 | Arriba del listado de productos de cada categoría. |
| **Publicidad: vista previa en WhatsApp** | 1200 × 630 px | 6 | La imagen que sale cuando el WhatsApp de HETNA manda la liga de «Solicitar cotización». Si hay varias, se turnan. Deja lo importante al centro. |

Si un espacio no tiene nada: **Sin anuncios. Se muestra el contenido de siempre.**

Cada anuncio muestra:

- Miniatura (o **Sin imagen**).
- Título (o el anunciante, o **(sin título)**).
- Etiqueta de estado: **Activo**, **Programado** (empieza después), **Vencido** (ya terminó) o **Pausado**.
- Etiqueta **Publicidad** si es de un tercero.
- Anunciante, fechas **desde → hasta** (o **sin fin**) y **orden**.
- **N vistas · N clics · N% de clics**.
- Si vence en 7 días o menos: **Vence en N días — buen momento de ofrecerle renovar.**
- Botones **Editar**, **Pausar** / **Activar** y **Borrar**.

Al final hay un recuadro **Próxima etapa** (cobro con Mercado Pago, mensajes a talleres y avisos de renovación). Es sólo informativo: todavía no hace nada.

**Formulario (Nuevo anuncio / Editar anuncio)**

- **¿Dónde se va a mostrar?**: el espacio. Abajo te dice la ayuda y **Medida recomendada: … · caben N a la vez**.
- **Imagen**: botón **Elegir imagen** / **Cambiar imagen**, y **Quitar**. La imagen se reduce sola a WebP (máximo ~800 KB). En el espacio de WhatsApp se guarda en JPG.
- Sólo en el carrusel: **Imagen para celular (opcional)** y **Video MP4 (opcional)** (una liga `https://…/video.mp4`, corto, menos de 5 MB).
- **Título (opcional)** (máx. 140), **Texto del botón (opcional)** (máx. 40), **Subtítulo (opcional)** (máx. 300).
- **¿A dónde lleva al hacer clic?** (obligatorio): dentro del sitio empieza con `/`; fuera del sitio empieza con `https://`.
- **Anunciante (taller o empresa)**.
- **Orden (1 aparece primero)**: de 0 a 99.
- **Empieza el (vacío = hoy)** y **Termina el (vacío = sin fecha de fin)**.
- Casilla **Es publicidad de un tercero**: muestra la etiqueta "Publicidad" sobre la imagen.
- Casilla **Activo (visible en el sitio)**.
- Botones **Guardar anuncio** y **Cancelar**.

### Tareas paso a paso

**Poner un anuncio pagado de un taller**

1. En el espacio que vendiste toca **+ Agregar aquí** (o **+ Nuevo anuncio** y cambia el espacio).
2. Toca **Elegir imagen** y sube la imagen del tamaño recomendado.
3. Si la imagen ya trae el texto, deja vacíos **Título** y **Texto del botón**.
4. En **¿A dónde lleva al hacer clic?** pon la página del taller (por ejemplo `/talleres/mi-taller`) o su sitio con `https://`.
5. Escribe el **Anunciante**.
6. Pon **Empieza el** y **Termina el** según lo que pagó.
7. Deja marcadas **Es publicidad de un tercero** y **Activo**.
8. Toca **Guardar anuncio**. En menos de un minuto sale en el sitio.

**Cambiar las imágenes del carrusel del inicio**

1. En **Carrusel principal del inicio** toca **+ Agregar aquí**.
2. Sube la **Imagen** (1920 × 700) y, si quieres, la **Imagen para celular**.
3. Pon el **Orden** (1 sale primero).
4. Guarda. Repite para cada diapositiva.

**Pausar o quitar un anuncio**

1. Busca el anuncio en su espacio.
2. Toca **Pausar** para ocultarlo sin perderlo (luego **Activar** para volver).
3. Toca **Borrar** sólo si no lo vas a volver a usar. Te pide confirmar: **¿Borrar "…" para siempre? Esto no se puede deshacer.**

**Renovar un anuncio que vence**

1. Busca los que dicen **Vence en N días**.
2. Toca **Editar**, cambia **Termina el** y toca **Guardar anuncio**.

### Qué pasa solo

- El sitio guarda los anuncios en memoria hasta 60 segundos. Al guardar en el panel, esa memoria se borra al momento, por eso el cambio se ve rápido.
- Las vistas y los clics se cuentan solos cuando la gente ve y toca el anuncio.
- Un anuncio **Programado** aparece solo en su fecha de inicio y un **Vencido** desaparece solo. No necesitas hacer nada.
- No hay avisos automáticos de renovación todavía.

### Cuidado / problemas comunes

- **Agrega una imagen o al menos un título.** No se puede guardar un anuncio vacío.
- **El enlace debe empezar con / (dentro del sitio) o con https://** — `http://` (sin s) no se acepta.
- **La imagen o el video no tienen una dirección válida.** La liga del video debe empezar con `https://` o `/`.
- **La fecha de fin debe ser después de la de inicio.**
- **Solo imágenes WebP, JPG, PNG o AVIF.**, **La imagen pesa más de 6 MB.**, **La imagen es muy pesada para el servidor.**, **El almacén de archivos rechazó la imagen.** Usa una imagen más ligera o en otro formato.
- **Tu navegador no puede procesar la imagen.** Prueba con otro navegador (Chrome actualizado).
- **Falta crear la tabla. Corre el archivo esquema.sql en Supabase (SQL Editor).** La base de datos de publicidad no está lista; pásalo a soporte técnico.
- **No se pudo conectar con el sitio. Revisa tu internet e intenta de nuevo.**
- **"Caben N"** no se valida al guardar: puedes guardar más anuncios activos que los que caben, pero el sitio sólo muestra los primeros N según el **Orden**. Los demás no se ven aunque digan **Activo**.
- Esta página vive en el sitio público (no en el backend). Si el sitio está caído, la página no carga.

---

## Blog

En pantalla el título es **Blog del foro**.

### Para qué sirve

Aquí escribes los artículos y guías que salen en `hetnacnc.com/mx/foro-cnc/blog`. Cada artículo puede pertenecer a una sección del foro. Si lo marcas como **Guía fija**, sale arriba de esa sección.

### Qué ves en la pantalla

**Lista**

- Botón **+ Artículo nuevo**.
- Cada artículo con su título, la sección, **· Guía fija** si aplica, y **Publicado (fecha)** o **Borrador**.
- Botones **Ver** (sólo si está publicado; abre el artículo en el sitio), **Editar** y **Borrar**.
- Si no hay nada: **Todavía no hay artículos. Escribe el primero.**

**Editor (Artículo nuevo / Editar artículo)**

- **← Volver a la lista** (no guarda).
- **Título \***: mínimo 8 letras.
- **Sección del foro**: **Sin sección (general)**, **Router CNC**, **Corte láser**, **Plasma CNC**, **Torno y fresadora CNC**, **Impresión 3D**, **Diseño y CAM**, **Controladores y electrónica**, **Materiales y herramientas**, **Precios y negocio**, **Muestra tu trabajo**.
- **Autor** (por omisión **Equipo HETNA**).
- **Dirección (slug)**: la parte final de la liga. Si la dejas vacía, se arma sola con el título.
- Casilla **Guía fija**.
- **Resumen (sale en la lista y en Google)**. Si lo dejas vacío, se usa el título.
- **Contenido \***: a la izquierda escribes; a la derecha ves la **Vista previa**. Mínimo 50 caracteres.
  - Botón **¿Cómo doy formato?**: muestra la ayuda de formato.
  - Botón **Pasar a HTML**: convierte tu texto a HTML para editarlo a mano. **No hay regreso**: después ya sólo se edita en HTML.
- Desplegable **Imagen, video y Google (opcional)**: **Imagen de portada (liga https)**, **Video de YouTube (liga)**, **Título para Google (máx. 70)**, **Descripción para Google (máx. 170)**.
- Casilla **Publicado (si no, queda como borrador)**.
- Botón **Guardar**.

**Formato en texto simple**

| Escribes | Sale |
|---|---|
| `## Subtítulo` | Subtítulo grande |
| `### Subtítulo` | Subtítulo chico |
| Línea vacía entre párrafos | Párrafos separados |
| `**negritas**` | **negritas** |
| `*cursivas*` | *cursivas* |
| `- elemento` (uno por línea) | Lista con viñetas |
| `1. elemento` | Lista numerada |
| `[Texto](/mx/cotizar)` | Liga |
| `![Descripción](https://...)` (sola en su párrafo) | Imagen |

### Tareas paso a paso

**Escribir y publicar un artículo**

1. Toca **+ Artículo nuevo**.
2. Escribe el **Título** (por ejemplo, "Cómo pasar un PDF a DXF para cortar en CNC").
3. Elige la **Sección del foro**.
4. Escribe un **Resumen** de una o dos líneas.
5. Escribe el **Contenido**. Usa **¿Cómo doy formato?** si tienes dudas y revisa la **Vista previa**.
6. Opcional: abre **Imagen, video y Google** y pega la liga de la portada y los textos para Google.
7. Deja marcado **Publicado** y toca **Guardar**.
8. En la lista, toca **Ver** para revisarlo en el sitio.

**Guardar como borrador**

1. Igual que arriba, pero **quita** la casilla **Publicado** antes de **Guardar**.
2. Cuando esté listo, toca **Editar**, marca **Publicado** y **Guardar**.

**Poner una guía fija en una sección**

1. Abre el artículo con **Editar**.
2. Elige su **Sección del foro** y marca **Guía fija**.
3. Toca **Guardar**.

**Corregir un artículo ya publicado**

1. Toca **Editar**. Los artículos existentes se abren **en HTML**.
2. Cambia el texto con cuidado de no borrar las etiquetas (`<p>`, `<h2>`, etc.).
3. Toca **Guardar**. La fecha de publicación original no cambia.

### Qué pasa solo

- No hay procesos automáticos para el blog. Lo que guardas se ve en el sitio.

### Cuidado / problemas comunes

- **El título debe tener al menos 8 letras.**
- **El artículo está muy corto.** El contenido necesita al menos 50 caracteres.
- **Ya hay un artículo con esa dirección (slug). Cambia el título o el slug.** / **Ya hay otro artículo con ese slug.** Cambia la **Dirección (slug)**.
- **Artículo no encontrado.** Alguien lo borró; recarga la lista.
- Si cambias el **slug** de un artículo publicado, su liga cambia y la liga vieja deja de funcionar (y lo que ya tenía Google se pierde).
- Las ligas de portada y video deben empezar con `http://` o `https://`. Si pegas algo distinto, se guarda vacío sin avisarte.
- **Borrar** pide confirmar y el artículo deja de verse en el sitio.
- La lista muestra todos los artículos del módulo de aprendizaje; podrías ver artículos que no se crearon desde esta página (verificar).

---

## Contabilidad

### Para qué sirve

Es el departamento de contabilidad de HETNA (persona física, régimen 612 · Actividades empresariales y profesionales). Calcula el **ISR provisional** y el **IVA** de cada mes, guarda tus **facturas** emitidas y recibidas, y tiene un **auditor** que las revisa todos los días.

**Importante**: es un **borrador para tu contador**. No presenta nada ante el SAT. Revísalo con tu contador antes del día 17 de cada mes.

### Qué ves en la pantalla

**La primera vez**: si todavía no capturas tus datos fiscales, sólo ves el bloque **Datos fiscales de HETNA**. Las pestañas aparecen cuando guardas el RFC.

**Pestañas** (botones redondos arriba): **Resumen**, **Facturas**, **Auditoría** (con **(N ⚠)** si hay hallazgos graves), **Excel** y **Datos fiscales**. A la derecha, un selector del **año** (el actual y los 4 anteriores).

**Pestaña Resumen**

- Tarjetas: **Ingresos del año** (cobrados, sin IVA), **ISR provisional del año** (suma de pagos mensuales), **IVA del año** (a pagar, o **saldo a favor**), **Facturas** (emitidas / recibidas) y **Hallazgos abiertos** (en rojo si hay graves).
- Tabla por mes: **Mes**, **Ingresos**, **Deducciones**, **Depreciación**, **Base ISR acum.**, **ISR a pagar**, **IVA cobrado**, **IVA acreditable**, **IVA retenido**, **IVA a pagar**, **Saldo a favor**.
- Nota al pie: el cálculo usa lo **cobrado y pagado** (facturas PUE en su fecha; PPD cuando llega su complemento de pago) y la tarifa del art. 106 (Anexo 8 RMF 2026). **No incluye** pérdidas de años anteriores, PTU pagada ni estímulos.
- Bloque **Lo que no se dedujo y por qué**: cada factura que no contó como deducción, con el motivo.
- Si sale un recuadro rojo arriba, es un error del cálculo (por ejemplo, que no hay tarifa cargada para ese año).

**Pestaña Facturas**

- Bloque **Subir facturas**: acepta XML sueltos o el ZIP del SAT (emitidas y recibidas). Si una ya estaba, se actualiza sin perder lo que corregiste.
- Filtros: **Emitidas y recibidas / Emitidas / Recibidas**, mes (**Todo el año** o un mes) y la caja **Buscar nombre, RFC o UUID**.
- Tabla: **Fecha**, flecha (↗ emitida, ↙ recibida), **Con quién** (nombre, RFC y el inicio del UUID), **Tipo** (Ingreso, Nota crédito, Pago, Nómina, Traslado), **Método** (PUE/PPD), **Total**, **IVA**, **Cuenta como** y **SAT**.
- **Cuenta como** es un selector para corregir cómo cuenta cada factura:
  - **Ingreso propio**
  - **Cobro por cuenta de terceros (no es ingreso)**
  - **Gasto deducible**
  - **Inversión (se deprecia)** → aparece otro selector **Tipo de activo (sugerido)**
  - **No deducible**
  - **Personal (deducción de la anual)**
  - **Complemento de pago**
  - **Nómina**
  - **No cuenta**
- Columna **SAT**: **Vigente** (verde), **Cancelada** (rojo), **No encontrada** o **Sin revisar**.
- Bloque **Facturas de las suscripciones del Cotizador**: cada cobro de un plan (Mercado Pago, PayPal o Stripe) con su CFDI. Columnas **Fecha**, **Proveedor**, **Plan**, **Monto**, **CFDI**, **Receptor** y un botón **Reintentar** cuando hace falta. Estados del CFDI:
  - **Facturado**: ya tiene su factura nominativa.
  - **En la global del mes**: el taller no dio datos fiscales; entra en la factura global.
  - **Pendiente**, **Procesando**.
  - **Revisar a mano** / **Error**: algo falló.
  - **(falta contabilidad)**: se facturó pero el XML no entró a tu contabilidad.
  - Si sale **Facturación apagada: …**, falta configurar algo (ver variables). Los cobros se guardan y se facturan cuando la actives.

**Pestaña Auditoría**

- Bloque **Loop de auditoría**: corre solo cada día a las 7:43 a. m. Revisa reglas fiscales (ISR, IVA, CFDI) y forenses (listas negras del SAT, facturas canceladas o inexistentes, duplicados, patrones raros).
  - Botón **Auditar ahora**: revisa en ese momento.
  - Botón **Auditar y consultar al SAT**: además pregunta al SAT el estatus de hasta 20 facturas por clic.
  - Abajo ves las listas del SAT cargadas: **69-B** y **No localizados**, con cuántos RFC y su fecha.
- Bloque **🚦 Semáforo antes de pagar**: subes el XML que te mandó un proveedor y te dice:
  - **🟢 Puedes pagar**
  - **🟡 Revisa antes de pagar** (hay hallazgos de gravedad media)
  - **🔴 No pagues todavía** (hay hallazgos graves: proveedor en lista negra, factura cancelada, etc.)
  - Con el emisor, el total, el estatus en el SAT y la lista de problemas. **No se guarda** la factura.
- Botones **Abiertos**, **Resueltos**, **Descartados** para filtrar los hallazgos.
- Cada hallazgo trae su gravedad (**ALTA** rojo, **MEDIA** ámbar, **BAJA** gris), el mensaje, quién lo encontró (**🔍 Forense** o **📘 Fiscal**), la base legal y la regla. Botones **Resuelto** y **Descartar** (o **Reabrir** en las otras listas).

**Pestaña Excel**

1. **Descargar a Excel**: botón **Descargar Excel (año)**. Libro con fórmulas vivas: si corriges una cifra en Ingresos o Deducciones, el ISR y el IVA se recalculan. Trae la tarifa del SAT en su propia hoja. Ideal para mandárselo a tu contador.
2. **Subir movimientos sin factura**: botón **Bajar plantilla** y un campo para subir la plantilla llena (.xlsx). Sirve para cobros que no facturaste (sí pagan impuestos) y gastos sin factura (sólo control: no son deducibles). Si subes el mismo archivo dos veces no se duplica. Columnas de la plantilla: **Fecha (AAAA-MM-DD)**, **Tipo (ingreso o gasto)**, **Concepto**, **Subtotal (sin IVA)**, **IVA**.
3. **Excel siempre conectado**: botón **Crear liga** (o **Cambiar liga**) y **Desactivar**. Es una liga privada, de sólo lectura, con tus totales por mes. En Excel: Datos → Desde la web → pega la liga. En Google Sheets: `=IMPORTDATA("liga")`. **La liga se muestra una sola vez: cópiala en ese momento.**

**Pestaña Datos fiscales**

- Bloque **Datos fiscales de HETNA**: **RFC**, **Nombre**, **Código postal fiscal** y **Régimen** (fijo en 612). Botón **Guardar**. Deben ser idénticos a tu Constancia de Situación Fiscal: el auditor revisa que las facturas que recibes traigan exactamente estos datos.
- Bloque **Descarga automática del SAT**: con tu e.firma, el sistema baja cada día tus facturas emitidas y recibidas (incluso las que te emitieron sin avisarte).
  - Sin e.firma: campos **Certificado (.cer)**, **Llave privada (.key)**, **Contraseña de la e.firma** y botón **Validar y guardar**.
  - Con e.firma: **✔ e.firma guardada** (o **⚠ e.firma vencida**), RFC, vencimiento y último uso. Botones **Traer todo (año)**, **Revisar ahora** y **Borrar e.firma**.
  - Tabla de solicitudes al SAT: **Pedida**, **Qué** (Emitidas/Recibidas), **Periodo**, **Estado** (**En proceso en el SAT**, **Descargada**, **Sin facturas**, **Falló**) y **Nuevas**.
  - Desplegable **Bitácora de uso de la e.firma**: cada vez que se usó.

### Tareas paso a paso

**Primera configuración**

1. Abre **Contabilidad**. Verás **Datos fiscales de HETNA**.
2. Escribe tu **RFC** (13 caracteres), **Nombre** y **Código postal fiscal** tal como vienen en tu Constancia.
3. Toca **Guardar**. Aparecen las pestañas.
4. Ve a **Datos fiscales** → **Descarga automática del SAT**.
5. Elige tu **.cer**, tu **.key**, escribe la **Contraseña** y toca **Validar y guardar**.
6. Toca **Traer todo (año)**. El SAT tarda de minutos a horas; las facturas se descargan solas.

**Cierre del mes (antes del día 17)**

1. Ve a **Datos fiscales** y toca **Revisar ahora** para traer lo último del SAT.
2. Ve a **Facturas**, elige el mes y revisa la columna **Cuenta como**. Corrige lo que esté mal (por ejemplo, un gasto personal → **Personal (deducción de la anual)**).
3. Si compraste equipo, márcalo como **Inversión (se deprecia)** y elige el **Tipo de activo**.
4. Si cobraste algo sin factura, súbelo en **Excel** → **Subir movimientos sin factura**.
5. Ve a **Auditoría**, toca **Auditar y consultar al SAT** y atiende los hallazgos **ALTA**.
6. Ve a **Resumen** y revisa **ISR a pagar** e **IVA a pagar** del mes.
7. En **Excel** toca **Descargar Excel** y mándaselo a tu contador.

**Antes de pagarle a un proveedor**

1. Pídele el XML de su factura.
2. Ve a **Auditoría** → **Semáforo antes de pagar** y súbelo.
3. Si sale **🟢 Puedes pagar**, adelante. Si sale **🟡** o **🔴**, lee los puntos y habla con el proveedor antes de pagar.

**Subir facturas a mano (sin e.firma)**

1. Descarga del portal del SAT el ZIP o los XML.
2. Ve a **Facturas** → **Subir facturas** y elígelos (puedes elegir varios).
3. Lee el mensaje: **N nuevas, N ya estaban, N no son de tu RFC**.

**Reintentar la factura de una suscripción**

1. Ve a **Facturas** y baja a **Facturas de las suscripciones del Cotizador**.
2. En el cobro con **Pendiente**, **Error**, **Revisar a mano** o **(falta contabilidad)**, toca **Reintentar**.
3. Lee el mensaje que aparece arriba de la tabla.

### Qué pasa solo

- **Cada hora (al minuto 37)**: si tienes e.firma guardada, revisa las solicitudes pendientes en el SAT y mete lo descargado. Una vez al día pide emitidas y recibidas de los últimos 3 días.
- **Diario a las 7:43 a. m.**: loop de auditoría. Actualiza las listas del SAT (una vez por semana), revisa el estatus de las facturas, corre las reglas fiscales y forenses, y manda por correo los hallazgos graves.
- **Diario a las 9:07 a. m.**: reintenta los CFDI de suscripciones pendientes o con error, y los que no llegaron a la contabilidad.
- **El día 1 de cada mes** (en esa misma corrida): emite la factura global del mes anterior con los cobros en pesos de talleres sin datos fiscales.

### Variables del servidor

| Variable | Qué controla | Si no la pones |
|---|---|---|
| `CONTA_EFIRMA_KEY` | Llave para cifrar tu e.firma (32 bytes en base64). Sin ella no se guarda ninguna e.firma ni corre la descarga del SAT. | No hay |
| `CONTA_DESCARGA_SAT` | `0` apaga la descarga automática del SAT. | Encendida |
| `CONTA_AUDITORIA` | `0` apaga el loop diario de auditoría. | Encendido |
| `HETNA_LEADS_EMAIL` | Correo que recibe los hallazgos graves de la auditoría (verificar). | Sin correo |
| `FACTURAPI_KEY_HETNA` | Llave de facturación de HETNA para los CFDI de suscripciones. | Facturación apagada |
| `CFDI_SUSCRIPCIONES` | `0` apaga los reintentos diarios y la factura global. | Encendido |
| `COTIZADOR_SERIE_CFDI` | Serie de las facturas de suscripciones. | SUS |
| `COTIZADOR_CLAVE_PROD` | Clave de producto SAT de las suscripciones. | 81112106 |
| `COTIZADOR_FORMA_PAGO` | Forma de pago SAT de las suscripciones. | 31 |

### Cuidado / problemas comunes

- **Escribe un RFC válido (13 caracteres para persona física).**
- **Por ahora el cálculo es para el régimen 612 (actividad empresarial). RESICO viene después.**
- **Primero captura tu RFC.** / **Primero captura tu RFC en Contabilidad > Datos fiscales.** Llena los datos fiscales primero.
- **Falta la llave de cifrado en el servidor…** (recuadro rojo en la e.firma) o **Falta configurar CONTA_EFIRMA_KEY en el servidor…**: pide a soporte técnico que agregue `CONTA_EFIRMA_KEY` y reinicie. Sin eso, el botón **Validar y guardar** queda apagado.
- **Elige el .cer, el .key y escribe la contraseña.** Falta algún dato.
- **No se pudo abrir la e.firma: revisa que sean el .cer y el .key de tu e.firma y que la contraseña sea la correcta.**
- **Ese certificado no es una e.firma vigente (puede estar vencido o ser un sello digital CSD…)**: el sello digital (CSD) **no sirve**; necesitas la e.firma (antes FIEL).
- **La e.firma es del RFC …, pero tus datos fiscales dicen …**: la e.firma no corresponde al RFC capturado.
- **No se pudo hablar con el SAT: …** El SAT no respondió; intenta más tarde.
- **Sube el XML de la factura.** (semáforo) y **Sube la plantilla en formato .xlsx.** / **No se pudo leer el Excel. Usa la plantilla.** (movimientos): formato equivocado.
- Errores por renglón de la plantilla: **La fecha debe ir como AAAA-MM-DD**, **El tipo debe ser "ingreso" o "gasto"**, **El subtotal debe ser un número mayor a cero**, **El IVA debe ser un número (0 si no lleva)**.
- **Facturación apagada: Falta FACTURAPI_KEY_HETNA en el servidor.** o **… Falta el RFC de HETNA en Contabilidad > Datos fiscales.**
- Facturas que **no son de tu RFC** se rechazan al subir.
- Nunca mandes tu e.firma ni su contraseña por chat o correo. Sólo súbela en esta página. Se guarda cifrada y cada uso queda en la bitácora.
- Si compartiste por error la liga de **Excel siempre conectado**, toca **Cambiar liga**: la vieja deja de funcionar.
- La factura global del mes sólo se emite sola el día 1; esta página no tiene botón para emitirla a mano (verificar con soporte si la necesitas).

---

## Pagos a talleres

### Para qué sirve

Te dice **cuánto le debe HETNA a cada taller** por sus ventas. Todo el dinero de las ventas entra a las cuentas de HETNA (Mercado Pago y PayPal) y HETNA le paga al taller por **SPEI**. Aquí ves lo que ya puedes transferir y, después de transferir, lo marcas como pagado con la **clave de rastreo**.

### Qué ves en la pantalla

- Nota arriba: **Digital: disponible al momento. Físico: N días después de entregado (guía de Skydropx o "Ya lo recibí" del comprador). Ya trae descontada la comisión de HETNA.**
- Tarjeta verde **TOTAL POR PAGAR HOY (MXN)**: suma de lo disponible de todos los talleres (sólo en pesos).
- Una tarjeta por taller (y por moneda, si vende en pesos y dólares), ordenadas de mayor a menor disponible:
  - Nombre y correo del taller.
  - **Cuenta: (cuenta o CLABE) · (titular)**, como el taller la guardó en su panel. Si no la ha guardado: **⚠ el taller no ha guardado su cuenta**.
  - Si aplica: **⚠ No ha verificado su tarjeta: pídesela antes de transferirle.**
  - **DISPONIBLE PARA PAGAR**: lo que ya puedes transferir.
  - **Pendiente de entrega**: ventas de productos físicos que esperan la entrega (más los días de espera).
  - **Pagado**: lo que ya le transferiste antes.
  - Si hay algo disponible: campo **Clave de rastreo del SPEI** y botón **Marcar como pagado**.
- Si no hay ventas: **Todavía no hay ventas registradas.**

Cómo se calcula lo del taller: **productos − comisión de HETNA + envío**. Si el envío lo hizo HETNA con su propia guía, el cobro de envío se queda en HETNA.

### Tareas paso a paso

**Pagarle a un taller**

1. Abre **Pagos a talleres**.
2. Busca el taller y revisa su **DISPONIBLE PARA PAGAR** y su **Cuenta**.
3. Si dice **⚠ No ha verificado su tarjeta**, lo recomendado es pedirle que la verifique antes de transferir.
4. Entra a tu banco y haz el SPEI por **exactamente** la cantidad disponible a la cuenta que aparece.
5. Copia la **clave de rastreo** del SPEI.
6. Regresa al panel, pégala en **Clave de rastreo del SPEI** y toca **Marcar como pagado**.
7. Confirma las preguntas (**¿Ya le transferiste $… a …?**).
8. La cantidad pasa a **Pagado** y el disponible queda en cero.

**Hacer la ronda de pagos de la semana**

1. Mira **TOTAL POR PAGAR HOY (MXN)** para saber cuánto necesitas en el banco.
2. Recorre los talleres de arriba hacia abajo (están ordenados por monto) y repite la receta anterior.

### Qué pasa solo

- **Cada hora (al minuto 23)**: se registran en el saldo los pedidos que faltaban (por ejemplo, cuando el pago se confirmó después de crear el pedido) y lo físico que ya cumplió sus días después de la entrega pasa de **Pendiente** a **Disponible**.
- La entrega la marca la guía de Skydropx (cuando el rastreo dice entregado) o el comprador con **Ya lo recibí**.
- Lo digital (diseños, archivos) queda disponible al momento.
- Los pedidos cancelados, reembolsados o en revisión quedan **retenidos** y no se pagan. Esta pantalla no muestra lo retenido.

### Variables del servidor

| Variable | Qué controla | Si no la pones |
|---|---|---|
| `DIAS_LIBERACION` | Días después de la entrega para que lo físico quede disponible. | 3 |

### Cuidado / problemas comunes

- **Pon la clave de rastreo del SPEI.** La clave debe tener al menos 4 caracteres.
- **El disponible cambió (ahora X, viste Y). Recarga la página y revisa antes de marcarlo.** Mientras tenías la página abierta se liberó o retuvo algo. Recarga, compara con lo que transferiste y vuelve a marcar. Esto evita marcar como pagado algo que no transferiste.
- Si el taller no ha verificado su tarjeta y lo marcas de todos modos, sale el aviso **Este taller todavía no verifica su tarjeta: pídele que lo haga antes del siguiente pago.** El pago sí queda marcado.
- **No se pudo marcar. Intenta de nuevo.** Error de conexión; vuelve a intentar. Antes de repetir el SPEI, recarga la página para ver si ya quedó marcado.
- **No se pudo cargar. Cierra sesión, vuelve a entrar y recarga.**
- El sistema **no hace la transferencia**: sólo lleva la cuenta. Primero transfiere en tu banco y después marca.
- Si quieres **retener** un pedido (reclamo, archivo que no corresponde, contracargo), el sistema lo permite pero esta pantalla no tiene botón para hacerlo; pídelo a soporte técnico (verificar).
- La tarjeta verde suma sólo pesos. Los talleres con ventas en dólares se pagan aparte.

---

## Envíos

En pantalla el título es **Envíos HETNA**.

### Para qué sirve

Aquí ves los envíos del servicio **Envíos HETNA** (paquetes que mandan los clientes con guía de HETNA), con su **SOS Protección** y la **evidencia** que subió el cliente: fotos de alto, largo, ancho y báscula con la guía visible. Cuando Skydropx reporta un **sobrepeso** (la paquetería pesó o midió más de lo cotizado) lo registras aquí, se lo cobras a quien envió o lo disputas con la evidencia.

### Qué ves en la pantalla

Dos botones arriba: **Envíos** y **Sobrepesos**.

**Vista Envíos**

- Filtros: **Todos**, **Pendiente de pago**, **Pagados (generar guía)**, **Con guía**, **Cancelados**. (Se muestran los últimos 100.)
- Una tarjeta por envío:
  - **Folio** (ENV-00012), paquetería y fecha.
  - Tipo de paquete, medidas en cm, **kg cotizados**, contenido y si es nuevo o usado.
  - Precio y estado. Los estados aparecen tal cual: `pendiente_pago` (no ha pagado), `pagado` (pagado, falta la guía), `guia_generada` (ya tiene guía), `cancelado`.
  - Si contrató protección: **SOS Protección por $… (cobró $…)**.
  - Etiqueta **Evidencia completa** (verde) o **Evidencia: N de 4** (rojo). Las 4 obligatorias son alto, largo y ancho con cinta métrica, y el paquete en la báscula.
  - Botón **Ver detalle y fotos** / **Ocultar**.
- Al abrir el detalle:
  - **Remitente**: nombre, teléfono, correo y C.P.
  - **Destinatario**: nombre, teléfono y C.P.
  - **Pago MP** (número de pago de Mercado Pago) y si **Aceptó cobros por sobrepeso y evidencia** (los envíos viejos dicen **no (envío anterior al cambio)**).
  - Las fotos, cada una con su nombre (**Alto con cinta métrica**, **Largo con cinta métrica**, **Ancho con cinta métrica**, **Paquete en la báscula**, **Contenido antes de cerrar**, **Otra foto**) y la fecha. Tócala para abrirla en grande.
  - Si no hay fotos: **El cliente no ha subido evidencia.**
  - Nota: **Las ligas de las fotos duran 1 hora. Descárgalas para mandarlas a Skydropx si hay sobrepeso o reclamo.**

**Vista Sobrepesos**

- Bloque **Registrar un sobrepeso**:
  - Selector: **Envío HETNA (cliente)** o **Guía de pedido (taller)**.
  - **Folio**: `ENV-00012` para un envío, o el número de pedido (por ejemplo `123`) para la guía de un taller.
  - **kg cotizados** (opcional; si lo dejas vacío se toma el del envío), **kg reportados**, **Monto $** (obligatorio).
  - **Nota** (por ejemplo, número de guía y paquetería).
  - Casilla **Disputar primero (no cobrar todavía)**.
  - Botón **Registrar y cobrar** (naranja) o **Registrar en disputa** (azul oscuro) según la casilla.
- Totales por estado: cuántos y cuánto dinero hay en cada uno.
- Una tarjeta por sobrepeso: folio **SOB-00001**, referencia, si lo paga **Taller** o **Cliente**, nombre y correo, **kg cotizados → kg reportados**, monto, fecha, nota, si **✓ Tiene evidencia completa** o **Sin evidencia completa**, el pago de Mercado Pago si ya pagó, y su estado.

Estados y botones de cada sobrepeso:

| Estado | Qué significa | Botones disponibles |
|---|---|---|
| **Por cobrar** | Se le mandó la liga de pago al responsable. | **Pasar a disputa**, **Pagó por fuera**, **Descontado al taller** (sólo talleres), **Anular** |
| **En disputa con la paquetería** | Lo estás peleando con la evidencia. No se cobra. | **Perdimos: cobrar**, **Ganamos: anular** |
| **Pagado** | Ya se pagó. | — |
| **Descontado de pagos al taller** | Se lo descontaste al taller. | — |
| **Anulado (disputa ganada)** | No se cobra. | **Volver a cobrar** |

### Tareas paso a paso

**Cuando Skydropx te reporta un sobrepeso**

1. Abre **Envíos** → **Sobrepesos**.
2. Elige **Envío HETNA (cliente)** o **Guía de pedido (taller)**.
3. Escribe el **Folio** (ENV-… o número de pedido), los **kg cotizados**, los **kg reportados** y el **Monto $** que te cobró Skydropx.
4. En **Nota** pon el número de guía y la paquetería.
5. Decide:
   - Si crees que el cobro es justo, deja la casilla vacía y toca **Registrar y cobrar**. Al responsable le llega un correo con la liga de pago de Mercado Pago.
   - Si tiene evidencia completa y crees que es injusto, marca **Disputar primero** y toca **Registrar en disputa**.
6. Lee el mensaje que sale debajo (por ejemplo, **Se le mandó la liga de pago por correo.** o **Tiene la evidencia completa: considera disputarlo.**).

**Disputar un sobrepeso con la evidencia**

1. Ve a **Envíos**, busca el folio ENV-… y toca **Ver detalle y fotos**.
2. Descarga las 4 fotos (alto, largo, ancho, báscula) **en menos de 1 hora**, porque las ligas caducan. Si caducan, cierra y vuelve a abrir el detalle.
3. Mándalas a Skydropx con tu reclamo.
4. Cuando te respondan, en **Sobrepesos** toca **Ganamos: anular** o **Perdimos: cobrar**.

**Registrar que ya te pagaron por otro lado**

1. En **Sobrepesos**, busca el que está **Por cobrar**.
2. Toca **Pagó por fuera** (transferencia o efectivo).

**Reclamar la SOS Protección**

1. En **Envíos**, busca el envío con **SOS Protección por $…**.
2. Toca **Ver detalle y fotos** y descarga la evidencia.
3. Haz el reclamo con Skydropx o la aseguradora con esas fotos (verificar el proceso con Skydropx).

### Qué pasa solo

- Cuando un sobrepeso queda **Por cobrar**, el sistema crea la liga de pago de Mercado Pago y le manda un correo al responsable con el folio, los kilos y el monto.
- Mientras un sobrepeso está **Por cobrar**, el cliente **no puede pedir nuevos envíos** y el taller **no puede generar nuevas guías** desde su panel. Al pagar con la liga se libera solo.
- **Cada 30 minutos** (minutos 17 y 47): se terminan las guías que quedaron generándose, se marcan como enviados los pedidos que faltaban y se sigue el rastreo hasta marcar el pedido como entregado.
- **Cada 5 minutos**: se dejan listos los envíos de los talleres nuevos ("Envío estándar" y "Entrega digital") en cuanto capturan su dirección.
- En el **Centro de control** salen avisos de sobrepesos pendientes y de guías sin las fotos del paquete.

### Variables del servidor

| Variable | Qué controla | Si no la pones |
|---|---|---|
| `MERCADOPAGO_ACCESS_TOKEN` | Crear la liga de pago del sobrepeso. Sin ella se registra pero no hay liga. | Sin liga |
| `MP_WEBHOOK_ENVIO_URL` | A dónde avisa Mercado Pago cuando pagan. | La tienda + `/api/mp-envio` |
| `RESEND_API_KEY` | Envío del correo al responsable. | Sin correo |

### Cuidado / problemas comunes

- **Escribe el monto que cobró la paquetería.** El monto es obligatorio y mayor a cero.
- **No existe ese envío (ENV-…).** Revisa el folio.
- **Ese pedido no tiene guía de Envíos HETNA.** El número de pedido no tiene guía generada por HETNA.
- **Elige si es un envío (ENV-…) o la guía de un pedido de taller.**
- **OJO: no salió el correo; revisa Resend/Mercado Pago.** Se registró pero no se pudo avisar (sin correo del responsable o falla del servicio). Avísale tú.
- **Este sobrepeso ya está pagado.** Ya no se puede cambiar (sólo anular).
- **Sólo a un taller se le puede descontar de sus pagos.**
- **Descontado al taller sólo cambia el estado.** No resta nada de **Pagos a talleres**: tienes que descontarlo tú al transferirle (verificar). Al marcar el pago, la pantalla registra el disponible completo aunque hayas transferido menos; anota la diferencia en la nota de tu banco.
- **Las ligas de las fotos duran 1 hora.** Descárgalas en cuanto las abras.
- **Envío no encontrado.** El folio ya no existe.

---

## Cargar productos

### Para qué sirve

Sirve para subir **muchos productos de la tienda HETNA de una vez** con una plantilla de Excel. Primero se revisa todo sin cambiar nada. Nada se publica hasta que confirmas. Los productos quedan a nombre de la tienda oficial de HETNA (no de un taller).

### Qué ves en la pantalla

- **1. Baja la plantilla**: botón **Bajar plantilla**. Trae las categorías actuales de la tienda, ejemplos (fresas, consumibles, filamento) e instrucciones. Precio: el final con IVA incluido.
- **2. Súbela llena**: un campo para elegir el archivo `.xlsx`. En cuanto lo eliges, se revisa renglón por renglón **sin cambiar nada**.
- **3. Revisión de "archivo"**: aparece después de subir. Muestra:
  - **N renglones · N productos · N nuevos · N a actualizar · N errores**.
  - **Errores (hay que corregirlos)**: tabla con **Renglón**, **Columna** y **Qué pasa**.
  - **Avisos (se puede importar, pero revísalos)**.
  - **Se van a crear** y **Se van a actualizar**, con el número de variantes, la categoría y si queda como **borrador**.
  - Botones:
    - **Importar N productos** (sólo si no hay errores).
    - **Importar sólo los N sin errores** (si hay errores).
    - **Subir otro archivo**.
- **Listo**: el resultado final: **N creados · N actualizados · N con error**, y por producto **✓** o **✗**, con **N con precio y existencias** y los avisos.

**Columnas de la plantilla** (las de **\*** son obligatorias):

| Columna | Qué poner |
|---|---|
| **Agrupador** | Opcional. El mismo texto en varios renglones = un producto con varias medidas. Vacío = se agrupa por nombre. |
| **Nombre del producto \*** | Qué es, marca o material y medida principal. De 3 a 120 letras. |
| **Descripción** | Para qué sirve, materiales, compatibilidad. Renglones que empiezan con `-` se vuelven lista. Si el producto ya existe y la dejas vacía, se queda la que tiene. |
| **Categoría \*** | Como se llama en la tienda. Si hay dos iguales: `Padre > Hija`. |
| **Marca** | Recomendada: Google Shopping la pide. Vacía = el nombre de la tienda. |
| **Condición** | "nuevo", "usado" o "reacondicionado". Vacía = nuevo. |
| **Código de barras (GTIN)** | Opcional. El número bajo el código de barras (8, 12, 13 o 14 dígitos). Con él Google enseña más tu producto. Pon esa columna como **Texto** en Excel para no perder ceros al inicio. |
| **Número de parte (MPN)** | Opcional. El número de parte o modelo del fabricante. Si no hay código de barras, Google usa marca + número de parte. |
| **Variante (qué cambia)** | Ej. "Diámetro", "Color". Igual en todo el grupo. Vacío si sólo hay una presentación. |
| **Valor de la variante** | Ej. "6 mm", "Negro". Obligatorio si el grupo tiene más de un renglón. |
| **SKU \*** | Tu código. Único en el archivo; sirve para actualizar después. Letras, números, punto, guion y diagonal. |
| **Precio MXN (IVA incluido) \*** | El precio final. La tienda no le suma IVA. |
| **Existencias \*** | Piezas disponibles hoy (entero, 0 o más). Al actualizar, reemplaza el número que había (no se suma). |
| **Peso kg \***, **Largo cm \***, **Ancho cm \***, **Alto cm \*** | Del paquete con empaque. La paquetería cotiza con esto. |
| **Imágenes (ligas)** | Ligas `https` separadas por coma. La primera es la portada. |
| **Estado** | "publicado" o "borrador". Vacío = publicado si es nuevo; si ya existe, se queda como está. |
| **Título SEO** | Opcional, máx. 70 letras. |
| **Descripción SEO** | Opcional, máx. 160 letras. |
| **Etiquetas** | Opcional. Palabras para la búsqueda, separadas por coma. |

### Tareas paso a paso

**Subir productos nuevos**

1. Toca **Bajar plantilla** y ábrela en Excel.
2. Lee la hoja de instrucciones y copia el nombre exacto de la categoría.
3. Llena un renglón por cada presentación. Si un producto tiene varias medidas o colores, usa el mismo **Agrupador**, la misma **Variante** y un **Valor** distinto en cada renglón.
4. Guarda como `.xlsx`.
5. En **2. Súbela llena**, elige el archivo.
6. Lee la **Revisión**. Corrige los **Errores** en tu Excel y vuelve a subir (botón **Subir otro archivo**).
7. Cuando no haya errores, toca **Importar N productos**. Puede tardar unos minutos si son muchos o traen fotos.
8. Revisa el resultado en **Listo**.

**Actualizar precios y existencias**

1. Usa el mismo archivo con el que los subiste (mismos **SKU** y **Agrupador**).
2. Cambia **Precio** y **Existencias**.
3. Súbelo. En la revisión deben salir en **Se van a actualizar**.
4. Toca **Importar**.

**Importar aunque algunos renglones tengan error**

1. En la revisión, toca **Importar sólo los N sin errores**.
2. Corrige los demás después y súbelos en otro archivo.

### Qué pasa solo

- Las fotos de las ligas se **copian** al almacén de la tienda. Si una no baja (no responde, no es imagen o pesa más de 8 MB), se usa la liga original y sale un aviso.
- Si la tienda acepta dólares, se pone también un precio en dólares calculado con el tipo de cambio (termina en .99 y nunca baja de 1.99).
- Al terminar, se dejan listos los envíos de la tienda HETNA.
- Cada producto se procesa por separado: si uno falla, los demás siguen.

### Variables del servidor

| Variable | Qué controla | Si no la pones |
|---|---|---|
| `CAM_SELLER_HANDLE` | Identificador de la tienda oficial de HETNA a la que se cargan los productos. | hetna-cnc |
| `TIPO_CAMBIO_USD_MXN` | Tipo de cambio para el precio en dólares. | 18 |

### Cuidado / problemas comunes

- **Sube la plantilla llena en formato .xlsx.** Sólo acepta `.xlsx`.
- **Falta esta columna en el archivo. Usa la plantilla.** No cambies ni borres los títulos de las columnas.
- Errores comunes por renglón:
  - **El nombre debe tener de 3 a 120 letras.**
  - **Falta la categoría.** o un error de categoría que no existe (copia el nombre exacto de la hoja de instrucciones).
  - **Falta el SKU.**, **SKU repetido (también está en el renglón N).**, **El SKU ya es de otro producto de la tienda (…).**
  - **El precio debe ser un número mayor a cero.** / **El precio es demasiado alto; revisa que no falte el punto decimal.**
  - **Las existencias deben ser un número entero, 0 o más.**
  - **El peso (kg) debe ser mayor a cero.**, **La medida (cm) debe ser mayor a cero.**
  - **"…" no es una liga https válida.**
  - **Escribe "publicado" o "borrador".**
  - **Este producto tiene varios renglones: di qué cambia entre ellos (ej. "Diámetro").**, **Falta el valor de la variante…**, **Valor repetido en el mismo producto…**
  - **Choca con el producto del renglón N (mismo identificador…). Usa un agrupador distinto.**
  - **"…" ya existe en la tienda y no tiene (SKU). Para agregar medidas a un producto existente usa el panel, o un Agrupador nuevo.** Esta página no agrega medidas nuevas a productos que ya existen.
- Avisos que no impiden importar: peso de más de 70 kg, título o descripción SEO muy largos, datos distintos entre renglones del mismo producto (se usa el del primer renglón), medidas de la tienda que no vienen en el archivo (se dejan como están).
- **El archivo tiene errores. Corrígelos o importa sólo los productos sin errores.** / **No hay productos para importar.**
- **No existe la tienda "…"** o **La tienda "…" no tiene almacén**, o **No hay perfil de envío para productos físicos.**: falta configurar la tienda oficial. Pásalo a soporte técnico.
- **Qué pasa al actualizar un producto que ya existe:**
  - Las celdas vacías **no borran** nada: la descripción, el estado (publicado o borrador), la marca, el SEO y el código de barras se quedan como estaban.
  - **Existencias** reemplaza el número; no lo suma.
  - Si pones **Imágenes**, reemplazan las fotos anteriores. Si la dejas vacía, se conservan.

### Productos físicos para que salgan en Google Shopping

Google Shopping sólo acepta productos físicos: no toma archivos digitales, servicios ni paquetes de créditos. Los productos que subas aquí entran solos al catálogo de Google y de Facebook/Instagram (`hetnacnc.com/feeds/google.xml`), en un máximo de una hora. Para que Google los acepte y los enseñe más:

1. **Foto**: al menos una, con fondo claro y el producto completo.
2. **Precio y existencias**: si las existencias son 0, sale como "agotado".
3. **Marca**: la del fabricante (si es tuyo, "HETNA").
4. **Código de barras (GTIN)** si la caja lo trae; si no, **Número de parte (MPN)**.
5. **Condición**: "nuevo", "usado" o "reacondicionado".
6. **Peso y medidas reales del paquete**: con eso se cotiza el envío al cliente.

La categoría tiene que ser de productos físicos. Las de diseños, software, archivos o servicios (maquinado, maquila, diseño a la medida, programación CAM) quedan fuera del catálogo de Google.


---

# Capítulo 4 · Páginas del panel (parte B)

Estas pantallas no vienen de Mercur: las hicimos para HETNA. Todas están en el menú de la izquierda del panel (**/dashboard**).

Antes de empezar, ten en cuenta tres cosas que aplican a todas:

- Usan la misma sesión con la que entraste al panel. Si una página dice **"No se pudo verificar tu sesión de administrador..."** o **"Tu sesión venció..."**, cierra sesión, vuelve a entrar y recarga la página.
- Los horarios de este capítulo están en hora del centro de México.
- Las "variables de entorno" son ajustes que se escriben en el archivo `.env` del servidor (API). Aquí sólo verás su nombre, para qué sirven y su valor de fábrica. Nunca compartas sus valores. Cambiarlas requiere reiniciar el servidor; pídeselo a quien te da soporte técnico.

Dónde está cada página en el menú:

| Página | Sección del menú |
|---|---|
| **Solicitudes** | Principal |
| **Verificaciones**, **Fundadores** | Marketplace |
| **Cotizador**, **Trabajos CAM** | Apps HETNA |
| **Trabajos reales**, **Categorías ocultas** | Al final del menú, debajo de Apps HETNA (no tienen sección propia) |

> Ojo con el nombre: esta página **Solicitudes** es para pedidos de fabricación. No tiene nada que ver con las "solicitudes" de Mercur (altas de tiendas o productos). Ésas se ven dentro de **Tiendas** y **Productos**.

---

## Solicitudes

### Para qué sirve

Aquí das seguimiento a cada **solicitud de fabricación**. Es lo que un cliente pide en "Cotizar": "necesito 20 placas de acero cortadas con láser". Desde aquí:

- Revisas las nuevas antes de que lleguen a los talleres.
- Le pides datos al cliente si falta algo.
- Ves las propuestas de los talleres, los archivos y el historial.
- Resuelves disputas (problemas entre cliente y taller).

Cada solicitud pasa por estas etapas:

**Nueva → En revisión → Enviada a talleres → Cotizada → Aceptada → En producción → Entregada → Cerrada** (o **Cancelada**).

Quién mueve cada etapa:

- **En revisión**: entra sola al llegar.
- **Enviada a talleres**: tú la apruebas, o se aprueba sola si nadie la revisa en 24 horas.
- **Cotizada**: llega la primera propuesta de un taller.
- **Aceptada**: el cliente elige una propuesta.
- **En producción**: se confirma el pago en Mercado Pago.
- **Entregada**: el taller la marca, con paquetería y número de guía.
- **Cerrada**: el cliente confirma que la recibió, o se cierra sola 10 días después de la entrega.

### Qué ves en la pantalla

- Título **Solicitudes de fabricación**.
- Una fila de pestañas con el número de solicitudes de cada una:
  **⚠ Disputas**, **Por revisar**, **Con talleres**, **Cotizadas**, **Aceptadas**, **En producción**, **Entregadas**, **Cerradas**, **Canceladas**, **Todas**.
  Al abrir la página verás **Por revisar**.
- Una tarjeta por solicitud. Cada una muestra:
  - El folio y la etapa (en una etiqueta naranja).
  - Si es **Abierta** (para todos los talleres) o **Para un taller** (directa), cuántas propuestas tiene y cuándo se creó.
  - La liga **Ver como el cliente ↗**: abre la página tal como la ve el cliente.
  - La descripción del trabajo y datos como **Necesita**, **Proceso**, **Material**, **Cantidad**, **Medidas**, **Acabado**, **Para**, **Presupuesto**, **Entrega**.
  - El cliente: nombre, correo y un botón verde de **WhatsApp**. Si ya pagó o ya hay guía de envío, también aparecen.
- El botón **Historial, propuestas y archivos** abre el detalle:
  - **Archivos**: descargas del cliente. Las ligas duran 1 hora. Cada descarga queda registrada, y el cliente la puede ver.
  - **Quién bajó los archivos**: fecha, quién, qué archivo e IP. Si alguien intentó bajar sin permiso, sale en rojo.
  - **Propuestas**: taller, precio, días y si incluye envío. La elegida aparece con ★ en verde.
  - **Historial**: todo lo que ha pasado. Las notas internas dicen *(interna)*.
  - El cuadro **Mover etapa o anotar**.

### Tareas paso a paso

**1. Revisar una solicitud nueva**

1. Entra a **Solicitudes**. Ya estás en la pestaña **Por revisar**.
2. Lee la tarjeta. Pregúntate: ¿un taller puede dar un precio real con esto? (material, cantidad, medidas, archivo).
3. Abajo verás el cuadro **Revisión: ¿tiene lo necesario para cotizar?** Elige una opción:
   - Si está completa, da clic en **Aprobar y enviar a talleres**. La nota es opcional; si escribes una, el cliente la lee en su correo. Verás **"Aprobada: se está enviando a los talleres."** El aviso a los talleres puede tardar unos minutos.
   - Si falta algo, escribe en el cuadro qué necesitas (mínimo 5 letras) y da clic en **Pedir información al cliente**. Al cliente le llega un correo con tu pregunta. La solicitud se queda en revisión.
   - Si no se puede hacer, escribe el motivo y da clic en **Cancelar**, luego confirma. El cliente recibe tu motivo por correo.

Qué pasa al aprobar (con el botón o sola a las 24 horas):

- La solicitud queda abierta 7 días para recibir propuestas, contados desde la aprobación.
- Se avisa a los talleres que pueden hacer ese trabajo (por material, municipio y estado). Si es **privada**, sólo a los invitados.
- Si es abierta, sale en el tablero público de solicitudes (verificar).
- Si el cliente lo autorizó, se programa una publicación en redes desde el **Social Hub**, sin planos, presupuesto ni datos de contacto.
- Al cliente le llega el correo "Tu solicitud ya está con los talleres".

**2. Contactar al cliente por WhatsApp**

1. En la tarjeta, da clic en **WhatsApp** junto al nombre del cliente.
2. Se abre WhatsApp con su número. Si el número tiene 10 dígitos, se le agrega el 52 de México.

**3. Mover una etapa a mano o dejar una nota**

1. Da clic en **Historial, propuestas y archivos**.
2. Baja al cuadro **Mover etapa o anotar**.
3. Para cambiar de etapa: elige la nueva etapa en la lista y da clic en **Mover a esta etapa**. Si escribiste una nota, el cliente la ve.
4. Para sólo dejar una nota: escríbela. Si es sólo para HETNA, marca **Nota interna**. Luego da clic en **Sólo anotar**.

**4. Resolver una disputa**

1. Entra a la pestaña **⚠ Disputas**.
2. La tarjeta tiene un cuadro rojo con el problema, la fecha y quién tiene el dinero:
   - **cobro por HETNA**: HETNA retiene el dinero. No le liberes nada al taller hasta decidir.
   - **directo al taller**: el taller ya cobró. Si hay reembolso, lo hace él. Si no lo hace, se suspende.
3. Pide evidencia a los dos: fotos, guía, mensajes. Tienes máximo 5 días hábiles para decidir.
4. Escribe la decisión y el motivo. Si es parcial, pon los montos. Son mínimo 10 letras, y la leen el cliente y el taller.
5. En **¿Cómo se resuelve?** elige una opción:
   - **Liberar el pago al taller**
   - **Reembolso parcial y cerrar**
   - **Reembolso total y cancelar**
6. Da clic en **Resolver** y confirma.
7. **Importante:** el reembolso o la transferencia los haces tú a mano, en Mercado Pago, PayPal o el banco. El sistema sólo registra la decisión y avisa.

Qué hace cada decisión:

- **Reembolso total y cancelar**: la solicitud pasa a **Cancelada**. Al cliente le llega correo.
- **Reembolso parcial y cerrar**: pasa a **Cerrada**. Al cliente le llega correo.
- **Liberar el pago al taller**, si ya estaba entregada: pasa a **Cerrada** y te avisa para que le pagues al taller.
- **Liberar el pago al taller**, si todavía no se entregaba: sólo se anota en el historial y el trabajo sigue. Al cliente **no** le llega correo, aunque la ventana de confirmación diga que se le avisa. Al taller sí le llega.

### Qué pasa solo

| Cuándo | Qué hace |
|---|---|
| Cada hora (minuto :41) | Aprueba sola cualquier solicitud que lleve 24 horas o más en revisión, y la manda a los talleres. También cierra las entregadas hace 10 días o más sin queja del cliente (las que tienen disputa abierta no se cierran). Al cerrar te avisa para que le pagues al taller. |
| Cada hora (minuto :23) | Las solicitudes abiertas dejan de recibir propuestas a los 7 días. Si hubo propuestas, se le avisa al cliente que ya elija. Si no hubo ninguna, se cierra y te avisa a ti para que le busques taller a mano. |
| Cada hora (minuto :53) | Si una solicitud abierta sigue sin propuestas: a las 48 horas se reenvía a más talleres. A 24 horas del cierre se amplía 3 días (una sola vez), se avisa a todos los talleres que pueden hacerla y te avisa a ti. Las privadas y las directas no se amplían. |
| Diario, 10:17 | Recordatorios por correo (y celular, si la persona lo verificó). Al cliente: propuestas sin elegir y propuesta elegida sin pagar. Al taller: contraofertas sin responder y avances atrasados. |
| Diario, 3:17 | Revisa los archivos de solicitudes cerradas o canceladas hace más de 180 días. De fábrica **sólo reporta** cuántos borraría (los lunes te manda un correo). Sólo borra de verdad si se activa `ARCHIVOS_BORRADO`. |

Correos que recibe el cliente cuando cambia la etapa: al entrar a revisión, al enviarse a talleres, al marcarse entregada, al cerrarse y al cancelarse. Las demás etapas ya tienen su propio aviso.

Variables de entorno:

| Variable | Para qué sirve | De fábrica |
|---|---|---|
| `LICITACION_REVISION` | Si vale `0`, las solicitudes no pasan por tu revisión: van directo a los talleres. | Revisión encendida |
| `LICITACION_REVISION_HORAS` | Horas antes de que una solicitud sin revisar se apruebe sola. | 24 |
| `AMPLIAR_LICITACIONES` | Si vale `0`, apaga el reenvío a más talleres y la ampliación de plazo. | Encendido |
| `RECORDATORIOS_LICITACION` | Si vale `0`, apaga los recordatorios diarios. | Encendido |
| `ARCHIVOS_BORRADO` | Si vale `1`, borra de verdad los archivos viejos. Lo borrado no se recupera. | Apagado (sólo reporta) |
| `ADMIN_PANEL_URL` | Dirección del panel que va en los correos que te llegan. | La del sitio + `/dashboard` |
| `RESEND_API_KEY` | Llave del servicio de correo. Sin ella no sale ningún correo. | Sin valor |

### Cuidado / problemas comunes

- **Las 24 horas cuentan desde que el cliente creó la solicitud.** Pedir información **no detiene el reloj**. Si le pides un dato y no contesta a tiempo, la solicitud se aprueba sola igual. Si de verdad no se puede cotizar, mejor **Cancelar**.
- **Para mandarla a talleres usa siempre Aprobar y enviar a talleres.** Si la mueves a mano a **Enviada a talleres** con la lista, al cliente le llega el correo "Tu solicitud ya está con los talleres", pero **ningún taller recibe aviso**. Además sigue contando como "en revisión" y, al cumplir 24 horas, se aprueba sola.
- **Los cuadros de texto de una tarjeta comparten lo que escribes.** El texto de revisión, el de disputa y el de **Mover etapa o anotar** son el mismo. Revisa el texto antes de dar clic en otro botón.
- **Nota interna sólo aplica a Sólo anotar.** Si escribes una nota y das clic en **Mover a esta etapa**, el cliente la ve aunque marques la casilla.
- **Mover una etapa a mano le manda correo al cliente** cuando la nueva etapa es **En revisión**, **Enviada a talleres**, **Entregada**, **Cerrada** o **Cancelada**. El correo lleva tu nota. Por ejemplo, mover a **Entregada** le pide "Confirmar que lo recibí". Mueve etapas sólo para corregir algo que ya pasó.
- **Cerrar o cancelar a mano da por terminada una disputa abierta.** Mejor resuélvela con **Resolver**.
- **Cada pestaña muestra máximo 200 solicitudes** (las más recientes).
- **El número de la pestaña Por revisar puede no coincidir con la lista.** Las solicitudes muy viejas cuentan distinto (verificar).
- **Si un archivo dice (no disponible)**, el servidor no pudo darte la liga (por ejemplo, el archivo ya se borró).
- **Las ligas de descarga duran 1 hora.** Si ya pasó más tiempo, recarga la página (cerrar y abrir el detalle no genera ligas nuevas).

---

## Verificaciones

### Para qué sirve

Aquí revisas los documentos que mandan los talleres para ganarse la insignia **"✓ Taller verificado"**. Esa insignia sale en su página y en sus productos. La misma página tiene otras tres secciones:

- **Certificaciones por revisar**: certificados que suben los talleres (por ejemplo, ISO).
- **Membresía Empresarial de clientes**: la activas a mano para clientes empresa.
- **Reclamaciones de evaluaciones**: calificaciones que alguien pidió revisar.

### Qué ves en la pantalla

- Título **Verificación de talleres**.
- Pestañas: **Por revisar**, **Verificados**, **Rechazados**, **Sin enviar**.
- Una tarjeta por taller con:
  - Nombre, correo y teléfono.
  - Fecha de envío y de revisión.
  - La liga **Ver su página pública ↗**.
  - **Falta:** los documentos obligatorios que no ha subido.
  - Miniaturas de cada documento. Da clic en una para verla en grande. Los PDF dicen **📄 Abrir PDF**.

Documentos que puede subir un taller:

| Documento | ¿Obligatorio? |
|---|---|
| Identificación (frente) | Sí, 1 |
| Identificación (reverso) | Sí, 1 |
| Fachada | Sí, al menos 1 |
| Interior / máquinas | Sí, al menos 2 |
| Comprobante de domicilio | No |
| Constancia de situación fiscal | No (sirve para "Empresa verificada") |
| Acta constitutiva / poder | No |

Los documentos son privados. Sólo los ves tú, con tu sesión, y no se guardan en tu computadora.

### Tareas paso a paso

**1. Aprobar o rechazar a un taller**

1. Entra a **Verificaciones**. Ya estás en **Por revisar**.
2. Abre cada documento y revisa:
   - Que el nombre de la identificación coincida con el responsable del taller.
   - Que la fachada y el interior sean de un taller real.
   - Que las fotos no estén sacadas de internet.
3. Elige una opción:
   - Si todo está bien, da clic en **✓ Aprobar y verificar**. Si el taller subió su constancia fiscal y la revisaste, deja marcada la casilla **También "Empresa verificada" (revisé la constancia fiscal)**.
   - Si algo falla, escribe el motivo en el cuadro (por ejemplo, "la identificación no se lee") y da clic en **Rechazar**. El taller ve el motivo en su panel, lo corrige y lo vuelve a mandar.

**2. Quitarle la verificación a un taller**

1. Entra a la pestaña **Verificados**.
2. Busca al taller, escribe el motivo y da clic en **Quitar verificación**.
3. Pierde la insignia de taller verificado y la de empresa verificada. Pasa a **Rechazados**.

**3. Revisar una certificación**

1. Baja a **Certificaciones por revisar**.
2. Da clic en **Ver documento ↗**. Revisa que se lea, que el nombre coincida con el taller y que esté vigente.
3. Da clic en **✓ Aprobar**, o escribe un motivo y da clic en **Rechazar**.
4. Al aprobarla, sale en el perfil del taller y lo sube en el orden de búsqueda. No cambia su calificación.

**4. Activar o quitar la Membresía Empresarial a un cliente**

1. Baja a **Membresía Empresarial de clientes**. Por ahora es gratis.
2. Escribe el correo del cliente. El cliente debe tener cuenta en la tienda con ese mismo correo.
3. Si quieres, pon una fecha en **Hasta (opcional)**.
4. Da clic en **Activar membresía**. Al cliente le llega un correo.
5. Para quitarla, da clic en **Quitar** junto a su correo en la tabla.

Incluye licitaciones privadas y restringidas, resumen con IA, la opción "sólo talleres verificados" y que HETNA le busque proveedor.

**5. Revisar una reclamación de evaluación**

1. Baja a **Reclamaciones de evaluaciones**.
2. Lee el motivo y la evaluación (calificación y comentario).
3. Elige una opción:
   - **Ocultar evaluación**: la quita del perfil y recalcula la calificación.
   - **Mantener (es válida)**: se queda como está.

Aquí también llegan evaluaciones que el sistema retuvo porque parecían autoevaluaciones.

### Qué pasa solo

| Cuándo | Qué hace |
|---|---|
| Diario, 4:41 | Borra los documentos de verificación que ya no se necesitan, como promete el Aviso de privacidad. Rechazados o nunca enviados, sin cambios en 180 días: se borran los archivos. Talleres dados de baja hace más de 90 días: se borra todo. Talleres que ya no existen: se borra todo de inmediato. Los verificados y activos conservan sus documentos. |

Esta página no tiene variables de entorno propias.

### Cuidado / problemas comunes

- **No te deja aprobar si faltan documentos obligatorios.** Verás **"Faltan documentos: ..."**. Rechaza con un motivo para que el taller los suba.
- **La pestaña Rechazados no tiene botones.** Un taller rechazado tiene que corregir y volver a mandar. Entonces regresa a **Por revisar**.
- **Para rechazar o quitar la verificación tienes que escribir el motivo.** Si no, verás **"Escribe el motivo para que el taller sepa qué corregir."**
- **Al aprobar o rechazar no sale ningún correo al taller.** El taller ve el resultado en su panel (verificar).
- **Si una miniatura dice "No se pudo cargar"**, recarga la página. Si sigue igual, el archivo pudo haberse borrado.
- **Verificar un taller es distinto de aprobar su tienda.** Una tienda puede estar activa sin estar verificada. Las tiendas se aprueban o suspenden en **Tiendas** (ver capítulo de Primeros pasos).

---

## Cotizador

### Para qué sirve

Es el tablero de ventas del **Cotizador**, la app de paga para talleres en hetnacnc.com/cotizador. Aquí ves:

- Cuántos talleres se registran.
- Cuántos están en prueba, en Gratis y pagando.
- Cuánto entra al mes.
- A quién conviene hablarle esta semana.

**Sólo es para ver.** No cambias planes ni cobras desde aquí.

### Qué ves en la pantalla

- Título **Ventas del Cotizador** y el botón **Actualizar**.
- Cinco cifras:
  - **Ingreso mensual**: en pesos, más lo que entra en dólares por PayPal.
  - **Pagan**: cuántos hay en planes Taller, Pro e Industrial.
  - **En prueba**: incluye cuántos están en Gratis y cuántos tienen cortesía.
  - **Talleres**: total registrados, nuevos de la semana y de 30 días.
  - **Conversión**: qué porcentaje de los registrados paga.
- **A quién hablarle esta semana**: pruebas que terminan en 7 días, talleres en Gratis que ya hicieron 5 cotizaciones y planes cancelados que están por acabarse. Cada uno tiene un botón **WhatsApp** (con mensaje ya escrito) o **Escribir correo**.
- **Correos automáticos**: cuatro cuadros: **Bienvenida**, **Quedan días de prueba**, **Terminó la prueba** y **Llegó a 5 cotizaciones**. Cada uno dice **Enviados** (en total) y **Hoy** (los que saldrían en la próxima corrida).
- **Talleres**: tabla con filtros **Todos**, **En prueba**, **Gratis** y **Pagan**, y un buscador. Columnas: **Taller**, **Plan**, **Cotizaciones del mes**, **Registro**, **Renueva / vence**.

Etiquetas de plan: **Gratis**, **En prueba · N d** (días que le quedan), **Taller**, **Pro**, **Industrial**, **HETNA** (cuenta de la casa). Si un plan de paga dice **· cortesía**, se lo diste sin cobrar.

### Tareas paso a paso

**1. Hacer tus llamadas de la semana**

1. Entra a **Cotizador**.
2. Ve a **A quién hablarle esta semana**. Cada renglón explica por qué le hablas (por ejemplo, "Le quedan 3 días de prueba").
3. Da clic en **WhatsApp**. Se abre con un mensaje ya escrito. Ajústalo si quieres y mándalo.
4. Si no tiene teléfono, usa **Escribir correo**.

**2. Buscar a un taller**

1. En la tabla **Talleres**, escribe su nombre, correo o teléfono en el buscador.
2. Usa los filtros para ver sólo un grupo (por ejemplo, **Pagan**).
3. Si en **Cotizaciones del mes** el número sale en rojo, está en Gratis y ya llegó al límite. Es buen momento para ofrecerle un plan.

**3. Ver datos al día**

1. Da clic en **Actualizar**. La página no se refresca sola.

### Qué pasa solo

| Cuándo | Qué hace |
|---|---|
| Diario, 10:47 | Correos a talleres: bienvenida, "te quedan 4 días de prueba", "terminó tu prueba" y "ya usaste tus 5 cotizaciones". |
| Diario, 11:07 | Marketing automático: seguimientos, último aviso, anticipo pendiente, gracias con reseña y reactivación. El correo sale solo. Los WhatsApp quedan en una "Cola de hoy" para mandarlos a mano (verificar dónde se ve esa cola). |
| Diario, 8:17 | Avisos de mantenimiento de las máquinas registradas en el Cotizador. |
| Cada hora (minuto :17) | Los talleres que cancelaron o pausaron su suscripción conservan su plan hasta la fecha que pagaron. Al pasar esa fecha, bajan a Gratis. |
| Diario, 4:43 | Vuelve a revisar en Mercado Pago y PayPal cada suscripción activa, por si se perdió algún aviso de cancelación. Las que llevan más de 7 días sin renovarse te las reporta. No les quita el plan solo. |
| Día 1 de cada mes, 11:23 | Cobra la comisión de HETNA sobre los anticipos que los talleres cobraron con PayPal el mes anterior. |

Variables de entorno:

| Variable | Para qué sirve | De fábrica |
|---|---|---|
| `COTIZADOR_SUPABASE_SERVICE_KEY` | Llave para leer la base de datos del Cotizador. **Sin ella la página no carga.** | Sin valor |
| `COTIZADOR_SUPABASE_URL` | Dirección de esa base de datos. | Ya viene configurada |
| `COTIZADOR_CORREOS` | Si vale `off`, apaga los correos automáticos. | Encendido |
| `COTIZADOR_MARKETING` | Si vale `off`, apaga el marketing automático. | Encendido |
| `MARKETING_MAX_DIA` | Tope diario de mensajes automáticos (verificar a cuáles aplica). | 80 |
| `COTIZADOR_MANTENIMIENTO` | Si vale `off`, apaga los avisos de mantenimiento. | Encendido |
| `COTIZADOR_COMISIONES` | Si vale `off`, apaga el cobro mensual de comisiones. | Encendido |
| `COTIZADOR_PRECIO_TALLER` / `_PRO` / `_INDUSTRIAL` | Precio mensual en pesos de cada plan. | 299 / 599 / 1,199 |
| `COTIZADOR_PRECIO_USD_TALLER` / `_PRO` / `_INDUSTRIAL` | Precio mensual en dólares (PayPal). | 29 / 59 / 99 |
| `MERCADOPAGO_ACCESS_TOKEN` | Llave de Mercado Pago, para las suscripciones. | Sin valor |
| `RESEND_API_KEY` | Llave del servicio de correo. Sin ella no salen correos. | Sin valor |

### Cuidado / problemas comunes

- **Si ves "Falta COTIZADOR_SUPABASE_SERVICE_KEY..."**, la llave no está en el servidor. Pide que la agreguen.
- **Si ves "No se pudo leer la base del Cotizador..."**, la base del Cotizador no respondió. Espera unos minutos y da clic en **Actualizar**.
- **"Hoy" en Correos automáticos es una simulación.** Muestra lo que saldría; no manda nada al abrir la página.
- **El botón WhatsApp sólo aparece si el teléfono tiene al menos 10 dígitos.**

---

## Trabajos CAM

### Para qué sirve

Aquí atiendes los trabajos que mandan los clientes desde el **Laboratorio CAM** de 3, 4 y 5 ejes (hetnacnc.com/mx/cam/lab). En cada trabajo puedes:

- Ver la configuración de su máquina.
- Bajar su modelo 3D y su G-code.
- Cambiar el estado.
- Subir los archivos finales. El cliente los baja en "Mis trabajos CAM".

### Qué ves en la pantalla

- Título **Trabajos CAM**, un buscador (**Buscar pieza, correo o folio**) y una lista de estados (**Todos los estados**).
- Una tabla con **Fecha**, **Pieza**, **Servicio** (CAM 3 ejes, CAM 4 ejes, CAM 5 ejes o Posprocesador; "+ revisión" si el cliente pidió que lo revisaras), **Nivel**, **Cliente** y **Estado**.
- Los estados son: **Recibido**, **En carrito**, **Pagado**, **En revisión**, **Entregado** y **Cancelado**.
- 30 trabajos por página, con botones **Anterior** y **Siguiente**.

Al dar clic en un renglón se abre un panel a la derecha con:

- Los datos: **Folio**, **Servicio**, **Cliente**, **Pedido**, **Controlador**, **Cinemática**, **Herramienta**, **Material**, **Tiempo estimado**, **Puntos de corte**, **Colisiones sin resolver** y las fechas de creado, pagado y entregado.
- **Notas del cliente**, si escribió algo.
- **Archivos**: **Modelo 3D del cliente**, **G-code generado en el laboratorio** y los entregables que ya subiste.
- **Estado y notas internas**, con el botón **Guardar cambios**.
- **Entregar archivos al cliente**, con la casilla **Marcar como entregado**.
- **Configuración completa (JSON)**: todos los datos técnicos, para soporte.

### Tareas paso a paso

**1. Atender un trabajo pagado**

1. Entra a **Trabajos CAM**. En la lista de estados, elige **Pagado**.
2. Da clic en el trabajo.
3. En **Archivos**, baja el **Modelo 3D del cliente** y el **G-code generado en el laboratorio**.
4. Si lo vas a revisar, cambia el estado a **En revisión** y da clic en **Guardar cambios**.

**2. Entregar los archivos al cliente**

1. Abre el trabajo.
2. En **Entregar archivos al cliente**, elige uno o varios archivos.
3. Deja marcada **Marcar como entregado** si ya es la entrega final.
4. Da clic en **Subir N archivo(s)**. Verás **"Archivos subidos y trabajo entregado."**
5. El cliente los ve en "Mis trabajos CAM".

**3. Dejar notas internas**

1. Abre el trabajo.
2. Escribe en el cuadro de **Estado y notas internas**. El cliente no las ve.
3. Da clic en **Guardar cambios**.

### Qué pasa solo

| Cuándo | Qué hace |
|---|---|
| Al crearse el pedido en la tienda | Los trabajos CAM de ese pedido pasan solos a **Pagado**. |
| Al crearse, pagarse o entregarse un trabajo | Si está configurado `CAM_WEBHOOK_URL`, se avisa a una automatización externa (por ejemplo n8n). |
| Diario, 10:57 | Correos a las cuentas del plan Gratis del CAM Studio: "te falta el plan X para bajar lo que armaste", "se acabaron tus 5 programas", "tu proyecto quedó guardado" y "¿cómo te fue con tu primer programa?". |

Variables de entorno:

| Variable | Para qué sirve | De fábrica |
|---|---|---|
| `CAM_WEBHOOK_URL` | Dirección a la que se avisa cuando un trabajo se crea, se paga o se entrega. | Sin valor (no avisa) |
| `CAM_WEBHOOK_SECRET` | Clave que acompaña ese aviso, para que la automatización sepa que viene de HETNA. | Sin valor |
| `CAM_CORREOS` | Si vale `off`, apaga los correos automáticos del CAM Studio. | Encendido |

### Cuidado / problemas comunes

- **Al entregar no le llega un correo al cliente desde esta página**, salvo que la automatización del webhook lo mande (verificar). Si es urgente, avísale tú.
- **Puedes cambiar el estado a cualquiera, aunque no tenga sentido.** Por ejemplo, regresar un entregado a **Recibido**. Hazlo con cuidado.
- **No se puede borrar un entregable desde aquí** (verificar). Revisa bien el archivo antes de subirlo.
- **El buscador espera un momento después de que dejas de escribir.** Si no ves resultados, espera un segundo.

---

## Trabajos reales

### Para qué sirve

Aquí cargas **piezas reales ya terminadas**, para que un cliente nuevo vea que HETNA sí entrega. Salen en el inicio del sitio y en la página Cotizar.

También aquí pones el **Ejemplo de cotización** que se ve en la página Cotizar.

Regla de oro: **nunca subas casos inventados.**

### Qué ves en la pantalla

- Título **Trabajos reales**.
- Un formulario **Nuevo trabajo** (o **Editar trabajo**) con los campos:
  - **Qué se fabricó**
  - **Tipo de trabajo**
  - **Material**
  - **Ciudad**
  - **Tiempo de entrega**
  - **Orden (0 primero)**
  - **Foto de la pieza terminada**
- Dos casillas: **Tengo permiso del cliente para publicarlo** y **Publicado**.
- La lista **Cargados (N)**. Cada trabajo dice **Visible en el sitio**, **Sin permiso del cliente** o **No publicado**, y tiene botones **Editar** y **Borrar**.
- La sección **Ejemplo de cotización (página Cotizar)** con los campos **Pieza**, **Material**, **Cantidad**, **Propuestas recibidas**, **Rango de precio** y **Tiempo de entrega**, y los botones **Guardar ejemplo** y **Quitar ejemplo**.

### Tareas paso a paso

**1. Subir un trabajo real**

1. Entra a **Trabajos reales**.
2. Llena **Qué se fabricó**. Es obligatorio.
3. Llena los demás datos que tengas.
4. En **Foto de la pieza terminada**, elige la foto (JPG, PNG, WEBP o AVIF). Espera a que termine **Subiendo…** y aparezca la miniatura.
5. Marca **Tengo permiso del cliente para publicarlo**, sólo si de verdad lo tienes.
6. Marca **Publicado** si quieres que salga ya.
7. Da clic en **Guardar**. Verás **"Guardado."**

**2. Editar, ocultar o borrar un trabajo**

1. En **Cargados**, da clic en **Editar**. Los datos suben al formulario.
2. Cambia lo que necesites. Para ocultarlo sin borrarlo, quita la marca de **Publicado**.
3. Da clic en **Guardar**. Para salir sin guardar, da clic en **Cancelar**.
4. Para borrarlo para siempre, da clic en **Borrar** y confirma.

**3. Poner el ejemplo de cotización**

1. Baja a **Ejemplo de cotización (página Cotizar)**.
2. Llena los campos con un trabajo real ya respondido, **sin datos del cliente**.
3. Da clic en **Guardar ejemplo**.
4. Para quitarlo del sitio, da clic en **Quitar ejemplo**.

### Qué pasa solo

- Un trabajo sólo sale en el sitio si está **Publicado** y tiene **permiso del cliente**.
- Mientras no haya ninguno así, la sección no aparece en el sitio. El sitio nunca muestra ejemplos falsos.
- Si el ejemplo de cotización está vacío, la página Cotizar no muestra ejemplo.
- No hay tareas automáticas ni variables de entorno propias de esta página. La subida de la foto usa la misma herramienta que la página **Publicidad**.

### Cuidado / problemas comunes

- **No te deja publicar sin permiso del cliente.** Verás **"Sólo se publica con permiso del cliente."**
- **Sin foto no se guarda.** Verás **"Sube la foto de la pieza terminada."** Espera a que la foto termine de subir antes de dar clic en **Guardar**.
- **Si la foto no sube**, revisa que sea una imagen y no un PDF. Si sigue fallando, cierra sesión y vuelve a entrar.
- **El orden va de menor a mayor.** El 0 sale primero.

---

## Fundadores

### Para qué sirve

Aquí marcas a un taller como **Taller fundador**. El fundador recibe:

- La insignia de **Taller fundador**.
- 6 meses de **plan Pro gratis**, contados desde el día en que lo marcas.

Hay **30 lugares** en total.

### Qué ves en la pantalla

- Título **Talleres fundadores**.
- Una barra con **N de 30 lugares usados** y **Quedan N**. Si ya no hay lugares, dice **Cupo lleno** en rojo.
- Un buscador (**Buscar taller por nombre…**) y la lista de talleres. Cada uno muestra su estado:
  - **Taller normal**.
  - **★ Pro hasta [fecha] (N días)**: en verde, o en naranja si faltan 30 días o menos.
  - **★ Plan Pro vencido el [fecha]**: en rojo.
  - **★ Fundador (sin fecha de plan Pro)**: lo marcaron como fundador antes de que existiera esta página.
- Botones, según el caso: **Marcar fundador**, **Registrar 6 meses de Pro** y **Quitar**.

### Tareas paso a paso

**1. Marcar a un fundador**

1. Entra a **Fundadores**.
2. Busca al taller por su nombre.
3. Da clic en **Marcar fundador**.
4. Lee la pregunta y confirma. Verás **"Listo: [taller] ya es fundador."**

**2. Darle fechas a un fundador viejo**

1. Busca al taller que dice **Fundador (sin fecha de plan Pro)**.
2. Da clic en **Registrar 6 meses de Pro** y confirma. No ocupa un lugar nuevo.

**3. Quitar la marca**

1. Busca al taller y da clic en **Quitar**. Confirma.
2. Pierde la insignia y se libera su lugar.

### Qué pasa solo

- Una vez al día, una automatización de n8n revisa qué fundadores tienen 30 días o menos de plan Pro (o ya se les venció). Te avisa por Telegram, una sola vez por taller. Si vuelves a marcar al taller, el aviso puede salir otra vez.
- El cupo (30) y los meses (6) están fijos en el sistema. No hay variable para cambiarlos.

### Cuidado / problemas comunes

- **Esta página guarda la insignia y una fecha.** No encontramos en el sistema nada que active o quite un "plan Pro" por sí solo con esa fecha. Al vencer, decide tú qué hacer (verificar).
- **No revisa que el taller esté verificado.** La página dice "marca a los primeros talleres verificados", pero te deja marcar a cualquiera. Revísalo antes en **Verificaciones**.
- **Un fundador vencido no se puede renovar con un botón** (verificar). Para darle otros 6 meses, quítalo y vuelve a marcarlo, si hay lugar.
- **Las cuentas de prueba no reciben el aviso de vencimiento** (verificar si tampoco salen en la lista).
- **Si ves "No se pudo conectar con el sitio..."**, esta página depende de la tienda (hetnacnc.com), no sólo del panel. Revisa que el sitio esté en línea.

---

## Categorías ocultas

### Para qué sirve

Te muestra qué categorías **esconde la tienda** porque no tienen productos publicados (ni ellas ni sus subcategorías). Así el cliente no entra a una categoría vacía.

Una categoría oculta:

- No sale en el menú, en la portada ni en el mapa del sitio.
- Su página queda fuera de Google y muestra un aviso para cotizar.

**No se borra nada.** Esta página es sólo para consultar.

### Qué ves en la pantalla

- Título **Categorías ocultas** y una explicación.
- **Ocultas (N)**: tabla con **Categoría** (con su ruta, por ejemplo "Maquinaria > Routers") y **Dirección** (/categories/...). Si no hay ninguna, dice **"Ninguna: todas tienen productos."**
- **Visibles (N)**: la misma tabla más la columna **Productos**. Las páginas de servicio (corte láser, maquinado, impresión 3D, etc.) dicen **Servicio (siempre visible)**.

### Tareas paso a paso

**1. Saber qué categorías faltan por llenar**

1. Entra a **Categorías ocultas**.
2. Revisa la lista **Ocultas**. Ésas son las categorías donde conviene conseguir productos.

**2. Volver a mostrar una categoría**

1. Publica un producto en esa categoría (desde **Productos**, o que lo publique un taller).
2. Espera unos minutos. La categoría vuelve a salir sola. Puede tardar hasta 5 minutos.

### Qué pasa solo

- La tienda revisa sola qué categorías tienen productos. En cuanto una tiene uno publicado, reaparece en el menú, la tienda y el mapa del sitio.
- Las páginas de servicio de fabricación nunca se esconden.
- No hay tareas programadas ni variables de entorno propias.

### Cuidado / problemas comunes

- **Un producto en borrador no cuenta.** Tiene que estar **Publicado**.
- **Si acabas de publicar y la categoría sigue oculta**, espera 5 minutos y recarga la tienda.
- **Para cambiar el nombre o el orden de una categoría**, usa **Productos → Categorías**. Aquí sólo se consulta.

---

# Apéndice · Cosas que hoy no funcionan como dice la pantalla

Al leer el código para escribir este manual salieron detalles en los que la pantalla promete algo distinto de lo que pasa. Mientras no se arreglen, trabaja como dice la columna **Qué hacer mientras**. Todos se pueden corregir; pide el que más te estorbe.

## Dinero y envíos

| Dónde | Qué pasa | Qué hacer mientras |
|---|---|---|
| **Envíos › Sobrepesos** | **Descontado al taller** sólo cambia el estado. No resta nada del saldo del taller en **Pagos a talleres**. | Descuenta el sobrepeso a mano al transferirle al taller. |
| **Pagos** (sección de fábrica) | Probablemente sale vacía: no hay un proveedor de pagos automáticos conectado (verificar). | Los pagos reales a talleres se hacen en **Pagos a talleres**. |
| **Pagos a talleres** | El sistema puede retener un pedido, pero la página no tiene botón para hacerlo ni muestra lo retenido. | Si necesitas retener un pago, no lo marques como pagado. |
| **Contabilidad** | La factura global del mes sólo se emite sola el día 1. No hay botón para emitirla a mano. | Si el día 1 falló, avisa para emitirla. |
| **Resultados › Ventas por día** | Agrupa por día en hora de Londres (UTC): lo que se vende de noche cae en la barra del día siguiente. | Tómalo en cuenta al comparar días. |

## Solicitudes de fabricación

| Qué pasa | Qué hacer mientras |
|---|---|
| **Pedir información al cliente** no detiene el reloj de 24 horas: la solicitud se aprueba sola aunque estés esperando la respuesta. | Si falta información, rechaza la solicitud con una nota que explique qué debe mandar el cliente. |
| La **Nota interna** al mover de etapa **sí la ve el cliente**, y en 5 etapas le llega por correo. | No escribas en esa caja nada que el cliente no deba leer. |
| Las cajas de revisión, disputa y "Mover etapa o anotar" de una tarjeta comparten el mismo texto. | Escribe la nota justo antes de tocar el botón que la usa. |
| Mover a mano a **Enviada a talleres** le avisa al cliente, pero **no avisa a ningún taller**. | Avísales tú, o deja que la solicitud llegue a esa etapa sola. |
| En una disputa, **Liberar** antes de la entrega sólo deja una nota en el historial: no le llega correo al cliente, aunque el aviso de confirmación dice que sí. | Escríbele al cliente directamente. |
| El número de **Por revisar** puede no coincidir con la lista (las solicitudes antiguas no se cuentan). | Fíate de la lista, no del número. |

## Talleres (Tiendas y Verificaciones)

| Qué pasa | Qué hacer mientras |
|---|---|
| El botón **Revisar o suspender en el panel** de los correos de alta lleva a una dirección que probablemente ya no existe (verificar). | Entra a **Tiendas** desde el menú. |
| Aprobar un taller con **Confirmar** en **Tiendas** no le manda el correo de bienvenida de HETNA ni crea su anuncio en redes. El alta automática sí hace las dos cosas. | Escríbele tú la bienvenida o crea su anuncio en **Social Hub**. |
| Aprobar, rechazar o quitar una verificación no le manda correo al taller (verificar). | Avísale tú. |

## Social Hub

| Qué pasa | Qué hacer mientras |
|---|---|
| Una publicación en **error no se reintenta sola** (sólo Instagram, mientras está "procesando"). | Revisa **Publicadas** y usa **Publicar ahora**: sólo reintenta las redes que fallaron. |
| **Copiar** antes de publicar pone el texto `{{liga}}` en lugar de la liga real. | Usa **Crear y copiar**, o copia después de publicar. |
| Si **⏰ Programar** o **🚀 Publicar ahora** fallan al guardar, de todos modos intentan programar o publicar. | Si ves un error, recarga la página y revisa la publicación antes de volver a intentarlo. |
| Una publicación de fecha especial vencida responde "Se está publicando en este momento" al intentar publicarla. | Ignórala o descártala: ya pasó su fecha. |
| Sin llave de IA, los comentarios nuevos sólo aparecen en el filtro **Todos**. | Revisa ese filtro. |
| Un horario con "hasta" menor o igual a "desde" no se guarda, aunque diga **Guardado.** | Revisa que el horario de fin sea mayor que el de inicio. |
| La tarjeta de un borrador no enseña a qué página lleva, y el título y el destino no se pueden editar. | Ábrelo desde la vista previa para ver la liga. |
| No hay vista de **descartadas**: una vez descartada, no se recupera desde el panel. | Descarta sólo lo que de verdad no quieres. |
| La casilla **Promociones** también decide si se programan solas las piezas del Estudio diario y de Fechas especiales, aunque su texto no lo dice. | Tenlo en cuenta al apagarla. |

## Otras páginas

| Dónde | Qué pasa | Qué hacer mientras |
|---|---|---|
| **Publicidad** | No revisa cuántos anuncios caben en cada espacio: si activas más, sólo se ven los primeros según el orden. El aviso "Vence hoy" nunca sale. | Activa sólo los que caben y revisa las fechas de fin. |
| **Blog** | Una liga de portada o video que no empieza con `https://` se guarda vacía sin avisar. Al editar, el título puede quedar con menos de 8 letras. | Pega ligas completas y revisa el título. |
| **Centro de control** | "Se revisa cada 10 minutos" no es exacto: se actualiza al abrir la página o cuando corre el aviso automático (cada 2 horas, de 7:40 a 21:40). Los avisos con números que cambian ("lleva N días") pueden llegar repetidos. | Recarga la página para ver lo más reciente. |
