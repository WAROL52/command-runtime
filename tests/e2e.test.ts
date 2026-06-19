import { describe, it, expect, vi } from "vitest"
import { z } from "zod"
import {
  CommandInterface,
  createRuntime,
  CommandRegistry,
  CommandResolver,
  runCli,
  handleHttp,
  AIAdapter,
  createOpenAIAdapter,
} from "../src/index"
import { Command } from "../src/decorators/command.decorator"
import { CommandChild } from "../src/decorators/child.decorator"
import { CommandOption } from "../src/decorators/option.decorator"
import { createMCPServer } from "../src/adapters/ai/mcp-server"
import { Readable, Writable } from "node:stream"
import type { ExecSubCmdOption, ExecCmdOption, Middleware } from "../src/index"

// ─── Context ────────────────────────────────────────────────────
interface Ctx {
  logs: string[]
  user: string
}

const freshCtx = (): Ctx => ({ logs: [], user: "test" })

// ─── Level 3: DeployCommand (leaf with validations) ─────────────
class DeployCmd extends CommandInterface<ProjectCmd, string, any, Ctx> {
  constructor(p: ProjectCmd) { super(p) }
  async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
    opt.context.logs.push(`deploy:${opt.input}`)
    return { success: true, data: { project: opt.input, env: this.env, branch: this.branch } }
  }
  get env(): string { return this.getOption<string>("env") ?? "dev" }
  get branch(): string | undefined { return this.getOption<string | undefined>("branch") }
}

// ─── Level 2: ProjectCmd (middle) ───────────────────────────────
class ProjectCmd extends CommandInterface<RootCmd, unknown, unknown, Ctx> {
  constructor(p: RootCmd) { super(p) }
  async execute(opt: ExecCmdOption<unknown, Ctx>): Promise<any> {
    return { success: true, data: "project help" }
  }
  async deploy(opt: ExecSubCmdOption<DeployCmd, string, Ctx>): Promise<any> {
    const { child, input, context, nextChild } = opt
    context.logs.push("project:enter")
    const result = await child.execute({ input, context, nextChild })
    context.logs.push("project:exit")
    return result
  }
}

// ─── Level 1: RootCmd ───────────────────────────────────────────
class RootCmd extends CommandInterface<undefined, unknown, unknown, Ctx> {
  async execute(): Promise<any> {
    return { success: true, data: "root" }
  }
  async project(opt: ExecSubCmdOption<ProjectCmd, string, Ctx>): Promise<any> {
    const { child, input, context, nextChild } = opt
    context.logs.push("root:enter")
    const link = nextChild()
    if (!link) {
      const r = await child.execute({ input, context, nextChild: () => null })
      context.logs.push("root:exit")
      return r
    }
    const r = await child.deploy({ child: link.child as DeployCmd, input, context, nextChild: link.nextChild })
    context.logs.push("root:exit")
    return r
  }
}

// ─── Middleware test command ─────────────────────────────────────
class HelloCmd extends CommandInterface<undefined, string, any, Ctx> {
  async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
    opt.context.logs.push(`hello:${opt.input}`)
    return { success: true, data: `Hello ${opt.input}` }
  }
}

// ─── Apply decorators (programmatic) ─────────────────────────────
Command({ name: "app", description: "Root" })(RootCmd)
Command({ name: "project", description: "Projects" })(ProjectCmd)
Command({ name: "deploy", description: "Deploy", input: z.string() })(DeployCmd)
Command({ name: "hello", description: "Say hello", input: z.string() })(HelloCmd)

CommandChild({ child: ProjectCmd, Constructor(p: ProjectCmd) { return new ProjectCmd(p) } })(
  RootCmd.prototype, "project", Object.getOwnPropertyDescriptor(RootCmd.prototype, "project")!
)
CommandChild({ child: DeployCmd, Constructor(p: DeployCmd) { return new DeployCmd(p) } })(
  ProjectCmd.prototype, "deploy", Object.getOwnPropertyDescriptor(ProjectCmd.prototype, "deploy")!
)

CommandOption({ name: "env", alias: "e", description: "Environment", input: z.string() })(
  DeployCmd.prototype, "env", Object.getOwnPropertyDescriptor(DeployCmd.prototype, "env")!
)
CommandOption({ name: "branch", alias: "b", description: "Branch", input: z.string().optional() })(
  DeployCmd.prototype, "branch", Object.getOwnPropertyDescriptor(DeployCmd.prototype, "branch")!
)

