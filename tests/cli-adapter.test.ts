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

  it("should default to console if no out provided", async () => {
    const origLog = console.log
    const origErr = console.error
    const logged: string[] = []
    console.log = (m: string) => logged.push(m)
    console.error = () => {}
    const code = await runCli({
      runtime,
      context: { user: "bob" },
      argv: ["myapp", "greet", "Jack"],
    })
    console.log = origLog
    console.error = origErr
    expect(code).toBe(0)
    expect(logged[0]).toContain("Jack")
  })

  it("should not output when result.data is null", async () => {
    class NullCmd extends CommandInterface<undefined, string, any, MyContext> {
      async execute(): Promise<any> {
        return { success: true, data: null }
      }
    }
    Command({ name: "null-data", input: z.string() })(NullCmd)
    const rt = createRuntime<MyContext>({ name: "app", commands: [NullCmd] })
    const out = capture()
    const code = await runCli({
      runtime: rt,
      context: { user: "bob" },
      argv: ["app", "null-data", "x"],
      out,
    })
    expect(code).toBe(0)
    expect(out.lines).toHaveLength(0)
  })

  it("should not output when result.data is undefined", async () => {
    class UndefCmd extends CommandInterface<undefined, string, any, MyContext> {
      async execute(): Promise<any> {
        return { success: true, data: undefined }
      }
    }
    Command({ name: "undef-data", input: z.string() })(UndefCmd)
    const rt = createRuntime<MyContext>({ name: "app", commands: [UndefCmd] })
    const out = capture()
    const code = await runCli({
      runtime: rt,
      context: { user: "bob" },
      argv: ["app", "undef-data", "x"],
      out,
    })
    expect(code).toBe(0)
    expect(out.lines).toHaveLength(0)
  })

  it("should print multiple errors on failure", async () => {
    class MultiErrCmd extends CommandInterface<undefined, string, any, MyContext> {
      async execute(): Promise<any> {
        return {
          success: false,
          errors: [
            { message: "first error" },
            { message: "second error" },
          ],
        }
      }
    }
    Command({ name: "multi-err", input: z.string() })(MultiErrCmd)
    const rt = createRuntime<MyContext>({ name: "app", commands: [MultiErrCmd] })
    const out = capture()
    const code = await runCli({
      runtime: rt,
      context: { user: "bob" },
      argv: ["app", "multi-err", "x"],
      out,
    })
    expect(code).toBe(1)
    expect(out.lines[0]).toContain("first error")
    expect(out.lines[1]).toContain("second error")
  })

  it("should show help for empty path after args", async () => {
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
})
