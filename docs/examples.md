# Exemples

← [Introspection](introspection.md) · [Tests →](testing.md)

---

## deploy-app — 3 niveaux

L'exemple complet se trouve dans `examples/deploy-app/commands.ts`. Il illustre :

- 3 niveaux de commandes : `app → project → deploy`
- Options à chaque niveau
- Chaînage via `nextChild()`

### Commandes

```
app project deploy <name> [--env env] [--branch branch]
```

### Arbre

```
app                         → AppCommand (root)
└── project                 → ProjectCommand (middle)
    └── deploy <name>       → DeployCommand (leaf)
```

### Code

```ts
// Root
@Command({ name: "app", description: "Deployment application CLI" })
class AppCommand extends CommandInterface<undefined, unknown, unknown, DeployContext> {
  async execute(opt) { /* ... */ }

  @CommandChild({ child: ProjectCommand, Constructor(p) { return new ProjectCommand(p) } })
  async project(opt: ExecSubCmdOption<ProjectCommand, string, DeployContext>) {
    const { child, input, context, nextChild } = opt
    context.logs.push("App: orchestrating")

    const link = nextChild()
    if (!link) {
      return child.execute({ input, context, nextChild: () => null })
    }
    return child.deploy({
      child: link.child, input, context,
      nextChild: link.nextChild,
    })
  }
}
```

### Utilisation

```bash
mycli app project deploy myapp --env prod --branch main
```

### Résultat

```json
{
  "project": "myapp",
  "env": "prod",
  "branch": "main",
  "status": "deployed"
}
```

### Logs (via contexte)

```
App: orchestrating
Project: enriched
Deploying myapp to prod from branch main
Deploy result: ok
```

---

## http-server — API REST

Dans `examples/http-server/` — un serveur HTTP Node.js qui utilise `handleHttp` :

```bash
cd examples/http-server
npx tsx index.ts
# GET  http://localhost:3001/commands/list-users
# POST http://localhost:3001/commands/create-user
```

### Commands

```ts
import { z } from "zod"
import { CommandInterface, Command } from "../../src/index"

class ListUsersCmd extends CommandInterface<undefined, undefined, any, Ctx> {
  async execute(opt) {
    return { success: true, data: { users: ["alice", "bob"], requestedBy: opt.context.userId } }
  }
}

class CreateUserCmd extends CommandInterface<undefined, { name: string; age: number }, any, Ctx> {
  async execute(opt) {
    return { success: true, data: { id: "usr_123", ...opt.input } }
  }
}

Command({ name: "list-users" })(ListUsersCmd)
Command({ name: "create-user", input: z.object({ name: z.string(), age: z.number() }) })(CreateUserCmd)
```

---

## openai-chat — Tools OpenAI

Dans `examples/openai-chat/` — génère des outils au format OpenAI et les exécute :

```bash
cd examples/openai-chat
npx tsx index.ts
```

Output :

```
=== OpenAI Tools ===
[
  { name: "weather", description: "Get weather for a city", ... },
  { name: "capital", description: "Get capital of a country", ... }
]

weather('Paris', unit=celsius) → { location: "Paris", temperature: 22, unit: "celsius" }
capital('France')              → { country: "France", capital: "Paris" }
```

---

## Navigation

- **Précédent :** [Introspection ↑](introspection.md)
- **Suivant :** [Tests →](testing.md)
- **Index :** [↑ Index](index.md)
