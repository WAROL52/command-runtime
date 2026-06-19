import type { CommandResult } from "../contracts/command-result"
import type { CommandMeta } from "./introspection"
import type { Middleware } from "../contracts/middleware"
import type { CommandClass } from "./registry"
import { CommandRegistry } from "./registry"
import { DocGenerator } from "./docgen"
import { CompletionGenerator } from "./completion"
import { CommandResolver } from "./resolver"
import { CommandExecutor } from "./executor"
import { Introspector } from "./introspection"

export interface RuntimeConfig<TContext = any> {
  name: string
  commands: CommandClass[]
  middlewares?: Middleware<any, any, TContext>[]
}

export class Runtime<TContext = any> {
  readonly name: string
  private registry: CommandRegistry
  private resolver: CommandResolver
  private executor: CommandExecutor
  private introspector: Introspector

  constructor(config: RuntimeConfig<TContext>) {
    this.name = config.name
    this.registry = new CommandRegistry()
    this.resolver = new CommandResolver(this.registry)
    this.executor = new CommandExecutor(this.registry, this.resolver, config.middlewares ?? [])
    this.introspector = new Introspector(this.registry)

    this.registry.register(config.commands)
  }

  parse(argv: string[]): ReturnType<CommandResolver["parse"]> {
    return this.resolver.parse(argv)
  }

  async executeFromArgv(
    argv: string[],
    context: TContext
  ): Promise<CommandResult<any>> {
    const parsed = this.resolver.parse(argv)
    return this.executor.execute(parsed.path, parsed.input, parsed.optionEntries, context)
  }

  async execute(
    path: string[],
    input: unknown,
    optionEntries: { level: number; name: string; value: unknown }[],
    context: TContext
  ): Promise<CommandResult<any>> {
    return this.executor.execute(path, input, optionEntries, context)
  }

  getCommandTree(): CommandMeta[] {
    return this.introspector.getTree()
  }

  findCommand(path: string[]): CommandMeta | null {
    return this.introspector.find(path)
  }

  generateHelp(path?: string[]): string {
    return this.introspector.generateHelp(this.name, path)
  }

  generateDocs(opts?: { title?: string; perCommand?: boolean }): Record<string, string> {
    const gen = new DocGenerator(this)
    return gen.generate(opts)
  }

  generateCompletion(type: "bash" | "zsh"): string {
    const gen = new CompletionGenerator(this)
    return gen.generate(type)
  }
}

export function createRuntime<TContext = any>(config: RuntimeConfig<TContext>): Runtime<TContext> {
  return new Runtime(config)
}
