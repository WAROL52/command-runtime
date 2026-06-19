import type { CommandClass, CommandRegistry } from "./registry"
import type { CommandClassMeta } from "../core/metadata"

export interface OptionEntry {
  level: number
  name: string
  value: unknown
}

export interface ParseResult {
  path: string[]
  input: unknown
  optionEntries: OptionEntry[]
}

export class CommandResolver {
  constructor(private registry: CommandRegistry) {}

  parse(argv: string[], programNameIndex: number = 0): ParseResult {
    const tokens = argv.slice(programNameIndex + 1)
    const path: string[] = []
    let inputValue: unknown = undefined
    const allOptions: OptionEntry[] = []
    let i = 0

    while (i < tokens.length) {
      const token = tokens[i]!

      if (token.startsWith("--")) {
        const optName = token.slice(2)
        const level = Math.max(0, path.length - 1)
        if (i + 1 < tokens.length && !tokens[i + 1]!.startsWith("--")) {
          allOptions.push({ level, name: optName, value: tokens[i + 1] })
          i += 2
        } else {
          allOptions.push({ level, name: optName, value: true })
          i += 1
        }
        continue
      }

      if (token.startsWith("-") && token.length === 2) {
        const level = Math.max(0, path.length - 1)
        if (i + 1 < tokens.length && !tokens[i + 1]!.startsWith("-")) {
          allOptions.push({ level, name: token.slice(1), value: tokens[i + 1] })
          i += 2
        } else {
          allOptions.push({ level, name: token.slice(1), value: true })
          i += 1
        }
        continue
      }

      if (path.length === 0) {
        path.push(token)
        i += 1
        continue
      }

      const currentCmdClass = this.registry.resolve(path)
      if (currentCmdClass) {
        const meta = CommandResolver.getMeta(currentCmdClass)
        if (meta?.input) {
          inputValue = token
          i += 1
          break
        }
      }

      path.push(token)
      i += 1
    }

    const terminalLevel = Math.max(0, path.length - 1)
    while (i < tokens.length) {
      const token = tokens[i]!
      if (token.startsWith("--")) {
        const optName = token.slice(2)
        if (i + 1 < tokens.length && !tokens[i + 1]!.startsWith("--")) {
          allOptions.push({ level: terminalLevel, name: optName, value: tokens[i + 1] })
          i += 2
        } else {
          allOptions.push({ level: terminalLevel, name: optName, value: true })
          i += 1
        }
      } else if (token.startsWith("-") && token.length === 2) {
        if (i + 1 < tokens.length && !tokens[i + 1]!.startsWith("-")) {
          allOptions.push({ level: terminalLevel, name: token.slice(1), value: tokens[i + 1] })
          i += 2
        } else {
          allOptions.push({ level: terminalLevel, name: token.slice(1), value: true })
          i += 1
        }
      } else {
        i += 1
      }
    }

    return { path, input: inputValue, optionEntries: allOptions }
  }

  resolveOptionAliases(
    cmdClass: CommandClass,
    entries: OptionEntry[],
    level: number
  ): Record<string, unknown> {
    const meta = CommandResolver.getMeta(cmdClass)
    const options = meta?.options ?? {}
    const aliasToName: Record<string, string> = {}
    for (const [, optMeta] of Object.entries(options)) {
      if (optMeta.alias) {
        aliasToName[optMeta.alias] = optMeta.name
      }
    }

    const result: Record<string, unknown> = {}
    for (const entry of entries) {
      if (entry.level !== level) continue
      const resolvedName = aliasToName[entry.name] ?? entry.name
      result[resolvedName] = entry.value
    }
    return result
  }

  static getMeta(cls: CommandClass): CommandClassMeta | undefined {
    return (cls as any).__commandMeta as CommandClassMeta | undefined
  }
}
