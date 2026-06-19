import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  CommandInterface,
  createRuntime,
} from "../src/index"
import { Command } from "../src/decorators/command.decorator"
import { CommandChild } from "../src/decorators/child.decorator"
import { CommandOption } from "../src/decorators/option.decorator"
import { CompletionGenerator } from "../src/runtime/completion"
import type { ExecSubCmdOption, ExecCmdOption } from "../src/index"

interface Ctx { user: string }

class UserCmd extends CommandInterface<undefined, unknown, unknown, Ctx> {
  async execute(): Promise<any> { return { success: true, data: "ok" } }
  async create(opt: ExecSubCmdOption<any, string, Ctx>): Promise<any> {
    return opt.child.execute({ input: opt.input, context: opt.context, nextChild: () => null })
  }
}

class CreateUserCmd extends CommandInterface<UserCmd, string, any, Ctx> {
  constructor(p: UserCmd) { super(p) }
  async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
    return { success: true, data: { name: opt.input } }
  }
  get age(): number { return this.getOption<number>("age") ?? 0 }
}

Command({ name: "user", description: "Manage users" })(UserCmd)
Command({ name: "create", description: "Create a user", input: z.string() })(CreateUserCmd)
CommandChild({ child: CreateUserCmd, Constructor(p: any) { return new CreateUserCmd(p) } })(
  UserCmd.prototype, "create", Object.getOwnPropertyDescriptor(UserCmd.prototype, "create")!
)
CommandOption({ name: "age", alias: "a", description: "Age", input: z.number().optional() })(
  CreateUserCmd.prototype, "age", Object.getOwnPropertyDescriptor(CreateUserCmd.prototype, "age")!
)

const runtime = createRuntime<Ctx>({ name: "mycli", commands: [UserCmd] })

describe("CompletionGenerator", () => {
  it("should generate bash completion script", () => {
    const gen = new CompletionGenerator(runtime)
    const script = gen.generate("bash")
    expect(script).toContain("complete -F _mycli_completion mycli")
    expect(script).toContain("user")
    expect(script).toContain("create")
    expect(script).toContain("--age")
    expect(script).toContain("-a")
  })

  it("should generate zsh completion script", () => {
    const gen = new CompletionGenerator(runtime)
    const script = gen.generate("zsh")
    expect(script).toContain("#compdef mycli")
    expect(script).toContain("user")
    expect(script).toContain("create")
  })

  it("should be callable from runtime", () => {
    const script = runtime.generateCompletion("bash")
    expect(script).toContain("mycli")
  })
})
