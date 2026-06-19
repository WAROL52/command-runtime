# Command Runtime

[![CI](https://github.com/WAROL52/command-runtime/actions/workflows/ci.yml/badge.svg)](https://github.com/WAROL52/command-runtime/actions/workflows/ci.yml)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178C6)](#)
[![Tests](https://img.shields.io/badge/tests-89%20passed-22c55e)](#)

**Command Runtime** est une librairie TypeScript pour construire des systèmes de commandes fortement typés, introspectables et exécutables depuis différents environnements — CLI, HTTP, AI (MCP/OpenAI), et plus.

---

## Installation

### Méthode 1 — Copie directe (recommandée, style shadcn)

Copiez les fichiers source directement dans votre projet :

```bash
cp -r src/ votre-projet/
```

Avantages : pas de dépendance npm opaque, modification facile, compréhension complète.

### Méthode 2 — shadcn registry (si le dépôt est public)

```bash
npx shadcn@latest add warol52/command-runtime/runtime-core
```

Voir le [registry.json](registry.json) pour la liste complète des items.

---

## Configuration

### TypeScript

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "strict": true,
    "experimentalDecorators": true,
    "emitDecoratorMetadata": false,
    "esModuleInterop": true
  }
}
```

### Dépendances

```bash
npm install zod   # validation (optionnel — tout validateur StandardSchemaV1 compatible)
npm install -D typescript vitest
```

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

## Projets connexes

- [.opencode/agents/command-runtime.md](.opencode/agents/command-runtime.md) — Agent spécialisé
- [.opencode/skills/command-runtime/SKILL.md](.opencode/skills/command-runtime/SKILL.md) — Skill complète
- [registry.json](registry.json) — GitHub Registry pour distribution shadcn

---

## Licence

Projet privé — usage libre selon les termes définis dans le dépôt.
