import http from "node:http"
import { createRuntime } from "../../src/index"
import { handleHttp } from "../../src/adapters/http/http-adapter"
import { ListUsersCmd, CreateUserCmd, registerCommands } from "./commands"
import type { Ctx } from "./commands"

registerCommands()

const runtime = createRuntime<Ctx>({
  name: "user-api",
  commands: [ListUsersCmd, CreateUserCmd],
})

const server = http.createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : undefined

  const response = await handleHttp(
    { method: req.method ?? "GET", path: req.url ?? "/", body },
    { runtime, context: { userId: "alice" } },
  )

  res.writeHead(response.status, { "Content-Type": "application/json" })
  res.end(JSON.stringify(response.body))
})

const PORT = 3001
server.listen(PORT, () => {
  console.log(`HTTP server running on http://localhost:${PORT}`)
  console.log()
  console.log("Try:")
  console.log(`  curl http://localhost:${PORT}/commands/list-users`)
  console.log(`  curl -X POST http://localhost:${PORT}/commands/create-user \\`)
  console.log('    -H "Content-Type: application/json" \\')
  console.log('    -d \'{"name":"Bob","age":30}\'')
})
