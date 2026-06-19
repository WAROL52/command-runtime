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

interface MyContext {
  logger: { log: (msg: string) => void }
  userId: string
}

const userSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  age: z.number(),
})

class CreateUserCommand extends CommandInterface<UserCommand, string, any, MyContext> {
  constructor(public override parent: UserCommand) {
    super(parent)
  }

  async execute(opt: ExecCmdOption<string, MyContext>): Promise<any> {
    const { input } = opt
    const user = {
      name: input,
      description: this.description,
      age: this.age,
    }
    this.parent.print(user)
    return { success: true, data: user }
  }

  get description(): string | undefined {
    return this.getOption<string | undefined>("description")
  }

  get age(): number {
    return this.getOption<number>("age") ?? 0
  }
}

class UserCommand extends CommandInterface<undefined, unknown, unknown, MyContext> {
  async execute(opt: ExecCmdOption<unknown, MyContext>): Promise<any> {
    this.printHelp()
    return { success: true, data: "help shown" }
  }

  print(_user: any): void {}

  async create(opt: ExecSubCmdOption<CreateUserCommand, string, MyContext>): Promise<any> {
    const { child, input, context } = opt
    context.logger.log(`Creating user: ${input}`)
    return child.execute({ input, context, nextChild: () => null })
  }
}

Command({ name: "user", alias: "u", description: "Manage users" })(UserCommand)
Command({ name: "create", alias: "c", description: "Create a user", input: z.string(), output: userSchema })(CreateUserCommand)

CommandChild({
  child: CreateUserCommand,
  Constructor(parent) { return new CreateUserCommand(parent) },
})(UserCommand.prototype, "create", Object.getOwnPropertyDescriptor(UserCommand.prototype, "create")!)

CommandOption({ name: "description", alias: "d", description: "User description", input: z.string().optional() })(
  CreateUserCommand.prototype, "description", Object.getOwnPropertyDescriptor(CreateUserCommand.prototype, "description")!
)

CommandOption({ name: "age", alias: "a", description: "User age", input: z.coerce.number().optional(), output: z.number() })(
  CreateUserCommand.prototype, "age", Object.getOwnPropertyDescriptor(CreateUserCommand.prototype, "age")!
)

const context: MyContext = {
  logger: { log: (_msg: string) => {} },
  userId: "test-user",
}

describe("Command Runtime", () => {
  it("should parse arguments and execute a command chain", async () => {
    const rt = createRuntime<MyContext>({
      name: "mycli",
      commands: [UserCommand],
    })

    const argv = ["mycli", "user", "create", "Jack", "--age", "25"]
    const parsed = rt.parse(argv)
    expect(parsed.path).toEqual(["user", "create"])
    expect(parsed.input).toBe("Jack")

    const result = await rt.executeFromArgv(argv, context)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        name: "Jack",
        description: undefined,
        age: 25,
      })
    }
  })

  it("should parse short aliases", async () => {
    const rt = createRuntime<MyContext>({
      name: "mycli",
      commands: [UserCommand],
    })

    const argv = ["mycli", "user", "create", "Jack", "-a", "30"]
    const result = await rt.executeFromArgv(argv, context)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.age).toBe(30)
    }
  })

  it("should return help when terminal command has no child", async () => {
    const rt = createRuntime<MyContext>({
      name: "mycli",
      commands: [UserCommand],
    })

    const argv = ["mycli", "user"]
    const result = await rt.executeFromArgv(argv, context)
    expect(result.success).toBe(true)
  })

  it("should return error for unknown command", async () => {
    const rt = createRuntime<MyContext>({
      name: "mycli",
      commands: [UserCommand],
    })

    const argv = ["mycli", "unknown"]
    const result = await rt.executeFromArgv(argv, context)
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.errors[0]!.message).toContain("not found")
    }
  })

  it("should generate help text with full path", async () => {
    const rt = createRuntime<MyContext>({
      name: "mycli",
      commands: [UserCommand],
    })

    const help = rt.generateHelp(["user", "create"])
    expect(help).toContain("mycli user create")
    expect(help).toContain("--age")
    expect(help).toContain("--description")
  })

  it("should provide command tree introspection", async () => {
    const rt = createRuntime<MyContext>({
      name: "mycli",
      commands: [UserCommand],
    })

    const tree = rt.getCommandTree()
    expect(tree).toHaveLength(1)
    expect(tree[0]!.name).toBe("user")
    expect(tree[0]!.children).toHaveLength(1)
    expect(tree[0]!.children![0]!.name).toBe("create")
  })
})
