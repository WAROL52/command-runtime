# Runtime

← [Décorateurs](decorators.md) · [Adapters →](adapters.md)

---

Le runtime est le cœur du système. Il orchestre l'enregistrement, la résolution, le parsing, l'exécution et l'introspection des commandes.

---

## createRuntime()

Point d'entrée principal :

```ts
function createRuntime<TContext>(config: RuntimeConfig<TContext>): Runtime<TContext>

interface RuntimeConfig<TContext> {
  name: string
  commands: CommandClass[]
  middlewares?: Middleware<any, any, TContext>[]
}
```

### Usage

```ts
const runtime = createRuntime<MyContext>({
  name: "mycli",
  commands: [UserCommand, AppCommand],
  middlewares: [new LoggerMiddleware()],
})
```

---

## Registry (`src/runtime/registry.ts`)

Enregistre et résout les classes de commandes.

```ts
class CommandRegistry {
  register(classes: CommandClass[]): void
  findRoot(name: string): CommandClass | undefined
  resolve(path: string[]): CommandClass | undefined
}
```

- Les commandes racines sont stockées dans un `Set<CommandClass>`
- `resolve(["user", "create"])` traverse l'arbre : root → child → ...
- Les métadonnées sont stockées sur `cls.__commandMeta` (static)

---

## Resolver (`src/runtime/resolver.ts`)

Transforme les arguments bruts (argv) en chemin structuré.

```ts
class CommandResolver {
  parse(argv: string[], programNameIndex?: number): ParseResult
}

interface ParseResult {
  path: string[]          // ex: ["user", "create"]
  input: unknown          // ex: "Jack"
  optionEntries: OptionEntry[]  // ex: [{ level: 1, name: "age", value: "25" }]
}

interface OptionEntry {
  level: number     // index de la commande dans le path (0 = root, 1 = child, ...)
  name: string      // nom ou alias court
  value: unknown
}
```

### Règles de parsing

1. Mots sans `--` → commandes ou input
2. Mots avec `--` → options longues (`--age 25`)
3. Mots avec `-x` → options courtes (`-a 25`)
4. Après avoir trouvé l'input (quand `meta.input` existe), les tokens restants sont des options du terminal
5. `level` est déterminé par la position dans le path

---

## Executor (`src/runtime/executor.ts`)

Construit la chaîne d'instances, valide, applique les middlewares, et exécute.

```ts
class CommandExecutor {
  async execute(
    path: string[],
    input: unknown,
    optionEntries: OptionEntry[],
    context: any
  ): Promise<CommandResult<any>>
}
```

### Étapes

1. **Résolution** des classes via Registry
2. **Construction** de la chaîne d'instances (`buildInstanceChain`)
   - Root : `new RootClass()`
   - Enfants : `childMeta.constructor(parentInstance)`
3. **Validation des options** — chaque option est validée via son `StandardSchemaV1`
4. **Validation de l'input** — l'input terminal est validé via son `StandardSchemaV1`
5. **Middleware** — les middlewares globaux + command-level enveloppent l'exécution
6. **Exécution** — appel du hook parent avec `{ child, input, context, nextChild }`
   - Si `path.length === 1` : appel direct de `execute()`
   - Si `path.length > 1` : appel du hook method

---

## Runtime (`src/runtime/runtime.ts`)

Classe publique unifiée :

```ts
class Runtime<TContext> {
  parse(argv: string[]): ParseResult
  executeFromArgv(argv: string[], context: TContext): Promise<CommandResult<any>>
  execute(path: string[], input: unknown, optionEntries: OptionEntry[], context: TContext): Promise<CommandResult<any>>
  getCommandTree(): CommandMeta[]
  findCommand(path: string[]): CommandMeta | null
  generateHelp(path?: string[]): string
  generateDocs(opts?: { title?: string; perCommand?: boolean }): Record<string, string>
  generateCompletion(type: "bash" | "zsh"): string
}
```

---

## Navigation

- **Précédent :** [Décorateurs ↑](decorators.md)
- **Suivant :** [Adapters →](adapters.md)
- **Index :** [↑ Index](index.md)