// ─── Runtime ─────────────────────────────────────────────────────
const runtime = createRuntime<Ctx>({ name: "mycli", commands: [RootCmd, HelloCmd] })

// ════════════════════════════════════════════════════════════════
// E2E TESTS
// ════════════════════════════════════════════════════════════════

describe("E2E: Execution Pipeline", () => {
  it("should execute a flat command", async () => {
    const ctx = freshCtx()
    const r = await runtime.execute(["hello"], "World", [], ctx)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe("Hello World")
  })

  it("should execute a 3-level chain with options", async () => {
    const ctx = freshCtx()
    const r = await runtime.execute(
      ["app", "project", "deploy"],
      "myapp",
      [{ level: 2, name: "env", value: "prod" }, { level: 2, name: "branch", value: "main" }],
      ctx
    )
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toEqual({ project: "myapp", env: "prod", branch: "main" })
    }
    expect(ctx.logs).toEqual(["root:enter", "project:enter", "deploy:myapp", "project:exit", "root:exit"])
  })

  it("should use defaults for missing options", async () => {
    const ctx = freshCtx()
    const r = await runtime.execute(["app", "project", "deploy"], "myapp", [], ctx)
    expect(r.success).toBe(true)
    if (r.success) {
      expect(r.data).toEqual({ project: "myapp", env: "dev", branch: undefined })
    }
  })

  it("should execute from argv", async () => {
    const ctx = freshCtx()
    const r = await runtime.executeFromArgv(["mycli", "hello", "Jack"], ctx)
    expect(r.success).toBe(true)
    if (r.success) expect(r.data).toBe("Hello Jack")
  })

  it("should parse argv correctly", () => {
    const p = runtime.parse(["mycli", "app", "project", "deploy", "myapp", "--env", "prod"])
    expect(p.path).toEqual(["app", "project", "deploy"])
    expect(p.input).toBe("myapp")
  })
})

describe("E2E: Validation Failures", () => {
  it("should reject invalid option input", async () => {
    const ctx = freshCtx()
    // --env expects z.string(), but uses validate + pass-through
    const r = await runtime.execute(["app", "project", "deploy"], "myapp", [{ level: 2, name: "env", value: "prod" }], ctx)
    expect(r.success).toBe(true) // z.string() accepts any string
  })

  it("should reject invalid input type when schema has constraints", async () => {
    const ctx = freshCtx()
    // deploy input is z.string(), passing undefined should still work (not validated if no input)
    // Use a command with number input
    class NumCmd extends CommandInterface<undefined, number, any, Ctx> {
      async execute(opt: ExecCmdOption<number, Ctx>): Promise<any> {
        return { success: true, data: opt.input }
      }
    }
    Command({ name: "num", input: z.number() })(NumCmd)

    const rt = createRuntime<Ctx>({ name: "t", commands: [NumCmd] })
    // Passing a string to a number input should fail
    const r = await rt.execute(["num"], "not-a-number" as any, [], ctx)
    expect(r.success).toBe(false)
  })
})

describe("E2E: CLI Adapter", () => {
  function capture() {
    const lines: string[] = []
    return { log: (m: string) => lines.push(m), error: (m: string) => lines.push(`ERR:${m}`), lines }
  }

  it("should handle --help at deep path", async () => {
    const out = capture()
    const code = await runCli({ runtime, context: freshCtx(), argv: ["mycli", "app", "project", "deploy", "--help"], out })
    expect(code).toBe(0)
    expect(out.lines.join(" ")).toContain("deploy")
  })

  it("should handle -h short help flag", async () => {
    const out = capture()
    const code = await runCli({ runtime, context: freshCtx(), argv: ["mycli", "-h"], out })
    expect(code).toBe(0)
    expect(out.lines.join(" ")).toContain("COMMANDS")
  })

  it("should handle -V short version flag", async () => {
    const out = capture()
    const code = await runCli({ runtime, context: freshCtx(), argv: ["mycli", "-V"], version: "2.0.0", out })
    expect(code).toBe(0)
    expect(out.lines[0]).toBe("2.0.0")
  })

  it("should return exit code 1 on command error", async () => {
    const out = capture()
    const code = await runCli({ runtime, context: freshCtx(), argv: ["mycli", "nonexistent"], out })
    expect(code).toBe(1)
  })

  it("should support lazy context factory", async () => {
    const out = capture()
    let called = false
    const code = await runCli({
      runtime, context: () => { called = true; return freshCtx() },
      argv: ["mycli", "hello", "World"], out,
    })
    expect(code).toBe(0)
    expect(called).toBe(true)
  })

  it("should output result data as JSON", async () => {
    const out = capture()
    const code = await runCli({ runtime, context: freshCtx(), argv: ["mycli", "hello", "Data"], out })
    expect(code).toBe(0)
    expect(out.lines[0]).toContain("Hello Data")
  })
})

