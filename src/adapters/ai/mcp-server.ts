import type { Readable, Writable } from "node:stream"
import { AIAdapter } from "./ai-adapter"
import type { Runtime } from "../../runtime/runtime"
import { toMCPTool } from "./types"

export interface MCPServerOptions<TContext> {
  runtime: Runtime<TContext>
  context: TContext
  stdin?: Readable
  stdout?: Writable
}

export function createMCPServer<TContext>(opts: MCPServerOptions<TContext>) {
  const ai = new AIAdapter(opts.runtime, opts.context)
  const stdin = opts.stdin ?? process.stdin
  const stdout = opts.stdout ?? process.stdout

  let buffer = ""

  function sendResponse(id: number | string, result: unknown) {
    const msg = JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n"
    stdout.write(msg)
  }

  function sendError(id: number | string | null, code: number, message: string) {
    const msg = JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n"
    stdout.write(msg)
  }

  async function handleRequest(request: any) {
    const { method, id, params } = request

    switch (method) {
      case "initialize":
        sendResponse(id, {
          protocolVersion: "0.1.0",
          capabilities: { tools: {} },
          serverInfo: { name: opts.runtime.name, version: "0.1.0" },
        })
        break

      case "tools/list":
        const tools = ai.toTools().map(toMCPTool)
        sendResponse(id, { tools })
        break

      case "tools/call":
        try {
          const result = await ai.executeTool({
            name: params.name,
            arguments: params.arguments ?? {},
          })
          sendResponse(id, {
            content: [{ type: "text", text: JSON.stringify(result) }],
          })
        } catch (err: any) {
          sendError(id, -32603, err.message ?? String(err))
        }
        break

      default:
        sendError(id ?? null, -32601, `Method not found: ${method}`)
    }
  }

  function onData(chunk: string) {
    buffer += chunk
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    for (const line of lines) {
      if (!line.trim()) continue
      try {
        const request = JSON.parse(line)
        handleRequest(request)
      } catch {
        sendError(null, -32700, "Parse error")
      }
    }
  }

  stdin.on("data", onData)

  return {
    close() {
      stdin.removeListener("data", onData)
    },
  }
}
