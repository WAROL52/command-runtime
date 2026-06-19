import type { StandardSchemaV1 } from "../contracts/standard-schema"
import type { CommandClassMeta } from "../core/metadata"
import type { CommandInterface } from "../core/command"

export interface CommandDecoratorOptions {
  name: string
  alias?: string
  description?: string
  examples?: { cmd: string; description: string }[]
  input?: StandardSchemaV1
  output?: StandardSchemaV1
  middleware?: any[]
}

export function Command(options: CommandDecoratorOptions): ClassDecorator {
  return function (target: any) {
    const existingMeta: CommandClassMeta = target.__commandMeta ?? {}

    target.__commandMeta = {
      ...existingMeta,
      name: options.name,
      alias: options.alias,
      description: options.description,
      examples: options.examples,
      input: options.input,
      output: options.output,
      middleware: options.middleware,
    }
  }
}
