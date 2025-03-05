export enum ServiceStage {
  Uninitialized = 'uninitialized',
  Init = 'init',
  InitPresets = 'initPresets',
  InitPlugins = 'initPlugins',
  CollectAppData = 'collectAppData',
  OnCheck = 'onCheck',
  OnStart = 'onStart',
  RunCommand = 'runCommand',
}

export interface UserConfig {
  presets: string[]
  plugins: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [property: string]: any
}

export interface PluginConfig {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [property: string]: any
}

export interface Args {
  _: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [property: string]: any
}

export interface Paths {
  /**
   * 当前执行路径
   */
  cwd: string
  /**
   * 目标路径
   */
  target: string

  [property: string]: string
}

export interface AppData {
  /**
   * 当前执行路径
   */
  cwd: string
  /**
   * 目标执行路径
   */
  target: string
  /**
   * 命令名称
   */
  name: string
  /**
   * 命令执行参数
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [property: string]: any
}

/**
 * 预设插件提取器
 */
export interface PresetsOrPluginsExtractor {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (presetsOrPlugins: string[], cwd: string, opts: Record<string, any>): string[]
}

export interface ProxyPluginAPIPropsExtractorReturnType {
  serviceProps: string[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  staticProps: Record<string, any>
}

export enum ApplyPluginsType {
  Add = 'add',
  Modify = 'modify',
  Event = 'event',
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
