import type { StandardSchemaV1 } from "../contracts/standard-schema"

export interface CommandOptionMeta {
  name: string
  alias?: string
  description?: string
  input?: StandardSchemaV1
  output?: StandardSchemaV1
  propertyKey: string
}

export interface CommandChildMeta {
  name: string
  methodName: string
  childClass: new (...args: any[]) => any
  constructor: (parent: any) => any
}

export interface CommandClassMeta {
  name: string
  alias?: string
  description?: string
  examples?: { cmd: string; description: string }[]
  input?: StandardSchemaV1
  output?: StandardSchemaV1
  middleware?: any[]
  children?: Record<string, CommandChildMeta>
  options?: Record<string, CommandOptionMeta>
}
