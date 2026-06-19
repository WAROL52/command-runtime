---
name: command-runtime
description: |
  Utilise quand l'utilisateur travaille sur le projet Command Runtime TypeScript.
  Couvre l'architecture, les décorateurs (@Command, @CommandChild, @CommandOption),
  le runtime (Registry, Resolver, Executor), les adapters (CLI, HTTP, AI, MCP, OpenAI),
  la documentation, les tests, et les exemples.
---

# Command Runtime Skill

Ce skill fournit les connaissances nécessaires pour travailler sur le projet **Command Runtime**, une librairie TypeScript de commandes fortement typées.

## Structure du projet

```
command-runtime/
├── src/
│   ├── contracts/          # StandardSchemaV1, CommandResult, Middleware, Context
│   ├── core/               # CommandInterface, metadata types
│   ├── decorators/         # @Command, @CommandChild, @CommandOption
│   ├── runtime/            # Registry, Resolver, Executor, Introspection, DocGen, Completion
│   └── adapters/           # CLI, HTTP, AI (MCP, OpenAI)
├── examples/deploy-app/    # Exemple 3 niveaux
├── tests/                  # 35 tests — 7 fichiers
└── docs/                   # Documentation avec navigation
```

## Concepts clés

### CommandInterface

```ts
abstract class CommandInterface<TParent, TInput, TOutput, TContext> {
  constructor(public readonly parent?: TParent) {}
  abstract execute(opt: ExecCmdOption<TInput, TContext>): Promise<CommandResult<TOutput>>
  protected getOption<T>(key: string): T | undefined
}
```

### Décorateurs

Les décorateurs sont appelés **programmatiquement** dans les tests (contournement esbuild) :

```ts
Command({ name: "user" })(UserCommand)
CommandChild({ child: CreateCmd, Constructor(p) { return new CreateCmd(p) } })(
  UserCommand.prototype, "create", Object.getOwnPropertyDescriptor(UserCommand.prototype, "create")!
)
CommandOption({ name: "age", alias: "a", input: z.number() })(
  CreateCmd.prototype, "age", Object.getOwnPropertyDescriptor(CreateCmd.prototype, "age")!
)
```

### Parent/Child Chain

1. Parent déclare un child avec `@CommandChild` et définit une méthode hook
2. La méthode hook reçoit `{ child, input, context, nextChild }`
3. `nextChild()` retourne le chainon suivant (skips le direct child, utile pour 3+ niveaux)
4. Le parent peut court-circuiter, router dynamiquement, ou appeler le child multiple fois

### Options

- Déclarées via `@CommandOption` sur un getter
- Le body du getter est stocké comme transform
- Le runtime valide et parse l'input, stocke dans `_options` Map
- Le getter est remplacé par `Object.defineProperty`

### Adapters

| Adapter | Fonction | Usage |
|---------|----------|-------|
| CLI | `runCli({ runtime, context, argv, version })` | `process.argv` |
| HTTP | `handleHttp(request, { runtime, context })` | Requêtes POST/GET |
| AI | `new AIAdapter(runtime, context).toTools()` | Objets AITool[] |
| MCP | `createMCPServer({ runtime, context, stdin, stdout })` | Serveur JSON-RPC stdio |
| OpenAI | `createOpenAIAdapter(runtime, context)` | Format function calling |

## Tests

```bash
npm test          # Exécute tous les tests
npm run test:watch
npm run typecheck # Vérification TypeScript
```

## Conventions de code

- Toujours passer le contexte en paramètre, jamais sur `this`
- `Constructor(parent)` pas `Constructor() { ... this }`
- `nextChild` skip le direct child (startIndex=2)
- Résultat via `CommandResult<T>` pas d'exceptions
- Typage strict partout

## Références

- [Architecture](../../docs/architecture.md)
- [Commandes](../../docs/commands.md)
- [Décorateurs](../../docs/decorators.md)
- [Runtime](../../docs/runtime.md)
- [Adapters](../../docs/adapters.md)
- [AI Integration](../../docs/ai-integration.md)
- [Middleware](../../docs/middleware.md)
- [Introspection](../../docs/introspection.md)
- [Exemples](../../docs/examples.md)
- [Tests](../../docs/testing.md)
