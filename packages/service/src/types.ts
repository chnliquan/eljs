export interface PluginReturnType {
  presets?: string[]
  plugins?: string[]
}

export enum PluginType {
  preset = 'preset',
  plugin = 'plugin',
}

export enum ApplyPluginsType {
  add = 'add',
  modify = 'modify',
  event = 'event',
}

export enum EnableBy {
  register = 'register',
  prompts = 'prompts',
}

export interface ApplyEvent<T> {
  (fn: { (args: T): void }): void
  (args: {
    fn: { (args: T): void }
    name?: string
    before?: string
    stage?: number
  }): void
}

export interface ApplyModify<T, U> {
  (fn: { (initialValue: T, args: U): T }): void
  (fn: { (initialValue: T, args: U): Promise<T> }): void
  (args: {
    fn: { (initialValue: T, args: U): T }
    name?: string
    before?: string
    stage?: number
  }): void
  (args: {
    fn: { (initialValue: T, args: U): Promise<T> }
    name?: string
    before?: string
    stage?: number
  }): void
}

export interface ApplyAdd<T, U> {
  (fn: { (args: T): U | U[] }): void
  (fn: { (args: T): Promise<U | U[]> }): void
  (args: {
    fn: { (args: T): U | U[] }
    name?: string
    before?: string
    stage?: number
  }): void
  (args: {
    fn: {
      (args: T): Promise<U | U[]>
      name?: string
      before?: string
      stage?: number
    }
  }): void
}
