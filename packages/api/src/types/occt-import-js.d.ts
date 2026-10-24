declare module "occt-import-js" {
  type OcctMesh = {
    name?: string
    attributes: {
      position: { array: number[] }
      normal?: { array: number[] }
    }
    index: { array: number[] }
  }
  type OcctResult = { success: boolean; meshes: OcctMesh[] }
  type Occt = {
    ReadStepFile: (content: Uint8Array, params: unknown) => OcctResult
    ReadIgesFile: (content: Uint8Array, params: unknown) => OcctResult
    ReadBrepFile: (content: Uint8Array, params: unknown) => OcctResult
  }
  const occtimportjs: (options?: Record<string, unknown>) => Promise<Occt>
  export default occtimportjs
}
