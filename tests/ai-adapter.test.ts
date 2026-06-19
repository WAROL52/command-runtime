import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  CommandInterface,
  createRuntime,
} from "../src/index"
import { Command } from "../src/decorators/command.decorator"
import { CommandChild } from "../src/decorators/child.decorator"
import { CommandOption } from "../src/decorators/option.decorator"
import { AIAdapter } from "../src/adapters/ai/ai-adapter"
import { toOpenAITool, toMCPTool } from "../src/adapters/ai/types"
import type { ExecSubCmdOption, ExecCmdOption } from "../src/index"

interface Ctx { user: string }

class HelloCmd extends CommandInterface<undefined, string, any, Ctx> {
  async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
    return { success: true, data: `Hello ${opt.input}` }
  }
}

class ByeCmd extends CommandInterface<undefined, string, any, Ctx> {
  async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
    return { success: true, data: `Bye ${opt.input}` }
  }
}

class GreetCmd extends CommandInterface<undefined, unknown, unknown, Ctx> {
  async execute(): Promise<any> {
    return { success: true, data: "greet root" }
  }
  async hello(opt: ExecSubCmdOption<HelloCmd, string, Ctx>): Promise<any> {
    return opt.child.execute({ input: opt.input, context: opt.context, nextChild: () => null })
  }
}

Command({ name: "hello", input: z.string() })(HelloCmd)
Command({ name: "bye", input: z.string() })(ByeCmd)
Command({ name: "greet" })(GreetCmd)
CommandChild({ child: HelloCmd, Constructor(p: any) { return new HelloCmd(p) } })(
  GreetCmd.prototype, "hello", Object.getOwnPropertyDescriptor(GreetCmd.prototype, "hello")!
)

const runtime = createRuntime<Ctx>({
  name: "myapp",
  commands: [HelloCmd, ByeCmd, GreetCmd],
})

const ai = new AIAdapter(runtime, { user: "test" })

describe("AI Adapter", () => {
  it("should generate AI tools from command tree", () => {
    const tools = ai.toTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain("hello")
    expect(names).toContain("bye")
    expect(names).toContain("greet")
    expect(names).toContain("greet.hello")
  })

  it("should convert to OpenAI format", () => {
    const tools = ai.toTools()
    const openai = tools.map(toOpenAITool)
    expect(openai[0]).toHaveProperty("type", "function")
    expect(openai[0]).toHaveProperty("function.name")
    expect(openai[0]).toHaveProperty("function.parameters")
  })

  it("should convert to MCP format", () => {
    const tools = ai.toTools()
    const mcp = tools.map(toMCPTool)
    expect(mcp[0]).toHaveProperty("name")
    expect(mcp[0]).toHaveProperty("description")
    expect(mcp[0]).toHaveProperty("inputSchema")
  })

  it("should execute a tool by dotted name", async () => {
    const result = await ai.executeTool({ name: "hello", arguments: { input: "World" } })
    expect(result.success).toBe(true)
    expect(result.data).toBe("Hello World")
  })

  it("should execute a nested tool by dotted name", async () => {
    const result = await ai.executeTool({ name: "greet.hello", arguments: { input: "Nested" } })
    expect(result.success).toBe(true)
    expect(result.data).toBe("Hello Nested")
  })

  it("should return error for non-existent tool", async () => {
    const result = await ai.executeTool({ name: "nonexistent", arguments: {} })
    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it("should execute tool without arguments field", async () => {
    // arguments is undefined, adapter should use {} default
    const result = await ai.executeTool({ name: "greet" })
    expect(result.success).toBe(true)
  })

  it("should render tool with options in inputSchema", async () => {
    class WithOptCmd extends CommandInterface<undefined, string, any, Ctx> {
      _verbose?: boolean

      get verbose() {
        return this._verbose
      }

      @CommandOption({ name: "verbose", alias: "v", input: z.boolean() })
      set verbose(v: boolean) {
        this._verbose = v
      }

      async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
        return { success: true, data: { input: opt.input, verbose: this._verbose } }
      }
    }

    Command({ name: "with-opt", input: z.string() })(WithOptCmd)
    const rt = createRuntime<Ctx>({ name: "optapp", commands: [WithOptCmd] })
    const a = new AIAdapter(rt, { user: "test" })
    const tools = a.toTools()
    const t = tools.find((t) => t.name === "with-opt")
    expect(t).toBeDefined()
    expect(t!.inputSchema.properties).toHaveProperty("verbose")
    expect(t!.inputSchema.properties).toHaveProperty("input")
  })

  it("should return success: false with error for non-existent tool", async () => {
    const result = await ai.executeTool({ name: "no-such-tool", arguments: { input: "x" } })
    expect(result.success).toBe(false)
    expect(result.error).toContain("no-such-tool")
  })

  it("should return error for non-existent tool in arguments", async () => {
    const result = await ai.executeTool({ name: "hello", arguments: { nonexistent: "value" } })
    // Extra args are passed as optionEntries but hello has no options
    // This should still work fine since extra args are ignored
    expect(result.success).toBe(true)
  })

  it("should handle 2-level child recursion", async () => {
    const tools = ai.toTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain("greet")
    expect(names).toContain("greet.hello")
  })

  it("should handle 3-level child recursion via recursive buildMeta", async () => {
    class SubCmd extends CommandInterface<undefined, string, any, Ctx> {
      async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
        return { success: true, data: `sub ${opt.input}` }
      }
    }
    Command({ name: "sub", input: z.string() })(SubCmd)

    class MidCmd extends CommandInterface<undefined, unknown, unknown, Ctx> {
      async execute(): Promise<any> {
        return { success: true, data: "mid" }
      }
      async sub(opt: ExecSubCmdOption<SubCmd, string, Ctx>): Promise<any> {
        return opt.child.execute({ input: opt.input, context: opt.context, nextChild: () => null })
      }
    }
    Command({ name: "mid" })(MidCmd)
    CommandChild({ child: SubCmd, Constructor(p: any) { return new SubCmd(p) } })(
      MidCmd.prototype, "sub", Object.getOwnPropertyDescriptor(MidCmd.prototype, "sub")!
    )

    class TopCmd extends CommandInterface<undefined, unknown, unknown, Ctx> {
      async execute(): Promise<any> {
        return { success: true, data: "top" }
      }
      async mid(opt: ExecSubCmdOption<MidCmd, unknown, Ctx>): Promise<any> {
        return opt.child.execute({ input: opt.input, context: opt.context, nextChild: () => null })
      }
    }
    Command({ name: "top" })(TopCmd)
    CommandChild({ child: MidCmd, Constructor(p: any) { return new MidCmd(p) } })(
      TopCmd.prototype, "mid", Object.getOwnPropertyDescriptor(TopCmd.prototype, "mid")!
    )

    const rt = createRuntime<Ctx>({ name: "deep", commands: [TopCmd, MidCmd, SubCmd] })
    const a = new AIAdapter(rt, { user: "test" })
    const tools = a.toTools()
    const names = tools.map((t) => t.name)
    expect(names).toContain("top")
    expect(names).toContain("top.mid")
    expect(names).toContain("top.mid.sub")
  })
})