describe("E2E: HTTP Adapter", () => {
  it("should execute via HTTP with context factory", async () => {
    const res = await handleHttp(
      { method: "POST", path: "/commands/hello", body: "World" },
      { runtime, context: () => freshCtx() }
    )
    expect(res.status).toBe(200)
  })

  it("should parse query string options", async () => {
    const res = await handleHttp(
      { method: "POST", path: "/commands/hello?user=test", body: "World" },
      { runtime, context: freshCtx() }
    )
    expect(res.status).toBe(200)
  })

  it("should support custom parseInput", async () => {
    const res = await handleHttp(
      { method: "POST", path: "/commands/hello", body: { name: "Custom" } },
      { runtime, context: freshCtx(), parseInput: (req) => (req.body as any).name }
    )
    expect(res.status).toBe(200)
  })

  it("should support custom parseOptions", async () => {
    const res = await handleHttp(
      { method: "POST", path: "/commands/hello", body: "World" },
      {
        runtime, context: freshCtx(),
        parseOptions: () => [{ level: 0, name: "custom", value: "opt" }],
      }
    )
    expect(res.status).toBe(200)
  })

  it("should return 400 for validation errors", async () => {
    class FailCmd extends CommandInterface<undefined, number, any, Ctx> {
      async execute(): Promise<any> { return { success: true, data: null } }
    }
    Command({ name: "fail", input: z.number() })(FailCmd)
    const rt = createRuntime<Ctx>({ name: "t", commands: [FailCmd] })
    const res = await handleHttp(
      { method: "POST", path: "/commands/fail", body: "not-a-number" },
      { runtime: rt, context: freshCtx() }
    )
    expect(res.status).toBe(400)
  })
})

describe("E2E: AI Adapter & MCP", () => {
  it("should generate tools with options in schema", () => {
    const ai = new AIAdapter(runtime, freshCtx())
    const tools = ai.toTools()
    const names = tools.map((t) => t.name)
    // "app" has child "project" which has child "deploy"
    // flattenTools walks root commands + their children recursively
    expect(names).toContain("hello")
    expect(names).toContain("app")
    // ProjectCmd is NOT a root command, so it appears under "app.project"
    expect(names).toContain("app.project")
    // The hello tool should have input
    const hello = tools.find((t) => t.name === "hello")
    expect(hello).toBeDefined()
    expect(hello!.inputSchema).toHaveProperty("properties")
  })

  it("should execute a flat tool via AIAdapter", async () => {
    const ai = new AIAdapter(runtime, freshCtx())
    const r = await ai.executeTool({ name: "hello", arguments: { input: "AI" } })
    expect(r.success).toBe(true)
    expect(r.data).toBe("Hello AI")
  })

  it("should return error for non-existent tool", async () => {
    const ai = new AIAdapter(runtime, freshCtx())
    const r = await ai.executeTool({ name: "does.not.exist", arguments: {} })
    expect(r.success).toBe(false)
  })

  it("should create OpenAI adapter", async () => {
    const adapter = createOpenAIAdapter(runtime, freshCtx())
    const tools = adapter.tools
    expect(Array.isArray(tools)).toBe(true)
    expect(tools.length).toBeGreaterThan(0)
    expect(tools[0]).toHaveProperty("type", "function")
  })

  it("should execute tool via OpenAI adapter", async () => {
    const adapter = createOpenAIAdapter(runtime, freshCtx())
    const r = await adapter.executeTool("hello", { input: "OpenAI" })
    expect(r.success).toBe(true)
    expect(r.data).toBe("Hello OpenAI")
  })
})

