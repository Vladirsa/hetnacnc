# Dónde está el hueco: el foro CNC mexicano no existe

Estudio hecho el 27 de octubre de 2026 para decidir con qué temas se siembra
el Foro CNC de hetnacnc.com. El objetivo no es "tener contenido": es que un
tornero de León que teclea una duda en Google caiga aquí y no en un foro
español.

## Qué se encontró

**1. No hay foro CNC de México.** Buscando problemas de router CNC en español,
lo que sale son foros de España ([Foromadera](https://www.foromadera.com/t/problema-con-tallado-en-cnc-router/13675),
[MetalAficion](https://foro.metalaficion.com/index.php?topic=33678.0)), de
Estados Unidos ([Machsupport](https://www.machsupport.com/forum/index.php?topic=34348.0))
o blogs de fabricantes chinos traducidos ([Elephant CNC](https://www.elephant-cnc.com/blog/cnc-router-troubleshooting/)).
El mexicano que pregunta hoy lo hace en un sitio donde el vocabulario, los
proveedores y los precios son de otro país.

**2. Nadie publica tarifas de maquinado en México.** Es el hallazgo con más
valor comercial. Buscando cuánto cobrar por hora de CNC sólo aparecen cifras
internacionales en dólares ([bquq](https://es.bquq.com/technical-article/how-much-does-cnc-machining-cost-per-hour-in-2026-pricing-breakdown-for-custom-p.html),
[dgcncmachining](https://www.dgcncmachining.com/news/how-to-calculate-cnc-machining-cost-per-hour-65826968.html)),
listados viejos de [QuimiNet](https://www.quiminet.com/productos/torno-cnc-fresadora-convencional-y-torno-convencional-181287622122/precios.htm)
y talleres que no publican tarifa ([EDRA](https://www.edramexico.mx/maquinados-cnc)).
Los precios de máquina sí se encuentran ([Tecnomaquinaria](https://www.tecnomaquinaria.com/cuanto-cuesta-un-torno-cnc/):
un torno CNC básico entre 200 y 500 mil pesos), pero eso sirve para calcular
depreciación, no para saber qué cobrar.

Esta es la pregunta que todo taller chico se hace y nadie contesta en pesos.
Y es la que empata con el Cotizador, que ya vendemos.

**3. La competencia es una página de Facebook.** Lo más parecido a una
comunidad es [Comunidad CNC](https://www.facebook.com/comunidadcncmx/), con
877 me gusta. Hay páginas de fabricantes y de talleres ([Gear CNC México](https://www.facebook.com/GearCNC/),
3,688 me gusta), pero son comerciales. Nada de eso lo indexa Google como
pregunta y respuesta, que es justo donde se puede ganar.

## Qué pregunta la gente de verdad

Sacado de los hilos reales de esos foros, no inventado:

| Problema | Dónde aparece |
|---|---|
| El diseño sale desplazado al retomar un trabajo al día siguiente | Foromadera |
| Pasos por milímetro mal calibrados: la máquina no se mueve lo que dice | Machsupport |
| El eje Z se hunde poco a poco en trabajos 3D largos | MetalAficion |
| Vibración al cortar círculos, y dar más rigidez lo empeoró | MetalAficion |
| Husillo que se calienta de más | Elephant CNC |
| Comprar máquina usada que parece nueva por fuera | Elephant CNC |

## Lo que no se pudo medir

**Semrush quedó fuera.** La cuenta tiene suscripción activa pero se acabaron
las unidades de API, así que no hay volúmenes de búsqueda reales. Los temas de
abajo están ordenados por el criterio de este estudio, no por demanda medida.
Cuando haya unidades, conviene revalidar el orden en
https://www.semrush.com/mcp-access

## Cómo se siembra

`temas-semilla.json` trae el banco. Cada tema lleva un `origen` que decide
quién lo publica:

- `cliente`: dudas que ya llegan por WhatsApp, el cotizador o las solicitudes.
  Se publican sin el nombre de quien preguntó. Es contenido auténtico y variado
  desde el primer día.
- `fundador`: se le propone a un taller fundador para que lo publique con su
  propia cuenta. Nombres reales distintos, y a él le sirve por la visibilidad.
- `oficial`: lo pregunta la cuenta de HETNA. Son preguntas abiertas, no
  artículos: la gracia es que alguien del gremio tenga algo que contestar.

Ningún tema se publica con un perfil inventado. Un foro donde se descubre un
nombre falso pierde al gremio de golpe, y en CNC mexicano todos se conocen.
