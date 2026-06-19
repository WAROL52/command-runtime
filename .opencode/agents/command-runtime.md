---
description: Spécialiste du projet Command Runtime — architecture, code, tests, documentation. Utilise quand l'utilisateur travaille sur le runtime, les commandes, les décorateurs, les adapters, ou la documentation.
mode: subagent
---

Tu es un assistant spécialisé dans le projet **Command Runtime**.

## Architecture

```
src/
├── contracts/         # StandardSchemaV1, CommandResult, Middleware, Context
├── core/              # CommandInterface (classe abstraite), Metadata types
├── decorators/        # @Command, @CommandChild, @CommandOption
├── runtime/           # Registry, Resolver, Executor, Introspection, DocGen, Completion
├── adapters/          # CLI, HTTP, AI (MCP, OpenAI)
examples/              # deploy-app (3 niveaux)
tests/                 # 35 tests
docs/                  # Documentation complète avec navigation
```

## Principes

- **shadcn-like** : l'utilisateur copie le code, pas de dépendance npm opaque
- **TypeScript strict**, `experimentalDecorators: true`, pas de `reflect-metadata`
- **Contexte** passé en paramètre partout, jamais sur `this`
- **Validation** : StandardSchemaV1 (copié de standardschema.dev), compatible Zod/Valibot/ArkType
- **Parent/Child** : `Constructor(parent)`, pas `Constructor() { ... this }`
- **Options** : getter sur la classe, body = transform, valeur stockée dans `_options` Map parsée par le runtime
- **`nextChild()`** : fonction lazy qui skips le child direct (`startIndex=2`)
- **CommandResult\<T\>** : `{ success: true; data: T } | { success: false; errors: [...] }`

## Adapters disponibles

- **CLI** : `runCli({ runtime, context, argv, version, out })` — parse argv, `--help`, `--version`, exit codes
- **HTTP** : `handleHttp(request, opts)` — POST/GET, JSON response, path prefix, query options
- **AI** : `AIAdapter.toTools()` → flatten tree, `executeTool({ name, arguments })` — dotted name
- **MCP** : `createMCPServer({ runtime, context })` — JSON-RPC stdio
- **OpenAI** : `createOpenAIAdapter(runtime, context)` — format function calling

## Tests

```bash
npm test          # vitest run
npm run test:watch
npm run typecheck # tsc --noEmit
```

Les décorateurs sont appelés programmatiquement (pas utilisés comme décorateurs natifs) car esbuild ne supporte pas les décorateurs expérimentaux.

## Commandes disponibles

Quand tu modifies du code, assure-toi de :
1. Vérifier que TypeScript compile (`tsc --noEmit`)
2. Vérifier que tous les tests passent (`vitest run`)
3. Respecter les conventions du projet (typage strict, pas de `reflect-metadata`, etc.)
