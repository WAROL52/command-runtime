# Tests

← [Exemples](examples.md) · [Index →](index.md)

---

## Structure

10 fichiers de test, **130 tests**, 0 erreurs TypeScript.

```
tests/
├── basic-flow.test.ts        #  6 — Parsing, exécution, help, erreurs, arbre
├── cli-adapter.test.ts       # 11 — CLI: execution, erreur, help, version, context,
│                             #       console fallback, null/undefined data, multi-errors
├── http-adapter.test.ts      # 13 — HTTP: POST, GET, 400, prefix, parsePath, empty path,
│                             #       malformed query, flag-only, double slash, trailing slash,
│                             #       custom parseInput/Options, query-string input
├── ai-adapter.test.ts        # 12 — AI: toTools, OpenAI, MCP, execute, nested, error,
│                             #       no arguments field, options in schema, 3-level recursion
├── openai-adapter.test.ts    #  9 — OpenAI: empty description, options params, empty input,
│                             #       execute with params, undefined/null args, unknown tool,
│                             #       multiple tools, nested dotted tools
├── mcp-server.test.ts        # 14 — MCP: initialize, list, call, undefined/null args,
│                             #       unknown method, parse error, empty lines, partial chunks,
│                             #       multi-message, close, failure result, string/null id
├── deploy-app.test.ts        #  5 — 3-level chain, defaults, help, CLI, mid-level
├── docgen.test.ts            #  3 — Markdown, options/args, per-command files
├── completion.test.ts        #  3 — Bash, Zsh, runtime method
└── e2e.test.ts               # 54 — Middleware, MCP, validation, erreurs, CLI/HTTP/AI e2e
```

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
```

- Node 18, 20, 22 en matrix
- `npm ci` → `npm run typecheck` → `npm test`

## Exécution en local

```bash
npm test                # vitest run (tous les tests)
npm run test:watch      # mode watch
npm run typecheck       # tsc --noEmit
npx vitest run tests/e2e.test.ts   # e2e uniquement
```

## Couverture des tests

| Module | Tests | Couverture |
|--------|-------|------------|
| Execution Pipeline | 5 | flat, 3-level, defaults, argv, parse |
| Validation | 2 | input schema rejection |
| CLI Adapter | 6 | deep `--help`, `-h`, `-V`, exit code, context factory, console fallback, null/undefined data, multi-errors |
| HTTP Adapter | 6 | context factory, query string, custom parseInput/Options, malformed query, flag-only option, double/trailing slash |
| AI Adapter | 4 | toTools, OpenAI/MCP formats, execute by dotted name, error |
| OpenAI Adapter | 9 | empty description, options → parameters, empty input, execute with params, undefined/null args, unknown tool, multiple tools, nested dotted |
| MCP Server | 7 | initialize, tools/list, tools/call, errors, close, partial chunks, multi-message, empty lines, string/null id |
| Middleware | 3 | global, command-level, global+command chain |
| Introspection | 7 | findCommand, help root/deep/unknown, tree, docs, completion |
| Registry & Resolver | 4 | deep resolve, aliases, boolean/short flags |
| Error Paths | 4 | empty path, unknown root/child, missing hook |
| Multi-root | 1 | two independent root commands |

## Conventions

### Appel programmatique des décorateurs

Les décorateurs sont appelés manuellement car esbuild/vitest ne supporte pas les décorateurs expérimentaux :

```ts
Command({ name: "user" })(UserCommand)
CommandChild({ child: CreateUserCommand, Constructor(p) { return new CreateUserCommand(p) } })(
  UserCommand.prototype, "create", Object.getOwnPropertyDescriptor(UserCommand.prototype, "create")!
)
CommandOption({ name: "age", alias: "a", input: z.coerce.number().optional() })(
  CreateUserCommand.prototype, "age", Object.getOwnPropertyDescriptor(CreateUserCommand.prototype, "age")!
)
```

### Structure de test

```ts
import { describe, it, expect } from "vitest"
import { CommandInterface, createRuntime } from "../src/index"
import { Command } from "../src/decorators/command.decorator"
import type { ExecCmdOption } from "../src/index"

// 1. Définir le contexte
interface MyContext { user: string }

// 2. Définir les commandes (classes sans décorateurs)
class HelloCmd extends CommandInterface<undefined, string, any, MyContext> {
  async execute(opt: ExecCmdOption<string, MyContext>) {
    return { success: true, data: `Hello ${opt.input}` }
  }
}

// 3. Appliquer les décorateurs programmatiquement
Command({ name: "hello", input: z.string() })(HelloCmd)

// 4. Créer le runtime
const runtime = createRuntime<MyContext>({
  name: "myapp",
  commands: [HelloCmd],
})

// 5. Tester
describe("Hello", () => {
  it("should greet", async () => {
    const result = await runtime.execute(["hello"], "World", [], { user: "test" })
    expect(result.success).toBe(true)
  })
})
```

### Pièges courants

- `z.coerce.number()` nécessaire pour les options CLI (argv → string → number)
- Toujours passer `Object.getOwnPropertyDescriptor()` à `@CommandChild` / `@CommandOption`
- Le type `CommandClass` évite les erreurs d'instanciation de classe abstraite
- `nextChild` utilise `startIndex = 2` (skip le direct child)

---

## Navigation

- **Précédent :** [Exemples ↑](examples.md)
- **Retour à l'accueil :** [↑ Index](index.md)
