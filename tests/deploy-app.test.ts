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

// ─── Context ─────────────────────────────────────────────────────
interface DeployContext {
  logs: string[]
}

// ─── Level 3: DeployCommand (leaf) ────────────────────────────────
class DeployCommand extends CommandInterface<ProjectCommand, string, any, DeployContext> {
  constructor(public override parent: ProjectCommand) {
    super(parent)
  }

  async execute(opt: ExecCmdOption<string, DeployContext>): Promise<any> {
    const { input: projectName, context } = opt
    context.logs.push(`Deploying ${projectName} to ${this.env} from branch ${this.branch}`)
    return {
      success: true,
      data: {
        project: projectName,
        env: this.env,
        branch: this.branch,
        status: "deployed",
      },
    }
  }

  get env(): string {
    return this.getOption<string>("env") ?? "dev"
  }

  get branch(): string | undefined {
    return this.getOption<string | undefined>("branch")
  }
}

Command({ name: "deploy", description: "Deploy a project", input: z.string() })(DeployCommand)
CommandOption({ name: "env", alias: "e", description: "Environment", input: z.string() })(
  DeployCommand.prototype, "env", Object.getOwnPropertyDescriptor(DeployCommand.prototype, "env")!
)
CommandOption({ name: "branch", alias: "b", description: "Git branch", input: z.string().optional() })(
  DeployCommand.prototype, "branch", Object.getOwnPropertyDescriptor(DeployCommand.prototype, "branch")!
)

// ─── Level 2: ProjectCommand (middle) ──────────────────────────
class ProjectCommand extends CommandInterface<AppCommand, unknown, unknown, DeployContext> {
  constructor(public override parent: AppCommand) {
    super(parent)
  }

  async execute(opt: ExecCmdOption<unknown, DeployContext>): Promise<any> {
    return { success: true, data: "project help" }
  }

  async deploy(opt: ExecSubCmdOption<DeployCommand, string, DeployContext>): Promise<any> {
    const { child, input, context, nextChild } = opt
    context.logs.push("Project: enriched")
    const result = await child.execute({ input, context, nextChild })
    context.logs.push(`Deploy result: ${result.success ? "ok" : "failed"}`)
    return result
  }
}

Command({ name: "project", description: "Manage projects" })(ProjectCommand)
CommandChild({ child: DeployCommand, Constructor(parent: ProjectCommand) { return new DeployCommand(parent) } })(
  ProjectCommand.prototype, "deploy", Object.getOwnPropertyDescriptor(ProjectCommand.prototype, "deploy")!
)

// ─── Level 1: AppCommand (root) ───────────────────────────────
class AppCommand extends CommandInterface<undefined, unknown, unknown, DeployContext> {
  async execute(opt: ExecCmdOption<unknown, DeployContext>): Promise<any> {
    return { success: true, data: "app root" }
  }

  async project(opt: ExecSubCmdOption<ProjectCommand, string, DeployContext>): Promise<any> {
    const { child, input, context, nextChild } = opt
    context.logs.push("App: orchestrating")

    const link = nextChild()
    if (!link) {
      return child.execute({ input, context, nextChild: () => null })
    }

    return child.deploy({
      child: link.child as DeployCommand,
      input,
      context,
      nextChild: link.nextChild,
    })
  }
}

Command({ name: "app", description: "Deployment CLI" })(AppCommand)
CommandChild({ child: ProjectCommand, Constructor(parent: AppCommand) { return new ProjectCommand(parent) } })(
  AppCommand.prototype, "project", Object.getOwnPropertyDescriptor(AppCommand.prototype, "project")!
)

// ─── Tests ────────────────────────────────────────────────────────
const runtime = createRuntime<DeployContext>({
  name: "mycli",
  commands: [AppCommand],
})

const freshCtx = (): DeployContext => ({ logs: [] })

describe("3-level deploy chain", () => {
  it("should execute 3-level chain with options", async () => {
    const ctx = freshCtx()

    const parsed = runtime.parse(["mycli", "app", "project", "deploy", "myapp", "--env", "prod", "--branch", "main"])
    expect(parsed.path).toEqual(["app", "project", "deploy"])
    expect(parsed.input).toBe("myapp")

    const result = await runtime.execute(parsed.path, parsed.input, parsed.optionEntries, ctx)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        project: "myapp",
        env: "prod",
        branch: "main",
        status: "deployed",
      })
    }
    expect(ctx.logs).toEqual([
      "App: orchestrating",
      "Project: enriched",
      "Deploying myapp to prod from branch main",
      "Deploy result: ok",
    ])
  })

  it("should use defaults for missing options", async () => {
    const ctx = freshCtx()

    const result = await runtime.execute(
      ["app", "project", "deploy"],
      "testapp",
      [],
      ctx
    )
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({
        project: "testapp",
        env: "dev",
        branch: undefined,
        status: "deployed",
      })
    }
  })

  it("should generate help for each level", async () => {
    const appHelp = runtime.generateHelp(["app"])
    expect(appHelp).toContain("mycli app")
    expect(appHelp).toContain("project")

    const deployHelp = runtime.generateHelp(["app", "project", "deploy"])
    expect(deployHelp).toContain("mycli app project deploy")
    expect(deployHelp).toContain("--env")
    expect(deployHelp).toContain("--branch")
  })

  it("should work via CLI adapter", async () => {
    const { runCli } = await import("../src/adapters/cli/cli-adapter")
    const out = { log: () => {}, error: () => {}, lines: [] as string[] }
    const code = await runCli({
      runtime,
      context: freshCtx(),
      argv: ["mycli", "app", "project", "deploy", "myapp", "--env", "staging"],
      out: { log: (m: string) => out.lines.push(m), error: (m: string) => out.lines.push(`ERR:${m}`) },
    })
    expect(code).toBe(0)
  })

  it("should show help for mid-level command", async () => {
    const ctx = freshCtx()
    const result = await runtime.execute(["app", "project"], undefined, [], ctx)
    expect(result.success).toBe(true)
    expect(result.data).toBe("project help")
  })
})
