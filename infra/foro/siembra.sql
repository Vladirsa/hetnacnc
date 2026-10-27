-- Siembra del Foro CNC. Generado por infra/foro/generar-siembra.mjs
-- NO se edita a mano: se edita temas-semilla.json y se vuelve a generar.
-- Firma: @hetna  ·  15 temas
--
-- Correr DESPUÉS del esquema del foro y de que exista ese perfil.
-- Es idempotente: un tema que ya está no se duplica.

do $siembra$
declare
  autor uuid;
  puestos integer := 0;
begin
  select id into autor from foro.perfiles where usuario = 'hetna';
  if autor is null then
    raise exception 'No existe el perfil hetna en foro.perfiles. Créalo antes de sembrar.';
  end if;

  -- [precios-negocio] Nadie publica tarifas mexicanas. Es la duda que todo taller chico tiene y la que empata directo con el Cotizador.
  if not exists (
    select 1 from foro.temas where titulo = '¿Cuánto cobran la hora de router CNC aquí en México?'
  ) then
    perform foro.crear_tema(
      autor, 'precios-negocio', 'pregunta',
      $tema$¿Cuánto cobran la hora de router CNC aquí en México?$tema$,
      $tema$Abrimos esta pregunta porque buscando en internet sólo salen tarifas de Estados Unidos en dólares, y aquí ni la máquina, ni la luz, ni el cliente son los mismos.

Para los que ya están cobrando: ¿cuánto manejan la hora de router en madera y MDF, y cuánto en acrílico o aluminio? ¿La cobran parejo o le suben al material duro?

Y lo que más interesa: ¿cobran aparte el diseño y la programación, o va incluido en la hora?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [precios-negocio] Pregunta real de cotización. Conecta con los precios por cantidad que ya se pueden capturar en el panel del taller.
  if not exists (
    select 1 from foro.temas where titulo = 'Me pidieron 50 piezas iguales, ¿le bajo el precio por cantidad o no?'
  ) then
    perform foro.crear_tema(
      autor, 'precios-negocio', 'pregunta',
      $tema$Me pidieron 50 piezas iguales, ¿le bajo el precio por cantidad o no?$tema$,
      $tema$Nos llegó esta duda de un taller que apenas empieza: un cliente le pidió cotizar 50 piezas iguales y no sabe si cobrar lo mismo que por una o hacer precio por volumen.

Lo que él calcula es que el setup se hace una sola vez, así que algo debería bajar. Pero no sabe cuánto sin quedarse sin margen.

¿Ustedes cómo le hacen? ¿Tienen una regla, o lo sacan a sentimiento según el trabajo?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [router-cnc] El problema número uno de quien empieza en router. Mucho volumen de búsqueda en español.
  if not exists (
    select 1 from foro.temas where titulo = 'Se me quema el MDF en los cortes, ¿le subo la velocidad o le bajo las revoluciones?'
  ) then
    perform foro.crear_tema(
      autor, 'router-cnc', 'pregunta',
      $tema$Se me quema el MDF en los cortes, ¿le subo la velocidad o le bajo las revoluciones?$tema$,
      $tema$Esta pregunta nos llegó por WhatsApp y es de las más repetidas: el corte sale bien de medida pero el canto queda negro y oliendo a quemado, sobre todo en las curvas.

Trae fresa recta de 1/8 en MDF de 15 mm. Dice que al bajarle las revoluciones mejoró tantito pero no se quitó.

¿Es cuestión de avance, de revoluciones, de la fresa, o de que no está sacando la viruta?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [router-cnc] Problema documentado en Foromadera. Pregunta abierta que invita a que cada quien cuente su método.
  if not exists (
    select 1 from foro.temas where titulo = 'Al retomar un trabajo al otro día, el diseño me sale corrido'
  ) then
    perform foro.crear_tema(
      autor, 'router-cnc', 'pregunta',
      $tema$Al retomar un trabajo al otro día, el diseño me sale corrido$tema$,
      $tema$Este problema sale mucho en los foros de España y queremos ver cómo lo resuelven aquí: se deja un tallado a medias, se apaga la máquina, y al día siguiente el trabajo arranca desplazado en X.

Se entiende que el control pierde el origen al apagarse. Lo que no queda claro es cómo lo recuperan ustedes en la práctica.

¿Marcan el cero con algo físico en la mesa? ¿Usan sensor de home? ¿O de plano ya no apagan hasta terminar?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [router-cnc] Caso real de MetalAficion. El detalle de que reforzar lo empeoró hace la pregunta interesante.
  if not exists (
    select 1 from foro.temas where titulo = 'Al cortar círculos la máquina vibra feo, ¿es la estructura o la trayectoria?'
  ) then
    perform foro.crear_tema(
      autor, 'router-cnc', 'pregunta',
      $tema$Al cortar círculos la máquina vibra feo, ¿es la estructura o la trayectoria?$tema$,
      $tema$Nos preguntaron esto y nos pareció bueno para el foro: en cortes rectos la máquina va bien, pero al hacer círculos vibra y la vibración se siente hasta en la fresa.

Lo curioso es que al reforzar la estructura el problema empeoró en vez de mejorar.

¿Será el avance en las curvas, la aceleración del control, o de plano los patines? ¿A alguien le pasó lo mismo?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [materiales-herramientas] Pregunta de comunidad pura: el valor está en las respuestas, no en la pregunta. Buena para SEO local por estado.
  if not exists (
    select 1 from foro.temas where titulo = '¿Dónde compran MDF y triplay de buena calidad sin que les salga chueco?'
  ) then
    perform foro.crear_tema(
      autor, 'materiales-herramientas', 'pregunta',
      $tema$¿Dónde compran MDF y triplay de buena calidad sin que les salga chueco?$tema$,
      $tema$Aquí lo que queremos es armar entre todos un mapa de proveedores por estado, porque el mismo MDF de 15 mm varía muchísimo de una maderería a otra.

¿Dónde compran? ¿Qué marca les ha dado hoja pareja y sin alabeo?

Y al revés: sin ponerle nombre a nadie, ¿qué les ha tocado que venga húmedo o con el espesor fuera de medida?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [torno-fresadora] Caso documentado con número concreto. La pregunta de diagnóstico invita a respuestas técnicas.
  if not exists (
    select 1 from foro.temas where titulo = 'En trabajos 3D largos el eje Z se me va hundiendo, ¿qué lo causa?'
  ) then
    perform foro.crear_tema(
      autor, 'torno-fresadora', 'pregunta',
      $tema$En trabajos 3D largos el eje Z se me va hundiendo, ¿qué lo causa?$tema$,
      $tema$Nos consultaron este caso: en trabajos 3D de varias horas, la herramienta se va metiendo de más en el material poco a poco. Midió y después de un rato llevaba 2.5 mm de diferencia.

No es de golpe, es acumulado. Eso suena a pasos perdidos, pero también podría ser el acoplamiento o el peso del husillo venciendo.

¿Cómo distinguen si es el driver, el motor, o mecánico?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [torno-fresadora] Pregunta puente entre lo técnico y lo local. Sirve para posicionar por búsquedas de material.
  if not exists (
    select 1 from foro.temas where titulo = '¿Qué acero consiguen fácil en México y cuál se les da mejor para maquinar?'
  ) then
    perform foro.crear_tema(
      autor, 'torno-fresadora', 'pregunta',
      $tema$¿Qué acero consiguen fácil en México y cuál se les da mejor para maquinar?$tema$,
      $tema$Los manuales y los videos de YouTube hablan de aceros con nombres gringos que aquí no siempre se consiguen igual, o te los venden con otra nomenclatura.

¿Qué aceros tienen a la mano en su zona? ¿1018, 4140, inoxidable 304?

¿Y cuál les ha dado mejor acabado sin pelearse con la herramienta?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [controladores-electronica] Problema de arranque universal. Pregunta de alta intención: quien la busca tiene la máquina parada.
  if not exists (
    select 1 from foro.temas where titulo = 'Configuré los pasos por milímetro y la máquina se mueve otra cosa'
  ) then
    perform foro.crear_tema(
      autor, 'controladores-electronica', 'pregunta',
      $tema$Configuré los pasos por milímetro y la máquina se mueve otra cosa$tema$,
      $tema$Llegó esta duda: le pidió a la máquina moverse 100 mm y se movió como 160. Ya revisó la configuración y no le cuadra.

Trae motores a pasos con driver, y dice que los microsteps los dejó como venían.

¿Cómo sacan el número correcto? ¿Hay una forma de calibrarlo midiendo, en vez de andar adivinando?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [diseno-cam] Pregunta con respuestas largas asegurada. Genera comparativas que indexan bien.
  if not exists (
    select 1 from foro.temas where titulo = '¿Qué CAM usan y por qué se quedaron con ese?'
  ) then
    perform foro.crear_tema(
      autor, 'diseno-cam', 'pregunta',
      $tema$¿Qué CAM usan y por qué se quedaron con ese?$tema$,
      $tema$Vectric, Aspire, Fusion, ArtCAM, LightBurn, el que viene con la máquina. Todos prometen lo mismo y cuestan muy distinto.

¿Con cuál se quedaron y qué los hizo cambiar del anterior?

Lo que más sirve saber: ¿cuánto tardaron en agarrarle el modo? Porque un software barato que nadie entiende sale caro.$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [diseno-cam] Dolor real y cotidiano. Conecta con el Laboratorio CAM y con el escaneo 3D.
  if not exists (
    select 1 from foro.temas where titulo = 'El cliente me manda un PDF y quiere la pieza, ¿cómo lo vuelvo DXF sin volverlo a dibujar?'
  ) then
    perform foro.crear_tema(
      autor, 'diseno-cam', 'pregunta',
      $tema$El cliente me manda un PDF y quiere la pieza, ¿cómo lo vuelvo DXF sin volverlo a dibujar?$tema$,
      $tema$Nos pasa seguido: el cliente manda un PDF o hasta una foto del plano, y espera la pieza.

Volver a dibujar todo cuesta horas que normalmente no se cobran.

¿Qué usan para pasarlo a vectores? ¿Y cómo le hacen para confiar en las medidas de un PDF que no trae escala?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [corte-laser] Tema de seguridad real. Genera respuestas con experiencia y posiciona al foro como serio.
  if not exists (
    select 1 from foro.temas where titulo = '¿Qué materiales de plano NO meten al láser?'
  ) then
    perform foro.crear_tema(
      autor, 'corte-laser', 'pregunta',
      $tema$¿Qué materiales de plano NO meten al láser?$tema$,
      $tema$Esta la preguntamos porque nos tocó ver a alguien meter PVC al láser sin saber lo que estaba haciendo.

Más allá de la lista de internet: ¿qué les ha tocado que huela mal, suelte humo raro o les arruine la óptica?

¿Y qué extracción traen? Porque eso casi nunca lo mencionan los que venden la máquina.$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [plasma] Costo operativo que nadie documenta en español. Pregunta de taller que ya produce.
  if not exists (
    select 1 from foro.temas where titulo = '¿Cada cuánto cambian consumibles de plasma y cómo saben que ya?'
  ) then
    perform foro.crear_tema(
      autor, 'plasma', 'pregunta',
      $tema$¿Cada cuánto cambian consumibles de plasma y cómo saben que ya?$tema$,
      $tema$Los consumibles son el gasto que no se ve hasta que ya se fue el dinero del mes.

¿Llevan cuenta de cortes o de horas? ¿O los cambian cuando el corte empieza a salir feo?

¿Y los genéricos les han servido, o terminan saliendo más caros por lo rápido que se gastan?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [impresion-3d] Pregunta que cruza dos secciones y trae tráfico de ambos lados.
  if not exists (
    select 1 from foro.temas where titulo = '¿Imprimir en 3D o maquinar? Cuándo conviene cada uno'
  ) then
    perform foro.crear_tema(
      autor, 'impresion-3d', 'pregunta',
      $tema$¿Imprimir en 3D o maquinar? Cuándo conviene cada uno$tema$,
      $tema$El cliente llega pidiendo una pieza y no sabe ni le importa cómo se hace. El que decide es uno.

¿En qué momento les sale más a cuenta imprimirla que maquinarla? ¿Es por cantidad, por geometría, por material?

¿Y le han entregado al cliente una pieza impresa cuando pidió maquinada? ¿Qué tal salió?$tema$
    );
    puestos := puestos + 1;
  end if;

  -- [muestra-tu-trabajo] Hilo permanente que acumula contenido con fotos. Es el que hace que el foro se vea vivo.
  if not exists (
    select 1 from foro.temas where titulo = 'Enseña la pieza más difícil que has sacado y cómo le hiciste'
  ) then
    perform foro.crear_tema(
      autor, 'muestra-tu-trabajo', 'pregunta',
      $tema$Enseña la pieza más difícil que has sacado y cómo le hiciste$tema$,
      $tema$Hilo abierto y permanente: suban foto de la pieza que más trabajo les costó.

Digan material, máquina, herramienta y cuánto tardaron. Lo que de verdad sirve es dónde se atoraron y cómo salieron.

No tiene que ser una pieza bonita. A veces la más difícil es la más fea.$tema$
    );
    puestos := puestos + 1;
  end if;

  raise notice 'Temas sembrados en esta corrida: %', puestos;
end $siembra$;

-- ---------------------------------------------------------------
-- 5 temas que NO van aquí: son para proponerle a un taller
-- fundador, para que los publique con SU cuenta. La gracia del foro es
-- que no hable una sola voz, y eso no se finge, se consigue.
--   [precios-negocio] ¿Piden anticipo? ¿De cuánto, y qué hacen si el cliente ya no recoge?
--   [router-cnc] ¿Con qué sujetan la pieza? Tornillos, cinta de doble cara o vacío
--   [materiales-herramientas] Fresas chinas de Mercado Libre: ¿aguantan o es tirar el dinero?
--   [controladores-electronica] ¿Mach3, GRBL o controlador DSP? Para taller que ya trabaja
--   [corte-laser] Láser de diodo o de CO2 para empezar a vender, ¿cuál conviene?
