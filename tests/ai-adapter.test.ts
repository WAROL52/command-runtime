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
})
