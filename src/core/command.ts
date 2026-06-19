import type { CommandResult } from "../contracts/command-result"
import type { ExecCmdOption } from "../contracts/context"
import type { CommandClassMeta, CommandChildMeta, CommandOptionMeta } from "./metadata"
import type { StandardSchemaV1 } from "../contracts/standard-schema"

export abstract class CommandInterface<
  TParent = undefined,
  TInput = unknown,
  TOutput = unknown,
  TContext = any
> {
  static __commandMeta?: CommandClassMeta

  public readonly _options: Map<string, unknown> = new Map()
  public readonly _validatedOptions: Map<string, { value: unknown; validated: boolean }> = new Map()

  constructor(public readonly parent?: TParent) {}

  abstract execute(opt: ExecCmdOption<TInput, TContext>): Promise<CommandResult<TOutput>>

  static getCommandMeta(): CommandClassMeta | undefined {
    return this.__commandMeta
  }

  static setCommandMeta(meta: CommandClassMeta): void {
    this.__commandMeta = meta
  }

  get commandMeta(): CommandClassMeta | undefined {
    return (this.constructor as typeof CommandInterface).__commandMeta
  }

  get commandName(): string {
    return this.commandMeta?.name ?? "unknown"
  }

  printHelp(): void {
    const meta = this.commandMeta
    if (!meta) {
      console.log(`No metadata for command`)
      return
    }
    const lines: string[] = []
    lines.push(`${meta.name}${meta.description ? ` — ${meta.description}` : ""}`)
    lines.push("")
    lines.push("USAGE")

    const usageParts: string[] = [meta.name]
    if (meta.children) {
      const childNames = Object.keys(meta.children).join("|")
      usageParts.push(`<${childNames}>`)
    }
    if (meta.input) {
      usageParts.push("<input>")
    }
    if (meta.options && Object.keys(meta.options).length > 0) {
      usageParts.push("[options]")
    }
    lines.push(`  ${usageParts.join(" ")}`)
    lines.push("")

    if (meta.input) {
      lines.push("ARGUMENTS")
      lines.push(`  input    ${"required"}`)
      lines.push("")
    }

    if (meta.options && Object.keys(meta.options).length > 0) {
      lines.push("OPTIONS")
      for (const [key, opt] of Object.entries(meta.options)) {
        const aliasPart = opt.alias ? `, -${opt.alias}` : ""
        lines.push(`  --${key}${aliasPart}    ${opt.description ?? ""}`)
      }
      lines.push("")
    }

    if (meta.children) {
      lines.push("COMMANDS")
      for (const [, child] of Object.entries(meta.children)) {
        lines.push(`  ${child.name}`)
      }
      lines.push("")
    }

    if (meta.examples && meta.examples.length > 0) {
      lines.push("EXAMPLES")
      for (const ex of meta.examples) {
        lines.push(`  ${ex.cmd}    ${ex.description}`)
      }
      lines.push("")
    }

    console.log(lines.join("\n"))
  }

  protected getOption<T = unknown>(key: string): T | undefined {
    return this._options.get(key) as T | undefined
  }

  public getOptionMeta(key: string): CommandOptionMeta | undefined {
    const meta = this.commandMeta
    if (!meta?.options) return undefined
    return meta.options[key]
  }

  public getChildMeta(name: string): CommandChildMeta | undefined {
    const meta = this.commandMeta
    if (!meta?.children) return undefined
    return meta.children[name]
  }
}