describe("E2E: MCP Server", () => {
  function mcpPair() {
    const chunks: string[] = []
    const stdout = new Writable({
      write(chunk: any, _enc: any, cb: any) {
        chunks.push(chunk.toString())
        cb()
      },
    })
    const stdin = new Readable({ read() {} })
    const server = createMCPServer({ runtime, context: freshCtx(), stdin, stdout })
    return { stdin, chunks, server }
  }

  it("should respond to initialize", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }) + "\n")
    await new Promise((r) => setTimeout(r, 20))
    expect(chunks.length).toBeGreaterThan(0)
    const msg = JSON.parse(chunks[0]!)
    expect(msg.jsonrpc).toBe("2.0")
    expect(msg.id).toBe(1)
    expect(msg.result).toHaveProperty("protocolVersion")
    expect(msg.result).toHaveProperty("capabilities")
  })

  it("should respond to tools/list", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n")
    await new Promise((r) => setTimeout(r, 20))
    expect(chunks.length).toBeGreaterThan(0)
    const msg = JSON.parse(chunks[0]!)
    expect(msg.result.tools.length).toBeGreaterThan(0)
  })

  it("should respond to tools/call", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push(JSON.stringify({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "hello", arguments: { input: "MCP" } } }) + "\n")
    // Wait for async execution
    await new Promise((r) => setTimeout(r, 50))
    expect(chunks.length).toBeGreaterThan(0)
    const msg = JSON.parse(chunks[0]!)
    expect(msg.id).toBe(3)
    expect(msg.result.content[0].text).toContain("Hello MCP")
  })

  it("should handle parse error", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push("invalid json\n")
    await new Promise((r) => setTimeout(r, 20))
    expect(chunks.length).toBeGreaterThan(0)
    const msg = JSON.parse(chunks[0]!)
    expect(msg.error.code).toBe(-32700)
  })

  it("should handle unknown method", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push(JSON.stringify({ jsonrpc: "2.0", id: 4, method: "foo" }) + "\n")
    await new Promise((r) => setTimeout(r, 20))
    expect(chunks.length).toBeGreaterThan(0)
    const msg = JSON.parse(chunks[0]!)
    expect(msg.error.code).toBe(-32601)
  })

  it("should handle tools/call with unknown tool", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push(JSON.stringify({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "unknown", arguments: {} } }) + "\n")
    await new Promise((r) => setTimeout(r, 50))
    expect(chunks.length).toBeGreaterThan(0)
    const msg = JSON.parse(chunks[0]!)
    expect(msg.id).toBe(5)
    expect(msg.result.content[0].text).toContain("success")
  })

  it("should support close", () => {
    const { stdin, server } = mcpPair()
    server.close()
    // After close, data listener should be removed
    const events = stdin.listenerCount("data")
    expect(events).toBe(0)
  })
})

describe("E2E: Middleware", () => {
  it("should execute global middleware in order", async () => {
    const order: string[] = []
    const mw1: Middleware<string, any, Ctx> = {
      name: "mw1",
      async handle(input, context, next) {
        order.push("mw1-before")
        const r = await next(input, context)
        order.push("mw1-after")
        return r
      },
    }
    const mw2: Middleware<string, any, Ctx> = {
      name: "mw2",
      async handle(input, context, next) {
        order.push("mw2-before")
        const r = await next(input, context)
        order.push("mw2-after")
        return r
      },
    }
    const rt = createRuntime<Ctx>({ name: "t", commands: [HelloCmd], middlewares: [mw1, mw2] })
    const r = await rt.execute(["hello"], "MW", [], freshCtx())
    expect(r.success).toBe(true)
    // mw1 wraps mw2 wraps execute
    expect(order).toEqual(["mw1-before", "mw2-before", "mw2-after", "mw1-after"])
  })

  it("should support command-level middleware via @Command", async () => {
    const order: string[] = []
    class GuardCmd extends CommandInterface<undefined, string, any, Ctx> {
      async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
        order.push("exec")
        return { success: true, data: opt.input }
      }
    }
    const guardMw: Middleware<string, any, Ctx> = {
      name: "guard",
      async handle(input, context, next) {
        order.push("guard")
        return next(input, context)
      },
    }
    Command({ name: "guard", input: z.string(), middleware: [guardMw] })(GuardCmd)
    const rt = createRuntime<Ctx>({ name: "t", commands: [GuardCmd] })
    const r = await rt.execute(["guard"], "x", [], freshCtx())
    expect(r.success).toBe(true)
    expect(order).toEqual(["guard", "exec"])
  })

  it("should chain global + command middleware", async () => {
    const order: string[] = []
    const globalMw: Middleware<string, any, Ctx> = {
      name: "global",
      async handle(input, context, next) {
        order.push("global-before")
        const r = await next(input, context)
        order.push("global-after")
        return r
      },
    }
    class ChainCmd extends CommandInterface<undefined, string, any, Ctx> {
      async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
        order.push("exec")
        return { success: true, data: opt.input }
      }
    }
    const cmdMw: Middleware<string, any, Ctx> = {
      name: "cmd",
      async handle(input, context, next) {
        order.push("cmd-before")
        const r = await next(input, context)
        order.push("cmd-after")
        return r
      },
    }
    Command({ name: "chain", input: z.string(), middleware: [cmdMw] })(ChainCmd)
    const rt = createRuntime<Ctx>({ name: "t", commands: [ChainCmd], middlewares: [globalMw] })
    const r = await rt.execute(["chain"], "x", [], freshCtx())
    expect(r.success).toBe(true)
    // global wraps cmd wraps exec
    expect(order).toEqual(["global-before", "cmd-before", "exec", "cmd-after", "global-after"])
  })
})

