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
})
