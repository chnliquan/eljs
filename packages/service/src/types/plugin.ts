export interface PluginReturnType {
  presets?: string[]
  plugins?: string[]
}

export enum PluginType {
  Preset = 'preset',
  Plugin = 'plugin',
}
