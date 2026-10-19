import { model } from "@medusajs/framework/utils"

// Un escaneo 3D pedido por un taller. El trabajo pesado corre fuera (RunPod,
// ver infra/scan3d), así que esta tabla es sobre todo el expediente: qué pidió,
// qué se le cobró, en qué va y dónde quedaron los archivos.
//
// Vive en la plataforma a propósito. El resultado NO se entrega por un link
// que caduca en un correo: queda en el perfil del taller, que es desde donde
// lo vuelve a bajar las veces que quiera.
//
// customer_id es columna plana, igual que en CreditBalance y en el perfil del
// cotizador: el taller es una cuenta de cliente de hetnacnc.com, sin relación
// de base de datos entre módulos.
const Escaneo = model
  .define("escaneo_3d", {
    id: model.id({ prefix: "esc3d" }).primaryKey(),
    customer_id: model.text(),

    // preview = una foto, TripoSR, gratis y aproximado.
    // scan = muchas fotos, Meshroom, se cobra y mide geometría real.
    modo: model.enum(["preview", "scan"]),
    titulo: model.text().nullable(),

    // pendiente: creado, todavía no se manda a la GPU.
    // procesando: el trabajo ya está en RunPod.
    // listo / fallido: terminó. No hay vuelta atrás desde ninguno de los dos.
    estatus: model.enum(["pendiente", "procesando", "listo", "fallido"]).default("pendiente"),

    // Las llaves de las fotos en el bucket privado, en el orden en que se
    // subieron. Se guardan las llaves, no URLs: una URL firmada caduca y esto
    // tiene que seguir sirviendo dentro de un año.
    fotos: model.json(),
    n_fotos: model.number().default(0),

    // El id que devuelve RunPod, para poder rastrear un trabajo en su panel
    // cuando algo sale raro.
    job_externo: model.text().nullable(),

    obj_storage_key: model.text().nullable(),
    stl_storage_key: model.text().nullable(),

    // Lo que reporta trimesh al convertir. watertight false significa que la
    // malla no cierra: se puede ver, pero necesita reparación antes de
    // maquinarse, y al taller hay que decírselo.
    vertices: model.number().nullable(),
    caras: model.number().nullable(),
    watertight: model.boolean().nullable(),
    // Las dimensiones que reporta la malla. Ojo: TripoSR entrega coordenadas
    // normalizadas, no milímetros -- por eso el campo no dice la unidad.
    bounding_box: model.json().nullable(),

    creditos_cobrados: model.number().default(0),
    error: model.text().nullable(),

    iniciado_en: model.dateTime().nullable(),
    terminado_en: model.dateTime().nullable(),
  })
  .indexes([
    // El listado del perfil siempre filtra por taller.
    { on: ["customer_id"], where: "deleted_at IS NULL" },
  ])

export default Escaneo
