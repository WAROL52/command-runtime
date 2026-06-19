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

## Navigation

- **Précédent :** [Introspection ↑](introspection.md)
- **Suivant :** [Tests →](testing.md)
- **Index :** [↑ Index](index.md)
