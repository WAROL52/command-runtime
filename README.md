# Command Runtime

[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178C6)](#)
[![Tests](https://img.shields.io/badge/tests-35%20passed-22c55e)](#)

**Command Runtime** est une librairie TypeScript pour construire des systèmes de commandes fortement typés, introspectables et exécutables depuis différents environnements — CLI, HTTP, AI (MCP/OpenAI), et plus.

---

## Quick Start

```ts
import { CommandInterface, Command, createRuntime } from "./command-runtime/src"
import type { ExecCmdOption } from "./command-runtime/src"
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

## Documentation

| Section | Description |
|---------|-------------|
| [📖 Architecture](docs/architecture.md) | Vision, philosophie, structure du projet |
| [⚙️ Commandes](docs/commands.md) | `CommandInterface`, cycle de vie, contrat |
| [🏷️ Décorateurs](docs/decorators.md) | `@Command`, `@CommandChild`, `@CommandOption` |
| [🧠 Runtime](docs/runtime.md) | Registry, Resolver, Executor |
| [🔌 Adapters](docs/adapters.md) | CLI, HTTP, AI, MCP, OpenAI |
| [🤖 AI & MCP](docs/ai-integration.md) | Outils AI, MCP Server, OpenAI format |
| [🔀 Middleware](docs/middleware.md) | Global et command-level |
| [🔍 Introspection](docs/introspection.md) | Help, tree, docgen, autocomplétion |
| [📦 Exemples](docs/examples.md) | Projet complet 3 niveaux (deploy-app) |
| [🧪 Tests](docs/testing.md) | Structure et approche de test |

---

## Projets

- [.opencode/agents/command-runtime.md](.opencode/agents/command-runtime.md) — Agent spécialisé pour ce projet
- [.opencode/skills/command-runtime/SKILL.md](.opencode/skills/command-runtime/SKILL.md) — Skill complète

---

## Licence

Projet privé — usage libre selon les termes définis dans le dépôt.
