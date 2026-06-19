import { describe, it, expect } from "vitest"
import { z } from "zod"
import { CommandInterface, createRuntime } from "../src/index"
import { Command } from "../src/decorators/command.decorator"
import { CommandChild } from "../src/decorators/child.decorator"
import { CommandOption } from "../src/decorators/option.decorator"
import { createOpenAIAdapter } from "../src/adapters/ai/openai-adapter"
import type { ExecCmdOption } from "../src/index"

interface Ctx { userId: string }

class NoDescCmd extends CommandInterface<undefined, string, any, Ctx> {
  async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
    return { success: true, data: `done ${opt.input}` }
  }
}

class WithOptCmd extends CommandInterface<undefined, string, any, Ctx> {
  _count?: number

  get count() {
    return this._count
  }

  @CommandOption({ name: "count", alias: "c", input: z.coerce.number() })
  set count(v: number) {
    this._count = v
  }

  async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
    return { success: true, data: { input: opt.input, count: this._count } }
  }
}

class EmptyInputCmd extends CommandInterface<undefined, undefined, any, Ctx> {
  async execute(opt: ExecCmdOption<undefined, Ctx>): Promise<any> {
    return { success: true, data: "no input" }
  }
}

Command({ name: "nodesc", input: z.string() })(NoDescCmd)
Command({ name: "withopt", input: z.string() })(WithOptCmd)
Command({ name: "empty-input" })(EmptyInputCmd)

const runtime = createRuntime<Ctx>({ name: "openai-test", commands: [NoDescCmd, WithOptCmd, EmptyInputCmd] })

describe("OpenAI Adapter", () => {
  it("should convert a command to an OpenAI tool with empty description", () => {
    const adapter = createOpenAIAdapter(runtime)
    const tools = adapter.tools
    const node = tools.find((t) => t.function.name === "nodesc")
    expect(node).toBeDefined()
    expect(node!.function.description).toBe("")
  })

  it("should convert a command with options to OpenAI tool parameters", () => {
    const adapter = createOpenAIAdapter(runtime)
    const tools = adapter.tools
    const wt = tools.find((t) => t.function.name === "withopt")
    expect(wt).toBeDefined()
    const props = wt!.function.parameters.properties as Record<string, any>
    expect(props).toHaveProperty("input")
    expect(props).toHaveProperty("count")
  })

  it("should return empty parameters for command without input schema", () => {
    const adapter = createOpenAIAdapter(runtime)
    const tools = adapter.tools
    const ei = tools.find((t) => t.function.name === "empty-input")
    expect(ei).toBeDefined()
    // Should have no properties since there's no input schema
    const props = ei!.function.parameters.properties as Record<string, any>
    expect(Object.keys(props)).toHaveLength(0)
  })

  it("should execute a tool by dotted name", async () => {
    const adapter = createOpenAIAdapter(runtime)
    const result = await adapter.executeTool("nodesc", { input: "test-value" }, { userId: "abc" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toContain("test-value")
    }
  })

  it("should execute a tool with undefined args", async () => {
    const adapter = createOpenAIAdapter(runtime)
    const result = await adapter.executeTool("empty-input", undefined, { userId: "abc" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe("no input")
    }
  })

  it("should execute a tool with null args", async () => {
    const adapter = createOpenAIAdapter(runtime)
    const result = await adapter.executeTool("empty-input", null, { userId: "abc" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe("no input")
    }
  })

  it("should return failure for unknown tool", async () => {
    const adapter = createOpenAIAdapter(runtime)
    const result = await adapter.executeTool("nonexistent", {}, { userId: "abc" })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("nonexistent")
    }
  })

  it("should create multiple tools from runtime commands", () => {
    const adapter = createOpenAIAdapter(runtime)
    const names = adapter.tools.map((t) => t.function.name)
    expect(names).toContain("nodesc")
    expect(names).toContain("withopt")
    expect(names).toContain("empty-input")
  })

  it("should flatten nested commands to dotted tools", () => {
    class NestedChildCmd extends CommandInterface<undefined, string, any, Ctx> {
      async execute(opt: ExecCmdOption<string, Ctx>) {
        return { success: true, data: `child ${opt.input}` }
      }
    }
    class NestedParentCmd extends CommandInterface<undefined, string, any, Ctx> {
      async execute(opt: ExecCmdOption<string, Ctx>) {
        return { success: true, data: `parent ${opt.input}` }
      }
    }

    Command({ name: "nested-child", input: z.string() })(NestedChildCmd)
    Command({ name: "nested-parent", input: z.string() })(NestedParentCmd)
    CommandChild({ child: NestedChildCmd, Constructor(p: any) { return new NestedChildCmd(p) } })(
      NestedParentCmd.prototype, "nested-child", Object.getOwnPropertyDescriptor(NestedParentCmd.prototype, "nested-child")!
    )

    const rt = createRuntime<Ctx>({ name: "nested-test", commands: [NestedParentCmd, NestedChildCmd] })
    const adapter = createOpenAIAdapter(rt)
    const names = adapter.tools.map((t) => t.function.name)
    expect(names).toContain("nested-parent")
    expect(names).toContain("nested-parent.nested-child")
  })
})
