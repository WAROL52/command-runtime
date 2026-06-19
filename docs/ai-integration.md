# AI & MCP Integration

← [Adapters](adapters.md) · [Middleware →](middleware.md)

---

Le projet transforme automatiquement l'arbre de commandes en outils pour agents IA, compatibles MCP (Model Context Protocol) et OpenAI Function Calling.

---

## AIAdapter

```ts
class AIAdapter<TContext> {
  constructor(runtime: Runtime<TContext>, context: TContext)

  toTools(): AITool[]
  executeTool(call: AIToolCall): Promise<AIToolResult>
}
```

### Format AITool

```ts
interface AITool {
  name: string           // "user.create" (dots comme séparateurs)
  description: string
  inputSchema: Record<string, unknown>
}

interface AIToolCall {
  name: string
  arguments: Record<string, unknown>  // { input: "Jack", age: 25 }
}

interface AIToolResult {
  success: boolean
  data?: unknown
  error?: string
}
```

### Arbre → Tools

Chaque commande dans l'arbre devient un `AITool`. Le nom utilise le chemin complet avec des points :

```
app
├── project
│   └── deploy    →  "app.project.deploy"
└── user
    └── create    →  "app.user.create"
```

### Exécution

`executeTool` convertit le nom pointé en path, extrait `input` des arguments, et appelle `runtime.execute()`.

---

## MCP Server

```ts
function createMCPServer<TContext>(opts: MCPServerOptions<TContext>)

interface MCPServerOptions<TContext> {
  runtime: Runtime<TContext>
  context: TContext
  stdin?: Readable    // défaut : process.stdin
  stdout?: Writable   // défaut : process.stdout
}
```

### Protocole

Serveur JSON-RPC 2.0 sur stdio, supportant :

| Méthode | Description |
|---------|-------------|
| `initialize` | Handshake, retourne version et capacités |
| `tools/list` | Liste tous les outils (commandes) |
| `tools/call` | Exécute un outil par son nom |

### Exemple

```ts
import { createMCPServer } from "./src/adapters/ai/mcp-server"

createMCPServer({ runtime, context })

// Communication via stdin/stdout JSON-RPC:
// → {"jsonrpc":"2.0","id":1,"method":"tools/list"}
// ← {"jsonrpc":"2.0","id":1,"result":{"tools":[...]}}
```

---

## OpenAI Adapter

```ts
function createOpenAIAdapter<TContext>(
  runtime: Runtime<TContext>,
  context: TContext
): OpenAIAdapter<TContext>

// Usage :
const adapter = createOpenAIAdapter(runtime, context)
const tools = adapter.tools    // format OpenAI Function Calling
const result = await adapter.executeTool("user.create", { input: "Jack", age: 25 })
```

### Format de sortie

```json
{
  "type": "function",
  "function": {
    "name": "user.create",
    "description": "Create a user",
    "parameters": {
      "type": "object",
      "properties": {
        "input": { "type": "string", "description": "Command input" },
        "age": { "type": "string", "description": "User age" }
      }
    }
  }
}
```

---

## Navigation

- **Précédent :** [Adapters ↑](adapters.md)
- **Suivant :** [Middleware →](middleware.md)
- **Index :** [↑ Index](index.md)