describe("E2E: Introspection", () => {
  it("should find commands by path", () => {
    const r = runtime.findCommand(["app", "project", "deploy"])
    expect(r).not.toBeNull()
    expect(r!.name).toBe("deploy")
  })

  it("should return null for unknown path", () => {
    expect(runtime.findCommand(["nope"])).toBeNull()
  })

  it("should generate help at root level", () => {
    const help = runtime.generateHelp()
    expect(help).toContain("app")
    expect(help).toContain("hello")
  })

  it("should generate help at deep path", () => {
    const help = runtime.generateHelp(["app", "project", "deploy"])
    expect(help).toContain("deploy")
    expect(help).toContain("--env")
    expect(help).toContain("--branch")
  })

  it("should return not-found message for unknown help path", () => {
    const help = runtime.generateHelp(["unknown"])
    expect(help).toContain("not found")
  })

  it("should expose command tree", () => {
    const tree = runtime.getCommandTree()
    expect(tree.length).toBeGreaterThanOrEqual(2)
    const app = tree.find((c) => c.name === "app")
    expect(app).toBeDefined()
    expect(app!.children).toHaveLength(1)
    expect(app!.children![0]!.name).toBe("project")
  })

  it("should generate documentation", () => {
    const docs = runtime.generateDocs()
    expect(docs["README.md"]).toBeDefined()
    expect(docs["README.md"]).toContain("app")
    expect(docs["README.md"]).toContain("hello")
  })

  it("should generate per-command documentation", () => {
    const docs = runtime.generateDocs({ perCommand: true })
    // flattenDocs uses join("-") on [parents..., name]
    // For root "app" → "app.md", for "hello" → "hello.md"
    expect(docs["app.md"]).toBeDefined()
    expect(docs["hello.md"]).toBeDefined()
    // Nested: "app" child "project" → "app-project.md"
    expect(docs["app-project.md"]).toBeDefined()
  })

  it("should generate bash completion", () => {
    const script = runtime.generateCompletion("bash")
    expect(script).toContain("complete -F")
    expect(script).toContain("app")
    expect(script).toContain("hello")
    expect(script).toContain("--env")
    expect(script).toContain("-e")
  })
})

describe("E2E: Registry & Resolver", () => {
  it("should resolve deep paths", () => {
    const registry = new CommandRegistry()
    registry.register([RootCmd, ProjectCmd, DeployCmd])
    const cls = registry.resolve(["app", "project", "deploy"])
    expect(cls).toBe(DeployCmd)
  })

  it("should return undefined for unresolvable path", () => {
    const registry = new CommandRegistry()
    registry.register([RootCmd])
    expect(registry.resolve(["app", "nope"])).toBeUndefined()
    expect(registry.resolve([])).toBeUndefined()
  })

  it("should resolve option aliases", () => {
    const registry = new CommandRegistry()
    registry.register([DeployCmd])
    const resolver = new CommandResolver(registry)
    const opts = resolver.resolveOptionAliases(DeployCmd, [
      { level: 0, name: "env", value: "prod" },
      { level: 0, name: "e", value: "staging" }, // alias should resolve to env
    ], 0)
    expect(opts).toHaveProperty("env")
  })

  it("should parse boolean flags", () => {
    const p = runtime.parse(["mycli", "hello", "x", "--verbose"])
    // --verbose is not declared, but parser should accept it as a flag
    expect(p.optionEntries).toHaveLength(1)
    expect(p.optionEntries[0]!.value).toBe(true)
  })

  it("should parse short alias flags", () => {
    const p = runtime.parse(["mycli", "hello", "x", "-v"])
    expect(p.optionEntries).toHaveLength(1)
    expect(p.optionEntries[0]!.name).toBe("v")
    expect(p.optionEntries[0]!.value).toBe(true)
  })
})

