# Architecture

← [Index](index.md) · [Commandes →](commands.md)

---

## Vision

**Command Runtime** est un runtime universel de commandes. Une commande est une unité d'exécution indépendante pouvant être exposée via différents adapters sans modifier son implémentation.

```
              Command Runtime
                     |
         +-----------+------------+
         |           |            |
        CLI        HTTP         RPC/AI
         |
        GUI
```

## Philosophie

- **shadcn-like** : l'utilisateur copie le dossier et l'adapte
- **Pas de dépendance opaque npm** : le code source est possédé
- **TypeScript strict** : typage fort partout
- **Contexte en paramètre** : jamais sur `this`, facilement testable

## Structure du projet

```
src/
├── contracts/          # Types fondamentaux
│   ├── command-result.ts    # CommandResult<T>
│   ├── context.ts           # ExecCmdOption, ExecSubCmdOption, NextChildNode
│   ├── middleware.ts        # Middleware interface
│   └── standard-schema.ts   # StandardSchemaV1 (compatible Zod/Valibot/ArkType)
│
├── core/               # Classes de base
│   ├── command.ts           # CommandInterface abstraite
│   └── metadata.ts          # CommandClassMeta, CommandChildMeta, CommandOptionMeta
│
├── decorators/         # Décorateurs TypeScript
│   ├── command.decorator.ts # @Command
│   ├── child.decorator.ts   # @CommandChild
│   └── option.decorator.ts  # @CommandOption
│
├── runtime/            # Moteur
│   ├── registry.ts          # Enregistrement et résolution de classes
│   ├── resolver.ts          # Parsing argv → path + input + options
│   ├── executor.ts          # Construction de chaîne, validation, middleware, exécution
│   ├── introspection.ts     # Arbre de commandes, help text
│   ├── docgen.ts            # Générateur de documentation Markdown
│   ├── completion.ts        # Générateur d'autocomplétion bash/zsh
│   └── runtime.ts           # Classe Runtime publique + createRuntime()
│
├── adapters/           # Adapters d'entrée/sortie
│   ├── cli/cli-adapter.ts   # runCli() — terminal
│   ├── http/http-adapter.ts # handleHttp() — HTTP
│   └── ai/                  # AIAdapter, MCP Server, OpenAI format
│       ├── ai-adapter.ts
│       ├── mcp-server.ts
│       ├── openai.ts
│       └── types.ts
│
├── examples/deploy-app/ # Exemple complet 3 niveaux
└── tests/               # 35 tests — 7 fichiers
```

## Flux d'exécution

```
Input (argv / HTTP / AI call)
         |
    [Resolver] → parse argv → { path, input, options }
         |
    [Registry] → resolve path → [CommandClass, CommandClass, ...]
         |
    [Executor]
         ├── buildInstanceChain() → instances avec parents
         ├── validate options (StandardSchemaV1)
         ├── validate input (StandardSchemaV1)
         ├── wrap middlewares (global + command-level)
         └── execute hook chain
         |
    CommandResult
```

## Navigation

- **Suivant :** [Commandes →](commands.md) — comprendre le cycle de vie d'une commande
- **Index :** [↑ Index](index.md)
