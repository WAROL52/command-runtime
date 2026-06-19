# Adapters

← [Runtime](runtime.md) · [AI & MCP →](ai-integration.md)

---

Les adapters sont le pont entre le monde extérieur et le runtime. Chaque adapter transforme un format d'entrée spécifique en appel `runtime.execute()`.

---

## CLI Adapter

```ts
async function runCli<TContext>(opts: CliAdapterOptions<TContext>): Promise<number>

interface CliAdapterOptions<TContext> {
  runtime: Runtime<TContext>
  context: TContext | (() => TContext | Promise<TContext>)
  argv?: string[]
  version?: string
  out?: { log: (msg: string) => void; error: (msg: string) => void }
}
```

### Fonctionnalités

- Parse `process.argv` (ou `argv` personnalisé)
- `--help` / `-h` → affiche l'aide
- `--version` / `-V` → affiche la version
- Exécute la commande avec les options parsées
- Code de retour : 0 (succès), 1 (erreur commande), 2 (erreur parsing)

### Exemple

```ts
const code = await runCli({
  runtime,
  context: { user: "bob" },
  argv: ["myapp", "greet", "Jack"],
})
```

---

## HTTP Adapter

```ts
async function handleHttp<TContext>(
  request: HttpRequest,
  opts: HttpAdapterOptions<TContext>
): Promise<HttpResponse>

interface HttpRequest {
  method: string
  path: string    // ex: "/commands/user/create" ou "/commands/user/create?age=25"
  body?: unknown
  headers?: Record<string, string>
}

interface HttpAdapterOptions<TContext> {
  runtime: Runtime<TContext>
  context: TContext | (() => TContext | Promise<TContext>)
  pathPrefix?: string                    // défaut: "/commands/"
  parsePath?: (request: HttpRequest) => string[]
  parseInput?: (request: HttpRequest) => unknown
  parseOptions?: (request: HttpRequest) => { level: number; name: string; value: unknown }[]
}
```

### Fonctionnalités

- Extrait le path de commande depuis l'URL (par défaut après `/commands/`)
- Le `body` de la requête est utilisé comme input
- Les paramètres de query string sont parsés comme options
- Retourne `{ status, body, headers }`

### Exemple

```ts
const res = await handleHttp(
  { method: "POST", path: "/api/user/create", body: { name: "Jack" } },
  { runtime, context: ctx, pathPrefix: "/api/" }
)
```

---

## Adapter Interface (déprécié)

Le projet incluait initialement une interface `Adapter` dans `contracts/adapter.ts`. Elle a été retirée car aucun adapter concret ne l'implémentait. Les adapters sont désormais des fonctions autonomes.

---

## Navigation

- **Précédent :** [Runtime ↑](runtime.md)
- **Suivant :** [AI & MCP →](ai-integration.md)
- **Index :** [↑ Index](index.md)
