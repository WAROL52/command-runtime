import { describe, it, expect } from "vitest"
import { Readable, Writable } from "node:stream"
import { z } from "zod"
import {
  CommandInterface,
  createRuntime,
} from "../src/index"
import { Command } from "../src/decorators/command.decorator"
import { createMCPServer } from "../src/adapters/ai/mcp-server"
import type { ExecCmdOption } from "../src/index"

interface Ctx { user: string }

class HelloCmd extends CommandInterface<undefined, string, any, Ctx> {
  async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
    return { success: true, data: `Hello ${opt.input}` }
  }
}

class FailCmd extends CommandInterface<undefined, string, any, Ctx> {
  async execute(): Promise<any> {
    return { success: false, errors: [{ message: "always fails" }] }
  }
}

Command({ name: "hello", input: z.string() })(HelloCmd)
Command({ name: "fail", input: z.string() })(FailCmd)

const runtime = createRuntime<Ctx>({ name: "mcp-test", commands: [HelloCmd, FailCmd] })

function mcpPair() {
  const chunks: string[] = []
  const stdout = new Writable({
    write(chunk: any, _enc: any, cb: any) {
      chunks.push(chunk.toString())
      cb()
    },
  })
  const stdin = new Readable({ read() {} })
  const server = createMCPServer({ runtime, context: { user: "test" }, stdin, stdout })
  return { stdin, chunks, server }
}

function recv(chunks: string[]): any[] {
  return chunks.map((c) => JSON.parse(c.trim()))
}

describe("MCP Server", () => {
  it("should respond to initialize", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize" }) + "\n")
    await new Promise((r) => setTimeout(r, 10))
    const msgs = recv(chunks)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.jsonrpc).toBe("2.0")
    expect(msgs[0]!.id).toBe(1)
    expect(msgs[0]!.result.protocolVersion).toBeDefined()
    expect(msgs[0]!.result.capabilities).toHaveProperty("tools")
  })

  it("should list tools", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n")
    await new Promise((r) => setTimeout(r, 10))
    const msgs = recv(chunks)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.result.tools.length).toBeGreaterThanOrEqual(2)
    const names = msgs[0]!.result.tools.map((t: any) => t.name)
    expect(names).toContain("hello")
    expect(names).toContain("fail")
  })

  it("should execute a tool via tools/call", async () => {
    const { stdin, chunks } = mcpPair()
    const req = { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "hello", arguments: { input: "MCP" } } }
    stdin.push(JSON.stringify(req) + "\n")
    await new Promise((r) => setTimeout(r, 50))
    const msgs = recv(chunks)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.id).toBe(3)
    expect(msgs[0]!.result.content[0].text).toContain("Hello MCP")
  })

  it("should handle tools/call with undefined arguments", async () => {
    const { stdin, chunks } = mcpPair()
    // params without arguments field → should use {} default
    const req = { jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "hello" } }
    stdin.push(JSON.stringify(req) + "\n")
    await new Promise((r) => setTimeout(r, 50))
    const msgs = recv(chunks)
    expect(msgs).toHaveLength(1)
    // input will be undefined, but it should not crash
    expect(msgs[0]!.result.content[0].text).toBeDefined()
  })

  it("should handle tools/call with missing params", async () => {
    const { stdin, chunks } = mcpPair()
    const req = { jsonrpc: "2.0", id: 5, method: "tools/call" }
    stdin.push(JSON.stringify(req) + "\n")
    await new Promise((r) => setTimeout(r, 10))
    const msgs = recv(chunks)
    expect(msgs).toHaveLength(1)
    // params is undefined → crash in handler → catch block → -32603
    expect(msgs[0]!.error).toBeDefined()
  })

  it("should return error for unknown method", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push(JSON.stringify({ jsonrpc: "2.0", id: 6, method: "unknown-method" }) + "\n")
    await new Promise((r) => setTimeout(r, 10))
    const msgs = recv(chunks)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.error.code).toBe(-32601)
    expect(msgs[0]!.error.message).toContain("not found")
  })

  it("should handle JSON parse error", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push("not valid json\n")
    await new Promise((r) => setTimeout(r, 10))
    const msgs = recv(chunks)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.error.code).toBe(-32700)
  })

  it("should skip empty lines in stream", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push("\n\n  \n")
    stdin.push(JSON.stringify({ jsonrpc: "2.0", id: 7, method: "initialize" }) + "\n")
    await new Promise((r) => setTimeout(r, 10))
    const msgs = recv(chunks)
    // Empty lines should be skipped, only the valid JSON should produce a response
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.id).toBe(7)
  })

  it("should handle partial chunks split across data events", async () => {
    const { stdin, chunks } = mcpPair()
    const json = JSON.stringify({ jsonrpc: "2.0", id: 8, method: "initialize" })
    // Split the JSON in the middle and send as two chunks
    const mid = Math.floor(json.length / 2)
    stdin.push(json.slice(0, mid))
    await new Promise((r) => setTimeout(r, 5))
    stdin.push(json.slice(mid) + "\n")
    await new Promise((r) => setTimeout(r, 10))
    const msgs = recv(chunks)
    expect(msgs).toHaveLength(1)
    expect(msgs[0]!.id).toBe(8)
  })

  it("should handle multiple messages in one chunk", async () => {
    const { stdin, chunks } = mcpPair()
    const msg1 = JSON.stringify({ jsonrpc: "2.0", id: 9, method: "initialize" })
    const msg2 = JSON.stringify({ jsonrpc: "2.0", id: 10, method: "tools/list" })
    stdin.push(`${msg1}\n${msg2}\n`)
    await new Promise((r) => setTimeout(r, 10))
    const msgs = recv(chunks)
    expect(msgs).toHaveLength(2)
    expect(msgs[0]!.id).toBe(9)
    expect(msgs[1]!.id).toBe(10)
  })

  it("should close and remove data listener", () => {
    const { stdin, server } = mcpPair()
    expect(stdin.listenerCount("data")).toBe(1)
    server.close()
    expect(stdin.listenerCount("data")).toBe(0)
  })

  it("should handle tool that returns failure result", async () => {
    const { stdin, chunks } = mcpPair()
    const req = { jsonrpc: "2.0", id: 11, method: "tools/call", params: { name: "fail", arguments: { input: "x" } } }
    stdin.push(JSON.stringify(req) + "\n")
    await new Promise((r) => setTimeout(r, 50))
    const msgs = recv(chunks)
    expect(msgs[0]!.result.content[0].text).toContain("success")
  })

  it("should handle id being a string", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push(JSON.stringify({ jsonrpc: "2.0", id: "req-1", method: "initialize" }) + "\n")
    await new Promise((r) => setTimeout(r, 10))
    const msgs = recv(chunks)
    expect(msgs[0]!.id).toBe("req-1")
  })

  it("should handle id being null", async () => {
    const { stdin, chunks } = mcpPair()
    stdin.push(JSON.stringify({ jsonrpc: "2.0", id: null, method: "unknown-method" }) + "\n")
    await new Promise((r) => setTimeout(r, 10))
    const msgs = recv(chunks)
    // null id should be accepted and returned
    expect(msgs[0]!.id).toBeNull()
    expect(msgs[0]!.error).toBeDefined()
  })
})
