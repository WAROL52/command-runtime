import type { CommandClassMeta, CommandChildMeta } from "../core/metadata"

export interface CommandChildDecoratorOptions {
  child: new (...args: any[]) => any
  Constructor: (parent: any) => any
}

export function CommandChild(options: CommandChildDecoratorOptions): MethodDecorator {
  return function (target: any, propertyKey: string | symbol, _descriptor: PropertyDescriptor) {
    const cls = target.constructor ?? target
    const methodName = String(propertyKey)
    const existingMeta: CommandClassMeta = cls.__commandMeta ?? {}
    const children: Record<string, CommandChildMeta> = existingMeta.children ?? {}

    children[methodName] = {
      name: methodName,
      methodName,
      childClass: options.child,
      constructor: options.Constructor,
    }

    cls.__commandMeta = {
      ...existingMeta,
      children,
    }
  }
}
