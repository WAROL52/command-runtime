import { z } from "zod"
import { CommandInterface, Command } from "../../src/index"
import type { ExecCmdOption } from "../../src/index"

export interface Ctx { userId: string }

export class ListUsersCmd extends CommandInterface<undefined, undefined, any, Ctx> {
  async execute(opt: ExecCmdOption<undefined, Ctx>): Promise<any> {
    return {
      success: true,
      data: { users: ["alice", "bob", "charlie"], requestedBy: opt.context.userId },
    }
  }
}

export class CreateUserCmd extends CommandInterface<undefined, { name: string; age: number }, any, Ctx> {
  async execute(opt: ExecCmdOption<{ name: string; age: number }, Ctx>): Promise<any> {
    return {
      success: true,
      data: { id: "usr_" + Date.now(), name: opt.input.name, age: opt.input.age },
    }
  }
}

export function registerCommands() {
  Command({ name: "list-users" })(ListUsersCmd)
  Command({ name: "create-user", input: z.object({ name: z.string(), age: z.number() }) })(CreateUserCmd)
}
