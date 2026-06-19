import type { Runtime } from "./runtime"
import type { CommandMeta } from "./introspection"

export interface DocGenOptions {
  title?: string
  perCommand?: boolean
}

export class DocGenerator<TContext = any> {
  constructor(private runtime: Runtime<TContext>) {}

  generate(opts?: DocGenOptions): Record<string, string> {
    const tree = this.runtime.getCommandTree()
    const files: Record<string, string> = {}

    if (opts?.perCommand) {
      for (const cmd of tree) {
        this.flattenDocs(cmd, [], files)
      }
    }

    const allDocs: string[] = []
    for (const cmd of tree) {
      this.collectAllDocs(cmd, [], allDocs)
    }
    files["README.md"] = this.renderIndex(tree, opts?.title ?? this.runtime.name) + "\n\n" + allDocs.join("\n\n---\n\n")

    return files
  }

  private collectAllDocs(meta: CommandMeta, parents: string[], acc: string[]): void {
    acc.push(this.renderCommand(meta, parents, this.runtime.name))
    if (meta.children) {
      for (const child of meta.children) {
        const childMeta = this.runtime.findCommand([...parents, meta.name, child.name])
        if (childMeta) {
          this.collectAllDocs(childMeta, [...parents, meta.name], acc)
        }
      }
    }
  }

  private flattenDocs(meta: CommandMeta, parents: string[], acc: Record<string, string>): void {
    const fullName = [...parents, meta.name].join("-")
    acc[`${fullName}.md`] = this.renderCommand(meta, parents, this.runtime.name)
    if (meta.children) {
      for (const child of meta.children) {
        const childMeta = this.runtime.findCommand([...parents, meta.name, child.name])
        if (childMeta) {
          this.flattenDocs(childMeta, [...parents, meta.name], acc)
        }
      }
    }
  }

  private renderIndex(tree: CommandMeta[], title: string): string {
    const lines: string[] = []
    lines.push(`# ${title}`)
    lines.push("")
    lines.push("## Commandes")
    lines.push("")
    for (const cmd of tree) {
      this.renderIndexEntry(cmd, [], lines)
    }
    return lines.join("\n")
  }

  private renderIndexEntry(meta: CommandMeta, parents: string[], lines: string[]): void {
    const fullName = [...parents, meta.name].join(" ")
    const desc = meta.description ? ` — ${meta.description}` : ""
    lines.push(`- \`${fullName}\`${desc}`)
    if (meta.children) {
      for (const child of meta.children) {
        this.renderIndexEntry(child, [...parents, meta.name], lines)
      }
    }
  }

  private renderCommand(meta: CommandMeta, parents: string[], programName: string): string {
    const fullName = [...parents, meta.name].join(" ")
    const lines: string[] = []

    lines.push(`# \`${programName} ${fullName}\``)
    if (meta.description) {
      lines.push("")
      lines.push(meta.description)
    }
    lines.push("")

    lines.push("## Utilisation")
    const parts: string[] = [programName, fullName]
    if (meta.children && meta.children.length > 0) {
      parts.push("<commande>")
    }
    if (meta.input) {
      parts.push("<input>")
    }
    if (meta.options && meta.options.length > 0) {
      parts.push("[options]")
    }
    lines.push("```")
    lines.push(parts.join(" "))
    lines.push("```")
    lines.push("")

    if (meta.input) {
      lines.push("## Arguments")
      lines.push("")
      lines.push("| Nom | Type | Requis |")
      lines.push("|-----|------|--------|")
      lines.push("| input | string | oui |")
      lines.push("")
    }

    if (meta.options && meta.options.length > 0) {
      lines.push("## Options")
      lines.push("")
      lines.push("| Nom | Alias | Description |")
      lines.push("|-----|-------|-------------|")
      for (const opt of meta.options) {
        const alias = opt.alias ? `-${opt.alias}` : ""
        lines.push(`| \`--${opt.name}\` | ${alias} | ${opt.description ?? ""} |`)
      }
      lines.push("")
    }

    if (meta.children && meta.children.length > 0) {
      lines.push("## Sous-commandes")
      lines.push("")
      for (const child of meta.children) {
        const desc = child.description ? ` — ${child.description}` : ""
        lines.push(`- \`${child.name}\`${desc}`)
      }
      lines.push("")
    }

    if (meta.examples && meta.examples.length > 0) {
      lines.push("## Exemples")
      lines.push("")
      for (const ex of meta.examples) {
        lines.push("```")
        lines.push(ex.cmd)
        lines.push("```")
        if (ex.description) {
          lines.push(`  ${ex.description}`)
        }
        lines.push("")
      }
    }

    return lines.join("\n")
  }
}
