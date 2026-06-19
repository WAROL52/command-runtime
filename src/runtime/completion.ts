import type { Runtime } from "./runtime"
import type { CommandMeta } from "./introspection"

export type ShellType = "bash" | "zsh"

export class CompletionGenerator<TContext = any> {
  constructor(private runtime: Runtime<TContext>) {}

  generate(type: ShellType): string {
    switch (type) {
      case "bash":
        return this.generateBash()
      case "zsh":
        return this.generateZsh()
    }
  }

  private generateBash(): string {
    const prog = this.runtime.name
    const tree = this.runtime.getCommandTree()
    const cmdNames = this.collectNames(tree)
    const optNames = this.collectOptionNames(tree)

    return `
_${prog}_completion() {
  local cur=\${COMP_WORDS[COMP_CWORD]}
  local prev=\${COMP_WORDS[COMP_CWORD-1]}
  local words=\${COMP_WORDS[@]:1}
  local cword=$((COMP_CWORD - 1))

  local commands="${cmdNames.join(" ")}"
  local options="${optNames.join(" ")}"

  COMPREPLY=()

  if [[ $cur == --* ]] || [[ $cur == -* ]]; then
    COMPREPLY=($(compgen -W "$options" -- "$cur"))
    return 0
  fi

  COMPREPLY=($(compgen -W "$commands" -- "$cur"))
  return 0
}

complete -F _${prog}_completion ${prog}
`.trimStart()
  }

  private generateZsh(): string {
    const prog = this.runtime.name
    const tree = this.runtime.getCommandTree()
    const entries = this.buildZshEntries(tree, [])

    return `
#compdef ${prog}

_${prog}() {
  local -a commands
${entries.map((e) => `  commands+=("${e}")`).join("\n")}

  _describe "${prog} commands" commands
}

_${prog}
`.trimStart()
  }

  private buildZshEntries(metas: CommandMeta[], parents: string[]): string[] {
    const entries: string[] = []
    for (const meta of metas) {
      const fullName = [...parents, meta.name].join(" ")
      const desc = meta.description ?? ""
      entries.push(`${fullName}:${desc}`)
      if (meta.children) {
        for (const child of meta.children) {
          const childMeta = this.runtime.findCommand([...parents, meta.name, child.name])
          if (childMeta) {
            entries.push(...this.buildZshEntries([childMeta], [...parents, meta.name]))
          }
        }
      }
    }
    return entries
  }

  private collectNames(tree: CommandMeta[]): string[] {
    const names: string[] = []
    for (const cmd of tree) {
      names.push(cmd.name)
      if (cmd.children) {
        names.push(...cmd.children.map((c) => c.name))
      }
    }
    return names
  }

  private collectOptionNames(tree: CommandMeta[]): string[] {
    const names: string[] = []
    for (const cmd of tree) {
      if (cmd.options) {
        for (const opt of cmd.options) {
          names.push(`--${opt.name}`)
          if (opt.alias) names.push(`-${opt.alias}`)
        }
      }
      if (cmd.children) {
        for (const child of cmd.children) {
          const childMeta = this.runtime.findCommand([cmd.name, child.name])
          if (childMeta?.options) {
            for (const opt of childMeta.options) {
              names.push(`--${opt.name}`)
              if (opt.alias) names.push(`-${opt.alias}`)
            }
          }
        }
      }
    }
    return [...new Set(names)]
  }
}
