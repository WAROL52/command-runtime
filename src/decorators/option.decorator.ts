import type { StandardSchemaV1 } from "../contracts/standard-schema"
import type { CommandClassMeta, CommandOptionMeta } from "../core/metadata"

export interface CommandOptionDecoratorOptions {
  name: string
  alias?: string
  description?: string
  input?: StandardSchemaV1
  output?: StandardSchemaV1
}

export function CommandOption(options: CommandOptionDecoratorOptions): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, descriptor: PropertyDescriptor) {
    const cls = target.constructor ?? target
    const methodName = String(propertyKey)
    const transformFn = (descriptor.value ?? descriptor.get) as (...args: any[]) => any
    const existingMeta: CommandClassMeta = cls.__commandMeta ?? {}
    const opts: Record<string, CommandOptionMeta> = existingMeta.options ?? {}

    opts[options.name] = {
      name: options.name,
      alias: options.alias,
      description: options.description,
      input: options.input,
      output: options.output,
      propertyKey: methodName,
    }

    cls.__commandMeta = {
      ...existingMeta,
      options: opts,
    }

    Object.defineProperty(target, methodName, {
      get(this: any) {
        const raw = this._options?.get(options.name)
        return transformFn.call(this, raw)
      },
      enumerable: true,
      configurable: true,
    })
  }
}
