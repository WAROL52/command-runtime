# Middleware

← [AI & MCP](ai-integration.md) · [Introspection →](introspection.md)

---

Le middleware permet d'intercepter et de transformer l'exécution des commandes.

---

## Interface

```ts
interface Middleware<TInput, TOutput, TContext> {
  name: string
  handle(
    input: TInput,
    context: TContext,
    next: (input: TInput, context: TContext) => Promise<CommandResult<TOutput>>
  ): Promise<CommandResult<TOutput>>
}
```

---

## Niveaux

### 1. Global Middleware

Appliqué à toutes les commandes. Défini dans `RuntimeConfig.middlewares` :

```ts
const runtime = createRuntime({
  name: "myapp",
  commands: [UserCommand],
  middlewares: [new LoggerMiddleware(), new AuthMiddleware()],
})
```

### 2. Command-Level Middleware

Attaché à une commande spécifique via `@Command({ middleware: [...] })` :

```ts
@Command({
  name: "user",
  middleware: [new PermissionMiddleware("user:manage")],
})
class UserCommand extends CommandInterface { /* ... */ }
```

### Pipeline

```
Global Middleware (dans l'ordre)
         |
Command-Level Middleware (dans l'ordre)
         |
    [exécution de la commande]
```

Les middlewares sont chaînés en ordre inverse : le premier middleware de la liste est le plus externe.

---

## Exemple

```ts
class LoggerMiddleware implements Middleware<any, any, MyContext> {
  name = "logger"

  async handle(input, context, next) {
    console.log(`[${this.name}] before:`, input)
    const result = await next(input, context)
    console.log(`[${this.name}] after:`, result)
    return result
  }
}
```

---

## Navigation

- **Précédent :** [AI & MCP ↑](ai-integration.md)
- **Suivant :** [Introspection →](introspection.md)
- **Index :** [↑ Index](index.md)
