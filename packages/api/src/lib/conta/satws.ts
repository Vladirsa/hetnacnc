// Carga de @nodecfdi/sat-ws-descarga-masiva (sólo se publica como módulo ESM;
// el backend compila a CommonJS). Un import() dinámico real lo resuelve en Node 22.
// eslint-disable-next-line @typescript-eslint/no-implied-eval
const importar = new Function("m", "return import(m)") as (m: string) => Promise<any>
let cache: Promise<any> | null = null
export const satws = (): Promise<any> => (cache ||= importar("@nodecfdi/sat-ws-descarga-masiva"))
