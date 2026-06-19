import { describe, it, expect } from "vitest"
import { z } from "zod"
import {
  CommandInterface,
  createRuntime,
} from "../src/index"
import { Command } from "../src/decorators/command.decorator"
import { CommandChild } from "../src/decorators/child.decorator"
import { CommandOption } from "../src/decorators/option.decorator"
import type { ExecSubCmdOption, ExecCmdOption } from "../src/index"
import { DocGenerator } from "../src/runtime/docgen"

interface Ctx { user: string }

class UserCmd extends CommandInterface<undefined, unknown, unknown, Ctx> {
  async execute(): Promise<any> {
    return { success: true, data: "ok" }
  }
  async create(opt: ExecSubCmdOption<any, string, Ctx>): Promise<any> {
    return opt.child.execute({ input: opt.input, context: opt.context, nextChild: () => null })
  }
}

class CreateUserCmd extends CommandInterface<UserCmd, string, any, Ctx> {
  constructor(public override parent: UserCmd) { super(parent) }
  async execute(opt: ExecCmdOption<string, Ctx>): Promise<any> {
    return { success: true, data: { name: opt.input } }
  }
  get age(): number { return this.getOption<number>("age") ?? 0 }
}

Command({ name: "user", description: "Manage users" })(UserCmd)
Command({ name: "create", description: "Create a new user", input: z.string(), output: z.object({ name: z.string() }) })(CreateUserCmd)
CommandChild({ child: CreateUserCmd, Constructor(p: any) { return new CreateUserCmd(p) } })(
  UserCmd.prototype, "create", Object.getOwnPropertyDescriptor(UserCmd.prototype, "create")!
)
CommandOption({ name: "age", alias: "a", description: "User age", input: z.number().optional() })(
  CreateUserCmd.prototype, "age", Object.getOwnPropertyDescriptor(CreateUserCmd.prototype, "age")!
)

const runtime = createRuntime<Ctx>({ name: "mycli", commands: [UserCmd] })

describe("DocGenerator", () => {
  it("should generate markdown for the command tree", () => {
    const gen = new DocGenerator(runtime)
    const docs = gen.generate()
    expect(docs["README.md"]).toBeDefined()

    const content = docs["README.md"]
    expect(content).toContain("# mycli")
    expect(content).toContain("`user`")
    expect(content).toContain("`user create`")
  })

  it("should include options and arguments in doc", () => {
    const gen = new DocGenerator(runtime)
    const docs = gen.generate()
    const content = docs["README.md"]
    expect(content).toContain("--age")
    expect(content).toContain("input")
    expect(content).toContain("string")
  })

  it("should generate per-command files", () => {
    const gen = new DocGenerator(runtime)
    const docs = gen.generate({ perCommand: true })
    expect(docs["README.md"]).toBeDefined()
    expect(docs["user.md"]).toBeDefined()
    expect(docs["user-create.md"]).toBeDefined()
  })
})
