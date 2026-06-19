# Commandes

← [Architecture](architecture.md) · [Décorateurs →](decorators.md)

---

## CommandInterface

Toute commande étend `CommandInterface<TParent, TInput, TOutput, TContext>` :

```ts
abstract class CommandInterface<TParent, TInput, TOutput, TContext> {
  constructor(public readonly parent?: TParent) {}

  abstract execute(opt: ExecCmdOption<TInput, TContext>): Promise<CommandResult<TOutput>>

  // Accès aux options parsées
  protected getOption<T>(key: string): T | undefined

  // Métadonnées
  get commandMeta(): CommandClassMeta | undefined
  get commandName(): string
  getOptionMeta(key: string): CommandOptionMeta | undefined
  getChildMeta(name: string): CommandChildMeta | undefined

  // Help
  printHelp(): void     // console.log
  renderHelp(): string  // retourne le texte
}
```

## Paramètres génériques

| Paramètre | Description | Exemple |
|-----------|-------------|---------|
| `TParent` | Type du parent (ou `undefined` pour root) | `UserCommand` |
| `TInput` | Type de l'input parsé | `string` |
| `TOutput` | Type du résultat (`data` dans `CommandResult`) | `User` |
| `TContext` | Type du contexte global | `{ logger: Logger }` |

## Cycle de vie

1. **Enregistrement** — `createRuntime()` enregistre les commandes racines
2. **Parsing** — `Resolver.parse(argv)` → `{ path, input, options }`
3. **Résolution** — `Registry.resolve(path)` → classes de commandes
4. **Construction** — `Executor.buildInstanceChain()` → instances liées
5. **Validation** — options et input validés via StandardSchemaV1
6. **Middleware** — middlewares globaux + command-level enveloppent
7. **Exécution** — hook parent appelé avec `{ child, input, context, nextChild }`

## Parent / Child

Un parent déclare ses enfants via `@CommandChild` et définit une méthode hook :

```ts
class UserCommand extends CommandInterface<undefined, unknown, unknown, MyContext> {
  async execute(opt) { /* ... */ }

  async create(opt: ExecSubCmdOption<CreateUserCommand, string, MyContext>) {
    const { child, input, context, nextChild } = opt
    // Le parent peut :
    // - enrichir le contexte
    // - court-circuiter
    // - appeler le child
    return child.execute({ input, context, nextChild })
  }
}
```

### nextChild()

Pour les chaînes de 3+ niveaux, `nextChild()` retourne le maillon suivant (en skippant le direct child) :

```ts
const link = nextChild()    // saute instances[1], retourne instances[2]
if (!link) {
  return child.execute(...) // pas de next → exécution terminale
}
return child.deploy({       // next existe → appel hook du child
  child: link.child,
  input, context,
  nextChild: link.nextChild,
})
```

### Contrat d'exécution

```ts
interface ExecCmdOption<TInput, TContext> {
  input: TInput
  context: TContext
  nextChild: () => NextChildNode | null
}

interface ExecSubCmdOption<TChild, TInput, TContext> {
  child: TChild
  input: TInput
  context: TContext
  nextChild: () => NextChildNode | null
}
```

## CommandResult

```ts
type CommandResult<T> =
  | { success: true; data: T }
  | { success: false; errors: CommandError[] }

interface CommandError {
  message: string
  path?: (string | number)[]
  code?: string
}
```

## Navigation

- **Précédent :** [Architecture ↑](architecture.md)
- **Suivant :** [Décorateurs →](decorators.md)
- **Index :** [↑ Index](index.md)
