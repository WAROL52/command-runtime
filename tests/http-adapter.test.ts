import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  CommandInterface,
  createRuntime,
} from "../src/index"
import { Command } from "../src/decorators/command.decorator"
import { handleHttp } from "../src/adapters/http/http-adapter"
import type { ExecCmdOption } from "../src/index"

interface MyContext { userId: string }

class CreateUserCommand extends CommandInterface<undefined, { name: string; age: number }, any, MyContext> {
  async execute(opt: ExecCmdOption<{ name: string; age: number }, MyContext>): Promise<any> {
    const { input, context } = opt
    return {
      success: true,
      data: { id: "123", name: input?.name, age: input?.age, createdBy: context.userId },
    }
  }
}

Command({ name: "create-user", input: z.object({ name: z.string(), age: z.number() }) })(CreateUserCommand)

const runtime = createRuntime<MyContext>({
  name: "app",
  commands: [CreateUserCommand],
})

const ctx: MyContext = { userId: "alice" }

describe("HTTP Adapter", () => {
  it("should execute a command from POST path", async () => {
    const res = await handleHttp(
      { method: "POST", path: "/commands/create-user", body: { name: "Bob", age: 30 } },
      { runtime, context: ctx }
    )
    expect(res.status).toBe(200)
    const body = res.body as any
    expect(body.success).toBe(true)
    expect(body.data.name).toBe("Bob")
    expect(body.data.createdBy).toBe("alice")
  })

  it("should execute with GET and query body", async () => {
    const res = await handleHttp(
      { method: "GET", path: "/commands/create-user", body: { name: "Alice", age: 25 } },
      { runtime, context: ctx }
    )
    expect(res.status).toBe(200)
    expect((res.body as any).data.name).toBe("Alice")
  })

  it("should return 400 for unknown command", async () => {
    const res = await handleHttp(
      { method: "POST", path: "/commands/unknown" },
      { runtime, context: ctx }
    )
    expect(res.status).toBe(400)
    const body = res.body as any
    expect(body.success).toBe(false)
  })

  it("should support custom path prefix", async () => {
    const res = await handleHttp(
      { method: "POST", path: "/api/create-user", body: { name: "Bob", age: 30 } },
      { runtime, context: ctx, pathPrefix: "/api/" }
    )
    expect(res.status).toBe(200)
    expect((res.body as any).success).toBe(true)
  })

  it("should support custom parsePath", async () => {
    const res = await handleHttp(
      { method: "POST", path: "create-user", body: { name: "Bob", age: 30 } },
      {
        runtime,
        context: ctx,
        parsePath: (req) => [req.path],
      }
    )
    expect(res.status).toBe(200)
    expect((res.body as any).success).toBe(true)
  })

  it("should return 400 for empty path", async () => {
    const res = await handleHttp(
      { method: "GET", path: "/" },
      { runtime, context: ctx }
    )
    expect(res.status).toBe(400)
  })

  it("should parse malformed query string (=value without key)", async () => {
    // ?=value should be skipped by defaultParseOptions
    const res = await handleHttp(
      { method: "GET", path: "/commands/create-user?=test&name=Bob" },
      { runtime, context: ctx }
    )
    expect(res.status).toBe(200)
    // Query options don't affect input, so body will be undefined but name should come from query? No, query options go to optionEntries not input
    // Actually input is from body (undefined here), so age will be undefined, which Zod will reject
    // But we test that the malformed key is skipped (doesn't throw)
    expect(res.body).toBeDefined()
  })

  it("should parse flag-only query option (?verbose)", async () => {
    const res = await handleHttp(
      { method: "GET", path: "/commands/create-user?verbose" },
      { runtime, context: ctx }
    )
    expect(res.status).toBe(200)
    expect(res.body as any).toBeDefined()
  })

  it("should handle path with double slashes after prefix", async () => {
    const res = await handleHttp(
      { method: "POST", path: "/commands//create-user", body: { name: "Bob", age: 30 } },
      { runtime, context: ctx }
    )
    expect(res.status).toBe(200)
    expect((res.body as any).success).toBe(true)
  })

  it("should handle path with trailing slash", async () => {
    const res = await handleHttp(
      { method: "POST", path: "/commands/create-user/", body: { name: "Bob", age: 30 } },
      { runtime, context: ctx }
    )
    expect(res.status).toBe(200)
    expect((res.body as any).success).toBe(true)
  })

  it("should execute with path not starting with prefix", async () => {
    // The prefix is /commands/ so /custom/create-user should not match → unknown path → 400
    const res = await handleHttp(
      { method: "POST", path: "/custom/create-user", body: { name: "Bob", age: 30 } },
      { runtime, context: ctx }
    )
    expect(res.status).toBe(400)
  })

  it("should support custom parseInput returning undefined (skips validation)", async () => {
    const res = await handleHttp(
      { method: "POST", path: "/commands/create-user" },
      {
        runtime,
        context: ctx,
        parseInput: () => undefined,
      }
    )
    // Executor skips Zod validation when input is undefined
    expect(res.status).toBe(200)
    expect((res.body as any).success).toBe(true)
  })

  it("should support custom parseOptions with query string", async () => {
    const res = await handleHttp(
      { method: "GET", path: "/commands/create-user?name=Bob&age=25" },
      {
        runtime,
        context: ctx,
        parseOptions: (req) => {
          // Treat query params as input via options override
          return []
        },
        parseInput: (req) => {
          const q = req.path.split("?")[1]
          if (!q) return undefined
          const params: Record<string, string> = {}
          for (const part of q.split("&")) {
            const [k, v] = part.split("=")
            if (k) params[k] = v ?? "true"
          }
          return { name: params.name, age: Number(params.age) }
        },
      }
    )
    expect(res.status).toBe(200)
    expect((res.body as any).data.name).toBe("Bob")
    expect((res.body as any).data.age).toBe(25)
  })
})
