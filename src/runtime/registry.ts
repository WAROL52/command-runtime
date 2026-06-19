import type { CommandInterface } from "../core/command"
import type { CommandClassMeta } from "../core/metadata"

export type CommandClass = new (...args: any[]) => CommandInterface

export class CommandRegistry {
  private rootClasses: Set<CommandClass> = new Set()

  register(classes: CommandClass[]): void {
    for (const cls of classes) {
      this.rootClasses.add(cls)
    }
  }

  findRoot(name: string): CommandClass | undefined {
    for (const cls of this.rootClasses) {
      const meta = CommandRegistry.getMeta(cls)
      if (meta?.name === name) return cls
    }
    return undefined
  }

  findChild(parentClass: CommandClass, childName: string): CommandClass | undefined {
    const meta = CommandRegistry.getMeta(parentClass)
    if (!meta?.children) return undefined
    const childMeta = meta.children[childName]
    if (!childMeta) return undefined
    return childMeta.childClass as CommandClass
  }

  resolve(path: string[]): CommandClass | undefined {
    if (path.length === 0) return undefined
    const root = this.findRoot(path[0])
    if (!root) return undefined
    let current: CommandClass = root
    for (let i = 1; i < path.length; i++) {
      const childClass = this.resolveChildClass(current, path[i])
      if (!childClass) return undefined
      current = childClass
    }
    return current
  }

  private resolveChildClass(parentClass: CommandClass, childName: string): CommandClass | undefined {
    const meta = CommandRegistry.getMeta(parentClass)
    if (!meta?.children) return undefined
    for (const [, childMeta] of Object.entries(meta.children)) {
      if (childMeta.name === childName) {
        return childMeta.childClass as CommandClass
      }
    }
    return undefined
  }

  static getMeta(cls: CommandClass): CommandClassMeta | undefined {
    return (cls as any).__commandMeta as CommandClassMeta | undefined
  }

  static setMeta(cls: CommandClass, meta: CommandClassMeta): void {
    (cls as any).__commandMeta = meta
  }
}