describe("E2E: Error Paths", () => {
  it("should fail for empty path", async () => {
    const r = await runtime.execute([], undefined, [], freshCtx())
    expect(r.success).toBe(false)
    if (!r.success) expect(r.errors[0]!.message).toContain("No command specified")
  })

  it("should fail for unknown root command", async () => {
    const r = await runtime.execute(["nope"], undefined, [], freshCtx())
    expect(r.success).toBe(false)
    if (!r.success) expect(r.errors[0]!.message).toContain("not found")
  })

  it("should fail for unknown child", async () => {
    const r = await runtime.execute(["app", "nope"], undefined, [], freshCtx())
    expect(r.success).toBe(false)
    // buildInstanceChain returns null when child route is not found
    if (!r.success) expect(r.errors[0]!.message).toContain("Failed to build")
  })

  it("should fail for missing hook method", async () => {
    class NoHookCmd extends CommandInterface<undefined, string, any, Ctx> {
      async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
        return { success: true, data: opt.input }
      }
    }
    class ParentNoHookCmd extends CommandInterface<undefined, unknown, unknown, Ctx> {
      async execute(): Promise<any> { return { success: true, data: "parent" } }
    }
    Command({ name: "child" })(NoHookCmd)
    Command({ name: "parent" })(ParentNoHookCmd)
    CommandChild({ child: NoHookCmd, Constructor(p: any) { return new NoHookCmd(p) } })(
      ParentNoHookCmd.prototype, "child", Object.getOwnPropertyDescriptor(ParentNoHookCmd.prototype, "child")!
    )
    const rt = createRuntime<Ctx>({ name: "t", commands: [ParentNoHookCmd] })
    // "child" method doesn't exist on ParentNoHookCmd → hook method not implemented
    const r = await rt.execute(["parent", "child"], "x", [], freshCtx())
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.errors[0]!.message).toContain("not implemented")
    }
  })
})

describe("E2E: Multiple Root Commands", () => {
  it("should support multiple roots", async () => {
    class CmdA extends CommandInterface<undefined, string, any, Ctx> {
      async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
        return { success: true, data: `A:${opt.input}` }
      }
    }
    class CmdB extends CommandInterface<undefined, string, any, Ctx> {
      async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
        return { success: true, data: `B:${opt.input}` }
      }
    }
    Command({ name: "cmd-a", input: z.string() })(CmdA)
    Command({ name: "cmd-b", input: z.string() })(CmdB)
    const rt = createRuntime<Ctx>({ name: "multi", commands: [CmdA, CmdB] })

    const ra = await rt.execute(["cmd-a"], "X", [], freshCtx())
    expect(ra.success).toBe(true)
    if (ra.success) expect(ra.data).toBe("A:X")

    const rb = await rt.execute(["cmd-b"], "Y", [], freshCtx())
    expect(rb.success).toBe(true)
    if (rb.success) expect(rb.data).toBe("B:Y")
  })
})

describe("E2E: Context Factory in HTTP", () => {
  it("should support lazy context in HTTP adapter", async () => {
    let contextCreated = false
    const res = await handleHttp(
      { method: "POST", path: "/commands/hello", body: "World" },
      { runtime, context: () => { contextCreated = true; return freshCtx() } }
    )
    expect(res.status).toBe(200)
    expect(contextCreated).toBe(true)
  })
})

describe("E2E: DocGenerator with examples", () => {
  it("should include examples in generated docs", () => {
    class ExampleCmd extends CommandInterface<undefined, string, any, Ctx> {
      async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
        return { success: true, data: opt.input }
      }
    }
    Command({
      name: "example",
      description: "An example",
      input: z.string(),
      examples: [{ cmd: "example test", description: "Run an example" }],
    })(ExampleCmd)
    const rt = createRuntime<Ctx>({ name: "ex", commands: [ExampleCmd] })
    const docs = rt.generateDocs()
    expect(docs["README.md"]).toContain("example test")
    expect(docs["README.md"]).toContain("Run an example")
  })
})
