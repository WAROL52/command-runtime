# Documentation — Command Runtime

Bienvenue dans la documentation de **Command Runtime**, une librairie TypeScript pour construire des systèmes de commandes fortement typés, introspectables et multi-environnements.

---

## Navigation

| Section | Description |
|---------|-------------|
| [📖 Architecture](architecture.md) | Vision, philosophie, structure du projet |
| [⚙️ Commandes](commands.md) | `CommandInterface`, cycle de vie, contrat |
| [🏷️ Décorateurs](decorators.md) | `@Command`, `@CommandChild`, `@CommandOption` |
| [🧠 Runtime](runtime.md) | Registry, Resolver, Executor |
| [🔌 Adapters](adapters.md) | CLI, HTTP, AI, MCP, OpenAI |
| [🤖 AI & MCP](ai-integration.md) | Outils AI, MCP Server, OpenAI format |
| [🔀 Middleware](middleware.md) | Global et command-level |
| [🔍 Introspection](introspection.md) | Help, tree, docgen, autocomplétion |
| [📦 Exemples](examples.md) | Projet complet 3 niveaux (deploy-app) |
| [🧪 Tests](testing.md) | Structure et approche de test |

---

## Quick Start

```ts
import { CommandInterface, Command, createRuntime } from "../src"
import type { ExecCmdOption } from "../src"
import { z } from "zod"

@Command({ name: "hello", description: "Say hello", input: z.string() })
class HelloCommand extends CommandInterface<undefined, string, string, { user: string }> {
  async execute(opt: ExecCmdOption<string, { user: string }>) {
    return { success: true, data: `Hello ${opt.input} (user: ${opt.context.user})` }
  }
}

const runtime = createRuntime({ name: "mycli", commands: [HelloCommand] })

const result = await runtime.execute(["hello"], "World", [], { user: "alice" })
// → { success: true, data: "Hello World (user: alice)" }
```

---

## Projets connexes

- [README principal](../README.md)
- [Agent spécialisé](../.opencode/agents/command-runtime.md)
- [Skill complète](../.opencode/skills/command-runtime/SKILL.md)
