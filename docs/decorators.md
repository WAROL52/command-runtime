# Décorateurs

← [Commandes](commands.md) · [Runtime →](runtime.md)

---

Le projet utilise des **décorateurs TypeScript** (`experimentalDecorators: true`) pour la configuration déclarative des commandes.

> **Note :** Les tests appellent les décorateurs **programmatiquement** car esbuild/vitest ne supporte pas les décorateurs expérimentaux natifs.

---

## @Command

Marque une classe comme commande racine ou enfant.

```ts
interface CommandDecoratorOptions {
  name: string
  alias?: string
  description?: string
  examples?: { cmd: string; description: string }[]
  input?: StandardSchemaV1       // validation de l'input
  output?: StandardSchemaV1      // validation du résultat
  middleware?: any[]              // command-level middleware
}
```

### Usage

```ts
@Command({
  name: "user",
  alias: "u",
  description: "Manage users",
  input: z.string(),
  output: z.object({ name: z.string() }),
  examples: [{ cmd: "user create Jack", description: "Create user Jack" }],
})
class UserCommand extends CommandInterface { /* ... */ }
```

### Appel programmatique (tests)

```ts
Command({ name: "user", description: "Manage users" })(UserCommand)
```

---

## @CommandChild

Déclare un enfant pour une commande parent.

```ts
interface CommandChildDecoratorOptions {
  child: new (...args: any[]) => any   // classe de l'enfant
  Constructor: (parent: any) => any    // factory de création
}
```

### Usage

```ts
class UserCommand extends CommandInterface<undefined, unknown, unknown, MyContext> {
  @CommandChild({
    child: CreateUserCommand,
    Constructor(parent) { return new CreateUserCommand(parent) },
  })
  async create(opt: ExecSubCmdOption<CreateUserCommand, string, MyContext>) {
    return opt.child.execute({ input: opt.input, context: opt.context, nextChild: () => null })
  }
}
```

### Pourquoi `Constructor` plutôt que `new` ?

Un même enfant peut être utilisé dans différents contextes parentaux. La factory permet au parent de contrôler la construction.

### Appel programmatique

```ts
CommandChild({
  child: CreateUserCommand,
  Constructor(parent) { return new CreateUserCommand(parent) },
})(UserCommand.prototype, "create", Object.getOwnPropertyDescriptor(UserCommand.prototype, "create")!)
```

---

## @CommandOption

Déclare une option CLI sur une commande.

```ts
interface CommandOptionDecoratorOptions {
  name: string
  alias?: string
  description?: string
  input?: StandardSchemaV1       // validation
  output?: StandardSchemaV1
}
```

### Usage

```ts
class CreateUserCommand extends CommandInterface {
  @CommandOption({
    name: "age",
    alias: "a",
    description: "User age",
    input: z.coerce.number().optional(),
  })
  get age(): number {
    return this.getOption<number>("age") ?? 0
  }
}
```

### Fonctionnement

1. Le décorateur stocke la métadonnée de l'option dans `CommandClassMeta.options`
2. Il remplace le getter via `Object.defineProperty`
3. Le nouveau getter lit depuis `this._options` (Map parsée par le runtime)
4. Le corps original du getter sert de **transform** (appelé sur la valeur parsée)
5. Le runtime valide l'input via `StandardSchemaV1` avant de le stocker

### Appel programmatique

```ts
CommandOption({ name: "age", alias: "a", description: "Age", input: z.coerce.number().optional() })(
  CreateUserCommand.prototype, "age", Object.getOwnPropertyDescriptor(CreateUserCommand.prototype, "age")!
)
```

---

## Navigation

- **Précédent :** [Commandes ↑](commands.md)
- **Suivant :** [Runtime →](runtime.md)
- **Index :** [↑ Index](index.md)
