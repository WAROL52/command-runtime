import type { CommandClass, CommandRegistry } from "./registry"

export interface CommandOptionMeta {
  name: string
  alias?: string
  description?: string
  input?: { description?: string }
  output?: { description?: string }
}

export interface CommandChildMeta {
  name: string
  description?: string
}

export interface CommandMeta {
  name: string
  alias?: string
  description?: string
  examples?: { cmd: string; description: string }[]
  input?: boolean
  output?: boolean
  options?: CommandOptionMeta[]
  children?: CommandChildMeta[]
}

export class Introspector {
  constructor(private registry: CommandRegistry) {}

  getTree(): CommandMeta[] {
    const roots = (this.registry as any).rootClasses as Set<CommandClass>
    const result: CommandMeta[] = []
    for (const cls of roots) {
      const meta = this.buildMeta(cls)
      if (meta) result.push(meta)
    }
    return result
  }

  find(path: string[]): CommandMeta | null {
    const cls = this.registry.resolve(path)
    if (!cls) return null
    return this.buildMeta(cls)
  }

  generateHelp(programName: string, path?: string[]): string {
    const meta = path ? this.find(path) : null
    if (!meta && path) {
      return `Command '${path.join(" ")}' not found.\n`
    }

    const m = meta ?? {
      name: programName,
      description: `${programName} command runtime`,
      children: this.getTree(),
    }

    const fullName = path ? path.join(" ") : m.name

    const lines: string[] = []
    lines.push(`${programName} ${fullName}${m.description ? ` — ${m.description}` : ""}`)
    lines.push("")

    lines.push("USAGE")
    const parts: string[] = [programName, fullName]
    if (m.children && m.children.length > 0) {
      parts.push("<command>")
    }
    if (meta?.input) {
      parts.push("<input>")
    }
    if (m.options && m.options.length > 0) {
      parts.push("[options]")
    }
    lines.push(`  ${parts.join(" ")}`)
    lines.push("")

    if (meta?.input) {
      lines.push("ARGUMENTS")
      lines.push("  input    required")
      lines.push("")
    }

    if (m.options && m.options.length > 0) {
      lines.push("OPTIONS")
      for (const opt of m.options) {
        const aliasPart = opt.alias ? `, -${opt.alias}` : ""
        lines.push(`  --${opt.name}${aliasPart}    ${opt.description ?? ""}`)
      }
      lines.push("")
    }

    if (m.children && m.children.length > 0) {
      lines.push("COMMANDS")
      for (const child of m.children) {
        const desc = child.description ? `    ${child.description}` : ""
        lines.push(`  ${child.name}${desc}`)
      }
      lines.push("")
    }

    if (m.examples && m.examples.length > 0) {
      lines.push("EXAMPLES")
      for (const ex of m.examples) {
        lines.push(`  ${ex.cmd}    ${ex.description}`)
      }
      lines.push("")
    }

    return lines.join("\n")
  }

  private buildMeta(cls: CommandClass): CommandMeta | null {
    const rawMeta = (cls as any).__commandMeta
    if (!rawMeta) return null

    const options: CommandOptionMeta[] = []
    if (rawMeta.options) {
      for (const [, opt] of Object.entries<any>(rawMeta.options)) {
        options.push({
          name: opt.name,
          alias: opt.alias,
          description: opt.description,
        })
      }
    }

    const children: CommandChildMeta[] = []
    if (rawMeta.children) {
      for (const [, child] of Object.entries<any>(rawMeta.children)) {
        const childClass = child.childClass as CommandClass
        const childMeta = (childClass as any).__commandMeta
        children.push({
          name: child.name,
          description: childMeta?.description,
        })
      }
    }

    return {
      name: rawMeta.name,
      alias: rawMeta.alias,
      description: rawMeta.description,
      examples: rawMeta.examples,
      input: !!rawMeta.input,
      output: !!rawMeta.output,
      options,
      children,
    }
  }
}
