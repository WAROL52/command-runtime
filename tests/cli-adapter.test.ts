import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  CommandInterface,
  createRuntime,
} from "../src/index"
import { Command } from "../src/decorators/command.decorator"
import { runCli } from "../src/adapters/cli/cli-adapter"
import type { ExecCmdOption } from "../src/index"

interface MyContext {
  user: string
}

class GreetCommand extends CommandInterface<undefined, string, any, MyContext> {
  async execute(opt: ExecCmdOption<string, MyContext>): Promise<any> {
    return { success: true, data: `Hello ${opt.input}! (user: ${opt.context.user})` }
  }
}

Command({ name: "greet", input: z.string() })(GreetCommand)

const runtime = createRuntime<MyContext>({
  name: "myapp",
  commands: [GreetCommand],
})

function capture() {
  const lines: string[] = []
  return {
    log: (m: string) => lines.push(m),
    error: (m: string) => lines.push(`ERR: ${m}`),
    lines,
  }
}

describe("CLI Adapter", () => {
  it("should execute a command and return data", async () => {
    const out = capture()
    const code = await runCli({
      runtime,
      context: { user: "bob" },
      argv: ["myapp", "greet", "Jack"],
      out,
    })
    expect(code).toBe(0)
    expect(out.lines[0]).toContain("Hello Jack!")
  })

  it("should return exit code 1 on error", async () => {
    const out = capture()
    const code = await runCli({
      runtime,
      context: { user: "bob" },
      argv: ["myapp", "nonexistent"],
      out,
    })
    expect(code).toBe(1)
    expect(out.lines[0]).toContain("not found")
  })

  it("should show help with --help", async () => {
    const out = capture()
    const code = await runCli({
      runtime,
      context: { user: "bob" },
      argv: ["myapp", "greet", "--help"],
      out,
    })
    expect(code).toBe(0)
    expect(out.lines.join(" ")).toContain("greet")
  })

  it("should show global help when no path", async () => {
    const out = capture()
    const code = await runCli({
      runtime,
      context: { user: "bob" },
      argv: ["myapp"],
      out,
    })
    expect(code).toBe(0)
    expect(out.lines.join(" ")).toContain("greet")
  })

  it("should show version with --version", async () => {
    const out = capture()
    const code = await runCli({
      runtime,
      context: { user: "bob" },
      argv: ["myapp", "--version"],
      version: "1.0.0",
      out,
    })
    expect(code).toBe(0)
    expect(out.lines[0]).toBe("1.0.0")
  })

  it("should support lazy context factory", async () => {
    const out = capture()
    const code = await runCli({
      runtime,
      context: () => ({ user: "alice" }),
      argv: ["myapp", "greet", "Jack"],
      out,
    })
    expect(code).toBe(0)
    expect(out.lines[0]).toContain("alice")
  })
})
