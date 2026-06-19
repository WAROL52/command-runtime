import type { CommandInterface } from "../core/command"
import type { CommandResult } from "../contracts/command-result"
import type { NextChildNode } from "../contracts/context"
import type { CommandClass, CommandRegistry } from "./registry"
import type { CommandResolver, OptionEntry } from "./resolver"
import { CommandResolver as CR } from "./resolver"
import type { Middleware } from "../contracts/middleware"

export class CommandExecutor {
  constructor(
    private registry: CommandRegistry,
    private resolver: CommandResolver,
    private globalMiddlewares: Middleware[] = []
  ) {}

  async execute(
    path: string[],
    input: unknown,
    optionEntries: OptionEntry[],
    context: any
  ): Promise<CommandResult<any>> {
    if (path.length === 0) {
      return { success: false, errors: [{ message: "No command specified" }] }
    }

    const rootName = path[0]!
    const rootClass = this.registry.findRoot(rootName)
    if (!rootClass) {
      return { success: false, errors: [{ message: `Command '${rootName}' not found` }] }
    }

    const instances = this.buildInstanceChain(path, rootClass)
    if (!instances) {
      return { success: false, errors: [{ message: "Failed to build command chain" }] }
    }

    for (let i = 0; i < instances.length; i++) {
      const cmd = instances[i]!
      const cmdClass = cmd.constructor as unknown as CommandClass
      const options = this.resolver.resolveOptionAliases(cmdClass, optionEntries, i)
      const meta = CR.getMeta(cmdClass)

      for (const [optName, optValue] of Object.entries(options)) {
        const optMeta = meta?.options?.[optName]
        if (optMeta?.input) {
          const schema = optMeta.input
          const result = await schema["~standard"].validate(optValue)
          if (result.issues) {
            return {
              success: false,
              errors: result.issues.map((iss) => ({
                message: iss.message,
                path: iss.path ? [...iss.path].map(String) : [],
              })),
            }
          }
          cmd._options.set(optName, result.value)
        } else {
          cmd._options.set(optName, optValue)
        }
      }
    }

    const rootInstance = instances[0]!
    const lastCmd = instances[instances.length - 1]!
    const terminalClass = lastCmd.constructor as unknown as CommandClass
    const terminalMeta = CR.getMeta(terminalClass)

    if (terminalMeta?.input && input !== undefined) {
      const result = await terminalMeta.input["~standard"].validate(input)
      if (result.issues) {
        return {
          success: false,
          errors: result.issues.map((iss) => ({
            message: iss.message,
            path: iss.path ? [...iss.path].map(String) : [],
          })),
        }
      }
      input = result.value
    }

    if (path.length === 1) {
      return this.applyMiddlewares(
        rootInstance,
        { input, context, nextChild: () => null },
        undefined
      )
    }

    const childInstance = instances[1]
    const rootMeta = CR.getMeta(rootInstance.constructor as unknown as CommandClass)
    const childRouteName = path[1]!

    if (!rootMeta?.children?.[childRouteName]) {
      return {
        success: false,
        errors: [{ message: `Command '${childRouteName}' not found under '${rootName}'` }],
      }
    }

    const childMeta = rootMeta.children[childRouteName]!
    const hookMethod = (rootInstance as any)[childMeta.methodName]
    if (typeof hookMethod !== "function") {
      return {
        success: false,
        errors: [{
          message: `Hook method '${childMeta.methodName}' not implemented on '${rootName}'`,
        }],
      }
    }

    const terminalIndex = instances.length - 1
    const nextChildFn = this.createNextChild(instances, 2, terminalIndex)

    const opt = {
      child: childInstance,
      input,
      context,
      nextChild: nextChildFn,
    }

    return this.applyMiddlewares(rootInstance, opt, async () => {
      return hookMethod.call(rootInstance, opt)
    })
  }

  private createNextChild(
    instances: CommandInterface[],
    startIndex: number,
    terminalIndex: number
  ): () => NextChildNode | null {
    return () => {
      if (startIndex > terminalIndex) return null
      const child = instances[startIndex]!
      return {
        child,
        nextChild: this.createNextChild(instances, startIndex + 1, terminalIndex),
      }
    }
  }

  private buildInstanceChain(
    path: string[],
    rootClass: CommandClass
  ): CommandInterface[] | null {
    const instances: CommandInterface[] = []
    let currentClass: CommandClass = rootClass

    for (let i = 0; i < path.length; i++) {
      let instance: CommandInterface
      if (i === 0) {
        instance = new currentClass()
      } else {
        const parentInstance = instances[i - 1]!
        const parentMeta = CR.getMeta(parentInstance.constructor as unknown as CommandClass)
        const childRouteName = path[i]!
        const childMeta = parentMeta?.children?.[childRouteName]
        if (!childMeta) return null
        instance = childMeta.constructor(parentInstance) as CommandInterface
      }
      instances.push(instance)

      if (i < path.length - 1) {
        const nextPath = path[i + 1]!
        const currentMeta = CR.getMeta(currentClass)
        const nextChildMeta = currentMeta?.children?.[nextPath]
        if (!nextChildMeta) return null
        currentClass = nextChildMeta.childClass as CommandClass
      }
    }

    return instances
  }

  private async applyMiddlewares(
    cmd: CommandInterface,
    opt: any,
    handler?: () => Promise<CommandResult<any>>
  ): Promise<CommandResult<any>> {
    let chain: () => Promise<CommandResult<any>> = handler ?? (async () => {
      if (typeof cmd.execute === "function") {
        return cmd.execute(opt)
      }
      return { success: true, data: undefined }
    })

    const cmdMeta = CR.getMeta(cmd.constructor as unknown as CommandClass)
    const cmdMiddlewares: Middleware[] = cmdMeta?.middleware ?? []

    const allMiddlewares = [...this.globalMiddlewares, ...cmdMiddlewares]
    for (const mw of [...allMiddlewares].reverse()) {
      const next: () => Promise<CommandResult<any>> = chain
      chain = async () => mw.handle(opt.input, opt.context, async (_input: any, _context: any) => {
        return next()
      })
    }

    return chain()
  }
}
